import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const CHARACTER_MATCH_SIMILARITY_THRESHOLD = 0.85;

interface NearestCharacterRow {
  characterId: string;
  similarity: number;
}

@Injectable()
export class VectorService {
  constructor(private readonly prisma: PrismaService) {}

  private toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  async setReferenceImageEmbedding(referenceImageId: string, embedding: number[]): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "CharacterReferenceImage"
      SET embedding = ${this.toVectorLiteral(embedding)}::vector
      WHERE id = ${referenceImageId}
    `;
  }

  async setAppearanceEmbedding(appearanceId: string, embedding: number[]): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "CharacterAppearance"
      SET embedding = ${this.toVectorLiteral(embedding)}::vector
      WHERE id = ${appearanceId}
    `;
  }

  /** Finds the closest character (by reference-image embedding) owned by userId, above the similarity threshold. */
  async findNearestCharacter(userId: string, embedding: number[]): Promise<NearestCharacterRow | null> {
    const rows = await this.prisma.$queryRaw<NearestCharacterRow[]>`
      SELECT c.id AS "characterId", 1 - (ri.embedding <=> ${this.toVectorLiteral(embedding)}::vector) AS similarity
      FROM "CharacterReferenceImage" ri
      JOIN "Character" c ON c.id = ri."characterId"
      WHERE c."userId" = ${userId} AND ri.embedding IS NOT NULL
      ORDER BY ri.embedding <=> ${this.toVectorLiteral(embedding)}::vector ASC
      LIMIT 1
    `;

    const best = rows[0];
    if (!best || best.similarity < CHARACTER_MATCH_SIMILARITY_THRESHOLD) return null;
    return best;
  }
}
