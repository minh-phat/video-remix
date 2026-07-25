import { Module } from '@nestjs/common';
import { AiProvidersModule } from '../../ai-providers/ai-providers.module';
import { CharactersController } from './characters.controller';
import { CharactersService } from './characters.service';

@Module({
  imports: [AiProvidersModule],
  controllers: [CharactersController],
  providers: [CharactersService],
})
export class CharactersModule {}
