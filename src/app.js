import { defaultSettings, habitCategories, materialize, rowsFor, sceneState, shift } from './habit-engine/index.js';
import { createHabitEditor, showDialog } from './habit-edit-reporting/editor.js';
import { renderCheckIns } from './habit-edit-reporting/check-ins.js';
import { esc, labelDate, today } from './habit-edit-reporting/format.js';
import { historyPageSize, renderHistory } from './habit-edit-reporting/history.js';
import { renderTrends, sampleCheckInJournal, trendRanges } from './habit-edit-reporting/history-charts.js';
import { habitDialog, renderSettings, submitSettings } from './habit-edit-reporting/settings.js';
import { createPetPanel } from './pet-display/web/panel.js';
import { cacheGoogleConnection, connectGoogle, googleSession, restoreGoogleConnection, sheetsExportVersion } from './integrations/google.js';

const main = document.querySelector('#main');
const footer = document.querySelector('#sync');
const editor = document.querySelector('#editor');
const notice = document.querySelector('#notice');
const prefix = 'habit-tamagotchi:';
const petKey = prefix + 'pet';
let petChoice = localStorage.getItem(petKey) === 'hedgehog' ? 'hedgehog' : 'pig';
let account = 'guest';
let email = '';
let session;
let googleConnection;
let expirationTimer;
let sheetId;
let verifiedSheetId;
let syncStatus = '';
let syncing = false;
let syncTimer;
let undo;
let historicalDate = today();
let visibleHistoryCount = historyPageSize;
let checkInCategory = 'health';
let historyCategory = 'all';
let trendCategory = 'all';
let trendWeeks = trendRanges[0];
let testMode = false;
let testOperations;
let testDate = today();
let scene;
let state;

