import { dateKey, localDate } from '../habit-engine/index.js';

export const today = () => dateKey();
export const labelDate = key => localDate(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const selected = (a, b) => a === b ? 'selected' : '';
export const checked = value => value ? 'checked' : '';
export function valueDisplay(row) {
  if (row.skip) return 'Skipped';
  if (row.valueType === 'duration') return row.value + ' hr';
  if (row.valueType === 'rating') return row.meal + ' · ' + row.value + '/5';
  if (row.valueType === 'event') return 'Logged';
  if (row.valueUnit === 'hours' || row.valueUnit === 'minutes') return row.value + ' ' + row.valueUnit;
  return row.value;
}
