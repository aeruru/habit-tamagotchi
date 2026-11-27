import { checkInNoteLimit, maxCheckInNumber, meals, outcome, periodKey, rowsFor, settingsAt, validCheckInNumber, valueUnits } from '../habit-engine/index.js';
import { clockTimeOptions, esc, selectableClockTime, selected, today } from './format.js';

export function showDialog(editor, title, body, submit, button = 'Save check-in') {
  editor.innerHTML = '<form><h2 id="dialog-title">' + esc(title) + '</h2>' + body +
    '<p class="error" role="alert"></p><div class="dialog-actions"><button type="button" class="soft" data-action="cancel">Cancel</button>' +
    '<button type="submit" class="primary">' + button + '</button></div></form>';
  editor.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    try {
      submit(new FormData(event.target));
      editor.close();
    } catch (error) {
      editor.querySelector('.error').textContent = error.message;
    }
  });
  editor.showModal();
}

export function createHabitEditor({ readState, save, say, showDialog, playReward }) {
  function removeRow(row) {
    if (!row) return;
    save({ records: [{ id: row.id, deleted: true }] }, { records: [row] });
    say(row.skip ? 'Skip removed.' : 'Check-in removed.');
  }
  function log(id, date, values, original, live = false) {
    const state = readState();
    const habit = state.habits[id];
    const currentRows = rowsFor(state, id, date);
    if (!settingsAt(state, id, periodKey(habit, date)).enabled && live) throw new Error('Enable this habit in Settings first.');
    const skip = currentRows.find(row => row.skip);
    if (skip) throw new Error('Remove the skip for this period before adding a check-in.');
    const type = original?.valueType ?? habit.type;
    const note = (values.note ?? '').trim();
    if (note.length > checkInNoteLimit) throw new Error('Notes can contain up to ' + checkInNoteLimit + ' characters.');
    if (type === 'count' && (!Number.isSafeInteger(values.value) || values.value < 1)) {
      throw new Error('Count must be a positive whole number.');
    }
    if (type === 'integer' && !Number.isSafeInteger(values.value)) {
      throw new Error('Enter a whole number within the supported range.');
    }
    if (type === 'number' && !validCheckInNumber(values.value)) {
      throw new Error('Enter a number from 0 to ' + maxCheckInNumber.toLocaleString() + ' with at most two significant digits, such as 7.5 or 120.');
    }
    if (type === 'clock' && !selectableClockTime(values.value, original?.value)) {
      throw new Error('Choose a time in 15-minute increments.');
    }
    const valueUnit = original?.valueUnit ?? (type === 'number' ? habit.unit ?? valueUnits[type] : valueUnits[type]);
    const row = { id: original?.id ?? crypto.randomUUID(), habit: id, date,
      ...values, valueType: type, valueUnit, note, skip: false, updated: new Date().toISOString() };
    const settings = settingsAt(state, id, periodKey(habit, date));
    const rewardKey = id + ':' + periodKey(habit, date);
    const next = [...currentRows.filter(existing => existing.id !== row.id), row];
    const reward = live && !original && settings.treat && !state.rewards.has(rewardKey) &&
      (outcome(settings, currentRows, false) !== 'met' && outcome(settings, next, false) === 'met');
    save({ records: [row], ...(reward && { reward: rewardKey }) }, { records: [original ?? { id: row.id, deleted: true }] });
    if (reward) playReward();
    say('Check-in saved.');
  }
  function logDialog(id, date, original, live) {
    const habit = readState().habits[id];
    const row = original;
    const type = row?.valueType ?? habit.type;
    let inputs = '';
    if (type === 'clock') {
      inputs = '<label>Time<select required name="value">' + clockTimeOptions(row?.value, 'Select a time') + '</select></label>';
      if (settingsAt(readState(), id, periodKey(habit, date)).deadline >= '12:00') {
        inputs += '<p>For a time after midnight, use the date of the evening before.</p>';
      }
    }
    if (type === 'count' || type === 'integer') {
      const count = type === 'count';
      inputs = '<label>' + (count ? 'Count' : 'Value') + '<input required type="number" step="1"' +
        (count ? ' min="1"' : '') + ' name="value" value="' + esc(row?.value ?? (count ? 1 : '')) + '"></label>';
    }
    if (type === 'number') {
      const unit = row?.valueUnit ?? habit.unit;
      inputs = '<label>' + (unit && unit !== 'number' ? 'Value (' + esc(unit) + ')' : 'Value') +
        '<input required type="number" inputmode="decimal" step="any" min="0" max="' + maxCheckInNumber +
        '" name="value" value="' + esc(row?.value) + '"></label><p>Use up to two significant digits, like 7.5 or 120.</p>';
    }
    if (type === 'duration') inputs = '<label>Hours slept<input required type="number" step="0.01" min="0" max="24" name="value" value="' + esc(row?.value) + '"></label>';
    if (type === 'rating') inputs = '<label>Meal<select name="meal">' + meals.map(meal => '<option ' + selected(meal, row?.meal) + '>' + meal + '</option>').join('') +
      '</select></label><label>Hunger<select name="value">' + ['1 · Not hungry', '2 · Slightly hungry', '3 · Moderately hungry', '4 · Very hungry', '5 · Extremely hungry']
        .map((label, i) => '<option value="' + (i + 1) + '" ' + selected(row?.value ?? 3, i + 1) + '>' + label + '</option>').join('') + '</select></label>';
    inputs += '<label>Note (optional)<textarea name="note" rows="3" maxlength="' + checkInNoteLimit + '">' +
      esc(row?.note) + '</textarea></label>';
    showDialog(habit.name, '<label>Date<input required type="date" name="date" value="' + date + '" max="' + today() + '"></label>' + inputs, form => {
      const chosen = form.get('date');
      const value = type === 'clock' ? form.get('value') : (type === 'event' ? 1 : Number(form.get('value')));
      log(id, chosen, { value, note: form.get('note'), ...(type === 'rating' && { meal: form.get('meal') }) }, row, live && chosen === date);
    });
  }
  function skipPeriod(id, date) {
    const habit = readState().habits[id];
    const start = periodKey(habit, date);
    const existing = rowsFor(readState(), id, start);
    if (existing.some(row => row.skip)) return say('This period is already skipped.');
    const confirm = () => {
      const row = { id: 'skip:' + id + ':' + habit.period + ':' + start, habit: id, date: start,
        period: habit.period, skip: true, updated: new Date().toISOString() };
      save({ records: [row] }, { records: [{ id: row.id, deleted: true }] });
      say('Period skipped.');
    };
    if (existing.length) showDialog('Skip this ' + habit.period + '?',
      '<p>Existing check-ins stay in history. The habit level and streak hold for this period.</p>', confirm, 'Skip period');
    else confirm();
  }

  return { log, logDialog, removeRow, skipPeriod };
}
