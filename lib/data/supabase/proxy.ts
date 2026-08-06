import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import type { Database } from "./database.types";

// `/offline` is the service worker's fallback page: it renders no user data, and
// redirecting it to /login would mean caching a redirect instead of the shell.
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/offline"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = supabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && pathname.startsWith("/api/")) {
    // A client asking for JSON or CSV must be told it is signed out, not handed
    // the login page's HTML with a 200 on it.
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return redirectPreservingCookies(redirectUrl, response);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return redirectPreservingCookies(redirectUrl, response);
  }

  return response;
}

/**
 * getUser() may have rotated the session cookies onto `response`. Returning a
 * fresh redirect would drop those Set-Cookie headers and sign the user out on
 * the very next request, so they are carried over.
 */
function redirectPreservingCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
