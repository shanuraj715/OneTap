import { useQuery } from "@tanstack/react-query";
import { getStorePlan } from "./api";
import { useOutlet } from "./useOutlet";

/**
 * The current store's plan — what's unlocked, the limits, usage and any grace
 * period — for greying out what the plan doesn't include. While it loads (or
 * if it can't be read) everything reads as allowed: the API enforces the plan
 * on every write anyway, so the UI only ever under-restricts briefly.
 */
export function useStorePlan() {
  const { outlet } = useOutlet();
  const brandId = outlet?.brandId;
  const query = useQuery({
    queryKey: ["store-plan", brandId],
    queryFn: () => getStorePlan(brandId),
    enabled: Boolean(brandId),
    staleTime: 30_000,
  });
  const plan = query.data?.plan ?? null;
  return {
    plan,
    /** the plan hasn't arrived yet */
    loading: query.isLoading,
    hasFeature: (key) => !plan || plan.entitlements.features.includes(key),
    effectAllowed: (style) => !plan || style === "none" || plan.entitlements.effects.includes(style),
    qrFamilyAllowed: (family) => !plan || plan.entitlements.qrCardFamilies.includes(family),
    /** a seat is free for one more person */
    canAddPerson: !plan || plan.max.users === null || plan.usage.users < plan.max.users,
    canAddOutlet: !plan || (plan.limits.multiOutlet || plan.usage.outlets < 1) && (plan.max.outlets === null || plan.usage.outlets < plan.max.outlets),
    /** the plan has room for one more table (the whole store counts, every outlet together) */
    canAddTable: !plan || plan.max.tables === null || plan.usage.tables < plan.max.tables,
    /** why no more tables can be added, or null while there is room */
    tableLimitReason:
      !plan || plan.max.tables === null || plan.usage.tables < plan.max.tables
        ? null
        : `Your plan allows ${plan.max.tables} tables and all are in use. Remove a table, or ask Rasoi Pulse to add more (tables are added 5 at a time).`,
    /** `{ used, max }` for showing "7 of 10 tables"; max is null when unlimited */
    tables: plan ? { used: plan.usage.tables, max: plan.max.tables } : null,
    outletLimitReason: !plan
      ? null
      : !plan.limits.multiOutlet && plan.usage.outlets >= 1
        ? "Multiple outlets aren't included in your plan."
        : plan.max.outlets !== null && plan.usage.outlets >= plan.max.outlets
          ? `Your plan allows ${plan.max.outlets} outlet${plan.max.outlets === 1 ? "" : "s"}.`
          : null,
  };
}
