"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  userCode: string;
  username: string;
  fullName: string;
  role: "ADMIN" | "MANAGER" | "USER";
  department?: string;
};

const USER_KEY = "crm_user";

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function canManageUsers(role: string) {
  return role === "ADMIN";
}

/** Admin-only: assign & edit WhatsApp API for all users (SalesNayak style) */
export function canManageWhatsAppApi(role: string) {
  return role === "ADMIN";
}

export function canAssignLeads(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

/** Read auth from localStorage only after mount — avoids SSR/client hydration mismatch. */
export function useClientAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setReady(true);
  }, []);

  return { user, setUser, ready, role: user?.role ?? "USER" };
}
