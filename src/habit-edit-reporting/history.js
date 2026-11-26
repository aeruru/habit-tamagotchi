import { habits, outcome, periodKey, rowsFor, settingsAt, shift } from '../habit-engine/index.js';
import { esc, labelDate, today, valueDisplay } from './format.js';

const habitEntries = Object.entries(habits);
const outcomeLabels = { met: 'Goal met', almost: 'Almost met', miss: 'Below goal', open: 'In progress', skip: 'Skipped', inactive: 'Logging only or disabled' };

export function renderHistory(main, state, historicalDate) {
  main.innerHTML = '<header class="intro"><div><h1>History<span>.</span></h1><p>Backfill, correct, or undo a check-in.</p></div></header>' +
    '<section class="panel padded"><div class="section-head"><h2>Period outcomes</h2><label>Calendar date<input type="date" id="history-date" max="' + today() + '" value="' + historicalDate + '"></label></div>' +
    '<div class="outcomes">' + habitEntries.map(([id, habit]) => {
      const date = periodKey(habit, historicalDate);
      const closed = shift(date, (habit.period === 'week' ? 7 : 1) + Number(Boolean(habit.sleep))) <= today();
      const result = date < periodKey(habit, state.start) && !rowsFor(state, id, date).length ? 'Before tracking' :
        outcomeLabels[outcome(habit, settingsAt(state, id, date), rowsFor(state, id, date), closed)];
      return '<article><strong>' + habit.name + '</strong><span>' + esc(result) + '</span><button class="link" data-action="backfill" data-habit="' +
        id + '">Log</button><button class="link muted" data-action="skip-history" data-habit="' + id + '">Skip</button></article>';
    }).join('') + '</div></section>' +
    '<section class="panel padded history-list"><h2>All check-ins</h2>' +
    (state.records.length ? [...state.records].sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated)).map(row =>
      '<article><div><strong>' + habits[row.habit].name + '</strong><p>' + labelDate(row.date) + ' · ' + esc(valueDisplay(habits[row.habit], row)) +
      '</p></div>' + (row.skip ? '' : '<button class="link" data-action="edit" data-id="' + esc(row.id) + '">Edit</button>') +
      '<button class="link muted" data-action="remove" data-id="' + esc(row.id) + '">Remove</button></article>'
    ).join('') : '<p>No check-ins yet.</p>') + '</section>';
}
