import { useEffect, useState } from "react";
                                                      
import { NavLink, Route, Routes } from "react-router-dom";
import { ROLE_LABELS,                 } from "@onetap/config-schema";
import {
  Bell,
  CreditCard,
  ExternalLink,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  LogOut,
  Palette,
  Printer,
  QrCode,
  ReceiptText,
  Settings as SettingsIcon,
  Tag,
  Type,
  UtensilsCrossed,
  Users as UsersIcon,
  Wand2,
} from "lucide-react";
import { useAuth, useLogout } from "./lib/useAuth";
import { useOutlet } from "./lib/useOutlet";
import { Appearance } from "./routes/Appearance";
import { Customers } from "./routes/Customers";
import { Dashboard } from "./routes/Dashboard";
import { DashboardConfig } from "./routes/DashboardConfig";
import { Login } from "./routes/Login";
import { Coupons } from "./routes/Coupons";
import { MenuEditor } from "./routes/MenuEditor";
import { MenuLayout } from "./routes/MenuLayout";
import { Notifications } from "./routes/Notifications";
import { Orders } from "./routes/Orders";
import { Payments } from "./routes/Payments";
import { Printing } from "./routes/Printing";
import { Tables } from "./routes/Tables";
import { Settings } from "./routes/Settings";
import { Storage } from "./routes/Storage";
import { ThemeEditor } from "./routes/ThemeEditor";
import { TypographyEditor } from "./routes/TypographyEditor";
import { Users } from "./routes/Users";

const STOREFRONT_URL = "http://localhost:3070";

const ICON = 15.5;

                    
             
                
                  
                
                          
 

/** Grouped so the sidebar reads as sections rather than one long list. */
const NAV_GROUPS                                         = [
  {
    group: "Service",
    items: [
      { to: "/", label: "Dashboard", icon: <LayoutDashboard size={ICON} />, end: true },
      { to: "/orders", label: "Orders", icon: <ReceiptText size={ICON} />, permission: "order:read" },
      { to: "/tables", label: "Tables & QR", icon: <QrCode size={ICON} />, permission: "table:read" },
      { to: "/printing", label: "Printing", icon: <Printer size={ICON} />, permission: "printer:read" },
    ],
  },
  {
    group: "Catalogue",
    items: [
      { to: "/menu", label: "Menu", icon: <UtensilsCrossed size={ICON} />, permission: "menu:read" },
      { to: "/storage", label: "Storage", icon: <HardDrive size={ICON} />, permission: "storage-config:read" },
    ],
  },
  {
    group: "Storefront",
    items: [
      { to: "/menu-layout", label: "Menu layout", icon: <LayoutList size={ICON} />, permission: "appearance:update" },
      { to: "/appearance", label: "Appearance", icon: <Wand2 size={ICON} />, permission: "appearance:update" },
      { to: "/theme", label: "Theme", icon: <Palette size={ICON} />, permission: "theme:update" },
      { to: "/typography", label: "Typography", icon: <Type size={ICON} />, permission: "theme:update" },
    ],
  },
  {
    group: "Business",
    items: [
      { to: "/coupons", label: "Coupons", icon: <Tag size={ICON} />, permission: "coupon:read" },
      { to: "/payments", label: "Payments", icon: <CreditCard size={ICON} />, permission: "payment-config:read" },
      { to: "/notifications", label: "Notifications", icon: <Bell size={ICON} />, permission: "notification-config:read" },
      { to: "/customers", label: "Customers", icon: <UsersIcon size={ICON} />, permission: "customer:read" },
      { to: "/settings", label: "Settings", icon: <SettingsIcon size={ICON} />, permission: "settings:update" },
      { to: "/dashboard-config", label: "Configure dashboard", icon: <LayoutGrid size={ICON} />, permission: "dashboard:configure" },
      { to: "/users", label: "Users & roles", icon: <UsersIcon size={ICON} />, permission: "user:read" },
    ],
  },
];

export function App() {
  const { user, isLoading, can } = useAuth();

  if (isLoading) {
    return <div style={splash}>Loading…</div>;
  }
  if (!user) {
    return <Login />;
  }

  return <Shell can={can} />;
}

const COLLAPSE_KEY = "onetap.sidebarCollapsed";

