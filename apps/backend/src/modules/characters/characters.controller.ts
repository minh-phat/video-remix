import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
  confirmReferenceImageSchema,
  createCharacterSchema,
  presignReferenceImageSchema,
  updateCharacterSchema,
} from '@video-remix/shared-types';
import type {
  ConfirmReferenceImageDto,
  CreateCharacterDto,
  PresignReferenceImageDto,
  UpdateCharacterDto,
} from '@video-remix/shared-types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { CharactersService } from './characters.service';

@UseGuards(JwtAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.charactersService.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCharacterSchema)) dto: CreateCharacterDto,
  ) {
    return this.charactersService.create(user.id, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.charactersService.getOwned(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCharacterSchema)) dto: UpdateCharacterDto,
  ) {
    return this.charactersService.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.charactersService.delete(user.id, id);
  }

  @Post(':id/reference-images/presign')
  presignReferenceImage(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(presignReferenceImageSchema)) dto: PresignReferenceImageDto,
  ) {
    return this.charactersService.presignReferenceImage(user.id, id, dto.contentType);
  }

  @Post(':id/reference-images')
  confirmReferenceImage(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(confirmReferenceImageSchema)) dto: ConfirmReferenceImageDto,
  ) {
    return this.charactersService.confirmReferenceImage(user.id, id, dto.key);
  }

  @Delete(':id/reference-images/:imageId')
  deleteReferenceImage(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.charactersService.deleteReferenceImage(user.id, id, imageId);
  }
}
