import type { Me } from "@/lib/access";
import type { ApiClient } from "./client";

/* ------------------------------------------------------------------ what the platform API answers (only the parts the app uses) */
export interface Dashboard {
  generatedAt: string;
  today: { label: string };
  totals: { stores: number; outlets: number; people: number; customers: number; ordersToday: number; revenueToday: number };
  sales: {
    month: { label: string; orders: number; revenue: number; avgOrder: number; revenueChangePct: number | null; ordersChangePct: number | null; lastMonth: { orders: number; revenue: number } };
    year: { label: string; orders: number; revenue: number; revenueChangePct: number | null };
    monthly: { key: string; label: string; orders: number; revenue: number; changePct: number | null }[];
    daily: { current: number[]; previous: number[] };
    topStores: { id: string; name: string; orders: number; revenue: number; changePct: number | null }[];
    channels: { channel: string; orders: number; revenue: number }[];
  };
  stores: { total: number; byPlan: { name: string; count: number }[]; status: { ok: number; grace: number; overLimit: number }; disabled: number; activeLast30Days: number; setup: { withMenu: number; withTables: number; withPayments: number } };
  leads?: { new: number };
}
/** Rasoi Pulse's OWN sales: what the shops pay for the product (GET /api/platform/business). Money is in rupees. Nothing here is a store's orders. */
export type BusinessUnit = "day" | "week" | "month";
export interface BusinessSeries {
  unit: BusinessUnit; labels: string[]; dates: string[]; previousLabels: string[];
  current: number[]; previous: number[]; newAmount: number[]; renewalAmount: number[];
  total: number; previousTotal: number; changePct: number | null; newCount: number; renewalCount: number;
}
export interface PaymentRow {
  id: string; storeId: string; storeName: string; planId: string | null; planName: string; amount: number; months: number;
  paidOn: string; kind: "new" | "renewal"; coversFrom: string; coversTo: string; note: string; recordedBy: string; createdAt: string;
}
export interface Business {
  generatedAt: string; today: { label: string };
  totals: { sales: number; payments: number; shops: number; averagePerShop: number };
  newSales: { shops: number; amount: number };
  renewals: { payments: number; shops: number; amount: number };
  month: { label: string; sales: number; newShops: number; newAmount: number; renewals: number; renewalAmount: number; samePeriodLastMonth: number; changePct: number | null };
  standing: { active: number; expired: number; expiringSoon: number; neverPaid: number; neverPaidStores: { id: string; name: string }[]; expiredStores: { id: string; name: string; paidUntil: string }[] };
  series: Record<BusinessUnit, BusinessSeries>;
  byPlan: { name: string; activeShops: number; amount: number }[];
  recent: (PaymentRow & { storeDeleted: boolean })[];
}
/** One store's payments (GET /api/platform/stores/:id/payments): newest first, where it stands, and a price to start the form from. */
export interface StorePayments {
  storeId: string; storeName: string; payments: PaymentRow[];
  standing: { state: "active" | "expired" | "never"; paidUntil: string | null; daysLeft: number | null };
  total: number;
  suggest: { planId: string | null; planName: string; monthly: number; yearly: number };
}
export interface PaymentInput { amount: number; paidOn: string; months: number; planId?: string; note?: string }
export interface StoreRow {
  id: string; name: string; slug: string; ownerEmail: string; createdAt: string;
  plan: { id: string; name: string } | null;
  usage: { users: number; outlets: number; tables: number };
  max: { users: number | null; outlets: number | null; tables: number | null };
  status: string;
  disabled: { at: string; message?: string } | null;
  blocked: { outlets: number; people: number };
}
export interface StoreDetail extends StoreRow {
  outlets: { id: string; name: string; slug: string; blocked: string | null }[];
  people: { id: string; name: string; email: string; role: string; isActive: boolean; blockedAt: string | null; lastLoginAt: string | null }[];
  domains: { hostnames: string[]; primary: string | null };
  subdomain: { host: string | null; label: string };
  limits: { maxUsers: number | null; maxOutlets: number | null; maxTables: number | null };
  entitlements: { features: string[] };
}
export interface Plan { id: string; name: string; description: string; custom: boolean; limits: { maxUsers: number | null; maxOutlets: number | null; maxTables: number | null }; entitlements: { allFeatures: boolean; features: string[] }; archived: boolean; storeCount: number; marketing?: { monthly: number; yearlyDiscount?: number; price: string } }
export interface Role { id: string; name: string; description: string; features: string[]; effective: string[]; members: number }
export interface Member { id: string; name: string; email: string; isActive: boolean; roleId: string; roleName: string; lastLoginAt: string | null }
export interface AuditEntry { id: string; at: string; actor: string; action: string; target: string; detail: string }
export interface Block { id: string; ip: string; scope: string; blocked: boolean; blockedUntil: string | null; failures: number; strikes: number; lastAttemptAt: string | null }
export interface GuardSettings { maxFailures: number; windowSeconds: number; steps: number[]; forgetSeconds: number; floodPerMinute: number }
export interface HealthPart { id: string; label: string; score: number; boxes: number; level: "good" | "warning" | "critical"; value: string; detail: string; reason: string | null }
export interface Health { ready: boolean; score: number | null; boxes: number; level: "good" | "warning" | "critical" | null; label: string; parts: HealthPart[]; reasons: { id: string; label: string; level: string; text: string }[] }
export interface ServerNow {
  at: number; ready: boolean;
  machine: { hostname: string; osName: string; cpuModel: string; cores: number; arch: string; uptimeSec: number };
  cpu: { used: number; user: number; system: number; load: number[]; loadPerCore: number; cores: number } | null;
  memory: { totalB: number; usedB: number; availableB: number; usedPct: number; swapTotalB: number; swapUsedB: number; swapUsedPct: number } | null;
  disk: { mounts: { mount: string; sizeB: number; usedB: number; availB: number; usedPct: number; availPct: number }[] };
  network: { rxBps: number; txBps: number; rxTotalB: number; txTotalB: number; errors: number } | null;
  api: { uptimeSec: number; rssB: number; cpuPct?: number; db: { ok: boolean; ms: number | null; error?: string }; cache: { entries: number; hitRate: number | null; bytes: number }; requests: { last5min: { requests: number; errorPct: number; perMinute: number; p95Ms: number | null }; lastHour: { requests: number; errorPct: number } } };
  health: Health;
}
export interface OnboardingRow { id: string; storeName: string; repName: string; status: "draft" | "published"; planId: string; planName: string; outlets: number; brandId: string | null; publishedAt: string | null; createdAt: string; updatedAt: string }
export interface OnboardingOutlet {
  id: string; name: string; slug: string; phone: string; address: string; mapsLink: string; point: { lat: number; lng: number } | null;
  modes: { takeaway: boolean; dineIn: boolean; delivery: boolean };
  delivery: { radiusKm: number; fee: number; freeAbove: number; minOrder: number };
  hours: { useCommon: boolean; opensAt: string; closesAt: string; lastOrderBufferMinutes: number };
}
/** The parts of a requirement form the app edits. The server sends (and keeps) more — the look, the quote — and the app sends all of it back untouched. */
export interface OnboardingData {
  meeting: { repName: string; date: string; goLive: string; notes: string };
  planId: string;
  customLimits: { maxOutlets: number; maxUsers: number; maxTables: number };
  business: { storeName: string; tagline: string; type: string; ownerName: string; ownerPhone: string; ownerEmail: string; whatsapp: string; city: string; gstin: string; fssai: string };
  features: string[];
  forced: string[];
  outlets: OnboardingOutlet[];
  common: { hours: { opensAt: string; closesAt: string; lastOrderBufferMinutes: number }; prepMinutes: number; payments: { cash: boolean; online: boolean }; tax: { pricesIncludeTax: boolean; gstRatePct: number; serviceChargePct: number } };
  address: { subdomain: string; ownDomain: string };
  setup: { menuSource: string; itemCount: string; printers: string; teamCount: number; tableCount: number; notes: string };
  [more: string]: unknown;
}
export interface OnboardingCheck { errors: { path: string; message: string }[]; server: { path?: string; message: string }[]; fit: { issues: { id: string; kind: string; forced: boolean; message: string }[]; blocking: boolean }; ready: boolean }
export interface PublishResult { formId: string; store: { id: string; name: string; slug: string }; ownerEmail: string }
export type LeadStatus = "new" | "contacted" | "won" | "lost";
export interface Lead {
  id: string; name: string; phone: string; email: string; businessName: string; city: string; outlets: string; plan: string; message: string; sourcePage: string;
  utm: { source?: string; medium?: string; campaign?: string }; status: LeadStatus; notes: { text: string; by: string; at: string }[]; createdAt: string; updatedAt: string;
}
export interface CacheEntry {
  key: string; kind: string; label: string; subject: string; store: { id: string; name: string } | null; outlet: { id: string; name: string } | null;
  bytes: number; ageSeconds: number; expiresInSeconds: number; notFound: boolean;
}
/** Everything the API remembers right now, one row each (GET /api/platform/cache/entries), with the totals and the setting. */
export interface CacheEntries {
  ttlSeconds: number; enabled: boolean; lastExpiredAt: string | null;
  stats: { hits: number; misses: number; hitRate: number | null };
  totals: { entries: number; bytes: number };
  kinds: { kind: string; label: string; what: string; entries: number; bytes: number }[];
  stores: { id: string; name: string; entries: number; bytes: number }[];
  entries: CacheEntry[];
}
/** What to expire: everything, the admin panel's own items, one store, or one outlet of a store. */
export type ExpireScope = { scope: "all" } | { scope: "admin" } | { scope: "store"; storeId: string } | { scope: "outlet"; storeId: string; outletId: string };

