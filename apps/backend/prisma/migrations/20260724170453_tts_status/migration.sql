-- CreateEnum
CREATE TYPE "TtsStatus" AS ENUM ('PENDING', 'QUEUED', 'DONE', 'ERROR');

-- DropIndex
DROP INDEX "CharacterReferenceImage_embedding_idx";

-- AlterTable
ALTER TABLE "DialogueLine" ADD COLUMN     "ttsError" TEXT,
ADD COLUMN     "ttsStatus" "TtsStatus" NOT NULL DEFAULT 'PENDING';
