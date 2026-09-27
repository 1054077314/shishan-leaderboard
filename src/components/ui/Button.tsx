import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "bilibili";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  disabled,
  ...props
}) => {
  const base =
    "font-mono-code font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 transition-all select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  const sizeStyles = {
    sm: "px-2.5 py-1 text-xs",
    md: "px-3.5 py-2 text-xs",
    lg: "px-4.5 py-2.5 text-sm",
  };

  const variantStyles = {
    primary: "bg-stone-900 text-white hover:bg-stone-700 shadow-md shadow-stone-900/10 active:scale-[0.98]",
    secondary: "bg-white text-ink-muted hover:text-ink hover:bg-stone-50 border border-stone-200 active:scale-[0.98]",
    outline: "bg-transparent text-ink-muted hover:text-ink border border-stone-300 hover:border-stone-500",
    ghost: "bg-transparent text-ink-subtle hover:text-ink hover:bg-stone-100",
    bilibili: "bg-bilibili text-white hover:bg-sky-800 shadow-md shadow-bilibili/20 active:scale-[0.98]",
  };

  return (
    <button
      className={`${base} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
