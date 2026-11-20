import { defaultCardImageRatio, ITEM_IMAGE_RATIOS } from "@onetap/config-schema";
import { Field, Select } from "../ui";

/**
 * "Picture shape" for a menu card style: which of a dish's pictures the card shows. It always shows the card's own shape
 * (C07 → Wide 16:9, C04 → Landscape 4:3 …); the owner can override it. `value` is "" while it is the card's own, so it keeps
 * following the card style; callers reset it to "" whenever another card style is picked.
 */
export function PictureShape({ variantId, value, onChange, testid = "picture-shape", style }) {
  const own = defaultCardImageRatio(variantId);
  if (!own) {
    return (
      <p data-testid={`${testid}-none`} style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--color-text-muted)", ...style }}>
        This card style shows no picture, so there is no picture shape to choose.
      </p>
    );
  }
  const shown = value || own;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", ...style }}>
      <Field
        label="Picture shape"
        style={{ flex: "0 1 320px" }}
        info="Which picture of each dish this card style shows. It follows the card style you pick, and you can override it here. A dish without a picture in that shape shows its square picture."
      >
        <Select data-testid={testid} value={shown} onChange={(e) => onChange(e.target.value === own ? "" : e.target.value)}>
          {ITEM_IMAGE_RATIOS.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} ({r.id}){r.id === own ? " — this card's own" : ""}
            </option>
          ))}
        </Select>
      </Field>
      {shown !== own ? (
        <button
          type="button"
          data-testid={`${testid}-reset`}
          onClick={() => onChange("")}
          style={{ cursor: "pointer", background: "none", border: "none", padding: "0 0 9px", fontSize: 13, color: "var(--color-primary)", textDecoration: "underline" }}
        >
          Back to the card's own ({own})
        </button>
      ) : null}
    </div>
  );
}
