import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import type { Database } from "./database.types";

// `/offline` is the service worker's fallback page: it renders no user data, and
// redirecting it to /login would mean caching a redirect instead of the shell.
const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/offline", "/forgot-password"];

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
    // the login page's HTML with a 200 on it. The cookies come too: rejecting a
    // stale session writes its removal onto `response`, and dropping that leaves
    // the browser retrying the same dead token forever.
    return withCookies(NextResponse.json({ error: "Not signed in" }, { status: 401 }), response);
  }

  if (!user && !isPublic) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return redirectPreservingCookies(redirectUrl, response);
  }

  // /reset-password is deliberately absent from PUBLIC_PATHS and from this
  // redirect: the recovery link signs you in before you land there, so it needs
  // a session, and someone already signed in still has to be allowed to change
  // their password.
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
  return withCookies(NextResponse.redirect(url), response);
}

function withCookies(outgoing: NextResponse, response: NextResponse) {
  for (const cookie of response.cookies.getAll()) {
    outgoing.cookies.set(cookie);
  }
  return outgoing;
}
