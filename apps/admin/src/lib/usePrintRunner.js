import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
                                                         
import * as api from "./api";
                                                

const POLL_MS = 4_000;
const STORAGE_KEY = "onetap.printStation";

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

  const update = useCallback((patch                          ) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    if (!outlet || running.current) return;
    running.current = true;
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
    return () => clearInterval(timer);
  }, [settings.enabled, outlet, canPrint, poll]);

  return {
    settings,
    setEnabled: (v) => update({ enabled: v }),
    setTargets: (t) => update({ targets: t }),
    busy,
    lastRun,
    lastError,
    runNow: () => void poll(),
  };
}
