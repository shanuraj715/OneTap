import type { PrinterDoc, PrintJobDoc } from "@onetap/db";
import { decryptSecret } from "../../../lib/crypto";
import { logger } from "../../../logger";
import type { DispatchResult, PrintProvider } from "./types";

const PRINTNODE_API = process.env.PRINTNODE_API_URL ?? "https://api.printnode.com";
const TIMEOUT_MS = 15_000;

/**
 * PrintNode. A small client on any always-on machine at the outlet registers its
 * OS printers with PrintNode's cloud; this server then POSTs jobs to their API.
 *
 * The only genuinely `push` target we have: it works with no browser open, no
 * mixed-content problem, and no route into the outlet's LAN. That reliability is
 * what the per-printer subscription buys.
 */
export const cloudProvider: PrintProvider = {
  target: "cloud",
  mode: "push",

  configError(printer: PrinterDoc): string | null {
    if (!printer.connection.cloudPrinterId) return "Set the printer id from your cloud print account.";
    if (!printer.connection.cloudApiKey) return "Add the API key for your cloud print account.";
    return null;
  },

  async send(job: PrintJobDoc, printer: PrinterDoc): Promise<DispatchResult> {
    let apiKey: string;
    try {
      apiKey = decryptSecret(printer.connection.cloudApiKey);
    } catch {
      return { ok: false, error: "The stored cloud API key could not be decrypted. Re-enter it." };
    }

    // Raw ESC/POS where we have it (so cut and drawer work), otherwise let the
    // service rasterise the HTML through the OS driver.
    const raw = job.payload.escpos;
    const body = {
      printerId: Number(printer.connection.cloudPrinterId),
      title: `${job.docType} ${job.orderNumber ?? String(job._id)}`,
      contentType: raw ? "raw_base64" : "pdf_base64",
      content: raw ?? Buffer.from(job.payload.html, "utf8").toString("base64"),
      source: "OneTap",
      qty: job.copies,
    };

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${PRINTNODE_API}/printjobs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });

      const text = await res.text();
      if (!res.ok) {
        // 4xx means the config is wrong and retrying will not help; the caller
        // uses the message to decide whether to keep the job on the ladder.
        return { ok: false, error: `Cloud print service responded ${res.status}: ${text.slice(0, 200)}` };
      }
      return { ok: true, externalId: text.replace(/\D/g, "").slice(0, 20) || undefined };
    } catch (e) {
      const msg = (e as Error).name === "AbortError" ? "Timed out reaching the cloud print service." : (e as Error).message;
      logger.warn({ err: e, jobId: String(job._id) }, "cloud print dispatch failed");
      return { ok: false, error: msg };
    } finally {
      clearTimeout(timer);
    }
  },
};
