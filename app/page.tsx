import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/auth/actions";
import { createClient } from "@/lib/data/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, unit_preference")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col gap-8 px-5 py-10">
      <header>
        <h1 className="font-display text-display uppercase tracking-tight">BTTR Fit</h1>
        <p className="mt-2 text-body text-text-muted">
          Signed in as {profile?.first_name || user.email}. The check-in screen
          lands in the next phase.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-caption uppercase tracking-wide text-text-muted">Theme</h2>
        <ThemeToggle />
      </section>

      <form action={signOut} className="mt-auto">
        <Button type="submit" variant="secondary" full>
          Sign out
        </Button>
      </form>
    </main>
  );
}
