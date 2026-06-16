import { JSZip } from './load-jszip';
import { SubmissionEvidence } from '../types/submission-evidence.types';

type ScratchBlock = {
  opcode?: string;
  next?: string | null;
  parent?: string | null;
  topLevel?: boolean;
};

type ScratchTarget = {
  isStage?: boolean;
  name?: string;
  blocks?: Record<string, ScratchBlock>;
  sounds?: unknown[];
};

const MOTION_OPS = /^motion_/;
const LOOP_OPS = /^control_(repeat|forever|repeat_until)/;
const CONDITIONAL_OPS = /^control_(if|if_else|wait_until)/;
const EVENT_OPS = /^event_(whenflagclicked|whenkeypressed|whenthisspriteclicked|whenbroadcastreceived)/;
const VARIABLE_OPS = /^data_(setvariableto|changevariableby|showvariable|hidevariable)/;

function summarizeBlocks(blocks: Record<string, ScratchBlock> = {}): string[] {
  const summaries: string[] = [];
  for (const block of Object.values(blocks)) {
    if (!block.topLevel || !block.opcode) continue;
    summaries.push(block.opcode);
  }
  return summaries.slice(0, 20);
}

export async function extractFromSb3Buffer(buffer: Buffer, fileName = 'project.sb3'): Promise<SubmissionEvidence> {
  const zip = await JSZip.loadAsync(buffer);
  const projectFile = zip.file('project.json');
  if (!projectFile) {
    return {
      metadata: {
        fileType: 'sb3',
        fileName,
        validationWarnings: ['Invalid Scratch file — project.json not found'],
      },
    };
  }

  const raw = await projectFile.async('string');
  let project: { targets?: ScratchTarget[] };
  try {
    project = JSON.parse(raw);
  } catch {
    return {
      metadata: {
        fileType: 'sb3',
        fileName,
        validationWarnings: ['Could not parse Scratch project.json'],
      },
    };
  }

  const targets = Array.isArray(project.targets) ? project.targets : [];
  const sprites = targets.filter((t) => !t.isStage);
  const allBlocks = targets.flatMap((t) => Object.values(t.blocks || {}));
  const opcodes = allBlocks.map((b) => String(b.opcode || '')).filter(Boolean);
  const scriptSummary = targets.flatMap((t) =>
    summarizeBlocks(t.blocks).map((op) => `${t.name || 'Sprite'}: ${op}`),
  );

  const scratchData = {
    spriteCount: sprites.length,
    blockCount: allBlocks.length,
    hasSound: targets.some((t) => (t.sounds?.length ?? 0) > 0) || opcodes.some((o) => o.startsWith('sound_')),
    hasMotion: opcodes.some((o) => MOTION_OPS.test(o)),
    hasLoops: opcodes.some((o) => LOOP_OPS.test(o)),
    hasConditionals: opcodes.some((o) => CONDITIONAL_OPS.test(o)),
    hasVariables: opcodes.some((o) => VARIABLE_OPS.test(o)),
    scriptSummary,
  };

  const extractedText = [
    `Scratch project: ${sprites.length} sprite(s), ${allBlocks.length} block(s)`,
    `Sprites: ${sprites.map((s) => s.name || 'Sprite').join(', ') || 'none'}`,
    scratchData.hasMotion ? 'Uses motion blocks' : 'No motion blocks detected',
    scratchData.hasLoops ? 'Uses loops' : 'No loop blocks detected',
    scratchData.hasConditionals ? 'Uses conditionals' : 'No conditional blocks detected',
    scratchData.hasSound ? 'Uses sound' : 'No sound detected',
    scriptSummary.length ? `Top scripts:\n${scriptSummary.join('\n')}` : 'No top-level scripts found',
  ].join('\n');

  return {
    extractedText,
    scratchData,
    metadata: {
      fileType: 'sb3',
      fileName,
    },
  };
}
