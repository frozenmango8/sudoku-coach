import {
  ALL,
  BIT_COUNT,
  DIGIT_OF_BIT,
  PEERS,
  bit,
  boxOf,
  candidateMasks,
  colOf,
  hasConflict,
  rowOf,
} from "./grid";
import { TECHNIQUE_RANK, easiest, type Step, type Technique } from "./techniques";

export interface Rating {
  solved: boolean;
  rank: number;
  hardest: Technique | null;
}

function filled(values: Uint8Array): boolean {
  for (let i = 0; i < 81; i++) if (!values[i]) return false;
  return true;
}

function place(values: Uint8Array, masks: Uint16Array, index: number, digit: number): void {
  values[index] = digit;
  masks[index] = 0;
  const flag = bit(digit);
  for (const peer of PEERS[index]) masks[peer] &= ~flag;
}

export function rate(values: ArrayLike<number>, maxRank = 8): Rating {
  if (hasConflict(values)) return { solved: false, rank: 0, hardest: null };
  const grid = Uint8Array.from(values);
  const masks = candidateMasks(grid);
  let rank = 0;
  let hardest: Technique | null = null;
  for (let guard = 0; guard < 400; guard++) {
    if (filled(grid)) return { solved: true, rank, hardest };
    const step = easiest(masks, false);
    if (!step || (!step.place && step.eliminate.length === 0)) {
      return { solved: false, rank, hardest };
    }
    const stepRank = TECHNIQUE_RANK[step.technique];
    if (stepRank > rank) {
      rank = stepRank;
      hardest = step.technique;
    }
    if (stepRank > maxRank) return { solved: false, rank, hardest };
    if (step.place) place(grid, masks, step.place.index, step.place.digit);
    else {
      for (const elim of step.eliminate) masks[elim.index] &= ~bit(elim.digit);
    }
  }
  return { solved: false, rank, hardest };
}

export function nextStep(values: ArrayLike<number>, eliminated?: ArrayLike<number>): Step | null {
  const masks = candidateMasks(values);
  if (eliminated) {
    for (let i = 0; i < 81; i++) masks[i] &= ~(eliminated[i] ?? 0);
  }
  return easiest(masks);
}

export function isSolved(values: ArrayLike<number>): boolean {
  for (let i = 0; i < 81; i++) if (!values[i]) return false;
  return !hasConflict(values);
}

export function noCandidate(values: ArrayLike<number>, eliminated?: ArrayLike<number>): boolean {
  const masks = candidateMasks(values);
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    const mask = eliminated ? masks[i] & ~eliminated[i] : masks[i];
    if (!mask) return true;
  }
  return false;
}

interface Walk {
  found: number;
  grid: Uint8Array | null;
}

function bitsOf(mask: number, random: (() => number) | null): number[] {
  const bits: number[] = [];
  let rest = mask;
  while (rest) {
    const piece = rest & -rest;
    bits.push(piece);
    rest ^= piece;
  }
  if (!random) return bits;
  for (let i = bits.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = bits[i];
    bits[i] = bits[j];
    bits[j] = swap;
  }
  return bits;
}

function walk(values: ArrayLike<number>, limit: number, random: (() => number) | null): Walk {
  const grid = new Uint8Array(81);
  const row = new Uint16Array(9);
  const col = new Uint16Array(9);
  const box = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const digit = values[i] | 0;
    if (!digit) continue;
    const flag = bit(digit);
    const r = rowOf(i);
    const c = colOf(i);
    const b = boxOf(i);
    if ((row[r] | col[c] | box[b]) & flag) return { found: 0, grid: null };
    grid[i] = digit;
    row[r] |= flag;
    col[c] |= flag;
    box[b] |= flag;
  }

  let found = 0;
  let nodes = 0;
  let solved: Uint8Array | null = null;
  const nodeCap = 500_000;

  function search(): void {
    if (found >= limit || found < 0) return;
    // Wide-open contradictions can explore for a long time.
    if (++nodes > nodeCap) {
      found = -1;
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      const mask = ALL & ~(row[rowOf(i)] | col[colOf(i)] | box[boxOf(i)]);
      const count = BIT_COUNT[mask];
      if (count === 0) return;
      if (count < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = count;
        if (count === 1) break;
      }
    }
    if (best < 0) {
      found++;
      if (random) solved = grid.slice();
      return;
    }
    const r = rowOf(best);
    const c = colOf(best);
    const b = boxOf(best);
    for (const flag of bitsOf(bestMask, random)) {
      grid[best] = DIGIT_OF_BIT[flag];
      row[r] |= flag;
      col[c] |= flag;
      box[b] |= flag;
      search();
      row[r] ^= flag;
      col[c] ^= flag;
      box[b] ^= flag;
      grid[best] = 0;
      if (found >= limit || found < 0) return;
    }
  }

  search();
  return { found, grid: solved };
}

export function countSolutions(values: ArrayLike<number>, limit = 2): number {
  return walk(values, limit, null).found;
}

const EMPTY = new Array<number>(81).fill(0);

export function complete(values: ArrayLike<number> = EMPTY, random: () => number = Math.random): number[] | null {
  const result = walk(values, 1, random);
  if (result.found !== 1 || !result.grid) return null;
  return Array.from(result.grid);
}
