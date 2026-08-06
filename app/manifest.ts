import type { MetadataRoute } from "next";
import { plate } from "@/lib/design/tokens";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BTTR Fit",
    short_name: "BTTR Fit",
    description:
      "A habit tracker for body recomposition. Six daily metrics, three sentinel lifts, eight week blocks.",
    // Installed, the app opens on the check-in rather than the marketing route,
    // which is the whole point of it being on the home screen.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the root layout's themeColor so the splash screen and the browser
    // chrome are the same near-black as the app itself.
    background_color: plate.black,
    theme_color: plate.black,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
