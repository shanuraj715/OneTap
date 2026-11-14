/**
 * A small Markdown renderer for the website's Text sections (About, Privacy,
 * Terms…). Deliberately a subset — headings, paragraphs, lists, rules, bold,
 * italic, inline code and links — and safe by construction: every character
 * of the source is HTML-escaped FIRST, then only the tags below are added, and
 * links only to http(s), mailto:, tel:, site paths and #anchors. Whatever is
 * typed into the console, the output can't carry a script.
 *
 *   # Heading        → <h2>      (the page's own title is the <h1>)
 *   ## Sub-heading   → <h3>
 *   ### Minor        → <h4>
 *   - item / * item  → <ul><li>
 *   1. item          → <ol><li>
 *   ---              → <hr>
 *   **bold** *italic* `code` [text](/path)
 */

const escapeHtml = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const SAFE_HREF = /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i;

function inline(text) {
  let out = escapeHtml(text);
  // links first, so their text can still be bold/italic
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const raw = href.replace(/&amp;/g, "&");
    if (!SAFE_HREF.test(raw)) return label;
    const external = /^https?:\/\//i.test(raw);
    return `<a href="${href}"${external ? ' rel="noopener" target="_blank"' : ""}>${label}</a>`;
  });
  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
  return out;
}

/** A URL-safe id from heading text, so headings can be linked to (#data-we-collect). */
export const slugifyHeading = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export function renderMarkdown(src) {
  const lines = String(src ?? "").replace(/\r\n?/g, "\n").split("\n");
  const html = [];
  let para = [];
  let list = null; // { tag, items }

  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) html.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      flushList();
      const level = h[1].length + 1;
      html.push(`<h${level} id="${slugifyHeading(h[2])}">${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flushPara();
      flushList();
      html.push("<hr>");
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      if (list && list.tag !== tag) flushList();
      if (!list) list = { tag, items: [] };
      list.items.push((ul ?? ol)[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return html.join("\n");
}
