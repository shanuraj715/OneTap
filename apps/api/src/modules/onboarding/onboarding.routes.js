import { Router } from "express";
import { z } from "zod";
import { onboardingSchema } from "@onetap/config-schema";
import { requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { resolveMapsLink } from "./maps-resolve.js";
import { renderOnboardingPdf } from "./onboarding.pdf.js";
import { publishForm } from "./onboarding.publish.js";
import { checkForm, deleteForm, getForm, getPricing, listForms, planOf, savePricing, saveForm } from "./onboarding.service.js";
import { limiter } from "../../middleware/rate-limit.js";

/** The client onboarding forms. Mounted inside the platform console's router, so it is super-admin only. */
export const onboardingRouter = Router();

onboardingRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" && ["draft", "published"].includes(req.query.status) ? req.query.status : undefined;
  res.json({ forms: await listForms({ status }) });
});

const saveBody = z.object({ data: z.record(z.string(), z.unknown()) });

onboardingRouter.post("/", async (req, res) => {
  const user = requireUser(req);
  const { data } = saveBody.parse(req.body);
  res.status(201).json({ form: await saveForm(null, data, String(user._id)) });
});

/** The price list the estimate uses (the starting prices until someone saves their own). */
onboardingRouter.get("/pricing", async (_req, res) => {
  res.json({ pricing: await getPricing() });
});

onboardingRouter.put("/pricing", async (req, res) => {
  const user = requireUser(req);
  res.json({ pricing: await savePricing(req.body, String(user._id)) });
});

/** Which map point a pasted link means (short Google links are opened by the server). */
onboardingRouter.post("/resolve-map", limiter("outbound-fetch"), async (req, res) => {
  const { link } = z.object({ link: z.string().min(1).max(600) }).parse(req.body);
  res.json(await resolveMapsLink(link));
});

onboardingRouter.get("/:id", async (req, res) => {
  res.json({ form: await getForm(req.params.id) });
});

onboardingRouter.put("/:id", async (req, res) => {
  const user = requireUser(req);
  const { data } = saveBody.parse(req.body);
  res.json({ form: await saveForm(req.params.id, data, String(user._id)) });
});

onboardingRouter.delete("/:id", async (req, res) => {
  await deleteForm(req.params.id);
  res.status(204).end();
});

/** Is it ready to publish, and if not, why (form problems, plan problems, names already taken). */
onboardingRouter.get("/:id/check", async (req, res) => {
  res.json(await checkForm(req.params.id));
});

onboardingRouter.post("/:id/publish", limiter("destructive"), async (req, res) => {
  const user = requireUser(req);
  const { ownerPassword } = z.object({ ownerPassword: z.string().min(1).max(200) }).parse(req.body);
  res.status(201).json(await publishForm(req.params.id, { ownerPassword }, String(user._id)));
});

/** The form as a PDF. `?inline=1` shows it in the browser (the Print button) instead of downloading it. */
onboardingRouter.get("/:id/pdf", limiter("export"), async (req, res) => {
  const form = await getForm(req.params.id);
  const plan = await planOf(form.data);
  const file = await renderOnboardingPdf({ form, data: onboardingSchema.parse(form.data), plan });
  const name = `onboarding-${(form.storeName || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client"}.pdf`;
  if (!file?.length) throw new HttpError(500, "Couldn't make the PDF");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${req.query.inline ? "inline" : "attachment"}; filename="${name}"`);
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition"); // the console is on another address and reads the file name from it
  res.setHeader("Cache-Control", "no-store");
  res.send(file);
});
