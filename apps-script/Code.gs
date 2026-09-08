/**
 * HANEUL.LOG Google Apps Script authentication API.
 * Run setupAuth() once, then deploy this project as a web app.
 */
const AUTH_CONFIG = Object.freeze({
  spreadsheetId: '1yfbZVEL_iVMqkXIQVVgY7e8mmwXg7bm2o1mR1ZvwnXk',
  usersSheet: 'users',
  sessionsSheet: 'sessions',
  sessionHours: 24,
  rememberedDays: 30,
  hashRounds: 10000,
  loginLimit: 10,
  rateWindowSeconds: 600
});

const USER_HEADERS = [
  'userId', 'email', 'name', 'passwordHash', 'salt',
  'status', 'createdAt', 'updatedAt', 'lastLoginAt'
];
const SESSION_HEADERS = [
  'sessionId', 'userId', 'tokenHash',
  'createdAt', 'expiresAt', 'revokedAt'
];

// Run this manually once before deployment.
function setupAuth() {
  ensureAuthReady_();
  return { ok: true, message: '인증 설정이 완료되었습니다.' };
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : 'health';
  if (action === 'diagnostic') {
    try {
      ensureAuthReady_();
      return json_({
        ok: true,
        ready: true,
        message: '인증 저장소를 사용할 수 있습니다.'
      });
    } catch (error) {
      console.error(error && error.stack ? error.stack : error);
      return json_({
        ok: false,
        ready: false,
        code: error.publicCode || 'AUTH_SETUP_FAILED',
        message: error.publicMessage || '인증 저장소를 준비하지 못했습니다.'
      });
    }
  }
  if (action !== 'health') {
    return json_({
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      message: '인증 요청은 POST 방식을 사용해 주세요.'
    });
  }
  return json_({
    ok: true,
    service: 'HANEUL.LOG Auth API',
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    ensureAuthReady_();
    const request = request_(e);
    switch (String(request.action || '').toLowerCase()) {
      case 'signup':
        return json_(signup_(request));
      case 'login':
        return json_(login_(request));
      case 'session':
        return json_(session_(request));
      case 'logout':
        return json_(logout_(request));
      default:
        throw publicError_('INVALID_ACTION', '지원하지 않는 요청입니다.');
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({
      ok: false,
      code: error.publicCode || 'SERVER_ERROR',
      message: error.publicMessage || '요청 처리 중 오류가 발생했습니다.'
    });
  }
}

function signup_(data) {
  const email = email_(data.email);
  const name = String(data.name || '').trim().replace(/\s+/g, ' ');
  const password = String(data.password || '');
  validateEmail_(email);
  validateName_(name);
  validatePassword_(password);
  rateLimit_('signup', email, 5);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = sheet_(AUTH_CONFIG.usersSheet);
    if (findUser_(sheet, email, null)) {
      throw publicError_('EMAIL_EXISTS', '이미 가입된 이메일입니다.');
    }
    const now = new Date();
    const userId = Utilities.getUuid();
    const salt = randomToken_();
    sheet.appendRow([
      userId, safeCell_(email), safeCell_(name),
      passwordHash_(password, salt), salt, 'active',
      now, now, ''
    ]);
    return {
      ok: true,
      message: '회원가입이 완료되었습니다.',
      user: { id: userId, email: email, name: name }
    };
  } finally {
    lock.releaseLock();
  }
}

function login_(data) {
  const email = email_(data.email);
  const password = String(data.password || '');
  validateEmail_(email);
  rateLimit_('login', email, AUTH_CONFIG.loginLimit);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const users = sheet_(AUTH_CONFIG.usersSheet);
    const user = findUser_(users, email, null);
    const valid = user
      && user.status === 'active'
      && equal_(passwordHash_(password, user.salt), user.passwordHash);
    if (!valid) {
      throw publicError_(
        'INVALID_CREDENTIALS',
        '이메일 또는 비밀번호가 올바르지 않습니다.'
      );
    }
    const now = new Date();
    users.getRange(user.rowNumber, 9).setValue(now);
    const loginSession = createSession_(
      user,
      data.remember === true || data.remember === 'true',
      now
    );
    return {
      ok: true,
      message: '로그인되었습니다.',
      token: loginSession.token,
      expiresAt: loginSession.expiresAt.toISOString(),
      user: publicUser_(user)
    };
  } finally {
    lock.releaseLock();
  }
}

function session_(data) {
  const token = requireToken_(data.token);
  const loginSession = activeSession_(token);
  if (!loginSession) {
    throw publicError_('UNAUTHORIZED', '세션이 만료되었습니다.');
  }
  const user = findUser_(
    sheet_(AUTH_CONFIG.usersSheet),
    null,
    loginSession.userId
  );
  if (!user || user.status !== 'active') {
    throw publicError_('UNAUTHORIZED', '사용할 수 없는 계정입니다.');
  }
  return {
    ok: true,
    authenticated: true,
    expiresAt: loginSession.expiresAt.toISOString(),
    user: publicUser_(user)
  };
}

function logout_(data) {
  const tokenHash = tokenHash_(requireToken_(data.token));
  const sheet = sheet_(AUTH_CONFIG.sessionsSheet);
  const rows = sheet.getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    if (equal_(String(rows[index][2]), tokenHash) && !rows[index][5]) {
      sheet.getRange(index + 1, 6).setValue(new Date());
      break;
    }
  }
  return { ok: true, message: '로그아웃되었습니다.' };
}

function createSession_(user, remember, now) {
  const token = randomToken_() + randomToken_();
  const expiresAt = new Date(now.getTime());
  if (remember) {
    expiresAt.setDate(expiresAt.getDate() + AUTH_CONFIG.rememberedDays);
  } else {
    expiresAt.setHours(expiresAt.getHours() + AUTH_CONFIG.sessionHours);
  }
  sheet_(AUTH_CONFIG.sessionsSheet).appendRow([
    Utilities.getUuid(), user.userId, tokenHash_(token),
    now, expiresAt, ''
  ]);
  return { token: token, expiresAt: expiresAt };
}

