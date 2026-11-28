import assert from 'node:assert/strict';
import test from 'node:test';
import { dateKey, materialize, periodKey, settingsAt, shift } from '../habit-engine/index.js';
import { renderTrends, sampleCheckInJournal } from './history-charts.js';

const today = dateKey();
const monday = shift(periodKey({ period: 'week' }, today), -7);
function render(records, habitId, start = monday) {
  const state = materialize([{ id: 'test', updated: '1', start, records }], today);
  const view = {};
  renderTrends(view, state, 13, monday);
  return view.innerHTML.split('data-trend-habit="' + habitId + '"')[1].split('</article>')[0];
}
const cell = (markup, date) => markup.match(new RegExp('<button[^>]+data-date="' + date + '"[^>]*>'))?.[0];

test('daily heatmaps use goal outcomes and value charts retain individual check-ins', () => {
  const dates = [-2, -1, 0, 1, 2, 3, 4].map(days => shift(monday, days));
  const times = ['22:00', '22:00', '23:20', '22:00', '23:45', '22:00'];
  const records = dates.slice(0, -1).map((date, index) => ({
    id: String(index), date, habit: 'bedtime', value: times[index], valueType: 'clock',
    ...(index === 3 && { skip: true, period: 'day' }),
  }));
  const bedtime = render(records, 'bedtime', dates[0]);
  assert.match(cell(bedtime, shift(dates[0], -1)), /heat-inactive/);
  assert.match(cell(bedtime, dates[0]), /heat-met/);
  assert.match(cell(bedtime, monday), /heat-almost/);
  assert.match(cell(bedtime, dates[3]), /heat-skip/);
  assert.match(cell(bedtime, dates[4]), /heat-miss.*Below almost goal/);
  assert.match(cell(bedtime, dates[6]), /heat-empty.*No check-ins/);
  assert.match(cell(bedtime, today), /heat-open/);
  assert.equal((bedtime.match(/class="value-trend"/g) ?? []).length, 1);
  assert.equal((bedtime.match(/<circle /g) ?? []).length, 5);
});

test('weekly habits show one tile per week with the full week’s outcome and count', () => {
  const exercise = render([
    { id: 'first', date: shift(monday, 1), habit: 'exercise', value: 1, valueType: 'count' },
    { id: 'second', date: shift(monday, 3), habit: 'exercise', value: 1, valueType: 'count' },
  ], 'exercise');
  assert.equal((exercise.match(/data-date=/g) ?? []).length, 13);
  assert.match(cell(exercise, monday), /heat-almost.*Week of .*2 occurrences/);
  assert.equal(cell(exercise, shift(monday, 1)), undefined);
  assert.match(cell(exercise, periodKey({ period: 'week' }, today)), /heat-open/);
});

test('the trend is a least-squares fit against elapsed days, including gaps', () => {
  const records = [[0, 2], [1, 6], [4, 6]].map(([offset, value], index) => ({
    id: String(index), date: shift(monday, offset), habit: 'sleep', value,
    valueType: 'number', valueUnit: 'hours',
  }));
  const markup = render(records, 'sleep');
  const [, x1, y1, x2, y2] = markup.match(/class="value-trend" x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/).map(Number);
  const dots = [...markup.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)].map(match => match.slice(1).map(Number));
  const chartValue = y => 2 + 4 * (y - dots[0][1]) / (dots[1][1] - dots[0][1]);
  assert.equal(x1, dots[0][0]);
  assert.equal(x2, dots[2][0]);
  assert.ok(Math.abs(chartValue(y1) - 44 / 13) < 1e-8);
  assert.ok(Math.abs(chartValue(y2) - 84 / 13) < 1e-8);
});

test('multiple check-ins on just one day show dots without a trend line', () => {
  const records = [5, 7].map(value => ({
    id: String(value), date: monday, habit: 'sleep', value, valueType: 'number', valueUnit: 'hours',
  }));
  const markup = render(records, 'sleep');
  assert.equal((markup.match(/<circle /g) ?? []).length, 2);
  assert.doesNotMatch(markup, /class="value-trend"/);
});

test('sample goals show empty and below-goal periods without changing live defaults', () => {
  const live = materialize([], today);
  const demo = materialize([sampleCheckInJournal(live, today)], today);
  const view = {};
  renderTrends(view, demo, 13, today);
  const chart = id => view.innerHTML.split('data-trend-habit="' + id + '"')[1].split('</article>')[0];
  for (const id of ['bedtime', 'sleep', 'exercise', 'walks']) {
    assert.match(chart(id), /heatmap-day heat-empty/, id);
    assert.match(chart(id), /heatmap-day heat-miss/, id);
  }
  assert.match(chart('hunger'), /heatmap-day heat-empty/);
  assert.doesNotMatch(chart('hunger'), /heatmap-day heat-miss/);
  assert.equal(settingsAt(demo, 'sleep', today).numberGoal, 7.5);
  assert.equal(settingsAt(live, 'sleep', today).numberGoal, null);
});
