import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackLevel } from '@prisma/client';

const MARKER = '[[ADHARA_CLASSES_JSON]]';

export function extractStoredClasses(notes?: string | null): Array<{ className: string; track: TrackLevel }> {
  if (!notes) return [];
  const markerIndex = notes.indexOf(MARKER);
  if (markerIndex < 0) return [];
  const rawJson = notes.slice(markerIndex + MARKER.length).trim();
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed)
      ? parsed
          .filter((x: any) => x?.className && x?.track)
          .map((x: any) => ({
            className: String(x.className).trim().toUpperCase(),
            track: x.track as TrackLevel,
          }))
      : [];
  } catch {
    return [];
  }
}

/**
 * Resolve class + track for student enrollment.
 * Prefers the school class registry; falls back to a single existing student track in that class.
 */
export async function resolveClassEnrollment(
  prisma: PrismaService,
  schoolId: string,
  className: string,
  requestedTrack?: TrackLevel,
): Promise<{ className: string; track: TrackLevel }> {
  const normalized = String(className || '').trim().toUpperCase();
  if (!normalized) throw new BadRequestException('Class name is required');

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { notes: true },
  });
  if (!school) throw new BadRequestException('School not found');

  const registry = extractStoredClasses(school.notes);
  let entry = registry.find((c) => c.className === normalized);

  if (!entry) {
    const studentTracks = await prisma.student.findMany({
      where: { schoolId, className: normalized },
      select: { track: true },
      distinct: ['track'],
    });
    if (studentTracks.length === 1) {
      entry = { className: normalized, track: studentTracks[0].track };
    } else if (studentTracks.length > 1) {
      throw new BadRequestException(
        `Class "${normalized}" has students on multiple tracks. Register the class under Classes and use one track per class.`,
      );
    } else {
      throw new BadRequestException(
        `Class "${normalized}" is not registered. Add it under Classes before enrolling students.`,
      );
    }
  }

  if (requestedTrack && requestedTrack !== entry.track) {
    throw new BadRequestException(
      `Class "${normalized}" is registered as ${String(entry.track).replace('TRACK_', 'Track ')}. ` +
        `Cannot enroll with ${String(requestedTrack).replace('TRACK_', 'Track ')}.`,
    );
  }

  return { className: normalized, track: entry.track };
}