function Shell({ can }                                     ) {
  const { user } = useAuth();
  const { outlet } = useOutlet();
  const logout = useLogout();

  // Remembered per device: a counter tablet wants the icons-only rail, a laptop
  // usually wants the labels.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* private window — it just won't be remembered */
    }
  }, [collapsed]);

  // Works on any page, not just Orders — the sidebar is global chrome.
  useEffect(() => {
    const onKey = (e               ) => {
      const t = e.target                      ;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "\\") setCollapsed((c) => !c);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((n) => !n.permission || can(n.permission)),
  })).filter((g) => g.items.length);

  return (
    <div style={{ ...shell, gridTemplateColumns: `${collapsed ? 64 : 224}px 1fr` }}>
      <aside style={{ ...sidebar, padding: collapsed ? "20px 10px" : 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", gap: 8 }}>
          {!collapsed ? (
            <div style={brand}>
              TablePe<span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}> admin</span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            style={collapseBtn}
            aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
            title={"Shortcut key: \\"}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        {!collapsed ? <div style={outletChip}>{outlet ? outlet.name : "no outlet yet"}</div> : null}

        <nav style={nav}>
          {groups.map((g) => (
            <div key={g.group} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {!collapsed ? <span style={navGroup}>{g.group}</span> : <span style={navRule} aria-hidden />}
              {g.items.map((n) => (
                <NavItem key={n.to} to={n.to} label={n.label} icon={n.icon} end={n.end} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, alignItems: collapsed ? "center" : "stretch" }}>
          <a
            href={STOREFRONT_URL}
            target="_blank"
            rel="noreferrer"
            style={{ ...storefrontLink, justifyContent: collapsed ? "center" : "flex-start" }}
            title="View storefront"
          >
            <ExternalLink size={13} />
            {!collapsed ? "View storefront" : null}
          </a>

          {collapsed ? (
            <button type="button" onClick={() => logout.mutate()} style={collapseBtn} aria-label="Sign out" title="Sign out">
              <LogOut size={14} />
            </button>
          ) : (
            <div style={userBox}>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{user?.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                {user?.role ? ROLE_LABELS[user.role] : "—"}
              </div>
              <button type="button" onClick={() => logout.mutate()} style={signOut}>
                <LogOut size={12} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <main style={content}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/menu" element={<MenuEditor />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/menu-layout" element={<MenuLayout />} />
          <Route path="/coupons" element={<Coupons />} />
          <Route path="/tables" element={<Tables />} />
          <Route path="/printing" element={<Printing />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/appearance" element={<Appearance />} />
          <Route path="/theme" element={<ThemeEditor />} />
          <Route path="/typography" element={<TypographyEditor />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/dashboard-config" element={<DashboardConfig />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </main>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon,
  end,
  collapsed,
}   
             
                
                  
                
                     
 ) {
  return (
    <NavLink
      to={to}
      end={end}
      // The label is gone when collapsed, so the icon carries a tooltip.
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        ...navItem,
        justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "10px 0" : "8px 12px",
        background: isActive ? "var(--color-primary)" : "transparent",
        color: isActive ? "var(--color-on-primary)" : "var(--color-text)",
      })}
    >
      <span style={{ display: "inline-flex", flexShrink: 0 }} aria-hidden>
        {icon}
      </span>
      {collapsed ? <span style={srOnly}>{label}</span> : label}
    </NavLink>
  );
}

const splash                = { minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--color-text-muted)" };
// Fixed to exactly one viewport tall, and nothing here scrolls itself — the
// sidebar and the content area each own their own internal scroll instead, so
// neither drags the other out of view.
const shell                = {
  display: "grid",
  gridTemplateColumns: "224px 1fr",
  height: "100vh",
  overflow: "hidden",
  transition: "grid-template-columns var(--motion-base) var(--ease-out)",
};
const sidebar                = {
  borderRight: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 14,
  height: "100%",
  overflowY: "auto",
};
const brand                = { fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18 };
const outletChip                = {
  fontSize: 12,
  color: "var(--color-text-muted)",
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  padding: "4px 10px",
  alignSelf: "flex-start",
};
const nav                = { display: "flex", flexDirection: "column", gap: 14, marginTop: 8 };
const navGroup                = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  padding: "0 12px 2px",
};
const navRule                = {
  display: "block",
  height: 1,
  background: "var(--color-border)",
  margin: "3px 8px 5px",
};
const collapseBtn                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 30,
  height: 30,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};
/** Visually hidden but still read out, so a collapsed rail stays navigable. */
const srOnly                = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};
const navItem                = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: "none",
};
const storefrontLink                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "var(--color-text-muted)",
  textDecoration: "none",
};
const userBox                = {
  borderTop: "1px solid var(--color-border)",
  paddingTop: 12,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};
const signOut                = {
  font: "inherit",
  fontSize: 12.5,
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  marginTop: 6,
  padding: "5px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  alignSelf: "flex-start",
};
// No max width: the orders table is the widest thing in here and should
// use the whole screen rather than leaving a dead margin on a large monitor.
// No top padding here on purpose — the page header supplies its own (see
// PageHeader / Orders' pageHead), so it stays put at the very top of this
// scroll container instead of scrolling out from under a padding gap.
const content                = { padding: "0 32px 28px", width: "100%", minWidth: 0, height: "100%", overflowX: "hidden", overflowY: "auto" };
