import { effects, habits, periodKey, settingsAt } from '../habit-engine/index.js';
import { checked, esc, selected, today } from './format.js';

const habitEntries = Object.entries(habits);

export function renderSettings(main, state, connected, email) {
  main.innerHTML = '<header class="intro"><div><h1>Settings<span>.</span></h1></div></header>' +
    '<section class="panel padded"><h2>Google Sheets</h2><p>' + (connected ? 'Connected as ' + esc(email) : 'Connect a Google account to create a dedicated spreadsheet and sync an account profile.') + '</p>' +
    '<button class="soft" data-action="' + (connected ? 'disconnect">Disconnect' : 'google">Connect Google') + '</button></section>' +
    '<form id="settings-form"><section class="panel padded"><h2>Pet effects</h2><div class="settings-grid">' +
    Object.keys(effects).map(effect => '<label class="capitalize">' + effect + '<select name="' + effect + '">' +
      '<option value="">Unassigned</option>' + habitEntries.map(([id, habit]) => '<option value="' + id + '" ' +
        selected(state.assignments[effect], id) + '>' + habit.name + '</option>').join('') + '</select></label>').join('') +
    '</div></section><section class="panel padded"><h2>Habit goals</h2><p>Daily changes apply today. Weekly changes apply from Monday of this week.</p><div class="settings-grid">' +
    habitEntries.map(([id, habit]) => {
      const settings = settingsAt(state, id, periodKey(habit, today()));
      const kind = habit.type === 'clock' ? 'time' : habit.type === 'duration' ? 'number min="0.25" max="24" step="0.25"' :
        'number min="1" max="' + (habit.period === 'week' ? '7' : '100') + '" step="1"';
      return '<fieldset><legend>' + habit.name + '</legend><label class="check"><input type="checkbox" name="' + id + '-enabled" ' + checked(settings.enabled) +
        '> Enabled</label><label>' + (habit.type === 'clock' ? 'Deadline' : 'Goal (' + (habit.type === 'rating' ? 'check-ins' : habit.unit) + ')') +
        '<input type=' + kind + ' required name="' + id + '-goal" value="' + esc(settings.goal) + '"></label>' +
        (habit.type === 'clock' ? '<p>Almost goal is up to 30 minutes late.</p>' :
          '<label>Almost goal<input type=' + kind + ' required name="' + id + '-near" value="' + settings.near + '"></label>') +
        (habit.type === 'rating' ? '<label class="check"><input type="checkbox" name="' + id + '-logging" ' + checked(settings.loggingOnly) + '> Logging only</label>' : '') +
        (!habit.sleep ? '<label class="check"><input type="checkbox" name="' + id + '-treat" ' + checked(settings.treat) + '> Award treats</label>' : '') +
        '</fieldset>';
    }).join('') + '</div><button class="primary" type="submit">Save settings</button><p role="alert" id="settings-error"></p></section></form>';
}

export function submitSettings(event, state, main, save, say) {
  if (event.target.id !== 'settings-form') return;
  event.preventDefault();
  const form = new FormData(event.target);
  const updated = new Date().toISOString();
  const rows = [];
  for (const [id, habit] of habitEntries) {
    const date = periodKey(habit, today());
    const previous = settingsAt(state, id, date);
    const goal = habit.type === 'clock' ? form.get(id + '-goal') : Number(form.get(id + '-goal'));
    const near = habit.type === 'clock' ? 30 : Number(form.get(id + '-near'));
    const row = { habit: id, date, updated, goal, near, enabled: form.has(id + '-enabled'),
      treat: form.has(id + '-treat'), loggingOnly: form.has(id + '-logging') };
    if (habit.type !== 'clock' && !row.loggingOnly && near >= goal) {
      main.querySelector('#settings-error').textContent = habit.name + ': the almost goal must be lower than the goal.';
      return;
    }
    if (['goal', 'near', 'enabled', 'treat', 'loggingOnly'].some(field => previous[field] !== row[field])) rows.push(row);
  }
  const assignments = Object.fromEntries(Object.keys(effects).map(effect => [effect, form.get(effect)]));
  save({ settings: rows, assignments });
  say('Settings saved.');
}
