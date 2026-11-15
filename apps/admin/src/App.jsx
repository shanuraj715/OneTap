import { useEffect, useRef, useState } from "react";

import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AwesomeLoader } from "./components/AwesomeLoader";
import { TopProgressBar } from "./components/TopProgressBar";
import { ROLE_LABELS } from "@onetap/config-schema";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Layers,
  Store,
  Boxes,
  Building2,
  Check,
  ChevronsUpDown,
  Database,
  ConciergeBell,
  Globe,
  Inbox,
  Menu as MenuIcon,
  X,
  CreditCard,
  ExternalLink,
  FileText,
  HardDrive,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutDashboard,
  LayoutGrid,
  LayoutList,
  LogOut,
  Megaphone,
  Palette,
  Plus,
  Printer,
  IdCard,
  QrCode,
  ReceiptText,
  Settings as SettingsIcon,
  Tag,
  Type,
  UtensilsCrossed,
  Users as UsersIcon,
  Wand2,
  Server as ServerIcon,
} from "lucide-react";
import { useAuth, useLogout } from "./lib/useAuth";
import { OutletSelectionProvider, useOpenStore, useOutlets } from "./lib/useOutlet";
import { useLeads, useStore } from "./lib/usePlatform";
import { useStorePlan } from "./lib/useStorePlan";
import { useMedia } from "./lib/useMedia";
import { CreateOutletModal } from "./components/CreateOutletModal";
import { SETTINGS_TABS, STOREFRONT_TABS, TABLES_TABS } from "./components/SubNav";
import { Appearance } from "./routes/Appearance";
import { Banners } from "./routes/Banners";
import { ComponentsCatalog } from "./routes/ComponentsCatalog";
import { Customers } from "./routes/Customers";
import { Dashboard } from "./routes/Dashboard";
import { DashboardConfig } from "./routes/DashboardConfig";
import { Login } from "./routes/Login";
import { Coupons } from "./routes/Coupons";
import { MenuEditor } from "./routes/MenuEditor";
import { MenuLayout } from "./routes/MenuLayout";
import { Notifications } from "./routes/Notifications";
import { Orders } from "./routes/Orders";
import { Outlets } from "./routes/Outlets";
import { Payments } from "./routes/Payments";
import { Printing } from "./routes/Printing";
import { TableCards } from "./routes/cards/TableCards";
import { Tables } from "./routes/Tables";
import { Settings } from "./routes/Settings";
import { StorePageEditor } from "./routes/StorePageEditor";
import { StorePages } from "./routes/StorePages";
import { StoreDisabled } from "./routes/StoreDisabled";
import { ThemeEditor } from "./routes/ThemeEditor";
import { TypographyEditor } from "./routes/TypographyEditor";
import { Users } from "./routes/Users";
import { TakeOrder } from "./routes/take-order/TakeOrder";
import { PlatformDashboard } from "./routes/platform/PlatformDashboard";
import { PlatformCache } from "./routes/platform/PlatformCache";
import { PlatformStorage } from "./routes/platform/PlatformStorage";
import { PlatformServer } from "./routes/platform/PlatformServer";
import { PlatformPlans } from "./routes/platform/PlatformPlans";
import { PlatformSettings } from "./routes/platform/PlatformSettings";
import { PlatformStoreDetail } from "./routes/platform/PlatformStoreDetail";
import { PlatformStores } from "./routes/platform/PlatformStores";
import { PlatformLeads } from "./routes/platform/PlatformLeads";
import { PageEditor } from "./routes/platform/website/PageEditor";
import { WebsitePages } from "./routes/platform/website/WebsitePages";
import { WebsiteSettings } from "./routes/platform/website/WebsiteSettings";
import { storefrontHref } from "./lib/storefront";
import { Menu } from "./ui";

const ICON = 15.5;

