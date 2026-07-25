import { Module } from '@nestjs/common';
import { AiProvidersModule } from '../../ai-providers/ai-providers.module';
import { TtsModule } from '../tts/tts.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [AiProvidersModule, TtsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
