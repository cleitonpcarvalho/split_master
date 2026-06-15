import type { InputHTMLAttributes } from "react";

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function FormField({
  id,
  label,
  className,
  ...inputProps
}: FormFieldProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-bold text-navy">{label}</span>
      <input
        id={id}
        className={`min-h-12 w-full rounded-xl border border-navy/15 bg-white px-4 text-base text-navy outline-none transition placeholder:text-navy/35 focus:border-green focus:ring-4 focus:ring-green/10 ${className ?? ""}`}
        {...inputProps}
      />
    </label>
  );
}
