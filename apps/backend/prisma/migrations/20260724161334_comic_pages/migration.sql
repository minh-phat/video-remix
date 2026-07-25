-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'ANALYZED', 'ERROR');

-- CreateTable
CREATE TABLE "ComicPage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "status" "PageStatus" NOT NULL DEFAULT 'UPLOADED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComicPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComicPage_projectId_idx" ON "ComicPage"("projectId");

-- AddForeignKey
ALTER TABLE "ComicPage" ADD CONSTRAINT "ComicPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
