import { describe, expect, it } from "vitest";
import { hasConflict } from "../src/grid";
import { generate, rng } from "../src/generate";
import { countSolutions, rate } from "../src/solve";

function clues(puzzle: readonly number[]): number {
  let count = 0;
  for (const value of puzzle) if (value) count++;
  return count;
}

describe("generator", () => {
  it("builds a unique easy puzzle that only needs singles", () => {
    const puzzle = generate("easy", rng(1));
    const rated = rate(puzzle);
    expect(rated.solved).toBe(true);
    expect(rated.rank).toBeGreaterThanOrEqual(1);
    expect(rated.rank).toBeLessThanOrEqual(2);
    expect(hasConflict(puzzle)).toBe(false);
    expect(clues(puzzle)).toBeGreaterThan(17);
    expect(countSolutions(puzzle, 2)).toBe(1);
  });

  it("builds a unique medium puzzle that needs more than singles", () => {
    const puzzle = generate("medium", rng(2));
    const rated = rate(puzzle);
    expect(rated.solved).toBe(true);
    expect(rated.rank).toBeGreaterThanOrEqual(3);
    expect(rated.rank).toBeLessThanOrEqual(7);
    expect(rated.hardest).not.toBe("x-wing");
    expect(countSolutions(puzzle, 2)).toBe(1);
  });

  it("builds a unique hard puzzle that needs an X-wing", () => {
    const puzzle = generate("hard", rng(4));
    const rated = rate(puzzle);
    expect(rated.solved).toBe(true);
    expect(rated.hardest).toBe("x-wing");
    expect(hasConflict(puzzle)).toBe(false);
    expect(countSolutions(puzzle, 2)).toBe(1);
  });

  it("repeats a puzzle when the seed is the same", () => {
    expect(generate("easy", rng(8))).toEqual(generate("easy", rng(8)));
  });
});
