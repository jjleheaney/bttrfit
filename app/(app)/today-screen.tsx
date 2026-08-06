"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  addDays,
  answeredMetricCount,
  compareDates,
  currentStreak,
  dayOfWeekNumber,
  isComplete,
  missingDates,
  shouldPromptBackdate,
  weekNumberFor,
  weeklyCompliance,
  type Block,
  type DailyEntry,
  type IsoDate,
  type UnitPreference,
} from "@/lib/domain";
import { useDismissed } from "@/lib/dismissals";
import { formatDay, formatRate } from "@/lib/format";
import { Stepper } from "@/components/ui/stepper";
import { YesNo } from "@/components/ui/yes-no";
import { saveDay, type DayPatch } from "./actions";
import { WeightField } from "./weight-field";

/** Prompted from day 6 of the week, per the brief, and dismissible until it closes. */
const LIFT_PROMPT_FROM_DAY_OF_WEEK = 6;
/** Weight, four binary habits, drinks. */
const METRICS_PER_DAY = 6;
/** How long the saved acknowledgement stays before the countdown returns. */
const SAVED_VISIBLE_MS = 1500;

type SaveState = "idle" | "saving" | "saved" | "error";

function blankEntry(entryDate: IsoDate): DailyEntry {
  return {
    entryDate,
    weight: null,
    proteinHit: null,
    workoutDone: null,
    sleepHit: null,
    stepsHit: null,
    drinks: null,
    notes: null,
  };
}

