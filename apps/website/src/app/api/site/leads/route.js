import { forward } from "@/lib/forward";

export const dynamic = "force-dynamic";

/** The contact form's enquiry (see lib/forward.js). */
export const POST = (request) => forward(request, "/api/site/leads", { method: "POST" });
