// Stable IDs keep existing records and pet assignments attached to the starter habits.
export const habits = {
  bedtime: { name: 'Bedtime', icon: '🌙', type: 'clock', period: 'day', goal: 1, near: 0, deadline: '23:00', grace: '23:30' },
  sleep: { name: 'Sleep duration (hours)', icon: '🛌', type: 'number', period: 'day', goal: 1, near: 0, unit: 'hours' },
  exercise: { name: 'Exercise', icon: '🏃', type: 'count', period: 'week', goal: 3, near: 2 },
  hunger: { name: 'Hunger before meals', icon: '🥗', type: 'number', period: 'day', goal: 1, near: 0 },
  walks: { name: 'Post-meal walks', icon: '🚶', type: 'count', period: 'day', goal: 2, near: 1, treat: true },
};
const legacyValueTypes = { bedtime: 'clock', sleep: 'duration', exercise: 'event', hunger: 'rating', walks: 'event' };
export const valueUnits = { count: 'occurrences', clock: 'local time', number: 'number', integer: 'integer', duration: 'hours', rating: 'rating 1–5', event: 'occurrences' };

export const effects = {
  weather: { start: 3, max: 6 }, mood: { start: 4, max: 7 }, hut: { start: 2, max: 7 },
};
export const defaultAssignments = { weather: 'bedtime', mood: 'sleep', hut: 'exercise' };
export const checkInNoteLimit = 500;
export const checkInTypes = { count: 'Count', clock: 'Clock time', number: 'Number' };
export const maxCheckInNumber = 10000;
export const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function dateKey(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
}
export function localDate(key) {
  return new Date(key + 'T12:00:00');
}
export function shift(key, days) {
  const date = localDate(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}
export function periodKey(habit, key) {
  return habit.period === 'week' ? shift(key, -((localDate(key).getDay() + 6) % 7)) : key;
}

export function defaultSettings(id, habit = habits[id]) {
  const { goal, near, deadline = '', grace = '', treat = false } = habit;
  return { enabled: true, goal, near, deadline, grace, numberGoal: null, numberAlmost: null, comparison: 'at-least',
    loggingOnly: false, treat };
}
export function settingsAt(state, id, date) {
  const habit = state.habits[id];
  const effective = state.settings.filter(row => row.habit === id && row.date <= date && (row.period ?? habit.period) === habit.period)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated))[0];
  const settings = { ...defaultSettings(id, habit), ...effective };
  if (habit.type !== 'clock') Object.assign(settings, { deadline: '', grace: '' });
  if (habit.type !== 'number') Object.assign(settings, { numberGoal: null, numberAlmost: null });
  return settings;
}
export function measure(rows) {
  return rows.reduce((total, row) => {
    if (row.skip) return total;
    return total + (row.valueType === 'count' ? row.value : 1);
  }, 0);
}

export function validCheckInNumber(value) {
  return Number.isFinite(value) && value >= 0 && value <= maxCheckInNumber && Number(value.toPrecision(2)) === value;
}

function clockMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
export function clockOrder(time, deadline) {
  const minutes = clockMinutes(time);
  return clockMinutes(deadline) >= 720 && minutes < 720 ? minutes + 1440 : minutes;
}

export function goalRubric(settings) {
  const goal = { target: settings.goal };
  if (settings.deadline) {
    const criterion = { type: 'clock', comparison: 'at-most', anchor: settings.deadline };
    return {
      goal: { ...goal, criterion: { ...criterion, value: settings.deadline } },
      almost: settings.grace ? { ...goal, criterion: { ...criterion, value: settings.grace } } : null,
    };
  }
  if (settings.numberGoal != null) {
    const criterion = { type: 'number', comparison: settings.comparison };
    return {
      goal: { ...goal, criterion: { ...criterion, value: settings.numberGoal } },
      almost: settings.numberAlmost != null ? { ...goal, criterion: { ...criterion, value: settings.numberAlmost } } : null,
    };
  }
  return { goal, almost: settings.near > 0 ? { target: settings.near } : null };
}

function countMatching(rule, rows) {
  if (!rule.criterion) return measure(rows);
  const { type, comparison, value, anchor } = rule.criterion;
  const normalize = type === 'clock' ? time => clockOrder(time, anchor) : number => number;
  const limit = normalize(value);
  return rows.filter(row => {
    if (row.skip || row.valueType !== type) return false;
    const actual = normalize(row.value);
    return comparison === 'at-most' ? actual <= limit : actual >= limit;
  }).length;
}

