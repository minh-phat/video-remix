-- CreateEnum
CREATE TYPE "RenderStatus" AS ENUM ('QUEUED', 'RENDERING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "VideoRenderJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "RenderStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "outputKey" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoRenderJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoRenderJob_projectId_idx" ON "VideoRenderJob"("projectId");

-- AddForeignKey
ALTER TABLE "VideoRenderJob" ADD CONSTRAINT "VideoRenderJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
