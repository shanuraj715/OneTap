import { randomUUID } from "node:crypto";
import {
  MenuCategoryModel,
  MenuItemModel,
  ModifierGroupModel,
  tenantFilter,
                     
} from "@onetap/db";

const r = (rupees        ) => Math.round(rupees * 100);

                    
               
                       
                     
                                                
                  
                       
 

const MENU                                            = [
  {
    category: "Steamed Momos",
    items: [
      { name: "Veg Steamed Momos", description: "Classic cabbage & carrot filling", variants: [{ label: "5 pcs", price: r(60) }, { label: "8 pcs", price: r(90) }], tags: ["bestseller"], withAddons: true },
      { name: "Paneer Steamed Momos", description: "Soft paneer filling", variants: [{ label: "5 pcs", price: r(80) }, { label: "8 pcs", price: r(120) }], withAddons: true },
      { name: "Paneer Corn Steamed Momos", description: "Paneer with sweet corn", variants: [{ label: "8 pcs", price: r(170) }], withAddons: true },
      { name: "Whole Wheat Paneer Steamed", description: "Atta wrapper, paneer filling", variants: [{ label: "8 pcs", price: r(170) }], withAddons: true },
      { name: "Butter Mixed Veg Steamed", description: "Tossed in butter", variants: [{ label: "8 pcs", price: r(140) }], withAddons: true },
      { name: "Corn & Cheese Steamed", description: "Corn and melted cheese", variants: [{ label: "8 pcs", price: r(150) }], withAddons: true },
    ],
  },
  {
    category: "Kurkure Momos",
    items: [
      { name: "Butter Mixed Veg Kurkure", description: "Crumb-fried, crisp outside", variants: [{ label: "4 pcs", price: r(125) }], tags: ["bestseller"], withAddons: true },
      { name: "Paneer Corn Kurkure", variants: [{ label: "4 pcs", price: r(140) }], withAddons: true },
      { name: "Cheese Kurkure Momos", variants: [{ label: "4 pcs", price: r(150) }], withAddons: true },
    ],
  },
  {
    category: "Tandoori Momos",
    items: [
      { name: "Tandoori Veg Momos", description: "Marinated and char-grilled", variants: [{ label: "6 pcs", price: r(140) }], withAddons: true },
      { name: "Tandoori Paneer Momos", variants: [{ label: "6 pcs", price: r(160) }], withAddons: true },
    ],
  },
  {
    category: "Gravy Momos",
    items: [
      { name: "Chilli Garlic Gravy Momos", description: "In a spicy chilli-garlic gravy", basePrice: r(150), tags: ["spicy"] },
      { name: "Makhani Gravy Momos", description: "Rich tomato-butter gravy", basePrice: r(160) },
    ],
  },
  {
    category: "Beverages",
    items: [
      { name: "Masala Chaas", basePrice: r(40) },
      { name: "Sweet Lassi", basePrice: r(70) },
      { name: "Cold Coffee", basePrice: r(90) },
    ],
  },
];

const ADDONS = {
  name: "Add-ons",
  required: false,
  minSelect: 0,
  maxSelect: 3,
  options: [
    { label: "Extra Chutney", priceDelta: r(10) },
    { label: "Extra Mayo", priceDelta: r(15) },
    { label: "Schezwan Chutney", priceDelta: r(15) },
    { label: "Cheese Dip", priceDelta: r(30) },
  ],
};

/** Create the Gazab Momos menu for an outlet. No-op if a menu already exists. */
export async function seedGazabMomosMenu(ctx               )                                {
  const existing = await MenuCategoryModel.countDocuments(tenantFilter(ctx));
  if (existing > 0) return { created: false };

  const addons = await ModifierGroupModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    ...ADDONS,
    options: ADDONS.options.map((o) => ({ id: randomUUID(), ...o })),
  });
  const addonsId = String(addons._id);

  for (const [ci, group] of MENU.entries()) {
    const category = await MenuCategoryModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      name: group.category,
      sortOrder: ci,
    });

    await MenuItemModel.insertMany(
      group.items.map((it, ii) => ({
        brandId: ctx.brandId,
        outletId: ctx.outletId,
        categoryId: String(category._id),
        name: it.name,
        description: it.description ?? "",
        foodType: "veg"         ,
        tags: it.tags ?? [],
        basePrice: it.basePrice ?? 0,
        variants: (it.variants ?? []).map((v) => ({ id: randomUUID(), label: v.label, price: v.price })),
        modifierGroupIds: it.withAddons ? [addonsId] : [],
        gstRatePct: 5,
        isAvailable: true,
        sortOrder: ii,
      })),
    );
  }

  return { created: true };
}

/** Remove every menu document for an outlet (used by seed --reset). */
export async function clearMenu(ctx               )                {
  await Promise.all([
    MenuItemModel.deleteMany(tenantFilter(ctx)),
    MenuCategoryModel.deleteMany(tenantFilter(ctx)),
    ModifierGroupModel.deleteMany(tenantFilter(ctx)),
  ]);
}
