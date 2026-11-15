             
                 
                 
          
               
          
                 
               
              
                
        
              
         
              
       
               
              
              
             
               
           
                
                  
                     
               
           
       
              
                               

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3072";

                         
              
                  
               
               
                      
                            
                       
 

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    /** extra facts the API sent with the error, such as `{ code: "store_disabled" }` */
    this.details = details;
  }
}

/** True when the API turned someone away because TablePe has switched their whole store off. */
export const isStoreDisabledError = (error) => error instanceof ApiError && error.status === 403 && error.details?.code === "store_disabled";

;                                                       
                                   
                                                                              
                    
 

async function req   (path        , init          = {})             {
  const headers                         = { "content-type": "application/json", ...init.headers };
  if (init.outletId) headers["x-onetap-outlet"] = init.outletId;
  if (init.brandId) headers["x-onetap-brand"] = init.brandId;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include", // session cookie
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({})))                      ;
    throw new ApiError(res.status, body.error ?? `API responded ${res.status}`, body.details);
  }
  if (res.status === 204) return undefined     ;
  return res.json()              ;
}

/* ---------------------------------------------------------------------- auth */

export const login = (email        , password        ) =>
  req                       ("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });

export const logout = () => req      ("/api/auth/logout", { method: "POST" });

export const me = () => req                       ("/api/auth/me");

/* --------------------------------------------------------------------- users */

                            
             
                
               
                    
                             
                    
                      
 

// brandId is only ever needed for a superadmin — everyone else's session
// already carries their one brandId server-side, and requireBrandContext
// falls back to it when no x-onetap-brand header is sent.
export const listUsers = (brandId          ) => req                        ("/api/users", { brandId });

export const createUser = (body                                                               , brandId          ) =>
  req                     ("/api/users", { method: "POST", body: JSON.stringify(body), brandId });

export const updateUser = (id        , body                                                    , brandId          ) =>
  req                     (`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body), brandId });

export const deleteUser = (id        , brandId          ) =>
  req      (`/api/users/${id}`, { method: "DELETE", brandId });

/* -------------------------------------------------------------- brands/outlets */

export const getHealth = () => req                                                        ("/health");

/** For the platform's "open store dashboard", pass the store's brand id to list just its outlets. */
export const listOutlets = (brandId) =>
  req(brandId ? `/api/outlets?brandId=${encodeURIComponent(brandId)}` : "/api/outlets");

export const createBrand = (body        ) =>
  req      ("/api/brands", { method: "POST", body: JSON.stringify(body) });

export const createOutlet = (brandId        , body        ) =>
  req      ("/api/outlets", { method: "POST", body: JSON.stringify(body), brandId });

export const updateOutlet = (id        , body        ) =>
  req      (`/api/outlets/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: id });

export const deleteOutlet = (id        ) =>
  req      (`/api/outlets/${id}`, { method: "DELETE", outletId: id });

export const patchOutletConfig = (outlet        , patch                         ) =>
  req                          (`/api/outlets/${outlet._id}/config`, {
    method: "PATCH",
    body: JSON.stringify(patch),
    outletId: outlet._id,
  });

/** Opens a live menu-layout preview session; returns its shareable id. */
export const createPreviewSession = (o        , layout        ) =>
  req                    ("/api/preview", {
    method: "POST",
    body: JSON.stringify({ layout }),
    outletId: o._id,
  });

/* ------------------------------------------------------------------ storage */

// Where images are kept (this server's disk or an S3-compatible bucket) is the PLATFORM's setting — see the console's Storage page.
export const getPlatformStorage = () => req("/api/platform/storage");

/** payload: { provider?, values?, processing? } */
export const savePlatformStorage = (payload) => req("/api/platform/storage", json("PUT", payload));

export const resetPlatformStorage = () => req("/api/platform/storage", json("DELETE"));

export const testPlatformStorage = () => req("/api/platform/storage/test", json("POST"));

/** Use one store's own (older) storage settings as the platform's. */
export const adoptStoreStorage = (brandId) => req(`/api/platform/storage/adopt/${brandId}`, json("POST"));

/**
 * Upload one image of any format. The API compresses + re-encodes it and
 * returns { url, key, width, height, format, bytes, originalBytes }.
 */
