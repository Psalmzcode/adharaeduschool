import { TrackLevel } from '@prisma/client';

export type CertificateTemplateId = 'SIDEBAR' | 'CLASSIC';

export interface CertificateTrackArt {
  template: CertificateTemplateId;
  trackLabel: string;
  accent: string;
  navy: string;
  gold: string;
}

const TRACK_ART: Record<TrackLevel, CertificateTrackArt> = {
  [TrackLevel.TRACK_1]: {
    template: 'SIDEBAR',
    trackLabel: 'Track 1 — Computer Appreciation (JSS–SS1)',
    accent: '#1E7FD4',
    navy: '#0B2048',
    gold: '#C9963A',
  },
  [TrackLevel.TRACK_2]: {
    template: 'CLASSIC',
    trackLabel: 'Track 2 — Introduction to Programming (SS1–SS2)',
    accent: '#1E7FD4',
    navy: '#0B1F3A',
    gold: '#C9963A',
  },
  [TrackLevel.TRACK_3]: {
    template: 'SIDEBAR',
    trackLabel: 'Track 3 — Advanced Tech Skills (SS3)',
    accent: '#C9963A',
    navy: '#061530',
    gold: '#E8B96A',
  },
};

export function certificateArtForTrack(track: string): CertificateTrackArt {
  const key = track as TrackLevel;
  return TRACK_ART[key] || {
    template: 'CLASSIC',
    trackLabel: track.replace('TRACK_', 'Track '),
    accent: '#1E7FD4',
    navy: '#0B1F3A',
    gold: '#C9963A',
  };
}

export function certificateGrade(averageScore: number): string {
  if (averageScore >= 90) return 'Distinction';
  if (averageScore >= 70) return 'Merit';
  return 'Pass';
}

export function formatCertDate(d: Date): string {
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
}
