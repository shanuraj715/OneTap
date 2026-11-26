import { Linking } from "react-native";
import type { Delivery } from "@/api/schemas";

/**
 * Directions, calls and messages are handed to the apps already on the rider's phone, so there is no map service to pay for and no key:
 * a link to the phone's maps app (Google Maps, if it is there, otherwise the browser), a phone call, WhatsApp.
 */

/** Turn-by-turn directions to the customer's pin (the address in words when the pin is missing). */
export function directionsUrl(a: Pick<Delivery["address"], "lat" | "lng" | "text">): string {
  if (a.lat !== null && a.lng !== null) return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}&travelmode=two-wheeler`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.text)}`;
}
/** Any maps app: the phone's own "geo" link (used when the https link can't be opened). */
export const geoUrl = (a: Pick<Delivery["address"], "lat" | "lng" | "text">, label = "Delivery"): string =>
  a.lat !== null && a.lng !== null ? `geo:${a.lat},${a.lng}?q=${a.lat},${a.lng}(${encodeURIComponent(label)})` : `geo:0,0?q=${encodeURIComponent(a.text)}`;

/** The last 10 digits of a phone number ("+91 98765 43210" → "9876543210"); "" when there are fewer than 10. */
export const tenDigits = (phone: string): string => {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};
export const telUrl = (phone: string): string => `tel:${String(phone ?? "").replace(/[^\d+]/g, "")}`;
/** A WhatsApp chat with the customer (India's +91 is added to a 10-digit number); "" when there is no usable number. */
export const whatsappUrl = (phone: string, text = ""): string => {
  const ten = tenDigits(phone);
  return ten ? `https://wa.me/91${ten}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
};
/** What the rider can say with one tap. */
export const arrivedMessage = (name: string, orderNumber: string): string => `Hello${name ? ` ${name}` : ""}, I'm your delivery partner for order #${orderNumber}. I'm outside with your order.`;

/** Open a link in the app that handles it. → false when nothing on the phone could open it (the screen then says so). */
export async function openLink(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Directions: the maps link first, the phone's generic map link if that can't be opened. */
export async function openDirections(a: Pick<Delivery["address"], "lat" | "lng" | "text">, label?: string): Promise<boolean> {
  return (await openLink(directionsUrl(a))) || (await openLink(geoUrl(a, label)));
}
