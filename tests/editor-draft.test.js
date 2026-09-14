const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const values = new Map();
const listeners = new Map();
let authToken = 'token';
const makeElement = (value = '') => ({
  value,
  textContent: '',
  disabled: false,
  addEventListener(name, callback) { this[name] = callback; },
  classList: { toggle() {} }
});
const elements = new Map([
  ['#editor-title', makeElement()],
  ['#editor-content', makeElement()],
  ['#editor-tags', makeElement()],
  ['#editor-category', makeElement()],
  ['#editor-date', makeElement()],
  ['#title-count', makeElement()],
  ['.draft-status', makeElement()],
  ['#storage-note', makeElement()],
  ['.save-draft', makeElement()],
  ['.publish-button', makeElement()],
  ['.publish-final', makeElement()]
]);
const storage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key)
};
let requests = 0;
const windowMock = {
  location: { pathname: '/post-write.html', search: '' },
  matchMedia: () => ({ matches: false }),
  addEventListener: (name, callback) => listeners.set(name, callback),
  setTimeout,
  innerWidth: 1000,
  scrollY: 0
};
const documentMock = {
  documentElement: { dataset: {} },
  body: { classList: { toggle() {} } },
  querySelector: (selector) => elements.get(selector) ?? null,
  querySelectorAll: () => [],
  addEventListener() {}
};
const context = {
  window: windowMock,
  document: documentMock,
  localStorage: storage,
  sessionStorage: {
    getItem: (key) => key === 'haneul-auth-token' ? authToken : null,
    setItem() {},
    removeItem() {}
  },
  IntersectionObserver: class { observe() {} unobserve() {} },
  URLSearchParams,
  Date,
  setTimeout,
  clearTimeout,
  fetch: () => { requests += 1; throw new Error('No network request expected'); }
};
vm.runInNewContext(fs.readFileSync('js/main.js', 'utf8'), context);
assert.equal(requests, 0, 'opening the editor must not fetch a post list');

elements.get('#editor-title').value = '임시 제목';
elements.get('#editor-title').input();
elements.get('#editor-content').value = '임시 내용';
elements.get('#editor-content').input();
listeners.get('pagehide')();
const draft = JSON.parse(values.get('haneul-blog-draft'));
assert.equal(draft.title, '임시 제목');
assert.equal(draft.content, '임시 내용');
assert.equal(elements.get('.draft-status').textContent, '임시저장됨');
elements.get('#editor-category').value = 'life';
authToken = null;
elements.get('.publish-final').click({ currentTarget: elements.get('.publish-final') }).then(() => {
  assert.equal(values.has('haneul-blog-draft'), false, 'publishing clears the draft');
  listeners.get('pagehide')();
  assert.equal(values.has('haneul-blog-draft'), false, 'navigation must not recreate a published draft');
  assert.equal(JSON.parse(values.get('haneul-blog-posts')).length, 1);
  console.log('Editor draft, publish, and initial request checks passed.');
});
