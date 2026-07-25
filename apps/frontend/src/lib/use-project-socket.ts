"use client";

import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { pageStatusEventSchema, dialogueTtsStatusEventSchema, renderStatusEventSchema } from "@video-remix/shared-types";
import type { PageStatusEvent, DialogueTtsStatusEvent, RenderStatusEvent } from "@video-remix/shared-types";
import { useAuth } from "@/lib/auth-context";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

interface ProjectSocketHandlers {
  onPageStatus?: (event: PageStatusEvent) => void;
  onDialogueTtsStatus?: (event: DialogueTtsStatusEvent) => void;
  onRenderStatus?: (event: RenderStatusEvent) => void;
}

/** Joins the `project:{projectId}` realtime room and dispatches page:status / dialogue:tts-status / render:status events. */
export function useProjectSocket(projectId: string, handlers: ProjectSocketHandlers) {
  const { accessToken } = useAuth();
  // Keep the latest handlers in a ref so the socket effect doesn't need to
  // reconnect every time the caller passes new (inline) callback identities.
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(BACKEND_URL, { auth: { token: accessToken } });
    socket.on("connect", () => socket.emit("join-project", { projectId }));
    socket.on("page:status", (payload: unknown) => {
      const parsed = pageStatusEventSchema.safeParse(payload);
      if (parsed.success) handlersRef.current.onPageStatus?.(parsed.data);
    });
    socket.on("dialogue:tts-status", (payload: unknown) => {
      const parsed = dialogueTtsStatusEventSchema.safeParse(payload);
      if (parsed.success) handlersRef.current.onDialogueTtsStatus?.(parsed.data);
    });
    socket.on("render:status", (payload: unknown) => {
      const parsed = renderStatusEventSchema.safeParse(payload);
      if (parsed.success) handlersRef.current.onRenderStatus?.(parsed.data);
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, projectId]);
}
