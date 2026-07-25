import { Module } from '@nestjs/common';
import { QueueModule } from '../../queue/queue.module';
import { AiProvidersModule } from '../../ai-providers/ai-providers.module';
import { TtsService } from './tts.service';
import { TtsProcessor } from './tts.processor';

@Module({
  imports: [QueueModule, AiProvidersModule],
  providers: [TtsService, TtsProcessor],
  exports: [TtsService],
})
export class TtsModule {}
