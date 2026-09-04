import type {
  CapacityStatus,
  DashboardStats,
  Gateway,
  PrintDocType,
  Printer,
  PrintJobStatus,
  PrintJobView,
  PrintTarget,
  PrintTemplate,
  Table,
  TableStatus,
  Coupon,
  CouponInput,
  Menu,
  OrderChannel,
  OrderStatus,
  OrderTotals,
  PricedLine,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  NotifyFieldSpec,
  NotifyOrderChannel,
  OutletConfig,
  PlacedBy,
  Role,
  SessionUser,
} from "@onetap/config-schema";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3072";

export interface Outlet {
  _id: string;
  brandId: string;
  name: string;
  slug: string;
  hostnames: string[];
  canonicalHostname: string;
  config: OutletConfig;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface ReqInit extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>;
  /** which outlet this call acts on — the server verifies you may touch it */
  outletId?: string;
}

async function req<T>(path: string, init: ReqInit = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json", ...init.headers };
  if (init.outletId) headers["x-onetap-outlet"] = init.outletId;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // session cookie
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? `API responded ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/* ---------------------------------------------------------------------- auth */

export const login = (email: string, password: string) =>
  req<{ user: SessionUser }>("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const logout = () => req<void>("/api/auth/logout", { method: "POST" });

export const me = () => req<{ user: SessionUser }>("/api/auth/me");

/* --------------------------------------------------------------------- users */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
  role: Role | null;
  outletIds: string[];
}

export const listUsers = () => req<{ users: AdminUser[] }>("/api/users");

export const createUser = (body: { email: string; name: string; password: string; role: Role }) =>
  req<{ user: AdminUser }>("/api/users", { method: "POST", body: JSON.stringify(body) });

export const updateUser = (id: string, body: { name?: string; role?: Role; isActive?: boolean }) =>
  req<{ user: AdminUser }>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const deleteUser = (id: string) => req<void>(`/api/users/${id}`, { method: "DELETE" });

/* ------------------------------------------------------------------- outlets */

export const getHealth = () => req<{ ok: boolean; db: string; env: string; time: string }>("/health");

export const listOutlets = () => req<{ outlets: Outlet[]; scope?: string }>("/api/outlets");

export const seedDemo = () =>
  req<{ brand: unknown; outlet: Outlet; owner: { email: string; password: string } }>(
    "/api/outlets/seed-demo",
    { method: "POST" },
  );

export const patchOutletConfig = (outlet: Outlet, patch: Record<string, unknown>) =>
  req<{ config: OutletConfig }>(`/api/outlets/${outlet._id}/config`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    outletId: outlet._id,
  });

/* ---------------------------------------------------------------------- menu */

export type CategoryInput = { name: string; sortOrder?: number; isActive?: boolean };
export type ItemInput = Partial<Omit<MenuItem, "id" | "variants">> & {
  variants?: { id?: string; label: string; price: number }[];
};
export type GroupInput = Partial<Omit<ModifierGroup, "id" | "options">> & {
  options?: { id?: string; label: string; priceDelta?: number }[];
};

export const getMenu = (outlet: Outlet) =>
  req<Menu>(`/api/menu?outletId=${encodeURIComponent(outlet._id)}`);

export const createCategory = (o: Outlet, body: CategoryInput) =>
  req<{ category: MenuCategory }>("/api/menu/categories", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateCategory = (o: Outlet, id: string, body: Partial<CategoryInput>) =>
  req<{ category: MenuCategory }>(`/api/menu/categories/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteCategory = (o: Outlet, id: string) =>
  req<void>(`/api/menu/categories/${id}`, { method: "DELETE", outletId: o._id });

export const createItem = (o: Outlet, body: ItemInput & { categoryId: string; name: string }) =>
  req<{ item: MenuItem }>("/api/menu/items", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateItem = (o: Outlet, id: string, body: ItemInput) =>
  req<{ item: MenuItem }>(`/api/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteItem = (o: Outlet, id: string) =>
  req<void>(`/api/menu/items/${id}`, { method: "DELETE", outletId: o._id });

export const createModifierGroup = (o: Outlet, body: GroupInput & { name: string }) =>
  req<{ group: ModifierGroup }>("/api/menu/modifier-groups", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const deleteModifierGroup = (o: Outlet, id: string) =>
  req<void>(`/api/menu/modifier-groups/${id}`, { method: "DELETE", outletId: o._id });

/* -------------------------------------------------------------------- orders */

export interface AdminOrder {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  /** who put the order in — a customer self-serving, or staff on their behalf */
  placedBy: PlacedBy;
  /** set only when placedBy is "staff" */
  staffName: string | null;
  status: OrderStatus;
  lines: PricedLine[];
  totals: OrderTotals;
  pricesIncludeTax: boolean;
  payment: { gateway: Gateway; status: "pending" | "paid" | "failed" | "refunded"; paymentId?: string };
  note: string | null;
  customer?: { name?: string; phone?: string; email?: string };
  tableId: string | null;
  couponCode: string | null;
  deliveryAddress: { text: string; landmark?: string; lat: number; lng: number; distanceKm: number } | null;
  etaMinutes: number | null;
  /** drives the SLA clock — measured from the last status change */
  statusHistory: { status: OrderStatus; at: string; by?: string; manual?: boolean; edited?: boolean; from?: OrderStatus; reason?: string }[];
  createdAt: string;
}

export interface OrderListResult {
  orders: AdminOrder[];
  counts: { paymentPending: number };
}

/**
 * `paymentPending` controls the unpaid-prepaid bucket (abandoned checkouts /
 * failed payments): "hide" (default) keeps them out of the list, "only" shows
 * just those, "all" shows everything. `counts.paymentPending` is always the
 * true total regardless.
 */
export const listOrders = (o: Outlet, status?: OrderStatus, paymentPending?: "hide" | "only" | "all") => {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (paymentPending && paymentPending !== "hide") qs.set("paymentPending", paymentPending);
  // The table pages through this client-side (filters are client-side too —
  // status/type/payment/print/search), so fetch the server's full batch and
  // let the page-size control just slice it.
  qs.set("limit", "200");
  const q = qs.toString();
  return req<OrderListResult>(`/api/orders${q ? `?${q}` : ""}`, { outletId: o._id });
};

/** Public route — no outlet header needed, just the id. */
export const getCapacity = (o: Outlet) =>
  req<CapacityStatus>(`/api/orders/capacity?outletId=${encodeURIComponent(o._id)}`);

export const getDashboardStats = (o: Outlet) =>
  req<DashboardStats>("/api/dashboard/stats", { outletId: o._id });

export const setOrderStatus = (o: Outlet, id: string, status: OrderStatus) =>
  req<{ order: AdminOrder }>(`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    outletId: o._id,
  });

/** Force a status, ignoring the forward-only flow — the mis-tap correction. */
export const setOrderStatusManual = (o: Outlet, id: string, status: OrderStatus, reason?: string) =>
  req<{ order: AdminOrder }>(`/api/orders/${id}/status/manual`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
    outletId: o._id,
  });

