import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/data/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // sw.js has to be reachable signed out, or registration follows a redirect to
  // /login and the browser refuses to install an HTML document as a worker.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|manifest.webmanifest).*)"],
};
