import { NavLink } from "react-router-dom";
import {
  Bell,
  Boxes,
  Building2,
  CreditCard,
  HardDrive,
  IdCard,
  LayoutGrid,
  LayoutList,
  Palette,
  QrCode,
  Store,
  Type,
  Users as UsersIcon,
  Wand2,
} from "lucide-react";
import { useAuth } from "../lib/useAuth";

const ICON_SIZE = 14;

/**
 * Generic horizontal tab-bar for grouped routes.
 * Uses NavLink so standard browser history, Cmd+click, and active states work seamlessly.
 */
export function SubNav({ items }) {
  if (!items || items.length <= 1) return null;

  return (
    <nav aria-label="Section navigation" style={navWrap}>
      <div style={navList}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className="ot-press"
            style={({ isActive }) => ({
              ...tabPill,
              background: isActive ? "var(--color-primary)" : "var(--color-surface)",
              color: isActive ? "var(--color-on-primary)" : "var(--color-text)",
              borderColor: isActive ? "var(--color-primary)" : "var(--color-border)",
              fontWeight: isActive ? 700 : 600,
            })}
          >
            {item.icon ? (
              <span style={{ display: "inline-flex", flexShrink: 0 }} aria-hidden>
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/**
 * Each tab family's pages, in tab order. The sidebar builds its single entry
 * per family from these same lists (see App.jsx), so a page is never listed
 * both as a sidebar item and as a tab — and the two can't drift apart.
 */
export const SETTINGS_TABS = [
  { to: "/settings", label: "Outlet Settings", icon: <Building2 size={ICON_SIZE} />, end: true, permission: "settings:update" },
  { to: "/outlets", label: "Outlets", icon: <Store size={ICON_SIZE} />, permission: "outlet:manage" },
  { to: "/payments", label: "Payments", icon: <CreditCard size={ICON_SIZE} />, permission: "payment-config:read" },
  { to: "/notifications", label: "Notifications", icon: <Bell size={ICON_SIZE} />, permission: "notification-config:read" },
  { to: "/users", label: "Users & roles", icon: <UsersIcon size={ICON_SIZE} />, permission: "user:read" },
  { to: "/storage", label: "Storage", icon: <HardDrive size={ICON_SIZE} />, permission: "storage-config:read" },
  { to: "/dashboard-config", label: "Configure dashboard", icon: <LayoutGrid size={ICON_SIZE} />, permission: "dashboard:configure" },
];

export const STOREFRONT_TABS = [
  { to: "/menu-layout", label: "Menu layout", icon: <LayoutList size={ICON_SIZE} />, permission: "appearance:update" },
  { to: "/appearance", label: "Appearance", icon: <Wand2 size={ICON_SIZE} />, permission: "appearance:update" },
  { to: "/theme", label: "Theme", icon: <Palette size={ICON_SIZE} />, permission: "theme:update" },
  { to: "/typography", label: "Typography", icon: <Type size={ICON_SIZE} />, permission: "theme:update" },
  { to: "/components", label: "Components", icon: <Boxes size={ICON_SIZE} /> },
];

export const TABLES_TABS = [
  { to: "/tables", label: "Tables & QR", icon: <QrCode size={ICON_SIZE} />, permission: "table:read" },
  { to: "/table-cards", label: "Table cards", icon: <IdCard size={ICON_SIZE} />, permission: "table:read" },
];

function FamilyNav({ tabs }) {
  const { can } = useAuth();
  return <SubNav items={tabs.filter((i) => !i.permission || can(i.permission))} />;
}

export const SettingsNav = () => <FamilyNav tabs={SETTINGS_TABS} />;
export const StorefrontNav = () => <FamilyNav tabs={STOREFRONT_TABS} />;
export const TablesNav = () => <FamilyNav tabs={TABLES_TABS} />;

const navWrap = {
  display: "block",
  marginBottom: 16,
  borderBottom: "1px solid var(--color-border)",
  paddingBottom: 12,
};

const navList = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 2,
};

const tabPill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "6px 14px",
  borderRadius: 999,
  fontSize: 13,
  textDecoration: "none",
  border: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
  cursor: "pointer",
  lineHeight: 1.3,
  transition: "background 140ms ease, color 140ms ease, border-color 140ms ease",
};
