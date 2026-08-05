"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { signUp, type AuthState } from "@/app/auth/actions";

const EMPTY: AuthState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, EMPTY);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <Field label="First name" htmlFor="first_name">
          <Input
            key={`first_name:${state.values?.first_name ?? ""}`}
            id="first_name"
            name="first_name"
            autoComplete="given-name"
            defaultValue={state.values?.first_name}
            required
          />
        </Field>
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
        <Field label="Password (8 characters or more)" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
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
          {pending ? "Creating account" : "Create account"}
        </Button>
      </form>

      <p className="text-caption text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
