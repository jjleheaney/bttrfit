"use client";

import { useState, useTransition } from "react";
import {
  DEFAULT_WEEKLY_DRINKS_TARGET,
  MAX_WEEKLY_DRINKS_TARGET,
  PROTEIN_G_PER_KG,
  SENTINEL_LIFT_MENU,
  SENTINEL_LIFT_SLOTS,
  WEEKLY_DRINKS_OPTIONS,
  availableSentinelLifts,
  parseDecimal,
  parseInteger,
  parseWeight,
  suggestedProteinTarget,
  type IsoDate,
  type UnitPreference,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startBlock } from "./actions";

export type StartPrefill = {
  firstName: string;
  unitPreference: UnitPreference;
  startingWeight: string;
  proteinTargetG: string;
  weeklyDrinksTarget: string;
  liftKeys: string[];
  blockNumber: number;
};

type Form = {
  firstName: string;
  unitPreference: UnitPreference;
  startingWeight: string;
  proteinTargetG: string;
  weeklyDrinksTarget: string;
  liftKeys: string[];
  liftReps: string[];
  liftWeights: string[];
};

const STEP_COUNT = 7;

/**
 * A block started before the cap existed can carry a target above it, and an
 * unselectable prefill would leave the step looking unanswered.
 */
function withinDrinksCap(prefilled: string): string {
  const previous = Number(prefilled);
  if (!prefilled || !Number.isFinite(previous)) return String(DEFAULT_WEEKLY_DRINKS_TARGET);
  return String(Math.min(Math.max(Math.round(previous), 0), MAX_WEEKLY_DRINKS_TARGET));
}

/**
 * One question per screen, in the order the answers depend on each other: the
 * protein suggestion needs the weight, and the top sets need the lifts. Every
 * step is prefilled from the last block, so a second block is mostly confirming.
 *
 * The block starts today. It used to ask, defaulting to next Monday, which
 * bought a tidy calendar at the price of up to six days of an app that does
 * nothing — the surest way to lose someone is to make them wait after they have
 * already decided.
 */
