import { Module } from '@nestjs/common';
import { QueueModule } from '../../queue/queue.module';
import { AiProvidersModule } from '../../ai-providers/ai-providers.module';
import { AnalysisProcessor } from './analysis.processor';

@Module({
  imports: [QueueModule, AiProvidersModule],
  providers: [AnalysisProcessor],
})
export class AnalysisModule {}
