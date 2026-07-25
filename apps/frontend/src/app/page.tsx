import Link from "next/link";
import { healthCheckSchema } from "@video-remix/shared-types";

async function getBackendHealth() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
  try {
    const res = await fetch(`${backendUrl}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Backend returned ${res.status}`);
    return healthCheckSchema.parse(await res.json());
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getBackendHealth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-50 font-sans dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Video Remix Project
      </h1>
      {health ? (
        <p className="text-green-600 dark:text-green-400">
          Backend online — status: {health.status} ({health.timestamp})
        </p>
      ) : (
        <p className="text-red-600 dark:text-red-400">
          Backend unreachable. Is it running on {process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001"}?
        </p>
      )}
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Đăng nhập
        </Link>
        <Link
          href="/register"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-black dark:border-zinc-700 dark:text-zinc-50"
        >
          Đăng ký
        </Link>
      </div>
    </div>
  );
}
