"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Project } from "@video-remix/shared-types";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { AppHeader } from "@/components/app-header";

const STATUS_LABELS: Record<Project["status"], string> = {
  DRAFT: "Nháp",
  ANALYZING: "Đang phân tích",
  READY_FOR_REVIEW: "Chờ rà soát",
  RENDERING: "Đang dựng video",
  DONE: "Hoàn tất",
};

export default function DashboardPage() {
  const { user, loading } = useRequireAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: () => api("/projects") as Promise<Project[]>,
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: (title: string) => api("/projects", { method: "POST", body: JSON.stringify({ title }) }),
    onSuccess: () => {
      setTitle("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (err: Error) => setError(err.message),
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
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">Dự án của bạn</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) createProject.mutate(title.trim());
          }}
          className="mb-6 flex gap-2"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tên dự án (vd: Truyện tranh tập 1)"
            className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={createProject.isPending}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Tạo dự án
          </button>
        </form>
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {projectsQuery.isLoading && <p className="text-zinc-500 dark:text-zinc-400">Đang tải dự án...</p>}
        {projectsQuery.data?.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">Chưa có dự án nào. Tạo dự án đầu tiên ở trên.</p>
        )}
        <ul className="space-y-2">
          {projectsQuery.data?.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className="text-black dark:text-zinc-50">{project.title}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{STATUS_LABELS[project.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
