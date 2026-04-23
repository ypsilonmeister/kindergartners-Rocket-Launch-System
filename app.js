/* ============================================================
   あさのしたく タイマー — app.js
   Pure JS, no libraries. Uses Web Speech API for voice.
   ============================================================ */

// ===== Task definitions =====
const TASKS = [
  { id: 'breakfast', name: '朝ごはん', emoji: '🍚', color: '#FF9A76', defaultMin: 15 },
  { id: 'teeth',     name: '歯みがき',   emoji: '🪥', color: '#6BCB77', defaultMin: 3  },
  { id: 'clothes',   name: '着がえ',     emoji: '👕', color: '#9B59B6', defaultMin: 5  },
  { id: 'prepare',   name: '準備',       emoji: '🎒', color: '#3498DB', defaultMin: 5  },
];

// ===== Voice messages =====
const VOICE = {
  taskStart: (t) => `${t.name}の時間だよ！がんばろう！`,
  timeWarning5: '全体の残り時間、あと5分！',
  timeWarning3: 'あと3分！もうすこしだよ！',
  timeWarning1: 'あと1分！急いで！',
  taskDoneFast: 'すごい！早くできたね！',
  taskDoneOk: 'よくできたね！次もがんばろう！',
  taskDoneSlow: '終わったね！次はもうすこし早くやってみよう！',
  allDoneOnTime: 'やったー！全部時間どおりにできたよ！すごいね！',
  allDoneLate: 'おつかれさま！次はもうすこし早くできるよ！がんばろうね！',
  overtime: '時間を過ぎちゃったけど、おちついて終わらせよう！',
};

// ===== State =====
const state = {
  tasks: TASKS.map(t => ({ ...t, minutes: t.defaultMin })),
  targetTime: '07:30',
  currentTaskIdx: 0,
  startTimestamp: null,     // Date when routine started
  taskStartTimestamp: null, // Date when current task started
  taskResults: [],          // { id, planned, actual }
  timerInterval: null,
  voiceEnabled: true,
  spokenFlags: {},          // track which warnings were spoken
  theme: 'cute',            // 'cute' or 'space'
};

// ===== DOM cache =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ===== Circumference for SVG timer =====
const TIMER_R = 140;
const TIMER_C = 2 * Math.PI * TIMER_R;

// ===== Init =====
function init() {
  loadSettings();
  loadTheme();
  renderTaskSettings();
  updateTotalMinutes();
  bindEvents();
  $('#timer-progress-circle').setAttribute('stroke-dasharray', TIMER_C);
  $('#timer-progress-circle').setAttribute('stroke-dashoffset', '0');
}

// ===== Settings persistence =====
function loadSettings() {
  try {
    const saved = localStorage.getItem('asa_settings');
    if (saved) {
      const s = JSON.parse(saved);
      state.targetTime = s.targetTime || '07:30';
      if (s.taskMinutes) {
        state.tasks.forEach((t, i) => {
          if (s.taskMinutes[t.id] != null) t.minutes = s.taskMinutes[t.id];
        });
      }
    }
  } catch (e) { /* ignore */ }
  $('#target-time').value = state.targetTime;
}

function saveSettings() {
  const taskMinutes = {};
  state.tasks.forEach(t => taskMinutes[t.id] = t.minutes);
  localStorage.setItem('asa_settings', JSON.stringify({
    targetTime: state.targetTime,
    taskMinutes,
  }));
}

// ===== Render task settings on setup screen =====
function renderTaskSettings() {
  const list = $('#task-settings-list');
  list.innerHTML = '';
  state.tasks.forEach((task, i) => {
    const row = document.createElement('div');
    row.className = 'task-setting-row';
    row.innerHTML = `
      <span class="ts-emoji">${task.emoji}</span>
      <span class="ts-name">${task.name}</span>
      <div class="ts-controls">
        <button class="ts-btn" data-idx="${i}" data-dir="-1" aria-label="へらす">−</button>
        <span class="ts-minutes" id="ts-min-${i}">${task.minutes}分</span>
        <button class="ts-btn" data-idx="${i}" data-dir="1" aria-label="ふやす">＋</button>
      </div>
    `;
    list.appendChild(row);
  });
}

function updateTotalMinutes() {
  const total = state.tasks.reduce((s, t) => s + t.minutes, 0);
  $('#total-minutes').textContent = total;
}

// ===== Screen navigation =====
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#${id}`).classList.add('active');
}

