"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ComicPage, PresignedUpload } from "@video-remix/shared-types";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { useProjectSocket } from "@/lib/use-project-socket";
import { AppHeader } from "@/components/app-header";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION_PX = 8000;
const MAX_ASPECT_RATIO = 4;

async function validateImageFile(file: File): Promise<string | null> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Ảnh "${file.name}" quá lớn (${(file.size / 1024 / 1024).toFixed(1)}MB, giới hạn 20MB).`;
  }
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const { width, height } = bitmap;
  bitmap.close();
  const longSide = Math.max(width, height);
  const shortSide = Math.max(1, Math.min(width, height));
  if (longSide > MAX_DIMENSION_PX || longSide / shortSide > MAX_ASPECT_RATIO) {
    return `Ảnh "${file.name}" (${width}x${height}px) có vẻ là cả một chương thay vì một trang truyện. Vui lòng tách thành từng trang riêng lẻ trước khi upload.`;
  }
  return null;
}

const STATUS_BADGE: Partial<Record<ComicPage["status"], { label: string; className: string }>> = {
  ANALYZING: { label: "Đang phân tích...", className: "bg-amber-500/90 text-white" },
  ERROR: { label: "Lỗi phân tích", className: "bg-red-600/90 text-white" },
};

function SortablePage({
  page,
  displayIndex,
  projectId,
  onDelete,
}: {
  page: ComicPage;
  displayIndex: number;
  projectId: string;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group relative aspect-[3/4] cursor-grab overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 active:cursor-grabbing dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={page.url} alt={`Trang ${displayIndex + 1}`} className="h-full w-full object-cover" />
      <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">
        {displayIndex + 1}
      </span>
      {STATUS_BADGE[page.status] && (
        <span
          title={page.errorMessage ?? undefined}
          className={`absolute bottom-1 left-1 right-1 rounded px-1.5 py-0.5 text-center text-[10px] ${STATUS_BADGE[page.status]!.className}`}
        >
          {STATUS_BADGE[page.status]!.label}
        </span>
      )}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(page.id)}
        className="absolute right-1 top-1 hidden rounded bg-black/70 px-1.5 py-0.5 text-xs text-white group-hover:block"
      >
        Xóa
      </button>
      {page.status === "ANALYZED" && (
        <Link
          href={`/projects/${projectId}/pages/${page.id}`}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute inset-x-1 bottom-1 hidden rounded bg-emerald-600/90 px-1.5 py-0.5 text-center text-[10px] text-white group-hover:block"
        >
          Rà soát
        </Link>
      )}
    </div>
  );
}

export default function ProjectPagesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const { user, loading } = useRequireAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const queryKey = ["projects", projectId, "pages"];
  const pagesQuery = useQuery({
    queryKey,
    queryFn: () => api(`/projects/${projectId}/pages`) as Promise<ComicPage[]>,
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  useProjectSocket(projectId, {
    onPageStatus: (event) => {
      queryClient.setQueryData<ComicPage[]>(queryKey, (pages) =>
        pages?.map((p) => (p.id === event.pageId ? { ...p, status: event.status, errorMessage: event.errorMessage ?? null } : p)),
      );
    },
  });

  const deletePage = useMutation({
    mutationFn: (pageId: string) => api(`/projects/${projectId}/pages/${pageId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const reorderPages = useMutation({
    mutationFn: (pageIds: string[]) =>
      api(`/projects/${projectId}/pages/reorder`, { method: "PATCH", body: JSON.stringify({ pageIds }) }),
    onSuccess: invalidate,
  });

  const generateNarration = useMutation({
    mutationFn: () => api(`/projects/${projectId}/generate-narration`, { method: "POST" }) as Promise<{ enqueued: number }>,
  });

  async function uploadOne(file: File) {
    const presigned = (await api(`/projects/${projectId}/pages/presign`, {
      method: "POST",
      body: JSON.stringify({ contentType: file.type }),
    })) as PresignedUpload;

    const putRes = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error(`Tải lên thất bại: ${file.name}`);

    await api(`/projects/${projectId}/pages`, { method: "POST", body: JSON.stringify({ key: presigned.key }) });
  }

  async function handleFilesSelected(files: FileList) {
    setUploadError(null);
    const typeValid = Array.from(files).filter((f) => ACCEPTED_TYPES.includes(f.type));
    if (typeValid.length === 0) {
      setUploadError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP");
      return;
    }

    const valid: File[] = [];
    const errors: string[] = [];
    for (const file of typeValid) {
      const error = await validateImageFile(file);
      if (error) errors.push(error);
      else valid.push(file);
    }
    if (errors.length > 0) setUploadError(errors.join(" "));
    if (valid.length === 0) return;

    setUploadingCount(valid.length);
    try {
      for (const file of valid) {
        await uploadOne(file);
        setUploadingCount((n) => n - 1);
      }
      invalidate();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Tải ảnh lên thất bại");
      setUploadingCount(0);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !pagesQuery.data) return;

    const oldIndex = pagesQuery.data.findIndex((p) => p.id === active.id);
    const newIndex = pagesQuery.data.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(pagesQuery.data, oldIndex, newIndex);

    queryClient.setQueryData(queryKey, reordered.map((p, i) => ({ ...p, order: i })));
    reorderPages.mutate(reordered.map((p) => p.id));
  }

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
      <main className="mx-auto max-w-4xl p-6">
        <Link href={`/projects/${projectId}`} className="text-sm text-zinc-500 underline dark:text-zinc-400">
          ← Quay lại dự án
        </Link>
        <div className="mt-4 mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Trang truyện tranh</h2>
          <button
            onClick={() => generateNarration.mutate()}
            disabled={generateNarration.isPending}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-black disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50"
          >
            Tạo lồng tiếng cho toàn bộ dự án
          </button>
        </div>
        {generateNarration.data && (
          <p className="mb-2 text-sm text-emerald-600 dark:text-emerald-400">
            Đã đưa {generateNarration.data.enqueued} dòng thoại vào hàng đợi tạo lồng tiếng.
          </p>
        )}
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Upload ảnh chụp từng trang truyện. Kéo-thả để sắp xếp lại thứ tự.
        </p>

        <label className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-zinc-300 px-6 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          {uploadingCount > 0 ? `Đang tải lên... còn ${uploadingCount}` : "Nhấn để chọn ảnh (có thể chọn nhiều ảnh)"}
          <input
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            disabled={uploadingCount > 0}
            onChange={(e) => {
              if (e.target.files?.length) handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        {uploadError && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}

        {pagesQuery.isLoading && <p className="text-zinc-500 dark:text-zinc-400">Đang tải...</p>}
        {pagesQuery.data?.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">Chưa có trang nào. Upload ảnh ở trên.</p>
        )}
        {pagesQuery.data && pagesQuery.data.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={pagesQuery.data.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {pagesQuery.data.map((page, index) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    displayIndex={index}
                    projectId={projectId}
                    onDelete={(id) => deletePage.mutate(id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>
    </div>
  );
}
