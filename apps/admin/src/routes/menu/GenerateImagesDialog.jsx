import { useMemo, useState } from "react";
import { AI_ASPECT_RATIOS, AI_MAX_IMAGES_AT_ONCE, buildItemImagePrompt, categoryPathLabel, IMAGE_RULES } from "@onetap/config-schema";
import { Loader, RotateCcw, Sparkles } from "lucide-react";
import { useGenerateItemImages } from "../../lib/useMenu";
import { Button, Modal, Toast } from "../../ui";

/**
 * Make pictures of a dish with AI (Gemini) and add them to it. Only the platform's super admin ever sees the button
 * that opens this. They pick the SHAPE and HOW MANY (and may edit the description Gemini is given); the server makes
 * the pictures — spread over the Gemini keys saved in the console — and saves them straight onto the dish.
 */
export function GenerateImagesDialog({ outlet, menu, item, onClose }) {
  const generate = useGenerateItemImages(outlet);
  const room = Math.max(0, IMAGE_RULES.maxPerItem - item.images.length);
  const maxCount = Math.min(AI_MAX_IMAGES_AT_ONCE, room);

  const defaultPrompt = useMemo(
    () => buildItemImagePrompt({ name: item.name, description: item.description, foodType: item.foodType, category: categoryPathLabel(menu.categories, item.categoryId) }),
    [item, menu.categories],
  );
  const [ratio, setRatio] = useState("4:3");
  const [count, setCount] = useState(Math.min(2, Math.max(1, maxCount)));
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [result, setResult] = useState(null);

  const working = generate.isPending;
  const edited = prompt.trim() !== defaultPrompt.trim();
  const safeCount = Math.min(count, Math.max(1, maxCount));

  const run = () => {
    setResult(null);
    generate.mutate(
      { id: item.id, body: { aspectRatio: ratio, count: safeCount, ...(edited && prompt.trim() ? { prompt: prompt.trim() } : {}) } },
      { onSuccess: (r) => setResult(r) },
    );
  };

  return (
    <Modal onClose={working ? () => undefined : onClose} width={560} ariaLabel="Make pictures with AI">
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 19, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} style={{ color: "var(--color-primary)" }} /> Make pictures with AI
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--color-text-muted)" }}>
            <strong style={{ color: "var(--color-text)" }}>{item.name}</strong> · {item.images.length} of {IMAGE_RULES.maxPerItem} pictures used
          </p>
        </div>

        {result ? (
          <div data-testid="ai-result">
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              {result.added.length} {result.added.length === 1 ? "picture was" : "pictures were"} added to {item.name}.
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {result.added.map((im) => (
                <img key={im.key} src={im.url} alt="" data-testid="ai-new-picture" style={{ height: 96, borderRadius: 10, border: "1px solid var(--color-border)", objectFit: "cover" }} />
              ))}
            </div>
            {result.usedKeys?.length ? (
              <p style={{ margin: "8px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }} data-testid="ai-used-keys">
                Made with {result.usedKeys.join(" and ")}.
              </p>
            ) : null}
            {result.rested?.length > 0 ? (
              <div data-testid="ai-switched">
                <Toast kind="info">
                  {result.rested.map((r) => r.label).join(" and ")} {result.rested.length === 1 ? "has" : "have"} reached {result.rested.length === 1 ? "its" : "their"} limit (or {result.rested.length === 1 ? "was" : "were"} refused), so another key was used
                  automatically. {result.rested.length === 1 ? "That key rests" : "Those keys rest"} until Google allows it again — see AI pictures in the console.
                </Toast>
              </div>
            ) : null}
            {result.failed.length > 0 ? (
              <Toast kind="error">
                {result.failed.length} {result.failed.length === 1 ? "picture" : "pictures"} couldn&apos;t be made: {[...new Set(result.failed)].join(" ")}
              </Toast>
            ) : null}
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
              They are on the dish now. To remove one, open the dish with ✎ and delete it there.
            </p>
          </div>
        ) : (
          <>
            <fieldset style={fieldset} disabled={working}>
              <legend style={legend}>Shape</legend>
              <div role="radiogroup" aria-label="Aspect ratio" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(92px, 1fr))", gap: 8 }}>
                {AI_ASPECT_RATIOS.map((r) => {
                  const on = r.id === ratio;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setRatio(r.id)}
                      title={r.use}
                      style={{ ...shapeBtn, borderColor: on ? "var(--color-primary)" : "var(--color-border)", background: on ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))" : "var(--color-bg)" }}
                    >
                      <span style={{ display: "grid", placeItems: "center", height: 46 }}>
                        <span style={{ display: "block", height: r.id === "16:9" ? 26 : 38, aspectRatio: r.id.replace(":", " / "), maxWidth: 76, border: `2px solid ${on ? "var(--color-primary)" : "var(--color-text-muted)"}`, borderRadius: 5 }} />
                      </span>
                      <strong style={{ fontSize: 13 }}>{r.id}</strong>
                      <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>{r.label}</span>
                    </button>
                  );
                })}
              </div>
              <p style={hint}>
                {AI_ASPECT_RATIOS.find((r) => r.id === ratio)?.use ? `Good for ${AI_ASPECT_RATIOS.find((r) => r.id === ratio).use}.` : ""}
              </p>
            </fieldset>

            <fieldset style={fieldset} disabled={working || room === 0}>
              <legend style={legend}>How many pictures</legend>
              <div role="radiogroup" aria-label="How many pictures" style={{ display: "flex", gap: 8 }}>
                {Array.from({ length: AI_MAX_IMAGES_AT_ONCE }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={n === safeCount}
                    disabled={n > maxCount}
                    onClick={() => setCount(n)}
                    style={{ ...countBtn, borderColor: n === safeCount ? "var(--color-primary)" : "var(--color-border)", background: n === safeCount ? "var(--color-primary)" : "var(--color-bg)", color: n === safeCount ? "var(--color-on-primary)" : "var(--color-text)", opacity: n > maxCount ? 0.35 : 1 }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p style={hint}>
                {room === 0
                  ? "This dish already has the most pictures it can hold. Remove one first."
                  : `Up to ${room} more fit on this dish. Each picture is a paid call to Google, and several are asked for from different angles.`}
              </p>
            </fieldset>

            <details style={{ fontSize: 13 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Description sent to the AI {edited ? <span style={{ color: "var(--color-primary)" }}>· edited</span> : null}
              </summary>
              <textarea
                aria-label="Description for the picture"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={working}
                rows={6}
                maxLength={1200}
                style={{ width: "100%", marginTop: 8, padding: 10, font: "inherit", fontSize: 13, lineHeight: 1.5, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", boxSizing: "border-box" }}
              />
              {edited ? (
                <button type="button" onClick={() => setPrompt(defaultPrompt)} style={{ ...linkBtn, marginTop: 4 }}>
                  <RotateCcw size={12} /> Put the original description back
                </button>
              ) : null}
            </details>
          </>
        )}

        {working ? (
          <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--color-text-muted)" }} data-testid="ai-working">
            <Loader size={16} /> Making {safeCount} {safeCount === 1 ? "picture" : "pictures"}… this can take up to a minute. Please keep this window open.
          </div>
        ) : null}
        {generate.error ? <Toast kind="error">{generate.error.message}</Toast> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {result ? (
            <>
              {room - result.added.length > 0 ? (
                <Button variant="outline" onClick={() => { setResult(null); generate.reset(); setCount(1); }}>
                  Make more
                </Button>
              ) : null}
              <Button onClick={onClose}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={working}>
                Cancel
              </Button>
              <Button onClick={run} disabled={working || room === 0 || !prompt.trim()} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
                <Sparkles size={14} /> {working ? "Making…" : `Make ${safeCount} ${safeCount === 1 ? "picture" : "pictures"}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

const fieldset = { border: "none", margin: 0, padding: 0, minWidth: 0 };
const legend = { fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 8 };
const hint = { margin: "8px 0 0", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 };
const shapeBtn = { font: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 6px", borderRadius: 10, border: "1.5px solid var(--color-border)", cursor: "pointer", color: "var(--color-text)" };
const countBtn = { font: "inherit", fontWeight: 700, width: 46, height: 40, borderRadius: 10, border: "1.5px solid var(--color-border)", cursor: "pointer" };
const linkBtn = { font: "inherit", fontSize: 12, display: "inline-flex", gap: 5, alignItems: "center", border: "none", background: "none", color: "var(--color-primary)", cursor: "pointer", padding: 0 };
