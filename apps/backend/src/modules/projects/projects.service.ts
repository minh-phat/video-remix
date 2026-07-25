import { Injectable, NotFoundException } from '@nestjs/common';
import type { CreateProjectDto, Project } from '@video-remix/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import type { Project as PrismaProject } from '../../../generated/prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<Project[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.toDto(p));
  }

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const project = await this.prisma.project.create({
      data: { userId, title: dto.title },
    });
    return this.toDto(project);
  }

  async getOwned(userId: string, id: string): Promise<Project> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');
    return this.toDto(project);
  }

  async delete(userId: string, id: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project || project.userId !== userId) throw new NotFoundException('Project not found');
    await this.prisma.project.delete({ where: { id } });
  }

  private toDto(project: PrismaProject): Project {
    return {
      id: project.id,
      title: project.title,
      status: project.status,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
