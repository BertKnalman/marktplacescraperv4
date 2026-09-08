/** Session handling — mirrors Supabase Auth (e-mail/password, token sessions). */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { UserRow } from "../types";
import {
  createSession, createUser, destroySession, ensureAdminAccount, findUserByEmail,
  getUserByToken, ADMIN_EMAIL, ADMIN_PASSWORD,
} from "./db";
import { isEmail, sha256 } from "./util";

const TOKEN_KEY = "mscraper.token";

/** Built-in admin credentials. Accepts "admin" or the full admin e-mail. */
export const ADMIN_LOGIN = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, alias: "admin" };

interface AuthContextValue {
  user: UserRow | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRow | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      setUser(getUserByToken(token));
    } finally {
      setReady(true);
    }
  }, []);

  const startSession = useCallback((row: UserRow) => {
    const token = createSession(row.id);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(row);
  }, []);

  const login = useCallback(async (emailRaw: string, password: string) => {
    const email = emailRaw.trim().toLowerCase();
    const isAdminLogin = email === ADMIN_LOGIN.alias || email === ADMIN_EMAIL.toLowerCase();

    if (isAdminLogin) {
      if (password !== ADMIN_PASSWORD) throw new Error("Incorrect admin password.");
      const admin = ensureAdminAccount(await sha256(ADMIN_PASSWORD));
      startSession(admin);
      return;
    }

    const found = findUserByEmail(email);
    if (!found) throw new Error("No account found for this e-mail address.");
    const hash = await sha256(password);
    if (found.password_hash !== hash) throw new Error("Incorrect password. Please try again.");
    startSession(found);
  }, [startSession]);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    if (!isEmail(email)) throw new Error("Please enter a valid e-mail address.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    if (email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      throw new Error("This e-mail address is reserved for the built-in admin account.");
    }
    const hash = await sha256(password);
    const created = createUser(email, hash, name.trim());
    startSession(created);
  }, [startSession]);

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) destroySession(token);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
