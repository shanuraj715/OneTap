import { z } from "zod";

export const TABLE_STATUSES = ["free", "seated", "bill-requested", "needs-cleaning", "reserved"] as const;
export const tableStatusSchema = z.enum(TABLE_STATUSES);
export type TableStatus = (typeof TABLE_STATUSES)[number];

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  free: "Free",
  seated: "Seated",
  "bill-requested": "Bill requested",
  "needs-cleaning": "Needs cleaning",
  reserved: "Reserved",
};

export const SESSION_STATUSES = ["open", "closed"] as const;
export const sessionStatusSchema = z.enum(SESSION_STATUSES);
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const tableSchema = z.object({
  id: z.string(),
  /** what's printed on the table tent — "5", "A3", "Rooftop 2" */
  number: z.string().min(1),
  zone: z.string().default(""),
  seats: z.number().int().positive().default(4),
  status: tableStatusSchema.default("free"),
  isActive: z.boolean().default(true),
  activeSessionId: z.string().nullable().default(null),
});
export type Table = z.infer<typeof tableSchema>;
