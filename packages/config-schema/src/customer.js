import { z } from "zod";

/**
 * A diner's profile, collected once at signup.
 *
 * Shared between the API (validates what's submitted) and the admin panel
 * (labels the columns) so the two can never disagree about what a gender
 * value means or what counts as a valid age.
 */
export const CUSTOMER_GENDERS = ["male", "female", "other"];
export const customerGenderSchema = z.enum(CUSTOMER_GENDERS);

export const CUSTOMER_GENDER_LABELS = {
  male: "Male",
  female: "Female",
  other: "Other",
};

/**
 * 13–100 is a sanity bound, not a business rule — old enough that "age" is a
 * meaningful single number (no infant orders), young enough to reject typos
 * like "1" or "999". Nothing here gates who may order.
 */
export const CUSTOMER_AGE_MIN = 13;
export const CUSTOMER_AGE_MAX = 100;

export const customerNameSchema = z.string().trim().min(1).max(80);
export const customerAgeSchema = z.number().int().min(CUSTOMER_AGE_MIN).max(CUSTOMER_AGE_MAX);
export const customerEmailSchema = z.string().trim().email().max(120);

/**
 * The fields a brand-new customer must supply, once, at signup. An existing
 * customer verifying again never sees this — see `isProfileComplete`.
 */
export const customerSignupSchema = z.object({
  name: customerNameSchema,
  gender: customerGenderSchema,
  age: customerAgeSchema,
  email: customerEmailSchema.optional(),
});

/** Whether a stored customer record has every required field — old records won't, until they complete it once. */
export function isProfileComplete(customer) {
  return Boolean(customer?.name && customer?.gender && customer?.age);
}
