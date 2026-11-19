import { canonicalizeDeep, rewriteJsonText } from "../modules/storage/upload-urls.js";

/**
 * Keeps picture addresses out of the database and puts them back on the way out:
 *  - a request body: our own pictures lose their domain before anything validates or saves them;
 *  - a JSON response: they get this deployment's domain (publicApiUrl), so the browser can open them.
 * Mounted once, after the body parsers and before the routes.
 */
export function uploadUrls() {
  return (req, res, next) => {
    if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) canonicalizeDeep(req.body);

    const send = res.send.bind(res);
    res.send = (body) => {
      if (typeof body === "string" && body.includes("/uploads/") && /json/i.test(String(res.getHeader("Content-Type") ?? ""))) {
        return send(rewriteJsonText(body));
      }
      return send(body);
    };
    next();
  };
}
