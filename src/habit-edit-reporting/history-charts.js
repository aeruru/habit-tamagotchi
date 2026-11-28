import { clockOrder, defaultSettings, isScheduled, localDate, measure, outcome, periodKey, settingsAt, shift, valueUnits } from '../habit-engine/index.js';
import { esc, labelDate, selected, today, valueDisplay } from './format.js';
import { categoryFilter, renderPeriodOutcomes } from './history.js';

export const trendRanges = [13, 26, 52];
const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'short' });
const axisDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

const outcomeLabels = { empty: 'No check-ins', miss: 'Below almost goal', skip: 'Skipped', almost: 'Almost goal', met: 'Goal met',
  open: 'In progress', inactive: 'Not tracked' };

function heatmap(habit, recordsByPeriod, weeks, first, end, selectedDate, periodOutcome) {
  const weekly = habit.period === 'week';
  const selectedPeriod = periodKey(habit, selectedDate);
  const activeDate = selectedPeriod >= first && selectedPeriod <= end ? selectedPeriod : periodKey(habit, end);
  const dateLabel = date => (weekly ? 'Week of ' : '') + labelDate(date);
  const describe = date => {
    const status = periodOutcome(date);
    if (status === 'empty') return outcomeLabels.empty;
    const count = measure(recordsByPeriod.get(date) ?? []);
    const activity = count === 0 ? 'No check-ins' : count + (count === 1 ? ' occurrence' : ' occurrences');
    return outcomeLabels[status] + ' · ' + activity;
  };
  const summary = dateLabel(activeDate) + ' · ' + describe(activeDate);
  const columns = Array.from({ length: weeks }, (_, week) => {
    const monday = shift(first, week * 7);
    const previous = shift(monday, -7);
    const monthNumber = localDate(monday).getMonth();
    const showMonth = week === 0 ? monthNumber === localDate(shift(monday, 7)).getMonth() :
      monthNumber !== localDate(previous).getMonth();
    const month = showMonth ? monthLabel.format(localDate(monday)) : '';
    const cells = Array.from({ length: weekly ? 1 : 7 }, (_, weekday) => {
      const date = shift(monday, weekday);
      if (date > end) return '<span class="heatmap-future" aria-hidden="true"></span>';
      const label = dateLabel(date) + ', ' + localDate(date).getFullYear() + ' · ' + describe(date);
      const active = date === activeDate;
      return '<button type="button" class="heatmap-day heat-' + periodOutcome(date) +
        '" data-action="history-day" data-date="' + date + '" title="' + esc(label) + '" aria-label="' + esc(label) +
        '" aria-pressed="' + (date === selectedPeriod) + '" tabindex="' + (active ? 0 : -1) + '"></button>';
    }).join('');
    return '<div class="heatmap-week"><span class="heatmap-month">' + esc(month) + '</span>' + cells + '</div>';
  }).join('');
  const labels = weekly ? '<span>Week</span>' :
    weekdayLabels.map((day, index) => '<span>' + (index % 2 === 0 ? day : '') + '</span>').join('');
  const instructions = weekly ? 'Weekly activity. Use left and right arrow keys to choose a week.' :
    'Daily activity. Use arrow keys to choose a day.';
  return '<div class="chart-scroll heatmap-scroll"><div class="heatmap' + (weekly ? ' heatmap-weekly' : '') +
    '" role="group" aria-label="' + instructions + '">' +
    '<div class="heatmap-labels"><span></span>' + labels + '</div>' + columns + '</div></div>' +
    '<p class="heatmap-summary">' + esc(summary) + '</p>';
}

function heatmapLegend() {
  const items = ['empty', 'miss', 'skip', 'almost', 'met', 'open'].map(status =>
    '<span><i class="heat-' + status + '" aria-hidden="true"></i>' +
    (status === 'open' ? 'Open or untracked' : outcomeLabels[status]) + '</span>');
  return '<div class="heatmap-legend" aria-label="Goal outcomes">' + items.join('') + '</div>';
}