// ===== Bind events =====
function bindEvents() {
  // Task duration +/- buttons
  $('#task-settings-list').addEventListener('click', (e) => {
    const btn = e.target.closest('.ts-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx);
    const dir = parseInt(btn.dataset.dir);
    state.tasks[idx].minutes = Math.max(1, state.tasks[idx].minutes + dir);
    $(`#ts-min-${idx}`).textContent = state.tasks[idx].minutes + '分';
    updateTotalMinutes();
  });

  // Target time change
  $('#target-time').addEventListener('change', (e) => {
    state.targetTime = e.target.value;
  });

  // Start button
  $('#start-btn').addEventListener('click', () => startRoutine());

  // Done button
  $('#done-btn').addEventListener('click', () => completeCurrentTask());

  // Stats button
  $('#stats-btn').addEventListener('click', () => { renderStats(); showScreen('stats-screen'); });

  // Back button (stats)
  $('#back-btn').addEventListener('click', () => showScreen('setup-screen'));

  // Retry button
  $('#retry-btn').addEventListener('click', () => { resetRoutine(); showScreen('setup-screen'); });

  // Go stats from complete
  $('#go-stats-btn').addEventListener('click', () => { renderStats(); showScreen('stats-screen'); });

  // Sound toggle
  $('#sound-toggle').addEventListener('click', () => {
    state.voiceEnabled = !state.voiceEnabled;
    $('#sound-toggle').textContent = state.voiceEnabled ? '🔊' : '🔇';
  });

  // Theme toggle
  $('#theme-btn-cute').addEventListener('click', () => setTheme('cute'));
  $('#theme-btn-space').addEventListener('click', () => setTheme('space'));
}

// ===== Start routine =====
function startRoutine() {
  saveSettings();
  state.currentTaskIdx = 0;
  state.taskResults = [];
  state.spokenFlags = {};
  state.startTimestamp = Date.now();
  state.taskStartTimestamp = Date.now();

  renderTaskProgress();
  updateCurrentTaskDisplay();
  showScreen('main-screen');

  // Start timer loop
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = setInterval(updateTimerDisplay, 250);
  updateTimerDisplay();

  // Announce first task
  speak(VOICE.taskStart(state.tasks[0]));
}

// ===== Render progress dots =====
function renderTaskProgress() {
  const container = $('#task-progress');
  container.innerHTML = '';
  state.tasks.forEach((task, i) => {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';
    dot.style.color = task.color;
    dot.textContent = task.emoji;
    dot.id = `dot-${i}`;
    if (i < state.currentTaskIdx) dot.classList.add('done');
    if (i === state.currentTaskIdx) dot.classList.add('current');
    container.appendChild(dot);
  });
}

// ===== Update current task display =====
function updateCurrentTaskDisplay() {
  const task = state.tasks[state.currentTaskIdx];
  $('#task-emoji-display').textContent = task.emoji;
  $('#task-name-display').textContent = task.name;
  $('#task-allocated-time').textContent = formatMS(task.minutes * 60);

  // Update background tint (only in cute theme)
  if (state.theme !== 'space') {
    document.body.style.setProperty('--bg-start', lightenColor(task.color, 0.85));
    document.body.style.setProperty('--bg-end', lightenColor(task.color, 0.7));
  }

  // Update gradient
  $('#grad-stop1').setAttribute('stop-color', task.color);
  $('#grad-stop2').setAttribute('stop-color', darkenColor(task.color, 0.8));
}

// ===== Timer display update (called every 250ms) =====
function updateTimerDisplay() {
  const now = Date.now();

  // Calculate departure deadline
  const [hh, mm] = state.targetTime.split(':').map(Number);
  const today = new Date();
  today.setHours(hh, mm, 0, 0);
  let deadlineMs = today.getTime();
  // If deadline already passed (e.g. testing at night), push to next day
  if (deadlineMs < state.startTimestamp) deadlineMs += 24 * 3600 * 1000;

  const totalPlannedMs = state.tasks.reduce((s, t) => s + t.minutes * 60000, 0);
  const remainingMs = deadlineMs - now;
  const remainingSec = Math.floor(remainingMs / 1000);

  // Progress (1 = full, 0 = time's up)
  const totalAvailMs = deadlineMs - state.startTimestamp;
  const progress = Math.max(0, Math.min(1, remainingMs / totalAvailMs));

  // Update SVG circle
  const offset = TIMER_C * (1 - progress);
  $('#timer-progress-circle').setAttribute('stroke-dashoffset', offset);

  // Update time text
  const timeEl = $('#timer-time');
  const labelEl = $('#timer-label');

  if (remainingSec >= 0) {
    timeEl.textContent = formatMS(remainingSec);
    labelEl.textContent = '残り時間';
    timeEl.classList.remove('overtime', 'pulse');

    // Color coding
    if (progress < 0.15) {
      timeEl.classList.add('pulse');
      updateTimerGradient('#e74c3c', '#c0392b');
    } else if (progress < 0.35) {
      timeEl.classList.add('warning');
      updateTimerGradient('#f39c12', '#e67e22');
    } else {
      timeEl.classList.remove('warning');
      const task = state.tasks[state.currentTaskIdx];
      updateTimerGradient(task.color, darkenColor(task.color, 0.8));
    }
  } else {
    timeEl.textContent = '-' + formatMS(Math.abs(remainingSec));
    labelEl.textContent = '過ぎちゃった！';
    timeEl.classList.add('overtime', 'pulse');
    updateTimerGradient('#e74c3c', '#c0392b');
  }

  // Per-task elapsed
  const taskElapsedSec = Math.floor((now - state.taskStartTimestamp) / 1000);
  $('#task-elapsed-time').textContent = formatMS(taskElapsedSec);

  // Voice warnings (overall remaining)
  checkVoiceWarnings(remainingSec);
}

function updateTimerGradient(c1, c2) {
  $('#grad-stop1').setAttribute('stop-color', c1);
  $('#grad-stop2').setAttribute('stop-color', c2);
}

function checkVoiceWarnings(remainingSec) {
  if (remainingSec === 300 && !state.spokenFlags.w5) {
    state.spokenFlags.w5 = true;
    speak(VOICE.timeWarning5);
  }
  if (remainingSec === 180 && !state.spokenFlags.w3) {
    state.spokenFlags.w3 = true;
    speak(VOICE.timeWarning3);
  }
  if (remainingSec === 60 && !state.spokenFlags.w1) {
    state.spokenFlags.w1 = true;
    speak(VOICE.timeWarning1);
  }
  if (remainingSec === 0 && !state.spokenFlags.ot) {
    state.spokenFlags.ot = true;
    speak(VOICE.overtime);
  }
}

// ===== Complete current task =====
function completeCurrentTask() {
  const now = Date.now();
  const task = state.tasks[state.currentTaskIdx];
  const actualSec = Math.floor((now - state.taskStartTimestamp) / 1000);
  const plannedSec = task.minutes * 60;

  state.taskResults.push({
    id: task.id,
    name: task.name,
    emoji: task.emoji,
    planned: plannedSec,
    actual: actualSec,
  });

  // Voice feedback
  const ratio = actualSec / plannedSec;
  if (ratio <= 0.8) speak(VOICE.taskDoneFast);
  else if (ratio <= 1.1) speak(VOICE.taskDoneOk);
  else speak(VOICE.taskDoneSlow);

  // Star burst effect
  createStarBurst();

  // Button animation
  const btn = $('#done-btn');
  btn.classList.add('celebrate');
  setTimeout(() => btn.classList.remove('celebrate'), 500);

  // Mark progress dot as done
  const dot = $(`#dot-${state.currentTaskIdx}`);
  if (dot) { dot.classList.remove('current'); dot.classList.add('done'); }

  state.currentTaskIdx++;

  if (state.currentTaskIdx >= state.tasks.length) {
    // All done!
    finishRoutine();
  } else {
    // Next task
    state.taskStartTimestamp = Date.now();
    const nextDot = $(`#dot-${state.currentTaskIdx}`);
    if (nextDot) nextDot.classList.add('current');
    updateCurrentTaskDisplay();
    speak(VOICE.taskStart(state.tasks[state.currentTaskIdx]));
  }
}

// ===== Finish routine =====
function finishRoutine() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;

  const now = Date.now();
  const [hh, mm] = state.targetTime.split(':').map(Number);
  const today = new Date();
  today.setHours(hh, mm, 0, 0);
  let deadlineMs = today.getTime();
  if (deadlineMs < state.startTimestamp) deadlineMs += 24 * 3600 * 1000;

  const onTime = now <= deadlineMs;
  const totalActual = state.taskResults.reduce((s, r) => s + r.actual, 0);
  const totalPlanned = state.taskResults.reduce((s, r) => s + r.planned, 0);

  // Save stats
  saveHistory({ date: new Date().toISOString().slice(0, 10), targetTime: state.targetTime, tasks: state.taskResults, totalPlanned, totalActual, onTime });

  // Update completion screen
  $('#result-emoji').textContent = onTime ? '🎉' : '💪';
  $('#result-title').textContent = onTime ? 'やったね！' : 'おつかれさま！';
  $('#result-message').textContent = onTime
    ? `全部時間どおりにできたよ！\n今日も一日がんばろう！`
    : `次はもうすこし早くできるよ！\nまた明日がんばろうね！`;

  // Summary table
  renderResultSummary(totalPlanned, totalActual);

  showScreen('complete-screen');

  // Confetti
  if (onTime) createConfetti();

  // Voice
  speak(onTime ? VOICE.allDoneOnTime : VOICE.allDoneLate);
}

