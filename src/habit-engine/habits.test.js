import assert from 'node:assert/strict';
import test from 'node:test';
import { effects, habits, materialize, measure, outcome, progression, sceneState, settingsAt, shift, validCheckInNumber } from './index.js';

const monday = '2026-11-16';
const row = (habit, date, value, id = habit + date) => ({ habit, date, value, id });
const operation = (id, fields) => ({ id, updated: id, start: monday, ...fields });
const state = records => materialize([operation('1', { records })], monday);

test('days off preserve a streak and a missed scheduled day resets it', () => {
  const friday = shift(monday, 4);
  const nextMonday = shift(monday, 7);
  for (const days of [[1, 2, 3, 4, 5], [1, 5]]) {
    const data = materialize([operation('1', {
      habits: [{ id: 'hunger', start: friday }],
      settings: [{ habit: 'hunger', date: friday, days, updated: '1' }],
      records: [row('hunger', friday, 4), row('hunger', shift(friday, 1), 4)],
    })], nextMonday);
    assert.deepEqual(progression(data, 'hunger', effects.weather, nextMonday), { level: 4, streak: 1 });
    assert.deepEqual(progression(data, 'hunger', effects.weather, shift(nextMonday, 1)), { level: 2, streak: 0 });
  }
});

test('older bedtime targets and sleep values remain readable', () => {
  const data = materialize([operation('1', {
    records: [row('bedtime', monday, '23:55'), row('sleep', monday, 7.5)],
    settings: [{ habit: 'bedtime', date: monday, updated: '1', goal: '23:30', near: 30, enabled: true }],
  })], monday);
  assert.equal(settingsAt(data, 'bedtime', monday).goal, 1);
  assert.equal(settingsAt(data, 'bedtime', monday).deadline, '23:30');
  assert.equal(settingsAt(data, 'bedtime', monday).grace, '00:00');
  assert.deepEqual(data.records.map(({ value, valueType }) => [value, valueType]), [['23:55', 'clock'], [7.5, 'duration']]);
  assert.equal(progression(data, 'bedtime', effects.weather, monday).level, 3);
  assert.equal(progression(data, 'sleep', effects.mood, monday).level, 5);
});

test('corrections replace a record by ID and replay subsequent periods in order', () => {
  const first = row('bedtime', monday, '22:30');
  const last = row('bedtime', shift(monday, 1), '22:00');
  const history = [operation('1', { records: [first, last] }), operation('2', { records: [{ id: first.id, deleted: true }] })];
  const date = shift(monday, 2);
  assert.equal(progression(materialize(history.slice(0, 1), date), 'bedtime', effects.weather, date).level, 5);
  assert.equal(progression(materialize(history.reverse(), date), 'bedtime', effects.weather, date).level, 2);
});

test('weekly exercise counts occurrences, awards early, and waits to downgrade', () => {
  const range = { max: 7, start: 5 };
  const days = [
    row('exercise', monday, 1), row('exercise', monday, 1, 'another'),
    { ...row('exercise', shift(monday, 1), 1), valueType: 'count' },
  ];
  const sunday = shift(monday, 6);
  const nextWeek = shift(monday, 7);
  assert.equal(progression(state(days.slice(0, 2)), 'exercise', range, sunday).level, 5);
  assert.equal(progression(state(days), 'exercise', range, sunday).level, 6);
  assert.equal(progression(state(days.slice(0, 2)), 'exercise', range, nextWeek).level, 4);
  assert.equal(progression(state(days.slice(0, 1)), 'exercise', range, nextWeek).level, 2);
});

test('walk overflow stays in history and effect reassignment uses the receiving range', () => {
  const data = state([0, 1, 2].map(i => row('walks', monday, 1, 'walk' + i)));
  data.assignments = { ...data.assignments, weather: 'walks', hut: 'walks' };
  assert.equal(measure(data.records), 3);
  const result = sceneState(data, new Date(monday + 'T12:00:00'));
  assert.equal(result.weather, 4);
  assert.equal(result.hut, 3);
});

test('a skip preserves the streak while an empty closed day reduces the level', () => {
  const records = [row('bedtime', monday, '22:30'), { ...row('bedtime', shift(monday, 1)), skip: true }];
  const data = state(records);
  assert.deepEqual(progression(data, 'bedtime', effects.weather, shift(monday, 2)), { level: 4, streak: 1 });
  assert.deepEqual(progression(data, 'bedtime', effects.weather, shift(monday, 3)), { level: 2, streak: 0 });
});

