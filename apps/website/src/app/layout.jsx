import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/Chrome";
import { Trail } from "@/components/Trail";
import { getPages, getSettings, siteUrl } from "@/lib/site";
import "./globals.css";

// Self-hosted by Next at build time — no request to Google from the visitor's browser.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["600", "700", "800"] });
const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export async function generateMetadata() {
  const settings = await getSettings();
  return {
    metadataBase: new URL(siteUrl(settings)),
    title: { default: settings.brandName, template: settings.seo.titleTemplate || `%s · ${settings.brandName}` },
    description: settings.seo.description || settings.tagline,
    applicationName: settings.brandName,
    ...(settings.faviconUrl ? { icons: { icon: settings.faviconUrl } } : {}),
    formatDetection: { telephone: false },
  };
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f0" },
    { media: "(prefers-color-scheme: dark)", color: "#12110f" },
  ],
};

export default async function RootLayout({ children }) {
  const [settings, pages] = await Promise.all([getSettings(), getPages()]);
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable}`}>
      <body style={{ "--brand": settings.brandColor }}>
        <SiteHeader settings={settings} pages={pages} />
        {children}
        <SiteFooter settings={settings} pages={pages} />
        <Trail />
      </body>
    </html>
  );
}
