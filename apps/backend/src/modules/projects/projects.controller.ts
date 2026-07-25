import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { createProjectSchema } from '@video-remix/shared-types';
import type { CreateProjectDto } from '@video-remix/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { ProjectsService } from './projects.service';
import { TtsService } from '../tts/tts.service';
import { RenderService } from '../render/render.service';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly ttsService: TtsService,
    private readonly renderService: RenderService,
  ) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.projectsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: RequestUser, @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto) {
    return this.projectsService.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.projectsService.getOwned(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.projectsService.delete(user.id, id);
  }

  @Post(':id/generate-narration')
  generateNarration(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.ttsService.enqueueProject(user.id, id);
  }

  @Post(':id/render')
  createRenderJob(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.renderService.createJob(user.id, id);
  }

  @Get(':id/render')
  getLatestRenderJob(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.renderService.getLatestJob(user.id, id);
  }
}
