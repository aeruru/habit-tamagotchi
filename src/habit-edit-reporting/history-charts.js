import { clockOrder, localDate, measure, periodKey, settingsAt, shift } from '../habit-engine/index.js';
import { esc, labelDate, selected, today, valueDisplay } from './format.js';

export const historyRanges = [13, 26, 52];
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'short' });
const axisDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function heatmap(days, weeks, end, selectedDate, period) {
  const first = shift(periodKey({ period: 'week' }, end), -7 * (weeks - 1));
  const activeDate = selectedDate >= first && selectedDate <= end ? selectedDate : end;
  const selection = days.get(activeDate) ?? [];
  const occurrences = measure(selection);
  const summary = labelDate(activeDate) + ' · ' + occurrences + (occurrences === 1 ? ' occurrence' : ' occurrences') +
    (selection.some(row => row.skip && row.period === period) ? ' · Skipped' : '');
  const columns = Array.from({ length: weeks }, (_, week) => {
    const monday = shift(first, week * 7);
    const previous = shift(monday, -7);
    const showMonth = week === 0 || localDate(monday).getMonth() !== localDate(previous).getMonth();
    const month = showMonth ? monthLabel.format(localDate(monday)) : '';
    const cells = weekdayLabels.map((_, weekday) => {
      const date = shift(monday, weekday);
      if (date > end) return '<span class="heatmap-future" aria-hidden="true"></span>';
      const records = days.get(date) ?? [];
      const count = measure(records);
      const skipped = records.some(row => row.skip && row.period === period);
      const level = count >= 4 ? 4 : count;
      const activity = count ? count + (count === 1 ? ' occurrence' : ' occurrences') : 'No check-ins';
      const label = labelDate(date) + ', ' + localDate(date).getFullYear() + ' · ' + (skipped ? activity + ' · Skipped' : activity);
      const active = date === activeDate;
      return '<button type="button" class="heatmap-day heat-level-' + level + (skipped ? ' is-skipped' : '') +
        '" data-action="history-day" data-date="' + date + '" title="' + esc(label) + '" aria-label="' + esc(label) +
        '" aria-pressed="' + (date === selectedDate) + '" tabindex="' + (active ? 0 : -1) + '"></button>';
    }).join('');
    return '<div class="heatmap-week"><span class="heatmap-month">' + esc(month) + '</span>' + cells + '</div>';
  }).join('');
  const labels = weekdayLabels.map((day, index) => '<span>' + (index % 2 === 0 ? day : '') + '</span>').join('');
  return '<div class="chart-scroll"><div class="heatmap" role="group" aria-label="Daily activity. Use arrow keys to choose a day.">' +
    '<div class="heatmap-labels"><span></span>' + labels + '</div>' + columns + '</div></div>' +
    '<div class="heatmap-legend" aria-label="Color scale from zero to four or more occurrences">' +
    '<span>0</span>' + [0, 1, 2, 3, 4].map(level => '<span class="heat-level-' + level + '" aria-hidden="true"></span>').join('') +
    '<span>4+</span><span class="heatmap-skip-key is-skipped" aria-hidden="true"></span><span>Skipped</span></div>' +
    '<p class="heatmap-summary" aria-live="polite">' + esc(summary) + '</p>';
}

function valueSeries(records, deadline) {
  const series = new Map();
  for (const row of records) {
    if (row.skip || row.valueType === 'event') continue;
    let key = row.valueUnit ?? row.valueType;
    let value = row.value;
    if (row.valueType === 'clock') {
      key = 'Clock time';
      value = clockOrder(value, deadline || '00:00');
    } else if (key === 'minutes') {
      key = 'hours';
      value /= 60;
    }
    if (!Number.isFinite(value)) continue;
    if (!series.has(key)) series.set(key, []);
    series.get(key).push({ date: row.date, value, label: valueDisplay(row) });
  }
  return series;
}

const axisNumber = new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 });
function axisValue(unit, value) {
  if (unit !== 'Clock time') return axisNumber.format(value);
  const minutes = Math.round(value) % 1440;
  return [Math.floor(minutes / 60), minutes % 60].map(part => String(part).padStart(2, '0')).join(':');
}