function renderResultSummary(totalPlanned, totalActual) {
  const container = $('#result-summary');
  container.innerHTML = '';
  state.taskResults.forEach(r => {
    const fast = r.actual <= r.planned;
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `
      <span class="sr-name">${r.emoji} ${r.name}</span>
      <span class="sr-time ${fast ? 'sr-fast' : 'sr-slow'}">${formatMS(r.actual)} / ${formatMS(r.planned)}</span>
    `;
    container.appendChild(row);
  });
  // Total row
  const totalRow = document.createElement('div');
  totalRow.className = 'summary-row';
  const fast = totalActual <= totalPlanned;
  totalRow.innerHTML = `
    <span class="sr-name">⏱️ 合計</span>
    <span class="sr-time ${fast ? 'sr-fast' : 'sr-slow'}">${formatMS(totalActual)} / ${formatMS(totalPlanned)}</span>
  `;
  container.appendChild(totalRow);
}

// ===== Reset =====
function resetRoutine() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.currentTaskIdx = 0;
  state.taskResults = [];
  state.spokenFlags = {};
  // Restore default background
  if (state.theme !== 'space') {
    document.body.style.setProperty('--bg-start', '#ffecd2');
    document.body.style.setProperty('--bg-end', '#fcb69f');
  }
}

// ===== Voice (Web Speech API) =====
let jaVoice = null;