function periodOutcomes(state, id, habit, records, trackingStart, end) {
  const groups = new Map();
  const results = new Map();
  let first = periodKey(habit, trackingStart);
  const daysPerPeriod = habit.period === 'week' ? 7 : 1;
  for (const row of records) {
    if (row.skip && row.period !== habit.period) continue;
    const period = periodKey(habit, row.date);
    if (period < first) first = period;
    if (!groups.has(period)) groups.set(period, []);
    groups.get(period).push(row);
  }
  return date => {
    const period = periodKey(habit, date);
    if (period < first) return 'inactive';
    if (!results.has(period)) {
      const closed = shift(period, daysPerPeriod) <= end;
      const records = groups.get(period) ?? [];
      const settings = settingsAt(state, id, period);
      const status = isScheduled(settings, period) ? outcome(settings, records, closed) : 'inactive';
      results.set(period, status === 'miss' && records.length === 0 ? 'empty' : status);
    }
    return results.get(period);
  };
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
  const minutes = (Math.round(value) % 1440 + 1440) % 1440;
  return [Math.floor(minutes / 60), minutes % 60].map(part => String(part).padStart(2, '0')).join(':');
}

function sampleRecords(state, start, end) {
  const records = [];
  for (const [index, [id, habit]] of Object.entries(state.habits).entries()) {
    const currentPeriod = periodKey(habit, end);
    const { deadline, numberGoal } = settingsAt(state, id, currentPeriod);
    const valueUnit = habit.type === 'number' ? habit.unit ?? valueUnits.number : valueUnits[habit.type];
    const clockCenter = clockOrder(deadline || '22:30', '00:00');
    const numberCenter = numberGoal ?? (valueUnit === 'hours' ? 7.5 : 4);
    const belowGoalWeek = shift(currentPeriod, -14);
    for (let date = end, day = 0; date >= start; date = shift(date, -1), day++) {
      if (habit.period === 'week' && habit.type === 'count' && date >= belowGoalWeek && date < currentPeriod) {
        if (date === belowGoalWeek) records.push({ habit: id, date, value: 1, valueType: habit.type, valueUnit });
        continue;
      }
      const variation = Math.abs(Math.imul((day + 5) * (index + 3), 0x45d9f3b) ^ Math.imul(day + index, 0x27d4eb2d));
      if (variation % 23 === 0 && date === periodKey(habit, date)) {
        records.push({ habit: id, date, skip: true, period: habit.period });
      } else if (variation % 10 < (habit.period === 'week' ? 4 : 7)) {
        let value;
        if (habit.type === 'clock') {
          value = axisValue('Clock time', clockCenter + variation % 131 - 55 + 1440);
        } else if (habit.type === 'count') {
          value = 1 + variation % 5;
        } else {
          const adjusted = Math.max(0, Math.min(10000, numberCenter + (variation % 11 - 5) / 2));
          value = Number(adjusted.toPrecision(2));
        }
        records.push({ habit: id, date, value, valueType: habit.type, valueUnit });
      }
    }
  }
  return records;
}

export function sampleCheckInJournal(state, end = today()) {
  const start = shift(periodKey({ period: 'week' }, end), -7 * (trendRanges.at(-1) - 1));
  const updated = start + 'T00:00:00.000Z';
  const goals = {
    sleep: { numberGoal: 7.5, numberAlmost: 7 },
    exercise: { goal: 9, near: 6 },
    walks: { goal: 3, near: 2 },
  };
  const settings = Object.entries(goals).map(([id, goal]) => {
    const habit = state.habits[id];
    return { ...defaultSettings(id, habit), ...goal, habit: id, period: habit.period, date: start, updated, frequency: true };
  });
  const records = sampleRecords({ ...state, settings }, start, end).map(row => ({
    ...row, id: 'sample:' + row.habit + ':' + row.date, updated,
  }));
  return { id: 'sample-check-ins', start, updated, records, settings };
}

function linearTrend(points) {
  const first = points[0].x;
  const last = points.at(-1).x;
  if (first === last) return null;

  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanValue = points.reduce((sum, point) => sum + point.value, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    const offset = point.x - meanX;
    covariance += offset * (point.value - meanValue);
    variance += offset ** 2;
  }
  const slope = covariance / variance;
  return [first, last].map(x => ({ x, value: meanValue + slope * (x - meanX) }));
}

