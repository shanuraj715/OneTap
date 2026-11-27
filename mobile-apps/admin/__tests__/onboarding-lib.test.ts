import { beyondPlan, blankForm, newOutlet, offeredPlans, planHas, pointFrom, pruneForced, slugify } from "@/lib/onboarding";
import type { Plan } from "@/api/endpoints";

const plan = (o: Partial<Plan> = {}): Plan => ({ id: "starter", name: "Starter", description: "", custom: false, limits: { maxUsers: 3, maxOutlets: 1, maxTables: 5 }, entitlements: { allFeatures: false, features: ["takeaway", "dineInQr"] }, archived: false, storeCount: 0, ...o });

describe("the onboarding helpers", () => {
  it("slugify makes the same web address the server does", () => {
    expect(slugify("Gazab Momos & Café")).toBe("gazab-momos-and-cafe");
    expect(slugify("  --Spicy!!  Bites-- ")).toBe("spicy-bites");
    expect(slugify("")).toBe("");
  });

  it("Custom is always offered, archived plans are not, and a real Custom plan is not doubled", () => {
    const live = plan(), old = plan({ id: "old", name: "Old", archived: true });
    expect(offeredPlans([live, old]).map((p) => p.id)).toEqual(["starter", "custom"]);
    const custom = plan({ id: "c1", name: "Custom", custom: true });
    expect(offeredPlans([live, custom]).map((p) => p.id)).toEqual(["starter", "c1"]);
  });

  it("a plan has what it lists; a Custom plan or 'every feature' has everything; no plan chosen blocks nothing", () => {
    expect(planHas(plan(), "takeaway")).toBe(true);
    expect(planHas(plan(), "delivery")).toBe(false);
    expect(planHas(plan({ custom: true }), "delivery")).toBe(true);
    expect(planHas(plan({ entitlements: { allFeatures: true, features: [] } }), "delivery")).toBe(true);
    expect(planHas(undefined, "delivery")).toBe(true);
  });

  it("beyondPlan lists what the form asks for that the plan lacks: features, ordering types, outlets, people", () => {
    const d = blankForm();
    d.features = ["coupons", "analytics"];
    d.outlets = [newOutlet({ modes: { takeaway: true, dineIn: false, delivery: true } }), newOutlet()];
    d.setup.teamCount = 5;
    const ids = beyondPlan(d, plan({ entitlements: { allFeatures: false, features: ["takeaway", "coupons"] } })).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["feature:delivery", "feature:analytics", "outlets", "users"]));
    expect(ids).not.toContain("feature:coupons");
    expect(ids).not.toContain("feature:takeaway");
    expect(beyondPlan(d, plan({ custom: true }))).toEqual([]);
    expect(beyondPlan(d, undefined)).toEqual([]);
  });

  it("an 'allowed anyway' mark disappears when the thing it allowed is no longer asked for", () => {
    const d = blankForm();
    d.forced = ["feature:delivery", "feature:analytics", "outlets"];
    d.features = ["analytics"];
    expect(pruneForced(d, plan())).toEqual(["feature:analytics"]);
  });

  it("pointFrom reads plain coordinates and the shapes of Google Maps links, and nothing else", () => {
    expect(pointFrom("30.9010, 75.8573")).toEqual({ lat: 30.901, lng: 75.8573 });
    expect(pointFrom("https://www.google.com/maps/place/X/@28.6139,77.209,15z")).toEqual({ lat: 28.6139, lng: 77.209 });
    expect(pointFrom("https://maps.google.com/?q=28.6,77.2")).toEqual({ lat: 28.6, lng: 77.2 });
    expect(pointFrom("https://www.google.com/maps/place/X/data=!3d28.5!4d77.1")).toEqual({ lat: 28.5, lng: 77.1 });
    expect(pointFrom("https://maps.app.goo.gl/abc123")).toBeNull();
    expect(pointFrom("95, 200")).toBeNull();
    expect(pointFrom("")).toBeNull();
  });

  it("a blank form has one outlet and the standard defaults", () => {
    const d = blankForm();
    expect(d.outlets).toHaveLength(1);
    expect(d.outlets[0]!.modes).toEqual({ takeaway: true, dineIn: false, delivery: false });
    expect(d.common.hours).toEqual({ opensAt: "11:00", closesAt: "23:00", lastOrderBufferMinutes: 30 });
    expect(newOutlet().id).not.toBe(newOutlet().id);
  });
});
