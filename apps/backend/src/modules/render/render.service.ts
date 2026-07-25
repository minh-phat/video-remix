import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { VideoRenderJob } from '@video-remix/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { RENDER_QUEUE } from '../../queue/queue.module';
import type { RenderJobData } from './render.processor';
import type { VideoRenderJob as PrismaVideoRenderJob } from '../../../generated/prisma/client';

@Injectable()
export class RenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(RENDER_QUEUE) private readonly renderQueue: Queue<RenderJobData>,
  ) {}

  async createJob(userId: string, projectId: string): Promise<VideoRenderJob> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');

    const pages = await this.prisma.comicPage.findMany({ where: { projectId } });
    if (pages.length === 0) throw new BadRequestException('Dự án chưa có trang truyện nào để dựng video');

    const pendingLines = await this.prisma.dialogueLine.count({
      where: { page: { projectId }, ttsStatus: { not: 'DONE' } },
    });
    if (pendingLines > 0) {
      throw new BadRequestException(
        `${pendingLines} dòng thoại chưa có lồng tiếng. Hãy tạo lồng tiếng trước khi dựng video.`,
      );
    }

    const job = await this.prisma.videoRenderJob.create({ data: { projectId, status: 'QUEUED' } });
    await this.renderQueue.add('render-project', { jobId: job.id, projectId }, { attempts: 1 });
    return this.toDto(job);
  }

  async getLatestJob(userId: string, projectId: string): Promise<VideoRenderJob | null> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');

    const job = await this.prisma.videoRenderJob.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' } });
    return job ? this.toDto(job) : null;
  }

  private async toDto(job: PrismaVideoRenderJob): Promise<VideoRenderJob> {
    return {
      id: job.id,
      status: job.status,
      progress: job.progress,
      outputUrl: job.outputKey ? await this.storage.getDownloadUrl(job.outputKey) : null,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt.toISOString(),
    };
  }
}
