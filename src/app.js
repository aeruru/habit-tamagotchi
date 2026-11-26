import { habits, defaultSettings, materialize, rowsFor, sceneState } from './habit-engine/index.js';
import { createHabitEditor, showDialog } from './habit-edit-reporting/editor.js';
import { renderCheckIns } from './habit-edit-reporting/check-ins.js';
import { esc, forToday, labelDate, today } from './habit-edit-reporting/format.js';
import { renderHistory } from './habit-edit-reporting/history.js';
import { renderSettings, submitSettings } from './habit-edit-reporting/settings.js';
import { createPetPanel } from './pet-display/web/panel.js';
import { connectGoogle, googleSession } from './integrations/google.js';

const main = document.querySelector('#main');
const footer = document.querySelector('#sync');
const editor = document.querySelector('#editor');
const notice = document.querySelector('#notice');
const prefix = 'habit-tamagotchi:';
const habitEntries = Object.entries(habits);
let account = 'guest';
let email = '';
let session;
let sheetId;
let syncStatus = '';
let syncing = false;
let syncTimer;
let undo;
let historicalDate = today();
let scene;
let state;

function key(suffix) { return prefix + account + ':' + suffix; }
function operations() {
  const stem = key('op:');
  return Object.keys(localStorage).filter(name => name.startsWith(stem))
    .map(name => JSON.parse(localStorage.getItem(name))).filter(Boolean);
}
function reload() {
  state = materialize(operations());
  scene = sceneState(state);
}
function save(fields, inverse) {
  const id = crypto.randomUUID();
  const op = { id, updated: new Date().toISOString(), start: state.start, ...fields };
  localStorage.setItem(key('op:' + id), JSON.stringify(op));
  localStorage.setItem(key('dirty'), 'true');
  undo = inverse;
  reload();
  render();
  queueSync();
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
  const pending = localStorage.getItem(key('dirty'));
  let message = 'Local profile · saved on this device';
  if (session) message = syncStatus || (pending ? 'Changes waiting to sync' : 'Synced to Google');
  else if (account !== 'guest') message = 'Google disconnected · reconnect to sync this profile';
  footer.innerHTML = '<span>' + esc(message) + '</span>' +
    (sheetId ? ' <a target="_blank" rel="noopener" href="https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) + '/edit">Open spreadsheet</a>' : '') +
    (session ? ' <button class="link" data-action="retry">Sync now</button>' : '');
}
async function synchronize() {
  if (!session || syncing) return;
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
    sheetId ||= await currentSession.spreadsheet();
    if (missing.length || snapshot.some(op => !journal.has(op.id)) || localStorage.getItem(key('dirty'))) {
      const exportState = materialize(snapshot);
      exportState.settings = [
        ...habitEntries.map(([id]) => ({ habit: id, date: '0000-01-01', ...defaultSettings(id) })),
        ...exportState.settings,
      ];
      await currentSession.publish(sheetId, exportState);
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
    syncStatus = 'Sync paused · ' + error.message;
    renderStatus();
  } finally {
    syncing = false;
  }
}
function signIn() {
  if (syncing) return;
  const clientId = document.querySelector('meta[name=google-client-id]').content || localStorage.getItem(prefix + 'client');
  if (!clientId) {
    openDialog('Connect Google', '<p>Enter the Web OAuth client ID for this installation. Local and Google profiles have separate histories.</p>' +
      '<label>OAuth client ID<input name="client" required pattern="[A-Za-z0-9.-]+[.]apps[.]googleusercontent[.]com"></label>', form => {
      localStorage.setItem(prefix + 'client', form.get('client'));
      signIn();
    }, 'Connect');
    return;
  }
  connectGoogle(clientId).then(async token => {
    const connected = googleSession(token);
    const profile = await connected.profile();
    if (syncing) return;
    session = connected;
    account = 'google:' + profile.sub;
    email = profile.email ?? 'Google account';
    sheetId = undefined;
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
  session = undefined;
  sheetId = undefined;
  syncStatus = '';
  email = '';
  account = 'guest';
  undo = undefined;
  notice.replaceChildren();
  reload();
  render();
}

const openDialog = (title, body, submit, button) => showDialog(editor, title, body, submit, button);
const pet = createPetPanel(main, () => scene);
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
  }
  pet.render(previousCanvas);
  renderCheckIns(main.querySelector('#cards'), state);
}

function render() {
  const previousCanvas = main.querySelector('canvas');
  main.replaceChildren();
  const page = ['#history', '#settings'].includes(location.hash) ? location.hash : '#home';
  document.querySelectorAll('nav a').forEach(a => {
    if (a.hash === page) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (page === '#history') renderHistory(main, state, historicalDate);
  else if (page === '#settings') renderSettings(main, state, Boolean(session), email);
  else home(previousCanvas);
  renderStatus();
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const { action, habit: id, id: recordId } = target.dataset;
  const date = id ? forToday(habits[id]) : undefined;
  const record = recordId ? state.records.find(row => row.id === recordId) : undefined;
  try {
    switch (action) {
      case 'google': signIn(); break;
      case 'disconnect': disconnect(); break;
      case 'settings': location.hash = 'settings'; break;
      case 'retry': synchronize(); break;
      case 'cancel': editor.close(); break;
      case 'quick': log(id, date, { value: 1 }, null, true); break;
      case 'log': logDialog(id, date, undefined, true); break;
      case 'backfill': logDialog(id, historicalDate, undefined, false); break;
      case 'edit': if (record) logDialog(record.habit, record.date, record, false); break;
      case 'skip': skipPeriod(id, date); break;
      case 'skip-history': skipPeriod(id, historicalDate); break;
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
  if (event.target.id === 'history-date' && event.target.value && event.target.validity.valid) {
    historicalDate = event.target.value;
    render();
  }
});
main.addEventListener('submit', event => submitSettings(event, state, main, save, say));
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
  scene = sceneState(state);
  if (lastDate !== today()) {
    lastDate = today();
    reload();
    if (!editor.open && !main.contains(document.activeElement)) render();
  }
}, 30000);
reload();
render();
