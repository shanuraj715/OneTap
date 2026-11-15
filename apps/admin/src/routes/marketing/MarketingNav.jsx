import { History, Megaphone, Send, UsersRound } from "lucide-react";
import { SubNav } from "../../components/SubNav";
import { PageHeader } from "../../ui";

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
