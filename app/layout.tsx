import type { Metadata, Viewport } from "next";
import { Archivo, Inter, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorker } from "@/components/service-worker";
import { ThemeProvider } from "@/components/theme-provider";
import { plate } from "@/lib/design/tokens";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "BTTR Fit",
  description:
    "A habit tracker for body recomposition. Six daily metrics, three sentinel lifts, eight week blocks.",
  applicationName: "BTTR Fit",
  appleWebApp: { capable: true, title: "BTTR Fit", statusBarStyle: "black" },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    // iOS ignores the manifest's icons entirely and reads this one.
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  // One colour, not a pair keyed on the OS preference: the app is dark whatever
  // the phone is set to, and the browser chrome has to match the page it frames.
  themeColor: plate.black,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      suppressHydrationWarning
      className={`${archivo.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ground text-text">
        <ThemeProvider>{children}</ThemeProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
