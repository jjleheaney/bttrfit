import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 flex-col justify-between px-5 py-10">
      <header className="pt-6">
        <h1 className="font-display text-display uppercase tracking-tight">
          Pick a new password
        </h1>
        <p className="mt-2 text-body text-text-muted">
          At least eight characters. You are already signed in on this device.
        </p>
      </header>
      <ResetPasswordForm />
    </main>
  );
}
