import { Module } from '@nestjs/common';
import { QueueModule } from '../../queue/queue.module';
import { RenderService } from './render.service';
import { RenderProcessor } from './render.processor';

@Module({
  imports: [QueueModule],
  providers: [RenderService, RenderProcessor],
  exports: [RenderService],
})
export class RenderModule {}
