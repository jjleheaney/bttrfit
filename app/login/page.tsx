import { safeNextPath } from "@/lib/auth/next-path";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col justify-between px-5 py-10">
      <header className="pt-6">
        <h1 className="font-display text-display uppercase tracking-tight">BTTR Fit</h1>
        <p className="mt-2 text-body text-text-muted">
          Six metrics a day. Three lifts a week. Eight week blocks.
        </p>
      </header>
      <LoginForm
        next={safeNextPath(next)}
        initialError={
          error === "link_expired"
            ? "That link has expired or has already been used. Request a new one."
            : undefined
        }
      />
    </main>
  );
}
