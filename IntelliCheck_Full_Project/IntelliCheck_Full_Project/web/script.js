const $ = (id) => document.getElementById(id);
let currentUser = null;
let lastErrors = [];
let toastTimer;

function toast(message, isError = false) {
  const el = $('toast'); el.textContent = message; el.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.className = 'toast', 3300);
}
async function request(path, data) {
  const options = data === undefined ? { credentials: 'same-origin' } : {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: new URLSearchParams(data).toString()
  };
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Request failed. Please try again.');
  return payload;
}
function switchAuth(mode) {
  const login = mode === 'login';
  $('loginFormWrap').hidden = !login; $('registerFormWrap').hidden = login;
  $('loginTab').classList.toggle('active', login); $('registerTab').classList.toggle('active', !login);
}
$('loginTab').addEventListener('click', () => switchAuth('login'));
$('registerTab').addEventListener('click', () => switchAuth('register'));
$('toRegister').addEventListener('click', () => switchAuth('register'));
$('toLogin').addEventListener('click', () => switchAuth('login'));

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try { const data = await request('/api/login', Object.fromEntries(new FormData(event.currentTarget))); await enterApp(data.user); }
  catch (e) { toast(e.message, true); }
  finally { button.disabled = false; }
});
$('registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try { const data = await request('/api/register', Object.fromEntries(new FormData(event.currentTarget))); await enterApp(data.user); toast('Your account is ready. Welcome to IntelliCheck!'); }
  catch (e) { toast(e.message, true); }
  finally { button.disabled = false; }
});
$('logoutBtn').addEventListener('click', async () => {
  try { await request('/api/logout', {}); } catch (_) {}
  currentUser = null; $('appView').hidden = true; $('authView').hidden = false; $('loginForm').reset(); switchAuth('login'); toast('You have signed out.');
});

async function enterApp(user) {
  currentUser = user;
  $('authView').hidden = true; $('appView').hidden = false;
  $('sideName').textContent = user.name; $('sideRole').textContent = user.role === 'ADMIN' ? 'Administrator' : 'Customer';
  $('avatar').textContent = (user.name || 'U').trim().charAt(0).toUpperCase();
  $('topEmail').textContent = user.email;
  document.querySelectorAll('.admin-only').forEach(el => el.hidden = user.role !== 'ADMIN');
  showPage('checker');
  try { const history = await request('/api/history'); renderHistory(history.items); } catch (e) { toast(e.message, true); }
  if (user.role === 'ADMIN') loadAdmin();
  $('dictStat').textContent = '—';
}
function showPage(page) {
  const titles = { checker: ['YOUR WRITING SPACE','Spell checker'], history: ['YOUR ACTIVITY','My activity'], admin: ['ADMINISTRATION','Admin dashboard'] };
  if (page === 'admin' && currentUser?.role !== 'ADMIN') page = 'checker';
  $('checkerPage').hidden = page !== 'checker'; $('historyPage').hidden = page !== 'history'; $('adminPage').hidden = page !== 'admin';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  $('pageKicker').textContent = titles[page][0]; $('pageTitle').textContent = titles[page][1];
  if (page === 'history') request('/api/history').then(data => renderHistory(data.items)).catch(e => toast(e.message, true));
  if (page === 'admin') loadAdmin();
}
document.querySelectorAll('.nav-item').forEach(el => el.addEventListener('click', () => showPage(el.dataset.page)));

