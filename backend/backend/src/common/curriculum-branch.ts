import { Track3Stack, TrackLevel } from '@prisma/client';

/** Stable key for ClassCurriculumState (avoids nullable composite unique issues). */
export function curriculumBranchKey(track: TrackLevel, track3Stack: Track3Stack | null | undefined): string {
  if (track !== TrackLevel.TRACK_3) return String(track);
  return `${track}_${track3Stack ?? Track3Stack.PYTHON_FLASK}`;
}
