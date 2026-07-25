import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { TTS_QUEUE } from '../../queue/queue.module';
import type { TtsJobData } from './tts.processor';

const JOB_OPTIONS = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } };

@Injectable()
export class TtsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(TTS_QUEUE) private readonly ttsQueue: Queue<TtsJobData>,
  ) {}

  async enqueueLine(userId: string, projectId: string, pageId: string, lineId: string): Promise<void> {
    await this.findOwnedLine(userId, projectId, pageId, lineId);
    await this.prisma.dialogueLine.update({ where: { id: lineId }, data: { ttsStatus: 'QUEUED', ttsError: null } });
    await this.ttsQueue.add('synthesize-line', { lineId }, JOB_OPTIONS);
  }

  async enqueueProject(userId: string, projectId: string): Promise<{ enqueued: number }> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');

    const lines = await this.prisma.dialogueLine.findMany({
      where: { page: { projectId }, ttsStatus: { in: ['PENDING', 'ERROR'] } },
      select: { id: true },
    });

    await this.prisma.dialogueLine.updateMany({
      where: { id: { in: lines.map((l) => l.id) } },
      data: { ttsStatus: 'QUEUED', ttsError: null },
    });
    await this.ttsQueue.addBulk(
      lines.map((l) => ({ name: 'synthesize-line', data: { lineId: l.id }, opts: JOB_OPTIONS })),
    );

    return { enqueued: lines.length };
  }

  private async findOwnedLine(userId: string, projectId: string, pageId: string, lineId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');

    const line = await this.prisma.dialogueLine.findUnique({ where: { id: lineId } });
    if (!line || line.pageId !== pageId) throw new NotFoundException('Dialogue line not found');
    return line;
  }
}
