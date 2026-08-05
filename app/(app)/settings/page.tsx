import { signOut } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getActiveBlock, getProfile } from "@/lib/data/blocks";
import { formatLongDay, formatWeight } from "@/lib/format";

/**
 * Deliberately thin for now: what the block was set up with, the theme, and the
 * way out. Editing targets, swapping lifts, CSV export and account deletion come
 * with the settings phase rather than being half-built here.
 */
export default async function SettingsPage() {
  const [profile, block] = await Promise.all([getProfile(), getActiveBlock()]);

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
          <dl className="tabular flex flex-col gap-1 text-body">
            <Row label="Started">{formatLongDay(block.startDate)}</Row>
            <Row label="Ends">{formatLongDay(block.endDate)}</Row>
            <Row label="Starting weight">
              {formatWeight(block.startingWeight, profile.unitPreference)}
            </Row>
            <Row label="Protein target">{block.proteinTargetG}g</Row>
            <Row label="Drinks target">{block.weeklyDrinksTarget} a week</Row>
          </dl>
        </section>
      )}

      <section className="flex flex-col gap-2">
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-1">
      <dt className="text-caption text-text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
