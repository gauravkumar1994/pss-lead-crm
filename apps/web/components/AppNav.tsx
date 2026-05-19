"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { setToken } from "@/lib/api";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/campaigns", label: "Bulk WhatsApp" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "WhatsApp Settings" },
  { href: "/users", label: "Users" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="nav">
      <strong style={{ marginRight: "auto" }}>PSS Lead CRM</strong>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={pathname.startsWith(l.href) ? "active" : ""}
        >
          {l.label}
        </Link>
      ))}
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => {
          setToken(null);
          router.push("/login");
        }}
      >
        Logout
      </button>
    </nav>
  );
}
