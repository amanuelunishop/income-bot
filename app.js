const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  withdrawalInput: document.getElementById('withdrawalInput'),
  noteInput: document.getElementById('noteInput'),
  saveEntryBtn: document.getElementById('saveEntryBtn'),
  saveStatus: document.getElementById('saveStatus'),
  recentList: document.getElementById('recentList'),
  weeklyList: document.getElementById('weeklyList'),
  weeklyNet: document.getElementById('weeklyNet'),
  weeklyPeriodLabel: document.getElementById('weeklyPeriodLabel'),
  monthlyList: document.getElementById('monthlyList'),
  monthlyNet: document.getElementById('monthlyNet'),
  monthlyPeriodLabel: document.getElementById('monthlyPeriodLabel'),
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
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });

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
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
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
  loadToday();
  loadRecent();
  loadWeekly();
  loadMonthly();
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

// ---------- today entry ----------

async function loadToday() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('entry_date', todayISO())
    .maybeSingle();

  if (!error && data) {
    els.incomeInput.value = data.income || '';
    els.withdrawalInput.value = data.withdrawal || '';
    els.noteInput.value = data.note || '';
  }
}

els.saveEntryBtn.addEventListener('click', async () => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  els.saveStatus.textContent = 'Saving…';

  const { error } = await supabase.from('entries').upsert(
    {
      user_id: user.id,
      entry_date: todayISO(),
      income: parseFloat(els.incomeInput.value) || 0,
      withdrawal: parseFloat(els.withdrawalInput.value) || 0,
      note: els.noteInput.value.trim() || null,
    },
    { onConflict: 'user_id,entry_date' }
  );

  els.saveStatus.textContent = error ? error.message : 'Saved.';
  if (!error) {
    loadRecent();
    loadWeekly();
    loadMonthly();
  }
});

// ---------- recent (last 7) ----------

async function loadRecent() {
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .limit(7);

  renderTapeList(els.recentList, data, error);
}

// ---------- weekly ----------

function startOfWeek() {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day; // Monday as start
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

async function loadWeekly() {
  const from = startOfWeek();
  els.weeklyPeriodLabel.textContent = 'From ' + from;

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .gte('entry_date', from)
    .order('entry_date', { ascending: false });

  renderTapeList(els.weeklyList, data, error);
  renderNet(els.weeklyNet, data);
}

// ---------- monthly ----------

async function loadMonthly() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  els.monthlyPeriodLabel.textContent = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .gte('entry_date', from)
    .order('entry_date', { ascending: false });

  renderTapeList(els.monthlyList, data, error);
  renderNet(els.monthlyNet, data);
}

// ---------- shared render helpers ----------

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
    line.innerHTML = `
      <span class="d">${row.entry_date}</span>
      <span class="v income">+${fmt(row.income)}</span>
      <span class="v withdrawal">-${fmt(row.withdrawal)}</span>
    `;
    container.appendChild(line);
  });
}

function renderNet(el, data) {
  const net = (data || []).reduce((sum, r) => sum + Number(r.income) - Number(r.withdrawal), 0);
  el.textContent = (net >= 0 ? '+' : '') + fmt(net);
  el.classList.remove('pos', 'neg');
  el.classList.add(net >= 0 ? 'pos' : 'neg');
}

// ---------- init ----------

renderAuthMode();
supabase.auth.getSession().then(({ data }) => {
  if (data.session) showApp();
  else showAuth();
});
