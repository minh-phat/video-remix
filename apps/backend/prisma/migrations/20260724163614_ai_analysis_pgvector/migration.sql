-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AppearanceSource" AS ENUM ('VISION_MATCH', 'MANUAL');

-- AlterTable
ALTER TABLE "CharacterReferenceImage" ADD COLUMN     "embedding" vector(768);

-- CreateTable
CREATE TABLE "CharacterAppearance" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "characterId" TEXT,
    "bbox" JSONB NOT NULL,
    "cropImageKey" TEXT NOT NULL,
    "embedding" vector(768),
    "confidence" DOUBLE PRECISION NOT NULL,
    "source" "AppearanceSource" NOT NULL DEFAULT 'VISION_MATCH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAppearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DialogueLine" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "characterId" TEXT,
    "order" INTEGER NOT NULL,
    "rawText" TEXT NOT NULL,
    "editedText" TEXT NOT NULL,
    "bbox" JSONB,
    "ttsAudioKey" TEXT,
    "ttsDurationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DialogueLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterAppearance_pageId_idx" ON "CharacterAppearance"("pageId");

-- CreateIndex
CREATE INDEX "CharacterAppearance_characterId_idx" ON "CharacterAppearance"("characterId");

-- CreateIndex
CREATE INDEX "DialogueLine_pageId_idx" ON "DialogueLine"("pageId");

-- CreateIndex
CREATE INDEX "DialogueLine_characterId_idx" ON "DialogueLine"("characterId");

-- AddForeignKey
ALTER TABLE "CharacterAppearance" ADD CONSTRAINT "CharacterAppearance_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ComicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAppearance" ADD CONSTRAINT "CharacterAppearance_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogueLine" ADD CONSTRAINT "DialogueLine_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ComicPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DialogueLine" ADD CONSTRAINT "DialogueLine_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
