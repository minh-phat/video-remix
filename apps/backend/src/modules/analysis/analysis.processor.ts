import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { ANALYSIS_QUEUE } from '../../queue/queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { GeminiService } from '../../ai-providers/gemini.service';
import { VectorService } from '../../vector/vector.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import type { DetectedCharacter } from '../../ai-providers/gemini.service';

export interface AnalysisJobData {
  pageId: string;
  projectId: string;
}

interface PixelCrop {
  left: number;
  top: number;
  width: number;
  height: number;
}

const MAX_LONG_SIDE_PX = 8000;
const MAX_ASPECT_RATIO = 4;

function box2dToPixelCrop(box2d: [number, number, number, number], imageWidth: number, imageHeight: number): PixelCrop {
  const [ymin, xmin, ymax, xmax] = box2d;
  const left = Math.max(0, Math.min(imageWidth - 1, Math.round((xmin / 1000) * imageWidth)));
  const top = Math.max(0, Math.min(imageHeight - 1, Math.round((ymin / 1000) * imageHeight)));
  const right = Math.max(left + 1, Math.min(imageWidth, Math.round((xmax / 1000) * imageWidth)));
  const bottom = Math.max(top + 1, Math.min(imageHeight, Math.round((ymax / 1000) * imageHeight)));
  return { left, top, width: right - left, height: bottom - top };
}

@Processor(ANALYSIS_QUEUE)
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
    private readonly vector: VectorService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<AnalysisJobData>): Promise<void> {
    const { pageId, projectId } = job.data;

    try {
      await this.setStatus(projectId, pageId, 'ANALYZING');
      await this.runAnalysis(pageId, projectId);
      await this.setStatus(projectId, pageId, 'ANALYZED');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Analysis failed for page ${pageId}: ${message}`);
      await this.prisma.comicPage.update({ where: { id: pageId }, data: { status: 'ERROR', errorMessage: message } });
      this.realtime.emitPageStatus(projectId, { pageId, status: 'ERROR', errorMessage: message });
      throw err;
    }
  }

  private async runAnalysis(pageId: string, projectId: string): Promise<void> {
    const page = await this.prisma.comicPage.findUniqueOrThrow({ where: { id: pageId } });
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    const userId = project.userId;

    const { buffer: pageBuffer, contentType } = await this.storage.getObjectBuffer(page.imageKey);
    const mimeType = contentType ?? 'image/jpeg';
    const { width: imageWidth, height: imageHeight } = await sharp(pageBuffer).metadata();
    if (!imageWidth || !imageHeight) throw new Error('Could not read page image dimensions');

    const longSide = Math.max(imageWidth, imageHeight);
    const shortSide = Math.max(1, Math.min(imageWidth, imageHeight));
    if (longSide > MAX_LONG_SIDE_PX || longSide / shortSide > MAX_ASPECT_RATIO) {
      throw new UnrecoverableError(
        `Ảnh có kích thước ${imageWidth}x${imageHeight}px, quá lớn/quá dài để phân tích như một trang truyện (có thể bạn đã upload cả một chương thay vì từng trang). Vui lòng tách thành từng trang riêng lẻ rồi upload lại.`,
      );
    }

    const knownCharacters = await this.prisma.character.findMany({ where: { userId }, select: { id: true, name: true } });
    const analysis = await this.gemini.analyzePage(pageBuffer, mimeType, knownCharacters.map((c) => c.name));

    for (const detected of analysis.characters) {
      await this.saveAppearance(pageId, userId, pageBuffer, imageWidth, imageHeight, detected, knownCharacters);
    }

    if (analysis.dialogue.length > 0) {
      await this.prisma.dialogueLine.createMany({
        data: analysis.dialogue.map((line) => ({
          pageId,
          order: line.order,
          rawText: line.text,
          editedText: line.text,
        })),
      });
    }
  }

  private async saveAppearance(
    pageId: string,
    userId: string,
    pageBuffer: Buffer,
    imageWidth: number,
    imageHeight: number,
    detected: DetectedCharacter,
    knownCharacters: { id: string; name: string }[],
  ): Promise<void> {
    const crop = box2dToPixelCrop(detected.box2d, imageWidth, imageHeight);
    const cropBuffer = await sharp(pageBuffer).extract(crop).jpeg().toBuffer();
    const cropKey = this.storage.buildKey('users', userId, 'projects', 'crops', `${this.storage.generateObjectId()}.jpg`);
    await this.storage.putObject(cropKey, cropBuffer, 'image/jpeg');

    const embedding = await this.gemini.embedImage(cropBuffer, 'image/jpeg');

    let characterId: string | null = null;
    let confidence = detected.confidence;

    const nameMatch = detected.matchedKnownName
      ? knownCharacters.find((c) => c.name.toLowerCase() === detected.matchedKnownName?.toLowerCase())
      : undefined;
    if (nameMatch) {
      characterId = nameMatch.id;
    } else {
      const nearest = await this.vector.findNearestCharacter(userId, embedding);
      if (nearest) {
        characterId = nearest.characterId;
        confidence = nearest.similarity;
      }
    }

    const appearance = await this.prisma.characterAppearance.create({
      data: {
        pageId,
        characterId,
        bbox: { ymin: detected.box2d[0], xmin: detected.box2d[1], ymax: detected.box2d[2], xmax: detected.box2d[3] },
        cropImageKey: cropKey,
        confidence,
        source: 'VISION_MATCH',
      },
    });
    await this.vector.setAppearanceEmbedding(appearance.id, embedding);
  }

  private async setStatus(projectId: string, pageId: string, status: 'ANALYZING' | 'ANALYZED') {
    await this.prisma.comicPage.update({ where: { id: pageId }, data: { status, errorMessage: null } });
    this.realtime.emitPageStatus(projectId, { pageId, status });
  }
}
