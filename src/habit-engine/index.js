export const habits = {
  bedtime: { name: 'On-time bedtime', icon: '☾', type: 'clock', period: 'day', unit: 'local time', goal: '23:00', near: 30, sleep: true },
  sleep: { name: 'Enough sleep', icon: '✦', type: 'duration', period: 'day', unit: 'hours', goal: 8, near: 7, sleep: true },
  exercise: { name: 'Exercise', icon: '◇', type: 'event', period: 'week', aggregation: 'dates', unit: 'days', goal: 3, near: 2 },
  hunger: { name: 'Hunger before meals', icon: '♧', type: 'rating', period: 'day', unit: 'rating 1–5', goal: 3, near: 2, loggingOnly: true },
  walks: { name: 'Post-meal walks', icon: '↟', type: 'event', period: 'day', unit: 'walks', goal: 2, near: 1 },
};
export const effects = {
  weather: { start: 3, max: 6 }, mood: { start: 4, max: 7 }, hut: { start: 2, max: 7 },
};
export const defaultAssignments = { weather: 'bedtime', mood: 'sleep', hut: 'exercise' };
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

export function defaultSettings(id) {
  const { goal, near, loggingOnly = false } = habits[id];
  return { enabled: true, goal, near, loggingOnly, treat: id === 'walks' };
}
export function settingsAt(state, id, date) {
  return state.settings.filter(row => row.habit === id && row.date <= date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.updated.localeCompare(a.updated))[0] ?? defaultSettings(id);
}
function minutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  // Use noon as the start of the bedtime clock, so 00:30 follows 23:30.
  return (hours * 60 + minutes + 720) % 1440;
}
export function measure(habit, rows) {
  const logs = rows.filter(row => !row.skip);
  if (habit.sleep) return logs[0]?.value;
  if (habit.aggregation === 'dates') return new Set(logs.map(row => row.date)).size;
  return logs.length;
}
export function outcome(habit, settings, rows, closed) {
  if (rows.some(row => row.skip)) return 'skip';
  if (!settings.enabled || settings.loggingOnly) return 'inactive';
  const value = measure(habit, rows);
  if (habit.type === 'clock') {
    if (value === undefined) return closed ? 'almost' : 'open';
    const late = minutes(value) - minutes(settings.goal);
    return late <= 0 ? 'met' : closed ? (late <= 30 ? 'almost' : 'miss') : 'open';
  }
  if (value !== undefined && value >= settings.goal) return 'met';
  if (!closed) return 'open';
  return value !== undefined && value >= settings.near ? 'almost' : 'miss';
}
export function progression(state, id, range, now = dateKey()) {
  const habit = habits[id];
  const step = habit.period === 'week' ? 7 : 1;
  const current = periodKey(habit, now);
  const groups = new Map();
  for (const row of state.records) {
    if (row.habit !== id) continue;
    const key = periodKey(habit, row.date);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const start = periodKey(habit, [...groups.keys(), state.start].sort()[0]);
  let { start: level } = range;
  let streak = 0;
  for (let date = start; date <= current; date = shift(date, step)) {
    const closed = shift(date, step + Number(Boolean(habit.sleep))) <= now;
    const result = outcome(habit, settingsAt(state, id, date), groups.get(date) ?? [], closed);
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
      return [effect, id ? progression(state, id, range, date).level : range.start];
    })),
    night: now.getHours() < 6 || now.getHours() >= 19,
  };
}

export function materialize(operations, today = dateKey()) {
  const records = new Map();
  const settings = new Map();
  const rewards = new Set();
  const assignments = { ...defaultAssignments };
  let start = shift(today, -1);
  for (const op of [...operations].sort((a, b) => a.updated.localeCompare(b.updated) || a.id.localeCompare(b.id))) {
    start = [start, op.start].sort()[0];
    for (const row of op.records ?? []) {
      if (row.deleted) records.delete(row.id);
      else records.set(row.id, row);
    }
    for (const row of op.settings ?? []) settings.set(row.habit + ':' + row.date, row);
    Object.assign(assignments, op.assignments);
    if (op.reward) rewards.add(op.reward);
  }
  return { start, records: [...records.values()], settings: [...settings.values()], assignments, rewards };
}

export function rowsFor(state, id, date) {
  const habit = habits[id];
  return state.records.filter(row => row.habit === id && periodKey(habit, row.date) === periodKey(habit, date));
}