const ROUTE_META = {
  "/": { title: "Dashboard", icon: LayoutDashboard },
  "/orders": { title: "Orders", icon: ReceiptText },
  "/menu": { title: "Menu", icon: UtensilsCrossed },
  "/components": { title: "Components", icon: Boxes },
  "/menu-layout": { title: "Menu layout", icon: LayoutList },
  "/coupons": { title: "Coupons", icon: Tag },
  "/tables": { title: "Tables & QR", icon: QrCode },
  "/table-cards": { title: "Table cards", icon: IdCard },
  "/printing": { title: "Printing", icon: Printer },
  "/payments": { title: "Payments", icon: CreditCard },
  "/notifications": { title: "Notifications", icon: Bell },
  "/customers": { title: "Customers", icon: UsersIcon },
  "/appearance": { title: "Appearance", icon: Wand2 },
  "/banners": { title: "Banners", icon: Megaphone },
  "/pages": { title: "Pages", icon: FileText },
  "/theme": { title: "Theme", icon: Palette },
  "/typography": { title: "Typography", icon: Type },
  "/settings": { title: "Settings", icon: SettingsIcon },
  "/outlets": { title: "Outlets", icon: Building2 },
  "/dashboard-config": { title: "Configure dashboard", icon: LayoutGrid },
  "/users": { title: "Users & roles", icon: UsersIcon },
  "/take-order": { title: "Take order", icon: ConciergeBell },
  "/platform": { title: "Dashboard", icon: LayoutDashboard },
  "/platform/stores": { title: "Stores", icon: Store },
  "/platform/plans": { title: "Plans", icon: Layers },
  "/platform/server": { title: "Server", icon: ServerIcon },
  "/platform/cache": { title: "Cache", icon: Database },
  "/platform/storage": { title: "Storage", icon: HardDrive },
  "/platform/settings": { title: "Platform settings", icon: SettingsIcon },
  "/platform/website": { title: "Website", icon: Globe },
  "/platform/website/settings": { title: "Website settings", icon: Globe },
  "/platform/leads": { title: "Leads", icon: Inbox },
};

/**
 * A sidebar entry standing in for a whole tab family (see SubNav.jsx): shown
 * if the user can open ANY of its tabs, linking to the first one they can,
 * and highlighted on every page in the family. The pages themselves are
 * reached through the tab bar — never listed twice.
 */
const family = (label, icon, tabs) => ({ label, icon, tabs });

const NAV_GROUPS = [
  {
    group: "Service",
    items: [
      { to: "/take-order", label: "Take order", icon: <ConciergeBell size={ICON} />, permission: "order:create" },
      { to: "/", label: "Dashboard", icon: <LayoutDashboard size={ICON} />, end: true },
      { to: "/orders", label: "Orders", icon: <ReceiptText size={ICON} />, permission: "order:read" },
      family("Tables", <QrCode size={ICON} />, TABLES_TABS),
      { to: "/printing", label: "Printing", icon: <Printer size={ICON} />, permission: "printer:read", feature: "printing" },
    ],
  },
  {
    group: "Catalogue",
    items: [{ to: "/menu", label: "Menu", icon: <UtensilsCrossed size={ICON} />, permission: "menu:read" }],
  },
  {
    group: "Storefront",
    items: [family("Storefront", <Wand2 size={ICON} />, STOREFRONT_TABS)],
  },
  {
    group: "Business",
    items: [
      { to: "/coupons", label: "Coupons", icon: <Tag size={ICON} />, permission: "coupon:read", feature: "coupons" },
      { to: "/customers", label: "Customers", icon: <UsersIcon size={ICON} />, permission: "customer:read" },
      family("Settings", <SettingsIcon size={ICON} />, SETTINGS_TABS),
    ],
  },
];

/** The platform super admin's own console — managing client stores, not running one. */
const PLATFORM_NAV_GROUPS = [
  {
    group: "Platform",
    items: [
      { to: "/platform", label: "Dashboard", icon: <LayoutDashboard size={ICON} />, end: true },
      { to: "/platform/stores", label: "Stores", icon: <Store size={ICON} /> },
      { to: "/platform/plans", label: "Plans", icon: <Layers size={ICON} /> },
      { to: "/platform/server", label: "Server", icon: <ServerIcon size={ICON} /> },
      { to: "/platform/cache", label: "Cache", icon: <Database size={ICON} /> },
      { to: "/platform/storage", label: "Storage", icon: <HardDrive size={ICON} /> },
      { to: "/platform/settings", label: "Settings", icon: <SettingsIcon size={ICON} /> },
    ],
  },
  {
    group: "Website",
    items: [
      { to: "/platform/website", label: "Website", icon: <Globe size={ICON} /> },
      { to: "/platform/leads", label: "Leads", icon: <Inbox size={ICON} />, badgeKey: "newLeads" },
    ],
  },
];