export interface OrderEdit {
  cart?: { lines: { itemId: string; variantId?: string; quantity: number; modifiers: string[]; note?: string }[] };
  note?: string;
  customerName?: string;
  customerPhone?: string;
}

export const editOrder = (o: Outlet, id: string, body: OrderEdit) =>
  req<{ order: AdminOrder }>(`/api/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    outletId: o._id,
  });

/* ------------------------------------------------------------------ payments */

export interface GatewayField {
  key: string;
  label: string;
  secret: boolean;
  hint?: string;
  /** the longer "what and why", shown behind the (i) */
  info?: string;
  value: string;
  isSet: boolean;
}

export interface GatewayConfig {
  gateway: Gateway;
  isOnline: boolean;
  requiredFields: string[];
  configured: boolean;
  available: boolean;
  fields: GatewayField[];
  updatedAt: string | null;
}

export const getPaymentConfig = (o: Outlet) =>
  req<{ gateways: GatewayConfig[] }>("/api/payments/config", { outletId: o._id });

export const savePaymentConfig = (o: Outlet, gateway: Gateway, values: Record<string, string>) =>
  req<{ gateways: GatewayConfig[] }>(`/api/payments/config/${gateway}`, {
    method: "PUT",
    body: JSON.stringify({ values }),
    outletId: o._id,
  });

export const clearPaymentConfig = (o: Outlet, gateway: Gateway) =>
  req<{ gateways: GatewayConfig[] }>(`/api/payments/config/${gateway}`, { method: "DELETE", outletId: o._id });

/* ------------------------------------------------------------------- tables */

export interface ActiveSession {
  id: string;
  tableId: string;
  tableNumber: string;
  customerId: string;
  openedAt: string;
  orderCount: number;
  tab: number;
  tableHistory: { tableId: string; number: string; at: string; by?: string }[];
}

export const listTables = (o: Outlet) => req<{ tables: Table[] }>("/api/tables", { outletId: o._id });

export const createTable = (o: Outlet, body: { number: string; zone?: string; seats?: number }) =>
  req<{ table: Table }>("/api/tables", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateTable = (o: Outlet, id: string, body: Partial<{ number: string; zone: string; seats: number; status: TableStatus; isActive: boolean }>) =>
  req<{ table: Table }>(`/api/tables/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteTable = (o: Outlet, id: string) =>
  req<void>(`/api/tables/${id}`, { method: "DELETE", outletId: o._id });

export const getTableQr = (o: Outlet, id: string) =>
  req<{ url: string; dataUrl: string; number: string }>(`/api/tables/${id}/qr`, { outletId: o._id });

export const rotateTableQr = (o: Outlet, id: string) =>
  req<{ url: string; dataUrl: string; number: string }>(`/api/tables/${id}/qr/rotate`, {
    method: "POST", body: "{}", outletId: o._id,
  });

export const listActiveSessions = (o: Outlet) =>
  req<{ sessions: ActiveSession[] }>("/api/tables/sessions/active", { outletId: o._id });

export const moveSession = (o: Outlet, sessionId: string, toTableId: string) =>
  req<unknown>(`/api/tables/sessions/${sessionId}/move`, {
    method: "POST", body: JSON.stringify({ toTableId }), outletId: o._id,
  });

export const closeSession = (o: Outlet, sessionId: string) =>
  req<unknown>(`/api/tables/sessions/${sessionId}/close`, { method: "POST", body: "{}", outletId: o._id });

/* ------------------------------------------------------------------ printing */

/** The API never returns a stored cloud key — only whether one is set. */
export type AdminPrinter = Printer & { cloudApiKeySet: boolean; configError: string | null };

export type PrinterInput = Omit<Printer, "id" | "lastOkAt" | "lastErrorAt" | "lastError" | "connection"> & {
  connection: Partial<Printer["connection"]>;
};

export const listPrinters = (o: Outlet) =>
  req<{ printers: AdminPrinter[] }>("/api/printing/printers", { outletId: o._id });

export const createPrinter = (o: Outlet, body: Partial<PrinterInput>) =>
  req<{ printer: AdminPrinter }>("/api/printing/printers", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updatePrinter = (o: Outlet, id: string, body: Partial<PrinterInput>) =>
  req<{ printer: AdminPrinter }>(`/api/printing/printers/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deletePrinter = (o: Outlet, id: string) =>
  req<void>(`/api/printing/printers/${id}`, { method: "DELETE", outletId: o._id });

export const testPrint = (o: Outlet, id: string) =>
  req<{ job: PrintJobView }>(`/api/printing/printers/${id}/test`, { method: "POST", body: "{}", outletId: o._id });

export const getAgentToken = (o: Outlet, id: string) =>
  req<{ token: string; agentId: string }>(`/api/printing/printers/${id}/agent-token`, { outletId: o._id });

export const getEposEndpoint = (o: Outlet, id: string) =>
  req<{ url: string; deviceId: string }>(`/api/printing/printers/${id}/endpoint`, { outletId: o._id });

/* --------------------------------------------------------------- templates */

export const listTemplates = (o: Outlet) =>
  req<{ templates: PrintTemplate[] }>("/api/printing/templates", { outletId: o._id });

export const createTemplate = (o: Outlet, body: Partial<PrintTemplate> & { name: string; docType: PrintDocType }) =>
  req<{ template: PrintTemplate }>("/api/printing/templates", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateTemplate = (o: Outlet, id: string, body: Partial<PrintTemplate>) =>
  req<{ template: PrintTemplate }>(`/api/printing/templates/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteTemplate = (o: Outlet, id: string) =>
  req<void>(`/api/printing/templates/${id}`, { method: "DELETE", outletId: o._id });

/** Renders a template without printing it — powers the live preview. */
export const previewTemplate = (o: Outlet, template: Partial<PrintTemplate>, isReprint = false) =>
  req<{ html: string; text: string }>("/api/printing/preview", {
    method: "POST",
    body: JSON.stringify({ template, isReprint }),
    outletId: o._id,
  });

/* -------------------------------------------------------------------- jobs */

export const listPrintJobs = (o: Outlet, status?: PrintJobStatus) =>
  req<{ jobs: PrintJobView[] }>(`/api/printing/jobs${status ? `?status=${status}` : ""}`, { outletId: o._id });

export const printStatusForOrders = (o: Outlet, ids: string[]) =>
  req<{ status: Record<string, { printed: number; failed: number; pending: number; total: number }> }>(
    `/api/printing/jobs/by-order?ids=${encodeURIComponent(ids.join(","))}`,
    { outletId: o._id },
  );

export const retryPrintJob = (o: Outlet, id: string) =>
  req<{ job: PrintJobView }>(`/api/printing/jobs/${id}/retry`, { method: "POST", body: "{}", outletId: o._id });

export const reprintJob = (o: Outlet, id: string) =>
  req<{ job: PrintJobView }>(`/api/printing/jobs/${id}/reprint`, { method: "POST", body: "{}", outletId: o._id });

export const cancelPrintJob = (o: Outlet, id: string) =>
  req<{ job: PrintJobView }>(`/api/printing/jobs/${id}/cancel`, { method: "POST", body: "{}", outletId: o._id });

export const printOrderOn = (o: Outlet, orderId: string, printerId: string) =>
  req<{ job: PrintJobView }>(`/api/printing/orders/${orderId}/print`, {
    method: "POST",
    body: JSON.stringify({ printerId }),
    outletId: o._id,
  });

/* ------------------------------------------------------- in-browser runner */

export interface ClaimedJob extends PrintJobView {
  html: string;
  escpos: string | null;
}

/** Takes jobs this browser can execute. Claiming is atomic server-side. */
export const claimPrintJobs = (o: Outlet, clientId: string, targets: PrintTarget[]) =>
  req<{ jobs: ClaimedJob[] }>("/api/printing/jobs/claim", {
    method: "POST",
    body: JSON.stringify({ clientId, targets }),
    outletId: o._id,
  });

export const reportPrintResult = (o: Outlet, id: string, result: { ok: boolean; error?: string; ms?: number }) =>
  req<{ job: PrintJobView }>(`/api/printing/jobs/${id}/result`, {
    method: "POST",
    body: JSON.stringify(result),
    outletId: o._id,
  });

/* ------------------------------------------------------------------ coupons */

export const listCoupons = (o: Outlet) =>
  req<{ coupons: Coupon[] }>("/api/coupons", { outletId: o._id });

export const createCoupon = (o: Outlet, body: CouponInput) =>
  req<{ coupon: Coupon }>("/api/coupons", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateCoupon = (o: Outlet, id: string, body: Partial<CouponInput>) =>
  req<{ coupon: Coupon }>(`/api/coupons/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteCoupon = (o: Outlet, id: string) =>
  req<void>(`/api/coupons/${id}`, { method: "DELETE", outletId: o._id });

/* ----------------------------------------------------------------- customers */

export interface AdminCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  orderCount: number;
  walletBalance: number;
  lastOrderAt: string | null;
  createdAt: string;
}

export const listCustomers = (o: Outlet, q?: string) => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return req<{ customers: AdminCustomer[] }>(`/api/customers${qs}`, { outletId: o._id });
};

export interface WalletLedgerEntry {
  id: string;
  kind: "earn" | "redeem" | "reverse";
  coins: number;
  balanceAfter: number;
  reason: string;
  orderId: string | null;
  orderNumber: string | null;
  createdAt: string;
}

export const getCustomerWallet = (o: Outlet, customerId: string) =>
  req<{ balance: number; entries: WalletLedgerEntry[] }>(`/api/customers/${customerId}/wallet`, { outletId: o._id });

/* -------------------------------------------------------------- notifications */

export interface NotifyChannelConfig {
  channel: NotifyOrderChannel;
  requiredFields: string[];
  configured: boolean;
  fields: (NotifyFieldSpec & { value: string; isSet: boolean })[];
  updatedAt: string | null;
}

export const getNotifyConfig = (o: Outlet) =>
  req<{ channels: NotifyChannelConfig[] }>("/api/notify/config", { outletId: o._id });

export const saveNotifyConfig = (o: Outlet, channel: NotifyOrderChannel, values: Record<string, string>) =>
  req<{ channels: NotifyChannelConfig[] }>(`/api/notify/config/${channel}`, {
    method: "PUT",
    body: JSON.stringify({ values }),
    outletId: o._id,
  });

export const clearNotifyConfig = (o: Outlet, channel: NotifyOrderChannel) =>
  req<{ channels: NotifyChannelConfig[] }>(`/api/notify/config/${channel}`, { method: "DELETE", outletId: o._id });

export interface NotificationLogEntry {
  id: string;
  channel: NotifyOrderChannel;
  event: OrderStatus;
  orderId: string | null;
  orderNumber: string | null;
  to: string;
  status: "sent" | "failed" | "skipped";
  error: string | null;
  providerMessageId: string | null;
  createdAt: string;
}

export const listNotificationLogs = (
  o: Outlet,
  filter: { channel?: NotifyOrderChannel; event?: OrderStatus; status?: "sent" | "failed" | "skipped" } = {},
) => {
  const qs = new URLSearchParams();
  if (filter.channel) qs.set("channel", filter.channel);
  if (filter.event) qs.set("event", filter.event);
  if (filter.status) qs.set("status", filter.status);
  const q = qs.toString();
  return req<{ logs: NotificationLogEntry[] }>(`/api/notify/logs${q ? `?${q}` : ""}`, { outletId: o._id });
};
