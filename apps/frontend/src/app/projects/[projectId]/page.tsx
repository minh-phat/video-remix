"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@video-remix/shared-types";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { AppHeader } from "@/components/app-header";

export default function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { user, loading } = useRequireAuth();
  const api = useApi();

  const projectQuery = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => api(`/projects/${projectId}`) as Promise<Project>,
    enabled: !!user,
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500 dark:text-zinc-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex-1 bg-zinc-50 dark:bg-black">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/dashboard" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          ← Quay lại danh sách dự án
        </Link>
        {projectQuery.isLoading && <p className="mt-4 text-zinc-500 dark:text-zinc-400">Đang tải...</p>}
        {projectQuery.isError && <p className="mt-4 text-red-600 dark:text-red-400">Không tìm thấy dự án.</p>}
        {projectQuery.data && (
          <>
            <h2 className="mt-4 text-xl font-semibold text-black dark:text-zinc-50">{projectQuery.data.title}</h2>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Trạng thái: {projectQuery.data.status}</p>
            <div className="mt-4 flex gap-3">
              <Link
                href={`/projects/${projectId}/pages`}
                className="inline-block rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
              >
                Quản lý trang truyện
              </Link>
              <Link
                href={`/projects/${projectId}/render`}
                className="inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
              >
                Dựng video
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
