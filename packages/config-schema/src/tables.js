import { z } from "zod";

export const TABLE_STATUSES = ["free", "seated", "bill-requested", "needs-cleaning", "reserved"]         ;
export const tableStatusSchema = z.enum(TABLE_STATUSES);
                                                          

export const TABLE_STATUS_LABELS                              = {
  free: "Free",
  seated: "Seated",
  "bill-requested": "Bill requested",
  "needs-cleaning": "Needs cleaning",
  reserved: "Reserved",
};

export const SESSION_STATUSES = ["open", "closed"]         ;
export const sessionStatusSchema = z.enum(SESSION_STATUSES);
                                                              

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
                                                