export function qualifyingCount(settings, rows) {
  return countMatching(goalRubric(settings).goal, rows);
}

export function outcome(settings, rows, closed) {
  if (rows.some(row => row.skip)) return 'skip';
  if (!settings.enabled || settings.loggingOnly) return 'inactive';
  const { goal, almost } = goalRubric(settings);
  if (countMatching(goal, rows) >= goal.target) return 'met';
  if (!closed) return 'open';
  return almost && countMatching(almost, rows) >= almost.target ? 'almost' : 'miss';
}
export function progression(state, id, range, now = dateKey()) {
  const habit = state.habits[id];
  const step = habit.period === 'week' ? 7 : 1;
  const current = periodKey(habit, now);
  const groups = new Map();
  for (const row of state.records) {
    if (row.habit !== id || row.date > now || (row.skip && row.period !== habit.period)) continue;
    const key = periodKey(habit, row.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const start = periodKey(habit, [...groups.keys(), habit.start ?? state.start].sort()[0]);
  let { start: level } = range;
  let streak = 0;
  for (let date = start; date <= current; date = shift(date, step)) {
    const closed = shift(date, step) <= now;
    const result = outcome(settingsAt(state, id, date), groups.get(date) ?? [], closed);
    if (result === 'met') {
      level = Math.min(range.max, level + 1);
      streak++;
    } else if (result === 'almost' || result === 'miss') {
      level = result === 'almost' ? Math.max(0, level - 1) : Math.floor(level / 2);
      streak = 0;
    }
  }
  return { level, streak };
}
export function sceneState(state, now = new Date()) {
  const date = dateKey(now);
  return {
    ...Object.fromEntries(Object.entries(effects).map(([effect, range]) => {
      const id = state.assignments[effect];
      return [effect, state.habits[id] ? progression(state, id, range, date).level : range.start];
    })),
    night: now.getHours() < 6 || now.getHours() >= 19,
  };
}

export function materialize(operations, today = dateKey()) {
  const definitions = { ...habits };
  const records = new Map();
  const settings = new Map();
  const rewards = new Set();
  const assignments = { ...defaultAssignments };
  let start = today;
  for (const op of [...operations].sort((a, b) => a.updated.localeCompare(b.updated) || a.id.localeCompare(b.id))) {
    start = [start, op.start].sort()[0];
    for (const { id, ...definition } of op.habits ?? []) {
      if (definition.type === 'integer') definition.type = 'number';
      definitions[id] = { ...definitions[id], ...definition };
    }
    for (const row of op.records ?? []) {
      if (row.deleted) records.delete(row.id);
      else if (row.skip) {
        records.set(row.id, { ...row, period: row.period ?? definitions[row.habit].period });
      } else {
        const valueType = row.valueType ?? legacyValueTypes[row.habit] ?? definitions[row.habit]?.type;
        const valueUnit = row.valueUnit ?? (row.habit === 'sleep' && valueType === 'integer' ? 'minutes' : valueUnits[valueType]);
        records.set(row.id, { ...row, valueType, valueUnit });
      }
    }
    for (const row of op.settings ?? []) {
      const habit = definitions[row.habit];
      // Older journals stored the bedtime deadline or sleep duration in the goal field.
      let frequency = row;
      if (!row.frequency && row.habit === 'sleep') frequency = { ...row, goal: habit.goal, near: habit.near };
      if (!row.frequency && row.habit === 'bedtime' && typeof row.goal === 'string') {
        const grace = (clockMinutes(row.goal) + Number(row.near ?? 30)) % 1440;
        const time = [Math.floor(grace / 60), grace % 60].map(part => String(part).padStart(2, '0')).join(':');
        frequency = { ...row, goal: habit.goal, near: habit.near, deadline: row.goal, grace: time };
      }
      const period = row.period ?? habit.period;
      settings.set(row.habit + ':' + period + ':' + row.date, { ...frequency, period });
    }
    Object.assign(assignments, op.assignments);
    if (op.reward) rewards.add(op.reward);
  }
  return { start, habits: definitions, records: [...records.values()], settings: [...settings.values()], assignments, rewards };
}

export function rowsFor(state, id, date) {
  const habit = state.habits[id];
  const period = periodKey(habit, date);
  return state.records.filter(row => row.habit === id && (!row.skip || row.period === habit.period) && periodKey(habit, row.date) === period);
}
