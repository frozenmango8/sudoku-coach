import type { Difficulty } from "./generate";
import { generate } from "./generate";
import {
  beginEntry,
  cancelEntry,
  commitEntry,
  conflicts,
  doHint,
  erase,
  fillNotes,
  inputDigit,
  move,
  newGame,
  redo,
  remaining,
  undo,
  type Game,
} from "./game";
import { bit, candidateMasks } from "./grid";
import { isSolved } from "./solve";
import { load, save } from "./storage";

const status = document.querySelector<HTMLElement>("#status")!;
const explain = document.querySelector<HTMLElement>("#explain")!;
const board = document.querySelector<HTMLElement>("#board")!;
const cols = document.querySelector<HTMLElement>(".cols")!;
const rows = document.querySelector<HTMLElement>(".rows")!;
const pad = document.querySelector<HTMLElement>("#pad")!;
const pencil = document.querySelector<HTMLButtonElement>("#pencil")!;
const eraseButton = document.querySelector<HTMLButtonElement>("#erase")!;
const undoButton = document.querySelector<HTMLButtonElement>("#undo")!;
const redoButton = document.querySelector<HTMLButtonElement>("#redo")!;
const hintButton = document.querySelector<HTMLButtonElement>("#hint")!;
const fillButton = document.querySelector<HTMLButtonElement>("#fill")!;
const enterButton = document.querySelector<HTMLButtonElement>("#enter")!;
const cancelButton = document.querySelector<HTMLButtonElement>("#cancel")!;
const newButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-new]")];

interface CellDom {
  button: HTMLButtonElement;
  value: HTMLSpanElement;
  notes: HTMLSpanElement;
  marks: HTMLElement[];
}

const cells: CellDom[] = [];
for (let index = 0; index < 81; index++) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cell";
  button.setAttribute("role", "gridcell");
  const value = document.createElement("span");
  value.className = "value";
  const notes = document.createElement("span");
  notes.className = "notes";
  const marks: HTMLElement[] = [];
  for (let digit = 0; digit < 9; digit++) {
    const mark = document.createElement("i");
    notes.append(mark);
    marks.push(mark);
  }
  button.append(value, notes);
  button.addEventListener("click", () => {
    game.selected = index;
    changed();
  });
  board.append(button);
  cells.push({ button, value, notes, marks });
}

for (let n = 1; n <= 9; n++) {
  for (const parent of [cols, rows]) {
    const label = document.createElement("span");
    label.textContent = String(n);
    parent.append(label);
  }
}

const digits: HTMLButtonElement[] = [];
for (let digit = 1; digit <= 9; digit++) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = String(digit);
  button.addEventListener("click", () => {
    inputDigit(game, digit);
    changed();
  });
  pad.append(button);
  digits.push(button);
}

let game = load() ?? newGame("easy", generate("easy"));
let busy = false;

function difficultyName(current: Game): string {
  if (current.difficulty === "custom") return "Custom";
  return current.difficulty[0].toUpperCase() + current.difficulty.slice(1);
}

