import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CharactersModule } from './modules/characters/characters.module';
import { PagesModule } from './modules/pages/pages.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ReviewModule } from './modules/review/review.module';
import { RealtimeModule } from './realtime/realtime.module';
import { AiProvidersModule } from './ai-providers/ai-providers.module';
import { VectorModule } from './vector/vector.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
    }),
    PrismaModule,
    StorageModule,
    VectorModule,
    AiProvidersModule,
    RealtimeModule,
    HealthModule,
    AuthModule,
    ProjectsModule,
    CharactersModule,
    PagesModule,
    AnalysisModule,
    ReviewModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
