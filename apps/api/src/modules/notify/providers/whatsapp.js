import { NOTIFY_VARIABLES } from "@onetap/config-schema";
                                                                                        

/** Digits only, with a country code — Meta rejects "+", spaces or dashes. */
function normalizePhone(raw        )         {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`; // bare Indian mobile number
  return digits;
}

/**
 * Meta's WhatsApp Business Cloud API. Every business-initiated message must
 * use a template Meta has pre-approved — free text isn't allowed — so this
 * fills the template's positional `{{1}}…{{5}}` placeholders in the fixed
 * order of {@link NOTIFY_VARIABLES}, which must match the order the template
 * was submitted for approval with.
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */
export const whatsappProvider                 = {
  id: "whatsapp",
  requiredFields: ["phoneNumberId", "accessToken"],

  async send(creds                   , input           )                      {
    if (!input.whatsapp?.templateName) {
      return { ok: false, reason: "No WhatsApp template is set for this order status" };
    }
    const apiVersion = creds.apiVersion || "v20.0";
    const url = `https://graph.facebook.com/${apiVersion}/${creds.phoneNumberId}/messages`;

    const body = {
      messaging_product: "whatsapp",
      to: normalizePhone(input.to),
      type: "template",
      template: {
        name: input.whatsapp.templateName,
        language: { code: input.whatsapp.languageCode || "en" },
        components: [
          {
            type: "body",
            parameters: NOTIFY_VARIABLES.map((key) => ({ type: "text", text: input.values[key] })),
          },
        ],
      },
    };

    let res          ;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${creds.accessToken}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, reason: (e         ).message || "Could not reach WhatsApp" };
    }

    const payload = (await res.json().catch(() => ({})))     
                                   
                                                            
     ;
    if (!res.ok || !payload.messages?.[0]?.id) {
      return { ok: false, reason: payload.error?.error_user_msg ?? payload.error?.message ?? `WhatsApp rejected the message (${res.status})` };
    }
    return { ok: true, providerMessageId: payload.messages[0].id };
  },
};
