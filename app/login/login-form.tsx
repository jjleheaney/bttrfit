"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import {
  sendMagicLink,
  signInWithPassword,
  type AuthState,
} from "@/app/auth/actions";

const EMPTY: AuthState = {};

export function LoginForm({
  next,
  initialError,
}: {
  next: string;
  initialError?: string;
}) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const [linkState, linkAction, linkPending] = useActionState(sendMagicLink, EMPTY);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    EMPTY,
  );

  const state = mode === "link" ? linkState : passwordState;
  const pending = mode === "link" ? linkPending : passwordPending;
  const error = state.error ?? initialError;

  return (
    <div className="flex flex-col gap-6">
      <form
        action={mode === "link" ? linkAction : passwordAction}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="next" value={next} />
        <Field label="Email" htmlFor="email">
          <Input
            key={`email:${state.values?.email ?? ""}`}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            defaultValue={state.values?.email}
            required
          />
        </Field>

        {mode === "password" && (
          <Field label="Password" htmlFor="password">
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
        )}

        {error && (
          <p role="alert" className="text-caption text-miss">
            {error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-caption text-text-muted">
            {state.message}
          </p>
        )}

        <Button type="submit" full disabled={pending}>
          {mode === "link"
            ? pending
              ? "Sending"
              : "Email me a link"
            : pending
              ? "Signing in"
              : "Sign in"}
        </Button>
      </form>

      <div className="flex flex-col gap-2 text-caption text-text-muted">
        <button
          type="button"
          className="min-h-tap text-left underline"
          onClick={() => setMode(mode === "link" ? "password" : "link")}
        >
          {mode === "link" ? "Use a password instead" : "Email me a link instead"}
        </button>
        {mode === "password" && (
          <p>
            <Link href="/forgot-password" className="underline">
              Forgotten your password?
            </Link>
          </p>
        )}
        <p>
          No account yet?{" "}
          <Link href="/signup" className="underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
