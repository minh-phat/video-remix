import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { RENDER_QUEUE } from '../../queue/queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

ffmpeg.setFfmpegPath(ffmpegStatic as unknown as string);
ffmpeg.setFfprobePath((ffprobeStatic as unknown as { path: string }).path);

export interface RenderJobData {
  jobId: string;
  projectId: string;
}

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 25;
const XFADE_DURATION = 0.6;
const GAP_DURATION = 0.4;
const PAD_DURATION = 0.5;
const NO_DIALOGUE_PAGE_DURATION = 4;
const AUDIO_SAMPLE_RATE = 24000;

// Ken Burns motion presets, cycled by page index for visual variety.
const ZOOM_PRESETS = [
  // zoom-in-center
  { z: 'min(zoom+0.0008,1.15)', x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' },
  // zoom-in-top-left
  { z: 'min(zoom+0.0008,1.15)', x: '0', y: '0' },
  // zoom-out-center (starts zoomed in, eases out)
  { z: "if(eq(on,1),1.15,max(1.0,zoom-0.0008))", x: 'iw/2-(iw/zoom/2)', y: 'ih/2-(ih/zoom/2)' },
  // static pan left-to-right
  { z: '1.15', x: null as string | null, y: 'ih/2-(ih/zoom/2)' },
];

function panLeftToRightExpr(frames: number): string {
  return `(iw-iw/zoom)*on/${frames}`;
}

@Processor(RENDER_QUEUE, { concurrency: 1 })
export class RenderProcessor extends WorkerHost {
  private readonly logger = new Logger(RenderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly realtime: RealtimeGateway,
  ) {
    super();
  }

  async process(job: Job<RenderJobData>): Promise<void> {
    const { jobId, projectId } = job.data;
    const scratchDir = await mkdtemp(path.join(tmpdir(), `render-${jobId}-`));

    try {
      await this.setStatus(jobId, projectId, 'RENDERING', 0);

      const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
      const pages = await this.prisma.comicPage.findMany({
        where: { projectId },
        orderBy: { order: 'asc' },
        include: { dialogueLines: { orderBy: { order: 'asc' } } },
      });

      const clips: { path: string; duration: number }[] = [];
      for (let i = 0; i < pages.length; i++) {
        const clip = await this.buildPageClip(pages[i], i, scratchDir);
        clips.push(clip);
        const progress = Math.round(((i + 1) / pages.length) * 60);
        await this.setStatus(jobId, projectId, 'RENDERING', progress);
      }

      let mergedPath = clips[0].path;
      let mergedDuration = clips[0].duration;
      for (let i = 1; i < clips.length; i++) {
        const outputPath = path.join(scratchDir, `merged-${i}.mp4`);
        mergedDuration = await this.crossfadeMerge(
          mergedPath,
          mergedDuration,
          clips[i].path,
          clips[i].duration,
          outputPath,
        );
        mergedPath = outputPath;
        const progress = 60 + Math.round((i / (clips.length - 1)) * 35);
        await this.setStatus(jobId, projectId, 'RENDERING', progress);
      }

      const outputKey = this.storage.buildKey('users', project.userId, 'projects', projectId, 'renders', jobId, 'output.mp4');
      const buffer = await readFile(mergedPath);
      await this.storage.putObject(outputKey, buffer, 'video/mp4');

      await this.prisma.videoRenderJob.update({
        where: { id: jobId },
        data: { status: 'DONE', progress: 100, outputKey, completedAt: new Date() },
      });
      this.realtime.emitRenderStatus(projectId, { jobId, status: 'DONE', progress: 100 });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Render failed for job ${jobId}: ${message}`);
      await this.prisma.videoRenderJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errorMessage: message },
      });
      this.realtime.emitRenderStatus(projectId, { jobId, status: 'FAILED', progress: 0, errorMessage: message });
      throw err;
    } finally {
      await rm(scratchDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async buildPageClip(
    page: { id: string; imageKey: string; dialogueLines: { ttsAudioKey: string | null }[] },
    index: number,
    scratchDir: string,
  ): Promise<{ path: string; duration: number }> {
    const imagePath = path.join(scratchDir, `page-${index}.jpg`);
    await this.downloadToFile(page.imageKey, imagePath);

    const audioPaths: string[] = [];
    for (let j = 0; j < page.dialogueLines.length; j++) {
      const key = page.dialogueLines[j].ttsAudioKey;
      if (!key) continue;
      const linePath = path.join(scratchDir, `line-${index}-${j}.wav`);
      await this.downloadToFile(key, linePath);
      audioPaths.push(linePath);
    }

    const audioPath = path.join(scratchDir, `audio-${index}.wav`);
    const duration = await this.buildPageAudio(audioPaths, audioPath);

    const videoPath = path.join(scratchDir, `video-${index}.mp4`);
    await this.buildPageVideo(imagePath, duration, index % ZOOM_PRESETS.length, videoPath);

    const clipPath = path.join(scratchDir, `clip-${index}.mp4`);
    await this.muxPageClip(videoPath, audioPath, clipPath);

    return { path: clipPath, duration };
  }

  private async downloadToFile(key: string, destPath: string): Promise<void> {
    const { buffer } = await this.storage.getObjectBuffer(key);
    await writeFile(destPath, buffer);
  }

  private buildPageAudio(dialogueAudioPaths: string[], outputPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (dialogueAudioPaths.length === 0) {
        ffmpeg()
          .input(`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=mono`)
          .inputFormat('lavfi')
          .duration(NO_DIALOGUE_PAGE_DURATION)
          .output(outputPath)
          .on('end', () => resolve(NO_DIALOGUE_PAGE_DURATION))
          .on('error', reject)
          .run();
        return;
      }

      const command = ffmpeg();
      dialogueAudioPaths.forEach((p) => command.input(p));

      const n = dialogueAudioPaths.length;
      const filterParts = [`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=mono:d=${PAD_DURATION}[lead]`];
      let concatInputs = '[lead]';
      for (let i = 0; i < n; i++) {
        concatInputs += `[${i}:a]`;
        if (i < n - 1) {
          filterParts.push(`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=mono:d=${GAP_DURATION}[gap${i}]`);
          concatInputs += `[gap${i}]`;
        }
      }
      filterParts.push(`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=mono:d=${PAD_DURATION}[tail]`);
      concatInputs += '[tail]';
      const totalSegments = n + (n - 1) + 2;
      const filter = `${filterParts.join(';')};${concatInputs}concat=n=${totalSegments}:v=0:a=1[out]`;

      command
        .complexFilter(filter, [])
        .outputOptions(['-map', '[out]'])
        .output(outputPath)
        .on('end', () => {
          this.probeDuration(outputPath).then(resolve).catch(reject);
        })
        .on('error', reject)
        .run();
    });
  }

  private buildPageVideo(imagePath: string, durationSec: number, presetIndex: number, outputPath: string): Promise<void> {
    const frames = Math.max(1, Math.round(durationSec * FPS));
    const preset = ZOOM_PRESETS[presetIndex];
    const xExpr = preset.x ?? panLeftToRightExpr(frames);

    return new Promise((resolve, reject) => {
      ffmpeg(imagePath)
        .inputOptions(['-loop', '1', '-framerate', String(FPS)])
        .videoFilters(
          `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},` +
            `zoompan=z='${preset.z}':d=${frames}:x='${xExpr}':y='${preset.y}':s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
        )
        .outputOptions(['-pix_fmt', 'yuv420p', '-t', String(durationSec)])
        .videoCodec('libx264')
        .noAudio()
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private muxPageClip(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(audioPath)
        .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-shortest'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', reject)
        .run();
    });
  }

  private crossfadeMerge(
    clipAPath: string,
    durationA: number,
    clipBPath: string,
    durationB: number,
    outputPath: string,
  ): Promise<number> {
    const offset = Math.max(0, durationA - XFADE_DURATION);
    const filter =
      `[0:v][1:v]xfade=transition=fade:duration=${XFADE_DURATION}:offset=${offset}[v];` +
      `[0:a][1:a]acrossfade=d=${XFADE_DURATION}[a]`;

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(clipAPath)
        .input(clipBPath)
        .complexFilter(filter, [])
        .outputOptions(['-map', '[v]', '-map', '[a]'])
        .videoCodec('libx264')
        .audioCodec('aac')
        .output(outputPath)
        .on('end', () => resolve(durationA + durationB - XFADE_DURATION))
        .on('error', reject)
        .run();
    });
  }

  private probeDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return reject(err);
        resolve(data.format.duration ?? 0);
      });
    });
  }

  private async setStatus(jobId: string, projectId: string, status: 'RENDERING', progress: number) {
    await this.prisma.videoRenderJob.update({ where: { id: jobId }, data: { status, progress } });
    this.realtime.emitRenderStatus(projectId, { jobId, status, progress });
  }
}
