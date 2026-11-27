import {
  ALL,
  BIT_COUNT,
  BOXES,
  COLS,
  DIGIT_INDEX,
  DIGIT_OF_BIT,
  ROWS,
  UNITS,
  boxOf,
  cellName,
  colOf,
  digitsOf,
  rowOf,
} from "./grid";

export type Technique =
  | "naked-single"
  | "hidden-single"
  | "naked-pair"
  | "hidden-pair"
  | "naked-triple"
  | "hidden-triple"
  | "pointing"
  | "box-line"
  | "x-wing";

export const TECHNIQUE_RANK: Record<Technique, number> = {
  "naked-single": 1,
  "hidden-single": 2,
  "naked-pair": 3,
  "hidden-pair": 4,
  pointing: 5,
  "box-line": 5,
  "naked-triple": 6,
  "hidden-triple": 7,
  "x-wing": 8,
};

const ORDER: Technique[] = [
  "naked-single",
  "hidden-single",
  "naked-pair",
  "hidden-pair",
  "pointing",
  "box-line",
  "naked-triple",
  "hidden-triple",
  "x-wing",
];

// Grading tries thousands of steps and never shows the sentence.
let withText = true;

export interface Placement {
  index: number;
  digit: number;
}

export interface Elimination {
  index: number;
  digit: number;
}

export interface Step {
  technique: Technique;
  text: string;
  focus: number[];
  related: number[];
  place: Placement | null;
  eliminate: Elimination[];
}

const BOX_NAME = [
  "top-left box",
  "top-middle box",
  "top-right box",
  "middle-left box",
  "center box",
  "middle-right box",
  "bottom-left box",
  "bottom-middle box",
  "bottom-right box",
];

function inUnit(unit: number): string {
  if (unit < 9) return `row ${unit + 1}`;
  if (unit < 18) return `column ${unit - 8}`;
  return `the ${BOX_NAME[unit - 18]}`;
}

function list(nums: number[], conjunction: "and" | "or"): string {
  if (nums.length <= 1) return String(nums[0] ?? "");
  if (nums.length === 2) return `${nums[0]} ${conjunction} ${nums[1]}`;
  return `${nums.slice(0, -1).join(", ")}, ${conjunction} ${nums[nums.length - 1]}`;
}

