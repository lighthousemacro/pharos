import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pharos — macro prediction markets, priced by the framework",
  description:
    "Binary macro markets on Arc where the Lighthouse Macro framework posts a fair-value probability on every contract. The spread is the product.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
