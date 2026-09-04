import type { PrinterDoc } from "@onetap/db";
import type { PrintProvider } from "./types";

/**
 * The browser prints through the OS driver with `window.print()`. Universal —
 * it works with any printer the computer already has — but somebody has to be
 * looking at the screen, and the OS gives no auto-cut or drawer kick.
 */
export const browserProvider: PrintProvider = {
  target: "browser",
  mode: "pull",
  configError: () => null,
};

/**
 * EPSON ePOS-Print. The printer runs a small HTTP server in firmware, and a
 * page on the same LAN POSTs the job straight to it.
 *
 * This is `pull` rather than `push` for a physical reason: the printer sits on
 * the outlet's private network at an address this server has no route to. The
 * admin page, running on that network, does the POST.
 */
export const eposProvider: PrintProvider = {
  target: "epos-lan",
  mode: "pull",
  configError: (printer: PrinterDoc) => {
    if (!printer.connection.host) return "Set the printer's IP address on the local network.";
    if (!printer.connection.deviceId) return "Set the ePOS device id (usually local_printer).";
    return null;
  },
};

/**
 * A small program the restaurant runs on an always-on machine. It long-polls for
 * jobs and prints them over USB, Bluetooth or LAN — the only path that reaches a
 * USB printer with no dialog.
 */
export const agentProvider: PrintProvider = {
  target: "agent",
  mode: "pull",
  configError: (printer: PrinterDoc) => {
    if (!printer.connection.agentId) return "Give this printer an agent id, and use the same id when you install the agent.";
    return null;
  },
};
