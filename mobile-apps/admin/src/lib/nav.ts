/**
 * Which menu item is lit. The area is the FIRST part of the address ("/stores/abc" → "stores", "/onboarding/new" → "onboarding", "/dashboard" → "dashboard").
 * (Not `useSegments()`: for the one route that serves Dashboard, Stores, Server … it answers "[area]" — the file's name, not the area — so nothing matched.)
 */
export const areaOfPath = (pathname: string | null | undefined): string => String(pathname ?? "").split("?")[0]!.split("/").filter(Boolean)[0] ?? "";

/**
 * The item to light on the phone's tab bar. An area that has its own tab lights that tab; an area that only lives under "More" lights "More";
 * before the first screen has opened (the address is just "/") nothing is lit.
 */
export function litTab(tabIds: string[], hiddenAreaIds: string[], current: string): string {
  if (tabIds.includes(current)) return current;
  if (hiddenAreaIds.includes(current)) return "more";
  return current === "more" ? "more" : "";
}
