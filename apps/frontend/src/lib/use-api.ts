"use client";

import { useCallback } from "react";
import { useAuth } from "@/lib/auth-context";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  if (Array.isArray(body?.message)) return body.message.join(", ");
  return body?.message ?? `Request failed (${res.status})`;
}

/** Returns a fetch function that attaches the current access token and transparently
 * retries once after refreshing the session if the backend responds with 401. */
export function useApi() {
  const { accessToken, refreshSession } = useAuth();

  return useCallback(
    async (path: string, init: RequestInit = {}, token = accessToken): Promise<unknown> => {
      const doFetch = (bearer: string | null) =>
        fetch(`${BACKEND_URL}${path}`, {
          ...init,
          headers: {
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
            ...init.headers,
          },
        });

      let res = await doFetch(token);
      if (res.status === 401) {
        const newToken = await refreshSession();
        if (!newToken) throw new ApiError("Session expired", 401);
        res = await doFetch(newToken);
      }

      if (res.status === 204) return undefined;
      if (!res.ok) throw new ApiError(await parseErrorMessage(res), res.status);
      return res.json();
    },
    [accessToken, refreshSession],
  );
}
