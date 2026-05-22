import "./globals.css";
import type { Metadata } from "next";
import { Inter, Montserrat, Source_Code_Pro } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-mont",
  display: "swap",
});
const scp = Source_Code_Pro({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-scp",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://lighthousemacro.github.io/pharos";
// trailing slash so a relative og image resolves under the /pharos basePath
const BASE = SITE_URL.endsWith("/") ? SITE_URL : SITE_URL + "/";
const TITLE = "Pharos: two prices on every macro market";
const DESCRIPTION =
  "Binary macro markets on Arc where the Lighthouse Macro framework posts a fair-value probability next to the crowd's. The spread is the product.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Pharos by Lighthouse Macro",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "og.png",
        width: 1200,
        height: 630,
        alt: "Pharos. Macro prediction markets priced by the Lighthouse Macro framework. Live on Arc testnet.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@LHMacro",
    creator: "@LHMacro",
    title: TITLE,
    description: DESCRIPTION,
    images: ["og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${montserrat.variable} ${scp.variable}`}>
      <body>
        <div className="accent-bar">
          <div className="o" />
          <div className="d" />
        </div>
        {children}
      </body>
    </html>
  );
}
