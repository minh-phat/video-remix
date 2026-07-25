"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { UserProfile } from "@video-remix/shared-types";

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-establishes the access token from the httpOnly refresh cookie. Returns the new token, or null if the session is gone. */
  refreshSession: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (Array.isArray(body?.message)) return body.message.join(", ");
  return body?.message ?? "Something went wrong";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, loading: true });
  const accessTokenRef = useRef<string | null>(null);
  const attemptedInitialRefresh = useRef(false);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    if (!res.ok) {
      accessTokenRef.current = null;
      setState({ user: null, accessToken: null, loading: false });
      return null;
    }
    const data = await res.json();
    accessTokenRef.current = data.accessToken;
    setState({ user: data.user, accessToken: data.accessToken, loading: false });
    return data.accessToken as string;
  }, []);

  useEffect(() => {
    if (attemptedInitialRefresh.current) return;
    attemptedInitialRefresh.current = true;
    refreshSession().catch(() => setState({ user: null, accessToken: null, loading: false }));
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res));
    const data = await res.json();
    accessTokenRef.current = data.accessToken;
    setState({ user: data.user, accessToken: data.accessToken, loading: false });
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseErrorMessage(res));
    const data = await res.json();
    accessTokenRef.current = data.accessToken;
    setState({ user: data.user, accessToken: data.accessToken, loading: false });
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: accessTokenRef.current ? { authorization: `Bearer ${accessTokenRef.current}` } : {},
    }).catch(() => {});
    accessTokenRef.current = null;
    setState({ user: null, accessToken: null, loading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
