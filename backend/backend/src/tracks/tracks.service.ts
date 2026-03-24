import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ProgramTrack = {
  id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class TracksService {
  constructor(private prisma: PrismaService) {}

  private readonly marker = '[[ADHARA_TRACKS_JSON]]';
  private readonly defaults: ProgramTrack[] = [
    {
      id: 'track-seed-1',
      code: 'TRACK_1',
      name: 'Digital Foundations',
      description: 'Core computer literacy and confident digital usage.',
      isActive: true,
      order: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'track-seed-2',
      code: 'TRACK_2',
      name: 'Introduction to Programming',
      description: 'Programming logic and web development fundamentals.',
      isActive: true,
      order: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'track-seed-3',
      code: 'TRACK_3',
      name: 'Advanced Tech & Career Readiness',
      description: 'Real-world coding skills and portfolio development.',
      isActive: true,
      order: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  private extractTracks(notes?: string | null): ProgramTrack[] {
    if (!notes) return [...this.defaults];
    const markerIndex = notes.indexOf(this.marker);
    if (markerIndex < 0) return [...this.defaults];
    const rawJson = notes.slice(markerIndex + this.marker.length).trim();
    if (!rawJson) return [...this.defaults];
    try {
      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) return [...this.defaults];
      const rows = parsed
        .filter((x: any) => x?.id && x?.code && x?.name)
        .map((x: any, i: number) => ({
          id: String(x.id),
          code: String(x.code).toUpperCase(),
          name: String(x.name),
          description: x.description ? String(x.description) : undefined,
          isActive: x.isActive !== false,
          order: Number.isFinite(Number(x.order)) ? Number(x.order) : i + 1,
          createdAt: x.createdAt ? String(x.createdAt) : new Date().toISOString(),
          updatedAt: x.updatedAt ? String(x.updatedAt) : new Date().toISOString(),
        }));
      return rows.length ? rows : [...this.defaults];
    } catch {
      return [...this.defaults];
    }
  }

  private mergeNotesWithTracks(notes: string | null | undefined, tracks: ProgramTrack[]) {
    const source = notes || '';
    const markerIndex = source.indexOf(this.marker);
    const plainNotes = markerIndex >= 0 ? source.slice(0, markerIndex).trimEnd() : source.trimEnd();
    const serialized = `${this.marker}${JSON.stringify(tracks)}`;
    return plainNotes ? `${plainNotes}\n${serialized}` : serialized;
  }

  private async getConfigHostSchool() {
    const school = await this.prisma.school.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, notes: true },
    });
    if (!school) throw new NotFoundException('Create at least one school before managing tracks');
    return school;
  }

  async findAll() {
    const school = await this.getConfigHostSchool();
    return this.extractTracks(school.notes).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  async create(data: { code: string; name: string; description?: string; isActive?: boolean }) {
    const school = await this.getConfigHostSchool();
    const tracks = this.extractTracks(school.notes);
    const code = String(data.code || '').trim().toUpperCase();
    const name = String(data.name || '').trim();
    if (!code || !name) throw new BadRequestException('Track code and name are required');
    if (tracks.some((t) => t.code === code)) throw new BadRequestException('Track code already exists');
    const now = new Date().toISOString();
    const next: ProgramTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      code,
      name,
      description: data.description ? String(data.description).trim() : undefined,
      isActive: data.isActive !== false,
      order: tracks.length ? Math.max(...tracks.map((t) => t.order || 0)) + 1 : 1,
      createdAt: now,
      updatedAt: now,
    };
    const merged = [...tracks, next];
    await this.prisma.school.update({
      where: { id: school.id },
      data: { notes: this.mergeNotesWithTracks(school.notes, merged) },
    });
    return next;
  }

  async update(id: string, data: Partial<Pick<ProgramTrack, 'code' | 'name' | 'description' | 'isActive' | 'order'>>) {
    const school = await this.getConfigHostSchool();
    const tracks = this.extractTracks(school.notes);
    const idx = tracks.findIndex((t) => t.id === id);
    if (idx < 0) throw new NotFoundException('Track not found');
    const nextCode = data.code ? String(data.code).trim().toUpperCase() : tracks[idx].code;
    if (tracks.some((t, i) => i !== idx && t.code === nextCode)) {
      throw new BadRequestException('Track code already exists');
    }
    tracks[idx] = {
      ...tracks[idx],
      code: nextCode,
      name: data.name ? String(data.name).trim() : tracks[idx].name,
      description: data.description !== undefined ? String(data.description || '').trim() || undefined : tracks[idx].description,
      isActive: data.isActive !== undefined ? !!data.isActive : tracks[idx].isActive,
      order: data.order !== undefined ? Number(data.order) : tracks[idx].order,
      updatedAt: new Date().toISOString(),
    };
    await this.prisma.school.update({
      where: { id: school.id },
      data: { notes: this.mergeNotesWithTracks(school.notes, tracks) },
    });
    return tracks[idx];
  }
}

