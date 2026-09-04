             
                 
                 
          
               
          
                 
               
              
                
        
              
         
              
       
               
              
              
             
               
           
                
                  
                     
               
           
       
              
                               

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3072";

                         
              
                  
               
               
                      
                            
                       
 

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

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
    throw new ApiError(res.status, body.error ?? `API responded ${res.status}`);
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

export const listOutlets = () => req                                       ("/api/outlets");

export const listBrands = () => req                       ("/api/brands");

export const createBrand = (body        ) =>
  req      ("/api/brands", { method: "POST", body: JSON.stringify(body) });

export const createOutlet = (brandId        , body        ) =>
  req      ("/api/outlets", { method: "POST", body: JSON.stringify(body), brandId });

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

export const getStorageConfig = (o        ) =>
  req                ("/api/storage/config", { outletId: o._id });

/** payload: { provider?, values?, processing? } */
export const saveStorageConfig = (o        , payload        ) =>
  req                ("/api/storage/config", {
    method: "PUT",
    body: JSON.stringify(payload),
    outletId: o._id,
  });

export const resetStorageConfig = (o        ) =>
  req                ("/api/storage/config", { method: "DELETE", outletId: o._id });

export const testStorageConfig = (o        ) =>
  req                ("/api/storage/config/test", { method: "POST", body: "{}", outletId: o._id });

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
