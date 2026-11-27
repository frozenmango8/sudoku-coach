import { describe, expect, it } from "vitest";
import { candidateMasks, conflictFlags, hasConflict } from "../src/grid";
import { easiest, findStep } from "../src/techniques";

function mask(...digits: number[]): number {
  return digits.reduce((bits, digit) => bits | (1 << (digit - 1)), 0);
}

function grid(cells: Record<number, number>): Uint16Array {
  const masks = new Uint16Array(81);
  for (const [index, bits] of Object.entries(cells)) masks[Number(index)] = bits;
  return masks;
}

function at(row: number, col: number): number {
  return row * 9 + col;
}

describe("candidate masks", () => {
  it("drops digits already used in the row, column, or box", () => {
    const values = new Array<number>(81).fill(0);
    for (let col = 1; col < 9; col++) values[col] = col;
    values[9] = 9;
    const masks = candidateMasks(values);
    expect(masks[0]).toBe(0);
    expect(masks[at(2, 0)] & mask(9)).toBe(0);
    expect(masks[at(1, 1)] & mask(1)).toBe(0);
    expect(masks[at(4, 4)] & mask(9)).toBe(mask(9));
  });

  it("flags duplicate placements", () => {
    const values = new Array<number>(81).fill(0);
    values[0] = 4;
    values[1] = 4;
    expect(hasConflict(values)).toBe(true);
    expect(conflictFlags(values)[0]).toBe(1);
    expect(conflictFlags(values)[1]).toBe(1);
    values[1] = 5;
    expect(hasConflict(values)).toBe(false);
  });
});

