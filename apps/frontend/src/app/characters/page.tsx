"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Character } from "@video-remix/shared-types";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { AppHeader } from "@/components/app-header";

export default function CharactersPage() {
  const { user, loading } = useRequireAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const charactersQuery = useQuery({
    queryKey: ["characters"],
    queryFn: () => api("/characters") as Promise<Character[]>,
    enabled: !!user,
  });

  const createCharacter = useMutation({
    mutationFn: (name: string) => api("/characters", { method: "POST", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      setName("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["characters"] });
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
        <h2 className="mb-1 text-lg font-semibold text-black dark:text-zinc-50">Thư viện nhân vật</h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Thêm nhân vật kèm ảnh tham chiếu để hệ thống tự động nhận diện đúng nhân vật khi dựng video.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) createCharacter.mutate(name.trim());
          }}
          className="mb-6 flex gap-2"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên nhân vật (vd: Naruto)"
            className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={createCharacter.isPending}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Thêm nhân vật
          </button>
        </form>
        {error && <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {charactersQuery.isLoading && <p className="text-zinc-500 dark:text-zinc-400">Đang tải...</p>}
        {charactersQuery.data?.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">Chưa có nhân vật nào. Thêm nhân vật đầu tiên ở trên.</p>
        )}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {charactersQuery.data?.map((character) => (
            <Link
              key={character.id}
              href={`/characters/${character.id}`}
              className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="mb-2 flex aspect-square items-center justify-center overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                {character.refImages[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={character.refImages[0].url} alt={character.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-zinc-400">Chưa có ảnh</span>
                )}
              </div>
              <p className="truncate text-sm font-medium text-black dark:text-zinc-50">{character.name}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{character.refImages.length} ảnh tham chiếu</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
