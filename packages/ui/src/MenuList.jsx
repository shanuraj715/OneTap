                                           
                                                            
import { getItemCardVariant, gridPropsFor } from "./registry";

export function MenuList({
  menu,
  cardVariant,
  onSelectItem,
}   
             
                       
                                                                        
                                          
 ) {
  const variant = getItemCardVariant(cardVariant);
  const Card = variant.Component;
  const gridProps = gridPropsFor(variant);

  const categories = [...menu.categories]
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div style={wrap}>
      {categories.map((cat) => {
        const items = menu.items
          .filter((i) => i.categoryId === cat.id)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        if (items.length === 0) return null;

        return (
          <section key={cat.id} style={{ marginBottom: 40 }}>
            <h2 style={catHeading}>{cat.name}</h2>
            <div className={gridProps.className} style={gridProps.style}>
              {items.map((item) =>
                onSelectItem && item.isAvailable ? (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Add ${item.name}`}
                    onClick={() => onSelectItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectItem(item);
                      }
                    }}
                    style={clickable}
                  >
                    <Card item={item} />
                  </div>
                ) : (
                  <Card key={item.id} item={item} />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const clickable                = { cursor: "pointer", borderRadius: "var(--radius-card)" };
const wrap                = { maxWidth: 1080, margin: "0 auto", padding: "8px 24px" };
const catHeading                = {
  fontFamily: "var(--font-heading)",
  fontSize: 22,
  fontWeight: 700,
  color: "var(--color-text)",
  margin: "0 0 14px",
  paddingBottom: 8,
  borderBottom: "1px solid var(--color-border)",
};
