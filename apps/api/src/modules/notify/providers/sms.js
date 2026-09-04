                                                                                        

/** Fill `{{var}}` placeholders. `encode` is true for a URL, false for a body. */
function fill(template        , vars                        , encode         )         {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key        ) => {
    const v = vars[key];
    if (v === undefined) return m;
    return encode ? encodeURIComponent(v) : v;
  });
}

/**
 * A deliberately generic HTTP SMS sender. Indian SMS gateways (MSG91,
 * Fast2SMS, Textlocal, an in-house DLT-registered gateway…) each want the
 * request shaped differently, so rather than one hard-coded integration the
 * outlet supplies its own request URL and body with `{{apiKey}}`, `{{to}}`,
 * `{{message}}` and `{{senderId}}` placeholders — substituted right before
 * sending. This works with essentially any of them.
 */
export const smsProvider                 = {
  id: "sms",
  requiredFields: ["requestUrl", "apiKey"],

  async send(creds                   , input           )                      {
    if (!creds.requestUrl) return { ok: false, reason: "No SMS request URL is configured" };
    if (!input.message) return { ok: false, reason: "No SMS template is set for this order status" };

    const vars = {
      apiKey: creds.apiKey ?? "",
      to: input.to,
      message: input.message,
      senderId: creds.senderId ?? "",
    };
    const url = fill(creds.requestUrl, vars, true);
    const method = (creds.method || "GET").toUpperCase();

    let res          ;
    try {
      if (method === "POST") {
        const body = creds.bodyTemplate ? fill(creds.bodyTemplate, vars, false) : undefined;
        res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body });
      } else {
        res = await fetch(url, { method: "GET" });
      }
    } catch (e) {
      return { ok: false, reason: (e         ).message || "Could not reach the SMS gateway" };
    }

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return { ok: false, reason: `SMS gateway returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
    }
    return { ok: true, providerMessageId: text.slice(0, 120) || undefined };
  },
};
