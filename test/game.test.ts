import { describe, expect, it } from "vitest";
import { generate, rng } from "../src/generate";
import {
  beginEntry,
  cancelEntry,
  commitEntry,
  doHint,
  erase,
  inputDigit,
  newGame,
  redo,
  undo,
} from "../src/game";
import { PEERS, bit } from "../src/grid";

describe("game", () => {
  it("refuses to overwrite a given and can undo a placement", () => {
    const puzzle = generate("easy", rng(1));
    const game = newGame("easy", puzzle);
    const given = puzzle.findIndex((value) => value !== 0);
    const hole = puzzle.findIndex((value) => value === 0);
    game.selected = given;
    inputDigit(game, puzzle[given] === 1 ? 2 : 1);
    expect(game.values[given]).toBe(puzzle[given]);
    expect(game.undo).toHaveLength(0);

    game.selected = hole;
    inputDigit(game, 1);
    expect(game.values[hole]).toBe(1);
    undo(game);
    expect(game.values[hole]).toBe(0);
    redo(game);
    expect(game.values[hole]).toBe(1);
  });

  it("toggles pencil marks without filling the cell", () => {
    const game = newGame("easy", generate("easy", rng(1)));
    game.notesMode = true;
    const before = game.notes[game.selected];
    const digit = before & 1 ? 1 : 2;
    inputDigit(game, digit);
    const flag = bit(digit);
    if (before & flag) expect(game.notes[game.selected] & flag).toBe(0);
    else expect(game.notes[game.selected] & flag).toBe(flag);
    expect(game.values[game.selected]).toBe(0);
  });

  it("explains a placement without writing it in", () => {
    const game = newGame("easy", generate("easy", rng(1)));
    const before = game.values.slice();
    doHint(game);
    expect(game.hint?.place).not.toBeNull();
    expect(game.values).toEqual(before);
    const place = game.hint!.place!;
    doHint(game);
    expect(game.hint?.place).toEqual(place);
    game.selected = place.index;
    inputDigit(game, place.digit);
    expect(game.values[place.index]).toBe(place.digit);
    expect(game.hint).toBeNull();
  });

  it("crosses out candidates for an elimination hint and undo puts them back", () => {
    const game = newGame("medium", generate("medium", rng(2)));
    for (let guard = 0; guard < 90 && !game.hint?.eliminate.length; guard++) {
      doHint(game);
      const place = game.hint?.place;
      if (!place) break;
      game.selected = place.index;
      inputDigit(game, place.digit);
    }
    expect(game.hint?.eliminate.length).toBeGreaterThan(0);
    const eliminated = game.eliminated.slice();
    undo(game);
    expect(game.eliminated).not.toEqual(eliminated);
    expect(game.hint).toBeNull();
  });

  it("rejects a grid with more than one solution", () => {
    const game = newGame("easy", generate("easy", rng(1)));
    beginEntry(game);
    inputDigit(game, 1);
    commitEntry(game);
    expect(game.mode).toBe("enter");
    expect(game.message).toBe("More than one solution.");
  });

  it("starts a typed-in puzzle and cancel returns to the previous game", () => {
    const puzzle = generate("easy", rng(1));
    const game = newGame("easy", puzzle);
    const kept = game.values[0];
    beginEntry(game);
    for (let i = 0; i < 81; i++) {
      game.selected = i;
      if (puzzle[i]) inputDigit(game, puzzle[i]);
    }
    commitEntry(game);
    expect(game.mode).toBe("play");
    expect(game.difficulty).toBe("custom");
    expect(game.givens).toEqual(puzzle);

    beginEntry(game);
    game.selected = 0;
    inputDigit(game, 9);
    cancelEntry(game);
    expect(game.mode).toBe("play");
    expect(game.values).toEqual(puzzle);
    expect(game.values[0]).toBe(kept);
  });

  it("asks for conflicts to be fixed before a hint", () => {
    const game = newGame("easy", generate("easy", rng(1)));
    const hole = game.values.findIndex((value) => value === 0);
    const digit = PEERS[hole].map((index) => game.values[index]).find((value) => value > 0)!;
    game.selected = hole;
    inputDigit(game, digit);
    doHint(game);
    expect(game.message).toBe("Fix the highlighted conflicts first.");
    erase(game);
    expect(game.values[hole]).toBe(0);
  });
});
