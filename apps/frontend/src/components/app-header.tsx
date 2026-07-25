"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dự án" },
  { href: "/characters", label: "Nhân vật" },
];

export function AppHeader({ email }: { email: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
      <div className="flex items-center gap-6">
        <span className="text-lg font-semibold text-black dark:text-zinc-50">Video Remix Project</span>
        <nav className="flex gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm ${
                pathname.startsWith(link.href)
                  ? "font-medium text-black dark:text-zinc-50"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-600 dark:text-zinc-400">{email}</span>
        <button
          onClick={async () => {
            await logout();
            router.push("/login");
          }}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
