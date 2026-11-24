import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation as useRouterLocation } from "react-router-dom";
import { storeFromPath } from "./nav";
                                                         
import * as api from "./api";
import { useAuth } from "./useAuth";
import { useOutlet } from "./useOutlet";
import { useStorePlan } from "./useStorePlan";
                                                

/** How often this station asks the server for new tickets — and never more often than this, whatever wakes the tab. */
export const PRINT_POLL_MS = 8_000;
const POLL_MS = PRINT_POLL_MS;
const STORAGE_KEY = "rasoipulse.printStation";

/**
 * Whether this browser acts as a print station. Off by default and remembered
 * per device — the owner checking sales from home should not start firing
 * kitchen tickets at the shop.
 */
                                  
                   
                         
                                                           
                   
 

function loadSettings()                  {
  const fallback                  = {
    enabled: false,
    targets: ["browser", "epos-lan"],
    clientId: `browser-${Math.random().toString(36).slice(2, 10)}`,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw)                            ;
    return {
      enabled: Boolean(parsed.enabled),
      targets: parsed.targets?.length ? parsed.targets : fallback.targets,
      clientId: parsed.clientId || fallback.clientId,
    };
  } catch {
    return fallback;
  }
}

function saveSettings(s                 )       {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private window — the station just won't be remembered */
  }
}

/* ------------------------------------------------------------- executors */

/**
 * Print through the OS driver. The browser gives us no way to know whether the
 * user pressed Print or Cancel, so this resolves once the dialog has been shown
 * — and the queue labels it "sent to the print dialog", not "printed", so the
 * status stays honest.
 */
async function printViaBrowser(html        )                {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    Object.assign(frame.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      visibility: "hidden",
    });

    const cleanup = () => setTimeout(() => frame.remove(), 1500);
    const failTimer = setTimeout(() => {
      cleanup();
      reject(new Error("The print document did not load in time"));
    }, 15_000);

    frame.onload = () => {
      clearTimeout(failTimer);
      try {
        const win = frame.contentWindow;
        if (!win) throw new Error("Could not open the print document");
        win.focus();
        win.print();
        cleanup();
        resolve();
      } catch (e) {
        cleanup();
        reject(e         );
      }
    };

    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

/** EPSON's ePOS-Print takes a SOAP envelope carrying the ESC/POS bytes. */
function eposEnvelope(escposBase64        )         {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
<s:Body>
<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
<command>${escposBase64}</command>
</epos-print>
</s:Body>
</s:Envelope>`;
}

async function printViaEpos(outlet        , job            )                {
  if (!job.escpos) throw new Error("This job has no printer bytes — check the template's paper width");

  const { url } = await api.getEposEndpoint(outlet, job.printerId);

  // The classic failure: an https admin page is not allowed to call a plain
  // http printer, and the browser blocks it before the request leaves.
  if (window.location.protocol === "https:" && url.startsWith("http:")) {
    throw new Error(
      "This page is on https and the printer is on plain http, so the browser blocks the request. " +
        "Enable https on the printer, or open the admin over http on the shop network.",
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "text/xml; charset=utf-8" },
    body: eposEnvelope(job.escpos),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Printer responded ${res.status}`);

  // ePOS reports the real outcome inside the XML, not the HTTP status.
  const success = /success="true"/i.test(body);
  if (!success) {
    const code = /code="([^"]+)"/i.exec(body)?.[1];
    throw new Error(explainEposCode(code) ?? `Printer refused the job${code ? ` (${code})` : ""}`);
  }
}

/** The codes staff actually hit, in words they can act on. */
function explainEposCode(code                    )                {
  switch (code) {
    case "EPTR_COVER_OPEN":
      return "The printer cover is open. Close it and retry.";
    case "EPTR_REC_EMPTY":
      return "The printer is out of paper. Load a roll and retry.";
    case "EPTR_UNRECOVERABLE":
      return "The printer reported a hardware fault. Power-cycle it and retry.";
    case "EPTR_AUTOMATICAL":
      return "The printer reported an auto-recoverable error — usually a paper jam.";
    case "ASB_OFF_LINE":
      return "The printer is offline.";
    case "DeviceNotFound":
      return "No printer at that device id. Check the ePOS device id (usually local_printer).";
    default:
      return null;
  }
}

