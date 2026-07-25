import { NextRequest, NextResponse } from "next/server";
import { authTokensSchema } from "@video-remix/shared-types";
import { BACKEND_URL, REFRESH_COOKIE, REFRESH_COOKIE_MAX_AGE_SECONDS } from "@/lib/backend";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const backendRes = await fetch(`${BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!backendRes.ok) {
    const error = await backendRes.json().catch(() => ({ message: "Registration failed" }));
    return NextResponse.json(error, { status: backendRes.status });
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
