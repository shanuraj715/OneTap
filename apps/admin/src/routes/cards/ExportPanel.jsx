import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import {
  buildSheets,
  downloadCanvas,
  openPrintWindow,
  renderPrintable,
  safeFilename,
  sheetPlan,
  SHEETS,
} from "../../lib/card/cardExport";
import { Button, Card, Checkbox, Field, Note, Select, Toast } from "../../ui";
import { mm, Row, Segmented, Slider } from "./controls";

/**
 * Getting the design onto paper.
 *
 * Two shapes of output, because owners want both: one card at a time (to send
 * a print shop) and a tiled sheet with every table's own code on it (to run off
 * on the office printer and cut up).
 */
export function ExportPanel({ spec, data, tables, patch, outletName, blockingErrors }) {
  const [sheetId, setSheetId] = useState("a4");
  const [gapMm, setGapMm] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [progress, setProgress] = useState(null);

  const sheet = SHEETS[sheetId];
  const plan = useMemo(() => sheetPlan({ spec, sheet, gapMm }), [spec, sheet, gapMm]);
  const printable = tables.filter((t) => t.isActive !== false);
  const sheetCount = plan.perSheet > 0 ? Math.ceil(printable.length / plan.perSheet) : 0;

  const setTent = (p) => patch({ tent: { ...spec.tent, ...p } });
  const setPrint = (p) => patch({ print: { ...spec.print, ...p } });

  const guard = async (name, fn) => {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy("");
      setProgress(null);
    }
  };

  const oneCard = () =>
    guard("one", async () => {
      const table = printable[0];
      const cardData = table ? { ...data, table: table.number, zone: table.zone ?? "", url: table.url } : data;
      const { canvas, steppedDown, dpi } = await renderPrintable({ spec, data: cardData, dpi: spec.print.dpi });
      await downloadCanvas(canvas, `${safeFilename(outletName, "table-card")}-table-${safeFilename(cardData.table, "1")}.png`);
      if (steppedDown) setNotice(`Exported at ${dpi}dpi — this browser can't produce an image that large at ${spec.print.dpi}dpi.`);
    });

  const sheets = (andPrint) =>
    guard(andPrint ? "print" : "sheets", async () => {
      if (printable.length === 0) throw new Error("Add some tables first — a sheet needs a table per card.");
      const { pages, steppedDown, dpi } = await buildSheets({
        spec,
        data,
        tables: printable,
        dpi: spec.print.dpi,
        sheet,
        gapMm,
        onProgress: (done, total) => setProgress(`${done} of ${total}`),
      });
      if (andPrint) {
        openPrintWindow(pages, sheet, `${outletName} table cards`);
      } else {
        for (const [i, page] of pages.entries()) {
          await downloadCanvas(page, `${safeFilename(outletName, "table-cards")}-sheet-${i + 1}.png`);
        }
      }
      if (steppedDown) setNotice(`Produced at ${dpi}dpi — this browser can't produce a ${sheet.label} sheet at ${spec.print.dpi}dpi.`);
    });

  return (
    <>
      <Card title="Table tent" subtitle="Fold one sheet in half so the card stands up and reads from both sides.">
        <Checkbox checked={spec.tent.enabled} onChange={(enabled) => setTent({ enabled })} label="Make this a folding tent card" />
        {spec.tent.enabled ? (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
            <Segmented
              label="The other side"
              value={spec.tent.mode}
              onChange={(mode) => setTent({ mode })}
              options={[
                { value: "rotate180", label: "Same, upside down" },
                { value: "duplicate", label: "Same, upright" },
                { value: "blank", label: "Blank" },
              ]}
              info="Upside down is what you want for a normal fold — both faces then read the right way up once it's standing."
            />
            <Slider
              label="Flat area at the fold"
              value={spec.tent.foldGapMm}
              onChange={(foldGapMm) => setTent({ foldGapMm })}
              min={0}
              max={20}
              step={0.5}
              suffix="mm"
            />
            <p style={hint}>
              Prints {spec.size.widthMm} × {(spec.size.heightMm * 2 + spec.tent.foldGapMm).toFixed(0)}mm, folded across the middle.
            </p>
          </div>
        ) : null}
      </Card>

      <Card title="Print settings">
        <Row>
          <Segmented
            label="Quality"
            value={String(spec.print.dpi)}
            onChange={(v) => setPrint({ dpi: Number(v) })}
            options={[
              { value: "150", label: "150 dpi — draft" },
              { value: "300", label: "300 dpi — print" },
            ]}
          />
          <Field label="Sheet to print on">
            <Select value={sheetId} onChange={(e) => setSheetId(e.target.value)}>
              {Object.values(SHEETS).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.widthMm}×{s.heightMm}mm
                </option>
              ))}
            </Select>
          </Field>
        </Row>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 12 }}>
          <Checkbox checked={spec.print.cutLine} onChange={(cutLine) => setPrint({ cutLine })} label="Show where to cut" />
          <Checkbox
            checked={spec.print.cropMarks}
            onChange={(cropMarks) => setPrint({ cropMarks })}
            label="Crop marks"
            info="Corner marks a commercial printer trims to. Not needed if you're cutting by hand."
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <Slider
            label="Bleed"
            value={spec.print.bleedMm}
            onChange={(bleedMm) => setPrint({ bleedMm })}
            min={0}
            max={6}
            step={0.5}
            suffix="mm"
            info="Extra background beyond the cut, so a slightly misaligned trim doesn't leave a white sliver. Ask your printer what they need — usually 3mm."
          />
        </div>
      </Card>

      <Card title="Download" subtitle="Each card carries its own table's code — nothing to match up by hand.">
        {blockingErrors > 0 ? (
          <Note icon={<Printer size={15} />}>
            There {blockingErrors === 1 ? "is" : "are"} {blockingErrors} scannability problem
            {blockingErrors === 1 ? "" : "s"} to fix above. You can still print, but check a card with your phone first.
          </Note>
        ) : null}

        <Slider
          label="Space between cards"
          value={gapMm}
          onChange={setGapMm}
          min={0}
          max={15}
          step={0.5}
          suffix="mm"
          info="Zero means neighbouring cards share a cut line, which is how a guillotine works and fits the most per sheet. Add a gap if you're cutting by hand."
        />

        <p style={{ ...hint, marginTop: 12 }}>
          {plan.perSheet > 0 ? (
            <>
              {plan.cols} × {plan.rows} cards per {sheet.label} sheet — {printable.length} table
              {printable.length === 1 ? "" : "s"} needs {sheetCount} sheet{sheetCount === 1 ? "" : "s"}.
            </>
          ) : (
            <>{doesNotFit(spec, sheet, plan)}</>
          )}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Button onClick={() => sheets(true)} disabled={Boolean(busy) || plan.perSheet === 0} style={btn}>
            <Printer size={15} /> {busy === "print" ? progress ?? "Preparing…" : `Print ${sheetCount || ""} sheet${sheetCount === 1 ? "" : "s"}`.trim()}
          </Button>
          <Button variant="outline" onClick={() => sheets(false)} disabled={Boolean(busy) || plan.perSheet === 0} style={btn}>
            <Download size={15} /> {busy === "sheets" ? progress ?? "Preparing…" : "Download sheets"}
          </Button>
          <Button variant="outline" onClick={oneCard} disabled={Boolean(busy)} style={btn}>
            <Download size={15} /> {busy === "one" ? "Preparing…" : "One card, full size"}
          </Button>
        </div>

        <p style={{ ...hint, marginTop: 12 }}>
          Print at 100% — "fit to page" shrinks the card and it will no longer fit a stand.
        </p>

        {error ? <Toast kind="error">{error}</Toast> : null}
        {notice ? <Toast kind="info">{notice}</Toast> : null}
      </Card>

      <Card title="Before you print forty of them">
        <p style={hint}>
          Print one, put it on a table, and scan it with a phone from where a customer would sit. Everything else here is
          a prediction; that is the actual test.
        </p>
        <p style={{ ...hint, marginTop: 8 }}>
          Rotating a table's code under Tables &amp; QR invalidates every card already printed for that table.
        </p>
      </Card>
    </>
  );
}

/**
 * Say by how much, and which lever fixes it.
 *
 * A6 folded as a tent is 302mm, which misses A4 by five — a shortfall the fold
 * gap alone covers. "Too big, use a smaller card" would send someone to redo
 * their whole design over 5mm.
 */
function doesNotFit(spec, sheet, plan) {
  const overW = Math.max(0, plan.cardW - sheet.widthMm);
  const overH = Math.max(0, plan.cardH - sheet.heightMm);
  const by = Math.max(overW, overH).toFixed(0);
  const axis = overH >= overW ? "taller" : "wider";

  if (spec.tent.enabled && overH > 0 && overH <= spec.tent.foldGapMm) {
    return `Folded, this card is ${by}mm ${axis} than ${sheet.label}. Reducing the flat area at the fold to ${Math.max(0, spec.tent.foldGapMm - overH).toFixed(1)}mm would make it fit.`;
  }
  return `This card is ${by}mm ${axis} than ${sheet.label}${spec.tent.enabled ? " once folded" : ""}. Use a bigger sheet, or a smaller card — one card at a time still works.`;
}

const hint = { margin: 0, fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55 };
const btn = { display: "inline-flex", gap: 7, alignItems: "center" };
