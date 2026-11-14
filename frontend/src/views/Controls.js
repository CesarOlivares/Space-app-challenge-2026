// Selector de fecha (UTC) y atajos de vista.

const HOUR = 3600 * 1000;

function toInputValue(date) {
  return date.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM" en UTC
}

function fromInputValue(value) {
  return new Date(`${value}:00Z`);
}

export function currentHourUtc() {
  return new Date(Math.floor(Date.now() / HOUR) * HOUR);
}

export class Controls {
  constructor(root, { onDateChange, onView }) {
    this.onDateChange = onDateChange;
    this.input = root.querySelector("#date-input");
    this.date = currentHourUtc();
    this.input.value = toInputValue(this.date);

    let debounce;
    this.input.addEventListener("input", () => {
      if (!this.input.value) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => this.#set(fromInputValue(this.input.value)), 250);
    });

    for (const button of root.querySelectorAll("[data-shift-days]")) {
      button.addEventListener("click", () => {
        const days = Number(button.dataset.shiftDays);
        this.#set(new Date(this.date.getTime() + days * 24 * HOUR));
      });
    }
    root.querySelector("#date-now").addEventListener("click", () => this.#set(currentHourUtc()));

    for (const button of root.querySelectorAll("[data-view]")) {
      button.addEventListener("click", () => onView(button.dataset.view));
    }
  }

  #set(date) {
    if (Number.isNaN(date.getTime())) return;
    this.date = date;
    this.input.value = toInputValue(date);
    this.onDateChange(date);
  }
}
