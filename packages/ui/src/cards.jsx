                                           
                                                      
import { itemImageUrl } from "@rasoipulse/config-schema";
import { fx } from "./fx";
import {
  addBtn,
  cardBase,
  clampOneLine,
  descStyle,
  FoodMark,
  nameStyle,
  Photo,
  Price,
  priceStyle,
  Tags,
  VariantLine,
} from "./primitives";

                                
                 
 

/**
 * Cards that show a photo take an optional `imageRatio` — the picture shape the store chose for them in Appearance ("" or
 * missing = the card's own, passed to `own()` below). Cards without a photo ignore it.
 */
const own = (imageRatio, fallback) => imageRatio || fallback;
const css = (ratio) => ratio.replace(":", " / ");

const dim = (item          )                => ({ opacity: item.isAvailable ? 1 : 0.55 });

/* 1 ─ compact row, no image */
export function RowCompact({ item }               ) {
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 16px" }}>
      <FoodMark type={item.foodType} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={nameStyle}>
          {item.name}
          <Tags tags={item.tags} item={item} />
        </div>
        {item.description ? <div style={descStyle}>{item.description}</div> : null}
        <VariantLine item={item} />
      </div>
      <Price item={item} />
    </article>
  );
}

/* 2 ─ thumbnail on the left */
export function RowThumbLeft({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "1:1");
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", gap: 14, padding: 12 }}>
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ width: 72, height: 72 }} radius={10} />
      {/* the price sits right after the veg / non-veg mark, so the name and description below it have the card's whole width */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px 8px", marginBottom: 2 }}>
          <FoodMark type={item.foodType} size={13} />
          <Price item={item} />
          <Tags tags={item.tags} item={item} />
        </div>
        <div style={nameStyle}>{item.name}</div>
        {item.description ? <div style={{ ...descStyle, marginTop: 2 }}>{item.description}</div> : null}
      </div>
    </article>
  );
}

/* 3 ─ thumbnail on the right */
export function RowThumbRight({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "1:1");
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", gap: 14, padding: 12 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <FoodMark type={item.foodType} size={13} />
          <Tags tags={item.tags} item={item} />
        </div>
        <div style={nameStyle}>{item.name}</div>
        {item.description ? <div style={{ ...descStyle, marginTop: 2 }}>{item.description}</div> : null}
        <div style={{ marginTop: 8 }}>
          <Price item={item} />
        </div>
      </div>
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ width: 84, height: 84 }} radius={10} />
    </article>
  );
}

/* 4 ─ image on top, text below, add button */
export function ImageTop({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "4:3");
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", flexDirection: "column" }}>
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ aspectRatio: css(ratio), width: "100%" }} radius={0} />
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FoodMark type={item.foodType} size={13} />
          <Tags tags={item.tags} item={item} />
        </div>
        <div style={nameStyle}>{item.name}</div>
        {item.description ? <div style={descStyle}>{item.description}</div> : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 10 }}>
          <Price item={item} />
          <button type="button" className="ot-fx-btn" style={fx("btn", addBtn)} disabled={!item.isAvailable}>
            Add
          </button>
        </div>
      </div>
    </article>
  );
}

/* 5 ─ image on top with the price badged onto the image */
export function ImageTopBadge({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "4:3");
  const isOwn = ratio === "4:3"; // the card's own box is a little wider (3:2) than its 4:3 picture
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative" }}>
        <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ aspectRatio: isOwn ? "3 / 2" : css(ratio), width: "100%" }} radius={0} />
        <span
          style={{
            position: "absolute",
            right: 10,
            bottom: 10,
            background: "var(--color-bg)",
            color: "var(--color-text)",
            padding: "5px 10px",
            borderRadius: "var(--radius-card)",
            fontWeight: 700,
            fontSize: 13,
            fontVariantNumeric: "tabular-nums",
            boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
          }}
        >
          <Price item={item} />
        </span>
        <span style={{ position: "absolute", left: 10, top: 10 }}>
          <FoodMark type={item.foodType} size={15} />
        </span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={nameStyle}>
          {item.name}
          <Tags tags={item.tags} item={item} />
        </div>
        {item.description ? <div style={descStyle}>{item.description}</div> : null}
      </div>
    </article>
  );
}

