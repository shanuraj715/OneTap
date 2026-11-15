import { waLevelAtLeast } from "@onetap/config-schema";
import { NotFoundSection } from "../../components/NotFoundSection";
import { useStorePlan } from "../../lib/useStorePlan";
import { useWaMe } from "../../lib/useWhatsApp";

/**
 * Every WhatsApp page sits behind this. If the store's plan doesn't include WhatsApp chat — or the signed-in person
 * has no access to it (or not enough for this page) — the page does not exist for them: a 404 in the content area.
 * The pages underneath are not even mounted, so nothing is requested from the server.
 *   need = "read" (chats) or "manage" (numbers, broadcast, access, clean up — the owner's)
 */
export function WaGate({ need = "read", children }) {
  const { plan, loading, hasFeature } = useStorePlan();
  const me = useWaMe();
  if (loading) return null; // the plan hasn't arrived yet
  if (plan && !hasFeature("whatsappChat")) return <NotFoundSection />;
  if (me.isLoading) return null; // the person's access is being read
  if (!waLevelAtLeast(me.data?.level ?? "none", need)) return <NotFoundSection />;
  return children;
}
