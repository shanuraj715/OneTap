import type { PrintTarget } from "@onetap/config-schema";
import type { PrinterDoc, PrintJobDoc } from "@onetap/db";

export interface DispatchResult {
  ok: boolean;
  error?: string;
  /** provider-side job id, kept for support tickets */
  externalId?: string;
}

/**
 * How a job reaches a printer.
 *
 * `push` providers are driven by this server. `pull` providers cannot be —
 * the printer lives on the outlet's LAN, or behind a browser, where the API has
 * no route to it. Those jobs sit in `queued` until a client on site claims them
 * and reports back. Same queue, same retry ladder, same audit trail either way.
 */
export interface PrintProvider {
  target: PrintTarget;
  mode: "push" | "pull";
  /** why a printer isn't usable yet, or null when it's ready */
  configError(printer: PrinterDoc): string | null;
  /** only ever called for `push` providers */
  send?(job: PrintJobDoc, printer: PrinterDoc): Promise<DispatchResult>;
}
