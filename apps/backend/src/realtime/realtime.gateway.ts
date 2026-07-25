import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { PageStatus, RenderStatus, TtsStatus } from '@video-remix/shared-types';

interface JoinProjectPayload {
  projectId: string;
}

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      this.jwtService.verify(token, { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET') });
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('join-project')
  handleJoinProject(@ConnectedSocket() client: Socket, @MessageBody() payload: JoinProjectPayload) {
    client.join(this.projectRoom(payload.projectId));
  }

  emitPageStatus(projectId: string, event: { pageId: string; status: PageStatus; errorMessage?: string | null }) {
    this.server.to(this.projectRoom(projectId)).emit('page:status', event);
  }

  emitDialogueTtsStatus(projectId: string, event: { lineId: string; status: TtsStatus; errorMessage?: string | null }) {
    this.server.to(this.projectRoom(projectId)).emit('dialogue:tts-status', event);
  }

  emitRenderStatus(
    projectId: string,
    event: { jobId: string; status: RenderStatus; progress: number; errorMessage?: string | null },
  ) {
    this.server.to(this.projectRoom(projectId)).emit('render:status', event);
  }

  private projectRoom(projectId: string): string {
    return `project:${projectId}`;
  }
}
