import type { z } from "zod";

/** What went wrong, in words a person can act on. `status` 0 = the request never got an answer. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  /** for "too many attempts": how many seconds until trying again is allowed */
  readonly retryAfterSec?: number;

  constructor(status: number, message: string, extra: { code?: string; details?: Record<string, unknown>; retryAfterSec?: number } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = extra.code;
    this.details = extra.details;
    this.retryAfterSec = extra.retryAfterSec;
  }

  get isNetwork() { return this.status === 0; }
  get isTooManyRequests() { return this.status === 429; }
  get isUnauthorized() { return this.status === 401; }
}

export interface ClientOptions {
  baseUrl: string;
  /** the sign-in token, or null when signed out */
  getToken: () => string | null;
  /** called when the server says the sign-in no longer counts (expired, signed out elsewhere) */
  onUnauthorized: () => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** sent with every request: which build of the app this is (the server turns away a build that is too old when an update is required) */
  headers?: Record<string, string>;
  /** called when the server refuses because this build is out of date and an update is required (426) */
  onUpdateRequired?: (details: Record<string, unknown>) => void;
  /** called with the `x-refresh-seconds` header of an answer (how often the platform admin wants this app to ask for new data), when it has one */
  onRefreshSeconds?: (raw: string) => void;
}

export interface RequestOptions<S extends z.ZodType | undefined> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** which outlet this is about (the server also checks the person may use it) */
  outletId?: string;
  /** false for the sign-in calls: they carry no token, and a 401 there is just "wrong password", not "session ended" */
  auth?: boolean;
  schema?: S;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export function createClient(options: ClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<S extends z.ZodType | undefined = undefined>(path: string, opts: RequestOptions<S> = {}): Promise<S extends z.ZodType ? z.infer<S> : unknown> {
    const { method = "GET", body, outletId, auth = true, schema, signal } = opts;
    const token = auth ? options.getToken() : null;
    const headers: Record<string, string> = { accept: "application/json", ...options.headers };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;
    if (outletId) headers["x-rasoipulse-outlet"] = outletId;

    // a request that takes too long is cut off (a slow restaurant Wi-Fi must not leave a spinner running forever)
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener("abort", onCallerAbort);

    let res: Response;
    try {
      res = await fetchImpl(`${options.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    } catch (e) {
      if (signal?.aborted && !timedOut) throw e; // the screen left: not an error to show
      throw new ApiError(0, timedOut ? "The server took too long to answer. Check the connection and try again." : "Can't reach the server. Check the internet connection and try again.");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onCallerAbort);
    }

    // every answer (a refusal too) tells the app how often to ask again; the admin can change it at any time
    const refreshAsked = res.headers?.get?.("x-refresh-seconds");
    if (refreshAsked) options.onRefreshSeconds?.(refreshAsked);

    if (res.status === 204) return undefined as never;
    const text = await res.text().catch(() => "");
    let json: unknown = undefined;
    try { json = text ? JSON.parse(text) : undefined; } catch { /* not JSON (a proxy's error page) */ }

    if (!res.ok) {
      const data = (json && typeof json === "object" ? json : {}) as { error?: unknown; details?: Record<string, unknown> };
      const details = data.details && typeof data.details === "object" ? data.details : undefined;
      const retry = Number(details?.retryAfterSec ?? res.headers.get("retry-after"));
      const message = typeof data.error === "string" && data.error ? data.error : res.status >= 500 ? "The server had a problem. Try again in a moment." : `The server answered ${res.status}.`;
      if (res.status === 401 && token) options.onUnauthorized();
      if (res.status === 426 && details?.code === "update_required") options.onUpdateRequired?.(details);
      throw new ApiError(res.status, message, { code: typeof details?.code === "string" ? details.code : undefined, details, retryAfterSec: Number.isFinite(retry) && retry > 0 ? retry : undefined });
    }

    if (!schema) return json as never;
    const parsed = (schema as z.ZodType).safeParse(json);
    if (!parsed.success) {
      throw new ApiError(502, "The server sent something this version of the app does not understand. Update the app, or ask for help.", { details: { path, problems: parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`) } });
    }
    return parsed.data as never;
  }

  return { request };
}
export type ApiClient = ReturnType<typeof createClient>;
