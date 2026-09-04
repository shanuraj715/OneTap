import "@onetap/ui/tokens.css";
import "./globals.css";
                                     
                                       

export const metadata           = {
  title: "OneTap",
  description: "Multi-tenant restaurant platform",
};

export default function RootLayout({ children }                         ) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
