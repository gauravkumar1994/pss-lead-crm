"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, setToken } from "@/lib/api";
import {
  setStoredUser,
  useClientAuth,
  type AuthUser,
  canManageUsers,
} from "@/lib/auth-store";

const NAV = [
  { href: "/dashboard", label: "Dashboard", short: "Dash" },
  { href: "/leads", label: "Leads", short: "Leads" },
  { href: "/followups", label: "Follow-ups", short: "Follow" },
  { href: "/pipeline", label: "Pipeline", short: "Pipe" },
  { href: "/quick-send", label: "Quick Send", short: "Quick" },
  { href: "/bulk", label: "Bulk WhatsApp", short: "Bulk", highlight: true },
  { href: "/campaigns", label: "Campaign History", short: "Camp" },
  { href: "/templates", label: "Templates", short: "Tmpl" },
  { href: "/reports", label: "Call Reports", short: "Calls" },
  { href: "/settings", label: "WhatsApp API", short: "API" },
  { href: "/users", label: "Users", short: "Users", adminOnly: true },
];

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, ready: authReady } = useClientAuth();
  const [myCallsToday, setMyCallsToday] = useState(0);
  const [myWaToday, setMyWaToday] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!authReady || user) return;
    api<{ user: AuthUser }>("/auth/me")
      .then((r) => {
        setUser(r.user);
        setStoredUser(r.user);
      })
      .catch(() => router.push("/login"));
  }, [authReady, user, router, setUser]);

  useEffect(() => {
    function refreshTopbar() {
      api<{ myCallsToday: number; myWhatsAppToday: number }>("/dashboard/topbar")
        .then((s) => {
          setMyCallsToday(s.myCallsToday);
          setMyWaToday(s.myWhatsAppToday);
        })
        .catch(() => {});
    }
    refreshTopbar();
    const interval = setInterval(refreshTopbar, 60_000);
    return () => clearInterval(interval);
  }, []);

  function logout() {
    setToken(null);
    setStoredUser(null);
    router.push("/login");
  }

  const navItems = NAV.filter(
    (n) => !n.adminOnly || (authReady && user && canManageUsers(user.role))
  );

  return (
    <div className="app-shell">
      <button
        type="button"
        className={`sidebar-backdrop ${menuOpen ? "open" : ""}`}
        aria-label="Close menu"
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <h1 className="brand-title">PSS SOLUTION</h1>
          <p className="brand-sub">Pinnacle Software Solutions</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`nav-item ${active ? "active" : ""} ${item.highlight ? "nav-highlight" : ""}`}
                onClick={() => setMenuOpen(false)}
              >
                <span className="nav-label-full">{item.label}</span>
                <span className="nav-label-short">{item.short}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <strong>{authReady ? (user?.fullName ?? "…") : "…"}</strong>
          <span>{authReady ? (user?.role ?? "") : ""}</span>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="btn btn-ghost btn-sm sidebar-toggle"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              ☰
            </button>
            <h2 className="page-title">{title}</h2>
          </div>
          <div className="topbar-actions">
            <span className="topbar-stat topbar-stat-hide-sm">Calls: {myCallsToday}</span>
            <span className="topbar-stat topbar-stat-wa topbar-stat-hide-sm">WA: {myWaToday}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
              Logout
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
