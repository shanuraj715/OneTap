/** The names the remembered answers are filed under (one place, so a screen and the code that refreshes it never disagree). */
export const keys = {
  board: (outletId: string, screen: string) => ["board", outletId, screen] as const,
  items: (outletId: string) => ["items", outletId] as const,
  summary: (outletId: string) => ["summary", outletId] as const,
};
