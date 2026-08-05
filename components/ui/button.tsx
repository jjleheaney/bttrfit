import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-body font-medium min-h-tap px-5 disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-contrast hover:opacity-90",
        secondary: "border border-line bg-surface text-text hover:bg-surface-raised",
        ghost: "text-text-muted hover:text-text",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", full: false },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof button>;

export function Button({ className, variant, full, ...props }: ButtonProps) {
  return <button className={cn(button({ variant, full }), className)} {...props} />;
}
