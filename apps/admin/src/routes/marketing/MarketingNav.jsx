import { History, Lock, Megaphone, Send, UsersRound } from "lucide-react";
import { useStorePlan } from "../../lib/useStorePlan";
import { SubNav } from "../../components/SubNav";
import { Card, Empty, PageHeader } from "../../ui";

/** The Marketing section's title and tabs. */
export function MarketingHeader({ subtitle = "Send an offer or an announcement to your customers." }) {
  return (
    <>
      <PageHeader title="Marketing" icon={<Megaphone size={23} />} subtitle={subtitle} />
      <SubNav
        items={[
          { to: "/marketing/new", label: "New campaign", icon: <Send size={14} /> },
          { to: "/marketing/campaigns", label: "Campaigns", icon: <History size={14} /> },
          { to: "/marketing/lists", label: "Contact lists", icon: <UsersRound size={14} /> },
        ]}
      />
    </>
  );
}

/**
 * Wraps a Marketing page: when the store's plan doesn't include Marketing the page says so (and nothing loads)
 * instead of showing forms that would only fail. The API refuses the same calls, so this is only the friendly side.
 */
export function MarketingGate({ children }) {
  const { plan, hasFeature } = useStorePlan();
  if (plan && !hasFeature("marketing")) {
    return (
      <>
        <PageHeader title="Marketing" icon={<Megaphone size={23} />} subtitle="Send an offer or an announcement to your customers." />
        <Card>
          <Empty icon={<Lock size={26} />} title="Marketing isn't in your plan">
            Ask TablePe to add it to your plan and this page will open — nothing you have set up is lost.
          </Empty>
        </Card>
      </>
    );
  }
  return children;
}