function initVoice() {
  const loadVoices = () => {
    const voices = speechSynthesis.getVoices();
    jaVoice = voices.find(v => v.lang.startsWith('ja')) || null;
  };
  loadVoices();
  speechSynthesis.addEventListener('voiceschanged', loadVoices);
}

function speak(text) {
  if (!state.voiceEnabled) return;
  if (!('speechSynthesis' in window)) return;

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 0.9;
  utter.pitch = 1.15;
  if (jaVoice) utter.voice = jaVoice;
  speechSynthesis.speak(utter);
}

// ===== History / Stats =====
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('asa_history') || '[]');
  } catch { return []; }
}

function saveHistory(entry) {
  const hist = getHistory();
  hist.push(entry);
  // Keep last 30 entries
  while (hist.length > 30) hist.shift();
  localStorage.setItem('asa_history', JSON.stringify(hist));
}

function renderStats() {
  const hist = getHistory();
  const noData = $('#no-data-msg');
  const chartArea = $('#chart-area');
  const avgArea = $('#averages-area');
  const streakArea = $('#streak-display');

  if (hist.length === 0) {
    noData.classList.remove('hidden');
    chartArea.innerHTML = '';
    chartArea.appendChild(noData);
    avgArea.innerHTML = '';
    streakArea.innerHTML = '';
    return;
  }

  // === Streak ===
  let streak = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].onTime) streak++;
    else break;
  }
  streakArea.innerHTML = streak > 0
    ? `🔥 <span class="streak-number">${streak}</span> 日連続成功！`
    : 'まだ連続成功はないよ';

  // === Chart (last 7 days) ===
  const recent = hist.slice(-7);
  const maxPlanned = Math.max(...recent.map(h => h.totalPlanned));
  const maxVal = Math.max(maxPlanned, ...recent.map(h => h.totalActual)) * 1.15;

  let chartHTML = '<div class="chart-bars">';

  // Target line
  const targetPct = (maxPlanned / maxVal) * 100;
  chartHTML += `<div class="chart-target-line" style="bottom:${targetPct}%">
    <span class="chart-target-label">目標</span></div>`;

  recent.forEach(h => {
    const pct = (h.totalActual / maxVal) * 100;
    const dateLabel = h.date.slice(5).replace('-', '/');
    const cls = h.onTime ? 'on-time' : 'over-time';
    chartHTML += `
      <div class="chart-col">
        <div class="chart-bar-wrap">
          <div class="chart-bar ${cls}" style="height:${pct}%">
            <span class="chart-bar-label">${formatMS(h.totalActual)}</span>
          </div>
        </div>
        <span class="chart-date">${dateLabel}</span>
      </div>`;
  });
  chartHTML += '</div>';
  chartArea.innerHTML = chartHTML;

  // === Averages ===
  const avgByTask = {};
  TASKS.forEach(t => avgByTask[t.id] = { sum: 0, count: 0, emoji: t.emoji, name: t.name, color: t.color });
  hist.forEach(h => {
    (h.tasks || []).forEach(tr => {
      if (avgByTask[tr.id]) {
        avgByTask[tr.id].sum += tr.actual;
        avgByTask[tr.id].count++;
      }
    });
  });

  const maxAvg = Math.max(...Object.values(avgByTask).map(a => a.count > 0 ? a.sum / a.count : 0), 1);

  let avgHTML = '<div class="avg-title">平均時間</div>';
  Object.values(avgByTask).forEach(a => {
    if (a.count === 0) return;
    const avg = a.sum / a.count;
    const pct = (avg / maxAvg) * 100;
    avgHTML += `
      <div class="avg-row">
        <span class="avg-emoji">${a.emoji}</span>
        <span class="avg-name">${a.name}</span>
        <div class="avg-bar-bg">
          <div class="avg-bar-fill" style="width:${pct}%;background:${a.color}"></div>
        </div>
        <span class="avg-time">${formatMS(Math.round(avg))}</span>
      </div>`;
  });
  avgArea.innerHTML = avgHTML;
}

