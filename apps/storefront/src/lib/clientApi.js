"use client";

/**
 * The one fetch wrapper every client component talks to the API through.
 *
 * Extracted out of Ordering.jsx rather than left inline: the moment "Your
 * order" became a separate page instead of a step inside Ordering, a second
 * copy of this would have started drifting from the first — a stale cookie
 * flag, a forgotten `credentials: "include"`, the two would disagree exactly
 * where it's hardest to notice.
 */
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";

export async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Something went wrong (${res.status})`);
  return json;
}

/** Same as `api`, but for PATCH — used by the profile-completion step. */
export async function apiPatch(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Something went wrong (${res.status})`);
  return json;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Could not load the payment script"));
    document.body.appendChild(el);
  });
}

/** Runs the chosen gateway's checkout for an already-created order. */
export async function payOnline(outletId, orderId, gateway) {
  const intent = await api("/api/payments/intent", { outletId, orderId });
  const cp = intent.clientParams;

  if (gateway === "mock") {
    await api("/api/payments/verify", {
      outletId,
      paymentId: intent.paymentId,
      payload: { payment_id: String(cp.payment_id), signature: String(cp.signature) },
    });
    return;
  }

  if (gateway === "razorpay") {
    await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!window.Razorpay) throw new Error("Could not load the payment window");

    await new Promise((resolve, reject) => {
      const rzp = new window.Razorpay({
        ...cp,
        name: "Order payment",
        handler: (res) => {
          api("/api/payments/verify", { outletId, paymentId: intent.paymentId, payload: res })
            .then(() => resolve())
            .catch(reject);
        },
        modal: { ondismiss: () => reject(new Error("Payment was cancelled")) },
      });
      rzp.open();
    });
    return;
  }

  throw new Error(`${gateway} checkout isn't wired up yet`);
}
