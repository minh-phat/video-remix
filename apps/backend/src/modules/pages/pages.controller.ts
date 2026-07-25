import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { confirmPageSchema, presignPageImageSchema, reorderPagesSchema } from '@video-remix/shared-types';
import type { ConfirmPageDto, PresignPageImageDto, ReorderPagesDto } from '@video-remix/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { PagesService } from './pages.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  list(@CurrentUser() user: RequestUser, @Param('projectId') projectId: string) {
    return this.pagesService.list(user.id, projectId);
  }

  @Post('presign')
  presign(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(presignPageImageSchema)) dto: PresignPageImageDto,
  ) {
    return this.pagesService.presignUpload(user.id, projectId, dto.contentType);
  }

  @Post()
  confirm(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(confirmPageSchema)) dto: ConfirmPageDto,
  ) {
    return this.pagesService.confirm(user.id, projectId, dto);
  }

  @Patch('reorder')
  reorder(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(reorderPagesSchema)) dto: ReorderPagesDto,
  ) {
    return this.pagesService.reorder(user.id, projectId, dto.pageIds);
  }

  @Get(':pageId/analysis')
  getAnalysis(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
  ) {
    return this.pagesService.getAnalysis(user.id, projectId, pageId);
  }

  @Delete(':pageId')
  @HttpCode(204)
  async delete(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
  ) {
    await this.pagesService.delete(user.id, projectId, pageId);
  }
}
