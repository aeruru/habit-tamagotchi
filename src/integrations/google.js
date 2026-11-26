import { habits, periodKey } from '../habit-engine/index.js';

const drive = 'https://www.googleapis.com/drive/v3';
const upload = 'https://www.googleapis.com/upload/drive/v3';
const sheets = 'https://sheets.googleapis.com/v4/spreadsheets';
const tag = 'habitTamagotchiV1';
const scopes = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.appdata'];

async function requestError(response, operation, service) {
  const payload = await response.json().catch(() => undefined);
  const details = payload?.error;
  const reason = details?.details?.find(detail => detail?.['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo')?.reason
    ?? details?.errors?.[0]?.reason;
  const reasonLabel = typeof reason === 'string' && /^[a-zA-Z][a-zA-Z0-9_]{0,79}$/.test(reason) ? ' · ' + reason : '';
  let hint = '';
  if (response.status === 401 || reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' || reason === 'insufficientPermissions') {
    hint = ' Reconnect Google and grant the requested permissions.';
  } else if (reason === 'SERVICE_DISABLED' || reason === 'accessNotConfigured') {
    hint = ' Enable the ' + service + ' in the Google Cloud project that owns your OAuth client ID, then retry.';
  } else if (reason === 'domainPolicy') {
    hint = ' Your Google Workspace administrator needs to allow this app to access Drive.';
  }
  const error = new Error(operation + ' failed (HTTP ' + response.status + reasonLabel + ').' + hint);
  error.status = response.status;
  return error;
}

export function connectGoogle(clientId) {
  return new Promise((resolve, reject) => {
    const oauth = globalThis.google?.accounts?.oauth2;
    if (!oauth) return reject(new Error('Google sign-in is unavailable. Try again online.'));
    oauth.initTokenClient({
      client_id: clientId,
      scope: scopes.join(' '),
      callback(response) {
        if (response.error || !oauth.hasGrantedAllScopes(response, ...scopes)) {
          reject(new Error('Google sign-in needs access to the app spreadsheet and app data.'));
        } else resolve(response.access_token);
      },
      error_callback: () => reject(new Error('The Google sign-in window closed or could not open.')),
    }).requestAccessToken({ prompt: 'select_account' });
  });
}

export function googleSession(token) {
  async function api(operation, url, method = 'GET', body, contentType = 'application/json') {
    const response = await fetch(url, {
      method,
      headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': contentType }) },
      body: body && (typeof body === 'string' ? body : JSON.stringify(body)),
    });
    if (!response.ok) {
      const service = url.startsWith(sheets) ? 'Google Sheets API' : 'Google Drive API';
      throw await requestError(response, operation, service);
    }
    return response.status === 204 ? undefined : response.json();
  }
  async function list(operation, query) {
    const files = [];
    let pageToken;
    do {
      const params = new URLSearchParams({ ...query, fields: 'nextPageToken,files(id,name)', pageSize: '1000' });
      if (pageToken) params.set('pageToken', pageToken);
      const page = await api(operation, drive + '/files?' + params);
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }
  async function spreadsheet() {
    const files = await list('Find the habit spreadsheet', { q: "trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and appProperties has { key='" + tag + "' and value='true' }" });
    if (files.length) return files.sort((a, b) => a.id.localeCompare(b.id))[0].id;
    const file = await api('Create the habit spreadsheet', drive + '/files', 'POST', {
      name: 'Habit Tamagotchi', mimeType: 'application/vnd.google-apps.spreadsheet', appProperties: { [tag]: 'true' },
    });
    return file.id;
  }
  async function journal() {
    return new Map((await list('List private app data', {
      spaces: 'appDataFolder', q: "appProperties has { key='" + tag + "' and value='operation' }",
    })).map(row => [row.name, row.id]));
  }
  async function append(op, lookupId, rememberId) {
    let id = lookupId(op.id);
    if (!id) {
      const generated = await api('Reserve an app data file ID', drive + '/files/generateIds?count=1&space=appDataFolder');
      id = generated.ids[0];
      rememberId(op.id, id);
    }
    const boundary = 'habit_' + op.id;
    const metadata = { id, name: op.id, parents: ['appDataFolder'], mimeType: 'application/json', appProperties: { [tag]: 'operation' } };
    const body = [JSON.stringify(metadata), JSON.stringify(op)].map(part =>
      '--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + part + '\r\n'
    ).join('') + '--' + boundary + '--';
    try {
      await api('Upload a habit change', upload + '/files?uploadType=multipart', 'POST', body, 'multipart/related; boundary=' + boundary);
    } catch (error) {
      if (error.status !== 409) throw error;
    }
  }

  async function publish(id, state) {
    const url = sheets + '/' + encodeURIComponent(id);
    const current = await api('Read spreadsheet tabs', url + '?fields=sheets(properties)');
    const tabs = {
      'Habit records': [
        ['Record ID', 'Habit ID', 'Local date', 'Period start', 'Value', 'Unit', 'Meal', 'Skipped', 'Updated'],
        ...state.records.sort((a, b) => a.date.localeCompare(b.date)).map(row => [
          row.id, row.habit, row.date, periodKey(habits[row.habit], row.date), row.value ?? '',
          habits[row.habit].unit, row.meal ?? '', row.skip, row.updated,
        ]),
      ],
      'Habit settings': [
        ['Habit ID', 'Effective date', 'Enabled', 'Goal', 'Almost goal', 'Logging only', 'Treat', 'Updated'],
        ...state.settings.map(row => [row.habit, row.date, row.enabled, row.goal, row.near, row.loggingOnly, row.treat, row.updated]),
      ],
      'Pet settings': [['Effect', 'Habit ID'], ...Object.entries(state.assignments)],
    };
    const requests = [];
    for (const [title, values] of Object.entries(tabs)) {
      const tab = current.sheets.find(sheet => sheet.properties.title === title)?.properties;
      let sheetId = tab?.sheetId;
      const rowCount = Math.max(tab?.gridProperties.rowCount ?? 1000, values.length + 50);
      const columnCount = Math.max(tab?.gridProperties.columnCount ?? 12, values[0].length);
      const gridProperties = { rowCount, columnCount, frozenRowCount: 1 };
      if (!tab) {
        do sheetId = crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
        while (!sheetId || current.sheets.some(sheet => sheet.properties.sheetId === sheetId)
          || requests.some(request => request.addSheet?.properties.sheetId === sheetId));
        requests.push({ addSheet: { properties: { sheetId, title, gridProperties } } });
      } else if (rowCount !== tab.gridProperties.rowCount || columnCount !== tab.gridProperties.columnCount) {
        requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties }, fields: 'gridProperties' } });
      }
      const rows = values.map(row => ({ values: row.map(value => ({
        userEnteredValue: typeof value === 'number' ? { numberValue: value } :
          typeof value === 'boolean' ? { boolValue: value } : { stringValue: String(value ?? '') },
      })) }));
      requests.push({ updateCells: { range: { sheetId, endColumnIndex: values[0].length }, rows, fields: 'userEnteredValue' } });
    }
    await api('Update spreadsheet tabs', url + ':batchUpdate', 'POST', { requests });
  }
  return {
    profile: () => api('Read Google account profile', 'https://openidconnect.googleapis.com/v1/userinfo'),
    spreadsheet, journal, append, publish,
    download: id => api('Download a habit change', drive + '/files/' + encodeURIComponent(id) + '?alt=media'),
  };
}