$('textInput').addEventListener('input', updateCounts);
function updateCounts() {
  const text = $('textInput').value;
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
  $('wordCount').textContent = `${words.length} ${words.length === 1 ? 'word' : 'words'}`;
  $('charCount').textContent = `${text.length.toLocaleString()} / 12,000 characters`;
}
$('clearBtn').addEventListener('click', () => {
  $('textInput').value = ''; updateCounts(); lastErrors = [];
  $('results').innerHTML = '<div class="empty-state"><div class="empty-art">Aa</div><strong>Your results will appear here</strong><p>Run a check to see ranked suggestions and edit distance.</p></div>';
  $('errorCount').textContent = 'Ready'; $('correctAllBtn').hidden = true; $('wordsStat').textContent = '0'; $('issuesStat').textContent = '0';
});
$('checkBtn').addEventListener('click', runCheck);
async function runCheck() {
  const text = $('textInput').value.trim();
  if (!text) { toast('Enter some text before checking.', true); return; }
  const button = $('checkBtn'); button.disabled = true; button.innerHTML = 'Checking…';
  $('results').innerHTML = '<div class="empty-state"><div class="empty-art">···</div><strong>Analysing your text</strong><p>The Java engine is comparing words with the dictionary.</p></div>';
  try {
    const data = await request('/api/check', { text });
    lastErrors = data.errors || [];
    $('dictStat').textContent = Number(data.dictionarySize).toLocaleString();
    $('wordsStat').textContent = Number(data.checkedWords).toLocaleString();
    $('issuesStat').textContent = lastErrors.length;
    renderResults(lastErrors);
    const history = await request('/api/history'); renderHistory(history.items);
    if (currentUser.role === 'ADMIN') loadAdmin();
  } catch (e) {
    $('results').innerHTML = '<div class="empty-state"><div class="empty-art">!</div><strong>Could not check text</strong><p></p></div>';
    $('results').querySelector('p').textContent = e.message;
    toast(e.message, true);
  } finally { button.disabled = false; button.innerHTML = 'Check spelling <span>→</span>'; }
}
function renderResults(errors) {
  $('errorCount').textContent = `${errors.length} ${errors.length === 1 ? 'issue' : 'issues'}`;
  $('correctAllBtn').hidden = errors.length === 0;
  if (!errors.length) {
    $('results').innerHTML = '<div class="empty-state"><div class="empty-art">✓</div><strong>Looking good — no issues found</strong><p>Every word matched the current dictionary, or no suggestions met the matching threshold.</p></div>';
    return;
  }
  const root = document.createDocumentFragment();
  errors.forEach(error => {
    const card = document.createElement('article'); card.className = 'error-item';
    const row = document.createElement('div'); row.className = 'error-word-row';
    const wrong = document.createElement('span'); wrong.className = 'error-word'; wrong.textContent = error.word;
    const dist = document.createElement('span'); dist.className = 'distance-tag';
    dist.textContent = error.suggestions.length ? `Best distance: ${error.suggestions[0].distance}` : 'No close match';
    row.append(wrong, dist); card.append(row);
    const label = document.createElement('div'); label.className = 'suggest-label'; label.textContent = 'Suggested corrections · choose one';
    card.append(label);
    const choices = document.createElement('div'); choices.className = 'suggestions';
    error.suggestions.forEach(s => {
      const b = document.createElement('button'); b.className = 'suggestion'; b.type = 'button';
      b.append(document.createTextNode(s.word + ' '));
      const small = document.createElement('small'); small.textContent = `d=${s.distance}`; b.append(small);
      b.addEventListener('click', () => replaceWord(error.word, s.word)); choices.append(b);
    });
    if (!error.suggestions.length) { const none = document.createElement('span'); none.className='muted'; none.textContent='No suggestions found in the current dictionary.'; choices.append(none); }
    card.append(choices); root.append(card);
  });
  $('results').replaceChildren(root);
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function replaceWord(oldWord, newWord) {
  const pattern = new RegExp(`\\b${escapeRegExp(oldWord)}\\b`, 'g');
  $('textInput').value = $('textInput').value.replace(pattern, match => match[0] === match[0].toUpperCase() ? newWord[0].toUpperCase()+newWord.slice(1) : newWord);
  updateCounts(); runCheck();
}
$('correctAllBtn').addEventListener('click', () => {
  let text = $('textInput').value;
  lastErrors.forEach(error => {
    if (!error.suggestions.length) return;
    const replacement = error.suggestions[0].word;
    const pattern = new RegExp(`\\b${escapeRegExp(error.word)}\\b`, 'gi');
    text = text.replace(pattern, match => match[0] === match[0].toUpperCase() ? replacement[0].toUpperCase()+replacement.slice(1) : replacement);
  });
  $('textInput').value = text; updateCounts(); runCheck();
});

function renderHistory(items) {
  const root = $('historyList');
  if (!items || !items.length) { root.innerHTML = '<div class="table-empty">No checks saved yet. Check some text to build your activity history.</div>'; return; }
  root.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Date / time (UTC)</th><th>Summary</th><th>Words checked</th></tr></thead><tbody>${items.map(item => `<tr><td>${escapeHtml(item.time)}</td><td>${escapeHtml(item.summary)}</td><td>${Number(item.words)}</td></tr>`).join('')}</tbody></table></div>`;
}
async function loadAdmin() {
  if (currentUser?.role !== 'ADMIN') return;
  try {
    const data = await request('/api/admin/overview');
    $('adminStats').innerHTML = [
      ['Customer accounts',data.stats.users,'All registered customers'],
      ['Spell-check sessions',data.stats.checks,'Persisted activity records'],
      ['Dictionary entries',data.stats.dictionary,'Words available to the engine']
    ].map(x => `<article class="admin-stat"><span>${x[0]}</span><strong>${Number(x[1]).toLocaleString()}</strong><span>${x[2]}</span></article>`).join('');
    $('usersTable').innerHTML = data.users.length ? `<div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created (UTC)</th></tr></thead><tbody>${data.users.map(u=>`<tr><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td><span class="role-chip">${escapeHtml(u.role)}</span></td><td>${escapeHtml(u.created)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="table-empty">No accounts yet.</div>';
    $('adminRecent').innerHTML = data.recent.length ? `<div class="table-wrap"><table><thead><tr><th>Account</th><th>Date / time (UTC)</th><th>Summary</th><th>Words</th></tr></thead><tbody>${data.recent.map(x=>`<tr><td>${escapeHtml(x.email)}</td><td>${escapeHtml(x.time)}</td><td>${escapeHtml(x.summary)}</td><td>${Number(x.words)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="table-empty">No activity recorded yet.</div>';
  } catch (e) { toast(e.message, true); }
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
async function boot() {
  try {
    const data = await request('/api/me');
    await enterApp(data.user);
  } catch (_) {
    $('appView').hidden = true; $('authView').hidden = false;
  }
}
boot();
