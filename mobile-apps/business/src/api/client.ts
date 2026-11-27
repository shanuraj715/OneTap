/** What went wrong, in words a person can act on. `status` 0 = the request never got an answer. */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
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
  get isForbidden() { return this.status === 403; }
}

export interface ClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  /** the server says the sign-in no longer counts (expired, signed out elsewhere, switched off) */
  onUnauthorized: () => void;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** the outlet the store's reports are read through (`x-rasoipulse-outlet`): any outlet this person may see */
  getOutlet?: () => string | null;
}
export interface RequestOptions { /** extra headers for this one call (an outlet to act on, say) */ headers?: Record<string, string>; method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; auth?: boolean; signal?: AbortSignal; /** send THIS sign-in instead of the current one (signing out sends the token the session just let go of) */ token?: string }

const DEFAULT_TIMEOUT_MS = 20_000;

export function createClient(options: ClientOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, auth = true, signal } = opts;
    const token = opts.token ?? (auth ? options.getToken() : null);
    const headers: Record<string, string> = { accept: "application/json", ...options.headers };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;
    const outlet = options.getOutlet?.();
    if (outlet) headers["x-rasoipulse-outlet"] = outlet;
    Object.assign(headers, opts.headers);

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    const onCallerAbort = () => controller.abort();
    signal?.addEventListener("abort", onCallerAbort);
    let res: Response;
    try {
      res = await fetchImpl(`${options.baseUrl}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
    } catch (e) {
      if (signal?.aborted && !timedOut) throw e;
      throw new ApiError(0, timedOut ? "The server took too long to answer. Check the connection and try again." : "Can't reach the server. Check the internet connection and try again.");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onCallerAbort);
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text().catch(() => "");
    let json: unknown;
    try { json = text ? JSON.parse(text) : undefined; } catch { /* not JSON (a proxy's error page) */ }
    if (!res.ok) {
      const data = (json && typeof json === "object" ? json : {}) as { error?: unknown; details?: Record<string, unknown> };
      const details = data.details && typeof data.details === "object" ? data.details : undefined;
      const retry = Number(details?.retryAfterSec ?? res.headers?.get?.("retry-after"));
      const message = typeof data.error === "string" && data.error ? data.error : res.status >= 500 ? "The server had a problem. Try again in a moment." : `The server answered ${res.status}.`;
      if (res.status === 401 && token && !opts.token) options.onUnauthorized();
      throw new ApiError(res.status, message, { code: typeof details?.code === "string" ? details.code : undefined, details, retryAfterSec: Number.isFinite(retry) && retry > 0 ? retry : undefined });
    }
    return json as T;
  }
  /** A file (a report): the bytes and the name the server gave it. Same errors, in the same words, as `request`. */
  async function download(path: string, opts: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<{ bytes: ArrayBuffer; fileName: string; type: string }> {
    const token = options.getToken();
    const headers: Record<string, string> = { ...options.headers };
    if (opts.body !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;
    const outlet = options.getOutlet?.();
    if (outlet) headers["x-rasoipulse-outlet"] = outlet;
    let res: Response;
    try {
      res = await fetchImpl(`${options.baseUrl}${path}`, { method: opts.method ?? "GET", headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) });
    } catch {
      throw new ApiError(0, "Can't reach the server. Check the internet connection and try again.");
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let message = res.status >= 500 ? "The server had a problem. Try again in a moment." : `The server answered ${res.status}.`;
      try { const j = JSON.parse(text) as { error?: unknown }; if (typeof j.error === "string" && j.error) message = j.error; } catch { /* not JSON */ }
      if (res.status === 401 && token) options.onUnauthorized();
      throw new ApiError(res.status, message);
    }
    const disposition = res.headers?.get?.("content-disposition") ?? "";
    const fileName = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? "report";
    return { bytes: await res.arrayBuffer(), fileName: decodeURIComponent(fileName), type: res.headers?.get?.("content-type") ?? "application/octet-stream" };
  }
  return { request, download };
}
export type ApiClient = ReturnType<typeof createClient>;
