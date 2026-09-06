/** Session handling — mirrors Supabase Auth (e-mail/password, token sessions). */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { UserRow } from "../types";
import {
  createSession, createUser, destroySession, ensureDemoAccount, findUserByEmail,
  getUserByToken, DEMO_EMAIL, DEMO_PASSWORD,
} from "./db";
import { isEmail, sha256 } from "./util";

const TOKEN_KEY = "mscraper.token";

interface AuthContextValue {
  user: UserRow | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  demoLogin: () => Promise<void>;
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

  const login = useCallback(async (email: string, password: string) => {
    const found = findUserByEmail(email);
    if (!found) throw new Error("No account found for this e-mail address.");
    const hash = await sha256(password);
    if (found.password_hash !== hash) throw new Error("Incorrect password. Please try again.");
    const token = createSession(found.id);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(found);
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string) => {
    if (!isEmail(email)) throw new Error("Please enter a valid e-mail address.");
    if (password.length < 6) throw new Error("Password must be at least 6 characters.");
    const hash = await sha256(password);
    const created = createUser(email, hash, name.trim());
    const token = createSession(created.id);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(created);
  }, []);

  const demoLogin = useCallback(async () => {
    const hash = await sha256(DEMO_PASSWORD);
    const demoUser = ensureDemoAccount(hash);
    const token = createSession(demoUser.id);
    localStorage.setItem(TOKEN_KEY, token);
    setUser(demoUser);
    void DEMO_EMAIL;
  }, []);

  const logout = useCallback(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) destroySession(token);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, signup, demoLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
