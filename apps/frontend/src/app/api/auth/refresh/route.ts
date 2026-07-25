import { NextRequest, NextResponse } from "next/server";
import { authTokensSchema } from "@video-remix/shared-types";
import { BACKEND_URL, REFRESH_COOKIE, REFRESH_COOKIE_MAX_AGE_SECONDS } from "@/lib/backend";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: "No session" }, { status: 401 });
  }

  const backendRes = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!backendRes.ok) {
    const res = NextResponse.json({ message: "Session expired" }, { status: 401 });
    res.cookies.delete(REFRESH_COOKIE);
    return res;
  }

  const tokens = authTokensSchema.parse(await backendRes.json());
  const res = NextResponse.json({ accessToken: tokens.accessToken, user: tokens.user });
  res.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
  return res;
}
