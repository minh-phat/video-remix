"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Character, CharacterAppearanceDto, DialogueLineDto, PageAnalysis } from "@video-remix/shared-types";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useApi } from "@/lib/use-api";
import { useProjectSocket } from "@/lib/use-project-socket";
import { AppHeader } from "@/components/app-header";

const UNASSIGNED = "__unassigned__";

function AppearanceCard({
  appearance,
  characters,
  onAssign,
  onSaveAsCharacter,
}: {
  appearance: CharacterAppearanceDto;
  characters: Character[];
  onAssign: (characterId: string | null) => void;
  onSaveAsCharacter: (name: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={appearance.cropUrl} alt={appearance.characterName ?? "Chưa xác định"} className="aspect-square w-full object-cover" />
      <div className="space-y-1.5 p-2">
        <select
          value={appearance.characterId ?? UNASSIGNED}
          onChange={(e) => onAssign(e.target.value === UNASSIGNED ? null : e.target.value)}
          className="w-full rounded border border-zinc-300 bg-transparent px-1 py-1 text-xs text-black dark:border-zinc-700 dark:text-zinc-50"
        >
          <option value={UNASSIGNED}>Chưa xác định</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-center text-[10px] text-zinc-500 dark:text-zinc-400">
          {Math.round(appearance.confidence * 100)}% · {appearance.source === "MANUAL" ? "thủ công" : "tự động"}
        </p>
        {!appearance.characterId && !creating && (
          <button
            onClick={() => setCreating(true)}
            className="w-full rounded bg-emerald-600 px-1.5 py-1 text-[10px] text-white"
          >
            Lưu thành nhân vật mới
          </button>
        )}
        {creating && (
          <div className="space-y-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Tên nhân vật"
              className="w-full rounded border border-zinc-300 bg-transparent px-1 py-1 text-xs text-black dark:border-zinc-700 dark:text-zinc-50"
            />
            <div className="flex gap-1">
              <button
                onClick={() => {
                  if (newName.trim()) {
                    onSaveAsCharacter(newName.trim());
                    setCreating(false);
                    setNewName("");
                  }
                }}
                className="flex-1 rounded bg-emerald-600 px-1.5 py-1 text-[10px] text-white"
              >
                Lưu
              </button>
              <button
                onClick={() => setCreating(false)}
                className="flex-1 rounded border border-zinc-300 px-1.5 py-1 text-[10px] text-black dark:border-zinc-700 dark:text-zinc-50"
              >
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TTS_STATUS_LABEL: Record<DialogueLineDto["ttsStatus"], string | null> = {
  PENDING: null,
  QUEUED: "Đang tạo lồng tiếng...",
  DONE: null,
  ERROR: "Lỗi tạo lồng tiếng",
};

function DialogueRow({
  line,
  characters,
  onSave,
  onDelete,
  onGenerateTts,
}: {
  line: DialogueLineDto;
  characters: Character[];
  onSave: (patch: { editedText?: string; characterId?: string | null }) => void;
  onDelete: () => void;
  onGenerateTts: () => void;
}) {
  const [text, setText] = useState(line.editedText);
  const statusLabel = TTS_STATUS_LABEL[line.ttsStatus];

  return (
    <li className="flex items-start gap-2 rounded-md border border-zinc-200 bg-black p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex-1 space-y-1.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text.trim() && text !== line.editedText) onSave({ editedText: text.trim() });
          }}
          rows={2}
          className="w-full resize-none rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={line.characterId ?? UNASSIGNED}
            onChange={(e) => onSave({ characterId: e.target.value === UNASSIGNED ? null : e.target.value })}
            className="rounded border border-zinc-300 bg-transparent px-1.5 py-1 text-xs text-black dark:border-zinc-700 dark:text-zinc-50"
          >
            <option value={UNASSIGNED}>Chưa gán người nói</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={onGenerateTts}
            disabled={line.ttsStatus === "QUEUED"}
            className="rounded border border-zinc-300 px-2 py-1 text-xs text-black disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-50"
          >
            {line.ttsAudioUrl ? "Tạo lại lồng tiếng" : "Tạo lồng tiếng"}
          </button>
          {statusLabel && (
            <span className={line.ttsStatus === "ERROR" ? "text-xs text-red-600 dark:text-red-400" : "text-xs text-amber-600 dark:text-amber-400"}>
              {statusLabel}
            </span>
          )}
        </div>
        {line.ttsAudioUrl && <audio controls src={line.ttsAudioUrl} className="h-8 w-full max-w-xs" />}
      </div>
      <button onClick={onDelete} className="shrink-0 rounded border border-zinc-300 px-2 py-1 text-xs text-black dark:border-zinc-700 dark:text-zinc-50">
        Xóa
      </button>
    </li>
  );
}

export default function PageAnalysisView({
  params,
}: {
  params: Promise<{ projectId: string; pageId: string }>;
}) {
  const { projectId, pageId } = use(params);
  const { user, loading } = useRequireAuth();
  const api = useApi();
  const queryClient = useQueryClient();
  const [newLineText, setNewLineText] = useState("");

  const analysisKey = ["projects", projectId, "pages", pageId, "analysis"];
  const analysisQuery = useQuery({
    queryKey: analysisKey,
    queryFn: () => api(`/projects/${projectId}/pages/${pageId}/analysis`) as Promise<PageAnalysis>,
    enabled: !!user,
  });

  const charactersQuery = useQuery({
    queryKey: ["characters"],
    queryFn: () => api("/characters") as Promise<Character[]>,
    enabled: !!user,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: analysisKey });
  };

  useProjectSocket(projectId, {
    onDialogueTtsStatus: (event) => {
      queryClient.setQueryData<PageAnalysis>(analysisKey, (data) =>
        data
          ? {
            ...data,
            dialogueLines: data.dialogueLines.map((l) =>
              l.id === event.lineId ? { ...l, ttsStatus: event.status, ttsError: event.errorMessage ?? null } : l,
            ),
          }
          : data,
      );
      if (event.status === "DONE") invalidate();
    },
  });

  const updateLine = useMutation({
    mutationFn: ({ lineId, patch }: { lineId: string; patch: { editedText?: string; characterId?: string | null } }) =>
      api(`/projects/${projectId}/pages/${pageId}/dialogue-lines/${lineId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });

  const deleteLine = useMutation({
    mutationFn: (lineId: string) =>
      api(`/projects/${projectId}/pages/${pageId}/dialogue-lines/${lineId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const addLine = useMutation({
    mutationFn: (editedText: string) =>
      api(`/projects/${projectId}/pages/${pageId}/dialogue-lines`, {
        method: "POST",
        body: JSON.stringify({ editedText }),
      }),
    onSuccess: () => {
      setNewLineText("");
      invalidate();
    },
  });

  const generateTts = useMutation({
    mutationFn: (lineId: string) =>
      api(`/projects/${projectId}/pages/${pageId}/dialogue-lines/${lineId}/generate-tts`, { method: "POST" }),
    onSuccess: invalidate,
  });

  const assignAppearance = useMutation({
    mutationFn: ({ appearanceId, characterId }: { appearanceId: string; characterId: string | null }) =>
      api(`/projects/${projectId}/pages/${pageId}/appearances/${appearanceId}`, {
        method: "PATCH",
        body: JSON.stringify({ characterId }),
      }),
    onSuccess: invalidate,
  });

  const saveAsCharacter = useMutation({
    mutationFn: ({ appearanceId, name }: { appearanceId: string; name: string }) =>
      api(`/projects/${projectId}/pages/${pageId}/appearances/${appearanceId}/save-as-character`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["characters"] });
    },
  });

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500 dark:text-zinc-400">Đang tải...</p>
      </div>
    );
  }

  const characters = charactersQuery.data ?? [];

  return (
    <div className="min-h-screen flex-1 bg-zinc-50 dark:bg-black">
      <AppHeader email={user.email} />
      <main className="mx-auto max-w-3xl p-6">
        <Link href={`/projects/${projectId}/pages`} className="text-sm text-zinc-500 underline dark:text-zinc-400">
          ← Quay lại danh sách trang
        </Link>
        <h2 className="mt-4 mb-4 text-lg font-semibold text-black dark:text-zinc-50">Rà soát trang</h2>

        {analysisQuery.isLoading && <p className="text-zinc-500 dark:text-zinc-400">Đang tải...</p>}

        {analysisQuery.data && (
          <>
            <section className="mb-8">
              <h3 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">
                Nhân vật phát hiện ({analysisQuery.data.appearances.length})
              </h3>
              {analysisQuery.data.appearances.length === 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Không phát hiện nhân vật nào.</p>
              )}
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {analysisQuery.data.appearances.map((a) => (
                  <AppearanceCard
                    key={a.id}
                    appearance={a}
                    characters={characters}
                    onAssign={(characterId) => assignAppearance.mutate({ appearanceId: a.id, characterId })}
                    onSaveAsCharacter={(name) => saveAsCharacter.mutate({ appearanceId: a.id, name })}
                  />
                ))}
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium text-black dark:text-zinc-50">
                Lời thoại ({analysisQuery.data.dialogueLines.length})
              </h3>
              <ol className="space-y-2">
                {analysisQuery.data.dialogueLines.map((line) => (
                  <DialogueRow
                    key={line.id}
                    line={line}
                    characters={characters}
                    onSave={(patch) => updateLine.mutate({ lineId: line.id, patch })}
                    onDelete={() => deleteLine.mutate(line.id)}
                    onGenerateTts={() => generateTts.mutate(line.id)}
                  />
                ))}
              </ol>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newLineText.trim()) addLine.mutate(newLineText.trim());
                }}
                className="mt-3 flex gap-2"
              >
                <input
                  value={newLineText}
                  onChange={(e) => setNewLineText(e.target.value)}
                  placeholder="Thêm dòng thoại mới..."
                  className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-black dark:border-zinc-700 dark:text-zinc-50"
                />
                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
                >
                  Thêm
                </button>
              </form>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
