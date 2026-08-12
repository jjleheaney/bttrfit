"use client";

import { useState, useTransition } from "react";
import {
  MAX_WEEKLY_DRINKS_TARGET,
  SENTINEL_LIFT_MENU,
  WEEKLY_DRINKS_OPTIONS,
  canSwapSentinelLift,
  formatTopSet,
  liftEntryForWeek,
  type SentinelLift,
  type UnitPreference,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { closeAccount, saveTargets, swapLift, type SettingsResult } from "./actions";

const SELECT_CLASS =
  "w-full min-h-tap rounded-md border border-line bg-field px-4 text-body text-text focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent";

function Error({ children }: { children: React.ReactNode }) {
  return <p className="text-caption text-miss">{children}</p>;
}

/**
 * A save with a confirmation that has to be dismissed on the next edit: "Saved."
 * sitting above numbers the user has since changed is a lie the screen tells
 * quietly.
 */
function useSaveState() {
  const [state, setState] = useState<{ error?: string; saved?: boolean }>({});
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<SettingsResult>, onSaved?: () => void) {
    setState({});
    startTransition(async () => {
      const result = await action();
      setState(result.ok ? { saved: true } : { error: result.error });
      if (result.ok) onSaved?.();
    });
  }

  return { ...state, pending, run, clear: () => setState({}) };
}

