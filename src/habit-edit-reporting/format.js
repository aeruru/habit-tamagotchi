import { dateKey, localDate } from '../habit-engine/index.js';

export const today = () => dateKey();
export const labelDate = key => localDate(key).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
export const esc = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const selected = (a, b) => a === b ? 'selected' : '';
export const checked = value => value ? 'checked' : '';

const clockTime = /^([01]\d|2[0-3]):[0-5]\d$/;
const quarterHours = Array.from({ length: 96 }, (_, step) => {
  const hour = String(Math.floor(step / 4)).padStart(2, '0');
  const minute = String(step % 4 * 15).padStart(2, '0');
  return hour + ':' + minute;
});
const clockLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

export function selectableClockTime(value, saved) {
  return quarterHours.includes(value) || (value === saved && clockTime.test(value));
}

export function clockTimeOptions(saved, blankLabel) {
  const values = clockTime.test(saved) && !quarterHours.includes(saved) ? [...quarterHours, saved].sort() : quarterHours;
  return '<option value="">' + esc(blankLabel) + '</option>' + values.map(value => {
    const label = clockLabel.format(new Date('2000-01-01T' + value + ':00Z'));
    const savedLabel = quarterHours.includes(value) ? '' : ' (saved)';
    return '<option value="' + value + '" ' + selected(value, saved) + '>' + esc(label + savedLabel) + '</option>';
  }).join('');
}

export function valueDisplay(row) {
  if (row.skip) return 'Skipped';
  if (row.valueType === 'duration') return row.value + ' hr';
  if (row.valueType === 'rating') return row.meal + ' · ' + row.value + '/5';
  if (row.valueType === 'event') return 'Logged';
  if (row.valueUnit === 'hours' || row.valueUnit === 'minutes') return row.value + ' ' + row.valueUnit;
  return row.value;
}
