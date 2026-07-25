import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, REFRESH_COOKIE } from "@/lib/backend";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader) {
    await fetch(`${BACKEND_URL}/auth/logout`, {
      method: "POST",
      headers: { authorization: authHeader },
    }).catch(() => {});
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete(REFRESH_COOKIE);
  return res;
}
