import type { Difficulty } from "./generate";
import { PEERS, bit, candidateMasks, conflictFlags, hasConflict } from "./grid";
import { countSolutions, isSolved, nextStep, noCandidate } from "./solve";
import type { Step } from "./techniques";

const UNDO_CAP = 80;

export interface Snap {
  values: number[];
  notes: number[];
  eliminated: number[];
}

export interface Game {
  mode: "play" | "enter";
  difficulty: Difficulty | "custom";
  givens: number[];
  values: number[];
  notes: number[];
  eliminated: number[];
  selected: number;
  notesMode: boolean;
  undo: Snap[];
  redo: Snap[];
  hint: Step | null;
  message: string;
  backup: Game | null;
}

function empty(): number[] {
  return new Array<number>(81).fill(0);
}

function snap(game: Game): Snap {
  return {
    values: game.values.slice(),
    notes: game.notes.slice(),
    eliminated: game.eliminated.slice(),
  };
}

function pushUndo(game: Game): void {
  game.undo.push(snap(game));
  if (game.undo.length > UNDO_CAP) game.undo.shift();
  game.redo = [];
  game.hint = null;
  game.message = "";
}

function writeNotes(game: Game): void {
  const masks = candidateMasks(game.values);
  for (let i = 0; i < 81; i++) {
    game.notes[i] = game.values[i] ? 0 : masks[i] & ~game.eliminated[i];
  }
}

export function newGame(difficulty: Difficulty, puzzle: ArrayLike<number>): Game {
  const values = Array.from(puzzle);
  const hole = values.findIndex((value) => value === 0);
  const game: Game = {
    mode: "play",
    difficulty,
    givens: values.slice(),
    values,
    notes: empty(),
    eliminated: empty(),
    selected: hole < 0 ? 0 : hole,
    notesMode: false,
    undo: [],
    redo: [],
    hint: null,
    message: "",
    backup: null,
  };
  return game;
}

export function remaining(game: Game): number {
  let count = 0;
  for (const value of game.values) if (!value) count++;
  return count;
}

export function conflicts(game: Game): Uint8Array {
  return conflictFlags(game.values);
}

export function inputDigit(game: Game, digit: number): void {
  if (digit < 1 || digit > 9) return;
  const index = game.selected;
  if (game.mode === "play" && game.givens[index]) return;

  if (game.mode === "play" && game.notesMode) {
    if (game.values[index]) return;
    const flag = bit(digit);
    pushUndo(game);
    if (game.notes[index] & flag) game.notes[index] &= ~flag;
    else {
      game.notes[index] |= flag;
      // Putting the mark back retracts a hint that had crossed it out.
      game.eliminated[index] &= ~flag;
    }
    return;
  }

  if (game.values[index] === digit) {
    pushUndo(game);
    game.values[index] = 0;
    if (game.mode === "play") game.eliminated.fill(0);
    return;
  }

  pushUndo(game);
  // Replacing a digit can invalidate deductions that used the old one.
  if (game.mode === "play" && game.values[index]) game.eliminated.fill(0);
  game.values[index] = digit;
  game.notes[index] = 0;
  if (game.mode === "play") {
    const flag = bit(digit);
    for (const peer of PEERS[index]) game.notes[peer] &= ~flag;
  }
}

export function erase(game: Game): void {
  const index = game.selected;
  if (game.mode === "play" && game.givens[index]) return;
  if (game.values[index]) {
    pushUndo(game);
    game.values[index] = 0;
    if (game.mode === "play") game.eliminated.fill(0);
    return;
  }
  if (game.notes[index]) {
    pushUndo(game);
    game.notes[index] = 0;
  }
}

export function fillNotes(game: Game): void {
  if (game.mode !== "play") return;
  pushUndo(game);
  writeNotes(game);
}

export function move(game: Game, rowDelta: number, colDelta: number): void {
  const row = Math.min(8, Math.max(0, ((game.selected / 9) | 0) + rowDelta));
  const col = Math.min(8, Math.max(0, (game.selected % 9) + colDelta));
  game.selected = row * 9 + col;
}

export function undo(game: Game): void {
  const prev = game.undo.pop();
  if (!prev) return;
  game.redo.push(snap(game));
  game.values = prev.values;
  game.notes = prev.notes;
  game.eliminated = prev.eliminated;
  game.hint = null;
  game.message = "";
}

export function redo(game: Game): void {
  const next = game.redo.pop();
  if (!next) return;
  game.undo.push(snap(game));
  game.values = next.values;
  game.notes = next.notes;
  game.eliminated = next.eliminated;
  game.hint = null;
  game.message = "";
}

export function doHint(game: Game): void {
  if (game.mode !== "play") return;
  if (hasConflict(game.values)) {
    game.hint = null;
    game.message = "Fix the highlighted conflicts first.";
    return;
  }
  const step = nextStep(game.values, game.eliminated);
  if (!step) {
    game.hint = null;
    if (isSolved(game.values)) game.message = "Solved.";
    else if (noCandidate(game.values, game.eliminated)) game.message = "No solution.";
    else game.message = "No further step with these techniques.";
    return;
  }
  if (step.eliminate.length) {
    pushUndo(game);
    for (const elim of step.eliminate) {
      const flag = bit(elim.digit);
      game.eliminated[elim.index] |= flag;
      game.notes[elim.index] &= ~flag;
    }
  }
  game.hint = step;
  game.message = "";
}

export function beginEntry(game: Game): void {
  const copy = structuredClone(game);
  copy.backup = null;
  copy.hint = null;
  game.backup = copy;
  game.mode = "enter";
  game.givens = empty();
  game.values = empty();
  game.notes = empty();
  game.eliminated = empty();
  game.undo = [];
  game.redo = [];
  game.hint = null;
  game.notesMode = false;
  game.selected = 0;
  game.message = "Enter the clues, then start.";
}

export function commitEntry(game: Game): void {
  if (game.mode !== "enter") return;
  if (hasConflict(game.values)) {
    game.message = "Those clues conflict.";
    return;
  }
  const solutions = countSolutions(game.values, 2);
  if (solutions < 0) {
    game.message = "Could not check this grid.";
    return;
  }
  if (solutions === 0) {
    game.message = "No solution.";
    return;
  }
  if (solutions > 1) {
    game.message = "More than one solution.";
    return;
  }
  game.givens = game.values.slice();
  game.mode = "play";
  game.difficulty = "custom";
  game.eliminated = empty();
  game.undo = [];
  game.redo = [];
  game.hint = null;
  game.message = "";
  game.backup = null;
  game.notesMode = false;
  const hole = game.values.findIndex((value) => value === 0);
  if (hole >= 0) game.selected = hole;
}

export function cancelEntry(game: Game): void {
  const saved = game.backup;
  if (game.mode !== "enter" || !saved) return;
  game.mode = saved.mode;
  game.difficulty = saved.difficulty;
  game.givens = saved.givens;
  game.values = saved.values;
  game.notes = saved.notes;
  game.eliminated = saved.eliminated;
  game.selected = saved.selected;
  game.notesMode = saved.notesMode;
  game.undo = saved.undo;
  game.redo = saved.redo;
  game.hint = saved.hint;
  game.message = saved.message;
  game.backup = null;
}

export function clearEntry(game: Game): void {
  if (game.mode !== "enter") return;
  if (game.values.every((value) => value === 0)) return;
  pushUndo(game);
  game.values = empty();
}
