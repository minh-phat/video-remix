import { Body, Controller, Delete, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  createDialogueLineSchema,
  saveAppearanceAsCharacterSchema,
  updateAppearanceSchema,
  updateDialogueLineSchema,
} from '@video-remix/shared-types';
import type {
  CreateDialogueLineDto,
  SaveAppearanceAsCharacterDto,
  UpdateAppearanceDto,
  UpdateDialogueLineDto,
} from '@video-remix/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { ReviewService } from './review.service';
import { TtsService } from '../tts/tts.service';

@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/pages/:pageId')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly ttsService: TtsService,
  ) {}

  @Post('dialogue-lines')
  createDialogueLine(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
    @Body(new ZodValidationPipe(createDialogueLineSchema)) dto: CreateDialogueLineDto,
  ) {
    return this.reviewService.createDialogueLine(user.id, projectId, pageId, dto);
  }

  @Patch('dialogue-lines/:lineId')
  updateDialogueLine(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
    @Param('lineId') lineId: string,
    @Body(new ZodValidationPipe(updateDialogueLineSchema)) dto: UpdateDialogueLineDto,
  ) {
    return this.reviewService.updateDialogueLine(user.id, projectId, pageId, lineId, dto);
  }

  @Delete('dialogue-lines/:lineId')
  @HttpCode(204)
  async deleteDialogueLine(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
    @Param('lineId') lineId: string,
  ) {
    await this.reviewService.deleteDialogueLine(user.id, projectId, pageId, lineId);
  }

  @Patch('appearances/:appearanceId')
  updateAppearance(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
    @Param('appearanceId') appearanceId: string,
    @Body(new ZodValidationPipe(updateAppearanceSchema)) dto: UpdateAppearanceDto,
  ) {
    return this.reviewService.updateAppearance(user.id, projectId, pageId, appearanceId, dto);
  }

  @Post('dialogue-lines/:lineId/generate-tts')
  async generateTts(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
    @Param('lineId') lineId: string,
  ) {
    await this.ttsService.enqueueLine(user.id, projectId, pageId, lineId);
    return { ok: true };
  }

  @Post('appearances/:appearanceId/save-as-character')
  saveAppearanceAsCharacter(
    @CurrentUser() user: RequestUser,
    @Param('projectId') projectId: string,
    @Param('pageId') pageId: string,
    @Param('appearanceId') appearanceId: string,
    @Body(new ZodValidationPipe(saveAppearanceAsCharacterSchema)) dto: SaveAppearanceAsCharacterDto,
  ) {
    return this.reviewService.saveAppearanceAsCharacter(user.id, projectId, pageId, appearanceId, dto);
  }
}
