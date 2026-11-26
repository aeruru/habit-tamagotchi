import { effects, habits, measure, periodKey, progression, rowsFor, settingsAt } from '../habit-engine/index.js';
import { esc, forToday, labelDate, valueDisplay } from './format.js';

const habitEntries = Object.entries(habits);

export function renderCheckIns(container, state) {
  container.innerHTML = habitEntries.map(([id, habit]) => {
    const date = forToday(habit);
    const settings = settingsAt(state, id, periodKey(habit, date));
    if (!settings.enabled) return '';
    const rows = rowsFor(state, id, date);
    const skip = rows.find(row => row.skip);
    const value = measure(habit, rows);
    const logged = habit.sleep && rows[0];
    let detail = settings.loggingOnly ? value + ' check-ins today' :
      value + ' / ' + settings.goal + (habit.period === 'week' ? ' days this week' : ' today');
    if (habit.sleep) detail = logged ? valueDisplay(habit, logged) + ' · ' + labelDate(date) + ' night' : 'Last night · ' + labelDate(date);
    if (skip) detail = 'Skipped this ' + habit.period;
    const quick = habit.type === 'event' && !skip;
    const action = skip ? 'resume' : quick ? 'quick' : 'log';
    const button = skip ? 'Resume' : quick ? '+ Add' : logged ? 'Edit' : 'Log';
    const streak = progression(state, id, effects.weather).streak;
    return '<article class="habit panel"><span class="habit-icon ' + id + '" aria-hidden="true">' + habit.icon + '</span><div class="habit-copy"><h3>' +
      habit.name + '</h3><p>' + esc(detail) + (streak ? ' · ' + streak + ' ' + (habit.period === 'week' ? 'wk' : 'day') + ' streak' : '') +
      '</p></div><div class="habit-actions"><button class="primary" data-action="' + action + '" data-habit="' + id + '">' + button +
      '</button>' + (skip ? '' : '<button class="link muted" data-action="skip" data-habit="' + id + '">Skip</button>') + '</div></article>';
  }).join('') || '<div class="panel empty">Enable a habit in <a href="#settings">Settings</a> to get started.</div>';
}
