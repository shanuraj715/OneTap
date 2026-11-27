/** The names the remembered answers are filed under (one place, so a screen and the code that refreshes it never disagree). */
export const keys = {
  tables: (outletId: string) => ["tables", outletId] as const,
  sessions: (outletId: string) => ["sessions", outletId] as const,
  menu: (outletId: string) => ["menu", outletId] as const,
  unavailable: (outletId: string) => ["unavailable", outletId] as const,
  orders: (outletId: string) => ["orders", outletId] as const,
  riders: (outletId: string) => ["riders", outletId] as const,
  printers: (outletId: string) => ["printers", outletId] as const,
  customers: (outletId: string, digits: string) => ["customers", outletId, digits] as const,
};
