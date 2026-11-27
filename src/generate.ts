import { complete, countSolutions, rate } from "./solve";

export type Difficulty = "easy" | "medium" | "hard";

const MIN_RANK: Record<Difficulty, number> = {
  easy: 1,
  medium: 3,
  hard: 8,
};

const MAX_RANK: Record<Difficulty, number> = {
  easy: 2,
  medium: 7,
  hard: 8,
};

export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function order(random: () => number): number[] {
  const cells = Array.from({ length: 81 }, (_, index) => index);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swap = cells[i];
    cells[i] = cells[j];
    cells[j] = swap;
  }
  return cells;
}

const BLANK = new Array<number>(81).fill(0);

function dig(solved: readonly number[], random: () => number, maxRank: number): { puzzle: number[]; rank: number } {
  const puzzle = solved.slice();
  let rank = 0;
  // A finished logical solve is unique: every filled digit was forced.
  for (const index of order(random)) {
    if (!puzzle[index]) continue;
    const saved = puzzle[index];
    puzzle[index] = 0;
    const rated = rate(puzzle, maxRank);
    if (!rated.solved) {
      puzzle[index] = saved;
      continue;
    }
    rank = rated.rank;
  }
  return { puzzle, rank };
}

function minimize(solved: readonly number[], random: () => number): number[] {
  const puzzle = solved.slice();
  for (let pass = 0; pass < 8; pass++) {
    let removed = false;
    for (const index of order(random)) {
      if (!puzzle[index]) continue;
      const saved = puzzle[index];
      puzzle[index] = 0;
      // -1 means the counter gave up; keep the clue rather than risk a second solution.
      if (countSolutions(puzzle, 2) !== 1) puzzle[index] = saved;
      else removed = true;
    }
    if (!removed) break;
  }
  return puzzle;
}

function withOneClue(puzzle: number[], solved: readonly number[], random: () => number): number[] | null {
  for (const index of order(random)) {
    if (puzzle[index]) continue;
    puzzle[index] = solved[index];
    const next = rate(puzzle, 8);
    if (next.solved && next.rank === 8) return puzzle.slice();
    puzzle[index] = 0;
  }
  return null;
}

function generateHard(random: () => number): number[] | null {
  const solved = complete(BLANK, random);
  if (!solved) return null;
  const puzzle = minimize(solved, random);
  const rated = rate(puzzle, 8);
  if (rated.solved) return rated.rank === 8 ? puzzle : null;
  // Digging while the puzzle stays solvable rarely reaches an X-wing: singles
  // give out first. A minimal unique grid is often one clue past this solver,
  // and putting that clue back is where an X-wing becomes necessary.
  return withOneClue(puzzle, solved, random);
}

export function generate(difficulty: Difficulty, random: () => number = Math.random): number[] {
  const minRank = MIN_RANK[difficulty];
  const maxRank = MAX_RANK[difficulty];
  const attempts = difficulty === "hard" ? 200 : 30;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (difficulty === "hard") {
      const puzzle = generateHard(random);
      if (puzzle) return puzzle;
      continue;
    }
    const solved = complete(BLANK, random);
    if (!solved) continue;
    const dug = dig(solved, random, maxRank);
    if (dug.rank >= minRank && dug.rank <= maxRank) return dug.puzzle;
  }
  throw new Error(`could not generate a ${difficulty} puzzle`);
}
