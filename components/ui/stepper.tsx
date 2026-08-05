"use client";

import { cn } from "@/lib/utils";

/** A stepper, not a keypad: nobody has had eleven drinks and wants to type it. */
export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 30,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const current = value ?? min;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-3 py-1.5",
        value === null ? "border-dashed border-attention" : "border-line",
      )}
    >
      <span className="text-body">{label}</span>
      <div className="flex items-center gap-1.5">
        <StepButton
          label={`One fewer ${label.toLowerCase()}`}
          disabled={current <= min}
          onClick={() => onChange(Math.max(min, current - 1))}
        >
          −
        </StepButton>
        <output
          aria-live="off"
          className={cn(
            "tabular w-12 text-center text-lead",
            value === null && "text-text-muted",
          )}
        >
          {current}
          {suffix}
        </output>
        <StepButton
          label={`One more ${label.toLowerCase()}`}
          disabled={current >= max}
          onClick={() => onChange(Math.min(max, current + 1))}
        >
          +
        </StepButton>
      </div>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="min-h-tap w-12 rounded-md border border-line bg-surface text-lead text-text disabled:opacity-40"
    >
      {children}
    </button>
  );
}