/**
 * Resolve a nav entry for this user: hidden when their role lacks the
 * permission or the store's plan doesn't include the feature; a family becomes
 * a plain link to its first tab they can open, or disappears.
 */
function resolveNavItem(n, can, hasFeature) {
  const open = (x) => (!x.permission || can(x.permission)) && (!x.feature || hasFeature(x.feature));
  if (!n.tabs) return open(n) ? n : null;
  const allowed = n.tabs.filter(open);
  if (!allowed.length) return null;
  return { to: allowed[0].to, label: n.label, icon: n.icon, matchPaths: n.tabs.map((t) => t.to) };
}

export function App() {
  const { user, isLoading, can } = useAuth();

  if (isLoading) {
    return <AwesomeLoader fullScreen label="Loading TablePe" subtext="Preparing your workspace…" />;
  }
  if (!user) {
    return <Login />;
  }
  // TablePe has switched the whole store off (a late payment, say): say so, instead of a screen full of errors
  if (user.storeDisabled && !user.isSuperAdmin) {
    return <StoreDisabled user={user} />;
  }
  if (user.blockedAt && !user.isSuperAdmin) {
    return <Paused />;
  }

  return (
    <OutletSelectionProvider>
      <Shell can={can} />
    </OutletSelectionProvider>
  );
}

const COLLAPSE_KEY = "onetap.sidebarCollapsed";

