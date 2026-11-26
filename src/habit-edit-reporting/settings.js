import { checkInTypes, clockOrder, effects, maxCheckInNumber, periodKey, settingsAt, validCheckInNumber } from '../habit-engine/index.js';
import { checked, esc, selected, today } from './format.js';

const emojiSuggestions = ['🌱', '💧', '📚', '🏃', '🧘', '🎸', '🥗', '🛌', '✨'];
const emojiPattern = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)$/u;

export function renderSettings(main, state, connected, email) {
  const habitEntries = Object.entries(state.habits);
  main.innerHTML = '<header class="intro"><div><h1>Settings<span>.</span></h1></div></header>' +
    '<section class="panel padded"><h2>Google Sheets</h2><p>' + (connected ? 'Connected as ' + esc(email) : 'Connect a Google account to create a dedicated spreadsheet and sync an account profile.') + '</p>' +
    '<button class="soft" data-action="' + (connected ? 'disconnect">Disconnect' : 'google">Connect Google') + '</button></section>' +
    '<section class="panel padded"><div class="section-head"><h2>Habits</h2><button class="soft" data-action="add-habit">Add habit</button></div>' +
    '<div class="history-list">' + habitEntries.map(([id, habit]) =>
      '<article><div><strong><span aria-hidden="true">' + esc(habit.icon) + '</span> ' + esc(habit.name) + '</strong><p>' + (habit.period === 'week' ? 'Weekly' : 'Daily') +
      ' · ' + (checkInTypes[habit.type]) + '</p></div>' +
      '<button class="link" data-action="edit-habit" data-habit="' + esc(id) + '">Edit habit</button></article>').join('') +
    '</div></section>' +
    '<form id="settings-form"><section class="panel padded"><h2>Pet effects</h2><div class="settings-grid">' +
    Object.keys(effects).map(effect => '<label class="capitalize">' + effect + '<select name="' + effect + '">' +
      '<option value="">Unassigned</option>' + habitEntries.map(([id, habit]) => '<option value="' + esc(id) + '" ' +
        selected(state.assignments[effect], id) + '>' + esc(habit.name) + '</option>').join('') + '</select></label>').join('') +
    '</div><button class="primary" type="submit">Save pet effects</button></section></form>';
}

export function submitSettings(event, save, say) {
  if (event.target.id !== 'settings-form') return;
  event.preventDefault();
  const form = new FormData(event.target);
  const assignments = Object.fromEntries(Object.keys(effects).map(effect => [effect, form.get(effect)]));
  save({ assignments });
  say('Pet effects saved.');
}

