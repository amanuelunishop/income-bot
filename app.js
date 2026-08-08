const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isSignUpMode = false;

const els = {
  authView: document.getElementById('authView'),
  appView: document.getElementById('appView'),
  signOutBtn: document.getElementById('signOutBtn'),
  authTitle: document.getElementById('authTitle'),
  authSub: document.getElementById('authSub'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  primaryAuthBtn: document.getElementById('primaryAuthBtn'),
  secondaryAuthBtn: document.getElementById('secondaryAuthBtn'),
  authError: document.getElementById('authError'),
  switchPrompt: document.getElementById('switchPrompt'),
  switchLink: document.getElementById('switchLink'),
  todayLabel: document.getElementById('todayLabel'),
  incomeInput: document.getElementById('incomeInput'),
  incomeNoteInput: document.getElementById('incomeNoteInput'),
  withdrawalInput: document.getElementById('withdrawalInput'),
  withdrawalNoteInput: document.getElementById('withdrawalNoteInput'),
  saveEntryBtn: document.getElementById('saveEntryBtn'),
  saveStatus: document.getElementById('saveStatus'),
  recentList: document.getElementById('recentList'),
  reportFrom: document.getElementById('reportFrom'),
  reportTo: document.getElementById('reportTo'),
  thisMonthBtn: document.getElementById('thisMonthBtn'),
  sendReportBtn: document.getElementById('sendReportBtn'),
  reportStatus: document.getElementById('reportStatus'),
};

function fmt(n) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ---------- auth ----------

els.switchLink.addEventListener('click', () => {
  isSignUpMode = !isSignUpMode;
  renderAuthMode();
});

function renderAuthMode() {
  els.authError.textContent = '';
  if (isSignUpMode) {
    els.authTitle.textContent = 'Create your account';
    els.authSub.textContent = 'Set a password to start logging entries.';
    els.primaryAuthBtn.textContent = 'Create account';
    els.switchPrompt.textContent = 'Already have an account?';
    els.switchLink.textContent = 'Sign in';
  } else {
    els.authTitle.textContent = 'Welcome back';
    els.authSub.textContent = "Sign in to log today's numbers.";
    els.primaryAuthBtn.textContent = 'Sign in';
    els.switchPrompt.textContent = 'No account yet?';
    els.switchLink.textContent = 'Sign up';
  }
}

els.primaryAuthBtn.addEventListener('click', async () => {
  const email = els.email.value.trim();
  const password = els.password.value;
  els.authError.textContent = '';

  if (!email || !password) {
    els.authError.textContent = 'Enter an email and password.';
    return;
  }

  const { error } = isSignUpMode
    ? await sb.auth.signUp({ email, password })
    : await sb.auth.signInWithPassword({ email, password });

  if (error) {
    els.authError.textContent = error.message;
    return;
  }

  if (isSignUpMode) {
    els.authError.style.color = 'var(--income)';
    els.authError.textContent = 'Account created — check your email if confirmation is required, then sign in.';
  }
});

els.signOutBtn.addEventListener('click', async () => {
  await sb.auth.signOut();
});

sb.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showApp();
  } else {
    showAuth();
  }
});

function showAuth() {
  els.authView.classList.remove('hidden');
  els.appView.classList.add('hidden');
  els.signOutBtn.classList.add('hidden');
}

function showApp() {
  els.authView.classList.add('hidden');
  els.appView.classList.remove('hidden');
  els.signOutBtn.classList.remove('hidden');
  els.todayLabel.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  setDefaultReportRange();
  loadRecent();
}

// ---------- tabs ----------

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
  });
});

// ---------- save entry ----------

els.saveEntryBtn.addEventListener('click', async () => {
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) return;

  const income = parseFloat(els.incomeInput.value) || 0;
  const withdrawal = parseFloat(els.withdrawalInput.value) || 0;

  if (income === 0 && withdrawal === 0) {
    els.saveStatus.textContent = 'Enter an income or withdrawal amount.';
    return;
  }

  els.saveStatus.textContent = 'Saving…';

  const { error } = await sb.from('entries').insert({
    user_id: user.id,
    entry_date: todayISO(),
    income,
    income_note: els.incomeNoteInput.value.trim() || null,
    withdrawal,
    withdrawal_note: els.withdrawalNoteInput.value.trim() || null,
  });

  if (error) {
    els.saveStatus.textContent = error.message;
    return;
  }

  // Clear the form so it's ready for the next entry.
  els.incomeInput.value = '';
  els.incomeNoteInput.value = '';
  els.withdrawalInput.value = '';
  els.withdrawalNoteInput.value = '';
  els.saveStatus.textContent = 'Saved.';

  loadRecent();
});

// ---------- recent (last 7) ----------

async function loadRecent() {
  const { data, error } = await sb
    .from('entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(7);

  renderTapeList(els.recentList, data, error);
}

function renderTapeList(container, data, error) {
  container.innerHTML = '';
  if (error) {
    container.innerHTML = `<div class="empty-state">${error.message}</div>`;
    return;
  }
  if (!data || data.length === 0) {
    container.innerHTML = `<div class="empty-state">No entries yet.</div>`;
    return;
  }
  data.forEach(row => {
    const line = document.createElement('div');
    line.className = 'tape-line';
    const parts = [];
    if (Number(row.income) > 0) {
      parts.push(`<span class="v income">+${fmt(row.income)}${row.income_note ? ' · ' + escapeHtml(row.income_note) : ''}</span>`);
    }
    if (Number(row.withdrawal) > 0) {
      parts.push(`<span class="v withdrawal">-${fmt(row.withdrawal)}${row.withdrawal_note ? ' · ' + escapeHtml(row.withdrawal_note) : ''}</span>`);
    }
    line.innerHTML = `<span class="d">${row.entry_date}</span>${parts.join('')}`;
    container.appendChild(line);
  });
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ---------- report tab ----------

function setDefaultReportRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  els.reportFrom.value = from;
  els.reportTo.value = todayISO();
}

els.thisMonthBtn.addEventListener('click', setDefaultReportRange);

els.sendReportBtn.addEventListener('click', async () => {
  const from = els.reportFrom.value;
  const to = els.reportTo.value;

  if (!from || !to) {
    els.reportStatus.textContent = 'Pick a from and to date.';
    return;
  }

  els.reportStatus.textContent = 'Building report and sending to Telegram…';

  const { data, error } = await sb.functions.invoke('send-report', {
    body: { from, to },
  });

  if (error) {
    els.reportStatus.textContent = 'Failed: ' + error.message;
    return;
  }
  if (data && data.error) {
    els.reportStatus.textContent = 'Failed: ' + data.error;
    return;
  }

  els.reportStatus.textContent = 'Sent to Telegram.';
});

// ---------- init ----------

renderAuthMode();
sb.auth.getSession().then(({ data }) => {
  if (data.session) showApp();
  else showAuth();
});
