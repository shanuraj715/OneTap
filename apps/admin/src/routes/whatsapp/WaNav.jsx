import { Eraser, MessageCircle, Megaphone, ShieldCheck, Smartphone, MessagesSquare } from "lucide-react";
import { useWaLevel } from "../../lib/useWhatsApp";
import { PageHeader } from "../../ui";
import { SubNav } from "../../components/SubNav";

/** The WhatsApp section's title and tabs. Numbers, Broadcast and Access are the owner's. */
export function WaHeader({ subtitle = "Chat with customers from the store's own WhatsApp numbers." }) {
  const level = useWaLevel();
  const owner = level === "manage";
  const tabs = [
    { to: "/whatsapp/chats", label: "Chats", icon: <MessagesSquare size={14} /> },
    ...(owner
      ? [
          { to: "/whatsapp/numbers", label: "Numbers", icon: <Smartphone size={14} /> },
          { to: "/whatsapp/broadcast", label: "Broadcast", icon: <Megaphone size={14} /> },
          { to: "/whatsapp/cleanup", label: "Clean up", icon: <Eraser size={14} /> },
          { to: "/whatsapp/access", label: "Access", icon: <ShieldCheck size={14} /> },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader title="WhatsApp" icon={<MessageCircle size={23} />} subtitle={subtitle} />
      <SubNav items={tabs} />
    </>
  );
}
