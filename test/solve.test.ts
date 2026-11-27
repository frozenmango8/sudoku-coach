import { describe, expect, it } from "vitest";
import { complete, countSolutions, isSolved, rate } from "../src/solve";

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("solution count", () => {
  it("counts an empty grid as more than one and a contradiction as none", () => {
    expect(countSolutions(new Array(81).fill(0), 2)).toBe(2);
    const bad = new Array<number>(81).fill(0);
    bad[0] = 1;
    bad[1] = 1;
    expect(countSolutions(bad, 2)).toBe(0);
  });

  it("completes a grid once, and that grid has one solution", () => {
    const solved = complete(undefined, rng(3));
    expect(solved).not.toBeNull();
    expect(isSolved(solved!)).toBe(true);
    expect(countSolutions(solved!, 2)).toBe(1);
    expect(complete(undefined, rng(3))).toEqual(solved);
  });

  it("rates a one-cell hole as a naked single", () => {
    const solved = complete(undefined, rng(5))!;
    const puzzle = solved.slice();
    puzzle[20] = 0;
    const rated = rate(puzzle);
    expect(rated.solved).toBe(true);
    expect(rated.hardest).toBe("naked-single");
    expect(rated.rank).toBe(1);
    expect(isSolved(puzzle)).toBe(false);
  });
});
