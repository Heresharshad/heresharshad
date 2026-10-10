import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { WorldLayer } from "@/components/world/world-layer";
import { site } from "@/config/site";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

/** Technical annotations: coordinates, dimensions, indices. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.brand} | Portfolio 2026`, template: `%s | ${site.brand}` },
  description: site.description,
  openGraph: {
    title: `${site.brand} | Portfolio 2026`,
    description: "The site is still in the dark. Bring your own light.",
    url: site.url,
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' fill='%23060606'/%3E%3Ccircle cx='32' cy='32' r='14' fill='%23FFD9A0'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#060606",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${plexMono.variable}`}>
      <body>
        {/* the one WebGL world, shared by the homepage studio and the rooms behind its wall */}
        <WorldLayer />
        {children}
      </body>
    </html>
  );
}
