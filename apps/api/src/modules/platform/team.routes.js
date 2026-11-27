import { Router } from "express";
import { roleInputSchema, teamMemberInputSchema, teamMemberPatchSchema } from "@rasoipulse/config-schema";
import { requireSuperAdmin } from "../../middleware/auth.js";
import { limiter } from "../../middleware/rate-limit.js";
import * as team from "./team.service.js";

/**
 * Roles, team members and the activity log of the platform console — the SUPER ADMIN only. (The platform router's rules table already says so;
 * every handler asks again, because a route that forgets is how an account gets taken over.)
 */
export const teamRouter = Router();

teamRouter.get("/roles", async (req, res) => {
  requireSuperAdmin(req);
  res.json(await team.listRoles());
});
teamRouter.post("/roles", limiter("account-write"), async (req, res) => {
  const actor = requireSuperAdmin(req);
  res.status(201).json({ role: await team.createRole(roleInputSchema.parse(req.body), actor, req.ip) });
});
teamRouter.patch("/roles/:id", limiter("account-write"), async (req, res) => {
  const actor = requireSuperAdmin(req);
  res.json({ role: await team.updateRole(req.params.id, roleInputSchema.parse(req.body), actor, req.ip) });
});
teamRouter.delete("/roles/:id", limiter("account-write"), async (req, res) => {
  const actor = requireSuperAdmin(req);
  await team.deleteRole(req.params.id, actor, req.ip);
  res.status(204).end();
});

teamRouter.get("/team", async (req, res) => {
  requireSuperAdmin(req);
  res.json({ members: await team.listMembers() });
});
teamRouter.post("/team", limiter("account-write"), async (req, res) => {
  const actor = requireSuperAdmin(req);
  res.status(201).json({ member: await team.createMember(teamMemberInputSchema.parse(req.body), actor, req.ip) });
});
teamRouter.patch("/team/:id", limiter("account-write"), async (req, res) => {
  const actor = requireSuperAdmin(req);
  res.json({ member: await team.updateMember(req.params.id, teamMemberPatchSchema.parse(req.body), actor, req.ip) });
});
teamRouter.delete("/team/:id", limiter("account-write"), async (req, res) => {
  const actor = requireSuperAdmin(req);
  await team.deleteMember(req.params.id, actor, req.ip);
  res.status(204).end();
});

teamRouter.get("/audit", async (req, res) => {
  requireSuperAdmin(req);
  res.json({ entries: await team.listAudit(Number(req.query.limit) || 50) });
});
