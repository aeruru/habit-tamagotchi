import { petNames } from '../pet-display/web/scene.js';
import { checkInTypes, clockOrder, effects, habitCategories, maxCheckInNumber, periodKey, settingsAt, validCheckInNumber, weekdays, workdays } from '../habit-engine/index.js';
import { checked, clockTimeOptions, esc, selectableClockTime, selected, today } from './format.js';

const emojiSuggestions = ['🌱', '💧', '📚', '🏃', '🧘', '🎸', '🥗', '🛌', '✨'];
const emojiPattern = /^(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3)$/u;

const scheduleLabels = { day: 'Daily', week: 'Weekly', weekdays: 'Daily (weekdays)', custom: 'Daily (custom days)' };
const orderedDays = [...workdays, 6, 0];

function scheduleFor(habit, settings) {
  return habit?.period === 'week' ? 'week' : settings.schedule ?? 'day';
}

export function renderSettings(main, state, connected, email, pet = 'pig') {
  const habitEntries = Object.entries(state.habits);
  main.innerHTML = '<header class="intro"><div><h1>Settings<span>.</span></h1></div></header>' +
    '<section class="panel padded"><h2>Google Sheets</h2><p>' + (connected ? 'Connected as ' + esc(email) :
      email ? 'Reconnect to sync the profile for ' + esc(email) + '.' : 'Connect a Google account to create a dedicated spreadsheet and sync an account profile.') + '</p>' +
    (connected ? '' : '<button class="soft" data-action="google">' + (email ? 'Reconnect Google' : 'Connect Google') + '</button> ') +
    (email ? '<button class="soft" data-action="disconnect">Disconnect</button>' : '') + '</section>' +
    '<section class="panel padded"><div class="section-head"><h2>Habits</h2><button class="soft" data-action="add-habit">Add habit</button></div>' +
    '<div class="history-list">' + habitEntries.map(([id, habit]) =>
      '<article><div><strong><span aria-hidden="true">' + esc(habit.icon) + '</span> ' + esc(habit.name) + '</strong><p>' + scheduleLabels[scheduleFor(habit, settingsAt(state, id, periodKey(habit, today())))] +
      ' · ' + checkInTypes[habit.type] + ' · ' + habitCategories[habit.category] + '</p></div>' +
      '<button class="link" data-action="edit-habit" data-habit="' + esc(id) + '">Edit habit</button></article>').join('') +
    '</div></section>' +
    '<section class="panel padded"><h2>Pet</h2><label>Animal<select id="pet-choice">' +
    Object.entries(petNames).map(([id, name]) =>
      '<option value="' + id + '" ' + selected(pet, id) + '>' + name + '</option>').join('') +
    '</select></label></section>' +
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
  const iconField = '<label class="habit-editor-emoji">Emoji<input name="icon" required maxlength="32" list="habit-emoji" value="' +
    esc(existing?.icon ?? '🌱') + '"></label><datalist id="habit-emoji">' +
    emojiSuggestions.map(emoji => '<option value="' + emoji + '"></option>').join('') + '</datalist>';
  const settings = existing ? settingsAt(state, id, periodKey(existing, today())) :
    { goal: 1, near: 0, enabled: true, loggingOnly: false, treat: false };
  const goalMode = settings.loggingOnly ? 'log' : (settings.numberGoal != null || settings.deadline ? 'value' : 'check-in');
  const schedule = scheduleFor(existing, settings);
  const scheduleOptions = Object.entries(scheduleLabels).map(([value, label]) =>
    '<option value="' + value + '" ' + selected(schedule, value) + '>' + label + '</option>').join('');
  const dayOptions = orderedDays.map(day => '<label class="check"><input type="checkbox" name="day" value="' + day +
    '" ' + checked((settings.days ?? workdays).includes(day)) + '> ' + weekdays[day] + '</label>').join('');
  const fields = '<div class="habit-editor-pair"><label>Schedule<select name="schedule">' + scheduleOptions + '</select></label>' +
    '<label>Check-in value<select name="type">' + Object.entries(checkInTypes).map(([type, label]) =>
      '<option value="' + type + '" ' + selected(existing?.type, type) + '>' + label + '</option>').join('') +
    '</select></label></div>' +
    '<fieldset class="schedule-days"><legend>Scheduled days</legend><div class="habit-editor-options">' +
    dayOptions + '</div></fieldset>' +
    '<label>Category<select name="category">' + Object.entries(habitCategories).map(([value, label]) =>
      '<option value="' + value + '" ' + selected(existing?.category ?? 'health', value) + '>' + label + '</option>'
    ).join('') + '</select></label>' +
    '<label>Goal based on<select name="goal-mode">' +
    '<option value="check-in" ' + selected(goalMode, 'check-in') + '>Number of check-ins</option>' +
    '<option value="value" ' + selected(goalMode, 'value') + '>Recorded value</option>' +
    '<option value="log" ' + selected(goalMode, 'log') + '>No goal</option></select></label>' +
    '<p class="number-goal-help">Enter a decimal like 7.5 in Goal to save it as a recorded number. For a whole-number reading, choose Recorded value.</p>' +
    '<div class="number-target"><label>Comparison<select name="comparison">' +
    '<option value="at-least" ' + selected(settings.comparison, 'at-least') + '>At least</option>' +
    '<option value="at-most" ' + selected(settings.comparison, 'at-most') + '>At most</option></select></label>' +
    '<div class="habit-editor-pair"><label>Goal value<input type="number" inputmode="decimal" step="any" min="0" max="' + maxCheckInNumber +
    '" name="number-goal" value="' + esc(settings.numberGoal) + '"></label>' +
    '<label>Almost-goal value (optional)<input type="number" inputmode="decimal" step="any" min="0" max="' + maxCheckInNumber +
    '" name="number-almost" value="' + esc(settings.numberAlmost) + '"></label></div><p>Use up to two decimal places, like 7.55 or 120.</p></div>' +
    '<div class="habit-editor-pair frequency-goals"><label><span class="check-in-goal-label">Goal (check-ins per period)</span>' +
    '<span class="qualified-goal-label">Qualifying check-ins per period</span>' +
    '<input name="goal" type="number" min="1" max="10000" step="1" required value="' + settings.goal + '"></label>' +
    '<label class="frequency-near-goal">Almost goal (check-ins)<input name="near" type="number" min="0" max="9999" step="1" value="' + settings.near + '"></label></div>' +
    '<div class="clock-goals"><div class="habit-editor-pair"><label>Goal time (by)<select name="deadline">' + clockTimeOptions(settings.deadline, 'No cutoff') + '</select></label>' +
    '<label>Almost-goal time (optional)<select name="grace">' + clockTimeOptions(settings.grace, 'No cutoff') + '</select></label></div>' +
    '<p>For afternoon and evening goals, times after midnight count toward the same night.</p></div>' +
    '<div class="habit-editor-options"><label class="check"><input type="checkbox" name="enabled" ' + checked(settings.enabled) + '> Enabled</label>' +
    '<label class="check treat-option"><input type="checkbox" name="treat" ' + checked(settings.treat) + '> Award treats</label></div>' +
    '<p id="logging-help">Check-ins are saved without awarding progress or treats.</p>' +
    (existing ? '<p>Schedule changes regroup past check-ins. Saved values keep their original type.</p>' : '');

  const body = '<div class="habit-editor-fields"><div class="habit-editor-identity">' + iconField + nameField +
    '</div>' + fields + '</div>';
  const dialogForm = showDialog(existing ? 'Edit habit' : 'Add habit', body, form => {
    const name = form.get('name').trim();
    const icon = form.get('icon').trim();
    if (!name || name.length > 80) throw new Error('Enter a name of up to 80 characters.');
    if (icon.length > 32 || (icon !== existing?.icon && !emojiPattern.test(icon))) throw new Error('Choose or enter one emoji.');
    const type = form.get('type');
    const schedule = form.get('schedule');
    if (!Object.hasOwn(scheduleLabels, schedule)) throw new Error('Choose a schedule.');
    const period = schedule === 'week' ? 'week' : 'day';
    const days = schedule === 'weekdays' ? workdays : (schedule === 'custom' ?
      form.getAll('day').map(Number).filter(day => orderedDays.includes(day)) : null);
    if (days?.length === 0) throw new Error('Choose at least one scheduled day.');
    const category = form.get('category');
    if (!Object.hasOwn(habitCategories, category)) throw new Error('Choose Health or Work.');
    const enteredGoal = Number(form.get('goal'));
    const mode = form.get('goal-mode');
    const loggingOnly = mode === 'log';
    const usesClockTarget = type === 'clock' && mode === 'value';
    const decimalGoal = type === 'number' && mode === 'check-in' && !Number.isInteger(enteredGoal);
    const goal = loggingOnly ? settings.goal : (decimalGoal ? 1 : enteredGoal);
    const usesNumberTarget = type === 'number' && (mode === 'value' || decimalGoal);
    const near = loggingOnly ? settings.near : (usesClockTarget || usesNumberTarget ? Math.max(0, goal - 1) : Number(form.get('near')));
    if (!Object.hasOwn(checkInTypes, type) || !['day', 'week'].includes(period) ||
        !Number.isInteger(goal) || goal < 1 || goal > 10000 || !Number.isInteger(near) || near < 0 || near >= goal) {
      throw new Error('Enter a goal from 1 to 10,000 and an almost goal below it.');
    }
    const deadline = usesClockTarget ? form.get('deadline') ?? '' : '';
    if (usesClockTarget && !deadline) throw new Error('Choose a goal time.');
    const grace = usesClockTarget ? form.get('grace') ?? '' : '';
    if ((deadline && !selectableClockTime(deadline, settings.deadline)) || (grace && !selectableClockTime(grace, settings.grace))) {
      throw new Error('Choose times in 15-minute increments.');
    }
    if (grace && (!deadline || clockOrder(grace, deadline) <= clockOrder(deadline, deadline))) {
      throw new Error('Choose an almost-goal time later than the goal time.');
    }
    const comparison = !decimalGoal && form.get('comparison') === 'at-most' ? 'at-most' : 'at-least';
    const target = form.get('number-goal');
    const almostTarget = form.get('number-almost');
    const numberGoal = decimalGoal ? enteredGoal : (usesNumberTarget && target ? Number(target) : null);
    let numberAlmost = usesNumberTarget && almostTarget ? Number(almostTarget) : null;
    if (decimalGoal) {
      const enteredNear = form.get('near');
      const candidate = Number(enteredNear);
      numberAlmost = enteredNear && validCheckInNumber(candidate) && candidate < numberGoal ? candidate : null;
    }
    if (usesNumberTarget && !validCheckInNumber(numberGoal)) {
      throw new Error('Enter a target from 0 to 10,000 with at most two decimal places.');
    }
    if (numberAlmost != null && (!validCheckInNumber(numberAlmost) ||
        (comparison === 'at-most' ? numberAlmost <= numberGoal : numberAlmost >= numberGoal))) {
      throw new Error('Enter an almost-goal value with at most two decimal places that is easier to meet than the target.');
    }
    const updated = new Date().toISOString();
    const habitId = id ?? crypto.randomUUID();
    const definition = { id: habitId, name, icon, period, type, category };
    if (!existing) Object.assign(definition, { start: today(), goal, near });
    const next = { habit: habitId, period, date: periodKey(definition, today()), updated, goal, near, schedule, days,
      deadline: loggingOnly ? settings.deadline ?? '' : deadline, grace: loggingOnly ? settings.grace ?? '' : grace,
      numberGoal: loggingOnly ? settings.numberGoal ?? null : numberGoal,
      numberAlmost: loggingOnly ? settings.numberAlmost ?? null : numberAlmost,
      comparison: loggingOnly ? settings.comparison ?? 'at-least' : comparison, frequency: true,
      enabled: form.has('enabled'), loggingOnly, treat: loggingOnly ? settings.treat : form.has('treat') };
    save({ habits: [definition], settings: [next] });
    say(existing ? 'Habit updated.' : 'Habit added.');
  }, 'Save habit');
  if (dialogForm) {
    const { elements } = dialogForm;
    const goalInput = elements.namedItem('goal');
    const typeInput = elements.namedItem('type');
    const modeInput = elements.namedItem('goal-mode');
    const valueOption = modeInput.querySelector('[value="value"]');
    const setVisible = (selector, visible) => {
      const group = dialogForm.querySelector(selector);
      group.hidden = !visible;
      for (const field of group.querySelectorAll('input, select')) field.disabled = !visible;
    };
    const updateGoalInput = () => {
      valueOption.disabled = !['number', 'clock'].includes(typeInput.value);
      if (valueOption.disabled && modeInput.value === 'value') modeInput.value = 'check-in';
      const logging = modeInput.value === 'log';
      const byValue = modeInput.value === 'value';
      setVisible('.frequency-goals', !logging);
      setVisible('.frequency-near-goal', !logging && !byValue);
      setVisible('.check-in-goal-label', !byValue);
      setVisible('.qualified-goal-label', byValue);
      setVisible('.number-goal-help', typeInput.value === 'number' && modeInput.value === 'check-in');
      setVisible('.number-target', typeInput.value === 'number' && byValue);
      setVisible('.clock-goals', typeInput.value === 'clock' && byValue);
      setVisible('#logging-help', logging);
      setVisible('.treat-option', !logging);
      const allowsDecimal = typeInput.value === 'number' && modeInput.value === 'check-in';
      goalInput.step = allowsDecimal ? 'any' : '1';
      goalInput.min = allowsDecimal ? '0' : '1';
      goalInput.inputMode = allowsDecimal ? 'decimal' : 'numeric';
    };
    const scheduleInput = elements.namedItem('schedule');
    const updateSchedule = () => setVisible('.schedule-days', scheduleInput.value === 'custom');
    scheduleInput.addEventListener('change', updateSchedule);
    updateSchedule();
    typeInput.addEventListener('change', updateGoalInput);
    modeInput.addEventListener('change', updateGoalInput);
    updateGoalInput();
  }
}
