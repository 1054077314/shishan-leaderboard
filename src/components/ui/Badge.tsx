import React from "react";

export interface BadgeProps {
  children: React.ReactNode;
  variant?: "emerald" | "amber" | "rose" | "blue" | "zinc" | "cyan" | "purple";
  size?: "sm" | "md";
  className?: string;
}

const variantStyles: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  zinc: "bg-stone-100 text-ink-muted border-stone-200",
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "zinc",
  size = "sm",
  className = "",
}) => {
  const sizeStyle = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const style = variantStyles[variant] || variantStyles.zinc;

  return (
    <span className={`inline-flex items-center gap-1 font-mono-code font-semibold rounded-md border ${style} ${sizeStyle} ${className}`}>
      {children}
    </span>
  );
};
