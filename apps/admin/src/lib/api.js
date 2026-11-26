             
                 
                 
          
               
          
                 
               
              
                
        
              
         
              
       
               
              
              
             
               
           
                
                  
                     
               
           
       
              
                               

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3072";

                         
              
                  
               
               
                      
                            
                       
 

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    /** extra facts the API sent with the error, such as `{ code: "store_disabled" }` */
    this.details = details;
  }
}

/** True when the API turned someone away because Rasoi Pulse has switched their whole store off. */
export const isStoreDisabledError = (error) => error instanceof ApiError && error.status === 403 && error.details?.code === "store_disabled";

;                                                       
                                   
                                                                              
                    
 

async function req   (path        , init          = {})             {
  const headers                         = { "content-type": "application/json", ...init.headers };
  if (init.outletId) headers["x-rasoipulse-outlet"] = init.outletId;
  if (init.brandId) headers["x-rasoipulse-brand"] = init.brandId;

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

/** Is this network blocked from signing in right now? (asked before the form is drawn) */
export const loginGuard = () => req("/api/auth/guard");

export const me = () => req                       ("/api/auth/me");

/* --------------------------------------------------------------------- users */

                            
             
                
               
                    
                             
                    
                      
 

// brandId is only ever needed for a superadmin — everyone else's session
// already carries their one brandId server-side, and requireBrandContext
// falls back to it when no x-rasoipulse-brand header is sent.
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

/* ------------------------------------------------------------------ AI pictures (super admin) */

export const getPlatformAi = () => req("/api/platform/ai");
export const savePlatformAiModel = (model) => req("/api/platform/ai", json("PUT", { model }));
/** { label?, apiKey } */
export const addPlatformAiKey = (payload) => req("/api/platform/ai/keys", json("POST", payload));
/** { id, label?, enabled? } */
export const updatePlatformAiKey = ({ id, ...patch }) => req(`/api/platform/ai/keys/${id}`, json("PATCH", patch));
export const removePlatformAiKey = (id) => req(`/api/platform/ai/keys/${id}`, json("DELETE"));
export const testPlatformAiKey = (id) => req(`/api/platform/ai/keys/${id}/test`, json("POST"));

/** Make pictures of a dish with AI and add them to it. body: { aspectRatio, count, prompt? } — super admin only. */
export const generateItemImages = (o, id, body) =>
  req(`/api/menu/items/${id}/generate-images`, { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const resetPlatformStorage = () => req("/api/platform/storage", json("DELETE"));

/** Try a storage: with { provider, values } the typed-in details (nothing is saved or switched on); with nothing, the saved one. */
export const testPlatformStorage = (body) => req("/api/platform/storage/test", json("POST", body ?? {}));
export const getStorageUsage = () => req("/api/platform/storage/usage");
export const scanStorageUsage = () => req("/api/platform/storage/usage/scan", json("POST"));
export const getStorageMove = () => req("/api/platform/storage/move");
export const previewStorageMove = (body) => req("/api/platform/storage/move/preview", json("POST", body));
export const startStorageMove = (body) => req("/api/platform/storage/move", json("POST", body));
export const cancelStorageMove = (id) => req(`/api/platform/storage/move/${id}/cancel`, json("POST"));
export const getOptimizeScan = () => req("/api/platform/storage/optimize/scan");
export const scanForOptimizing = () => req("/api/platform/storage/optimize/scan", json("POST"));
export const getStorageOptimize = () => req("/api/platform/storage/optimize");
export const startStorageOptimize = (body) => req("/api/platform/storage/optimize", json("POST", body));
export const cancelStorageOptimize = (id) => req(`/api/platform/storage/optimize/${id}/cancel`, json("POST"));

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

/** Create several categories at once (`names` already split on commas). */
export const createCategories = (o        , body                                                                    ) =>
  req("/api/menu/categories/bulk", { method: "POST", body: JSON.stringify(body), outletId: o._id });

/** Delete several categories (and the ones inside them) at once; `deleteItems` also deletes the dishes in them. */
export const deleteCategories = (o        , body                                           ) =>
  req("/api/menu/categories/bulk-delete", { method: "POST", body: JSON.stringify(body), outletId: o._id });

/** Drag-and-drop: move a category inside another (or the top level), before a sibling (or at the end). */
export const moveCategory = (o        , body                                                           ) =>
  req("/api/menu/categories/move", { method: "POST", body: JSON.stringify(body), outletId: o._id });

/** Put one level of categories in a new order. */
export const reorderCategories = (o        , ids          ) =>
  req("/api/menu/categories/order", { method: "POST", body: JSON.stringify({ ids }), outletId: o._id });

/** Delete several items at once. */
export const deleteItems = (o        , ids          ) =>
  req("/api/menu/items/bulk-delete", { method: "POST", body: JSON.stringify({ ids }), outletId: o._id });

export const createItem = (o        , body                                                  ) =>
  req                    ("/api/menu/items", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateItem = (o        , id        , body           ) =>
  req                    (`/api/menu/items/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const deleteItem = (o        , id        ) =>
  req      (`/api/menu/items/${id}`, { method: "DELETE", outletId: o._id });

export const createModifierGroup = (o        , body                               ) =>
  req                          ("/api/menu/modifier-groups", { method: "POST", body: JSON.stringify(body), outletId: o._id });

export const updateModifierGroup = (o, id, body) =>
  req(`/api/menu/modifier-groups/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

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
export const setOrderStatusManual = (o        , id        , status             , reason         , tableId         ) =>
  req                       (`/api/orders/${id}/status/manual`, {
    method: "PATCH",
    // `tableId`: only when the order's table has another party by now — the free table to seat this order's party at instead
    body: JSON.stringify({ status, reason, ...(tableId ? { tableId } : {}) }),
    outletId: o._id,
  });

                            
                                                                                                                   
                
                        
                         
 

export const editOrder = (o        , id        , body           ) =>
  req                       (`/api/orders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    outletId: o._id,
  });

/** Delete an order from the Orders page (owner / manager). */
export const deleteOrder = (o        , id        ) =>
  req                       (`/api/orders/${id}`, { method: "DELETE", outletId: o._id });

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

/* ------------------------------------------------------------ kitchen display */

export const listKitchenOrders = (o, screen = "all") => req(`/api/kitchen/orders?screen=${encodeURIComponent(screen)}`, { outletId: o._id });

export const setKitchenStage = (o, id, screen, stage) =>
  req(`/api/kitchen/orders/${id}/stage`, { method: "POST", body: JSON.stringify({ screen, stage }), outletId: o._id });

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

/** How each kind of message is sent (today: verification codes), and whether each way can send right now. */
export const getMessaging = (o        ) => req                                     ("/api/notify/messaging", { outletId: o._id });

export const saveMessaging = (o        , body         ) =>
  req                                     ("/api/notify/messaging", { method: "PUT", body: JSON.stringify(body), outletId: o._id });

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
export const renameStore = (id, name) => req(`/api/platform/stores/${id}`, json("PATCH", { name }));
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

/* ---------------------------------------------------- Rasoi Pulse website (platform) */

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

/* ------------------------------------------------------------------ whatsapp */
// Chat with customers over the store's own linked WhatsApp numbers. `o` is the current outlet (the API works out the store).
const wa = (o, path, init = {}) => req(`/api/whatsapp${path}`, { ...init, outletId: o._id });
const waJson = (method, body) => ({ method, body: JSON.stringify(body ?? {}) });
export const waMe = (o) => wa(o, "/me");
export const waAccounts = (o) => wa(o, "/accounts");
export const waAccount = (o, id) => wa(o, `/accounts/${id}`);
export const waCreateAccount = (o, label, color) => wa(o, "/accounts", waJson("POST", { label, ...(color ? { color } : {}) }));
export const waRenameAccount = (o, id, label) => wa(o, `/accounts/${id}`, waJson("PATCH", { label }));
export const waUpdateAccount = (o, id, body) => wa(o, `/accounts/${id}`, waJson("PATCH", body));
export const waStats = (o) => wa(o, "/stats");
export const waDistributePreview = (o, body) => wa(o, "/distribute/preview", waJson("POST", body));
export const waDistribute = (o, body) => wa(o, "/distribute", waJson("POST", body));
export const waCleanupPreview = (o, body) => wa(o, "/cleanup/preview", waJson("POST", body));
export const waCleanup = (o, body) => wa(o, "/cleanup", waJson("POST", body));
export const waRelinkAccount = (o, id) => wa(o, `/accounts/${id}/relink`, waJson("POST"));
export const waUnlinkAccount = (o, id) => wa(o, `/accounts/${id}/unlink`, waJson("POST"));
export const waRemoveAccount = (o, id) => wa(o, `/accounts/${id}`, { method: "DELETE" });
export const waChats = (o, { q = "", view = "all", account = "" } = {}) =>
  wa(o, `/chats?q=${encodeURIComponent(q)}&view=${encodeURIComponent(view)}&account=${encodeURIComponent(account)}`);
export const waChat = (o, id) => wa(o, `/chats/${id}`);
export const waStartChat = (o, body) => wa(o, "/chats", waJson("POST", body));
export const waUpdateChat = (o, id, body) => wa(o, `/chats/${id}`, waJson("PATCH", body));
export const waDeleteChat = (o, id) => wa(o, `/chats/${id}`, { method: "DELETE" });
export const waClearChat = (o, id) => wa(o, `/chats/${id}/clear`, waJson("POST"));
export const waMarkRead = (o, id) => wa(o, `/chats/${id}/read`, waJson("POST"));
export const waMessages = (o, id) => wa(o, `/chats/${id}/messages`);
export const waSend = (o, id, body) => wa(o, `/chats/${id}/messages`, waJson("POST", body));
export const waRetry = (o, chatId, id) => wa(o, `/chats/${chatId}/messages/${id}/retry`, waJson("POST"));
export const waDeleteMessage = (o, chatId, id, everyone = false) => wa(o, `/chats/${chatId}/messages/${id}${everyone ? "?everyone=1" : ""}`, { method: "DELETE" });
export const waUpload = (o, file) =>
  wa(o, `/media?name=${encodeURIComponent(file.name || "file")}`, { method: "POST", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
export const waBroadcasts = (o) => wa(o, "/broadcasts");
export const waCreateBroadcast = (o, body) => wa(o, "/broadcasts", waJson("POST", body));
export const waCancelBroadcast = (o, id) => wa(o, `/broadcasts/${id}/cancel`, waJson("POST"));
export const waGetAccess = (o) => wa(o, "/access");
export const waSetAccess = (o, access) => wa(o, "/access", waJson("PUT", { access }));

/* ----------------------------------------------------------------- security */
export const getSecurityBlocks = () => req("/api/platform/security/blocks");
export const unblockAddress = (id) => req(`/api/platform/security/blocks/${id}`, { method: "DELETE" });
export const unblockAllAddresses = () => req("/api/platform/security/blocks", { method: "DELETE" });
/* --------------------------------------------------------------- marketing */
const mk = (o, path, init = {}) => req(`/api/marketing${path}`, { ...init, outletId: o._id });
const mkJson = (method, body) => ({ method, body: JSON.stringify(body ?? {}) });
export const mkChannels = (o) => mk(o, "/channels");
export const mkOptions = (o, outletIds = []) => mk(o, `/options?outletIds=${encodeURIComponent(outletIds.join(","))}`);
export const mkPreview = (o, audience) => mk(o, "/audience/preview", mkJson("POST", { audience }));
export const mkParse = (o, text) => mk(o, "/contacts/parse", mkJson("POST", { text }));
export const mkLists = (o) => mk(o, "/lists");
export const mkList = (o, id) => mk(o, `/lists/${id}`);
export const mkCreateList = (o, body) => mk(o, "/lists", mkJson("POST", body));
export const mkAddToList = (o, id, text) => mk(o, `/lists/${id}/contacts`, mkJson("POST", { text }));
export const mkRemoveContact = (o, id, contactId) => mk(o, `/lists/${id}/contacts/${contactId}`, { method: "DELETE" });
export const mkDeleteList = (o, id) => mk(o, `/lists/${id}`, { method: "DELETE" });
export const mkCampaigns = (o) => mk(o, "/campaigns");
export const mkCampaign = (o, id) => mk(o, `/campaigns/${id}`);
export const mkCreateCampaign = (o, body) => mk(o, "/campaigns", mkJson("POST", body));
export const mkCancelCampaign = (o, id) => mk(o, `/campaigns/${id}/cancel`, mkJson("POST"));

/* ---------------------------------------------------------------- analytics */
const anQuery = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, Array.isArray(v) ? v.join(",") : String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};
export const an = (o, kind, params) => req(`/api/analytics/${kind}${anQuery(params)}`, { outletId: o._id });
export const anSaveProfile = (o, data) => req("/api/analytics/profile", { method: "PUT", body: JSON.stringify({ data }), outletId: o._id });
/** Ask for a report file; resolves to { blob, filename } so the browser can save it. */
export async function anExport(o, body) {
  const res = await fetch(`${API_BASE}/api/analytics/export`, { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-rasoipulse-outlet": o._id }, body: JSON.stringify(body) });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new ApiError(res.status, j.error ?? `The report could not be made (${res.status})`, j.details);
  }
  const name = /filename="?([^"]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "rasoipulse-report";
  return { blob: await res.blob(), filename: name };
}

/* --------------------------------------------------------------- client onboarding */
// The requirement forms a Rasoi Pulse representative fills with a new client, and publishing one as a store (platform console).
export const listOnboarding = (status) => req(`/api/platform/onboarding${status ? `?status=${encodeURIComponent(status)}` : ""}`);
export const getOnboarding = (id) => req(`/api/platform/onboarding/${id}`);
export const createOnboarding = (data) => req("/api/platform/onboarding", json("POST", { data }));
export const saveOnboarding = (id, data) => req(`/api/platform/onboarding/${id}`, json("PUT", { data }));
export const deleteOnboarding = (id) => req(`/api/platform/onboarding/${id}`, { method: "DELETE" });
export const checkOnboarding = (id) => req(`/api/platform/onboarding/${id}/check`);
export const publishOnboarding = (id, ownerPassword) => req(`/api/platform/onboarding/${id}/publish`, json("POST", { ownerPassword }));
/** The price list the onboarding estimate uses. */
export const getOnboardingPricing = () => req("/api/platform/onboarding/pricing");
export const saveOnboardingPricing = (pricing) => req("/api/platform/onboarding/pricing", { method: "PUT", body: JSON.stringify(pricing) });
export const resolveMapLink = (link) => req("/api/platform/onboarding/resolve-map", json("POST", { link }));
/** The form as a PDF: `{ blob, filename }`. */
export async function onboardingPdf(id) {
  const res = await fetch(`${API_BASE}/api/platform/onboarding/${id}/pdf`, { credentials: "include" });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new ApiError(res.status, j.error ?? `The PDF could not be made (${res.status})`, j.details);
  }
  const name = /filename="?([^"]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "onboarding.pdf";
  return { blob: await res.blob(), filename: name };
}

/* ------------------------------------------------------------- riders, bookings, ratings, cart reminders */

/** Hand a delivery order to a rider (from the list, or a name + phone typed in) — `sendOut` also marks it Out for delivery. */
export const assignRider = (o, id, body) => req(`/api/orders/${id}/rider`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const listRiders = (o) => req("/api/riders", { outletId: o._id });
export const createRider = (o, body) => req("/api/riders", { method: "POST", body: JSON.stringify(body), outletId: o._id });
export const updateRider = (o, id, body) => req(`/api/riders/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });
export const deleteRider = (o, id) => req(`/api/riders/${id}`, { method: "DELETE", outletId: o._id });

export const listReservations = (o, day) => req(`/api/reservations?day=${encodeURIComponent(day ?? "")}`, { outletId: o._id });
export const reservationSummary = (o) => req("/api/reservations/summary", { outletId: o._id });
export const reservationAvailability = (o, day, party) =>
  req(`/api/reservations/availability?outletId=${encodeURIComponent(o._id)}&day=${encodeURIComponent(day ?? "")}&party=${party ?? 2}`);
export const createStaffReservation = (o, body) => req("/api/reservations/staff", { method: "POST", body: JSON.stringify(body), outletId: o._id });
export const updateReservation = (o, id, body) => req(`/api/reservations/${id}`, { method: "PATCH", body: JSON.stringify(body), outletId: o._id });

export const listFeedback = (o, { days = 30, stars = [], withComment = false, before } = {}) => {
  const q = new URLSearchParams({ days: String(days) });
  if (stars.length) q.set("stars", stars.join(","));
  if (withComment) q.set("withComment", "1");
  if (before) q.set("before", new Date(before).toISOString());
  return req(`/api/feedback?${q}`, { outletId: o._id });
};

export const getCartReminders = (o) => req("/api/cart-reminders", { outletId: o._id });
export const saveCartReminders = (o, body) => req("/api/cart-reminders", { method: "PUT", body: JSON.stringify(body), outletId: o._id });