function key(suffix) { return prefix + account + ':' + suffix; }
function checkInsAvailable() { return Boolean(session) || testMode; }
function selectedHistoryDate() { return testMode ? testDate : historicalDate; }
function googleClientId() {
  return document.querySelector('meta[name=google-client-id]').content || localStorage.getItem(prefix + 'client');
}
function setGoogleConnection(connection) {
  clearTimeout(expirationTimer);
  googleConnection = connection;
  account = connection ? 'google:' + connection.sub : 'guest';
  email = connection?.email ?? '';
  sheetId = connection?.sheetId;
  verifiedSheetId = undefined;
  session = connection?.token ? googleSession(connection.token) : undefined;
  cacheGoogleConnection(connection);
  if (session) expirationTimer = setTimeout(expireGoogleConnection, Math.max(0, connection.expiresAt - Date.now()));
}
function expireGoogleConnection() {
  if (!session) return;
  const { token, ...profile } = googleConnection;
  setGoogleConnection(profile);
  if (!testMode && editor.open) editor.close();
  reload();
  render();
}
function operations() {
  const stem = key('op:');
  return Object.keys(localStorage).filter(name => name.startsWith(stem))
    .map(name => JSON.parse(localStorage.getItem(name))).filter(Boolean);
}
function reload() {
  state = materialize(testMode ? testOperations : operations());
  scene = sceneState(checkInsAvailable() ? state : materialize([]));
}
function save(fields, inverse) {
  if (fields.records && !checkInsAvailable()) throw new Error('Connect Google or load test data to save check-ins.');
  const id = crypto.randomUUID();
  const op = { id, updated: new Date().toISOString(), start: state.start, ...fields };
  if (testMode) testOperations.push(op);
  else {
    localStorage.setItem(key('op:' + id), JSON.stringify(op));
    localStorage.setItem(key('dirty'), 'true');
  }
  undo = inverse;
  reload();
  render();
  if (!testMode) queueSync();
}
function say(message) {
  notice.replaceChildren(document.createTextNode(message));
  if (undo) {
    const button = document.createElement('button');
    button.dataset.action = 'undo';
    button.textContent = 'Undo';
    notice.append(' ', button);
  }
}
function queueSync() {
  clearTimeout(syncTimer);
  if (session) syncTimer = setTimeout(synchronize, 650);
  renderStatus();
}
function renderStatus() {
  const testToggle = '<button type="button" class="link muted test-data-toggle" data-action="toggle-test-data">' +
    (testMode ? 'Exit test data' : 'Load test data') + '</button>';
  if (testMode) {
    footer.innerHTML = '<span>Test data · changes stay in this preview</span>' + testToggle;
    return;
  }
  const pending = localStorage.getItem(key('dirty'));
  let message = '';
  if (session) message = syncStatus || (pending ? 'Changes waiting to sync' : 'Synced to Google');
  else if (account !== 'guest') message = 'Google session expired · reconnect to sync this profile';
  footer.innerHTML = (message ? '<span>' + esc(message) + '</span>' : '') +
    (sheetId ? ' <a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) + '/edit">Open spreadsheet</a>' : '') +
    (session ? ' <button class="link" data-action="retry">Sync now</button>' :
      account !== 'guest' ? ' <button class="link" data-action="google">Reconnect Google</button>' : '') + testToggle;
}
async function synchronize() {
  if (!session || syncing) return;
  if (googleConnection.expiresAt <= Date.now()) {
    expireGoogleConnection();
    return;
  }
  syncing = true;
  const currentSession = session;
  syncStatus = 'Syncing…';
  renderStatus();
  async function run() {
    const journal = await currentSession.journal();
    const known = new Map(operations().map(op => [op.id, op]));
    const missing = [...journal].filter(([id]) => !known.has(id));
    for (let i = 0; i < missing.length; i += 8) {
      await Promise.all(missing.slice(i, i + 8).map(async ([id, file]) => {
        const op = await currentSession.download(file);
        if (op.id !== id) throw new Error('A Google app record did not match its ID.');
        localStorage.setItem(key('op:' + id), JSON.stringify(op));
      }));
    }
    const snapshot = operations();
    for (const op of snapshot) {
      if (!journal.has(op.id)) await currentSession.append(op,
        id => localStorage.getItem(key('drive:' + id)),
        (id, file) => localStorage.setItem(key('drive:' + id), file));
    }
    verifiedSheetId ||= await currentSession.spreadsheet();
    sheetId = verifiedSheetId;
    googleConnection.sheetId = sheetId;
    cacheGoogleConnection(googleConnection);
    const exportVersion = localStorage.getItem(key('sheets-export-version'));
    if (exportVersion !== sheetsExportVersion || missing.length || snapshot.some(op => !journal.has(op.id)) || localStorage.getItem(key('dirty'))) {
      const exportState = materialize(snapshot);
      exportState.settings = [
        ...Object.entries(exportState.habits).map(([id, habit]) => ({
          habit: id, period: habit.period, date: habit.start ?? '0000-01-01', ...defaultSettings(id, habit),
        })),
        ...exportState.settings,
      ];
      await currentSession.publish(sheetId, exportState);
      localStorage.setItem(key('sheets-export-version'), sheetsExportVersion);
    }
    if (operations().length === snapshot.length) localStorage.removeItem(key('dirty'));
    syncStatus = '';
    reload();
    if (editor.open || main.contains(document.activeElement) && document.activeElement.matches('input, select')) renderStatus();
    else render();
  }
  try {
    if (navigator.locks) await navigator.locks.request(key('sync'), run);
    else await run();
    if (localStorage.getItem(key('dirty'))) queueSync();
  } catch (error) {
    if (error.status === 401) expireGoogleConnection();
    else {
      syncStatus = 'Sync paused · ' + error.message;
      renderStatus();
    }
  } finally {
    syncing = false;
  }
}
function signIn() {
  if (syncing) return;
  const clientId = googleClientId();
  if (!clientId) {
    openDialog('Connect Google', '<p>Enter the Web OAuth client ID for this installation. Local and Google profiles have separate histories.</p>' +
      '<label>OAuth client ID<input name="client" required pattern="[A-Za-z0-9.-]+[.]apps[.]googleusercontent[.]com"></label>', form => {
      localStorage.setItem(prefix + 'client', form.get('client'));
      signIn();
    }, 'Connect');
    return;
  }
  connectGoogle(clientId).then(async authorization => {
    const connected = googleSession(authorization.token);
    const profile = await connected.profile();
    if (syncing) return;
    if (!profile.sub) throw new Error('Google did not return an account ID.');
    const previousSheet = googleConnection?.sub === profile.sub ? sheetId : undefined;
    setGoogleConnection({ ...authorization, clientId, sub: profile.sub, email: profile.email ?? 'Google account', sheetId: previousSheet });
    testMode = false;
    syncStatus = '';
    undo = undefined;
    notice.replaceChildren();
    reload();
    localStorage.setItem(key('dirty'), 'true');
    render();
    await synchronize();
  }).catch(error => say(error.message));
}
function disconnect() {
  if (syncing) return say('Google sync is in progress.');
  setGoogleConnection();
  syncStatus = '';
  undo = undefined;
  notice.replaceChildren();
  reload();
  render();
}

const openDialog = (title, body, submit, button) => showDialog(editor, title, body, submit, button);
const pet = createPetPanel(main, () => ({ ...scene, pet: petChoice }));
const { log, logDialog, removeRow, skipPeriod } = createHabitEditor({
  readState: () => state,
  save,
  say,
  showDialog: openDialog,
  playReward: pet.playReward,
});

function home(previousCanvas) {
  main.append(document.querySelector('#home').content.cloneNode(true));
  main.querySelector('#today-date').textContent = labelDate(today());
  const google = main.querySelector('[data-action=google]');
  if (session) {
    google.textContent = 'Google connected';
    google.dataset.action = 'settings';
  } else if (googleConnection) {
    google.textContent = 'Reconnect Google';
  }
  pet.render(previousCanvas);
  if (checkInsAvailable()) renderCheckIns(main.querySelector('#cards'), state, checkInCategory);
  else {
    const checkIns = main.querySelector('.checkins');
    checkIns.removeAttribute('aria-labelledby');
    checkIns.innerHTML = '<p class="panel empty">Connect Google to see and log your check-ins.</p>';
  }
}

function connectPrompt(message) {
  return '<section class="panel padded"><p>' + message + '</p><button type="button" class="soft" data-action="google">' +
    (googleConnection ? 'Reconnect Google' : 'Connect Google') + '</button></section>';
}

function selectCheckInCategory(category) {
  if (!checkInsAvailable() || !Object.hasOwn(habitCategories, category)) return;
  checkInCategory = category;
  const cards = main.querySelector('#cards');
  renderCheckIns(cards, state, checkInCategory);
  cards.querySelector('[aria-selected="true"]').focus({ preventScroll: true });
}

function render() {
  const previousCanvas = main.querySelector('canvas');
  main.replaceChildren();
  const page = ['#history', '#trends', '#settings'].includes(location.hash) ? location.hash : '#home';
  document.querySelectorAll('nav a').forEach(a => {
    if (a.hash === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (!checkInsAvailable() && (page === '#history' || page === '#trends')) {
    const title = page === '#history' ? 'History' : 'Trends';
    main.innerHTML = '<header class="intro"><h1>' + title + '<span>.</span></h1></header>' +
      connectPrompt('Connect Google to see your ' + title.toLowerCase() + '.');
  } else if (page === '#history') renderHistory(main, state, visibleHistoryCount, historyCategory);
  else if (page === '#trends') {
    renderTrends(main, state, trendWeeks, selectedHistoryDate(), trendCategory);
    for (const heatmap of main.querySelectorAll('.heatmap-scroll')) {
      const activeDay = heatmap.querySelector('[tabindex="0"]');
      if (activeDay) heatmap.scrollLeft = Math.max(0, activeDay.offsetLeft - heatmap.clientWidth + 24);
    }
  }
  else if (page === '#settings') renderSettings(main, state, Boolean(session), email, petChoice);
  else home(previousCanvas);
  if (testMode) main.querySelector('.intro')?.insertAdjacentHTML('afterend', '<p class="test-data-status">Test mode · sample check-ins</p>');
  renderStatus();
}

function chooseHistoryDay(date, row) {
  const habitId = row.dataset.trendHabit;
  const scrollLeft = row.querySelector('.heatmap-scroll').scrollLeft;
  if (testMode) testDate = date;
  else historicalDate = date;
  render();
  const updatedRow = [...main.querySelectorAll('.trend-row')].find(trend => trend.dataset.trendHabit === habitId);
  updatedRow.querySelector('.heatmap-scroll').scrollLeft = scrollLeft;
  const cell = updatedRow.querySelector('[data-action="history-day"][aria-pressed="true"]');
  cell?.focus({ preventScroll: true });
  cell?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, habit: id, id: recordId } = target.dataset;
  const date = id ? today() : undefined;
  const record = recordId ? state.records.find(row => row.id === recordId) : undefined;
  try {
    switch (action) {
      case 'google': signIn(); break;
      case 'disconnect': disconnect(); break;
      case 'add-habit': habitDialog(state, openDialog, save, say); break;
      case 'edit-habit': habitDialog(state, openDialog, save, say, id); break;
      case 'settings': location.hash = 'settings'; break;
      case 'retry': synchronize(); break;
      case 'cancel': editor.close(); break;
      case 'check-in-category': selectCheckInCategory(target.dataset.category); break;
      case 'quick': log(id, date, { value: 1 }, undefined, true); break;
      case 'log': logDialog(id, date, undefined, true); break;
      case 'backfill': logDialog(id, selectedHistoryDate(), undefined, false); break;
      case 'edit': if (record) logDialog(record.habit, record.date, record, false); break;
      case 'history-day': chooseHistoryDay(target.dataset.date, target.closest('.trend-row')); break;
      case 'older-check-ins': {
        const firstOlderIndex = visibleHistoryCount;
        visibleHistoryCount += historyPageSize;
        render();
        main.querySelectorAll('.history-list article')[firstOlderIndex]?.querySelector('button')?.focus();
        break;
      }
      case 'toggle-test-data':
        testMode = !testMode;
        if (testMode && !testOperations) testOperations = [sampleCheckInJournal(materialize([]))];
        visibleHistoryCount = historyPageSize;
        undo = undefined;
        notice.replaceChildren();
        reload();
        render();
        footer.querySelector('.test-data-toggle').focus({ preventScroll: true });
        break;
      case 'skip': skipPeriod(id, date); break;
      case 'skip-history': skipPeriod(id, selectedHistoryDate()); break;
      case 'resume': removeRow(rowsFor(state, id, date).find(row => row.skip)); break;
      case 'remove': removeRow(record); break;
      case 'preview': pet.play(0); break;
      case 'undo':
        if (undo) {
          save(undo);
          say('Change undone.');
        }
        break;
    }
  } catch (error) {
    say(error.message);
  }
});
main.addEventListener('change', event => {
  const { id, value, validity } = event.target;
  if (id === 'pet-choice' && (value === 'pig' || value === 'hedgehog')) {
    petChoice = value;
    localStorage.setItem(petKey, petChoice);
    return;
  }
  if (id === 'history-date' && value && validity.valid) {
    if (testMode) testDate = value;
    else historicalDate = value;
  }
  else if (id === 'history-category') {
    historyCategory = value;
    visibleHistoryCount = historyPageSize;
  }
  else if (id === 'trend-category') trendCategory = value;
  else if (id === 'trend-range' && trendRanges.includes(Number(value))) trendWeeks = Number(value);
  else return;
  render();
  document.getElementById(id)?.focus({ preventScroll: true });
});
main.addEventListener('keydown', event => {
  if (event.target.dataset.action === 'check-in-category') {
    const categories = Object.keys(habitCategories);
    const index = categories.indexOf(checkInCategory);
    const options = {
      ArrowLeft: categories[(index + categories.length - 1) % categories.length],
      ArrowRight: categories[(index + 1) % categories.length],
      Home: categories[0],
      End: categories.at(-1),
    };
    if (!Object.hasOwn(options, event.key)) return;
    event.preventDefault();
    selectCheckInCategory(options[event.key]);
    return;
  }
  if (event.target.dataset.action !== 'history-day') return;
  const offsets = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };
  if (!Object.hasOwn(offsets, event.key)) return;
  event.preventDefault();
  const date = shift(event.target.dataset.date, offsets[event.key]);
  const row = event.target.closest('.trend-row');
  if (row.querySelector('[data-action="history-day"][data-date="' + date + '"]')) chooseHistoryDay(date, row);
});
main.addEventListener('submit', event => submitSettings(event, save, say));
addEventListener('hashchange', () => {
  pet.reset();
  render();
});
addEventListener('storage', event => {
  if (event.key?.startsWith(key('op:'))) {
    reload();
    if (!editor.open && !main.contains(document.activeElement)) render();
  }
});
addEventListener('online', queueSync);
let lastDate = today();
setInterval(() => {
  if (checkInsAvailable()) scene = sceneState(state);
  if (lastDate !== today()) {
    lastDate = today();
    reload();
    if (!editor.open && !main.contains(document.activeElement)) render();
  }
}, 30000);
setGoogleConnection(restoreGoogleConnection(googleClientId()));
reload();
render();
