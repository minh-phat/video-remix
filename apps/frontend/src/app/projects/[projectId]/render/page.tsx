"use client";

import { use } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { VideoRenderJob } from "@video-remix/shared-types";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi, ApiError } from "@/lib/use-api";
import { useProjectSocket } from "@/lib/use-project-socket";
import { AppHeader } from "@/components/app-header";

const STATUS_LABEL: Record<VideoRenderJob["status"], string> = {
  QUEUED: "Đang chờ trong hàng đợi...",
  RENDERING: "Đang dựng video...",
  DONE: "Hoàn tất",
  FAILED: "Dựng video thất bại",
};

export default function RenderPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { user, loading } = useRequireAuth();
  const api = useApi();
  const queryClient = useQueryClient();

  const jobKey = ["projects", projectId, "render"];
  const jobQuery = useQuery({
    queryKey: jobKey,
    queryFn: () => api(`/projects/${projectId}/render`) as Promise<VideoRenderJob | null>,
    enabled: !!user,
  });

  useProjectSocket(projectId, {
    onRenderStatus: (event) => {
      queryClient.setQueryData<VideoRenderJob | null>(jobKey, (job) =>
        job && job.id === event.jobId
          ? { ...job, status: event.status, progress: event.progress, errorMessage: event.errorMessage ?? null }
          : job,
      );
      if (event.status === "DONE" || event.status === "FAILED") {
        queryClient.invalidateQueries({ queryKey: jobKey });
      }
    },
  });

  const startRender = useMutation({
    mutationFn: () => api(`/projects/${projectId}/render`, { method: "POST" }) as Promise<VideoRenderJob>,
    onSuccess: (job) => queryClient.setQueryData(jobKey, job),
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500 dark:text-zinc-400">Đang tải...</p>
      </div>
    );
  }

  const job = jobQuery.data;
  const isActive = job && (job.status === "QUEUED" || job.status === "RENDERING");

  return (
    <div className="min-h-screen flex-1 bg-zinc-50 dark:bg-black">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-2xl p-6">
        <Link href={`/projects/${projectId}`} className="text-sm text-zinc-500 underline dark:text-zinc-400">
          ← Quay lại dự án
        </Link>
        <h2 className="mt-4 mb-4 text-lg font-semibold text-black dark:text-zinc-50">Dựng video</h2>

        <button
          onClick={() => startRender.mutate()}
          disabled={!!isActive || startRender.isPending}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {job ? "Dựng lại video" : "Dựng video"}
        </button>

        {startRender.isError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            {startRender.error instanceof ApiError ? startRender.error.message : "Không thể bắt đầu dựng video"}
          </p>
        )}

        {job && (
          <div className="mt-6">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-black dark:text-zinc-50">{STATUS_LABEL[job.status]}</span>
              {isActive && <span className="text-zinc-500 dark:text-zinc-400">{job.progress}%</span>}
            </div>
            {isActive && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full bg-black transition-all dark:bg-white"
                  style={{ width: `${job.progress}%` }}
                />
              </div>
            )}
            {job.status === "FAILED" && job.errorMessage && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{job.errorMessage}</p>
            )}
            {job.status === "DONE" && job.outputUrl && (
              <div className="mt-4 space-y-3">
                <video controls src={job.outputUrl} className="w-full rounded-md border border-zinc-200 dark:border-zinc-800" />
                <a
                  href={job.outputUrl}
                  download
                  className="inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
                >
                  Tải video xuống
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
