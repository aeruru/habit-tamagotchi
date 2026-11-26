import { habits, meals, outcome, periodKey, rowsFor, settingsAt } from '../habit-engine/index.js';
import { esc, selected, today } from './format.js';

export function showDialog(editor, title, body, submit, button = 'Save check-in') {
  editor.innerHTML = '<form><h2 id="dialog-title">' + title + '</h2>' + body +
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
    const habit = habits[id];
    const currentRows = rowsFor(state, id, date);
    if (!settingsAt(state, id, periodKey(habit, date)).enabled && live) throw new Error('Enable this habit in Settings first.');
    const skip = currentRows.find(row => row.skip);
    if (skip) throw new Error('Remove the skip for this period before adding a check-in.');
    const previous = habit.sleep ? currentRows.find(row => row.id !== original?.id) : undefined;
    if (previous && original) throw new Error('That night already has a check-in for this habit.');
    const row = { id: original?.id ?? previous?.id ?? (habit.sleep ? id + ':' + date : crypto.randomUUID()), habit: id, date,
      ...values, skip: false, updated: new Date().toISOString() };
    const settings = settingsAt(state, id, periodKey(habit, date));
    const rewardKey = habit.type === 'rating' ? row.id : id + ':' + periodKey(habit, date);
    const next = [...currentRows.filter(existing => existing.id !== row.id), row];
    const reward = live && !original && settings.treat && !state.rewards.has(rewardKey) &&
      (habit.type === 'rating' || (outcome(habit, settings, currentRows, false) !== 'met' && outcome(habit, settings, next, false) === 'met'));
    save({ records: [row], ...(reward && { reward: rewardKey }) }, { records: [original ?? previous ?? { id: row.id, deleted: true }] });
    if (reward) playReward();
    say('Check-in saved.');
  }
  function logDialog(id, date, original, live) {
    const habit = habits[id];
    const row = original ?? (habit.sleep ? rowsFor(readState(), id, date).find(entry => !entry.skip) : undefined);
    const dateLabel = habit.sleep ? 'Night of' : 'Date';
    let inputs = '';
    if (habit.type === 'clock') inputs = '<label>Bedtime<input required type="time" name="value" value="' + esc(row?.value) + '"></label><p>For a bedtime after midnight, keep the date of the evening before.</p>';
    if (habit.type === 'duration') inputs = '<label>Hours slept<input required type="number" step="0.01" min="0" max="24" name="value" value="' + esc(row?.value) + '"></label>';
    if (habit.type === 'rating') inputs = '<label>Meal<select name="meal">' + meals.map(meal => '<option ' + selected(meal, row?.meal) + '>' + meal + '</option>').join('') +
      '</select></label><label>Hunger<select name="value">' + ['1 · Not hungry', '2 · Slightly hungry', '3 · Moderately hungry', '4 · Very hungry', '5 · Extremely hungry']
        .map((label, i) => '<option value="' + (i + 1) + '" ' + selected(row?.value ?? 3, i + 1) + '>' + label + '</option>').join('') + '</select></label>';
    showDialog(habit.name, '<label>' + dateLabel + '<input required type="date" name="date" value="' + date + '" max="' + today() + '"></label>' + inputs, form => {
      const chosen = form.get('date');
      const value = habit.type === 'clock' ? form.get('value') : (habit.type === 'event' ? 1 : Number(form.get('value')));
      log(id, chosen, { value, ...(habit.type === 'rating' && { meal: form.get('meal') }) }, row, live && chosen === date);
    });
  }
  function skipPeriod(id, date) {
    const habit = habits[id];
    const start = periodKey(habit, date);
    const existing = rowsFor(readState(), id, start);
    if (existing.some(row => row.skip)) return say('This period is already skipped.');
    const confirm = () => {
      const row = { id: 'skip:' + id + ':' + start, habit: id, date: start, skip: true, updated: new Date().toISOString() };
      save({ records: [row] }, { records: [{ id: row.id, deleted: true }] });
      say('Period skipped.');
    };
    if (existing.length) showDialog('Skip this ' + habit.period + '?',
      '<p>Existing check-ins stay in history. The habit level and streak hold for this period.</p>', confirm, 'Skip period');
    else confirm();
  }

  return { log, logDialog, removeRow, skipPeriod };
}
