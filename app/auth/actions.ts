"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/data/supabase/server";

export type AuthState = {
  error?: string;
  message?: string;
  values?: { email?: string; first_name?: string };
};

/**
 * Supabase error strings are provider-shaped ("email rate limit exceeded").
 * Errors here say what happened and what to do about it.
 */
function friendlyAuthError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes("rate limit") || text.includes("too many")) {
    return "Too many emails have been sent from this project. Wait a few minutes and try again.";
  }
  if (text.includes("already registered") || text.includes("already been registered")) {
    return "That email already has an account. Sign in instead.";
  }
  if (text.includes("password")) {
    return "That password was rejected. Use at least 8 characters.";
  }
  if (text.includes("invalid") && text.includes("email")) {
    return "That email address is not valid.";
  }
  return "Something went wrong creating the account. Try again in a moment.";
}

async function originUrl(path: string) {
  const headerList = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${headerList.get("x-forwarded-proto") ?? "http"}://${headerList.get("host")}`;
  return `${origin}${path}`;
}

export async function signInWithPassword(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

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
  const next = String(formData.get("next") ?? "/");

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
      emailRedirectTo: await originUrl("/auth/confirm?next=/"),
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message), values };
  }

  if (!data.session) {
    return { message: `Confirm your email. We have sent a link to ${email}.` };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