export function habitDialog(state, showDialog, save, say, id) {
  const existing = state.habits[id];
  const nameField = '<label>Name<input name="name" required maxlength="80" value="' + esc(existing?.name) + '"></label>';
  const iconField = '<label>Emoji icon<input name="icon" required maxlength="32" list="habit-emoji" value="' +
    esc(existing?.icon ?? '🌱') + '"></label><datalist id="habit-emoji">' +
    emojiSuggestions.map(emoji => '<option value="' + emoji + '"></option>').join('') + '</datalist>';
  const settings = existing ? settingsAt(state, id, periodKey(existing, today())) :
    { goal: 1, near: 0, enabled: true, loggingOnly: false, treat: false };
  const fields = '<label>Schedule<select name="period"><option value="day" ' + selected(existing?.period, 'day') + '>Daily</option>' +
    '<option value="week" ' + selected(existing?.period, 'week') + '>Weekly</option></select></label>' +
    '<label>Check-in value<select name="type">' + Object.entries(checkInTypes).map(([type, label]) =>
      '<option value="' + type + '" ' + selected(existing?.type, type) + '>' + label + '</option>').join('') +
    '</select></label><p>The check-in type controls what you record.</p>' +
    '<div class="number-goals"><label>What counts toward the goal?<select name="number-mode">' +
    '<option value="check-in" ' + selected(settings.numberGoal == null, true) + '>Any check-in</option>' +
    '<option value="value" ' + selected(settings.numberGoal != null, true) + '>Check-in meets a number target</option></select></label>' +
    '<div class="number-target"><label>Comparison<select name="comparison">' +
    '<option value="at-least" ' + selected(settings.comparison, 'at-least') + '>At least</option>' +
    '<option value="at-most" ' + selected(settings.comparison, 'at-most') + '>At most</option></select></label>' +
    '<label>Target value<input type="number" inputmode="decimal" step="any" min="0" max="' + maxCheckInNumber +
    '" name="number-goal" value="' + esc(settings.numberGoal) + '"></label>' +
    '<label>Almost-goal value (optional)<input type="number" inputmode="decimal" step="any" min="0" max="' + maxCheckInNumber +
    '" name="number-almost" value="' + esc(settings.numberAlmost) + '"></label></div></div>' +
    '<label>Goal (check-ins per period)<input name="goal" type="number" min="1" max="10000" step="1" required value="' + settings.goal + '"></label>' +
    '<label class="frequency-near-goal">Almost goal (check-ins)<input name="near" type="number" min="0" max="9999" step="1" value="' + settings.near + '"></label>' +
    '<div class="clock-goals"><label>Goal time (by)<input name="deadline" type="time" value="' + esc(settings.deadline) + '"></label>' +
    '<label>Almost-goal time (by, optional)<input name="grace" type="time" value="' + esc(settings.grace) + '"></label>' +
    '<p>Leave both times blank to count every check-in. For afternoon and evening goals, times after midnight count toward the same night.</p></div>' +
    '<label class="check"><input type="checkbox" name="enabled" ' + checked(settings.enabled) + '> Enabled</label>' +
    '<label class="check"><input type="checkbox" name="logging" aria-describedby="logging-help" ' + checked(settings.loggingOnly) + '> Track without a goal</label>' +
    '<p id="logging-help">Save check-ins to History without earning goal progress or treats.</p>' +
    '<label class="check"><input type="checkbox" name="treat" ' + checked(settings.treat) + '> Award treats</label>' +
    (existing ? '<p>Changing the schedule regroups past check-ins. Existing check-in values keep their original type.</p>' : '');

  showDialog(existing ? 'Edit habit' : 'Add habit', nameField + iconField + fields, form => {
    const name = form.get('name').trim();
    const icon = form.get('icon').trim();
    if (!name || name.length > 80) throw new Error('Enter a name of up to 80 characters.');
    if (icon.length > 32 || (icon !== existing?.icon && !emojiPattern.test(icon))) throw new Error('Choose or enter one emoji.');
    const type = form.get('type');
    const period = form.get('period');
    const goal = Number(form.get('goal'));
    const usesNumberTarget = type === 'number' && form.get('number-mode') === 'value';
    const near = type === 'clock' || usesNumberTarget ? Math.max(0, goal - 1) : Number(form.get('near'));
    if (!Object.hasOwn(checkInTypes, type) || !['day', 'week'].includes(period) ||
        !Number.isInteger(goal) || goal < 1 || goal > 10000 || !Number.isInteger(near) || near < 0 || near >= goal) {
      throw new Error('Enter a goal from 1 to 10,000 and an almost goal below it.');
    }
    const deadline = type === 'clock' ? form.get('deadline') ?? '' : '';
    const grace = type === 'clock' ? form.get('grace') ?? '' : '';
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/;
    if ((deadline && !validTime.test(deadline)) || (grace &&
        (!deadline || !validTime.test(grace) || clockOrder(grace, deadline) <= clockOrder(deadline, deadline)))) {
      throw new Error('Enter a valid goal time and an almost-goal time later than the goal time.');
    }
    const comparison = form.get('comparison') === 'at-most' ? 'at-most' : 'at-least';
    const target = form.get('number-goal');
    const almostTarget = form.get('number-almost');
    const numberGoal = usesNumberTarget && target ? Number(target) : null;
    const numberAlmost = usesNumberTarget && almostTarget ? Number(almostTarget) : null;
    if (usesNumberTarget && !validCheckInNumber(numberGoal)) {
      throw new Error('Enter a target from 0 to 10,000 with at most two significant digits.');
    }
    if (numberAlmost != null && (!validCheckInNumber(numberAlmost) ||
        (comparison === 'at-most' ? numberAlmost <= numberGoal : numberAlmost >= numberGoal))) {
      throw new Error('Enter an almost-goal value with at most two significant digits that is easier to meet than the target.');
    }
    const updated = new Date().toISOString();
    const habitId = id ?? crypto.randomUUID();
    const definition = { id: habitId, name, icon, period, type };
    if (!existing) Object.assign(definition, { start: today(), goal, near });
    const next = { habit: habitId, period, date: periodKey(definition, today()), updated, goal, near, deadline, grace,
      numberGoal, numberAlmost, comparison, frequency: true,
      enabled: form.has('enabled'), loggingOnly: form.has('logging'), treat: form.has('treat') };
    save({ habits: [definition], settings: [next] });
    say(existing ? 'Habit updated.' : 'Habit added.');
  }, 'Save habit');
}
