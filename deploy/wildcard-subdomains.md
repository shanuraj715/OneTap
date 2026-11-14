# Store addresses on a subdomain — one-time server setup

A store without an own domain opens on `acme.<base domain>` (for example `acme.tablepe.in`).
The storefront already finds a store from the address it was opened on, so **one storefront
serves every store**. You do the three steps below **once**; after that, creating, renaming and
removing a store's address happens only in the platform console (Stores → a store → Domains) and
needs no nginx edit, no certificate and no restart.

Replace `BASE` with your base domain (e.g. `tablepe.in`). Use a domain separate from your
marketing site and dashboard, and one where each store is a single label below it
(`acme.BASE`, not `acme.stores.BASE`) — a wildcard certificate covers one level only.

## 1. DNS — one wildcard record

At your DNS provider (Cloudflare), for the `BASE` zone:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| A | `*` | your server's IP | DNS only |

(Keep `BASE` itself pointing wherever you want — e.g. your marketing site.)

## 2. One wildcard certificate

A wildcard certificate can only be issued by proving you control the DNS, so use certbot's DNS
plugin. With Cloudflare:

1. Cloudflare → My Profile → API Tokens → Create Token → *Edit zone DNS*, limited to the `BASE` zone.
2. On the server:

```bash
apt install python3-certbot-dns-cloudflare
mkdir -p /root/.secrets && chmod 700 /root/.secrets
printf 'dns_cloudflare_api_token = PASTE_TOKEN_HERE\n' > /root/.secrets/cloudflare.ini
chmod 600 /root/.secrets/cloudflare.ini

certbot certonly --dns-cloudflare \
  --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  -d BASE -d '*.BASE' \
  --deploy-hook 'systemctl reload nginx'
```

It renews itself with the server's existing certbot timer (check with `certbot renew --dry-run`).
This server hosts other sites: only this certificate is new, nothing existing is touched.

## 3. One nginx block for every store

Create `/etc/nginx/sites-available/stores.BASE`, link it into `sites-enabled`, then
`nginx -t && systemctl reload nginx`. Copy the `location /` proxy settings from the storefront's
existing server block (`food.shanuthewebdev.in`) if they differ from the ones below — the
storefront is the same app on the same port (3070).

```nginx
server {
    listen 80;
    server_name *.BASE;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name *.BASE;

    ssl_certificate     /etc/letsencrypt/live/BASE/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/BASE/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

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

Other sites on the box are unaffected: nginx prefers an exact `server_name` (such as
`api.food.shanuthewebdev.in`) over a wildcard.

## 4. Tell the platform, then check

1. Platform console → **Settings → Store addresses** → enter `BASE` → Save.
2. Click **Check the server setup**. It tries a made-up address under `BASE` and reports DNS,
   certificate and storefront separately, so a mistake in any step is named.
3. Open a store → **Domains** → **TablePe address** → Create address. It opens within seconds.

## Own domains (higher plans)

A store's own domain (`dominos.com`) still needs the restaurant's DNS to point at the server and a
certificate for it (`certbot --nginx -d dominos.com -d www.dominos.com`) plus a server block —
that is a per-store step. It is only available to stores whose plan includes **Own domain name**
(Plans → Edit → Features, or unlocked per store on its Features tab).
