import { outcome, periodKey, rowsFor, settingsAt, shift } from '../habit-engine/index.js';
import { esc, labelDate, today, valueDisplay } from './format.js';

const outcomeLabels = { met: 'Goal met', almost: 'Almost met', miss: 'Below goal', open: 'In progress', skip: 'Skipped', inactive: 'Logging only or disabled' };

export function renderHistory(main, state, historicalDate) {
  main.innerHTML = '<header class="intro"><div><h1>History<span>.</span></h1><p>Backfill, correct, or undo a check-in.</p></div></header>' +
    '<section class="panel padded"><div class="section-head"><h2>Period outcomes</h2><label>Calendar date<input type="date" id="history-date" max="' + today() + '" value="' + historicalDate + '"></label></div>' +
    '<div class="outcomes">' + Object.entries(state.habits).map(([id, habit]) => {
      const date = periodKey(habit, historicalDate);
      const closed = shift(date, habit.period === 'week' ? 7 : 1) <= today();
      const result = date < periodKey(habit, habit.start ?? state.start) && !rowsFor(state, id, date).length ? 'Before tracking' :
        outcomeLabels[outcome(settingsAt(state, id, date), rowsFor(state, id, date), closed)];
      return '<article><strong>' + esc(habit.name) + '</strong><span>' + esc(result) + '</span><button class="link" data-action="backfill" data-habit="' +
        esc(id) + '">Log</button><button class="link muted" data-action="skip-history" data-habit="' + esc(id) + '">Skip</button></article>';
    }).join('') + '</div></section>' +
    '<section class="panel padded history-list"><h2>All check-ins</h2>' +
    (state.records.length ? [...state.records].sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated)).map(row =>
      '<article><div><strong>' + esc(state.habits[row.habit].name) + '</strong><p>' + labelDate(row.date) + ' · ' + esc(valueDisplay(row)) +
      '</p>' + (row.note ? '<p class="check-in-note">' + esc(row.note) + '</p>' : '') + '</div>' + (row.skip ? '' : '<button class="link" data-action="edit" data-id="' + esc(row.id) + '">Edit</button>') +
      '<button class="link muted" data-action="remove" data-id="' + esc(row.id) + '">Remove</button></article>'
    ).join('') : '<p>No check-ins yet.</p>') + '</section>';
}