export interface AppSetting { app: string; code: string; name: string; public: boolean; publicByDefault: boolean; usesRefreshInterval: boolean; pageUrl: string; refreshSeconds: number; updatedAt: string | null }

export function createApi(client: ApiClient) {
  const r = client.request;
  const json = (method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown) => ({ method, body });
  return {
    signIn: (email: string, password: string) => r<{ token: string; expiresAt: string; user: Me }>("/api/auth/app-login", { ...json("POST", { email, password }), auth: false }),
    signOut: (token: string) => r<void>("/api/auth/logout", { method: "POST", token }),
    me: () => r<{ user: Me }>("/api/auth/me"),
    guard: () => r<{ blocked: boolean; retryAfterSec?: number }>("/api/auth/guard", { auth: false }),

    dashboard: (fresh = false) => r<Dashboard>(`/api/platform/dashboard${fresh ? "?fresh=1" : ""}`),

    business: () => r<Business>("/api/platform/business"),
    storePayments: (id: string) => r<StorePayments>(`/api/platform/stores/${id}/payments`),
    recordPayment: (id: string, body: PaymentInput) => r<StorePayments & { payment: PaymentRow }>(`/api/platform/stores/${id}/payments`, json("POST", body)),
    deletePayment: (id: string, paymentId: string) => r<StorePayments>(`/api/platform/stores/${id}/payments/${paymentId}`, json("DELETE")),

    stores: () => r<{ stores: StoreRow[] }>("/api/platform/stores"),
    store: (id: string) => r<{ store: StoreDetail }>(`/api/platform/stores/${id}`),
    renameStore: (id: string, name: string) => r<unknown>(`/api/platform/stores/${id}`, json("PATCH", { name })),
    disableStore: (id: string, message: string) => r<unknown>(`/api/platform/stores/${id}/disable`, json("POST", { message })),
    enableStore: (id: string) => r<unknown>(`/api/platform/stores/${id}/enable`, json("POST")),
    setStorePlan: (id: string, planId: string | null) => r<unknown>(`/api/platform/stores/${id}/plan`, json("PATCH", { planId })),
    blockOutlet: (id: string, outletId: string, blocked: boolean) => r<unknown>(`/api/platform/stores/${id}/outlets/${outletId}/${blocked ? "block" : "unblock"}`, json("POST")),
    blockPerson: (id: string, userId: string, blocked: boolean) => r<unknown>(`/api/platform/stores/${id}/people/${userId}/${blocked ? "block" : "unblock"}`, json("POST")),
    deleteStore: (id: string, confirmName: string) => r<unknown>(`/api/platform/stores/${id}`, json("DELETE", { confirmName })),

    plans: () => r<{ plans: Plan[] }>("/api/platform/plans"),

    securityBlocks: () => r<{ blocks: Block[]; enabled: boolean; settings: GuardSettings }>("/api/platform/security/blocks"),
    unblock: (id: string) => r<unknown>(`/api/platform/security/blocks/${id}`, json("DELETE")),
    unblockAll: () => r<unknown>("/api/platform/security/blocks", json("DELETE")),

    server: () => r<ServerNow>("/api/platform/server"),
    cacheEntries: () => r<CacheEntries>("/api/platform/cache/entries"),
    expireCache: (what: ExpireScope) => r<{ result: { removed: number } }>("/api/platform/cache/expire", json("POST", what)),
    setCacheTtl: (ttlSeconds: number) => r<unknown>("/api/platform/cache/settings", json("PUT", { ttlSeconds })),
    settings: () => r<{ settings: { graceDays: number; realtimeWebsocket: boolean; subdomainBase: string } }>("/api/platform/settings"),
    saveSettings: (body: { graceDays?: number; realtimeWebsocket?: boolean }) => r<unknown>("/api/platform/settings", json("PUT", body)),

    /** every app of Rasoi Pulse with whether it is public (in the website's list) or private */
    appSettings: () => r<{ settings: AppSetting[] }>("/api/platform/app-releases/settings"),
    setAppVisibility: (app: string, isPublic: boolean) => r<unknown>(`/api/platform/app-releases/visibility/${app}`, json("PUT", { public: isPublic })),

    roles: () => r<{ roles: Role[]; features: { key: string; group: string; label: string; hint: string }[]; groups: string[] }>("/api/platform/roles"),
    createRole: (body: { name: string; description: string; features: string[] }) => r<{ role: Role }>("/api/platform/roles", json("POST", body)),
    updateRole: (id: string, body: { name: string; description: string; features: string[] }) => r<{ role: Role }>(`/api/platform/roles/${id}`, json("PATCH", body)),
    deleteRole: (id: string) => r<void>(`/api/platform/roles/${id}`, json("DELETE")),
    team: () => r<{ members: Member[] }>("/api/platform/team"),
    createMember: (body: { name: string; email: string; password: string; roleId: string }) => r<{ member: Member }>("/api/platform/team", json("POST", body)),
    updateMember: (id: string, body: { name?: string; roleId?: string; isActive?: boolean; password?: string }) => r<{ member: Member }>(`/api/platform/team/${id}`, json("PATCH", body)),
    deleteMember: (id: string) => r<void>(`/api/platform/team/${id}`, json("DELETE")),
    leads: (status?: LeadStatus) => r<{ leads: Lead[]; counts: Record<LeadStatus, number> }>(`/api/platform/site/leads${status ? `?status=${status}` : ""}`),
    updateLead: (id: string, body: { status?: LeadStatus; note?: string }) => r<{ lead: Lead }>(`/api/platform/site/leads/${id}`, json("PATCH", body)),
    onboardingList: () => r<{ forms: OnboardingRow[] }>("/api/platform/onboarding"),
    onboarding: (id: string) => r<{ form: OnboardingRow & { data: OnboardingData } }>(`/api/platform/onboarding/${id}`),
    createOnboarding: (data: OnboardingData) => r<{ form: OnboardingRow & { data: OnboardingData } }>("/api/platform/onboarding", json("POST", { data })),
    saveOnboarding: (id: string, data: OnboardingData) => r<{ form: OnboardingRow & { data: OnboardingData } }>(`/api/platform/onboarding/${id}`, json("PUT", { data })),
    deleteOnboarding: (id: string) => r<void>(`/api/platform/onboarding/${id}`, json("DELETE")),
    checkOnboarding: (id: string) => r<OnboardingCheck>(`/api/platform/onboarding/${id}/check`),
    publishOnboarding: (id: string, ownerPassword: string) => r<PublishResult>(`/api/platform/onboarding/${id}/publish`, json("POST", { ownerPassword })),
    resolveMap: (link: string) => r<{ point: { lat: number; lng: number }; from: string }>("/api/platform/onboarding/resolve-map", json("POST", { link })),
    checkAddress: (label: string) => r<{ available: boolean; reason?: string }>(`/api/platform/subdomains/check?label=${encodeURIComponent(label)}`),
    audit: (limit = 50) => r<{ entries: AuditEntry[] }>(`/api/platform/audit?limit=${limit}`),
  };
}
export type Api = ReturnType<typeof createApi>;
