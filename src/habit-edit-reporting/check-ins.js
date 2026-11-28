import { effects, goalRubric, habitCategories, isScheduled, measure, periodKey, progression, qualifyingCount, rowsFor, settingsAt } from '../habit-engine/index.js';
import { esc, today } from './format.js';

export function renderCheckIns(container, state, category = 'health') {
  const tabs = Object.entries(habitCategories).map(([id, name]) => {
    const active = id === category;
    return '<button type="button" role="tab" id="checkins-tab-' + id +
      '" aria-controls="checkins-category-content" aria-selected="' + active + '" tabindex="' + (active ? 0 : -1) +
      '" data-action="check-in-category" data-category="' + id + '">' + name + '</button>';
  }).join('');
  const cards = Object.entries(state.habits).filter(([, habit]) => habit.category === category).map(([id, habit]) => {
    const date = today();
    const settings = settingsAt(state, id, periodKey(habit, date));
    if (!settings.enabled || !isScheduled(settings, date)) return '';
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
  }).join('') || '<div class="panel empty">No ' + habitCategories[category].toLowerCase() +
    ' habits scheduled today. <a href="#settings">Manage habits</a></div>';
  container.innerHTML = '<div class="checkin-tabs" role="tablist" aria-label="Habit categories">' + tabs + '</div>' +
    '<div role="tabpanel" id="checkins-category-content" aria-labelledby="checkins-tab-' + category + '">' + cards + '</div>';
}
