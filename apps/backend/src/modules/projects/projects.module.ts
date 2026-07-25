import { Module } from '@nestjs/common';
import { TtsModule } from '../tts/tts.module';
import { RenderModule } from '../render/render.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TtsModule, RenderModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
