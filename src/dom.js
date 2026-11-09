export const $ = id => document.getElementById(id);

export function setToggle(button, selected) {
  button.classList.toggle('on', selected);
  button.setAttribute('aria-pressed', String(selected));
}

export function setToggleGroup(key, value) {
  const attribute = `data-${key}`;
  document.querySelectorAll(`[${attribute}]`).forEach(button => setToggle(button, button.getAttribute(attribute) === String(value)));
}

/** Each caller owns its timer; unrelated work cannot cancel a pending update. */
export function createDebounce() {
  let timer;
  const schedule = (fn, ms = 180) => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  schedule.cancel = () => clearTimeout(timer);
  return schedule;
}
