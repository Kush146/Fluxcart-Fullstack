import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
}

const base =
  "inline-flex items-center justify-center rounded-2xl px-3 py-2 text-sm font-medium transition border focus:outline-none focus:ring-2 focus:ring-black/20";
const styles = {
  default: "bg-black text-white border-black hover:opacity-90",
  outline: "bg-transparent text-black border-neutral-300 hover:bg-neutral-50",
  ghost: "bg-transparent border-transparent hover:bg-neutral-100",
};

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  return <button className={cn(base, styles[variant], className)} {...props} />;
}
export default Button;
