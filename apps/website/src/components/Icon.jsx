import {
  Bike,
  ChartLine,
  Clock,
  Coins,
  ConciergeBell,
  Globe,
  MessageCircle,
  Palette,
  Printer,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  Store,
  TicketPercent,
  Users,
  Utensils,
  Zap,
} from "lucide-react";

/** The icon names a section can use (SITE_ICONS in config-schema), drawn on the server — no client JS. */
const ICONS = {
  "qr-code": QrCode,
  "concierge-bell": ConciergeBell,
  smartphone: Smartphone,
  printer: Printer,
  coins: Coins,
  "ticket-percent": TicketPercent,
  "message-circle": MessageCircle,
  store: Store,
  globe: Globe,
  palette: Palette,
  "chart-line": ChartLine,
  clock: Clock,
  "shield-check": ShieldCheck,
  users: Users,
  zap: Zap,
  utensils: Utensils,
  bike: Bike,
  receipt: Receipt,
};

export function Icon({ name, size = 20 }) {
  const C = ICONS[name] ?? Zap;
  return <C size={size} strokeWidth={1.9} aria-hidden="true" />;
}
