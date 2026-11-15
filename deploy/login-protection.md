# Sign-in protection (brute-force guard)

Every sign-in — the dashboards (store team **and** the platform console) and a customer's one-time code on the
storefront — is protected against guessing:

1. **Flood limit** (`express-rate-limit`): at most `LOGIN_FLOOD_PER_MINUTE` (30) sign-in requests a minute per network
   address, right or wrong.
2. **Escalating block** (kept in MongoDB, shared by every API process, survives restarts): `LOGIN_MAX_FAILURES` (5)
   wrong passwords / codes within `LOGIN_FAILURE_WINDOW_SECONDS` (15 min) block that address for the first of
   `LOGIN_BLOCK_STEPS_SECONDS` (`300,900,3600,21600,86400` = 5 min → 15 min → 1 h → 6 h → 24 h). Each further block
   moves one step up and stays on the last; the climb is forgotten after `LOGIN_STRIKE_FORGET_SECONDS` (24 h) without
   another block.
3. A blocked address is shown a **"Sign-in is paused" notice with a countdown instead of the sign-in form**
   (dashboard login and storefront code form), and even the right password / code is refused until the block ends.
4. Dashboards and customer codes have **separate counters**, so one can't lock out the other.
5. A wrong guess that is not a guess does not count: a paused account (right password) and "enter your name" errors.

Platform console → **Security** lists every blocked or watched address (with how many times it has been blocked) and
has **Unblock** / **Unblock everyone**. `LOGIN_GUARD=off` switches the whole thing off (handy on a laptop, where every
visitor is 127.0.0.1 and one typo streak blocks you for 5 minutes).

## The address the guard sees — nginx must pass the real visitor address

The guard reads the visitor's address from the chain `X-Forwarded-For` + the connection, **from the right, skipping
our own machines** (loopback and private ranges); the first outside address is the visitor. For that to be the real
visitor:

* nginx must **append** to the header (not replace it, not drop it):
  `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
* behind **Cloudflare**, nginx must first turn Cloudflare's address into the visitor's, or every visitor looks like
  Cloudflare and one attacker blocks everyone:
  ```
  real_ip_header CF-Connecting-IP;
  set_real_ip_from <each range from https://www.cloudflare.com/ips/>;
  ```
  (see `wildcard-subdomains.md`, which already asks for this).
* customers reach the API through the storefront's own `/api` pass-through; that hop is on our own network, so it is
  skipped automatically.

Check after deploying: sign in wrongly from your phone (mobile data) `LOGIN_MAX_FAILURES` times — the Security page
should list **your phone's public address**, not `127.0.0.1` or a Cloudflare address. If it lists a Cloudflare address,
the `real_ip` lines are missing.

## If the owner is locked out

Wait for the countdown, sign in from another network, or — from any address that is not blocked — open the platform
console → Security → Unblock. Last resort (server shell): `db.loginguards.deleteMany({})`.

Development note: a laptop API and a server API that share one database also share these blocks.
