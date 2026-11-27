import { beforeEach, describe, expect, it, vi } from "vitest";
import { generate, rng } from "../src/generate";
import { doHint, newGame } from "../src/game";
import { load, save } from "../src/storage";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

describe("storage", () => {
  beforeEach(() => memory.clear());

  it("round-trips the board and drops a broken save", () => {
    const game = newGame("easy", generate("easy", rng(1)));
    doHint(game);
    save(game);
    const loaded = load();
    expect(loaded?.values).toEqual(game.values);
    expect(loaded?.notes).toEqual(game.notes);
    expect(loaded?.hint?.text).toBe(game.hint?.text);
    localStorage.setItem("sudoku-coach", "{");
    expect(load()).toBeNull();
  });
});
