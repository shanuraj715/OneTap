import { cookies } from "next/headers";

/** The cookie the API sets when a diner verifies their phone (see CUSTOMER_COOKIE in the API's customer routes). */
const CUSTOMER_COOKIE = "onetap_customer";

/**
 * The visitor's own sign-in, as headers for a server-side call to the API. A page is built on the server, so the
 * API only knows who is looking if their cookie is passed along — without it everyone is a stranger, and a diner
 * already seated at a table is told "another party is seated here".
 */
export async function visitorHeaders() {
  const jar = await cookies();
  const token = jar.get(CUSTOMER_COOKIE)?.value;
  return token ? { cookie: `${CUSTOMER_COOKIE}=${token}` } : {};
}
