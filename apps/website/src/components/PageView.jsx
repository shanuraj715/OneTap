import { jsonLdFor, ldJson } from "@/lib/seo";
import { Sections } from "./Sections";

/** One page: its sections, plus the structured data Google reads for it. */
export function PageView({ page, settings }) {
  const ld = jsonLdFor(page, settings);
  return (
    <main id="main">
      <Sections page={page} settings={settings} />
      {ld.map((block, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(block) }} />
      ))}
    </main>
  );
}
