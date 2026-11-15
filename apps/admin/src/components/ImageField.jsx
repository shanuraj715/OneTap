import { useRef } from "react";
import { ImagePlus, Loader, Trash2 } from "lucide-react";
import { useImageUpload } from "../lib/useStorage";
import { Button } from "../ui";

/**
 * One picture: what is there now, an Upload button (any photo format — the server shrinks it), and Remove.
 * Where it is kept is TablePe's setting, not the store's; the owner just picks a file.
 *
 *   value      the picture's address ("" for none)
 *   onChange   called with the new address, or "" when removed
 *   kind       the folder name for these uploads ("logos", "banners", "pages")
 *   shape      "wide" (a banner), "square" (a logo)
 */
export function ImageField({ outlet, value, onChange, kind = "pages", label = "Photo", shape = "wide" }) {
  const input = useRef(null);
  const { upload, busy, error, clearError } = useImageUpload(outlet, { kind });
  const size = shape === "square" ? { width: 76, height: 76 } : { width: 132, height: 76 };

  const pick = async (files) => {
    try {
      const [stored] = await upload(files);
      if (stored) onChange(stored.url);
    } catch {
      /* the hook shows the message */
    }
    if (input.current) input.current.value = "";
  };

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ ...frame, ...size }}>
        {value ? <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: shape === "square" ? "contain" : "cover", display: "block" }} /> : <ImagePlus size={22} aria-hidden="true" style={{ color: "var(--color-text-muted)" }} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="outline" disabled={busy} onClick={() => input.current?.click()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {busy ? <Loader size={13} className="ot-spin" /> : <ImagePlus size={13} />} {busy ? "Uploading…" : value ? `Change ${label.toLowerCase()}` : `Upload ${label.toLowerCase()}`}
          </Button>
          {value ? (
            <Button variant="outline" onClick={() => onChange("")} disabled={busy} style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "var(--tone-danger)" }}>
              <Trash2 size={13} /> Remove
            </Button>
          ) : null}
        </div>
        {error ? (
          <span role="alert" style={{ fontSize: 12.5, color: "var(--tone-danger)" }}>
            {error}{" "}
            <button type="button" onClick={clearError} style={{ font: "inherit", border: 0, background: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
              Dismiss
            </button>
          </span>
        ) : null}
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => (e.target.files?.length ? void pick(e.target.files) : undefined)} aria-label={`Choose ${label.toLowerCase()}`} />
    </div>
  );
}

const frame = {
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
  overflow: "hidden",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};
