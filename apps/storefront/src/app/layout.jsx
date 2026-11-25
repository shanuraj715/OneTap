import "@rasoipulse/ui/tokens.css";
import "./globals.css";
import { RouterLinks } from "@/components/RouterLinks";
                                     
                                       

export const metadata           = {
  title: "Rasoi Pulse",
  description: "Multi-tenant restaurant platform",
};

export default function RootLayout({ children }                         ) {
  return (
    <html lang="en">
      <body>
        <RouterLinks>{children}</RouterLinks>
      </body>
    </html>
  );
}
