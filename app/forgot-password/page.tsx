import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="flex flex-1 flex-col justify-between px-5 py-10">
      <header className="pt-6">
        <h1 className="font-display text-display uppercase tracking-tight">
          Reset your password
        </h1>
        <p className="mt-2 text-body text-text-muted">
          We will email you a link to set a new one.
        </p>
      </header>
      <ForgotPasswordForm />
    </main>
  );
}
