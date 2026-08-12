import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { startDateWindow } from "@/lib/domain";
import { getBlockContext, getProfile } from "@/lib/data/blocks";
import { createClient } from "@/lib/data/supabase/server";
import { currentDate } from "@/lib/data/today";
import { DeleteAccount, LiftSwap, StartDateForm, TargetsForm } from "./settings-forms";

/**
 * Everything about a block that can still be changed, and the two things that
 * end it: taking your data out, and deleting the account.
 */
export default async function SettingsPage() {
  const supabase = await createClient();
  const [profile, context, today, { data: auth }] = await Promise.all([
    getProfile(),
    getBlockContext(),
    currentDate(),
    supabase.auth.getUser(),
  ]);
  const block = context?.block ?? null;
  const lifts = context?.lifts ?? [];

  return (
    <main className="flex flex-1 flex-col gap-6 px-5 pt-4 pb-4">
      <header>
        <h1 className="font-display text-title uppercase tracking-tight">Settings</h1>
        {profile.firstName && (
          <p className="text-caption text-text-muted">Signed in as {profile.firstName}.</p>
        )}
      </header>

      {block && (
        <section className="flex flex-col gap-2">
          <h2 className="text-caption uppercase tracking-wide text-text-muted">
            Block {block.blockNumber}
          </h2>
          <StartDateForm
            startDate={block.startDate}
            {...startDateWindow({
              today,
              loggedDates: (context?.entries ?? []).map((entry) => entry.entryDate),
            })}
          />
          <TargetsForm
            unit={profile.unitPreference}
            startingWeight={block.startingWeight}
            proteinTargetG={block.proteinTargetG}
            weeklyDrinksTarget={block.weeklyDrinksTarget}
          />
        </section>
      )}

      {lifts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-caption uppercase tracking-wide text-text-muted">Sentinel lifts</h2>
          <div className="flex flex-col">
            {lifts.map((lift) => (
              <LiftSwap
                key={lift.id}
                lift={lift}
                taken={lifts.map((other) => other.liftKey)}
                unit={profile.unitPreference}
              />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-caption uppercase tracking-wide text-text-muted">Theme</h2>
        <ThemeToggle />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-caption uppercase tracking-wide text-text-muted">Your data</h2>
        <p className="text-caption text-text-muted">
          Every block you have run, as a spreadsheet. Unanswered days stay blank rather than
          counting as a no.
        </p>
        <div className="flex gap-2">
          <ExportLink dataset="daily">Days</ExportLink>
          <ExportLink dataset="lifts">Lifts</ExportLink>
        </div>
      </section>

      <form action={signOut} className="mt-auto">
        <Button type="submit" variant="secondary" full>
          Sign out
        </Button>
      </form>

      {auth.user?.email && (
        <section className="flex flex-col gap-2 border-t border-line pt-4">
          <h2 className="text-caption uppercase tracking-wide text-text-muted">Danger zone</h2>
          <DeleteAccount email={auth.user.email} />
        </section>
      )}
    </main>
  );
}

/**
 * A plain link, not a fetch: `download` lets the browser stream the file
 * straight to disk, which is the one path that works in an installed PWA on iOS
 * as well as on desktop.
 */
function ExportLink({
  dataset,
  children,
}: {
  dataset: "daily" | "lifts";
  children: React.ReactNode;
}) {
  return (
    <a
      href={`/api/v1/export?dataset=${dataset}`}
      download
      className="inline-flex min-h-tap flex-1 items-center justify-center rounded-md border border-line bg-surface px-5 text-body font-medium text-text hover:bg-surface-raised"
    >
      {children}
    </a>
  );
}

