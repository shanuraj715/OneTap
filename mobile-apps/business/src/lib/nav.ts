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

/** How many areas fit on the phone's tab bar before the rest move under "More" (the bar also holds "More"/"Account", so 4 tabs in all). */
export const PHONE_TABS = 4;
/** On a phone with more areas than tabs, the last ones live under "More". */
export const needsMore = (areaCount: number): boolean => areaCount > PHONE_TABS;
/**
 * Does the Account page list the areas? Only when it is the way to REACH them: a phone whose tab bar can't hold them all.
 * A tablet's side rail already shows every area, and so does a phone's tab bar when it has 4 or fewer — listing them again would repeat the menu.
 */
export const showAreasOnAccount = (areaCount: number, tablet: boolean): boolean => !tablet && needsMore(areaCount);