function locateInUnit(unit: number, cells: number[]): string {
  const numbers = unit < 9
    ? cells.map((index) => colOf(index) + 1)
    : unit < 18
      ? cells.map((index) => rowOf(index) + 1)
      : [];
  if (unit < 9) {
    return numbers.length === 1 ? `column ${numbers[0]}` : `columns ${list(numbers, "and")}`;
  }
  if (unit < 18) {
    return numbers.length === 1 ? `row ${numbers[0]}` : `rows ${list(numbers, "and")}`;
  }
  const names = cells.map(cellName);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join("; ")} and ${names[names.length - 1]}`;
}

function affected(eliminate: Elimination[]): number[] {
  const seen = new Uint8Array(81);
  const cells: number[] = [];
  for (const elim of eliminate) {
    if (seen[elim.index]) continue;
    seen[elim.index] = 1;
    cells.push(elim.index);
  }
  return cells;
}

function eliminations(mask: number, index: number): Elimination[] {
  const found: Elimination[] = [];
  let rest = mask;
  while (rest) {
    const piece = rest & -rest;
    found.push({ index, digit: DIGIT_OF_BIT[piece] });
    rest ^= piece;
  }
  return found;
}

function findNakedSingle(masks: Uint16Array): Step | null {
  for (let index = 0; index < 81; index++) {
    const mask = masks[index];
    if (!mask || (mask & (mask - 1)) !== 0) continue;
    const digit = DIGIT_OF_BIT[mask];
    const name = withText ? cellName(index) : "";
    return {
      technique: "naked-single",
      focus: [index],
      related: [],
      place: { index, digit },
      eliminate: [],
      text: withText ? `${name[0].toUpperCase()}${name.slice(1)} can only be ${digit}.` : "",
    };
  }
  return null;
}

function findHiddenSingle(masks: Uint16Array): Step | null {
  for (let unit = 0; unit < UNITS.length; unit++) {
    const count = new Uint8Array(9);
    const where = new Uint8Array(9);
    for (const index of UNITS[unit]) {
      let mask = masks[index];
      while (mask) {
        const piece = mask & -mask;
        const digit = DIGIT_INDEX[piece];
        count[digit]++;
        where[digit] = index;
        mask ^= piece;
      }
    }
    for (let digit = 0; digit < 9; digit++) {
      if (count[digit] !== 1) continue;
      const index = where[digit];
      const mask = masks[index];
      if ((mask & (mask - 1)) === 0) continue;
      const related = UNITS[unit].filter((cell) => cell !== index);
      return {
        technique: "hidden-single",
        focus: [index],
        related,
        place: { index, digit: digit + 1 },
        eliminate: [],
        text: withText ? `In ${inUnit(unit)}, ${digit + 1} can go only in ${cellName(index)}.` : "",
      };
    }
  }
  return null;
}

function findNakedSubset(masks: Uint16Array, size: 2 | 3): Step | null {
  const technique: Technique = size === 2 ? "naked-pair" : "naked-triple";
  const label = size === 2 ? "Naked pair" : "Naked triple";
  for (let unit = 0; unit < UNITS.length; unit++) {
    const cells = UNITS[unit].filter((index) => {
      const count = BIT_COUNT[masks[index]];
      return count >= 2 && count <= size;
    });
    if (cells.length < size) continue;
    const chosen: number[] = [];
    const visit = (start: number): Step | null => {
      if (chosen.length === size) {
        let union = 0;
        for (const index of chosen) union |= masks[index];
        if (BIT_COUNT[union] !== size) return null;
        const eliminate: Elimination[] = [];
        for (const index of UNITS[unit]) {
          if (chosen.includes(index)) continue;
          eliminate.push(...eliminations(masks[index] & union, index));
        }
        if (!eliminate.length) return null;
        return {
          technique,
          focus: chosen.slice(),
          related: affected(eliminate),
          place: null,
          eliminate,
          text: withText
            ? `The cells in ${locateInUnit(unit, chosen)} can only be ${list(digitsOf(union), "or")}, ` +
              `so those digits can be removed from the rest of ${inUnit(unit)}. (${label}.)`
            : "",
        };
      }
      for (let i = start; i < cells.length; i++) {
        chosen.push(cells[i]);
        const step = visit(i + 1);
        if (step) return step;
        chosen.pop();
      }
      return null;
    };
    const step = visit(0);
    if (step) return step;
  }
  return null;
}

function findHiddenSubset(masks: Uint16Array, size: 2 | 3): Step | null {
  const technique: Technique = size === 2 ? "hidden-pair" : "hidden-triple";
  const label = size === 2 ? "Hidden pair" : "Hidden triple";
  for (let unit = 0; unit < UNITS.length; unit++) {
    const positions: number[][] = [[], [], [], [], [], [], [], [], []];
    for (const index of UNITS[unit]) {
      let mask = masks[index];
      while (mask) {
        const piece = mask & -mask;
        positions[DIGIT_INDEX[piece]].push(index);
        mask ^= piece;
      }
    }
    const digits: number[] = [];
    for (let digit = 0; digit < 9; digit++) {
      const count = positions[digit].length;
      if (count >= 2 && count <= size) digits.push(digit);
    }
    if (digits.length < size) continue;
    const chosen: number[] = [];
    const visit = (start: number): Step | null => {
      if (chosen.length === size) {
        const seen = new Uint8Array(81);
        const cells: number[] = [];
        for (const digit of chosen) {
          for (const index of positions[digit]) {
            if (seen[index]) continue;
            seen[index] = 1;
            cells.push(index);
          }
        }
        if (cells.length !== size) return null;
        let keep = 0;
        for (const digit of chosen) keep |= 1 << digit;
        const eliminate: Elimination[] = [];
        for (const index of cells) {
          eliminate.push(...eliminations(masks[index] & ~keep & ALL, index));
        }
        if (!eliminate.length) return null;
        const nums = chosen.map((digit) => digit + 1);
        return {
          technique,
          focus: cells,
          related: [],
          place: null,
          eliminate,
          text: withText
            ? `In ${inUnit(unit)}, ${list(nums, "and")} appear only in ${locateInUnit(unit, cells)}. ` +
              `Other candidates there can be removed. (${label}.)`
            : "",
        };
      }
      for (let i = start; i < digits.length; i++) {
        chosen.push(digits[i]);
        const step = visit(i + 1);
        if (step) return step;
        chosen.pop();
      }
      return null;
    };
    const step = visit(0);
    if (step) return step;
  }
  return null;
}

function findPointing(masks: Uint16Array): Step | null {
  for (let box = 0; box < 9; box++) {
    for (let digit = 0; digit < 9; digit++) {
      const flag = 1 << digit;
      const hits = BOXES[box].filter((index) => masks[index] & flag);
      if (hits.length < 2) continue;
      const value = digit + 1;
      const row = rowOf(hits[0]);
      if (hits.every((index) => rowOf(index) === row)) {
        const eliminate: Elimination[] = [];
        for (const index of ROWS[row]) {
          if (boxOf(index) !== box && masks[index] & flag) {
            eliminate.push({ index, digit: value });
          }
        }
        if (eliminate.length) {
          const kind = hits.length === 2 ? "pair" : "triple";
          return {
            technique: "pointing",
            focus: hits,
            related: affected(eliminate),
            place: null,
            eliminate,
            text: withText
              ? `In the ${BOX_NAME[box]}, ${value} appears only in row ${row + 1}, ` +
                `so it can be removed from the rest of that row. (Pointing ${kind}.)`
              : "",
          };
        }
      }
      const col = colOf(hits[0]);
      if (hits.every((index) => colOf(index) === col)) {
        const eliminate: Elimination[] = [];
        for (const index of COLS[col]) {
          if (boxOf(index) !== box && masks[index] & flag) {
            eliminate.push({ index, digit: value });
          }
        }
        if (eliminate.length) {
          const kind = hits.length === 2 ? "pair" : "triple";
          return {
            technique: "pointing",
            focus: hits,
            related: affected(eliminate),
            place: null,
            eliminate,
            text: withText
              ? `In the ${BOX_NAME[box]}, ${value} appears only in column ${col + 1}, ` +
                `so it can be removed from the rest of that column. (Pointing ${kind}.)`
              : "",
          };
        }
      }
    }
  }
  return null;
}

function findBoxLine(masks: Uint16Array): Step | null {
  for (let line = 0; line < 18; line++) {
    const horizontal = line < 9;
    for (let digit = 0; digit < 9; digit++) {
      const flag = 1 << digit;
      const hits = UNITS[line].filter((index) => masks[index] & flag);
      if (hits.length < 2) continue;
      const box = boxOf(hits[0]);
      if (!hits.every((index) => boxOf(index) === box)) continue;
      const value = digit + 1;
      const eliminate: Elimination[] = [];
      for (const index of BOXES[box]) {
        const onLine = horizontal ? rowOf(index) === line : colOf(index) === line - 9;
        if (!onLine && masks[index] & flag) eliminate.push({ index, digit: value });
      }
      if (!eliminate.length) continue;
      const where = horizontal ? `row ${line + 1}` : `column ${line - 8}`;
      return {
        technique: "box-line",
        focus: hits,
        related: affected(eliminate),
        place: null,
        eliminate,
        text: withText
          ? `In ${where}, ${value} appears only in the ${BOX_NAME[box]}, ` +
            `so it can be removed from the rest of that box. (Box-line reduction.)`
          : "",
      };
    }
  }
  return null;
}

function findXWing(masks: Uint16Array): Step | null {
  for (let digit = 0; digit < 9; digit++) {
    const flag = 1 << digit;
    const value = digit + 1;
    const rowCols: number[][] = [];
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) if (masks[r * 9 + c] & flag) cols.push(c);
      rowCols.push(cols);
    }
    for (let r1 = 0; r1 < 9; r1++) {
      const left = rowCols[r1];
      if (left.length !== 2) continue;
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        const right = rowCols[r2];
        if (right.length !== 2 || left[0] !== right[0] || left[1] !== right[1]) continue;
        const eliminate: Elimination[] = [];
        for (let r = 0; r < 9; r++) {
          if (r === r1 || r === r2) continue;
          for (const c of left) {
            const index = r * 9 + c;
            if (masks[index] & flag) eliminate.push({ index, digit: value });
          }
        }
        if (!eliminate.length) continue;
        return {
          technique: "x-wing",
          focus: [r1 * 9 + left[0], r1 * 9 + left[1], r2 * 9 + left[0], r2 * 9 + left[1]],
          related: affected(eliminate),
          place: null,
          eliminate,
          text: withText
            ? `In rows ${r1 + 1} and ${r2 + 1}, ${value} appears only in columns ${left[0] + 1} and ${left[1] + 1}. ` +
              `The ${value}s in those rows occupy both columns, so ${value} can be removed from the rest of those columns. (X-wing.)`
            : "",
        };
      }
    }

    const colRows: number[][] = [];
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) if (masks[r * 9 + c] & flag) rows.push(r);
      colRows.push(rows);
    }
    for (let c1 = 0; c1 < 9; c1++) {
      const left = colRows[c1];
      if (left.length !== 2) continue;
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        const right = colRows[c2];
        if (right.length !== 2 || left[0] !== right[0] || left[1] !== right[1]) continue;
        const eliminate: Elimination[] = [];
        for (let c = 0; c < 9; c++) {
          if (c === c1 || c === c2) continue;
          for (const r of left) {
            const index = r * 9 + c;
            if (masks[index] & flag) eliminate.push({ index, digit: value });
          }
        }
        if (!eliminate.length) continue;
        return {
          technique: "x-wing",
          focus: [left[0] * 9 + c1, left[1] * 9 + c1, left[0] * 9 + c2, left[1] * 9 + c2],
          related: affected(eliminate),
          place: null,
          eliminate,
          text: withText
            ? `In columns ${c1 + 1} and ${c2 + 1}, ${value} appears only in rows ${left[0] + 1} and ${left[1] + 1}. ` +
              `The ${value}s in those columns occupy both rows, so ${value} can be removed from the rest of those rows. (X-wing.)`
            : "",
        };
      }
    }
  }
  return null;
}

function dispatch(technique: Technique, masks: Uint16Array): Step | null {
  switch (technique) {
    case "naked-single":
      return findNakedSingle(masks);
    case "hidden-single":
      return findHiddenSingle(masks);
    case "naked-pair":
      return findNakedSubset(masks, 2);
    case "hidden-pair":
      return findHiddenSubset(masks, 2);
    case "pointing":
      return findPointing(masks);
    case "box-line":
      return findBoxLine(masks);
    case "naked-triple":
      return findNakedSubset(masks, 3);
    case "hidden-triple":
      return findHiddenSubset(masks, 3);
    case "x-wing":
      return findXWing(masks);
  }
}

export function findStep(technique: Technique, masks: Uint16Array): Step | null {
  withText = true;
  return dispatch(technique, masks);
}

export function easiest(masks: Uint16Array, explain = true): Step | null {
  withText = explain;
  for (const technique of ORDER) {
    const step = dispatch(technique, masks);
    if (step) return step;
  }
  return null;
}
