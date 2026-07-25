"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GEMINI_VOICES } from "@video-remix/shared-types";
import type { Character, PresignedUpload } from "@video-remix/shared-types";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { AppHeader } from "@/components/app-header";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function CharacterDetailPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = use(params);
  const { user, loading } = useRequireAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const characterQuery = useQuery({
    queryKey: ["characters", characterId],
    queryFn: () => api(`/characters/${characterId}`) as Promise<Character>,
    enabled: !!user,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["characters", characterId] });

  const deleteImage = useMutation({
    mutationFn: (imageId: string) => api(`/characters/${characterId}/reference-images/${imageId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const updateVoice = useMutation({
    mutationFn: (voiceId: string) =>
      api(`/characters/${characterId}`, { method: "PATCH", body: JSON.stringify({ voiceId }) }),
    onSuccess: invalidate,
  });

  async function handleFileSelected(file: File) {
    setUploadError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError("Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP");
      return;
    }
    setUploading(true);
    try {
      const presigned = (await api(`/characters/${characterId}/reference-images/presign`, {
        method: "POST",
        body: JSON.stringify({ contentType: file.type }),
      })) as PresignedUpload;

      const putRes = await fetch(presigned.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Tải ảnh lên thất bại");

      await api(`/characters/${characterId}/reference-images`, {
        method: "POST",
        body: JSON.stringify({ key: presigned.key }),
      });
      invalidate();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Tải ảnh lên thất bại");
    } finally {
      setUploading(false);
    }
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
      <main className="mx-auto max-w-3xl p-6">
        <Link href="/characters" className="text-sm text-zinc-500 underline dark:text-zinc-400">
          ← Quay lại thư viện nhân vật
        </Link>

        {characterQuery.isLoading && <p className="mt-4 text-zinc-500 dark:text-zinc-400">Đang tải...</p>}
        {characterQuery.isError && <p className="mt-4 text-red-600 dark:text-red-400">Không tìm thấy nhân vật.</p>}

        {characterQuery.data && (
          <>
            <h2 className="mt-4 text-xl font-semibold text-black dark:text-zinc-50">{characterQuery.data.name}</h2>
            {characterQuery.data.description && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{characterQuery.data.description}</p>
            )}

            <h3 className="mt-6 mb-2 text-sm font-medium text-black dark:text-zinc-50">Giọng lồng tiếng</h3>
            <select
              value={characterQuery.data.voiceId ?? ""}
              onChange={(e) => updateVoice.mutate(e.target.value)}
              className="w-full max-w-xs rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
            >
              <option value="" disabled>
                Chọn giọng...
              </option>
              {GEMINI_VOICES.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name} — {v.trait}
                </option>
              ))}
            </select>

            <h3 className="mt-6 mb-2 text-sm font-medium text-black dark:text-zinc-50">Ảnh tham chiếu</h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {characterQuery.data.refImages.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="Reference" className="h-full w-full object-cover" />
                  <button
                    onClick={() => deleteImage.mutate(img.id)}
                    className="absolute right-1 top-1 hidden rounded bg-black/70 px-1.5 py-0.5 text-xs text-white group-hover:block"
                  >
                    Xóa
                  </button>
                </div>
              ))}
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-zinc-300 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {uploading ? "Đang tải lên..." : "+ Thêm ảnh"}
                <input
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelected(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploadError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadError}</p>}
          </>
        )}
      </main>
    </div>
  );
}