function paint(): void {
  const bad = conflicts(game);
  const focus = new Set(game.hint?.focus ?? []);
  const related = new Set(game.hint?.related ?? []);
  const struck = new Uint16Array(81);
  for (const elim of game.hint?.eliminate ?? []) struck[elim.index] |= bit(elim.digit);
  const overlay = game.hint && game.hint.eliminate.length ? candidateMasks(game.values) : null;
  const selectedValue = game.values[game.selected];

  for (let index = 0; index < 81; index++) {
    const cell = cells[index];
    const value = game.values[index];
    const given = game.mode === "enter" ? value !== 0 : game.givens[index] !== 0;
    cell.button.classList.toggle("given", given);
    cell.button.classList.toggle("selected", index === game.selected);
    cell.button.classList.toggle("same", value !== 0 && value === selectedValue && index !== game.selected);
    cell.button.classList.toggle("conflict", bad[index] === 1);
    cell.button.classList.toggle("hint-focus", focus.has(index));
    cell.button.classList.toggle("hint", related.has(index) && !focus.has(index));
    const row = ((index / 9) | 0) + 1;
    const col = (index % 9) + 1;
    cell.button.setAttribute("aria-selected", index === game.selected ? "true" : "false");
    cell.button.setAttribute(
      "aria-label",
      value
        ? `Row ${row}, column ${col}, ${given && game.mode === "play" ? "given " : ""}${value}`
        : `Row ${row}, column ${col}, empty`,
    );
    if (value) {
      cell.value.hidden = false;
      cell.value.textContent = String(value);
      cell.notes.hidden = true;
    } else {
      cell.value.hidden = true;
      cell.notes.hidden = false;
      // Focus cells show the pattern. Elsewhere only the player's marks, plus struck eliminations.
      const shown = overlay && focus.has(index)
        ? overlay[index] & ~game.eliminated[index]
        : game.notes[index];
      for (let digit = 1; digit <= 9; digit++) {
        const flag = bit(digit);
        const mark = cell.marks[digit - 1];
        const cross = (struck[index] & flag) !== 0;
        mark.textContent = (shown & flag) || cross ? String(digit) : "";
        mark.classList.toggle("strike", cross);
      }
    }
  }

  const pencilOn = game.mode === "play" && game.notesMode;
  for (let digit = 1; digit <= 9; digit++) {
    const on = pencilOn
      ? (game.notes[game.selected] & bit(digit)) !== 0
      : selectedValue === digit;
    digits[digit - 1].classList.toggle("on", on);
  }

  for (const button of newButtons) {
    button.setAttribute("aria-pressed", game.mode === "play" && game.difficulty === button.dataset.new ? "true" : "false");
  }
  pencil.disabled = game.mode !== "play";
  pencil.setAttribute("aria-pressed", pencilOn ? "true" : "false");
  fillButton.disabled = game.mode !== "play";
  hintButton.disabled = game.mode !== "play";
  undoButton.disabled = game.undo.length === 0;
  redoButton.disabled = game.redo.length === 0;
  enterButton.textContent = game.mode === "enter" ? "Start" : "Enter puzzle";
  cancelButton.hidden = game.mode !== "enter";

  if (game.mode === "enter") status.textContent = "Entering clues";
  else if (isSolved(game.values)) status.textContent = "Solved";
  else status.textContent = `${difficultyName(game)}, ${remaining(game)} left`;

  if (game.hint) explain.textContent = game.hint.text;
  else if (game.message) explain.textContent = game.message;
  else if (game.mode === "enter") explain.textContent = "Enter the clues, then start.";
  else explain.textContent = "Press Hint for the next deduction.";
}

function changed(): void {
  save(game);
  paint();
}

async function start(difficulty: Difficulty): Promise<void> {
  if (busy) return;
  busy = true;
  status.textContent = "Generating…";
  explain.textContent = "";
  await new Promise((resolve) => setTimeout(resolve, 16));
  try {
    game = newGame(difficulty, generate(difficulty));
    changed();
  } catch {
    status.textContent = "Could not build one. Try again.";
  } finally {
    busy = false;
  }
}

function onKey(event: KeyboardEvent): void {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    const lower = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && lower === "z") {
      event.preventDefault();
      if (event.shiftKey) redo(game);
      else undo(game);
      changed();
    } else if ((event.ctrlKey || event.metaKey) && lower === "y") {
      event.preventDefault();
      redo(game);
      changed();
    }
    return;
  }

  const key = event.key;
  if (key === "ArrowUp") move(game, -1, 0);
  else if (key === "ArrowDown") move(game, 1, 0);
  else if (key === "ArrowLeft") move(game, 0, -1);
  else if (key === "ArrowRight") move(game, 0, 1);
  else if (/^[1-9]$/.test(key)) inputDigit(game, Number(key));
  else if (key === "Backspace" || key === "Delete" || key === "0") erase(game);
  else if ((key === "n" || key === "N") && game.mode === "play") game.notesMode = !game.notesMode;
  else if ((key === "h" || key === "H") && game.mode === "play") doHint(game);
  else return;

  event.preventDefault();
  changed();
}

for (const button of newButtons) {
  button.addEventListener("click", () => void start(button.dataset.new as Difficulty));
}
pencil.addEventListener("click", () => {
  if (game.mode !== "play") return;
  game.notesMode = !game.notesMode;
  changed();
});
eraseButton.addEventListener("click", () => {
  erase(game);
  changed();
});
undoButton.addEventListener("click", () => {
  undo(game);
  changed();
});
redoButton.addEventListener("click", () => {
  redo(game);
  changed();
});
hintButton.addEventListener("click", () => {
  doHint(game);
  changed();
});
fillButton.addEventListener("click", () => {
  fillNotes(game);
  changed();
});
enterButton.addEventListener("click", () => {
  if (game.mode === "enter") commitEntry(game);
  else beginEntry(game);
  changed();
});
cancelButton.addEventListener("click", () => {
  cancelEntry(game);
  changed();
});
document.addEventListener("keydown", onKey);

paint();
save(game);