export function TargetsForm({
  unit,
  startingWeight,
  proteinTargetG,
  weeklyDrinksTarget,
}: {
  unit: UnitPreference;
  startingWeight: number;
  proteinTargetG: number;
  weeklyDrinksTarget: number;
}) {
  const overCap = weeklyDrinksTarget > MAX_WEEKLY_DRINKS_TARGET;
  const [draft, setDraft] = useState({
    startingWeight: String(startingWeight),
    proteinTargetG: String(proteinTargetG),
    weeklyDrinksTarget: String(overCap ? MAX_WEEKLY_DRINKS_TARGET : weeklyDrinksTarget),
  });
  const { error, saved, pending, run, clear } = useSaveState();

  function edit(patch: Partial<typeof draft>) {
    clear();
    setDraft({ ...draft, ...patch });
  }

  return (
    <form
      className="flex flex-col gap-3"
      action={() => {
        run(() => saveTargets(draft));
      }}
    >
      <Field label={`Starting weight (${unit})`} htmlFor="starting-weight">
        <Input
          id="starting-weight"
          inputMode="decimal"
          value={draft.startingWeight}
          onChange={(event) => edit({ startingWeight: event.target.value })}
        />
      </Field>
      <Field label="Protein target (g a day)" htmlFor="protein-target">
        <Input
          id="protein-target"
          inputMode="numeric"
          value={draft.proteinTargetG}
          onChange={(event) => edit({ proteinTargetG: event.target.value })}
        />
      </Field>
      <Field label="Drinks target (a week)" htmlFor="drinks-target">
        <select
          id="drinks-target"
          className={SELECT_CLASS}
          value={draft.weeklyDrinksTarget}
          onChange={(event) => edit({ weeklyDrinksTarget: event.target.value })}
        >
          {WEEKLY_DRINKS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {overCap && (
          <p className="text-caption text-text-muted">
            This block was set to {weeklyDrinksTarget} a week, from before the limit of{" "}
            {MAX_WEEKLY_DRINKS_TARGET}. Saving will bring it down.
          </p>
        )}
      </Field>

      {error && <Error>{error}</Error>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving" : "Save targets"}
        </Button>
        {saved && !pending && <span className="text-caption text-text-muted">Saved.</span>}
      </div>
    </form>
  );
}

/**
 * A swap is offered only while the lift has nothing but its week 1 baseline;
 * after that the lift is the measuring stick and moving it destroys the
 * comparison. The refusal says so rather than hiding the control, because a
 * missing control reads as a bug.
 */
export function LiftSwap({
  lift,
  taken,
  unit,
}: {
  lift: SentinelLift & { id: string };
  taken: string[];
  unit: UnitPreference;
}) {
  const decision = canSwapSentinelLift(lift);
  const baseline = liftEntryForWeek(lift, 1);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    liftKey: lift.liftKey,
    reps: baseline ? String(baseline.reps) : "",
    weight: baseline ? String(baseline.weight) : "",
  });
  const { error, saved, pending, run, clear } = useSaveState();

  /**
   * Choosing a different lift blanks the numbers rather than carrying the old
   * lift's across: a bench press top set saved as a deadlift baseline makes the
   * rest of the block's comparison meaningless, and it would happen by simply
   * not noticing the boxes were already filled in.
   */
  function chooseLift(liftKey: string) {
    clear();
    const own = liftKey === lift.liftKey && baseline;
    setDraft({
      liftKey,
      reps: own ? String(baseline.reps) : "",
      weight: own ? String(baseline.weight) : "",
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b border-line py-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-body">{lift.displayName}</p>
          <p className="text-caption text-text-muted">
            {baseline ? `Baseline ${formatTopSet(baseline, unit)}` : "No baseline logged"}
          </p>
        </div>
        {decision.allowed && (
          <Button type="button" variant="ghost" onClick={() => setOpen(!open)}>
            {open ? "Cancel" : "Swap"}
          </Button>
        )}
      </div>

      {!decision.allowed && <p className="text-caption text-text-muted">{decision.reason}</p>}
      {saved && !open && <p className="text-caption text-text-muted">Swapped.</p>}

      {open && decision.allowed && (
        <form
          className="flex flex-col gap-3 pt-1"
          action={() => {
            // Closing on success puts the refreshed name and baseline back in
            // front of the user, which is the confirmation that matters.
            run(() => swapLift({ sentinelLiftId: lift.id, ...draft }), () => setOpen(false));
          }}
        >
          <Field label="Lift" htmlFor={`lift-${lift.id}`}>
            <select
              id={`lift-${lift.id}`}
              className={SELECT_CLASS}
              value={draft.liftKey}
              onChange={(event) => chooseLift(event.target.value)}
            >
              {SENTINEL_LIFT_MENU.filter(
                (option) => option.key === lift.liftKey || !taken.includes(option.key),
              ).map((option) => (
                <option key={option.key} value={option.key}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex gap-3">
            <Field label="Reps" htmlFor={`reps-${lift.id}`}>
              <Input
                id={`reps-${lift.id}`}
                inputMode="numeric"
                value={draft.reps}
                onChange={(event) => {
                  clear();
                  setDraft({ ...draft, reps: event.target.value });
                }}
              />
            </Field>
            <Field label={`Weight (${unit})`} htmlFor={`weight-${lift.id}`}>
              <Input
                id={`weight-${lift.id}`}
                inputMode="decimal"
                value={draft.weight}
                onChange={(event) => {
                  clear();
                  setDraft({ ...draft, weight: event.target.value });
                }}
              />
            </Field>
          </div>
          {error && <Error>{error}</Error>}
          <Button type="submit" disabled={pending}>
            {pending ? "Swapping" : "Swap this lift"}
          </Button>
        </form>
      )}
    </div>
  );
}

/**
 * Deleting is permanent and cascades, so it asks for the account's own email
 * back: the one confirmation nobody taps through by accident.
 */
export function DeleteAccount({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const { error, pending, run, clear } = useSaveState();

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)}>
        Delete account
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      action={() => {
        run(() => closeAccount(confirmation));
      }}
    >
      <p className="text-caption text-text-muted">
        This deletes every block, check-in and lift you have logged. It cannot be undone. Export
        your data first if you want to keep it. Type <span className="text-text">{email}</span> to
        confirm.
      </p>
      <Input
        aria-label="Confirm your email"
        autoComplete="off"
        placeholder={email}
        value={confirmation}
        onChange={(event) => {
          // "That is not the email this account uses" sitting above the button
          // while the correct address is in the box is the wrong signal to give
          // anyone about to press it.
          clear();
          setConfirmation(event.target.value);
        }}
      />
      {error && <Error>{error}</Error>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="bg-miss text-miss-contrast">
          {pending ? "Deleting" : "Delete for good"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Keep it
        </Button>
      </div>
    </form>
  );
}
