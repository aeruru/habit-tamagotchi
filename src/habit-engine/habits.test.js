import assert from 'node:assert/strict';
import test from 'node:test';
import { effects, habits, materialize, measure, progression, sceneState, shift } from './index.js';

const monday = '2026-11-16';
const row = (habit, date, value, id = habit + date) => ({ habit, date, value, id });
const state = records => ({ ...materialize([], monday), start: monday, records });

test('bedtime closes at the end of the following day and distinguishes late, missing, and skipped', () => {
  const range = { ...effects.weather, start: 6 };
  const scenarios = [
    [[], 5, 0],
    [[row('bedtime', monday, '23:30')], 5, 0],
    [[row('bedtime', monday, '23:31')], 3, 0],
    [[row('bedtime', monday, '00:12')], 3, 0],
    [[{ ...row('bedtime', monday), skip: true }], 6, 0],
    [[row('bedtime', monday, '23:00')], 6, 1],
  ];
  assert.equal(progression(state([]), 'bedtime', range, shift(monday, 1)).level, 6);
  for (const [records, level, streak] of scenarios) {
    assert.deepEqual(progression(state(records), 'bedtime', range, shift(monday, 2)), { level, streak });
  }
});

test('corrections replace a record by ID and replay subsequent periods in order', () => {
  const later = row('bedtime', shift(monday, 1), '22:00');
  const update = (id, records) => ({ id, start: monday, updated: id, records });
  const history = [
    update('1', [row('bedtime', monday, '23:31'), later]),
    update('2', [row('bedtime', monday, '22:55')]),
  ];
  const date = shift(monday, 3);
  assert.equal(progression(materialize(history.slice(0, 1), date), 'bedtime', effects.weather, date).level, 2);
  assert.equal(progression(materialize(history.reverse(), date), 'bedtime', effects.weather, date).level, 5);
});

test('weekly exercise counts distinct days, awards early, and waits to downgrade', () => {
  const range = { max: 7, start: 5 };
  const days = [
    row('exercise', monday, 1), row('exercise', monday, 1, 'another'),
    row('exercise', shift(monday, 1), 1), row('exercise', shift(monday, 2), 1),
  ];
  const sunday = shift(monday, 6);
  const nextWeek = shift(monday, 7);
  assert.equal(progression(state(days.slice(0, 3)), 'exercise', range, sunday).level, 5);
  assert.equal(progression(state(days), 'exercise', range, sunday).level, 6);
  assert.equal(progression(state(days.slice(0, 3)), 'exercise', range, nextWeek).level, 4);
  assert.equal(progression(state(days.slice(0, 2)), 'exercise', range, nextWeek).level, 2);
});

test('walk overflow stays in history and effect reassignment uses the receiving range', () => {
  const records = [0, 1, 2].map(i => row('walks', monday, 1, 'walk' + i));
  const data = state(records);
  data.assignments = { ...data.assignments, weather: 'walks', hut: 'walks' };
  assert.equal(measure(habits.walks, records), 3);
  const result = sceneState(data, new Date(monday + 'T12:00:00'));
  assert.equal(result.weather, 4);
  assert.equal(result.hut, 3);
});

test('a skip preserves a streak and short sleep is independent of brighter weather', () => {
  const records = [
    row('bedtime', monday, '22:30'),
    { ...row('bedtime', shift(monday, 1)), skip: true },
    row('sleep', monday, 5),
  ];
  const data = state(records);
  const day = shift(monday, 2);
  const result = sceneState(data, new Date(day + 'T12:00:00'));
  assert.equal(progression(data, 'bedtime', effects.weather, day).streak, 1);
  assert.equal(result.weather, 4);
  assert.equal(result.mood, 2);
});

test('hunger measures check-ins independently of the ratings', () => {
  const data = state([row('hunger', monday, 1, 'a'), row('hunger', monday, 1, 'b'), row('hunger', monday, 5, 'c')]);
  assert.equal(progression(data, 'hunger', effects.weather, monday).level, 3);
  data.settings.push({ habit: 'hunger', date: monday, goal: 3, near: 2, enabled: true, loggingOnly: false });
  assert.equal(progression(data, 'hunger', effects.weather, monday).level, 4);
});
