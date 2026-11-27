export const ALL = 0x1ff;

export const BIT_COUNT = new Uint8Array(512);
export const DIGIT_OF_BIT = new Uint8Array(512);
export const DIGIT_INDEX = new Uint8Array(512);

for (let digit = 0; digit < 9; digit++) {
  const bit = 1 << digit;
  DIGIT_OF_BIT[bit] = digit + 1;
  DIGIT_INDEX[bit] = digit;
}
for (let mask = 1; mask < 512; mask++) {
  BIT_COUNT[mask] = BIT_COUNT[mask >> 1] + (mask & 1);
}

export function bit(digit: number): number {
  return 1 << (digit - 1);
}

export function digitsOf(mask: number): number[] {
  const digits: number[] = [];
  let rest = mask & ALL;
  while (rest) {
    const piece = rest & -rest;
    digits.push(DIGIT_OF_BIT[piece]);
    rest ^= piece;
  }
  return digits;
}

export function rowOf(index: number): number {
  return (index / 9) | 0;
}

export function colOf(index: number): number {
  return index % 9;
}

export function boxOf(index: number): number {
  return ((index / 27) | 0) * 3 + (((index % 9) / 3) | 0);
}

export function cellName(index: number): string {
  return `row ${rowOf(index) + 1}, column ${colOf(index) + 1}`;
}

export const ROWS: number[][] = [];
export const COLS: number[][] = [];
export const BOXES: number[][] = [];

for (let r = 0; r < 9; r++) {
  const row: number[] = [];
  for (let c = 0; c < 9; c++) row.push(r * 9 + c);
  ROWS.push(row);
}
for (let c = 0; c < 9; c++) {
  const col: number[] = [];
  for (let r = 0; r < 9; r++) col.push(r * 9 + c);
  COLS.push(col);
}
for (let b = 0; b < 9; b++) {
  const r0 = ((b / 3) | 0) * 3;
  const c0 = (b % 3) * 3;
  const box: number[] = [];
  for (let dr = 0; dr < 3; dr++) {
    for (let dc = 0; dc < 3; dc++) box.push((r0 + dr) * 9 + c0 + dc);
  }
  BOXES.push(box);
}

export const UNITS: number[][] = [...ROWS, ...COLS, ...BOXES];

export const PEERS: number[][] = [];
for (let index = 0; index < 81; index++) {
  const seen = new Set<number>();
  for (const cell of ROWS[rowOf(index)]) seen.add(cell);
  for (const cell of COLS[colOf(index)]) seen.add(cell);
  for (const cell of BOXES[boxOf(index)]) seen.add(cell);
  seen.delete(index);
  PEERS.push([...seen]);
}

export function candidateMasks(values: ArrayLike<number>): Uint16Array {
  const row = new Uint16Array(9);
  const col = new Uint16Array(9);
  const box = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const digit = values[i];
    if (!digit) continue;
    const flag = bit(digit);
    row[rowOf(i)] |= flag;
    col[colOf(i)] |= flag;
    box[boxOf(i)] |= flag;
  }
  const masks = new Uint16Array(81);
  for (let i = 0; i < 81; i++) {
    if (values[i]) continue;
    masks[i] = ALL & ~(row[rowOf(i)] | col[colOf(i)] | box[boxOf(i)]);
  }
  return masks;
}

export function conflictFlags(values: ArrayLike<number>): Uint8Array {
  const bad = new Uint8Array(81);
  for (const unit of UNITS) {
    const seen = new Int16Array(10).fill(-1);
    for (const index of unit) {
      const digit = values[index];
      if (!digit) continue;
      const prev = seen[digit];
      if (prev === -1) seen[digit] = index;
      else {
        bad[index] = 1;
        bad[prev] = 1;
      }
    }
  }
  return bad;
}

export function hasConflict(values: ArrayLike<number>): boolean {
  for (let i = 0; i < 81; i++) {
    const digit = values[i];
    if (!digit) continue;
    for (const peer of PEERS[i]) {
      if (values[peer] === digit) return true;
    }
  }
  return false;
}
