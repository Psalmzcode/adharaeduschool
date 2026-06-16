const GRADIENTS = [
  ['#C9963A', '#7c5c1e'],
  ['#2563EB', '#1e40af'],
  ['#92400e', '#78350f'],
  ['#065f46', '#064e3b'],
  ['#6d28d9', '#4c1d95'],
  ['#1E7FD4', '#0c4a8a'],
  ['#9f1239', '#881337'],
  ['#0e7490', '#164e63'],
  ['#78350f', '#451a03'],
  ['#1e4e6b', '#0c2d40'],
] as const;

export function leaderboardGradient(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % GRADIENTS.length;
  const [a, b] = GRADIENTS[h];
  return `${a},${b}`;
}

export function trackLabel(track: string) {
  const m: Record<string, string> = {
    TRACK_1: 'Track 1',
    TRACK_2: 'Track 2',
    TRACK_3: 'Track 3',
  };
  return m[track] || track;
}

/** Header title e.g. TRACK_1 → "Track 01" */
export function trackNumberLabel(track: string) {
  const n = track.match(/TRACK_(\d+)/i)?.[1];
  if (n) return `Track ${n.padStart(2, '0')}`;
  return trackLabel(track);
}

export function trackSubtitle(track: string) {
  const m: Record<string, string> = {
    TRACK_1: 'Digital Foundation',
    TRACK_2: 'Web & Design',
    TRACK_3: 'Software Engineering',
  };
  return m[track] || 'Programme track';
}

export function formatModulesLabel(count: number) {
  const n = Math.max(0, count ?? 0);
  return `${n} module${n === 1 ? '' : 's'}`;
}

/** All Classes row: class + how many modules their class has finalized. */
export function classPaceLabel(className: string, modulesCompleted: number) {
  return `${className} · ${formatModulesLabel(modulesCompleted)}`;
}

export function shortSchoolName(name: string, maxLen = 18) {
  const s = String(name || '').trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen - 1)}…`;
}
