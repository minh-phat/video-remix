import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { Bbox, ComicPage, ConfirmPageDto, PageAnalysis, PresignedUpload } from '@video-remix/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { ANALYSIS_QUEUE } from '../../queue/queue.module';
import type { AnalysisJobData } from '../analysis/analysis.processor';
import type { ComicPage as PrismaComicPage } from '../../../generated/prisma/client';

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    @InjectQueue(ANALYSIS_QUEUE) private readonly analysisQueue: Queue<AnalysisJobData>,
  ) {}

  async list(userId: string, projectId: string): Promise<ComicPage[]> {
    await this.findOwnedProjectOrThrow(userId, projectId);
    const pages = await this.prisma.comicPage.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
    return Promise.all(pages.map((p) => this.toDto(p)));
  }

  async presignUpload(userId: string, projectId: string, contentType: string): Promise<PresignedUpload> {
    await this.findOwnedProjectOrThrow(userId, projectId);
    const extension = CONTENT_TYPE_EXTENSIONS[contentType];
    const key = this.storage.buildKey(
      'users',
      userId,
      'projects',
      projectId,
      'pages',
      `${this.storage.generateObjectId()}.${extension}`,
    );
    const uploadUrl = await this.storage.getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  async confirm(userId: string, projectId: string, dto: ConfirmPageDto): Promise<ComicPage> {
    await this.findOwnedProjectOrThrow(userId, projectId);
    const expectedPrefix = this.storage.buildKey('users', userId, 'projects', projectId, 'pages', '');
    if (!dto.key.startsWith(expectedPrefix)) throw new NotFoundException('Invalid page image key');

    const last = await this.prisma.comicPage.findFirst({
      where: { projectId },
      orderBy: { order: 'desc' },
    });
    const page = await this.prisma.comicPage.create({
      data: {
        projectId,
        imageKey: dto.key,
        order: (last?.order ?? -1) + 1,
        width: dto.width,
        height: dto.height,
      },
    });
    await this.analysisQueue.add(
      'analyze-page',
      { pageId: page.id, projectId },
      { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
    );
    return this.toDto(page);
  }

  async reorder(userId: string, projectId: string, pageIds: string[]): Promise<ComicPage[]> {
    await this.findOwnedProjectOrThrow(userId, projectId);
    const pages = await this.prisma.comicPage.findMany({ where: { projectId } });
    const validIds = new Set(pages.map((p) => p.id));
    if (pageIds.length !== pages.length || !pageIds.every((id) => validIds.has(id))) {
      throw new NotFoundException('pageIds must match exactly the pages in this project');
    }

    await this.prisma.$transaction(
      pageIds.map((id, index) => this.prisma.comicPage.update({ where: { id }, data: { order: index } })),
    );
    return this.list(userId, projectId);
  }

  async getAnalysis(userId: string, projectId: string, pageId: string): Promise<PageAnalysis> {
    await this.findOwnedProjectOrThrow(userId, projectId);
    const page = await this.prisma.comicPage.findUnique({ where: { id: pageId } });
    if (!page || page.projectId !== projectId) throw new NotFoundException('Page not found');

    const [appearances, dialogueLines] = await Promise.all([
      this.prisma.characterAppearance.findMany({ where: { pageId }, include: { character: true } }),
      this.prisma.dialogueLine.findMany({ where: { pageId }, orderBy: { order: 'asc' } }),
    ]);

    return {
      appearances: await Promise.all(
        appearances.map(async (a) => ({
          id: a.id,
          characterId: a.characterId,
          characterName: a.character?.name ?? null,
          cropUrl: await this.storage.getDownloadUrl(a.cropImageKey),
          bbox: a.bbox as unknown as Bbox,
          confidence: a.confidence,
          source: a.source,
        })),
      ),
      dialogueLines: await Promise.all(
        dialogueLines.map(async (d) => ({
          id: d.id,
          characterId: d.characterId,
          order: d.order,
          rawText: d.rawText,
          editedText: d.editedText,
          ttsAudioUrl: d.ttsAudioKey ? await this.storage.getDownloadUrl(d.ttsAudioKey) : null,
          ttsDurationMs: d.ttsDurationMs,
          ttsStatus: d.ttsStatus,
          ttsError: d.ttsError,
        })),
      ),
    };
  }

  async delete(userId: string, projectId: string, pageId: string): Promise<void> {
    await this.findOwnedProjectOrThrow(userId, projectId);
    const page = await this.prisma.comicPage.findUnique({ where: { id: pageId } });
    if (!page || page.projectId !== projectId) throw new NotFoundException('Page not found');

    await this.storage.deleteObject(page.imageKey).catch(() => {});
    await this.prisma.comicPage.delete({ where: { id: pageId } });
  }

  private async findOwnedProjectOrThrow(userId: string, projectId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');
    return project;
  }

  private async toDto(page: PrismaComicPage): Promise<ComicPage> {
    return {
      id: page.id,
      url: await this.storage.getDownloadUrl(page.imageKey),
      order: page.order,
      width: page.width,
      height: page.height,
      status: page.status,
      errorMessage: page.errorMessage,
      createdAt: page.createdAt.toISOString(),
    };
  }
}
