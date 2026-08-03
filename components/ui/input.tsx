import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full min-h-tap rounded-md border border-line bg-surface px-4 text-body text-text placeholder:text-text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-caption text-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}