test('custom clock and number habits count entries independently of their values', () => {
  const clock = { id: 'coffee', name: 'Coffee', type: 'clock', period: 'day', goal: 2, near: 1, start: monday };
  const integer = { id: 'reading', name: 'Reading', type: 'number', period: 'week', goal: 2, near: 1, start: monday };
  const data = materialize([operation('1', {
    habits: [clock, integer],
    records: [
      row('coffee', monday, '08:00', 'first'),
      row('coffee', monday, '16:20', 'second'),
      row('reading', monday, 200, 'third'),
      row('reading', shift(monday, 1), 0, 'fourth'),
    ],
  })], monday);
  assert.equal(progression(data, 'coffee', effects.weather, monday).level, 4);
  assert.equal(progression(data, 'reading', effects.weather, monday).level, 3);
  assert.equal(progression(data, 'reading', effects.weather, shift(monday, 1)).level, 4);
});

test('starter edits change the name, emoji, schedule, and future input type without rewriting old values', () => {
  const tuesday = shift(monday, 1);
  const data = materialize([
    operation('1', { records: [row('bedtime', monday, '22:00')] }),
    operation('2', {
      habits: [{ id: 'bedtime', name: 'Evening routine', icon: '🌱', type: 'count', period: 'week' }],
      settings: [{ habit: 'bedtime', date: monday, period: 'week', updated: '2', frequency: true, goal: 3, near: 2, enabled: true }],
      records: [{ ...row('bedtime', tuesday, 2), valueType: 'count', note: 'Two sessions' }],
    }),
  ], tuesday);
  assert.equal(data.habits.bedtime.name, 'Evening routine');
  assert.equal(data.habits.bedtime.icon, '🌱');
  assert.equal(data.habits.bedtime.period, 'week');
  assert.equal(data.habits.bedtime.type, 'count');
  assert.equal(data.records[0].value, '22:00');
  assert.equal(data.records[0].valueType, 'clock');
  assert.equal(data.records[1].note, 'Two sessions');
  assert.equal(progression(data, 'bedtime', effects.weather, tuesday).level, 4);
  assert.ok(Object.values(habits).every(habit => ['clock', 'count', 'number'].includes(habit.type)));
});


test('clock targets distinguish on time, almost, and late across midnight', () => {
  const settings = { enabled: true, goal: 1, near: 0, deadline: '23:45', grace: '00:15' };
  const result = (time, closed = true, extra = {}) =>
    outcome({ ...settings, ...extra }, [{ valueType: 'clock', value: time }], closed);
  assert.equal(result('23:45'), 'met');
  assert.equal(result('23:46', false), 'open');
  assert.equal(result('00:15'), 'almost');
  assert.equal(result('00:16'), 'miss');
  assert.equal(result('23:00', true, { loggingOnly: true }), 'inactive');
});

test('number check-ins allow up to two decimal places between zero and 10000', () => {
  for (const value of [0, 7.5, 7.55, 0.25, 123, 9999.99, 10000]) assert.ok(validCheckInNumber(value), String(value));
  for (const value of [-1, 7.555, 0.001, 10000.01, NaN, Infinity]) assert.ok(!validCheckInNumber(value), String(value));
});

test('hunger records a number but reaches its daily goal after any check-in', () => {
  const data = state([{ ...row('hunger', monday, 0), valueType: 'number' }]);
  const settings = settingsAt(data, 'hunger', monday);
  assert.equal(settings.goal, 1);
  assert.equal(data.records[0].value, 0);
  assert.equal(outcome(settings, data.records, false), 'met');
});

test('number targets use the same qualifying frequency and almost-goal rubric as clock targets', () => {
  const settings = { enabled: true, goal: 2, near: 1, numberGoal: 8, numberAlmost: 7, comparison: 'at-least' };
  const number = value => ({ valueType: 'number', value });
  assert.equal(outcome(settings, [number(8), number(9)], false), 'met');
  assert.equal(outcome(settings, [number(8), number(7.5)], true), 'almost');
  assert.equal(outcome(settings, [number(8), number(6)], true), 'miss');
  assert.equal(outcome(settings, [number(8)], true), 'miss');
  const maximum = { ...settings, goal: 1, numberGoal: 0, numberAlmost: 0.5, comparison: 'at-most' };
  assert.equal(outcome(maximum, [number(0)], false), 'met');
  assert.equal(outcome(maximum, [number(0.5)], true), 'almost');
});
