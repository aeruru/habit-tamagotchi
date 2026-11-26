import { effects, goalRubric, measure, periodKey, progression, qualifyingCount, rowsFor, settingsAt } from '../habit-engine/index.js';
import { esc, today } from './format.js';

export function renderCheckIns(container, state) {
  container.innerHTML = Object.entries(state.habits).map(([id, habit]) => {
    const date = today();
    const settings = settingsAt(state, id, periodKey(habit, date));
    if (!settings.enabled) return '';
    const rows = rowsFor(state, id, date);
    const skip = rows.find(row => row.skip);
    const value = settings.loggingOnly ? measure(rows) : qualifyingCount(settings, rows);
    const { goal } = goalRubric(settings);
    const criterion = goal.criterion;
    let target = '';
    if (criterion?.type === 'clock') target = ' · by ' + criterion.value;
    if (criterion?.type === 'number') target = ' · ' + (criterion.comparison === 'at-most' ? '≤ ' : '≥ ') + criterion.value;
    const period = habit.period === 'week' ? ' this week' : ' today';
    const detail = skip ? 'Skipped this ' + habit.period : settings.loggingOnly ? value + ' logged' + period :
      value + ' / ' + goal.target + period + target;
    const quick = habit.type === 'count' && !skip;
    const action = skip ? 'resume' : quick ? 'quick' : 'log';
    const button = skip ? 'Resume' : quick ? '+1' : 'Log';
    const streak = progression(state, id, effects.weather).streak;
    return '<article class="habit panel"><span class="habit-icon ' + esc(id) + '" aria-hidden="true">' + esc(habit.icon) + '</span><div class="habit-copy"><h3>' +
      esc(habit.name) + '</h3><p>' + esc(detail) + (streak ? ' · ' + streak + ' ' + (habit.period === 'week' ? 'wk' : 'day') + ' streak' : '') +
      '</p></div><div class="habit-actions"><button class="primary" data-action="' + action + '" data-habit="' + esc(id) + '">' + button +
      '</button>' + (quick ? '<button class="link" data-action="log" data-habit="' + esc(id) + '">Log</button>' : '') +
      (skip ? '' : '<button class="link muted" data-action="skip" data-habit="' + esc(id) + '">Skip</button>') + '</div></article>';
  }).join('') || '<div class="panel empty">Enable a habit in <a href="#settings">Settings</a> to get started.</div>';
}
