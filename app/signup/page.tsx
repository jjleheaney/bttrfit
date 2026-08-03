import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <main className="flex flex-1 flex-col justify-between px-5 py-10">
      <header className="pt-6">
        <h1 className="font-display text-display uppercase tracking-tight">
          Create an account
        </h1>
        <p className="mt-2 text-body text-text-muted">
          Then you will set up your first eight week block. Two minutes.
        </p>
      </header>
      <SignupForm />
    </main>
  );
}