describe("techniques", () => {
  it("finds a naked single", () => {
    const step = findStep("naked-single", grid({ 4: mask(7) }));
    expect(step?.place).toEqual({ index: 4, digit: 7 });
    expect(step?.text).toBe("Row 1, column 5 can only be 7.");
  });

  it("finds a hidden single and ignores a cell that is already naked", () => {
    const masks = grid({
      0: mask(1, 2),
      1: mask(2, 3),
    });
    const step = findStep("hidden-single", masks);
    expect(step?.place).toEqual({ index: 0, digit: 1 });
    expect(step?.text).toBe("In row 1, 1 can go only in row 1, column 1.");
    expect(step?.related).toContain(1);
    expect(findStep("hidden-single", grid({ 0: mask(4) }))).toBeNull();
  });

  it("prefers a naked single over a later pattern", () => {
    const step = easiest(grid({
      0: mask(1),
      2: mask(1, 2),
      3: mask(1, 2),
      4: mask(1, 3),
    }));
    expect(step?.technique).toBe("naked-single");
  });

  it("eliminates with a naked pair", () => {
    const step = findStep("naked-pair", grid({
      0: mask(1, 2),
      1: mask(1, 2),
      2: mask(1, 3),
    }));
    expect(step?.focus).toEqual([0, 1]);
    expect(step?.eliminate).toEqual([{ index: 2, digit: 1 }]);
    expect(step?.text).toContain("Naked pair");
    expect(step?.text).toContain("columns 1 and 2");
  });

  it("does not report a naked pair that eliminates nothing", () => {
    expect(findStep("naked-pair", grid({
      0: mask(1, 2),
      1: mask(1, 2),
    }))).toBeNull();
  });

  it("eliminates with a hidden pair", () => {
    const step = findStep("hidden-pair", grid({
      0: mask(1, 2, 3),
      1: mask(1, 2, 4),
      2: mask(3, 5),
      3: mask(4, 5),
    }));
    expect(step?.technique).toBe("hidden-pair");
    expect(step?.focus).toEqual([0, 1]);
    expect(step?.eliminate).toEqual([
      { index: 0, digit: 3 },
      { index: 1, digit: 4 },
    ]);
    expect(step?.text).toContain("Hidden pair");
    expect(step?.text).toMatch(/1 and 2 appear only in columns 1 and 2/);
  });

  it("eliminates with a naked triple", () => {
    const step = findStep("naked-triple", grid({
      0: mask(1, 2),
      1: mask(1, 3),
      2: mask(2, 3),
      3: mask(1, 4),
    }));
    expect(step?.focus).toEqual([0, 1, 2]);
    expect(step?.eliminate).toEqual([{ index: 3, digit: 1 }]);
    expect(step?.text).toContain("Naked triple");
  });

  it("eliminates with a hidden triple", () => {
    const step = findStep("hidden-triple", grid({
      0: mask(1, 2, 3, 7),
      1: mask(1, 2, 4),
      2: mask(1, 3, 5),
      3: mask(4, 6),
      4: mask(5, 6),
      5: mask(7, 8),
      6: mask(8, 9),
    }));
    expect(step?.technique).toBe("hidden-triple");
    expect(step?.focus.slice().sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(step?.eliminate).toContainEqual({ index: 0, digit: 7 });
    expect(step?.text).toContain("Hidden triple");
  });

  it("eliminates with a pointing pair and a pointing triple", () => {
    const pair = findStep("pointing", grid({
      0: mask(5, 1),
      1: mask(5, 2),
      5: mask(5, 3),
    }));
    expect(pair?.focus).toEqual([0, 1]);
    expect(pair?.eliminate).toEqual([{ index: 5, digit: 5 }]);
    expect(pair?.text).toContain("Pointing pair");
    expect(pair?.text).toContain("top-left box");

    const triple = findStep("pointing", grid({
      0: mask(8),
      1: mask(8),
      2: mask(8),
      8: mask(8),
    }));
    expect(triple?.focus).toEqual([0, 1, 2]);
    expect(triple?.eliminate).toEqual([{ index: 8, digit: 8 }]);
    expect(triple?.text).toContain("Pointing triple");
  });

  it("ignores a pointing pattern with nothing to remove", () => {
    expect(findStep("pointing", grid({
      0: mask(5),
      1: mask(5),
    }))).toBeNull();
  });

  it("eliminates with box-line reduction on a row and a column", () => {
    const row = findStep("box-line", grid({
      0: mask(6),
      1: mask(6),
      9: mask(6),
    }));
    expect(row?.focus).toEqual([0, 1]);
    expect(row?.eliminate).toEqual([{ index: 9, digit: 6 }]);
    expect(row?.text).toContain("Box-line reduction");
    expect(row?.text).toContain("row 1");

    const column = findStep("box-line", grid({
      [at(0, 3)]: mask(4),
      [at(1, 3)]: mask(4),
      [at(2, 4)]: mask(4),
    }));
    expect(column?.eliminate).toEqual([{ index: at(2, 4), digit: 4 }]);
    expect(column?.text).toContain("column 4");
  });

  it("eliminates with a row X-wing and a column X-wing", () => {
    const row = findStep("x-wing", grid({
      [at(0, 1)]: mask(7),
      [at(0, 6)]: mask(7),
      [at(4, 1)]: mask(7),
      [at(4, 6)]: mask(7),
      [at(2, 1)]: mask(7, 1),
    }));
    expect(row?.focus).toEqual([at(0, 1), at(0, 6), at(4, 1), at(4, 6)]);
    expect(row?.eliminate).toEqual([{ index: at(2, 1), digit: 7 }]);
    expect(row?.text).toContain("X-wing");
    expect(row?.text).toContain("rows 1 and 5");

    const column = findStep("x-wing", grid({
      [at(1, 0)]: mask(4),
      [at(1, 3)]: mask(4),
      [at(6, 0)]: mask(4),
      [at(6, 3)]: mask(4),
      [at(1, 8)]: mask(4, 2),
    }));
    expect(column?.eliminate).toEqual([{ index: at(1, 8), digit: 4 }]);
    expect(column?.text).toContain("columns 1 and 4");
  });

  it("ignores an X-wing with nothing outside the rectangle", () => {
    expect(findStep("x-wing", grid({
      [at(0, 1)]: mask(7),
      [at(0, 6)]: mask(7),
      [at(4, 1)]: mask(7),
      [at(4, 6)]: mask(7),
    }))).toBeNull();
  });

  it("returns null when no technique applies", () => {
    expect(easiest(new Uint16Array(81))).toBeNull();
  });
});
