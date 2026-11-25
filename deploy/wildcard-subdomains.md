# Store addresses on a subdomain — rasoipulse.in

A store without an own domain opens on `acme.rasoipulse.in`. The storefront already finds a store
from the address it was opened on, so **one storefront serves every store**. You do the steps
below **once**; after that, creating, renaming and removing a store's address happens only in the
platform console (Stores → a store → Domains) and needs no nginx edit, no certificate and no
restart.

The domain stores live under is a **server setting**, `STORE_SUBDOMAIN_BASE` in the API's `.env`:

| Where | Value | A store named acme opens on |
|-------|-------|-----------------------------|
| Production | `STORE_SUBDOMAIN_BASE=rasoipulse.in` | `https://acme.rasoipulse.in` |
| Your machine | `STORE_SUBDOMAIN_BASE=localhost:3070` | `http://acme.localhost:3070` |

It is a setting rather than something saved in the database because local development and
production share one database: each needs its own base.

## Running it locally (nothing to install)

1. Put `STORE_SUBDOMAIN_BASE=localhost:3070` in `apps/api/.env` and restart the API.
2. Platform console → Stores → a store → **Domains** → create an address, e.g. `acme`.
3. Open `http://acme.localhost:3070`. Browsers open any `*.localhost` on your own machine, so
   there is no DNS or certificate involved. The "Check again" button just asks the local storefront.

## Production — three one-time steps on the server

`rasoipulse.in` can keep hosting your marketing site, dashboard and API as well: names such as `www`,
`admin`, `api`, `app` and `mail` are reserved and can never be given to a store, and an exact DNS
record or nginx `server_name` always wins over the wildcard. (Login cookies belong to one exact
address, so a store can't read the dashboard's session.)

### 1. DNS — one wildcard record

`rasoipulse.in` is already on Cloudflare, and random names under it (`acme.rasoipulse.in`, …) already
resolve to Cloudflare — so a wildcard `*` record exists. Open Cloudflare → DNS and check that it
points at **your server's IP** (the same server that runs the storefront). If there is none, add:

| Type | Name | Content |
|------|------|---------|
| A | `*` | your server's IP |

Keep your existing records (`@`, `www`, `admin`, `api`, …) as they are. Whether the orange
cloud (proxied) is on decides which way to get the certificate in step 2.

### 2. The certificate — pick one

**A. Proxied by Cloudflare (orange cloud) — simplest, nothing to renew.** Cloudflare itself covers
`rasoipulse.in` and `*.rasoipulse.in` for visitors (Universal SSL), so you only need a certificate that
Cloudflare trusts on the way to your server:

1. Cloudflare → SSL/TLS → Overview → set the mode to **Full (strict)**.
2. SSL/TLS → Origin Server → **Create Certificate** → hostnames `rasoipulse.in` and `*.rasoipulse.in`,
   15 years. Save the two pieces on the server as `/etc/ssl/cloudflare/rasoipulse.in.pem` and
   `/etc/ssl/cloudflare/rasoipulse.in.key` (`chmod 600` the key).
3. Because every visitor now arrives via Cloudflare, nginx must be told to read their real address
   from Cloudflare's header (otherwise per-visitor limits see only Cloudflare). In the nginx block
   below add `real_ip_header CF-Connecting-IP;` and one `set_real_ip_from <range>;` line for each
   range on <https://www.cloudflare.com/ips/> (the list changes occasionally).

**B. Not proxied (grey cloud) — a Let's Encrypt wildcard.** A wildcard certificate can only be
issued by proving you control the DNS, so use certbot's DNS plugin with Cloudflare:

1. Cloudflare → My Profile → API Tokens → Create Token → *Edit zone DNS*, limited to the
   `rasoipulse.in` zone.
2. On the server:

```bash
apt install python3-certbot-dns-cloudflare
mkdir -p /root/.secrets && chmod 700 /root/.secrets
printf 'dns_cloudflare_api_token = PASTE_TOKEN_HERE\n' > /root/.secrets/cloudflare.ini
chmod 600 /root/.secrets/cloudflare.ini

certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d rasoipulse.in -d '*.rasoipulse.in' \
  --deploy-hook 'systemctl reload nginx'
```

It renews itself with the server's existing certbot timer (check with `certbot renew --dry-run`).
This server hosts other sites: only this certificate is new, nothing existing is touched.

### 3. One nginx block for every store

Create `/etc/nginx/sites-available/stores.rasoipulse.in`, link it into `sites-enabled`, then
`nginx -t && systemctl reload nginx`. Copy the `location /` proxy settings from the storefront's
existing server block (`food.shanuthewebdev.in`) if they differ from the ones below — the
storefront is the same app on the same port (3070). Use the certificate paths of the option you
chose in step 2.

```nginx
server {
    listen 80;
    server_name *.rasoipulse.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name *.rasoipulse.in;

    # A (Cloudflare Origin certificate):
    ssl_certificate     /etc/ssl/cloudflare/rasoipulse.in.pem;
    ssl_certificate_key /etc/ssl/cloudflare/rasoipulse.in.key;
    # B (Let's Encrypt) instead:
    #   ssl_certificate     /etc/letsencrypt/live/rasoipulse.in/fullchain.pem;
    #   ssl_certificate_key /etc/letsencrypt/live/rasoipulse.in/privkey.pem;
    #   include /etc/letsencrypt/options-ssl-nginx.conf;
    #   ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # A only — see step 2.3:
    # real_ip_header CF-Connecting-IP;
    # set_real_ip_from <each range from https://www.cloudflare.com/ips/>;

    location / {
        proxy_pass http://127.0.0.1:3070;
        proxy_http_version 1.1;
        proxy_set_header Host $host;                              # the storefront reads this to find the store
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

If `rasoipulse.in` and `www.rasoipulse.in` (marketing site) or `admin.` / `api.` already have their own
server blocks, leave them: nginx prefers an exact `server_name` over `*.rasoipulse.in`.

### 4. Tell the API, then check

1. In the API's production `.env`: `STORE_SUBDOMAIN_BASE=rasoipulse.in`, then restart the API
   (`pm2 restart food-api`).
2. Platform console → **Settings → Store addresses** → **Check the server setup**. It tries a
   made-up address under `rasoipulse.in` and reports DNS, certificate and storefront separately, so a
   mistake in any step is named. Behind Cloudflare, a 521 / 525 / 526 is explained in plain words
   (server down / no certificate on the server / certificate Cloudflare doesn't accept).
3. Open a store → **Domains** → **Rasoi Pulse address** → Create address. It opens within seconds.

## Own domains (higher plans)

A store's own domain (`dominos.com`) still needs the restaurant's DNS to point at the server and a
certificate for it (`certbot --nginx -d dominos.com -d www.dominos.com`) plus a server block —
that is a per-store step. It is only available to stores whose plan includes **Own domain name**
(Plans → Edit → Features, or unlocked per store on its Features tab).
