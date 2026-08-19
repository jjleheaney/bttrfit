"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { updatePassword, type AuthState } from "@/app/auth/actions";

const EMPTY: AuthState = {};

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, EMPTY);

  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-4">
        <Field label="New password" htmlFor="password">
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

        <Button type="submit" full disabled={pending}>
          {pending ? "Saving" : "Save password"}
        </Button>
      </form>

      <p className="text-caption text-text-muted">
        <Link href="/forgot-password" className="underline">
          Send a new link
        </Link>
      </p>
    </div>
  );
}
