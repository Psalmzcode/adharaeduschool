import { ModuleStackVariant, Track3Stack, TrackLevel } from '@prisma/client';
import { Prisma } from '@prisma/client';

/** Modules visible for a track + optional Track 3 stack (matches handbook branching). */
export function modulesWhereForTrack(
  track: TrackLevel,
  track3Stack: Track3Stack | null | undefined,
): Prisma.ModuleWhereInput {
  if (track !== TrackLevel.TRACK_3) {
    return { track, stackVariant: ModuleStackVariant.COMMON };
  }
  const stack = track3Stack ?? Track3Stack.PYTHON_FLASK;
  return {
    track: TrackLevel.TRACK_3,
    OR: [
      { stackVariant: ModuleStackVariant.COMMON },
      { stackVariant: stack === Track3Stack.PYTHON_FLASK ? ModuleStackVariant.PYTHON_FLASK : ModuleStackVariant.REACT_NODE },
    ],
  };
}

/** Order: by module number, then stack (COMMON first). */
export const moduleCurriculumOrderBy: Prisma.ModuleOrderByWithRelationInput[] = [
  { number: 'asc' },
  { stackVariant: 'asc' },
];
