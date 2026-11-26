import { dateKey, localDate, shift } from '../habit-engine/index.js';

export const today = () => dateKey();
export const labelDate = key => localDate(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const selected = (a, b) => a === b ? 'selected' : '';
export const checked = value => value ? 'checked' : '';
export function forToday(habit) { return habit.sleep ? shift(today(), -1) : today(); }
export function valueDisplay(habit, row) {
  if (row.skip) return 'Skipped';
  if (habit.type === 'clock') return row.value;
  if (habit.type === 'duration') return row.value + ' hr';
  if (habit.type === 'rating') return row.meal + ' · ' + row.value + '/5';
  return 'Logged';
}
