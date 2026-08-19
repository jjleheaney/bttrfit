"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { sendPasswordReset, type AuthState } from "@/app/auth/actions";

const EMPTY: AuthState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(sendPasswordReset, EMPTY);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
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

        {state.error && (
          <p role="alert" className="text-caption text-miss">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-caption text-text-muted">
            {state.message}
          </p>
        )}

        <Button type="submit" full disabled={pending}>
          {pending ? "Sending" : "Email me a reset link"}
        </Button>
      </form>

      <p className="text-caption text-text-muted">
        <Link href="/login" className="underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
