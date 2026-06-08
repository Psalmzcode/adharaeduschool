export type CertificateTemplateId = 'SIDEBAR' | 'CLASSIC'

export interface CertificatePreviewData {
  studentName: string
  regNumber: string
  schoolName: string
  trackLabel: string
  template: CertificateTemplateId
  accent?: string
  navy?: string
  gold?: string
  averageScore: number
  grade: string
  issueDateLabel: string
  serialNumber: string
  verifyUrl: string
  year?: string
}

export interface CertificateTrackArt {
  track: string
  template: CertificateTemplateId
  trackLabel: string
  accent: string
  navy: string
  gold: string
}

export const TRACK_CERTIFICATE_ART: Record<string, CertificateTrackArt> = {
  TRACK_1: {
    track: 'TRACK_1',
    template: 'SIDEBAR',
    trackLabel: 'Track 1 — Computer Appreciation (JSS–SS1)',
    accent: '#1E7FD4',
    navy: '#0B2048',
    gold: '#C9963A',
  },
  TRACK_2: {
    track: 'TRACK_2',
    template: 'CLASSIC',
    trackLabel: 'Track 2 — Introduction to Programming (SS1–SS2)',
    accent: '#1E7FD4',
    navy: '#0B1F3A',
    gold: '#C9963A',
  },
  TRACK_3: {
    track: 'TRACK_3',
    template: 'SIDEBAR',
    trackLabel: 'Track 3 — Advanced Tech Skills (SS3)',
    accent: '#C9963A',
    navy: '#061530',
    gold: '#E8B96A',
  },
}

export function certificateGrade(score: number): string {
  if (score >= 90) return 'Distinction'
  if (score >= 70) return 'Merit'
  return 'Pass'
}

export function samplePreviewForTrack(track: string): CertificatePreviewData {
  const art = TRACK_CERTIFICATE_ART[track] || TRACK_CERTIFICATE_ART.TRACK_1
  const year = String(new Date().getFullYear())
  return {
    studentName: 'Tunde Balogun',
    regNumber: 'CH-SS2-2047',
    schoolName: 'Crown Heights Secondary School',
    trackLabel: art.trackLabel,
    template: art.template,
    accent: art.accent,
    navy: art.navy,
    gold: art.gold,
    averageScore: 72,
    grade: 'Merit',
    issueDateLabel: '21 March 2026',
    serialNumber: `ADH-CERT-${year}-PREVIEW`,
    verifyUrl: `yoursite.com/verify-certificate/ADH-CERT-${year}-PREVIEW`,
    year,
  }
}
