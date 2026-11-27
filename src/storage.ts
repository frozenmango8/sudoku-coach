import type { Game, Snap } from "./game";

const KEY = "sudoku-coach";

function cells(value: unknown, max: number): value is number[] {
  return Array.isArray(value)
    && value.length === 81
    && value.every((item) => Number.isInteger(item) && item >= 0 && item <= max);
}

function validSnap(value: unknown): value is Snap {
  if (!value || typeof value !== "object") return false;
  const snap = value as Snap;
  return cells(snap.values, 9) && cells(snap.notes, 0x1ff) && cells(snap.eliminated, 0x1ff);
}

function validHint(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const hint = value as Game["hint"];
  return !!hint
    && typeof hint.text === "string"
    && Array.isArray(hint.focus)
    && Array.isArray(hint.related)
    && Array.isArray(hint.eliminate);
}

function validGame(value: unknown): value is Game {
  if (!value || typeof value !== "object") return false;
  const game = value as Game;
  if (game.mode !== "play" && game.mode !== "enter") return false;
  if (game.difficulty !== "easy" && game.difficulty !== "medium" && game.difficulty !== "hard" && game.difficulty !== "custom") {
    return false;
  }
  if (!cells(game.givens, 9) || !cells(game.values, 9) || !cells(game.notes, 0x1ff) || !cells(game.eliminated, 0x1ff)) {
    return false;
  }
  if (!Number.isInteger(game.selected) || game.selected < 0 || game.selected > 80) return false;
  if (typeof game.notesMode !== "boolean") return false;
  if (typeof game.message !== "string") return false;
  if (!Array.isArray(game.undo) || !game.undo.every(validSnap)) return false;
  if (!Array.isArray(game.redo) || !game.redo.every(validSnap)) return false;
  if (game.hint != null && !validHint(game.hint)) game.hint = null;
  if (game.backup && !validGame(game.backup)) return false;
  return true;
}

export function save(game: Game): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // Private mode, or the quota is full. The board still works.
  }
}

export function load(): Game | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return validGame(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
