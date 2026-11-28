import { habitCategories, isScheduled, outcome, periodKey, rowsFor, settingsAt, shift } from '../habit-engine/index.js';
import { esc, labelDate, selected, today, valueDisplay } from './format.js';

const outcomeLabels = { met: 'Goal met', almost: 'Almost met', miss: 'Below goal', open: 'In progress', skip: 'Skipped', inactive: 'Logging only or disabled' };

export function categoryFilter(id, category) {
  return '<label>Category<select id="' + id + '">' +
    Object.entries({ all: 'All categories', ...habitCategories }).map(([value, label]) =>
      '<option value="' + value + '" ' + selected(category, value) + '>' + label + '</option>').join('') + '</select></label>';
}

export function renderPeriodOutcomes(state, historicalDate, category = 'all') {
  const habits = Object.entries(state.habits).filter(([, habit]) => category === 'all' || habit.category === category);
  if (!habits.length) return '';
  return '<section class="panel padded"><div class="section-head"><h2>Period outcomes</h2><label>Calendar date<input type="date" id="history-date" max="' + today() + '" value="' + historicalDate + '"></label></div>' +
    '<div class="outcomes">' + habits.map(([id, habit]) => {
      const date = periodKey(habit, historicalDate);
      const closed = shift(date, habit.period === 'week' ? 7 : 1) <= today();
      const settings = settingsAt(state, id, date);
      const result = !isScheduled(settings, date) ? 'Day off' : date < periodKey(habit, habit.start ?? state.start) && !rowsFor(state, id, date).length ? 'Before tracking' :
        outcomeLabels[outcome(settings, rowsFor(state, id, date), closed)];
      return '<article><strong>' + esc(habit.name) + '</strong><span>' + esc(result) + '</span><button class="link" data-action="backfill" data-habit="' +
        esc(id) + '">Log</button><button class="link muted" data-action="skip-history" data-habit="' + esc(id) + '">Skip</button></article>';
    }).join('') + '</div></section>';
}

export const historyPageSize = 25;

export function renderHistory(main, state, visibleCount = historyPageSize, category = 'all') {
  const recent = state.records.filter(row => category === 'all' || state.habits[row.habit].category === category)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated));
  main.innerHTML = '<header class="intro"><h1>History<span>.</span></h1>' + categoryFilter('history-category', category) + '</header>' +
    '<section class="panel padded history-list"><h2>Recent check-ins</h2>' +
    (recent.length ? recent.slice(0, visibleCount).map(row =>
      '<article><div><strong>' + esc(state.habits[row.habit].name) + '</strong><p>' + labelDate(row.date) + ' · ' + esc(valueDisplay(row)) +
      '</p>' + (row.note ? '<p class="check-in-note">' + esc(row.note) + '</p>' : '') + '</div>' + (row.skip ? '' : '<button class="link" data-action="edit" data-id="' + esc(row.id) + '">Edit</button>') +
      '<button class="link muted" data-action="remove" data-id="' + esc(row.id) + '">Remove</button></article>'
    ).join('') : '<p>No check-ins yet.</p>') +
    (recent.length > visibleCount ? '<button type="button" class="link" data-action="older-check-ins">Show older check-ins</button>' : '') + '</section>';
}