function valueChart(unit, points, firstDate, lastDate) {
  const width = 720;
  const left = 64;
  const right = 694;
  const top = 18;
  const bottom = 156;
  const start = localDate(firstDate);
  const end = localDate(lastDate);
  const daysFromStart = date => (Date.parse(date) - Date.parse(firstDate)) / 86400000;
  const days = daysFromStart(lastDate);
  const positions = points.map(point => ({ ...point, x: daysFromStart(point.date) }));
  const trend = linearTrend(positions);
  const values = [...positions, ...(trend ?? [])].map(point => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = min === max ? (unit === 'Clock time' ? 30 : Math.max(0.5, Math.abs(min) * 0.1)) : (max - min) * 0.08;
  const low = unit === 'Clock time' && min >= 0 ? Math.max(0, min - padding) : min - padding;
  const high = max + padding;
  const x = day => left + day / days * (right - left);
  const y = value => bottom - (value - low) / (high - low) * (bottom - top);
  const ticks = [low, (low + high) / 2, high].map(value =>
    '<line x1="' + left + '" x2="' + right + '" y1="' + y(value) + '" y2="' + y(value) + '"/>' +
    '<text x="' + (left - 8) + '" y="' + y(value) + '" text-anchor="end" dominant-baseline="middle">' + esc(axisValue(unit, value)) + '</text>'
  ).join('');
  const line = trend ? '<line class="value-trend" x1="' + x(trend[0].x) + '" y1="' + y(trend[0].value) +
    '" x2="' + x(trend[1].x) + '" y2="' + y(trend[1].value) + '"/>' : '';
  const dots = positions.map(point => '<circle cx="' + x(point.x) + '" cy="' + y(point.value) + '" r="3.5"><title>' +
    esc(labelDate(point.date) + ' · ' + point.label) + '</title></circle>').join('');
  const dates = '<text x="' + left + '" y="181">' + esc(axisDate.format(start)) + '</text><text x="' + right +
    '" y="181" text-anchor="end">' + esc(axisDate.format(end)) + '</text>';
  return '<figure class="value-chart"><figcaption>' + esc(unit === 'number' || unit === 'integer' ? 'Recorded value' : unit) +
    (trend ? '<span class="value-trend-key">Linear trend</span>' : '') + '</figcaption>' +
    '<div class="chart-scroll"><svg viewBox="0 0 ' + width + ' 194" role="img" aria-label="' +
    esc(unit + ' trend, ' + points.length + ' entries. Latest value ' + points.at(-1).label) + '">' +
    ticks + line + dots + dates + '</svg></div></figure>';
}

function trendRow(state, id, habit, records, weeks, start, end, selectedDate, trackingStart) {
  const recordsByPeriod = new Map();
  for (const row of records) {
    const date = periodKey(habit, row.date);
    if (!recordsByPeriod.has(date)) recordsByPeriod.set(date, []);
    recordsByPeriod.get(date).push(row);
  }
  const { deadline } = settingsAt(state, id, periodKey(habit, end));
  const status = periodOutcomes(state, id, habit, records, trackingStart, end);
  const series = valueSeries(records.filter(row => row.date >= start), deadline);
  const values = [...series].map(([unit, points]) => valueChart(unit, points, start, end)).join('') ||
    '<p class="chart-empty">No recorded values in this range.</p>';
  return '<article class="trend-row panel padded" data-trend-habit="' + esc(id) + '">' +
    '<h2><span aria-hidden="true">' + esc(habit.icon) + '</span> ' + esc(habit.name) + '</h2>' +
    '<div class="trend-row-charts"><div><h3>Activity</h3>' + heatmap(habit, recordsByPeriod, weeks, start, end, selectedDate, status) + '</div>' +
    '<div><h3>Check-in values</h3>' + values + '</div></div></article>';
}

export function renderTrends(main, state, weeks, selectedDate, category = 'all') {
  const end = today();
  const start = shift(periodKey({ period: 'week' }, end), -7 * (weeks - 1));
  const byHabit = new Map();
  for (const row of state.records) {
    if (row.date > end) continue;
    if (!byHabit.has(row.habit)) byHabit.set(row.habit, []);
    byHabit.get(row.habit).push(row);
  }
  const habits = Object.entries(state.habits).filter(([, habit]) => category === 'all' || habit.category === category);
  const rows = habits.map(([id, habit]) => {
    const records = byHabit.get(id) ?? [];
    records.sort((a, b) => a.date.localeCompare(b.date) || (a.updated ?? '').localeCompare(b.updated ?? ''));
    const trackingStart = habit.start ?? state.start;
    return trendRow(state, id, habit, records, weeks, start, end, selectedDate, trackingStart);
  });
  main.innerHTML = '<header class="intro"><h1>Trends<span>.</span></h1>' +
    '<div class="trend-filters">' + categoryFilter('trend-category', category) + '<label>Range<select id="trend-range">' + trendRanges.map(range =>
      '<option value="' + range + '" ' + selected(range, weeks) + '>' + range + ' weeks</option>'
    ).join('') + '</select></label></div></header>' +
    (rows.length ? heatmapLegend() + rows.join('') : '<p>No habits in this category.</p>') +
    renderPeriodOutcomes(state, selectedDate, category);
}