export const uploadImage = (o        , blob      , kind = "menu-items") =>
  req                (`/api/storage/upload?kind=${encodeURIComponent(kind)}`, {
    method: "POST",
    body: blob,
    headers: { "content-type": blob.type || "application/octet-stream" },
    outletId: o._id,
  });

export const deleteStorageObject = (o        , key        ) =>
  req      ("/api/storage/object", {
    method: "DELETE",
    body: JSON.stringify({ key }),
    outletId: o._id,
  });

/* ------------------------------------------------------------- storefront pages */

// A store's own pages (About us, Contact…) — one set per outlet.
export const listStorePages = (o) => req("/api/pages", { outletId: o._id });
export const getStorePage = (o, id) => req(`/api/pages/${id}`, { outletId: o._id });
export const createStorePage = (o, body) => req("/api/pages", { method: "POST", body: JSON.stringify(body), outletId: o._id });
export const updateStorePage = (o, id, body) => req(`/api/pages/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });
export const deleteStorePage = (o, id) => req(`/api/pages/${id}`, { method: "DELETE", outletId: o._id });
export const reorderStorePages = (o, ids) => req("/api/pages/order", { method: "PUT", body: JSON.stringify({ ids }), outletId: o._id });
/** Creates the ready-made pages the outlet doesn't have yet, as drafts. */
export const createStarterPages = (o) => req("/api/pages/starter", { method: "POST", body: "{}", outletId: o._id });

/* ---------------------------------------------------------------------- menu */

                                                                                     
                                                                      
                                                             
  
                                                                           
                                                                  
  

export const getMenu = (outlet        ) =>
  req      (`/api/menu?outletId=${encodeURIComponent(outlet._id)}`);

export const createCategory = (o        , body               ) =>
  req                            ("/api/menu/categories", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateCategory = (o        , id        , body                        ) =>
  req                            (`/api/menu/categories/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteCategory = (o        , id        ) =>
  req      (`/api/menu/categories/${id}`, { method: "DELETE", outletId: o._id });

export const createItem = (o        , body                                                  ) =>
  req                    ("/api/menu/items", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateItem = (o        , id        , body           ) =>
  req                    (`/api/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteItem = (o        , id        ) =>
  req      (`/api/menu/items/${id}`, { method: "DELETE", outletId: o._id });

export const createModifierGroup = (o        , body                               ) =>
  req                          ("/api/menu/modifier-groups", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const deleteModifierGroup = (o        , id        ) =>
  req      (`/api/menu/modifier-groups/${id}`, { method: "DELETE", outletId: o._id });

export const importMenu = (o        , body        ) =>
  req("/api/menu/import", { method: "POST", body: JSON.stringify(body), outletId: o._id });


/* -------------------------------------------------------------------- orders */

                             
             
                      
                        
                                                                                 
                     
                                          
                           
                      
                      
                      
                            
                                                                                                        
                      
                                                               
                         
                            
                                                                                                            
                            
                                                                    
                                                                                                                                             
                    
 

                                  
                       
                                     
 

/**
 * `paymentPending` controls the unpaid-prepaid bucket (abandoned checkouts /
 * failed payments): "hide" (default) keeps them out of the list, "only" shows
 * just those, "all" shows everything. `counts.paymentPending` is always the
 * true total regardless.
 */
export const listOrders = (o        , status              , paymentPending                          ) => {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (paymentPending && paymentPending !== "hide") qs.set("paymentPending", paymentPending);
  // The table pages through this client-side (filters are client-side too —
  // status/type/payment/print/search), so fetch the server's full batch and
  // let the page-size control just slice it.
  qs.set("limit", "200");
  const q = qs.toString();
  return req                 (`/api/orders${q ? `?${q}` : ""}`, { outletId: o._id });
};

/** Public route — no outlet header needed, just the id. */
export const getCapacity = (o        ) =>
  req                (`/api/orders/capacity?outletId=${encodeURIComponent(o._id)}`);

export const getDashboardStats = (o        ) =>
  req                ("/api/dashboard/stats", { outletId: o._id });

export const setOrderStatus = (o        , id        , status             ) =>
  req                       (`/api/orders/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    outletId: o._id,
  });

/** Force a status, ignoring the forward-only flow — the mis-tap correction. */
export const setOrderStatusManual = (o        , id        , status             , reason         ) =>
  req                       (`/api/orders/${id}/status/manual`, {
    method: "PATCH",
    body: JSON.stringify({ status, reason }),
    outletId: o._id,
  });

                            
                                                                                                                   
                
                        
                         
 

export const editOrder = (o        , id        , body           ) =>
  req                       (`/api/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    outletId: o._id,
  });

/** Staff placing an order on a diner's behalf — a walk-in, a phoned-in order,
 *  or a second round added to a table already in service (`sessionId`). */
export const placeOrder = (o        , body           ) =>
  req                       ("/api/orders", { method: "POST", body: JSON.stringify(body), outletId: o._id });

/* ------------------------------------------------------- staff "Take order" */

export const staffCustomerLookup = (o, phone) =>
  req(`/api/orders/staff/customer?phone=${encodeURIComponent(phone)}`, { outletId: o._id });

export const searchStaffCustomers = (o, q) =>
  req(`/api/orders/staff/customers?q=${encodeURIComponent(q)}`, { outletId: o._id });

export const staffQuote = (o, body) =>
  req("/api/orders/staff/quote", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const sendStaffCoinsCode = (o, phone) =>
  req("/api/orders/staff/coins-code", { method: "POST", body: JSON.stringify({ phone }), outletId: o._id });

export const verifyStaffCoinsCode = (o, phone, code) =>
  req("/api/orders/staff/coins-code/verify", { method: "POST", body: JSON.stringify({ phone, code }), outletId: o._id });

export const placeStaffOrder = (o, body) =>
  req("/api/orders/staff", { method: "POST", body: JSON.stringify(body), outletId: o._id });

/* ------------------------------------------------------------------ payments */

                               
              
                
                  
                
                                                        
                
                
                 
 

                                
                   
                    
                           
                      
                     
                         
                           
 

export const getPaymentConfig = (o        ) =>
  req                               ("/api/payments/config", { outletId: o._id });

export const savePaymentConfig = (o        , gateway         , values                        ) =>
  req                               (`/api/payments/config/${gateway}`, {
    method: "PUT",
    body: JSON.stringify({ values }),
    outletId: o._id,
  });

export const clearPaymentConfig = (o        , gateway         ) =>
  req                               (`/api/payments/config/${gateway}`, { method: "DELETE", outletId: o._id });

/* ------------------------------------------------------------------- tables */

                                
             
                  
                      
                     
                   
                     
              
                                                                               
 

export const listTables = (o        ) => req                     ("/api/tables", { outletId: o._id });

export const createTable = (o        , body                                                   ) =>
  req                  ("/api/tables", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateTable = (o        , id        , body                                                                                                  ) =>
  req                  (`/api/tables/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteTable = (o        , id        ) =>
  req      (`/api/tables/${id}`, { method: "DELETE", outletId: o._id });

export const getTableQr = (o        , id        ) =>
  req                                                  (`/api/tables/${id}/qr`, { outletId: o._id });

export const rotateTableQr = (o        , id        ) =>
  req                                                  (`/api/tables/${id}/qr/rotate`, {
    method: "POST", body: "{}", outletId: o._id,
  });

export const listActiveSessions = (o        ) =>
  req                               ("/api/tables/sessions/active", { outletId: o._id });

export const moveSession = (o        , sessionId        , toTableId        ) =>
  req         (`/api/tables/sessions/${sessionId}/move`, {
    method: "POST", body: JSON.stringify({ toTableId }), outletId: o._id,
  });

export const closeSession = (o        , sessionId        ) =>
  req         (`/api/tables/sessions/${sessionId}/close`, { method: "POST", body: "{}", outletId: o._id });

export const confirmSessionPayment = (o        , sessionId        ) =>
  req      (`/api/tables/sessions/${sessionId}/confirm-payment`, { method: "POST", body: "{}", outletId: o._id });

export const voidSession = (o        , sessionId        , reason         ) =>
  req         (`/api/tables/sessions/${sessionId}/void`, {
    method: "POST", body: JSON.stringify({ reason }), outletId: o._id,
  });

/* ---------------------------------------------------------------- QR cards */

/**
 * Every table's signed URL in one call, plus the storefront origin the server
 * resolved. The origin comes back so the editor can refuse to let someone
 * print forty cards pointing at localhost.
 */
export const listTableQrUrls = (o) =>
  req("/api/tables/qr-urls", { outletId: o._id });

export const getCardDesign = (o) => req("/api/qr-cards/design", { outletId: o._id });

/**
 * Sends the whole spec. `baseUpdatedAt` is what this client last read; the
 * server rejects the save if the stored design has moved on since, so two
 * managers editing at once can't silently overwrite each other.
 */
export const saveCardDesign = (o, body) =>
  req("/api/qr-cards/design", { method: "PUT", body: JSON.stringify(body), outletId: o._id });

export const resetCardDesign = (o) =>
  req("/api/qr-cards/design/reset", { method: "POST", body: "{}", outletId: o._id });

/* ------------------------------------------------------------------ printing */

/** The API never returns a stored cloud key — only whether one is set. */
                                                                                             

                                                                                                            
                                             
  

export const listPrinters = (o        ) =>
  req                              ("/api/printing/printers", { outletId: o._id });

export const createPrinter = (o        , body                       ) =>
  req                           ("/api/printing/printers", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updatePrinter = (o        , id        , body                       ) =>
  req                           (`/api/printing/printers/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deletePrinter = (o        , id        ) =>
  req      (`/api/printing/printers/${id}`, { method: "DELETE", outletId: o._id });

export const testPrint = (o        , id        ) =>
  req                       (`/api/printing/printers/${id}/test`, { method: "POST", body: "{}", outletId: o._id });

export const getAgentToken = (o        , id        ) =>
  req                                    (`/api/printing/printers/${id}/agent-token`, { outletId: o._id });

export const getEposEndpoint = (o        , id        ) =>
  req                                   (`/api/printing/printers/${id}/endpoint`, { outletId: o._id });

/* --------------------------------------------------------------- templates */

export const listTemplates = (o        ) =>
  req                                ("/api/printing/templates", { outletId: o._id });

export const createTemplate = (o        , body                                                                  ) =>
  req                             ("/api/printing/templates", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateTemplate = (o        , id        , body                        ) =>
  req                             (`/api/printing/templates/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteTemplate = (o        , id        ) =>
  req      (`/api/printing/templates/${id}`, { method: "DELETE", outletId: o._id });

/** Renders a template without printing it — powers the live preview. */
export const previewTemplate = (o        , template                        , isReprint = false) =>
  req                                ("/api/printing/preview", {
    method: "POST",
    body: JSON.stringify({ template, isReprint }),
    outletId: o._id,
  });

/* -------------------------------------------------------------------- jobs */

export const listPrintJobs = (o        , status                 ) =>
  req                          (`/api/printing/jobs${status ? `?status=${status}` : ""}`, { outletId: o._id });

export const printStatusForOrders = (o        , ids          ) =>
  req                                                                                                 (
    `/api/printing/jobs/by-order?ids=${encodeURIComponent(ids.join(","))}`,
    { outletId: o._id },
  );

export const retryPrintJob = (o        , id        ) =>
  req                       (`/api/printing/jobs/${id}/retry`, { method: "POST", body: "{}", outletId: o._id });

export const reprintJob = (o        , id        ) =>
  req                       (`/api/printing/jobs/${id}/reprint`, { method: "POST", body: "{}", outletId: o._id });

export const cancelPrintJob = (o        , id        ) =>
  req                       (`/api/printing/jobs/${id}/cancel`, { method: "POST", body: "{}", outletId: o._id });

export const printOrderOn = (o        , orderId        , printerId        ) =>
  req                       (`/api/printing/orders/${orderId}/print`, {
    method: "POST",
    body: JSON.stringify({ printerId }),
    outletId: o._id,
  });

/* ------------------------------------------------------- in-browser runner */

                                                  
               
                        
 

/** Takes jobs this browser can execute. Claiming is atomic server-side. */
export const claimPrintJobs = (o        , clientId        , targets               ) =>
  req                        ("/api/printing/jobs/claim", {
    method: "POST",
    body: JSON.stringify({ clientId, targets }),
    outletId: o._id,
  });

export const reportPrintResult = (o        , id        , result                                              ) =>
  req                       (`/api/printing/jobs/${id}/result`, {
    method: "POST",
    body: JSON.stringify(result),
    outletId: o._id,
  });

/* ------------------------------------------------------------------ coupons */

export const listCoupons = (o        ) =>
  req                       ("/api/coupons", { outletId: o._id });

export const createCoupon = (o        , body             ) =>
  req                    ("/api/coupons", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateCoupon = (o        , id        , body                      ) =>
  req                    (`/api/coupons/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteCoupon = (o        , id        ) =>
  req      (`/api/coupons/${id}`, { method: "DELETE", outletId: o._id });

/* ----------------------------------------------------------------- customers */

                                
             
                      
                       
                       
                     
                        
                             
                    
 

export const listCustomers = (o        , q         ) => {
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";
  return req                                (`/api/customers${qs}`, { outletId: o._id });
};

                                    
             
                                      
                
                       
                 
                         
                             
                    
 

export const getCustomerWallet = (o        , customerId        ) =>
  req                                                   (`/api/customers/${customerId}/wallet`, { outletId: o._id });

/* -------------------------------------------------------------- notifications */

                                      
                              
                           
                      
                                                                  
                           
 

export const getNotifyConfig = (o        ) =>
  req                                     ("/api/notify/config", { outletId: o._id });

export const saveNotifyConfig = (o        , channel                    , values                        ) =>
  req                                     (`/api/notify/config/${channel}`, {
    method: "PUT",
    body: JSON.stringify({ values }),
    outletId: o._id,
  });

export const clearNotifyConfig = (o        , channel                    ) =>
  req                                     (`/api/notify/config/${channel}`, { method: "DELETE", outletId: o._id });

                                       
             
                              
                     
                         
                             
             
                                        
                       
                                   
                    
 

export const listNotificationLogs = (
  o        ,
  filter                                                                                                = {},
) => {
  const qs = new URLSearchParams();
  if (filter.channel) qs.set("channel", filter.channel);
  if (filter.event) qs.set("event", filter.event);
  if (filter.status) qs.set("status", filter.status);
  const q = qs.toString();
  return req                                  (`/api/notify/logs${q ? `?${q}` : ""}`, { outletId: o._id });
};

/* ------------------------------------------------------------ store plan */

/** The current store's plan: limits, what's unlocked, usage and any grace period. */
export const getStorePlan = (brandId) => req("/api/store/plan", { brandId });

/* -------------------------------------------------------- platform console */

const json = (method, body) => ({ method, body: JSON.stringify(body ?? {}) });

/** The dashboard's numbers. `fresh` recomputes them instead of using the server's cached copy. */
export const getDashboard = (fresh = false) => req(`/api/platform/dashboard${fresh ? "?fresh=1" : ""}`);
/** Sign-in history, newest first: filter = all | success | failed | platform | stores. */
export const getLoginLogs = ({ filter = "all", cursor, limit = 20 } = {}) =>
  req(`/api/platform/login-logs?filter=${filter}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`);

/* the server this API runs on */
export const getServer = () => req("/api/platform/server");
export const getServerHealth = () => req("/api/platform/server/health");
export const getServerHistory = (minutes = 30) => req(`/api/platform/server/history?minutes=${minutes}`);
export const getServerProcesses = () => req("/api/platform/server/processes");
export const getFolderScan = () => req("/api/platform/server/folders");
export const startFolderScan = () => req("/api/platform/server/folders/scan", json("POST"));

/* cache controls */
export const getCacheOverview = () => req("/api/platform/cache");
export const setCacheTtl = (ttlSeconds) => req("/api/platform/cache/settings", json("PUT", { ttlSeconds }));
/** { scope: "all" } or { scope: "store", storeId } */
export const expireCache = (body) => req("/api/platform/cache/expire", json("POST", body));
export const getStoreCache = (id) => req(`/api/platform/stores/${id}/cache`);
/** Everything cached right now: what, for which store, how old, how big. Looking never changes the cache. */
export const getCacheEntries = () => req("/api/platform/cache/entries");
/** One cached item with its data (secret-looking fields hidden). `key` is the cache key, e.g. "menu:<store>:<outlet>". */
export const getCacheEntry = (key) => req(`/api/platform/cache/entry?key=${encodeURIComponent(key)}`);

/* deleting a store */
export const getDisableSummary = (id) => req(`/api/platform/stores/${id}/disable-summary`);
/** Switch a whole store off (a late payment, say) — nothing is deleted. Calling it again just changes the message. */
export const disableStore = (id, message) => req(`/api/platform/stores/${id}/disable`, json("POST", { message }));
export const enableStore = (id) => req(`/api/platform/stores/${id}/enable`, json("POST"));
export const getDeletionSummary = (id) => req(`/api/platform/stores/${id}/deletion-summary`);
export const deleteStore = (id, confirmName) => req(`/api/platform/stores/${id}`, json("DELETE", { confirmName }));
export const listPlans = () => req("/api/platform/plans");
export const createPlan = (body) => req("/api/platform/plans", json("POST", body));
export const updatePlan = (id, body) => req(`/api/platform/plans/${id}`, json("PATCH", body));
export const getPlatformSettings = () => req("/api/platform/settings");
export const updatePlatformSettings = (body) => req("/api/platform/settings", json("PUT", body));
export const listStores = () => req("/api/platform/stores");
export const getStore = (id) => req(`/api/platform/stores/${id}`);
export const setStorePlan = (id, body) => req(`/api/platform/stores/${id}/plan`, json("PATCH", body));
export const setStoreDomains = (id, body) => req(`/api/platform/stores/${id}/domains`, json("PUT", body));
export const checkSubdomain = (label, storeId) =>
  req(`/api/platform/subdomains/check?label=${encodeURIComponent(label)}&storeId=${encodeURIComponent(storeId ?? "")}`);
export const probeSubdomains = () => req("/api/platform/subdomains/probe");
export const setStoreSubdomain = (id, label) => req(`/api/platform/stores/${id}/subdomain`, json("PUT", { label }));
export const removeStoreSubdomain = (id) => req(`/api/platform/stores/${id}/subdomain`, json("DELETE"));
export const getSubdomainStatus = (id) => req(`/api/platform/stores/${id}/subdomain/status`);
export const setOutletBlocked = (id, outletId, blocked) =>
  req(`/api/platform/stores/${id}/outlets/${outletId}/${blocked ? "block" : "unblock"}`, json("POST"));
export const deleteStoreOutlet = (id, outletId, confirmName) =>
  req(`/api/platform/stores/${id}/outlets/${outletId}`, json("DELETE", { confirmName }));
export const setPersonBlocked = (id, userId, blocked) =>
  req(`/api/platform/stores/${id}/people/${userId}/${blocked ? "block" : "unblock"}`, json("POST"));
export const deleteStorePerson = (id, userId) => req(`/api/platform/stores/${id}/people/${userId}`, json("DELETE"));
export const addStoreOwner = (id, body) => req(`/api/platform/stores/${id}/owners`, json("POST", body));
export const updateStoreOwner = (id, userId, body) => req(`/api/platform/stores/${id}/owners/${userId}`, json("PATCH", body));
export const removeStoreOwner = (id, userId) => req(`/api/platform/stores/${id}/owners/${userId}`, json("DELETE"));

/* ---------------------------------------------------- TablePe website (platform) */

export const getSiteSettings = () => req("/api/platform/site/settings");
export const saveSiteSettings = (body) => req("/api/platform/site/settings", json("PUT", body));
export const listSitePages = () => req("/api/platform/site/pages");
export const getSitePage = (id) => req(`/api/platform/site/pages/${id}`);
export const createSitePage = (body) => req("/api/platform/site/pages", json("POST", body));
export const updateSitePage = (id, body) => req(`/api/platform/site/pages/${id}`, json("PUT", body));
export const duplicateSitePage = (id) => req(`/api/platform/site/pages/${id}/duplicate`, json("POST"));
export const deleteSitePage = (id) => req(`/api/platform/site/pages/${id}`, json("DELETE"));
export const sitePreviewLink = (id) => req(`/api/platform/site/pages/${id}/preview-link`);
export const listLeads = (status) => req(`/api/platform/site/leads${status ? `?status=${encodeURIComponent(status)}` : ""}`);
export const updateLead = (id, body) => req(`/api/platform/site/leads/${id}`, json("PATCH", body));
/** An image for the website — logo, hero, team photo. Returns { url, width, height, … }. */
export const uploadSiteImage = (blob) =>
  req("/api/platform/site/upload", { method: "POST", body: blob, headers: { "content-type": blob.type || "application/octet-stream" } });
