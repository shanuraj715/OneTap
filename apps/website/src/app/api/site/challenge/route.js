import { forward } from "@/lib/forward";

export const dynamic = "force-dynamic";

/** A fresh spam-guard challenge for the contact form (see lib/forward.js). */
export const GET = (request) => forward(request, "/api/site/challenge", { method: "GET" });
