import { Module } from '@nestjs/common';
import { QueueModule } from '../../queue/queue.module';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';

@Module({
  imports: [QueueModule],
  controllers: [PagesController],
  providers: [PagesService],
})
export class PagesModule {}
