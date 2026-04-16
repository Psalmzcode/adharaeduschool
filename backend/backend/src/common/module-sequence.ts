import { ModuleStackVariant, Track3Stack, TrackLevel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Next module in handbook order (same logic as ModulesService.resolveNextModule). */
export async function resolveNextModuleRow(
  prisma: PrismaService,
  current: { track: TrackLevel; number: number; stackVariant: ModuleStackVariant },
  track3Stack: Track3Stack | null,
) {
  if (current.track !== TrackLevel.TRACK_3) {
    return prisma.module.findFirst({
      where: {
        track: current.track,
        number: current.number + 1,
        stackVariant: ModuleStackVariant.COMMON,
      },
    });
  }
  const stack = track3Stack ?? Track3Stack.PYTHON_FLASK;
  const branch =
    stack === Track3Stack.PYTHON_FLASK ? ModuleStackVariant.PYTHON_FLASK : ModuleStackVariant.REACT_NODE;
  const n = current.number;
  const sv = current.stackVariant;

  if (n < 3) {
    const nextNum = n + 1;
    if (nextNum === 3) {
      return prisma.module.findFirst({
        where: { track: TrackLevel.TRACK_3, number: 3, stackVariant: branch },
      });
    }
    return prisma.module.findFirst({
      where: { track: TrackLevel.TRACK_3, number: nextNum, stackVariant: ModuleStackVariant.COMMON },
    });
  }
  if (n === 3 && (sv === ModuleStackVariant.PYTHON_FLASK || sv === ModuleStackVariant.REACT_NODE)) {
    return prisma.module.findFirst({
      where: { track: TrackLevel.TRACK_3, number: 4, stackVariant: sv },
    });
  }
  if (n === 4 && (sv === ModuleStackVariant.PYTHON_FLASK || sv === ModuleStackVariant.REACT_NODE)) {
    return prisma.module.findFirst({
      where: { track: TrackLevel.TRACK_3, number: 5, stackVariant: ModuleStackVariant.COMMON },
    });
  }
  if (n === 5) {
    return prisma.module.findFirst({
      where: { track: TrackLevel.TRACK_3, number: 6, stackVariant: ModuleStackVariant.COMMON },
    });
  }
  return null;
}
