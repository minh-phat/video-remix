import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  Character,
  CreateCharacterDto,
  PresignedUpload,
  UpdateCharacterDto,
} from '@video-remix/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { GeminiService } from '../../ai-providers/gemini.service';
import { VectorService } from '../../vector/vector.service';
import type {
  Character as PrismaCharacter,
  CharacterReferenceImage as PrismaReferenceImage,
} from '../../../generated/prisma/client';

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

type CharacterWithImages = PrismaCharacter & { refImages: PrismaReferenceImage[] };

@Injectable()
export class CharactersService {
  private readonly logger = new Logger(CharactersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly gemini: GeminiService,
    private readonly vector: VectorService,
  ) {}

  async list(userId: string): Promise<Character[]> {
    const characters = await this.prisma.character.findMany({
      where: { userId },
      include: { refImages: true },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(characters.map((c) => this.toDto(c)));
  }

  async create(userId: string, dto: CreateCharacterDto): Promise<Character> {
    const character = await this.prisma.character.create({
      data: { userId, name: dto.name, description: dto.description },
      include: { refImages: true },
    });
    return this.toDto(character);
  }

  async getOwned(userId: string, id: string): Promise<Character> {
    const character = await this.findOwnedOrThrow(userId, id);
    return this.toDto(character);
  }

  async update(userId: string, id: string, dto: UpdateCharacterDto): Promise<Character> {
    await this.findOwnedOrThrow(userId, id);
    const character = await this.prisma.character.update({
      where: { id },
      data: dto,
      include: { refImages: true },
    });
    return this.toDto(character);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.findOwnedOrThrow(userId, id);
    await this.prisma.character.delete({ where: { id } });
  }

  async presignReferenceImage(userId: string, characterId: string, contentType: string): Promise<PresignedUpload> {
    await this.findOwnedOrThrow(userId, characterId);
    const extension = CONTENT_TYPE_EXTENSIONS[contentType];
    const key = this.storage.buildKey(
      'users',
      userId,
      'characters',
      characterId,
      'references',
      `${this.storage.generateObjectId()}.${extension}`,
    );
    const uploadUrl = await this.storage.getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  async confirmReferenceImage(userId: string, characterId: string, key: string): Promise<Character> {
    await this.findOwnedOrThrow(userId, characterId);
    const expectedPrefix = this.storage.buildKey('users', userId, 'characters', characterId, 'references', '');
    if (!key.startsWith(expectedPrefix)) {
      throw new NotFoundException('Invalid reference image key');
    }
    const refImage = await this.prisma.characterReferenceImage.create({ data: { characterId, imageKey: key } });
    await this.embedReferenceImage(refImage.id, key);

    const character = await this.findOwnedOrThrow(userId, characterId);
    return this.toDto(character);
  }

  private async embedReferenceImage(referenceImageId: string, imageKey: string): Promise<void> {
    try {
      const { buffer, contentType } = await this.storage.getObjectBuffer(imageKey);
      const embedding = await this.gemini.embedImage(buffer, contentType ?? 'image/jpeg');
      await this.vector.setReferenceImageEmbedding(referenceImageId, embedding);
    } catch (err) {
      this.logger.warn(
        `Failed to embed reference image ${referenceImageId}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async deleteReferenceImage(userId: string, characterId: string, imageId: string): Promise<Character> {
    await this.findOwnedOrThrow(userId, characterId);
    const image = await this.prisma.characterReferenceImage.findUnique({ where: { id: imageId } });
    if (!image || image.characterId !== characterId) throw new NotFoundException('Reference image not found');

    await this.storage.deleteObject(image.imageKey).catch(() => {});
    await this.prisma.characterReferenceImage.delete({ where: { id: imageId } });

    const character = await this.findOwnedOrThrow(userId, characterId);
    return this.toDto(character);
  }

  private async findOwnedOrThrow(userId: string, id: string): Promise<CharacterWithImages> {
    const character = await this.prisma.character.findUnique({
      where: { id },
      include: { refImages: true },
    });
    if (!character || character.userId !== userId) throw new NotFoundException('Character not found');
    return character;
  }

  private async toDto(character: CharacterWithImages): Promise<Character> {
    const refImages = await Promise.all(
      character.refImages.map(async (img) => ({
        id: img.id,
        url: await this.storage.getDownloadUrl(img.imageKey),
        createdAt: img.createdAt.toISOString(),
      })),
    );
    return {
      id: character.id,
      name: character.name,
      description: character.description,
      voiceId: character.voiceId,
      refImages,
      createdAt: character.createdAt.toISOString(),
      updatedAt: character.updatedAt.toISOString(),
    };
  }
}