export function TodayScreen({
  block,
  blockId,
  initialEntries,
  liftsLoggedForWeek,
  today,
  unit,
}: {
  block: Block;
  blockId: string;
  initialEntries: DailyEntry[];
  /** Week numbers that already have every sentinel lift logged. */
  liftsLoggedForWeek: number[];
  today: IsoDate;
  unit: UnitPreference;
}) {
  const [entries, setEntries] = useState<Record<IsoDate, DailyEntry>>(() =>
    Object.fromEntries(initialEntries.map((entry) => [entry.entryDate, entry])),
  );
  const [date, setDate] = useState<IsoDate>(today);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [, startTransition] = useTransition();

  const entryList = useMemo(() => Object.values(entries), [entries]);
  const entry = entries[date] ?? blankEntry(date);
  const weekNumber = weekNumberFor(block.startDate, date) ?? 1;
  const compliance = useMemo(
    () => weeklyCompliance(entryList, block, weekNumber),
    [entryList, block, weekNumber],
  );
  const streak = useMemo(() => currentStreak(entryList, today), [entryList, today]);
  const complete = isComplete(entry);

  /**
   * The last weight recorded before this day, which is what the field prefills
   * with. Looking backwards rather than at the latest entry keeps a backdated day
   * from being seeded with a weight from the future.
   */
  const prefillWeight = useMemo(() => {
    const earlier = entryList
      .filter((candidate) => candidate.weight !== null && candidate.entryDate < date)
      .sort((a, b) => compareDates(a.entryDate, b.entryDate));
    return earlier.at(-1)?.weight ?? block.startingWeight;
  }, [entryList, date, block.startingWeight]);

  const dayOfWeek = dayOfWeekNumber(block.startDate, today) ?? 1;
  const todayWeek = weekNumberFor(block.startDate, today) ?? 1;

  // Dismissal is remembered per week, so "Later" survives a reload but the prompt
  // comes back for the next week's lifts.
  const [liftPromptDismissed, dismissLiftPrompt] = useDismissed(
    `bttrfit-lift-prompt-${blockId}-${todayWeek}`,
  );

  const showLiftPrompt =
    !liftPromptDismissed &&
    dayOfWeek >= LIFT_PROMPT_FROM_DAY_OF_WEEK &&
    !liftsLoggedForWeek.includes(todayWeek);

  const backdatePrompt = shouldPromptBackdate(entryList, block.startDate, today);
  // Only days that are behind today and not already on screen: today itself is
  // not something to go back and fill in, and a chip for the displayed day would
  // be a no-op. Either one would also overstate how much is missing.
  const missing = useMemo(
    () =>
      missingDates(entryList, block.startDate, today).filter(
        (day) => day !== date && day !== today,
      ),
    [entryList, block.startDate, today, date],
  );

  /**
   * Optimistic: the tap lands in local state immediately and the write follows.
   * Everything on this screen is computed from the same entries by the domain
   * layer, so the streak and compliance update without a round trip. A failed
   * write rolls the day back and says so rather than pretending it saved.
   */
  function save(patch: DayPatch) {
    const previous = entry;
    const next: DailyEntry = { ...previous, ...patch };
    // Only what this write attempted is rolled back, so a second answer that
    // landed while this one was in flight is not silently un-shown.
    const revert: DayPatch = {};
    if ("weight" in patch) revert.weight = previous.weight;
    if ("proteinHit" in patch) revert.proteinHit = previous.proteinHit;
    if ("workoutDone" in patch) revert.workoutDone = previous.workoutDone;
    if ("sleepHit" in patch) revert.sleepHit = previous.sleepHit;
    if ("stepsHit" in patch) revert.stepsHit = previous.stepsHit;
    if ("drinks" in patch) revert.drinks = previous.drinks;
    if ("notes" in patch) revert.notes = previous.notes;
    setEntries((current) => ({ ...current, [date]: next }));
    setState("saving");
    setError(null);

    startTransition(async () => {
      const result = await saveDay(date, patch);
      if (result.ok) {
        setState("saved");
        // Back to the countdown shortly: a permanent "Saved" hides how much of the
        // day is still unanswered, which is the more useful thing to show.
        window.setTimeout(
          () => setState((current) => (current === "saved" ? "idle" : current)),
          SAVED_VISIBLE_MS,
        );
        return;
      }
      setEntries((current) => ({
        ...current,
        [date]: { ...(current[date] ?? blankEntry(date)), ...revert },
      }));
      setState("error");
      setError(result.error);
    });
  }

  /**
   * One nudge at a time, in order of urgency. A finished day plus a nudge is a
   * normal state — day 6 of every week — so both it and the day's result have to
   * fit; what gives way is the chip row, not either of them. Two competing asks on
   * a ten-second check-in is one too many anyway.
   */
  const nudge = showLiftPrompt ? "lifts" : backdatePrompt && missing.length > 0 ? "backdate" : null;

  const canGoBack = compareDates(addDays(date, -1), block.startDate) >= 0;
  const canGoForward = compareDates(date, today) < 0;

  return (
    // The whole check-in has to fit a short phone without scrolling, so on a
    // 640px-tall viewport the rows give up padding rather than the screen
    // gaining a scrollbar. Tap targets stay at 44px, the accessible floor.
    <main className="flex flex-1 flex-col gap-2 px-4 pt-3 pb-2 [@media(max-height:720px)]:gap-1 [@media(max-height:720px)]:pt-1">
      <header className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous day"
          disabled={!canGoBack}
          onClick={() => setDate(addDays(date, -1))}
          className="min-h-tap w-10 rounded-md text-lead text-text-muted disabled:opacity-30"
        >
          ‹
        </button>
        <div className="text-center">
          <h1 className="font-display text-title uppercase tracking-tight [@media(max-height:720px)]:text-lead">
            {date === today ? "Today" : formatDay(date)}
          </h1>
          <p className="tabular text-caption text-text-muted">
            Week {weekNumber} · day {dayOfWeekNumber(block.startDate, date) ?? 1}
            {date === today ? ` · ${formatDay(date)}` : ""}
          </p>
        </div>
        <button
          type="button"
          aria-label="Next day"
          disabled={!canGoForward}
          onClick={() => setDate(addDays(date, 1))}
          className="min-h-tap w-10 rounded-md text-lead text-text-muted disabled:opacity-30"
        >
          ›
        </button>
      </header>

      <WeightField
        key={date}
        value={entry.weight}
        prefill={prefillWeight}
        unit={unit}
        onCommit={(weight) => save({ weight })}
      />

      <YesNo
        label={`Protein ${block.proteinTargetG}g`}
        value={entry.proteinHit}
        onChange={(value) => save({ proteinHit: value })}
      />
      <YesNo
        label="Resistance training"
        value={entry.workoutDone}
        onChange={(value) => save({ workoutDone: value })}
      />
      <YesNo label="Sleep" value={entry.sleepHit} onChange={(value) => save({ sleepHit: value })} />
      <YesNo label="Steps" value={entry.stepsHit} onChange={(value) => save({ stepsHit: value })} />

      <Stepper
        label="Drinks"
        value={entry.drinks}
        onChange={(drinks) => save({ drinks })}
        max={30}
      />

      {notesOpen || entry.notes ? (
        <div className="flex flex-col gap-1">
          <label htmlFor="notes" className="sr-only">
            Note
          </label>
          <textarea
            // Uncontrolled, so it has to be remounted per day: otherwise the text
            // typed for one day stays on screen and is saved against the next.
            key={date}
            id="notes"
            rows={2}
            defaultValue={entry.notes ?? ""}
            placeholder="Anything worth remembering about today"
            onBlur={(event) => {
              const notes = event.target.value;
              if (notes.trim() !== (entry.notes ?? "").trim()) save({ notes });
            }}
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-body"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="min-h-tap self-start text-caption text-text-muted underline"
        >
          Add a note
        </button>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {error && (
          <p role="alert" className="text-caption text-miss">
            {error}
          </p>
        )}

        {nudge === "lifts" && (
          <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2 [@media(max-height:720px)]:py-1">
            <Link href={`/lifts?week=${todayWeek}`} className="text-caption underline">
              Log week {todayWeek} lifts
            </Link>
            <button
              type="button"
              onClick={dismissLiftPrompt}
              className="min-h-tap px-2 text-caption text-text-muted"
            >
              Later
            </button>
          </div>
        )}

        {nudge === "backdate" && (
          // Label and chips on one line, the chips scrolling sideways. Wrapped
          // chips came to 202px and a heading of its own wrapped to two lines at
          // 360px: both pushed the day's own result behind the tab bar.
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 [@media(max-height:720px)]:py-1">
            <p className="shrink-0 text-caption text-text-muted">
              {missing.length === 1 ? "1 day missing:" : `${missing.length} days missing:`}
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
              {missing.map((missingDate) => (
                <button
                  key={missingDate}
                  type="button"
                  onClick={() => setDate(missingDate)}
                  className="tabular min-h-tap shrink-0 rounded-md border border-line px-3 text-caption"
                >
                  {formatDay(missingDate)}
                </button>
              ))}
            </div>
          </div>
        )}

        {complete ? (
          <section
            aria-live="polite"
            className="resolve-in rounded-md border border-hit bg-surface px-3 py-2 [@media(max-height:720px)]:py-1"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-caption uppercase tracking-wide text-text-muted">
                {date === today ? "Day complete" : `${formatDay(date)} complete`}
              </p>
              <p className="tabular font-display text-display leading-none">
                {streak}
                <span className="ml-1 text-caption font-sans tracking-normal text-text-muted">
                  {streak === 1 ? " day streak" : " days streak"}
                </span>
              </p>
            </div>
            <p className="tabular mt-1 text-caption text-text-muted">
              {[
                `Week ${weekNumber} so far`,
                `${compliance.daysLogged} ${compliance.daysLogged === 1 ? "day" : "days"} logged`,
                `protein ${formatRate(compliance.protein.rate)}`,
                `sleep ${formatRate(compliance.sleep.rate)}`,
                `steps ${formatRate(compliance.steps.rate)}`,
                `${compliance.workoutsCompleted} ${compliance.workoutsCompleted === 1 ? "session" : "sessions"}`,
                `${compliance.totalDrinks}/${compliance.weeklyDrinksTarget} drinks`,
              ].join(" · ")}
            </p>
          </section>
        ) : (
          <p aria-live="polite" className="text-caption text-text-muted">
            {state === "saving"
              ? "Saving…"
              : state === "saved"
                ? "Saved"
                : `${METRICS_PER_DAY - answeredMetricCount(entry)} left to answer`}
          </p>
        )}
      </div>
    </main>
  );
}