function Shell({ can }                                     ) {
  const location = useLocation();
  const [navigating, setNavigating] = useState(false);
  const prevPathRef = useRef(location.pathname);
  const navTimerRef = useRef(null);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      setNavigating(true);

      if (navTimerRef.current) clearTimeout(navTimerRef.current);
      navTimerRef.current = setTimeout(() => {
        setNavigating(false);
      }, 340);
    }
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, [location.pathname]);

  const currentMeta = ROUTE_META[location.pathname] || (location.pathname.startsWith("/platform/stores/") ? ROUTE_META["/platform/stores"] : null) || (location.pathname.startsWith("/pages/") ? ROUTE_META["/pages"] : null) || {
    title: location.pathname.slice(1).replace("-", " ") || "page",
    icon: UtensilsCrossed,
  };

  const { user } = useAuth();
  const navigate = useNavigate();
  const { openStoreId, closeStore } = useOpenStore();
  // The platform super admin works in their own console unless they've opened
  // a store's dashboard — and any /platform page is always the console.
  const platformMode = Boolean(user?.isSuperAdmin) && (!openStoreId || location.pathname.startsWith("/platform"));
  const openedStore = useStore(user?.isSuperAdmin && !platformMode ? openStoreId : null).data?.store;
  const { outlet, outlets, scope, selectOutlet } = useOutlets();
  const storePlan = useStorePlan();
  const logout = useLogout();
  const [addingOutlet, setAddingOutlet] = useState(false);

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

  // Phones get the sidebar as a slide-in menu instead of a fixed column.
  const narrow = useMedia("(max-width: 767px)");
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => setDrawerOpen(false), [location.pathname, narrow]);
  const railCollapsed = collapsed && !narrow;

  const canTakeOrders = can("order:create") && !platformMode;

  // Works on any page, not just Orders — the sidebar is global chrome.
  useEffect(() => {
    const onKey = (e               ) => {
      const t = e.target                      ;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "\\") setCollapsed((c) => !c);
      // N — new order, from anywhere in the store dashboard
      else if ((e.key === "n" || e.key === "N") && canTakeOrders) navigate("/take-order");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canTakeOrders, navigate]);

  // the platform console's "Leads" shows how many enquiries nobody has called yet
  const newLeads = useLeads("new", platformMode).data?.counts?.new ?? 0;
  const badges = { newLeads };

  const groups = (platformMode ? PLATFORM_NAV_GROUPS : NAV_GROUPS)
    .map((g) => ({
      ...g,
      items: g.items.map((n) => resolveNavItem(n, can, platformMode ? () => true : storePlan.hasFeature)).filter(Boolean),
    }))
    .filter((g) => g.items.length);

  const leaveStore = () => {
    const id = openStoreId;
    closeStore();
    navigate(id ? `/platform/stores/${id}` : "/platform");
  };

  // A brand's outlets, for the switcher. An outlet's own name conventionally
  // already includes the brand ("Gazab Momos — Laxmi Nagar"), so the label
  // is just that as-is; for a superadmin (who sees every brand at once) the
  // brand name additionally goes in the description line, so two outlets
  // from different brands with similar names are still easy to tell apart.
  const outletOptions = outlets.map((o) => ({
    value: o._id,
    label: o.name,
    description: o.blocked
      ? "Blocked — over plan limit"
      : scope === "all" && o.brandName
        ? `${o.brandName} · ${o.slug}`
        : o.slug,
  }));
  // The platform can always add an outlet; a store only while its plan allows.
  const canAddOutlet = can("outlet:manage") && (user?.isSuperAdmin || storePlan.canAddOutlet);

  return (
    <div style={{ ...shell, gridTemplateColumns: narrow ? "1fr" : `${railCollapsed ? 64 : 224}px 1fr` }}>
      {narrow && drawerOpen ? <div style={drawerScrim} onClick={() => setDrawerOpen(false)} aria-hidden /> : null}
      <aside
        style={{
          ...sidebar,
          padding: railCollapsed ? "20px 10px" : 20,
          ...(narrow ? { ...drawer, transform: drawerOpen ? "translateX(0)" : "translateX(-105%)", boxShadow: drawerOpen ? drawer.boxShadow : "none" } : {}),
        }}
        // closed on a phone: off-screen AND unreachable by keyboard / screen reader
        inert={narrow && !drawerOpen}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: railCollapsed ? "center" : "space-between", gap: 8 }}>
          {!railCollapsed ? (
            <div style={brand}>
              TablePe<span style={{ color: "var(--color-text-muted)", fontWeight: 400 }}> admin</span>
            </div>
          ) : null}
          {narrow ? (
            <button type="button" onClick={() => setDrawerOpen(false)} style={collapseBtn} aria-label="Close the menu">
              <X size={15} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              style={collapseBtn}
              aria-label={railCollapsed ? "Expand the sidebar" : "Collapse the sidebar"}
              title={"Shortcut key: \\"}
            >
              {railCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
            </button>
          )}
        </div>

        {!railCollapsed && !platformMode ? (
          <Menu
            fullWidth
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} style={outletChip}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {outlet ? outlet.name : "No outlet yet"}
                </span>
                <ChevronsUpDown size={12} style={{ flexShrink: 0 }} />
              </button>
            )}
            options={[
              ...outletOptions,
              ...(canAddOutlet ? [{ value: "__add", label: "Add outlet", icon: <Plus size={13} /> }] : []),
            ]}
            selected={outlet?._id}
            align="left"
            width={260}
            onSelect={(v) => (v === "__add" ? setAddingOutlet(true) : selectOutlet(v))}
          />
        ) : null}

        {addingOutlet ? (
          <CreateOutletModal
            brandId={outlet?.brandId}
            onClose={() => setAddingOutlet(false)}
            onCreated={(o) => selectOutlet(o._id)}
          />
        ) : null}

        <nav style={nav}>
          {groups.map((g) => (
            <div key={g.group} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {!railCollapsed ? <span style={navGroup}>{g.group}</span> : <span style={navRule} aria-hidden />}
              {g.items.map((n) => (
                <NavItem
                  key={n.to}
                  to={n.to}
                  label={n.label}
                  icon={n.icon}
                  end={n.end}
                  collapsed={railCollapsed}
                  matchPaths={n.matchPaths}
                  badge={n.badgeKey ? badges[n.badgeKey] : undefined}
                />
              ))}
            </div>
          ))}
        </nav>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10, alignItems: railCollapsed ? "center" : "stretch" }}>
          {/* One fixed storefront address — meaningless across every store, so not in the platform console. */}
          {!platformMode ? (
            <a
              href={storefrontHref(outlet)}
              target="_blank"
              rel="noreferrer"
              style={{ ...storefrontLink, justifyContent: railCollapsed ? "center" : "flex-start" }}
              title="View storefront"
            >
              <ExternalLink size={13} />
              {!railCollapsed ? "View storefront" : null}
            </a>
          ) : null}

          {railCollapsed ? (
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

      <main style={{ ...content, ...(narrow ? { padding: "0 16px 24px" } : {}), position: "relative" }}>
        <TopProgressBar active={navigating} />
        {narrow ? (
          <div style={mobileBar}>
            <button type="button" onClick={() => setDrawerOpen(true)} style={mobileMenuBtn} aria-label="Open the menu">
              <MenuIcon size={19} />
            </button>
            <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {platformMode ? "Platform" : outlet?.name ?? "TablePe"}
            </span>
            {canTakeOrders ? (
              <NavLink to="/take-order" style={mobileTakeOrder}>
                <ConciergeBell size={15} /> Take order
              </NavLink>
            ) : null}
          </div>
        ) : null}

        {navigating ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "var(--color-bg)",
              zIndex: 40,
              minHeight: "100%",
              animation: "ot-fade-in 0.18s ease-out",
            }}
          >
            <AwesomeLoader
              label={`Loading ${currentMeta.title}…`}
              subtext="Preparing page view…"
              icon={currentMeta.icon}
            />
          </div>
        ) : null}

        <div style={{ opacity: navigating ? 0 : 1, transition: "opacity 0.22s ease-out", minHeight: "100%" }}>
          {(user?.isSuperAdmin && !platformMode) || (!platformMode && storePlan.plan?.grace.over) ? (
            // The page column has no top padding (headers bring their own margin) — keep the bars off the edge.
            <div style={{ paddingTop: 16 }}>
              {user?.isSuperAdmin && !platformMode ? (
                <div style={viewingBar}>
                  <span>
                    Viewing <strong>{openedStore?.name ?? "store"}</strong> as its owner sees it
                    {openedStore?.disabled ? (
                      <>
                        {" "}
                        — <strong>this store is disabled</strong>: its team can&apos;t get in, only you can
                      </>
                    ) : null}
                  </span>
                  <button type="button" onClick={leaveStore} style={viewingBack}>
                    <ArrowLeft size={13} /> Back to my dashboard
                  </button>
                </div>
              ) : null}
              {!platformMode && storePlan.plan?.grace.over ? <OverLimitBanner plan={storePlan.plan} /> : null}
            </div>
          ) : null}
          {platformMode ? (
            <Routes>
              <Route path="/platform" element={<PlatformDashboard />} />
              <Route path="/platform/stores" element={<PlatformStores />} />
              <Route path="/platform/stores/:id" element={<PlatformStoreDetail />} />
              <Route path="/platform/plans" element={<PlatformPlans />} />
              <Route path="/platform/server" element={<PlatformServer />} />
              <Route path="/platform/cache" element={<PlatformCache />} />
              <Route path="/platform/storage" element={<PlatformStorage />} />
              <Route path="/platform/settings" element={<PlatformSettings />} />
              <Route path="/platform/website" element={<WebsitePages />} />
              <Route path="/platform/website/settings" element={<WebsiteSettings />} />
              <Route path="/platform/website/pages/:id" element={<PageEditor />} />
              <Route path="/platform/leads" element={<PlatformLeads />} />
              <Route path="*" element={<Navigate to="/platform" replace />} />
            </Routes>
          ) : (
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/menu" element={<MenuEditor />} />
            <Route path="/components" element={<ComponentsCatalog />} />
            <Route path="/menu-layout" element={<MenuLayout />} />
            <Route path="/coupons" element={<Coupons />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/table-cards" element={<TableCards />} />
            <Route path="/printing" element={<Printing />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/appearance" element={<Appearance />} />
            <Route path="/banners" element={<Banners />} />
            <Route path="/pages" element={<StorePages />} />
            <Route path="/pages/:id" element={<StorePageEditor />} />
            <Route path="/theme" element={<ThemeEditor />} />
            <Route path="/typography" element={<TypographyEditor />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/outlets" element={<Outlets />} />
            <Route path="/dashboard-config" element={<DashboardConfig />} />
            <Route path="/users" element={<Users />} />
            <Route path="/take-order" element={<TakeOrder />} />
            {/* an old bookmark (the Storage page moved to the platform console) lands on the dashboard, not a blank screen */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          )}
        </div>
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
  matchPaths,
  badge,
}) {
  const location = useLocation();
  const isMatchPathActive =
    Array.isArray(matchPaths) &&
    matchPaths.some(
      (p) => location.pathname === p || (p !== "/" && location.pathname.startsWith(p + "/"))
    );

  return (
    <NavLink
      to={to}
      end={end}
      // The label is gone when collapsed, so the icon carries a tooltip.
      title={collapsed ? label : undefined}
      style={({ isActive }) => {
        const active = isActive || isMatchPathActive;
        return {
          ...navItem,
          justifyContent: collapsed ? "center" : "flex-start",
          padding: collapsed ? "10px 0" : "8px 12px",
          background: active ? "var(--color-primary)" : "transparent",
          color: active ? "var(--color-on-primary)" : "var(--color-text)",
        };
      }}
    >
      <span style={{ display: "inline-flex", flexShrink: 0 }} aria-hidden>
        {icon}
      </span>
      {collapsed ? <span style={srOnly}>{label}</span> : label}
      {badge ? (
        <span style={navBadge} aria-label={`${badge} new`}>
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

const navBadge = {
  marginLeft: "auto",
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  background: "var(--tone-warning-wash)",
  color: "var(--tone-warning)",
  fontSize: 11.5,
  fontWeight: 800,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
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
  font: "inherit",
  fontSize: 12,
  color: "var(--color-text-muted)",
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 999,
  padding: "6px 10px",
  alignSelf: "stretch",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 6,
  cursor: "pointer",
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
const drawer = {
  position: "fixed",
  top: 0,
  left: 0,
  bottom: 0,
  width: "min(290px, 86vw)",
  zIndex: 70,
  boxShadow: "0 0 40px rgba(0,0,0,0.22)",
  transition: "transform var(--motion-base) var(--ease-out)",
};
const drawerScrim = { position: "fixed", inset: 0, zIndex: 69, background: "rgba(16, 12, 10, 0.4)" };
const mobileBar = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  gap: 10,
  margin: "0 -16px",
  padding: "10px 16px",
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
};
const mobileMenuBtn = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 40,
  height: 40,
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};
const mobileTakeOrder = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minHeight: 40,
  padding: "0 14px",
  borderRadius: 999,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  fontWeight: 700,
  fontSize: 13.5,
  textDecoration: "none",
  flexShrink: 0,
};
const content                = { padding: "0 32px 28px", width: "100%", minWidth: 0, height: "100%", overflowX: "hidden", overflowY: "auto" };

const fmtDay = (d) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

/** Shown on every store page while the store is over its plan's limits. */
function OverLimitBanner({ plan }) {
  const parts = [];
  if (plan.max.users !== null && plan.usage.users > plan.max.users) parts.push(`${plan.usage.users} people (plan allows ${plan.max.users})`);
  if (plan.max.outlets !== null && plan.usage.outlets > plan.max.outlets) parts.push(`${plan.usage.outlets} outlets (plan allows ${plan.max.outlets})`);
  return (
    <div role="status" style={overLimitBar}>
      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>
        Your store has {parts.join(" and ")}.{" "}
        {plan.grace.ended
          ? `The grace period ended on ${fmtDay(plan.grace.until)} — extra outlets or people may be blocked by TablePe.`
          : `Everything keeps working until ${fmtDay(plan.grace.until)}. Remove the extras, or contact TablePe to upgrade your plan.`}
      </span>
    </div>
  );
}

/** A person the platform has blocked (store over its people limit). */
function Paused() {
  const logout = useLogout();
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "var(--color-surface)" }}>
      <div style={{ maxWidth: 400, textAlign: "center", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 28 }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>Your access is paused</h1>
        <p style={{ color: "var(--color-text-muted)", fontSize: 14, lineHeight: 1.5, margin: "0 0 18px" }}>
          Your store is over its plan&apos;s limit for people, so your access has been paused. Please contact your store owner.
        </p>
        <button type="button" onClick={() => logout.mutate()} style={signOut}>
          <LogOut size={12} /> Sign out
        </button>
      </div>
    </div>
  );
}

const viewingBar                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  padding: "9px 14px",
  marginBottom: 14,
  borderRadius: 10,
  fontSize: 13,
  background: "var(--tone-info-wash)",
  color: "var(--tone-info)",
};
const viewingBack                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 700,
  padding: "5px 11px",
  borderRadius: 999,
  border: "1px solid currentColor",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};
const overLimitBar                = {
  display: "flex",
  gap: 9,
  padding: "10px 14px",
  marginBottom: 14,
  borderRadius: 10,
  fontSize: 13,
  lineHeight: 1.5,
  background: "var(--tone-warning-wash)",
  color: "var(--tone-warning)",
};
