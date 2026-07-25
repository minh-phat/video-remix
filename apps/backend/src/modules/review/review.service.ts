import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  Character,
  CharacterAppearanceDto,
  CreateDialogueLineDto,
  DialogueLineDto,
  SaveAppearanceAsCharacterDto,
  UpdateAppearanceDto,
  UpdateDialogueLineDto,
} from '@video-remix/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { GeminiService } from '../../ai-providers/gemini.service';
import { VectorService } from '../../vector/vector.service';
import type { Bbox } from '@video-remix/shared-types';
import type {
  CharacterAppearance as PrismaAppearance,
  DialogueLine as PrismaDialogueLine,
} from '../../../generated/prisma/client';

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
    private readonly vector: VectorService,
  ) {}

  async updateDialogueLine(
    userId: string,
    projectId: string,
    pageId: string,
    lineId: string,
    dto: UpdateDialogueLineDto,
  ): Promise<DialogueLineDto> {
    await this.findOwnedPage(userId, projectId, pageId);
    const line = await this.prisma.dialogueLine.findUnique({ where: { id: lineId } });
    if (!line || line.pageId !== pageId) throw new NotFoundException('Dialogue line not found');

    if (dto.characterId) await this.assertCharacterOwned(userId, dto.characterId);

    const updated = await this.prisma.dialogueLine.update({
      where: { id: lineId },
      data: { editedText: dto.editedText, characterId: dto.characterId },
    });
    return this.toDialogueDto(updated);
  }

  async createDialogueLine(
    userId: string,
    projectId: string,
    pageId: string,
    dto: CreateDialogueLineDto,
  ): Promise<DialogueLineDto> {
    await this.findOwnedPage(userId, projectId, pageId);
    const last = await this.prisma.dialogueLine.findFirst({ where: { pageId }, orderBy: { order: 'desc' } });
    const line = await this.prisma.dialogueLine.create({
      data: { pageId, order: (last?.order ?? -1) + 1, rawText: dto.editedText, editedText: dto.editedText },
    });
    return this.toDialogueDto(line);
  }

  async deleteDialogueLine(userId: string, projectId: string, pageId: string, lineId: string): Promise<void> {
    await this.findOwnedPage(userId, projectId, pageId);
    const line = await this.prisma.dialogueLine.findUnique({ where: { id: lineId } });
    if (!line || line.pageId !== pageId) throw new NotFoundException('Dialogue line not found');
    await this.prisma.dialogueLine.delete({ where: { id: lineId } });
  }

  async updateAppearance(
    userId: string,
    projectId: string,
    pageId: string,
    appearanceId: string,
    dto: UpdateAppearanceDto,
  ): Promise<CharacterAppearanceDto> {
    await this.findOwnedPage(userId, projectId, pageId);
    const appearance = await this.findOwnedAppearance(pageId, appearanceId);
    if (dto.characterId) await this.assertCharacterOwned(userId, dto.characterId);

    const updated = await this.prisma.characterAppearance.update({
      where: { id: appearance.id },
      data: { characterId: dto.characterId, source: 'MANUAL' },
      include: { character: true },
    });
    return this.toAppearanceDto(updated);
  }

  async saveAppearanceAsCharacter(
    userId: string,
    projectId: string,
    pageId: string,
    appearanceId: string,
    dto: SaveAppearanceAsCharacterDto,
  ): Promise<{ character: Character; appearance: CharacterAppearanceDto }> {
    await this.findOwnedPage(userId, projectId, pageId);
    const appearance = await this.findOwnedAppearance(pageId, appearanceId);

    const character = await this.prisma.character.create({ data: { userId, name: dto.name } });

    const refImageKey = this.storage.buildKey(
      'users',
      userId,
      'characters',
      character.id,
      'references',
      `${this.storage.generateObjectId()}.jpg`,
    );
    await this.storage.copyObject(appearance.cropImageKey, refImageKey);
    const refImage = await this.prisma.characterReferenceImage.create({
      data: { characterId: character.id, imageKey: refImageKey },
    });

    try {
      const { buffer } = await this.storage.getObjectBuffer(refImageKey);
      const embedding = await this.gemini.embedImage(buffer, 'image/jpeg');
      await this.vector.setReferenceImageEmbedding(refImage.id, embedding);
    } catch (err) {
      // The character and reference image are still saved even if embedding fails —
      // it just won't be used for auto-matching until re-embedded.
      this.logger.warn(
        `Failed to embed new character reference image ${refImage.id}: ${err instanceof Error ? err.message : err}`,
      );
    }

    const updatedAppearance = await this.prisma.characterAppearance.update({
      where: { id: appearance.id },
      data: { characterId: character.id, source: 'MANUAL' },
      include: { character: true },
    });

    return {
      character: {
        id: character.id,
        name: character.name,
        description: character.description,
        voiceId: character.voiceId,
        refImages: [{ id: refImage.id, url: await this.storage.getDownloadUrl(refImageKey), createdAt: refImage.createdAt.toISOString() }],
        createdAt: character.createdAt.toISOString(),
        updatedAt: character.updatedAt.toISOString(),
      },
      appearance: await this.toAppearanceDto(updatedAppearance),
    };
  }

  private async findOwnedPage(userId: string, projectId: string, pageId: string) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');

    const page = await this.prisma.comicPage.findUnique({ where: { id: pageId } });
    if (!page || page.projectId !== projectId) throw new NotFoundException('Page not found');
    return page;
  }

  private async findOwnedAppearance(pageId: string, appearanceId: string): Promise<PrismaAppearance> {
    const appearance = await this.prisma.characterAppearance.findUnique({ where: { id: appearanceId } });
    if (!appearance || appearance.pageId !== pageId) throw new NotFoundException('Appearance not found');
    return appearance;
  }

  private async assertCharacterOwned(userId: string, characterId: string): Promise<void> {
    const character = await this.prisma.character.findUnique({ where: { id: characterId } });
    if (!character || character.userId !== userId) throw new NotFoundException('Character not found');
  }

  private async toDialogueDto(line: PrismaDialogueLine): Promise<DialogueLineDto> {
    return {
      id: line.id,
      characterId: line.characterId,
      order: line.order,
      rawText: line.rawText,
      editedText: line.editedText,
      ttsAudioUrl: line.ttsAudioKey ? await this.storage.getDownloadUrl(line.ttsAudioKey) : null,
      ttsDurationMs: line.ttsDurationMs,
      ttsStatus: line.ttsStatus,
      ttsError: line.ttsError,
    };
  }

  private async toAppearanceDto(
    appearance: PrismaAppearance & { character: { name: string } | null },
  ): Promise<CharacterAppearanceDto> {
    return {
      id: appearance.id,
      characterId: appearance.characterId,
      characterName: appearance.character?.name ?? null,
      cropUrl: await this.storage.getDownloadUrl(appearance.cropImageKey),
      bbox: appearance.bbox as unknown as Bbox,
      confidence: appearance.confidence,
      source: appearance.source,
    };
  }
}