function valueChart(unit, points) {
  const width = 720;
  const left = 64;
  const right = 694;
  const top = 18;
  const bottom = 156;
  const values = points.map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = min === max ? (unit === 'Clock time' ? 30 : Math.max(0.5, Math.abs(min) * 0.1)) : (max - min) * 0.08;
  const low = unit === 'Clock time' ? Math.max(0, min - padding) : min - padding;
  const high = max + padding;
  const start = localDate(points[0].date);
  const end = localDate(points.at(-1).date);
  const x = date => end > start ? left + (localDate(date) - start) / (end - start) * (right - left) : (left + right) / 2;
  const y = value => bottom - (value - low) / (high - low) * (bottom - top);
  const ticks = [low, (low + high) / 2, high].map(value =>
    '<line x1="' + left + '" x2="' + right + '" y1="' + y(value) + '" y2="' + y(value) + '"/>' +
    '<text x="' + (left - 8) + '" y="' + y(value) + '" text-anchor="end" dominant-baseline="middle">' + esc(axisValue(unit, value)) + '</text>'
  ).join('');
  const coordinates = points.map(point => x(point.date) + ',' + y(point.value)).join(' ');
  const dots = points.map(point => '<circle cx="' + x(point.date) + '" cy="' + y(point.value) + '" r="3.5"><title>' +
    esc(labelDate(point.date) + ' · ' + point.label) + '</title></circle>').join('');
  const dates = end > start ? '<text x="' + left + '" y="181">' + esc(axisDate.format(start)) + '</text><text x="' + right +
    '" y="181" text-anchor="end">' + esc(axisDate.format(end)) + '</text>' :
    '<text x="' + x(points[0].date) + '" y="181" text-anchor="middle">' + esc(axisDate.format(start)) + '</text>';
  return '<figure class="value-chart"><figcaption>' + esc(unit === 'number' || unit === 'integer' ? 'Recorded value' : unit) + '</figcaption>' +
    '<div class="chart-scroll"><svg viewBox="0 0 ' + width + ' 194" role="img" aria-label="' +
    esc(unit + ' trend, ' + points.length + ' entries. Latest value ' + points.at(-1).label) + '">' +
    ticks + '<polyline points="' + coordinates + '" />' + dots + dates + '</svg></div></figure>';
}

export function renderHistoryCharts(state, selectedHabit, weeks, selectedDate) {
  const habits = Object.entries(state.habits);
  if (!habits.length) return '';
  const id = Object.hasOwn(state.habits, selectedHabit) ? selectedHabit : habits[0][0];
  const habit = state.habits[id];
  const end = today();
  const start = shift(periodKey({ period: 'week' }, end), -7 * (weeks - 1));
  const records = state.records.filter(row => row.habit === id && row.date >= start && row.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.updated ?? '').localeCompare(b.updated ?? ''));
  const days = new Map();
  for (const row of records) {
    if (!days.has(row.date)) days.set(row.date, []);
    days.get(row.date).push(row);
  }
  const { deadline } = settingsAt(state, id, periodKey(habit, end));
  const series = valueSeries(records, deadline);
  return '<section class="panel padded history-charts" aria-labelledby="habit-charts-title">' +
    '<div class="history-chart-controls"><h2 id="habit-charts-title">Habit trends</h2>' +
    '<label>Habit<select id="history-habit">' + habits.map(([habitId, definition]) =>
      '<option value="' + esc(habitId) + '" ' + selected(habitId, id) + '>' + esc(definition.icon + ' ' + definition.name) + '</option>'
    ).join('') + '</select></label><label>Range<select id="history-range">' + historyRanges.map(range =>
      '<option value="' + range + '" ' + selected(range, weeks) + '>' + range + ' weeks</option>'
    ).join('') + '</select></label></div>' +
    '<h3>Activity</h3>' + heatmap(days, weeks, end, selectedDate, habit.period) +
    '<h3>Check-in values</h3>' + ([...series].map(([unit, points]) => valueChart(unit, points)).join('') ||
      '<p class="chart-empty">No recorded values to plot in this range.</p>') + '</section>';
}
