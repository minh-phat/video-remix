export const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export const REFRESH_COOKIE = "refresh_token";

export const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days, matches backend JWT_REFRESH_SECRET TTL
