"use client";

import { PssLogoIcon } from "./PssLogoIcon";

export function PssLogo({
  variant = "default",
  className = "",
}: {
  variant?: "sidebar" | "login" | "default";
  className?: string;
}) {
  const size = variant === "login" ? 88 : variant === "sidebar" ? 56 : 48;

  if (variant === "sidebar") {
    return (
      <div className={`sidebar-logo-slot ${className}`.trim()} title="PSS">
        <PssLogoIcon size={56} />
      </div>
    );
  }

  return (
    <div className={`brand-logo-box brand-logo-box--${variant} ${className}`.trim()}>
      <PssLogoIcon size={size} />
    </div>
  );
}
