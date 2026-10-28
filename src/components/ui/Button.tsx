import type { ComponentPropsWithRef } from "react";

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary: "border-primary bg-primary text-on-primary hover:opacity-90",
  secondary: "border-primary bg-transparent text-primary hover:bg-primary hover:text-on-primary",
  ghost: "border-transparent bg-transparent text-primary hover:underline underline-offset-4",
};

export function Button({ variant = "primary", type = "button", className = "", ...props }: ButtonProps) {
  return <button type={type} className={`inline-flex min-h-11 items-center justify-center rounded-sm border px-6 py-3 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${className}`} {...props} />;
}