export function StartFlow({ prefill, today }: { prefill: StartPrefill; today: IsoDate }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({
    firstName: prefill.firstName,
    unitPreference: prefill.unitPreference,
    startingWeight: prefill.startingWeight,
    proteinTargetG: prefill.proteinTargetG,
    weeklyDrinksTarget: withinDrinksCap(prefill.weeklyDrinksTarget),
    liftKeys: [0, 1, 2].map((slot) => prefill.liftKeys[slot] ?? ""),
    liftReps: ["", "", ""],
    liftWeights: ["", "", ""],
  });
  const [proteinEdited, setProteinEdited] = useState(prefill.proteinTargetG !== "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Form>(key: K, value: Form[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function setAt(key: "liftKeys" | "liftReps" | "liftWeights", index: number, value: string) {
    setForm((current) => {
      const next = [...current[key]];
      next[index] = value;
      return { ...current, [key]: next };
    });
    setError(null);
  }

  const suggestedProtein = (() => {
    const weight = parseWeight(form.startingWeight, form.unitPreference);
    return "value" in weight ? suggestedProteinTarget(weight.value, form.unitPreference) : null;
  })();

  function validate(current: number): string | null {
    if (current === 0 && form.firstName.trim().length === 0) return "Enter your first name.";
    if (current === 2) {
      const weight = parseWeight(form.startingWeight, form.unitPreference);
      if ("error" in weight) return weight.error;
    }
    if (current === 3) {
      const protein = parseInteger(form.proteinTargetG, {
        min: 40,
        max: 500,
        label: "Protein target",
      });
      if ("error" in protein) return protein.error;
    }
    if (current === 4) {
      const drinks = parseInteger(form.weeklyDrinksTarget, {
        min: 0,
        max: MAX_WEEKLY_DRINKS_TARGET,
        label: "Drinks target",
      });
      if ("error" in drinks) return drinks.error;
    }
    if (current === 5) {
      if (form.liftKeys.some((key) => key === "")) return "Pick three lifts.";
      if (new Set(form.liftKeys).size !== SENTINEL_LIFT_SLOTS) {
        return "Pick three different lifts.";
      }
    }
    if (current === 6) {
      for (const index of [0, 1, 2]) {
        const reps = parseInteger(form.liftReps[index], { min: 1, max: 30, label: "Reps" });
        if ("error" in reps) return reps.error;
        const weight = parseDecimal(form.liftWeights[index], {
          min: 1,
          max: 1000,
          label: "Weight",
        });
        if ("error" in weight) return weight.error;
      }
    }
    return null;
  }

  function next() {
    const problem = validate(step);
    if (problem) {
      setError(problem);
      return;
    }
    // Entering the protein step: offer the calculated target unless it has been
    // touched, so the number is a suggestion rather than a blank field.
    if (step === 2 && !proteinEdited && suggestedProtein !== null) {
      set("proteinTargetG", String(suggestedProtein));
    }
    setStep(step + 1);
  }

  function submit() {
    // The last step's own answers are checked here rather than on the way out of
    // it, because there is no way out of it: every other step is validated by
    // `next()`, which the final step does not render.
    const problem = validate(step);
    if (problem) {
      setError(problem);
      return;
    }
    startTransition(async () => {
      const result = await startBlock({
        firstName: form.firstName,
        unitPreference: form.unitPreference,
        startDate: today,
        startingWeight: form.startingWeight,
        proteinTargetG: form.proteinTargetG,
        weeklyDrinksTarget: form.weeklyDrinksTarget,
        lifts: form.liftKeys.map((liftKey, index) => ({
          liftKey,
          reps: form.liftReps[index],
          weight: form.liftWeights[index],
        })),
      });
      // Success redirects, so anything returned here is a failure.
      setError(result.error);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 pt-4 pb-6">
      <header className="flex flex-col gap-2">
        <p className="tabular text-caption text-text-muted">
          Step {step + 1} of {STEP_COUNT} · Block {prefill.blockNumber}
        </p>
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span
              key={index}
              className={`h-1 flex-1 rounded-full ${index <= step ? "bg-accent" : "bg-line"}`}
            />
          ))}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4">
        {step === 0 && (
          <Question title="What is your first name?">
            <Input
              autoFocus
              name="firstName"
              autoComplete="given-name"
              value={form.firstName}
              onChange={(event) => set("firstName", event.target.value)}
            />
          </Question>
        )}

        {step === 1 && (
          <Question title="Which units do you use?">
            <div className="flex gap-3">
              {(["kg", "lbs"] as const).map((unit) => (
                <Button
                  key={unit}
                  type="button"
                  variant={form.unitPreference === unit ? "primary" : "secondary"}
                  full
                  onClick={() => set("unitPreference", unit)}
                >
                  {unit}
                </Button>
              ))}
            </div>
          </Question>
        )}

        {step === 2 && (
          <Question
            title="What do you weigh today?"
            hint="First thing, before eating, is the most comparable."
          >
            <Input
              autoFocus
              inputMode="decimal"
              name="startingWeight"
              value={form.startingWeight}
              onChange={(event) => set("startingWeight", event.target.value)}
              className="tabular text-hero"
            />
          </Question>
        )}

        {step === 3 && (
          <Question
            title="Daily protein target"
            hint={`${PROTEIN_G_PER_KG}g per kg of bodyweight is the working figure. Change it if you have a better one.`}
          >
            <Input
              autoFocus
              inputMode="numeric"
              name="proteinTargetG"
              value={form.proteinTargetG}
              onChange={(event) => {
                setProteinEdited(true);
                set("proteinTargetG", event.target.value);
              }}
              className="tabular text-hero"
            />
            {suggestedProtein !== null && String(suggestedProtein) !== form.proteinTargetG && (
              <button
                type="button"
                onClick={() => {
                  setProteinEdited(true);
                  set("proteinTargetG", String(suggestedProtein));
                }}
                className="min-h-tap self-start text-caption underline"
              >
                Use {suggestedProtein}g
              </button>
            )}
          </Question>
        )}

        {step === 4 && (
          <Question
            title="Weekly drinks target"
            hint="Pick a number you will actually hold to for eight weeks. This is not about giving anything up — a target you quietly break in week two tells you less than an honest four."
          >
            <div className="flex gap-2">
              {WEEKLY_DRINKS_OPTIONS.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={form.weeklyDrinksTarget === String(option) ? "primary" : "secondary"}
                  full
                  onClick={() => set("weeklyDrinksTarget", String(option))}
                >
                  <span className="tabular">{option}</span>
                </Button>
              ))}
            </div>
          </Question>
        )}

        {step === 5 && (
          <Question
            title="Pick three sentinel lifts"
            hint="These are the strength reference for the whole block, so pick lifts you will actually do every week."
          >
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((index) => (
                <label key={index} className="flex flex-col gap-1">
                  <span className="text-caption text-text-muted">Lift {index + 1}</span>
                  <select
                    value={form.liftKeys[index]}
                    onChange={(event) => setAt("liftKeys", index, event.target.value)}
                    className="min-h-tap rounded-md border border-line bg-field px-3 text-body text-text"
                  >
                    <option value="">Choose a lift</option>
                    {availableSentinelLifts(form.liftKeys, index).map((lift) => (
                      <option key={lift.key} value={lift.key}>
                        {lift.displayName}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </Question>
        )}

        {step === 6 && (
          <Question
            title="Your current top set for each"
            hint="The heaviest set you would do today. This is week 1's baseline."
          >
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="flex flex-col gap-1">
                  <span className="text-caption text-text-muted">
                    {SENTINEL_LIFT_MENU.find((lift) => lift.key === form.liftKeys[index])
                      ?.displayName ?? `Lift ${index + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="numeric"
                      aria-label="Reps"
                      value={form.liftReps[index]}
                      onChange={(event) => setAt("liftReps", index, event.target.value)}
                      className="tabular w-20"
                    />
                    <span className="text-caption text-text-muted">reps at</span>
                    <Input
                      inputMode="decimal"
                      aria-label="Weight"
                      value={form.liftWeights[index]}
                      onChange={(event) => setAt("liftWeights", index, event.target.value)}
                      className="tabular w-24"
                    />
                    <span className="text-caption text-text-muted">{form.unitPreference}</span>
                  </div>
                </div>
              ))}
            </div>
          </Question>
        )}

      </div>

      <div className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="text-caption text-miss">
            {error}
          </p>
        )}
        {step === STEP_COUNT - 1 ? (
          <Button type="button" full onClick={submit} disabled={pending}>
            {pending ? "Starting…" : "Start the block"}
          </Button>
        ) : (
          <Button type="button" full onClick={next}>
            Next
          </Button>
        )}
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="min-h-tap text-caption text-text-muted underline"
          >
            Back
          </button>
        )}
      </div>
    </main>
  );
}

function Question({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="font-display text-display uppercase leading-tight tracking-tight">{title}</h1>
      {hint && <p className="text-body text-text-muted">{hint}</p>}
      {children}
    </section>
  );
}