// ===== Effects =====
function createConfetti() {
  const box = $('#confetti-box');
  box.innerHTML = '';
  const colors = ['#e74c3c','#3498db','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e91e63','#ff9800'];
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = (2 + Math.random() * 2) + 's';
    piece.style.animationDelay = Math.random() * 1.5 + 's';
    piece.style.width = (6 + Math.random() * 8) + 'px';
    piece.style.height = (8 + Math.random() * 10) + 'px';
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    box.appendChild(piece);
  }
  // Clean up after animation
  setTimeout(() => { box.innerHTML = ''; }, 5000);
}

function createStarBurst() {
  const burst = document.createElement('div');
  burst.className = 'star-burst';
  const rect = $('#done-btn').getBoundingClientRect();
  burst.style.left = (rect.left + rect.width / 2) + 'px';
  burst.style.top = (rect.top + rect.height / 2) + 'px';

  const stars = ['⭐','🌟','✨','💫','🎀'];
  for (let i = 0; i < 8; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.textContent = stars[Math.floor(Math.random() * stars.length)];
    const angle = (Math.PI * 2 * i) / 8;
    const dist = 50 + Math.random() * 40;
    star.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
    star.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
    burst.appendChild(star);
  }
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1000);
}

// ===== Utility =====
function formatMS(totalSeconds) {
  const m = Math.floor(Math.abs(totalSeconds) / 60);
  const s = Math.abs(totalSeconds) % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function lightenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `rgb(${lr},${lg},${lb})`;
}

function darkenColor(hex, factor) {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r},${g},${b})`;
}

// ===== Theme =====
function loadTheme() {
  try {
    const saved = localStorage.getItem('asa_theme');
    if (saved === 'space' || saved === 'cute') state.theme = saved;
  } catch (e) { /* ignore */ }
  applyTheme(state.theme);
}

function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem('asa_theme', theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  // Update toggle buttons
  $$('.theme-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = $(`#theme-btn-${theme}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Generate or clear stars
  const starsContainer = $('#stars-bg');
  if (theme === 'space') {
    generateStars(starsContainer);
  } else {
    starsContainer.innerHTML = '';
  }
}

function generateStars(container) {
  if (container.children.length > 0) return; // already generated
  for (let i = 0; i < 120; i++) {
    const star = document.createElement('div');
    const size = 1 + Math.random() * 2;
    star.style.cssText = `
      position:absolute;
      width:${size}px;height:${size}px;
      background:white;
      border-radius:50%;
      left:${Math.random()*100}%;
      top:${Math.random()*100}%;
      opacity:${0.15+Math.random()*0.5};
      animation:starTwinkle ${2+Math.random()*5}s ${Math.random()*3}s infinite alternate;
    `;
    container.appendChild(star);
  }
}

// ===== Boot =====
document.addEventListener('DOMContentLoaded', () => {
  init();
  initVoice();
});