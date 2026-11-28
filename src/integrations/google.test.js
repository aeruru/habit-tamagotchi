import assert from 'node:assert/strict';
import test from 'node:test';
import { materialize } from '../habit-engine/index.js';
import { googleSession } from './google.js';

test('Sheets reuses the original Health tab and routes Work and Family check-ins', async t => {
  const date = '2026-11-27';
  const legacySpreadsheet = {
    sheets: [{ properties: { sheetId: 4, title: 'Habit records', gridProperties: { rowCount: 1000, columnCount: 26 } } }],
  };
  let requests;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'POST') requests = JSON.parse(options.body).requests;
    return Response.json(options.method === 'GET' ? legacySpreadsheet : {});
  });

  const state = materialize([
    { id: '1', updated: '1', start: date, habits: [
      { id: 'focus', name: 'Focus', period: 'day', type: 'count', goal: 1, near: 0 },
      { id: 'dinner', name: 'Family dinner', category: 'family', period: 'day', type: 'count', goal: 1, near: 0 },
    ], records: [
      { id: 'sleep-entry', habit: 'sleep', date, value: 7.5, valueType: 'number' },
      { id: 'focus-entry', habit: 'focus', date, value: 1, valueType: 'count' },
      { id: 'dinner-entry', habit: 'dinner', date, value: 1, valueType: 'count' },
    ] },
    { id: '2', updated: '2', start: date, habits: [{ id: 'focus', category: 'work' }] },
  ], date);
  assert.equal(state.habits.sleep.category, 'health');
  assert.equal(state.habits.focus.category, 'work');
  await googleSession('mock-token').publish('mock-sheet', state);

  const rename = requests.find(request => request.updateSheetProperties?.fields === 'title');
  assert.deepEqual(rename.updateSheetProperties.properties, { sheetId: 4, title: 'Health habits' });
  const work = requests.find(request => request.addSheet?.properties.title === 'Work habits').addSheet.properties.sheetId;
  const family = requests.find(request => request.addSheet?.properties.title === 'Family habits').addSheet.properties.sheetId;
  const recordIds = sheetId => requests.find(request => request.updateCells?.range.sheetId === sheetId)
    .updateCells.rows.slice(1).map(row => row.values[0].userEnteredValue.stringValue);
  assert.deepEqual(recordIds(4), ['sleep-entry']);
  assert.deepEqual(recordIds(work), ['focus-entry']);
  assert.deepEqual(recordIds(family), ['dinner-entry']);
});
