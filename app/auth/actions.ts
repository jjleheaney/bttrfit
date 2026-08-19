"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/data/supabase/server";
import { safeNextPath } from "@/lib/auth/next-path";

export type AuthState = {
  error?: string;
  message?: string;
  values?: { email?: string; first_name?: string };
};

/**
 * Supabase error strings are provider-shaped ("email rate limit exceeded").
 * Errors here say what happened and what to do about it.
 */
function friendlyAuthError(
  message: string,
  fallback = "Something went wrong creating the account. Try again in a moment.",
): string {
  const text = message.toLowerCase();
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many emails have been sent from this project. Wait a few minutes and try again.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (text.includes("should be different")) {
    return "That is already your password. Pick a different one.";
  }
  if (text.includes("password")) {
    return "That password was rejected. Use at least 8 characters.";
  }
  if (text.includes("invalid") && text.includes("email")) {
    return "That email address is not valid.";
  }
  return fallback;
}

async function originUrl(path: string) {
  const headerList = await headers();
  // `||`, not `??`: .env.example ships the key with an empty value.
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
  return `${origin}${path}`;
}

export async function signInWithPassword(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!email || !password) {
    return { error: "Enter your email and password.", values: { email } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error: "That email and password did not match. Try again.",
      values: { email },
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function sendMagicLink(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const next = safeNextPath(String(formData.get("next") ?? "/"));

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: await originUrl(
        `/auth/confirm?next=${encodeURIComponent(next)}`,
      ),
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message), values: { email } };
  }

  return { message: `Link sent to ${email}. It expires in one hour.` };
}

export async function sendPasswordReset(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await originUrl("/auth/confirm?next=/reset-password"),
  });

  if (error) {
    return {
      error: friendlyAuthError(
        error.message,
        "Something went wrong sending the reset link. Try again in a moment.",
      ),
      values: { email },
    };
  }

  // Deliberately the same sentence whether or not the address has an account:
  // a different answer would let anyone test who has signed up.
  return {
    message: `If ${email} has an account, a reset link is on its way. It expires in one hour.`,
  };
}

export async function updatePassword(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) {
    return { error: "Passwords need at least 8 characters." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The recovery link is what signs you in, so no session means the link was
  // never followed, has expired, or has already been spent.
  if (!user) {
    return { error: "That reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return {
      error: friendlyAuthError(
        error.message,
        "Something went wrong saving the new password. Try again in a moment.",
      ),
    };
  }

  // A forgotten password is often a stolen or borrowed one. Every other session
  // on the account is dropped and only this device stays signed in, so changing
  // the password actually ends the old access rather than leaving it live until
  // its refresh token happens to lapse. Best effort: the password is already
  // changed by this point, and failing to revoke is not worth refusing that.
  await supabase.auth.signOut({ scope: "others" });

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const firstName = String(formData.get("first_name") ?? "").trim();

  const values = { email, first_name: firstName };

  if (!email || !password) {
    return { error: "Enter your email and a password.", values };
  }
  if (password.length < 8) {
    return { error: "Passwords need at least 8 characters.", values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName },
      emailRedirectTo: await originUrl("/auth/confirm?next=/start"),
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message), values };
  }

  if (!data.session) {
    return { message: `Confirm your email. We have sent a link to ${email}.` };
  }

  revalidatePath("/", "layout");
  // Straight to the block setup rather than via "/": a brand new account has no
  // block, so Today would only bounce here, and that second hop renders an empty
  // app shell for a frame first.
  redirect("/start");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
