import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

export const ANALYSIS_QUEUE = 'analysis';
export const TTS_QUEUE = 'tts';
export const RENDER_QUEUE = 'render';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.getOrThrow<string>('REDIS_URL') },
      }),
    }),
    BullModule.registerQueue({ name: ANALYSIS_QUEUE }, { name: TTS_QUEUE }, { name: RENDER_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