/* 6 ─ text above, image below */
export function TextAboveImage({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "16:9");
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 14px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <FoodMark type={item.foodType} size={13} />
          <Tags tags={item.tags} item={item} />
        </div>
        <div style={{ ...nameStyle, justifyContent: "space-between" }}>
          <span>{item.name}</span>
          <Price item={item} />
        </div>
        {item.description ? <div style={descStyle}>{item.description}</div> : null}
      </div>
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ aspectRatio: css(ratio), width: "100%" }} radius={0} />
    </article>
  );
}

/* 7 ─ full-bleed image with the text overlaid */
export function ImageOverlay({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "16:9");
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), position: "relative", minHeight: 190, aspectRatio: css(ratio), display: "flex" }}>
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} radius={0} />
      <div
        style={{
          position: "relative",
          marginTop: "auto",
          width: "100%",
          padding: 14,
          background: "linear-gradient(to top, rgba(0,0,0,0.82), rgba(0,0,0,0.25) 60%, transparent)",
          color: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <FoodMark type={item.foodType} size={13} />
          <Tags tags={item.tags} item={item} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>{item.name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.85, minWidth: 0, ...clampOneLine }}>
            {item.variants.length > 1 ? item.variants.map((v) => v.label).join(" · ") : item.description}
          </span>
          <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#fff" }}>
            <Price item={item} style={{ color: "#fff" }} />
          </span>
        </div>
      </div>
    </article>
  );
}

/* 8 ─ tall portrait card */
export function Portrait({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "3:4");
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", flexDirection: "column" }}>
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ aspectRatio: css(ratio), width: "100%" }} radius={0} />
      <div style={{ padding: 14, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 6 }}>
          <FoodMark type={item.foodType} size={13} />
          <Tags tags={item.tags} item={item} />
        </div>
        <div style={{ ...nameStyle, justifyContent: "center" }}>{item.name}</div>
        <div style={{ marginTop: 8 }}>
          <Price item={item} />
        </div>
      </div>
    </article>
  );
}

/* 9 ─ circular image, centred text */
export function Circle({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "1:1");
  return (
    <article
      className="ot-fx-card"
      style={{
        ...fx("card", cardBase),
        ...dim(item),
        padding: "20px 14px",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ width: 104, height: 104 }} radius="50%" />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <FoodMark type={item.foodType} size={13} />
        <Tags tags={item.tags} item={item} />
      </div>
      <div style={{ ...nameStyle, justifyContent: "center" }}>{item.name}</div>
      <Price item={item} />
    </article>
  );
}

/* 10 ─ classic printed menu line with a dotted leader */
export function MenuLine({ item }               ) {
  return (
    <article style={{ ...dim(item), padding: "10px 4px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <FoodMark type={item.foodType} size={13} />
        <span style={{ fontWeight: 600, color: "var(--color-text)", whiteSpace: "nowrap" }}>{item.name}</span>
        <Tags tags={item.tags} item={item} />
        <span
          aria-hidden
          style={{
            flex: 1,
            borderBottom: "1px dotted var(--color-border)",
            transform: "translateY(-4px)",
            minWidth: 20,
          }}
        />
        <span style={priceStyle}>
          <Price item={item} />
        </span>
      </div>
      {item.description ? <div style={{ ...descStyle, marginLeft: 23 }}>{item.description}</div> : null}
    </article>
  );
}

/* 11 ─ wide featured card, image beside the text */
export function FeaturedWide({ item, imageRatio }               ) {
  const ratio = own(imageRatio, "16:9");
  return (
    <article className="ot-fx-card" style={{ ...fx("card", cardBase), ...dim(item), display: "flex", minHeight: 150, gridColumn: "1 / -1" }}>
      <Photo name={item.name} src={itemImageUrl(item, ratio)} style={{ width: "38%", minWidth: 130, alignSelf: "stretch" }} radius={0} />
      <div style={{ flex: 1, padding: 20, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <FoodMark type={item.foodType} size={14} />
          <Tags tags={item.tags} item={item} />
        </div>
        <div style={{ ...nameStyle, fontSize: 20 }}>{item.name}</div>
        {item.description ? <div style={{ ...descStyle, fontSize: 14 }}>{item.description}</div> : null}
        <VariantLine item={item} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
          <span style={{ ...priceStyle, fontSize: 18 }}>
            <Price item={item} />
          </span>
          <button type="button" className="ot-fx-btn" style={fx("btn", addBtn)} disabled={!item.isAvailable}>
            Add to order
          </button>
        </div>
      </div>
    </article>
  );
}