/* ------------------------------------------------------------------ runner */

;                             
                            
                                   
                                         
                
                       
                           
                                                             
                     
 

/**
 * The in-browser half of the print pipeline.
 *
 * Browser and ePOS jobs cannot be pushed from the server — the printer is on the
 * shop's network, or behind the OS print dialog. So this claims those jobs and
 * executes them here, reporting the outcome back into the same queue, with the
 * same retry ladder, as every other target.
 */
export function usePrintRunner(outlet                    , canPrint         )              {
  const [settings, setSettings] = useState                 (loadSettings);
  const [busy, setBusy] = useState(false);
  const [lastRun, setLastRun] = useState             (null);
  const [lastError, setLastError] = useState               (null);
  const qc = useQueryClient();
  const running = useRef(false);
  const lastStart = useRef(0);
  // when the next automatic check is due (for the countdown beside "Print station on")
  const [nextAt, setNextAt] = useState(null);

  const update = useCallback((patch                          ) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const poll = useCallback(async (force = false) => {
    if (!outlet || running.current) return;
    // a tab coming back to the front or a window focus must not trigger an extra request inside the interval
    if (!force && Date.now() - lastStart.current < POLL_MS - 500) return;
    running.current = true;
    lastStart.current = Date.now();
    setNextAt(lastStart.current + POLL_MS);
    setBusy(true);
    try {
      const { jobs } = await api.claimPrintJobs(outlet, settings.clientId, settings.targets);
      if (jobs.length) setLastError(null);

      for (const job of jobs) {
        const started = Date.now();
        try {
          if (job.target === "epos-lan") await printViaEpos(outlet, job);
          else await printViaBrowser(job.html);
          await api.reportPrintResult(outlet, job.id, { ok: true, ms: Date.now() - started });
        } catch (e) {
          const message = (e         ).message || "Printing failed";
          setLastError(message);
          // Reporting the failure is what puts the job back on the retry ladder.
          await api.reportPrintResult(outlet, job.id, { ok: false, error: message, ms: Date.now() - started });
        }
      }

      if (jobs.length) qc.invalidateQueries({ queryKey: ["print-jobs"] });
      setLastRun(new Date());
    } catch (e) {
      setLastError((e         ).message);
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, [outlet, qc, settings.clientId, settings.targets]);

  useEffect(() => {
    if (!settings.enabled || !outlet || !canPrint) return;
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    // A browser slows the timers of a tab you are not looking at; coming back to it (or to the window) checks at once.
    const wake = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [settings.enabled, outlet, canPrint, poll]);

  return {
    /** this device is a print station AND may print for this store — so it is listening, whichever page is open */
    active: Boolean(settings.enabled && outlet && canPrint),
    settings,
    setEnabled: (v) => update({ enabled: v }),
    setTargets: (t) => update({ targets: t }),
    busy,
    lastRun,
    lastError,
    runNow: () => void poll(true),
    nextAt: settings.enabled && outlet && canPrint ? nextAt : null,
  };
}

/* ------------------------------------------------- one station, every page */

const PrintStationContext = createContext(null);

/**
 * The print station, mounted ONCE in the signed-in dashboard (not on the Printing page): if this device is a print
 * station, tickets are picked up and printed whichever page is open — Orders, Take order, anywhere. It only listens when
 * the device has been switched on (a per-device setting), the person may print, and the store's plan includes Printing.
 * Close the dashboard and it stops, as before.
 */
export function PrintStationProvider({ children }) {
  const { outlet } = useOutlet();
  const { can, user } = useAuth();
  const { hasFeature } = useStorePlan();
  const { pathname } = useRouterLocation();
  // The platform's super admin looking at the platform console (not inside one store) is not a print station: it asks
  // the server for nothing, whatever is switched on in this browser.
  const inPlatformConsole = Boolean(user?.isSuperAdmin) && !storeFromPath(pathname);
  const runner = usePrintRunner(outlet, can("print:job") && hasFeature("printing") && !inPlatformConsole);
  return createElement(PrintStationContext.Provider, { value: runner }, children);
}

/** The shared print station (see {@link PrintStationProvider}). */
export function usePrintStation() {
  const station = useContext(PrintStationContext);
  if (!station) throw new Error("usePrintStation() must be called within <PrintStationProvider>");
  return station;
}