function activeSession_(token) {
  const wantedHash = tokenHash_(token);
  const rows = sheet_(AUTH_CONFIG.sessionsSheet).getDataRange().getValues();
  const now = new Date();
  for (let index = 1; index < rows.length; index += 1) {
    if (
      equal_(String(rows[index][2]), wantedHash)
      && !rows[index][5]
      && new Date(rows[index][4]) > now
    ) {
      return {
        userId: String(rows[index][1]),
        expiresAt: new Date(rows[index][4])
      };
    }
  }
  return null;
}

function findUser_(sheet, email, userId) {
  const rows = sheet.getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    const emailMatches = email && email_(rows[index][1]) === email;
    const idMatches = userId && String(rows[index][0]) === String(userId);
    if (emailMatches || idMatches) {
      return {
        rowNumber: index + 1,
        userId: String(rows[index][0]),
        email: String(rows[index][1]),
        name: String(rows[index][2]),
        passwordHash: String(rows[index][3]),
        salt: String(rows[index][4]),
        status: String(rows[index][5])
      };
    }
  }
  return null;
}

function publicUser_(user) {
  return { id: user.userId, email: user.email, name: user.name };
}

// Salt + server-side pepper + repeated SHA-256. No plaintext password is stored.
function passwordHash_(password, salt) {
  let bytes = Utilities.computeHmacSha256Signature(
    salt + ':' + password,
    pepper_(),
    Utilities.Charset.UTF_8
  );
  for (let round = 1; round < AUTH_CONFIG.hashRounds; round += 1) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  }
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function tokenHash_(token) {
  const bytes = Utilities.computeHmacSha256Signature(
    token,
    pepper_(),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function equal_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function rateLimit_(action, email, limit) {
  const cache = CacheService.getScriptCache();
  const key = 'rate:' + tokenHash_(action + ':' + email).slice(0, 32);
  const attempts = Number(cache.get(key) || 0);
  if (attempts >= limit) {
    throw publicError_(
      'TOO_MANY_REQUESTS',
      '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    );
  }
  cache.put(key, String(attempts + 1), AUTH_CONFIG.rateWindowSeconds);
}

function validateEmail_(value) {
  if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw publicError_('INVALID_EMAIL', '올바른 이메일을 입력해 주세요.');
  }
}

function validateName_(value) {
  if (value.length < 2 || value.length > 40) {
    throw publicError_('INVALID_NAME', '이름은 2~40자로 입력해 주세요.');
  }
}

function validatePassword_(value) {
  if (
    value.length < 8 || value.length > 72
    || !/[A-Za-z]/.test(value) || !/[0-9]/.test(value)
  ) {
    throw publicError_(
      'INVALID_PASSWORD',
      '비밀번호는 영문과 숫자를 포함한 8~72자여야 합니다.'
    );
  }
}

function request_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw publicError_('INVALID_REQUEST', '요청 본문이 비어 있습니다.');
  }
  try {
    return JSON.parse(e.postData.contents);
  } catch (error) {
    throw publicError_('INVALID_JSON', 'JSON 형식이 올바르지 않습니다.');
  }
}

function email_(value) {
  return String(value || '').trim().toLowerCase();
}

function requireToken_(value) {
  const token = String(value || '').trim();
  if (token.length < 64 || token.length > 256) {
    throw publicError_('UNAUTHORIZED', '로그인이 필요합니다.');
  }
  return token;
}

function safeCell_(value) {
  const text = String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function publicError_(code, message) {
  const error = new Error(message);
  error.publicCode = code;
  error.publicMessage = message;
  return error;
}

function pepper_() {
  const value = PropertiesService
    .getScriptProperties()
    .getProperty('PASSWORD_PEPPER');
  if (!value) throw new Error('setupAuth()를 먼저 실행해 주세요.');
  return value;
}

function randomToken_() {
  return (
    Utilities.getUuid().replace(/-/g, '')
    + Utilities.getUuid().replace(/-/g, '')
  );
}

function spreadsheet_() {
  return SpreadsheetApp.openById(AUTH_CONFIG.spreadsheetId);
}

function sheet_(name) {
  const sheet = spreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error(name + ' 시트가 없습니다.');
  return sheet;
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#ff6038')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, headers.length);
  }
}

function ensureAuthReady_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = spreadsheet_();
    ensureSheet_(spreadsheet, AUTH_CONFIG.usersSheet, USER_HEADERS);
    ensureSheet_(spreadsheet, AUTH_CONFIG.sessionsSheet, SESSION_HEADERS);
    const properties = PropertiesService.getScriptProperties();
    if (!properties.getProperty('PASSWORD_PEPPER')) {
      properties.setProperty('PASSWORD_PEPPER', randomToken_());
    }
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    throw publicError_(
      'AUTH_SETUP_FAILED',
      '인증 저장소에 접근할 수 없습니다. 웹 앱 실행 사용자를 나로 설정하고 스프레드시트 권한을 확인해 주세요.'
    );
  } finally {
    lock.releaseLock();
  }
}

function json_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// Optional: run manually or with a daily time-driven trigger.
function cleanupExpiredSessions() {
  const sheet = sheet_(AUTH_CONFIG.sessionsSheet);
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  let removed = 0;
  for (let index = rows.length - 1; index >= 1; index -= 1) {
    if (new Date(rows[index][4]) <= now || rows[index][5]) {
      sheet.deleteRow(index + 1);
      removed += 1;
    }
  }
  return { ok: true, removed: removed };
}
