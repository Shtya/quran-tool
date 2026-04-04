'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, BarChart2, Calendar, Settings, ChevronRight, ChevronLeft, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, Moon, Sun, Mic, BookMarked, AlignJustify, Layers, List, ArrowRight, Flame, Star, Target, TrendingUp, Volume2, ScrollText, Info, X, Check, ChevronDown, Menu, Grid3X3, Headphones, BookText, Play, Pause, StopCircle, SkipForward, SkipBack, Music2, Loader2, Search, Edit3, Save, Clock, Award, Bookmark, ChevronUp, Hash, LayoutDashboard, BookOpenCheck, AlertCircle } from 'lucide-react';

// ─── MongoDB API Layer ─────────────────────────────────────────────────────────
const API = {
  async get(collection, query = {}) {
    try {
      const qs = new URLSearchParams({ collection, query: JSON.stringify(query) });
      const res = await fetch(`/api/db?${qs}`);
      if (!res.ok) throw new Error('DB read failed');
      return await res.json();
    } catch {
      return null;
    }
  },
  async post(collection, doc) {
    try {
      const res = await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, doc }),
      });
      if (!res.ok) throw new Error('DB write failed');
      return await res.json();
    } catch {
      return null;
    }
  },
  async put(collection, id, updates) {
    try {
      const res = await fetch('/api/db', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, id, updates }),
      });
      if (!res.ok) throw new Error('DB update failed');
      return await res.json();
    } catch {
      return null;
    }
  },
  async delete(collection, id) {
    try {
      const res = await fetch(`/api/db?collection=${collection}&id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('DB delete failed');
      return true;
    } catch {
      return false;
    }
  },
};

// ─── Hybrid Store (MongoDB with localStorage fallback) ────────────────────────
const STORE = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  },
  getOne(key, defaultVal = {}) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultVal));
    } catch {
      return defaultVal;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  },
  push(key, item) {
    const arr = this.get(key);
    arr.push(item);
    this.set(key, arr);
    return item;
  },
  update(key, id, updates) {
    const arr = this.get(key);
    const i = arr.findIndex(x => x.id === id);
    if (i !== -1) {
      arr[i] = { ...arr[i], ...updates };
      this.set(key, arr);
      return arr[i];
    }
    return null;
  },
  remove(key, id) {
    this.set(
      key,
      this.get(key).filter(x => x.id !== id),
    );
  },
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Data Access Functions ────────────────────────────────────────────────────
function getMistakes() {
  return STORE.get('q_mistakes');
}
function saveMistake(m) {
  return STORE.push('q_mistakes', m);
}
function updateMistake(id, u) {
  return STORE.update('q_mistakes', id, u);
}
function deleteMistake(id) {
  STORE.remove('q_mistakes', id);
}

function getSessions() {
  return STORE.get('q_sessions');
}
function saveSession(s) {
  STORE.push('q_sessions', s);
}

function getSchedule() {
  return STORE.get('q_schedule');
}
function saveScheduleItem(item) {
  STORE.push('q_schedule', item);
}
function updateScheduleItem(id, u) {
  return STORE.update('q_schedule', id, u);
}
function deleteScheduleItem(id) {
  STORE.remove('q_schedule', id);
}

function getReviewPlan() {
  return STORE.getOne('q_review_plan', { dailyReview: 10, dailyMemorize: 2, enabled: false });
}
function saveReviewPlan(p) {
  STORE.set('q_review_plan', p);
}

function getSettings() {
  return STORE.getOne('q_settings', {
    requiredChecks: 3,
    darkMode: false,
    defaultTafsir: '169',
    quranFontSize: 'md',
    reciter: '7',
  });
}
function saveSettings(s) {
  STORE.set('q_settings', s);
}

function getStreak() {
  return STORE.getOne('q_streak', { current: 0, best: 0, lastDate: null });
}
function updateStreak() {
  const streak = getStreak(),
    today = new Date().toDateString(),
    yesterday = new Date(Date.now() - 86400000).toDateString();
  if (streak.lastDate === today) return streak;
  const cur = streak.lastDate === yesterday ? streak.current + 1 : 1;
  const updated = { current: cur, best: Math.max(cur, streak.best || 0), lastDate: today };
  STORE.set('q_streak', updated);
  return updated;
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d),
    today = new Date(),
    yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'اليوم';
  if (date.toDateString() === yesterday.toDateString()) return 'الأمس';
  return date.toLocaleDateString('ar-SA', { weekday: 'long', month: 'long', day: 'numeric' });
}

function toAr(n) {
  return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}
function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60),
    s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ─── Quran API ────────────────────────────────────────────────────────────────
const QAPI = 'https://api.quran.com/api/v4';

async function fetchPageVerses(page) {
  try {
    const r = await fetch(`${QAPI}/verses/by_page/${page}?translations=&fields=text_uthmani,verse_number,juz_number,hizb_number,chapter_id&per_page=50`);
    const d = await r.json();
    return d.verses || [];
  } catch {
    return [];
  }
}

async function fetchTafsir(verseKey, tafsirId = '169') {
  try {
    // Correct endpoint: /tafsirs/{tafsir_id}/by_ayah/{ayah_key}
    const r = await fetch(`${QAPI}/tafsirs/${tafsirId}/by_ayah/${verseKey}`);
    if (!r.ok) throw new Error('Tafsir fetch failed');
    const d = await r.json();
    return d.tafsir || null;
  } catch {
    return null;
  }
}

async function fetchSurahList() {
  try {
    const r = await fetch(`${QAPI}/chapters?language=ar`);
    const d = await r.json();
    return d.chapters || [];
  } catch {
    return [];
  }
}

async function fetchSurahVerses(surahNum) {
  try {
    const r = await fetch(`${QAPI}/verses/by_chapter/${surahNum}?fields=text_uthmani,verse_number,juz_number,hizb_number&per_page=300`);
    const d = await r.json();
    return d.verses || [];
  } catch {
    return [];
  }
}

async function fetchChapterInfo(chapterId) {
  try {
    const r = await fetch(`${QAPI}/chapters/${chapterId}?language=ar`);
    const d = await r.json();
    return d.chapter || null;
  } catch {
    return null;
  }
}

// Audio URL - using mp3quran.net CDN pattern (works reliably)
// Format: https://cdn.islamic.network/quran/audio/{bitrate}/{reciter_id}/{surah}{ayah}.mp3
function getAudioUrl(surah, ayah, reciterId = '7') {
  // Using everyayah.com which provides reliable audio
  const paddedSurah = String(surah).padStart(3, '0');
  const paddedAyah = String(ayah).padStart(3, '0');
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${parseInt(surah) * 1000 + parseInt(ayah)}.mp3`;
}

// Better audio URL using verses endpoint
function getAudioUrlV2(surah, ayah, reciterId = '7') {
  return `https://verses.quran.com/${reciterId}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;
}

// ─── Reciters ─────────────────────────────────────────────────────────────────
const RECITERS = [
  { id: '7', name: 'مشاري العفاسي' },
  { id: '1', name: 'عبد الباسط عبد الصمد' },
  { id: '5', name: 'سعد الغامدي' },
  { id: '11', name: 'محمود الحصري' },
  { id: '12', name: 'محمد صديق المنشاوي' },
];

// ─── Tafsir options ───────────────────────────────────────────────────────────
const TAFSIR_OPTIONS = [
  { id: '169', name: 'الميسر' },
  { id: '91', name: 'ابن كثير' },
  { id: '93', name: 'الجلالين' },
  { id: '94', name: 'الطبري' },
];

// ─── Error Types ──────────────────────────────────────────────────────────────
const ERROR_TYPES = [
  { id: 'forgot_start', label: 'نسيان بداية الآية', icon: '←', color: '#e74c3c' },
  { id: 'wrong_text', label: 'خطأ في النص', icon: '✏', color: '#e67e22' },
  { id: 'forgot_end', label: 'نسيان نهاية الآية', icon: '→', color: '#9b59b6' },
  { id: 'confused', label: 'خلط بين آيتين', icon: '⇄', color: '#3498db' },
];
const TYPE_LBL = {
  forgot_start: 'نسيان بداية الآية',
  wrong_text: 'خطأ في النص',
  forgot_end: 'نسيان نهاية الآية',
  confused: 'خلط بين آيتين',
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Tajawal:wght@300;400;500;700;800;900&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #F5F0E8;
  --bg2: #EDE7DB;
  --bg3: #E2DACc;
  --surface: #FEFCF8;
  --surface2: #F8F4EE;
  --border: rgba(120,90,50,0.12);
  --border2: rgba(120,90,50,0.2);

  --ink: #1A130A;
  --ink2: #3D2E1E;
  --ink3: #7A6045;
  --ink4: #B09A7A;

  --green: #1A6644;
  --green2: #23845A;
  --green3: #40B07A;
  --green-bg: rgba(26,102,68,0.07);
  --green-border: rgba(26,102,68,0.18);

  --gold: #9A6E20;
  --gold2: #BE8C2A;
  --gold3: #D9A84A;
  --gold-bg: rgba(154,110,32,0.08);
  --gold-border: rgba(154,110,32,0.2);

  --red: #8B2020;
  --red2: #B93232;
  --red-bg: rgba(139,32,32,0.07);
  --red-border: rgba(139,32,32,0.18);

  --purple: #5B3A8A;
  --purple-bg: rgba(91,58,138,0.07);
  --purple-border: rgba(91,58,138,0.18);

  --shadow-xs: 0 1px 4px rgba(28,16,6,0.06);
  --shadow-sm: 0 2px 10px rgba(28,16,6,0.08);
  --shadow-md: 0 4px 24px rgba(28,16,6,0.1);
  --shadow-lg: 0 8px 48px rgba(28,16,6,0.12);
  --shadow-xl: 0 16px 64px rgba(28,16,6,0.16);

  --r-xs: 6px;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --r-xl: 24px;
  --r-2xl: 32px;

  --quran-sm: 20px;
  --quran-md: 24px;
  --quran-lg: 30px;

  --sidebar-w: 240px;
  --header-h: 64px;
  --player-h: 72px;
}

.dark {
  --bg: #0D1108;
  --bg2: #131A0C;
  --bg3: #1A2212;
  --surface: #161E0F;
  --surface2: #1E2815;
  --border: rgba(160,140,80,0.1);
  --border2: rgba(160,140,80,0.18);

  --ink: #EDE5D2;
  --ink2: #C8B898;
  --ink3: #8A7555;
  --ink4: #5A4D38;

  --green: #2DAA6E;
  --green2: #3EC480;
  --green3: #5ED898;
  --green-bg: rgba(45,170,110,0.1);
  --green-border: rgba(45,170,110,0.22);

  --gold: #C4993A;
  --gold2: #DCAF50;
  --gold3: #EDD070;
  --gold-bg: rgba(196,153,58,0.1);
  --gold-border: rgba(196,153,58,0.22);

  --red: #C03030;
  --red2: #E04545;
  --red-bg: rgba(192,48,48,0.1);
  --red-border: rgba(192,48,48,0.22);

  --purple: #8B60C0;
  --purple-bg: rgba(139,96,192,0.1);
  --purple-border: rgba(139,96,192,0.22);

  --shadow-xs: 0 1px 4px rgba(0,0,0,0.3);
  --shadow-sm: 0 2px 10px rgba(0,0,0,0.35);
  --shadow-md: 0 4px 24px rgba(0,0,0,0.42);
  --shadow-lg: 0 8px 48px rgba(0,0,0,0.5);
  --shadow-xl: 0 16px 64px rgba(0,0,0,0.6);
}

html { scroll-behavior: smooth; }
body {
  font-family: 'Tajawal', sans-serif;
  background: var(--bg);
  color: var(--ink);
  direction: rtl;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
  overflow-x: hidden;
}

/* ── Quran Font ── */
.font-quran {
  font-family: 'Scheherazade New', 'Noto Naskh Arabic', serif !important;
}

/* ── App Shell - Desktop ── */
.app-shell {
  display: flex;
  min-height: 100dvh;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  right: 0;
  height: 100dvh;
  z-index: 60;
  transition: transform 0.3s cubic-bezier(0.4,0,0.2,1);
}
.sidebar-brand {
  padding: 20px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.sidebar-logo {
  width: 38px; height: 38px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--green), var(--green2));
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(26,102,68,0.3);
}
.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink3);
  background: none;
  border: none;
  width: 100%;
  text-align: right;
  font-family: 'Tajawal', sans-serif;
  transition: all 0.18s;
  margin-bottom: 2px;
}
.sidebar-item:hover { background: var(--bg2); color: var(--ink); }
.sidebar-item.active {
  background: var(--green-bg);
  color: var(--green);
  border: 1px solid var(--green-border);
}
.sidebar-item.active svg { stroke: var(--green); }
.sidebar-badge {
  margin-right: auto;
  min-width: 20px; height: 20px;
  border-radius: 999px;
  background: var(--red2);
  color: white;
  font-size: 11px;
  font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  padding: 0 5px;
}

/* Main content */
.main-content {
  flex: 1;
  margin-right: var(--sidebar-w);
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}

/* Top bar */
.top-bar {
  height: var(--header-h);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(12px);
}

/* Page content */
.page-content {
  flex: 1;
  padding: 28px 28px 100px;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(100%);
  }
  .sidebar.open {
    transform: translateX(0);
    box-shadow: var(--shadow-xl);
  }
  .main-content {
    margin-right: 0;
  }
  .page-content {
    padding: 16px 16px 90px;
  }
  .top-bar {
    padding: 0 16px;
  }
  .hide-mobile { display: none !important; }
}

@media (min-width: 769px) {
  .bottom-nav { display: none !important; }
  .mobile-menu-btn { display: none !important; }
}

/* ── Bottom Nav (mobile) ── */
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 6px 4px max(8px, env(safe-area-inset-bottom));
  display: flex; justify-content: space-around;
  backdrop-filter: blur(14px);
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 6px 8px;
  border-radius: var(--r-md);
  cursor: pointer; background: none; border: none;
  color: var(--ink4);
  font-family: 'Tajawal', sans-serif;
  transition: all 0.18s; font-size: 10px; font-weight: 600;
  min-width: 52px;
}
.nav-item.active { color: var(--green); background: var(--green-bg); }

/* ── Cards ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-xs);
}
.card-flat {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
}
.card-hover {
  transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
  cursor: pointer;
}
.card-hover:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--border2); }

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  font-family: 'Tajawal', sans-serif;
  font-weight: 700; cursor: pointer; border: none; border-radius: var(--r-md);
  transition: all 0.18s; white-space: nowrap; outline: none;
}
.btn:active:not(:disabled) { transform: scale(0.96); }
.btn:disabled { opacity: 0.42; cursor: not-allowed; }

.btn-xs  { padding: 5px 10px; font-size: 12px; border-radius: var(--r-xs); }
.btn-sm  { padding: 8px 14px; font-size: 13px; }
.btn-md  { padding: 11px 20px; font-size: 14px; }
.btn-lg  { padding: 14px 28px; font-size: 16px; }
.btn-xl  { padding: 16px 32px; font-size: 17px; }

.btn-primary { background: var(--green); color: white; box-shadow: 0 3px 12px rgba(26,102,68,0.28); }
.btn-primary:hover:not(:disabled) { background: var(--green2); box-shadow: 0 5px 18px rgba(26,102,68,0.38); }

.btn-gold { background: var(--gold); color: white; box-shadow: 0 3px 12px rgba(154,110,32,0.25); }
.btn-gold:hover:not(:disabled) { background: var(--gold2); }

.btn-danger { background: var(--red2); color: white; }
.btn-danger:hover:not(:disabled) { background: var(--red); }

.btn-ghost { background: var(--bg2); color: var(--ink2); border: 1px solid var(--border); }
.btn-ghost:hover:not(:disabled) { background: var(--bg3); }

.btn-outline { background: transparent; color: var(--ink2); border: 1.5px solid var(--border2); }
.btn-outline:hover:not(:disabled) { background: var(--bg2); }

.btn-green-ghost { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.btn-green-ghost:hover:not(:disabled) { background: rgba(26,102,68,0.14); }

.btn-gold-ghost { background: var(--gold-bg); color: var(--gold); border: 1px solid var(--gold-border); }
.btn-red-ghost { background: var(--red-bg); color: var(--red2); border: 1px solid var(--red-border); }
.btn-red-ghost:hover:not(:disabled) { background: rgba(139,32,32,0.14); }

.btn-icon {
  width: 38px; height: 38px; padding: 0;
  border-radius: var(--r-md); background: var(--bg2); color: var(--ink2); border: 1px solid var(--border);
}
.btn-icon:hover:not(:disabled) { background: var(--bg3); }

.btn-circle {
  width: 44px; height: 44px; padding: 0;
  border-radius: 50%; background: var(--green); color: white;
  box-shadow: 0 3px 12px rgba(26,102,68,0.3);
}
.btn-circle:hover:not(:disabled) { background: var(--green2); }

/* ── Inputs ── */
.input {
  width: 100%; padding: 11px 14px;
  border-radius: var(--r-md); border: 1.5px solid var(--border2);
  background: var(--surface); color: var(--ink);
  font-family: 'Tajawal', sans-serif;
  font-size: 14px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  direction: rtl;
}
.input:focus { border-color: var(--green); box-shadow: 0 0 0 3px var(--green-bg); }
.input::placeholder { color: var(--ink4); }
select.input { cursor: pointer; }
textarea.input { resize: none; line-height: 1.7; }

/* ── Badge ── */
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 9px; border-radius: 999px;
  font-size: 11px; font-weight: 700;
}
.badge-green { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.badge-gold  { background: var(--gold-bg);  color: var(--gold);  border: 1px solid var(--gold-border); }
.badge-red   { background: var(--red-bg);   color: var(--red2);  border: 1px solid var(--red-border); }
.badge-gray  { background: var(--bg2); color: var(--ink3); border: 1px solid var(--border); }
.badge-purple{ background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-border); }

/* ── Progress ── */
.progress { height: 5px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
.progress-bar {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--green), var(--green3));
  transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
}
.progress-gold .progress-bar { background: linear-gradient(90deg, var(--gold), var(--gold3)); }

/* ── Divider ── */
.divider {
  display: flex; align-items: center; gap: 12px;
  color: var(--ink4); font-size: 12px;
}
.divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }

/* ── Tabs ── */
.tab-bar {
  display: flex; gap: 3px;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 4px;
}
.tab-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 8px; border-radius: var(--r-sm);
  font-size: 13px; font-weight: 600; cursor: pointer;
  color: var(--ink3); background: transparent; border: none;
  font-family: 'Tajawal', sans-serif;
  transition: all 0.18s;
}
.tab-item.active {
  background: var(--surface); color: var(--green);
  box-shadow: var(--shadow-sm);
}

/* ── Modal/Sheet ── */
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(6px);
  display: flex; align-items: flex-end; justify-content: center;
  animation: fadeIn 0.22s ease;
}
@media (min-width: 640px) { .overlay { align-items: center; } }

.sheet {
  width: 100%; max-width: 520px;
  background: var(--surface);
  border-radius: var(--r-2xl) var(--r-2xl) 0 0;
  padding: 0 0 max(28px, env(safe-area-inset-bottom));
  animation: slideUp 0.32s cubic-bezier(0.4,0,0.2,1);
  max-height: 92dvh; overflow-y: auto;
}
@media (min-width: 640px) {
  .sheet {
    border-radius: var(--r-2xl);
    animation: scaleIn 0.28s cubic-bezier(0.34,1.4,0.64,1);
  }
}
.sheet-handle { width: 36px; height: 4px; border-radius: 999px; background: var(--border2); margin: 14px auto 18px; }
.sheet-header { padding: 0 22px 16px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.sheet-body { padding: 0 22px; }
.sheet-footer { padding: 18px 22px 0; border-top: 1px solid var(--border); margin-top: 20px; }

/* ── Skeleton ── */
.skel {
  background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--r-md);
}

/* ── Calendar ── */
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
.cal-day {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  border-radius: var(--r-sm); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.15s; position: relative;
}
.cal-day.today { background: var(--green); color: white; }
.cal-day.has-plan { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.cal-day.past { color: var(--ink4); }
.cal-day:hover:not(.today) { background: var(--bg2); }
.cal-dot { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%; background: var(--gold); }

/* ── Audio Player ── */
.audio-player {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  height: auto;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 12px 20px max(12px, env(safe-area-inset-bottom));
  z-index: 80;
  box-shadow: 0 -4px 24px rgba(0,0,0,0.12);
  backdrop-filter: blur(14px);
  animation: slideUp 0.28s cubic-bezier(0.4,0,0.2,1);
}
@media (min-width: 769px) {
  .audio-player { right: var(--sidebar-w); }
}
.audio-progress { cursor: pointer; appearance: none; width: 100%; height: 3px; border-radius: 999px; background: var(--bg3); outline: none; }
.audio-progress::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--green); box-shadow: 0 1px 5px rgba(26,102,68,0.4); }

/* ── Quran Text ── */
.quran-text {
  font-family: 'Scheherazade New', 'Noto Naskh Arabic', serif;
  line-height: 2.7;
  color: var(--ink);
  text-align: justify;
  direction: rtl;
}
.quran-sm  { font-size: var(--quran-sm); }
.quran-md  { font-size: var(--quran-md); }
.quran-lg  { font-size: var(--quran-lg); }

.verse-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.85em; height: 1.85em; border-radius: 50%;
  background: var(--gold-bg); border: 1px solid var(--gold-border);
  color: var(--gold); font-size: 0.58em;
  font-family: 'Tajawal', sans-serif;
  vertical-align: middle; margin: 0 3px; flex-shrink: 0;
  cursor: pointer;
}
.verse-num:hover { background: var(--gold); color: white; }

.verse-span {
  cursor: pointer; border-radius: 4px;
  padding: 2px 3px; transition: background 0.15s;
  display: inline;
  -webkit-tap-highlight-color: transparent;
}
.verse-span:hover { background: var(--gold-bg); }
.verse-span.has-mistake { background: var(--red-bg); border-bottom: 2px solid var(--red2); }
.verse-span.selected { background: var(--green-bg); outline: 2px solid var(--green-border); border-radius: 4px; }
.verse-span.playing { background: var(--gold-bg); border-bottom: 2px solid var(--gold); }

.bismillah {
  text-align: center;
  font-family: 'Scheherazade New', serif;
  font-size: clamp(22px, 5vw, 30px);
  color: var(--gold2);
  padding: 20px;
  border-radius: var(--r-xl);
  background: linear-gradient(135deg, var(--gold-bg), var(--green-bg));
  border: 1px solid var(--gold-border);
  margin-bottom: 22px;
  line-height: 2;
}
.surah-header-divider {
  text-align: center; padding: 16px;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--gold-bg) 0%, var(--green-bg) 100%);
  border: 1px solid var(--border);
  margin: 24px 0;
}

/* ── Stat cards ── */
.stat-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 18px 14px;
  text-align: center; box-shadow: var(--shadow-xs);
}
.stat-num { font-size: 32px; font-weight: 900; line-height: 1; }
.stat-lbl { font-size: 11px; font-weight: 600; color: var(--ink3); margin-top: 6px; }

/* ── Settings ── */
.settings-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 0; border-bottom: 1px solid var(--border);
}
.settings-row:last-child { border-bottom: none; }

/* ── Switch ── */
.switch { position: relative; width: 46px; height: 26px; cursor: pointer; }
.switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.switch-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: var(--bg3); border: 1.5px solid var(--border2); transition: all 0.22s;
}
.switch input:checked + .switch-track { background: var(--green); border-color: var(--green); }
.switch-thumb {
  position: absolute; top: 4px; right: 4px;
  width: 16px; height: 16px; border-radius: 50%;
  background: white; transition: all 0.22s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}
.switch input:checked ~ .switch-thumb { right: calc(100% - 20px); }

/* ── Section Label ── */
.section-label {
  font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
  color: var(--ink4); text-transform: uppercase; margin-bottom: 12px;
}

/* ── Animations ── */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

.anim-fade-up { animation: fadeUp 0.38s ease both; }
.anim-fade-in { animation: fadeIn 0.28s ease both; }
.d1 { animation-delay: 0.06s; } .d2 { animation-delay: 0.12s; }
.d3 { animation-delay: 0.18s; } .d4 { animation-delay: 0.24s; }

.spin { animation: spin 1s linear infinite; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 999px; }

/* ── Utilities ── */
.full-w { width: 100%; }
.flex { display: flex; }
.flex-col { display: flex; flex-direction: column; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
.p-4 { padding: 16px; } .p-5 { padding: 20px; }
.mb-3 { margin-bottom: 12px; } .mb-4 { margin-bottom: 16px; }
.text-center { text-align: center; }
.no-select { user-select: none; -webkit-user-select: none; }

/* ── Tafsir ── */
.tafsir-text {
  font-size: 15px; line-height: 2.2; color: var(--ink2);
  font-family: 'Noto Naskh Arabic', serif;
}
.tafsir-text b, .tafsir-text strong { color: var(--green); }

/* ── Mistake card ── */
.mistake-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 14px 16px;
  box-shadow: var(--shadow-xs); transition: box-shadow 0.2s, border-color 0.2s;
}
.mistake-card:hover { box-shadow: var(--shadow-sm); border-color: var(--border2); }

/* ── Context hint ── */
.context-verse {
  background: var(--gold-bg); border: 1px solid var(--gold-border);
  border-radius: var(--r-lg); padding: 14px 16px; margin-bottom: 16px;
}

/* ── Review plan strip ── */
.plan-strip {
  background: linear-gradient(135deg, var(--green), var(--green2));
  border-radius: var(--r-xl); padding: 20px;
  color: white; position: relative; overflow: hidden;
}
.plan-strip::after {
  content: ''; position: absolute; top: -30px; left: -30px;
  width: 120px; height: 120px; border-radius: 50%;
  background: rgba(255,255,255,0.06);
}

/* ── Overlay backdrop for mobile sidebar ── */
.sidebar-backdrop {
  display: none;
  position: fixed; inset: 0; z-index: 59;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(3px);
}
.sidebar-backdrop.visible { display: block; animation: fadeIn 0.2s ease; }

/* ── Verse action menu ── */
.verse-menu {
  position: fixed;
  z-index: 200;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow-xl);
  min-width: 200px;
  overflow: hidden;
  animation: scaleIn 0.22s cubic-bezier(0.34,1.4,0.64,1);
  transform-origin: top center;
}
.verse-menu-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 16px; cursor: pointer;
  font-size: 14px; font-weight: 600; color: var(--ink2);
  transition: background 0.14s;
  background: none; border: none; width: 100%;
  font-family: 'Tajawal', sans-serif;
  text-align: right;
}
.verse-menu-item:hover { background: var(--bg2); color: var(--ink); }
.verse-menu-item + .verse-menu-item { border-top: 1px solid var(--border); }

/* ── Hizb/Quarter badge ── */
.hizb-divider {
  text-align: center; padding: 8px; margin: 10px 0;
  border-radius: var(--r-sm);
  background: var(--purple-bg); border: 1px solid var(--purple-border);
  font-size: 12px; font-weight: 700; color: var(--purple);
}

/* ── Input range ── */
input[type=range] {
  -webkit-appearance: none; width: 100%; height: 4px;
  border-radius: 999px; background: var(--bg3); outline: none; cursor: pointer;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
  background: var(--green); box-shadow: 0 2px 6px rgba(26,102,68,0.4);
}
`;

// ─── Audio Player Context ─────────────────────────────────────────────────────
let globalAudioRef = null;

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [settings, setSettingsState] = useState(getSettings());
  const [screen, setScreen] = useState('home');
  const [reviewRange, setReviewRange] = useState({ from: 1, to: 10 });
  const [fixMistake, setFixMistake] = useState(null);
  const [navTab, setNavTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Audio player state
  const [audioState, setAudioState] = useState({
    playing: false,
    verseKey: null,
    verseText: null,
    currentTime: 0,
    duration: 0,
    loading: false,
  });
  const audioRef = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  useEffect(() => {
    const m = getMistakes();
    setPendingCount(m.filter(x => !x.resolved).length);
  }, [screen]);

  const updateSettings = updates => {
    const next = { ...settings, ...updates };
    setSettingsState(next);
    saveSettings(next);
    document.documentElement.classList.toggle('dark', next.darkMode);
  };

  const goTo = tab => {
    setNavTab(tab);
    setScreen(tab === 'home' ? 'home' : tab === 'calendar' ? 'calendar' : tab === 'mistakes' ? 'mistakes_list' : tab === 'quarters' ? 'quarters' : 'settings');
    setSidebarOpen(false);
  };

  const startReview = (from, to) => {
    setReviewRange({ from, to });
    setScreen('review');
  };

  const openFixMode = m => {
    setFixMistake(m);
    setScreen('fix');
  };

  // Audio controls
  const playAudio = useCallback(
    async (surah, ayah, verseKey, verseText) => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      const audio = new Audio();
      audioRef.current = audio;
      globalAudioRef = audio;

      // Use Quran.com audio API
      const url = `https://verses.quran.com/${settings.reciter || '7'}/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;

      setAudioState(s => ({ ...s, verseKey, verseText, loading: true, playing: false, currentTime: 0, duration: 0 }));

      audio.src = url;
      audio.onloadedmetadata = () => {
        setAudioState(s => ({ ...s, duration: audio.duration, loading: false }));
      };
      audio.ontimeupdate = () => {
        setAudioState(s => ({ ...s, currentTime: audio.currentTime }));
      };
      audio.onended = () => {
        setAudioState(s => ({ ...s, playing: false }));
      };
      audio.onerror = () => {
        // Fallback to islamic.network CDN
        const fallback = `https://cdn.islamic.network/quran/audio/128/${settings.reciter || '7'}/${parseInt(surah) * 1000 + parseInt(ayah)}.mp3`;
        audio.src = fallback;
        audio.load();
        audio
          .play()
          .then(() => {
            setAudioState(s => ({ ...s, playing: true, loading: false }));
          })
          .catch(() => {
            setAudioState(s => ({ ...s, loading: false }));
          });
        return;
      };
      try {
        await audio.play();
        setAudioState(s => ({ ...s, playing: true, loading: false }));
      } catch {
        setAudioState(s => ({ ...s, loading: false }));
      }
    },
    [settings.reciter],
  );

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => setAudioState(s => ({ ...s, playing: true })));
    } else {
      audioRef.current.pause();
      setAudioState(s => ({ ...s, playing: false }));
    }
  };

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setAudioState({ playing: false, verseKey: null, verseText: null, currentTime: 0, duration: 0, loading: false });
  };

  const seekAudio = t => {
    if (audioRef.current) {
      audioRef.current.currentTime = t;
    }
    setAudioState(s => ({ ...s, currentTime: t }));
  };

  const hasPlayer = !!audioState.verseKey;
  const playerPadding = hasPlayer ? 'calc(72px + env(safe-area-inset-bottom, 0px))' : undefined;

  const navItems = [
    { id: 'home', label: 'الرئيسية', Icon: LayoutDashboard },
    { id: 'calendar', label: 'الجدول', Icon: Calendar },
    { id: 'mistakes', label: 'الأخطاء', Icon: List },
    { id: 'quarters', label: 'الأرباع', Icon: Grid3X3 },
    { id: 'settings', label: 'الإعدادات', Icon: Settings },
  ];

  const renderScreen = () => {
    if (screen === 'review')
      return (
        <ReviewPage
          from={reviewRange.from}
          to={reviewRange.to}
          settings={settings}
          onFinish={() => {
            setNavTab('home');
            setScreen('home');
          }}
          onPlayAudio={playAudio}
          playingKey={audioState.verseKey}
          extraPadding={hasPlayer ? '82px' : '80px'}
        />
      );
    if (screen === 'fix')
      return (
        <FixMode
          mistake={fixMistake}
          settings={settings}
          onBack={() => setScreen('mistakes_list')}
          onDone={() => {
            setFixMistake(null);
            setScreen('mistakes_list');
          }}
        />
      );
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ paddingBottom: playerPadding }}>
          {screen === 'home' && <HomeScreen onStartReview={startReview} settings={settings} />}
          {screen === 'calendar' && <CalendarScreen onStartReview={startReview} />}
          {screen === 'mistakes_list' && <MistakesScreen onFix={openFixMode} onCountChange={setPendingCount} />}
          {screen === 'quarters' && <QuartersScreen onPlayAudio={playAudio} settings={settings} />}
          {screen === 'settings' && <SettingsScreen settings={settings} onChange={updateSettings} />}
        </div>
      </div>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className='app-shell'>
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className='sidebar-brand'>
            <div className='sidebar-logo'>
              <BookOpen size={20} color='white' />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--green)' }}>مراجع</div>
              <div style={{ fontSize: 11, color: 'var(--ink4)' }}>القرآن الكريم</div>
            </div>
          </div>
          <nav className='sidebar-nav'>
            {navItems.map(({ id, label, Icon }) => (
              <button key={id} className={`sidebar-item ${navTab === id ? 'active' : ''}`} onClick={() => goTo(id)}>
                <Icon size={18} strokeWidth={1.8} />
                <span>{label}</span>
                {id === 'mistakes' && pendingCount > 0 && <span className='sidebar-badge'>{pendingCount}</span>}
              </button>
            ))}
          </nav>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 13, color: 'var(--ink4)', textAlign: 'center' }}>﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾</div>
          </div>
        </aside>

        {/* Sidebar backdrop (mobile) */}
        <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Main */}
        <div className='main-content'>
          {/* Top bar */}
          <header className='top-bar'>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className='btn btn-icon mobile-menu-btn' onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Menu size={18} />
              </button>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)' }}>{navItems.find(n => n.id === navTab)?.label || 'مراجع'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {pendingCount > 0 && <span className='badge badge-red'>{pendingCount} خطأ معلّق</span>}
              <button className='btn btn-icon' onClick={() => updateSettings({ darkMode: !settings.darkMode })}>
                {settings.darkMode ? <Sun size={17} /> : <Moon size={17} />}
              </button>
            </div>
          </header>

          {/* Screen content */}
          {renderScreen()}
        </div>

        {/* Bottom nav (mobile) */}
        {screen !== 'review' && screen !== 'fix' && (
          <nav className='bottom-nav'>
            {navItems.map(({ id, label, Icon }) => (
              <button key={id} className={`nav-item ${navTab === id ? 'active' : ''}`} onClick={() => goTo(id)}>
                <Icon size={21} strokeWidth={1.8} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Audio Player */}
        {hasPlayer && <AudioPlayer state={audioState} onToggle={togglePlayPause} onClose={closePlayer} onSeek={seekAudio} />}
      </div>
    </>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ state, onToggle, onClose, onSeek }) {
  const { playing, verseKey, verseText, currentTime, duration, loading } = state;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className='audio-player'>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        {/* Verse info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 1 }}>الآية {verseKey}</div>
          {verseText && (
            <div className='quran-text' style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {verseText.slice(0, 50)}
              {verseText.length > 50 ? '...' : ''}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--ink4)', minWidth: 36 }}>{formatTime(currentTime)}</span>
          <button className='btn-circle' onClick={onToggle} style={{ width: 42, height: 42 }} disabled={loading}>
            {loading ? <Loader2 size={18} className='spin' color='white' /> : playing ? <Pause size={18} color='white' /> : <Play size={18} color='white' />}
          </button>
          <span style={{ fontSize: 12, color: 'var(--ink4)', minWidth: 36 }}>{formatTime(duration)}</span>
          <button className='btn btn-icon btn-sm' onClick={onClose} style={{ width: 34, height: 34 }}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <input
        type='range'
        className='audio-progress'
        min={0}
        max={duration || 100}
        step={0.1}
        value={currentTime}
        onChange={e => onSeek(Number(e.target.value))}
        style={{
          background: `linear-gradient(to left, var(--bg3) ${100 - progress}%, var(--green) ${100 - progress}%)`,
        }}
      />
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ onStartReview, settings }) {
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0, sessions: 0 });
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [todayPlan, setTodayPlan] = useState(null);
  const [reviewPlan, setReviewPlan] = useState(getReviewPlan());
  const [recentSessions, setRecentSessions] = useState([]);

  useEffect(() => {
    const m = getMistakes();
    const sess = getSessions();
    setStats({
      total: m.length,
      resolved: m.filter(x => x.resolved).length,
      pending: m.filter(x => !x.resolved).length,
      sessions: sess.length,
    });
    setStreak(getStreak());
    const todayStr = new Date().toISOString().split('T')[0];
    const sched = getSchedule();
    setTodayPlan(sched.find(s => s.date === todayStr) || null);
    setRecentSessions(sess.slice(-3).reverse());
  }, []);

  const resolvedPct = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className='page-content'>
      {/* Welcome + streak */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }} className='anim-fade-up'>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>مرحباً بك</h1>
          <p style={{ fontSize: 14, color: 'var(--ink3)' }}>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        {streak.current > 0 && (
          <div style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', padding: '10px 16px', textAlign: 'center' }}>
            <Flame size={20} color='var(--gold2)' style={{ marginBottom: 2 }} />
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--gold)', lineHeight: 1 }}>{streak.current}</div>
            <div style={{ fontSize: 10, color: 'var(--ink4)', fontWeight: 600 }}>يوم متواصل</div>
          </div>
        )}
      </div>

      {/* Today plan banner */}
      {todayPlan ? (
        <div className='plan-strip anim-fade-up d1' style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.75, fontWeight: 700, marginBottom: 4 }}>مراجعة اليوم</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2 }}>
                صفحات {todayPlan.from} – {todayPlan.to}
              </div>
              {todayPlan.note && <div style={{ fontSize: 12, opacity: 0.7 }}>{todayPlan.note}</div>}
            </div>
            <button onClick={() => onStartReview(todayPlan.from, todayPlan.to)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '10px 20px', borderRadius: 'var(--r-md)', fontFamily: "'Tajawal', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              ابدأ الآن <ChevronLeft size={16} />
            </button>
          </div>
        </div>
      ) : (
        reviewPlan.enabled && (
          <div className='card anim-fade-up d1' style={{ padding: 16, marginBottom: 20, borderColor: 'var(--green-border)', background: 'var(--green-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginBottom: 2 }}>خطة المراجعة اليومية</div>
                <div style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 700 }}>
                  مراجعة {reviewPlan.dailyReview} صفحات · حفظ {reviewPlan.dailyMemorize} صفحات
                </div>
              </div>
              <button className='btn btn-primary btn-sm' onClick={() => setShowModal(true)}>
                ابدأ
              </button>
            </div>
          </div>
        )
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }} className='anim-fade-up d2'>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--ink)' }}>
            {stats.total}
          </div>
          <div className='stat-lbl'>إجمالي الأخطاء</div>
        </div>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--green)' }}>
            {stats.resolved}
          </div>
          <div className='stat-lbl'>تم حلها</div>
        </div>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--red2)' }}>
            {stats.pending}
          </div>
          <div className='stat-lbl'>معلّقة</div>
        </div>
      </div>

      {/* Progress */}
      {stats.total > 0 && (
        <div className='card anim-fade-up d2' style={{ padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>نسبة إنجاز المراجعة</span>
            <span style={{ fontSize: 16, fontWeight: 900, color: 'var(--green)' }}>{resolvedPct}%</span>
          </div>
          <div className='progress'>
            <div className='progress-bar' style={{ width: `${resolvedPct}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 8 }}>
            {stats.resolved} من {stats.total} خطأ تمت مراجعتهم
          </div>
        </div>
      )}

      {/* Main CTA */}
      <button
        className='anim-fade-up d3'
        onClick={() => setShowModal(true)}
        style={{
          width: '100%',
          padding: '22px 24px',
          borderRadius: 'var(--r-xl)',
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--green) 0%, var(--green2) 60%, var(--green3) 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 8px 30px rgba(26,102,68,0.35)',
          transition: 'all 0.22s',
          marginBottom: 14,
          fontFamily: "'Tajawal', sans-serif",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(26,102,68,0.45)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(26,102,68,0.35)';
        }}>
        <div style={{ width: 52, height: 52, borderRadius: '14px', background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BookOpen size={26} color='white' />
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: 19, marginBottom: 3 }}>ابدأ مراجعة جديدة</div>
          <div style={{ fontSize: 13, opacity: 0.78 }}>اختر نطاق الصفحات وابدأ الآن</div>
        </div>
        <ChevronLeft size={22} opacity={0.6} />
      </button>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className='anim-fade-up d4'>
          <div className='section-label' style={{ marginBottom: 10 }}>
            آخر الجلسات
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentSessions.map((s, i) => (
              <div key={i} className='card-flat' style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                    صفحات {s.fromPage} – {s.toPage}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>{formatDate(s.date)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{s.mistakeCount > 0 ? <span className='badge badge-red'>{s.mistakeCount} خطأ</span> : <span className='badge badge-green'>نظيف ✓</span>}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showModal && (
        <StartReviewModal
          onStart={(f, t) => {
            setShowModal(false);
            onStartReview(f, t);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

// ─── Start Review Modal ───────────────────────────────────────────────────────
function StartReviewModal({ onStart, onClose }) {
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [err, setErr] = useState('');
  const [surahs, setSurahs] = useState([]);
  const [mode, setMode] = useState('pages'); // pages | surah

  useEffect(() => {
    fetchSurahList().then(setSurahs);
  }, []);

  const validate = () => {
    if (from < 1 || from > 604 || to < from || to > 604) {
      setErr('تحقق من أرقام الصفحات (1 – 604)');
      return false;
    }
    return true;
  };

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={22} color='var(--green)' />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>ابدأ مراجعة</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>اختر نطاق الصفحات</div>
            </div>
          </div>
        </div>

        <div className='sheet-body'>
          {/* Mode toggle */}
          <div className='tab-bar' style={{ marginBottom: 16 }}>
            <button className={`tab-item ${mode === 'pages' ? 'active' : ''}`} onClick={() => setMode('pages')}>
              <Hash size={14} /> بالصفحات
            </button>
            <button className={`tab-item ${mode === 'surah' ? 'active' : ''}`} onClick={() => setMode('surah')}>
              <BookText size={14} /> بالسورة
            </button>
          </div>

          {mode === 'pages' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                {[
                  {
                    label: 'من صفحة',
                    val: from,
                    set: v => {
                      setFrom(v);
                      setErr('');
                    },
                  },
                  {
                    label: 'إلى صفحة',
                    val: to,
                    set: v => {
                      setTo(v);
                      setErr('');
                    },
                  },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 6 }}>{f.label}</label>
                    <input type='number' min={1} max={604} value={f.val} onChange={e => f.set(Number(e.target.value))} className='input' style={{ textAlign: 'center', fontSize: 24, fontWeight: 900, color: 'var(--green)', padding: '10px' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  { l: 'صفحة', d: 1 },
                  { l: '5 صفحات', d: 4 },
                  { l: '10 صفحات', d: 9 },
                  { l: '20 صفحة', d: 19 },
                  { l: 'نصف جزء', d: 9 },
                ].map(p => (
                  <button
                    key={p.l}
                    onClick={() => {
                      setTo(Math.min(604, from + p.d));
                      setErr('');
                    }}
                    style={{ padding: '6px 13px', borderRadius: '999px', border: '1.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Tajawal', sans-serif", transition: 'all 0.15s' }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
              {surahs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink4)' }}>
                  <Loader2 size={24} className='spin' style={{ margin: '0 auto 8px' }} />
                  <div>جارٍ تحميل قائمة السور...</div>
                </div>
              ) : (
                surahs.map(s => (
                  <button
                    key={s.id}
                    style={{ width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: "'Tajawal', sans-serif", marginBottom: 2 }}
                    onClick={() => {
                      // Use surah's page range from API data
                      const pg = s.pages?.[0] || 1;
                      const pgEnd = s.pages?.[s.pages.length - 1] || pg + 2;
                      setFrom(pg);
                      setTo(pgEnd);
                      setMode('pages');
                      setErr('');
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--gold)', flexShrink: 0 }}>{s.id}</div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Scheherazade New', serif", fontWeight: 700, fontSize: 15 }}>{s.name_arabic}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink4)' }}>{s.verses_count} آية</div>
                    </div>
                    <ChevronLeft size={14} color='var(--ink4)' />
                  </button>
                ))
              )}
            </div>
          )}

          <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', marginBottom: 14, textAlign: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--green)' }}>
              {Math.max(0, to - from + 1)} {to - from + 1 === 1 ? 'صفحة' : 'صفحات'}
            </span>
          </div>
          {err && <div style={{ color: 'var(--red2)', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{err}</div>}
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
            إلغاء
          </button>
          <button
            className='btn btn-primary btn-md'
            style={{ flex: 2, fontSize: 16, fontWeight: 900 }}
            onClick={() => {
              if (validate()) onStart(from, to);
            }}>
            ابدأ المراجعة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Review Page ──────────────────────────────────────────────────────────────
function ReviewPage({ from, to, settings, onFinish, onPlayAudio, playingKey, extraPadding }) {
  const [page, setPage] = useState(from);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionMistakes, setSessionMistakes] = useState([]);
  const [pageMistakes, setPageMistakes] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [activeVerse, setActiveVerse] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [showMistakeModal, setShowMistakeModal] = useState(false);
  const [showTafsirModal, setShowTafsirModal] = useState(false);
  const [pendingAudioVerse, setPendingAudioVerse] = useState(null);
  const sessionStart = useRef(new Date().toISOString());
  const touchX = useRef(null);
  const menuRef = useRef(null);

  const qSizeClass = { sm: 'quran-sm', md: 'quran-md', lg: 'quran-lg' }[settings.quranFontSize] || 'quran-md';

  const loadPage = useCallback(async () => {
    setLoading(true);
    setActiveVerse(null);
    setMenuPos(null);
    const v = await fetchPageVerses(page);
    setVerses(v);
    setLoading(false);
    setPageMistakes(getMistakes().filter(m => m.page === page));
  }, [page]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Close menu on outside click
  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        closeMenu();
      }
    };

    document.addEventListener('click', handler);

    return () => {
      document.removeEventListener('click', handler);
    };
  }, []);
  const handleMenuAction = action => e => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };
  const handleVerseClick = (verse, e) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const menuH = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > menuH ? rect.bottom + 6 : rect.top - menuH - 6;

    setActiveVerse(verse);
    setMenuPos({
      top: Math.max(8, Math.min(top, window.innerHeight - menuH - 8)),
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 212)),
    });
  };

  const closeMenu = () => {
    setActiveVerse(null);
    setMenuPos(null);
  };
  const handleFinish = () => {
    saveSession({ id: genId(), date: sessionStart.current, fromPage: from, toPage: to, pageCount: to - from + 1, mistakeCount: sessionMistakes.length });
    updateStreak();
    setShowSummary(true);
  };

  const onMistakeSaved = m => {
    setSessionMistakes(p => [...p, m]);
    setShowMistakeModal(false);
    setActiveVerse(null);
    setMenuPos(null);
    setPageMistakes(getMistakes().filter(x => x.page === page));
  };

  const handlePlayAudio = verse => {
    const [surah, ayah] = verse.verse_key.split(':');
    onPlayAudio(surah, ayah, verse.verse_key, verse.text_uthmani);
    closeMenu();
  };

  const total = to - from + 1;
  const progress = ((page - from) / total) * 100;
  const mistakeKeys = new Set(pageMistakes.map(m => m.verseKey).filter(Boolean));

  // Group by surah
  const groups = [];
  let lastHizb = null;
  verses.forEach(v => {
    const s = v.verse_key?.split(':')?.[0];
    // Track hizb quarters
    if (v.hizb_number && v.hizb_number !== lastHizb) {
      lastHizb = v.hizb_number;
    }
    const last = groups[groups.length - 1];
    if (!last || last.surah !== s) groups.push({ surah: s, verses: [v] });
    else last.verses.push(v);
  });

  if (showSummary) return <SessionSummary mistakes={sessionMistakes} from={from} to={to} onDone={onFinish} />;

  return (
    <div
      style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}
      onTouchStart={e => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={e => {
        if (!touchX.current) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 65) {
          if (dx < 0 && page < to) setPage(p => p + 1);
          else if (dx > 0 && page > from) setPage(p => p - 1);
        }
        touchX.current = null;
      }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 18px', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <button className='btn btn-sm' style={{ background: 'var(--red-bg)', color: 'var(--red2)', border: '1px solid var(--red-border)', gap: 4 }} onClick={handleFinish}>
            <Check size={14} /> أنهيت
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>صفحة {page}</div>
            <div style={{ fontSize: 11, color: 'var(--ink4)' }}>
              {page - from + 1} / {total}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>{sessionMistakes.length > 0 && <span className='badge badge-red'>{sessionMistakes.length}</span>}</div>
        </div>
        <div className='progress'>
          <div className='progress-bar' style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `20px 18px ${extraPadding || '110px'}` }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className='skel' style={{ height: 52, opacity: 0.6 }} />
            ))}
          </div>
        ) : (
          <>
            {verses[0]?.verse_number === 1 && <div className='bismillah'>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}
            <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 11, color: 'var(--ink4)', padding: '6px 12px', borderRadius: 'var(--r-sm)', background: 'var(--bg2)', display: 'inline-block', width: '100%' }}>اضغط على آية للاستماع أو تسجيل خطأ أو عرض التفسير · اسحب للتنقل بين الصفحات</div>

            {groups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: 22 }}>
                {group.verses[0]?.verse_number === 1 && gi > 0 && (
                  <div className='surah-header-divider'>
                    <div className='quran-text' style={{ fontSize: 13, color: 'var(--gold2)' }}>
                      ـ ـ ـ سورة جديدة ـ ـ ـ
                    </div>
                    <div className='quran-text' style={{ fontSize: 22, color: 'var(--gold3)', marginTop: 6 }}>
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </div>
                  </div>
                )}
                <div className={`quran-text ${qSizeClass}`}>
                  {group.verses.map(verse => {
                    const hasMistake = mistakeKeys.has(verse.verse_key);
                    const isActive = activeVerse?.id === verse.id;
                    const isPlaying = playingKey === verse.verse_key;
                    return (
                      <span key={verse.id}>
                        <span className={`verse-span ${hasMistake ? 'has-mistake' : ''} ${isActive ? 'selected' : ''} ${isPlaying ? 'playing' : ''}`} onClick={e => handleVerseClick(verse, e)}>
                          {verse.text_uthmani}
                        </span>
                        <span className='verse-num' onClick={e => handleVerseClick(verse, e)}>
                          {toAr(verse.verse_number)}
                        </span>{' '}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Verse action menu */}
      {menuPos && activeVerse && (
        <div ref={menuRef} className='verse-menu' onClick={e => e.stopPropagation()} style={{ top: menuPos.top, left: menuPos.left, right: 'auto', width: 210 }}>
          <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--ink4)', fontWeight: 700 }}>الآية {activeVerse.verse_key}</div>
          </div>
          <button
            className='verse-menu-item'
            onClick={handleMenuAction(() => {
              setShowMistakeModal(true);
              closeMenu();
            })}>
            <Plus size={15} color='var(--red2)' /> تسجيل خطأ
          </button>

          <button
            className='verse-menu-item'
            onClick={handleMenuAction(() => {
              setShowTafsirModal(true);
              closeMenu();
            })}>
            <BookText size={15} color='var(--green)' /> عرض التفسير
          </button>

          <button
            className='verse-menu-item'
            onClick={handleMenuAction(() => {
              handlePlayAudio(activeVerse);
            })}>
            <Volume2 size={15} color='var(--gold)' /> استمع للآية
          </button>
        </div>
      )}

      {/* Bottom controls */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '10px 16px max(14px,env(safe-area-inset-bottom))', zIndex: 30, backdropFilter: 'blur(12px)' }}>
        {/* Page pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 10, overflowX: 'auto' }}>
          {Array.from({ length: Math.min(9, total) }).map((_, i) => {
            const offset = Math.max(0, Math.min(page - from - 4, total - 9));
            const p = from + offset + i;
            if (p > to) return null;
            const isCur = p === page;
            return (
              <button key={p} onClick={() => setPage(p)} style={{ minWidth: isCur ? 38 : 30, height: 30, borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: isCur ? 900 : 500, background: isCur ? 'var(--green)' : 'var(--bg2)', color: isCur ? 'white' : 'var(--ink3)', transition: 'all 0.18s', fontFamily: "'Tajawal', sans-serif", flexShrink: 0 }}>
                {p}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1, gap: 6 }} disabled={page <= from} onClick={() => setPage(p => p - 1)}>
            <ChevronRight size={17} /> السابقة
          </button>
          <button
            className='btn btn-primary btn-md'
            style={{ flex: 1, gap: 6 }}
            onClick={() => {
              if (page < to) setPage(p => p + 1);
              else handleFinish();
            }}>
            {page < to ? 'التالية' : 'إنهاء'} <ChevronLeft size={17} />
          </button>
        </div>
      </div>

      {/* Mistake Modal */}
      {showMistakeModal && activeVerse && <MistakeModal page={page} verseKey={activeVerse.verse_key} verseText={activeVerse.text_uthmani} onClose={() => setShowMistakeModal(false)} onSaved={onMistakeSaved} />}

      {/* Tafsir Modal */}
      {showTafsirModal && activeVerse && <TafsirModal verseKey={activeVerse.verse_key} verseText={activeVerse.text_uthmani} tafsirId={settings.defaultTafsir} onClose={() => setShowTafsirModal(false)} />}
    </div>
  );
}

// ─── Session Summary ──────────────────────────────────────────────────────────
function SessionSummary({ mistakes, from, to, onDone }) {
  const pages = [...new Set(mistakes.map(m => m.page))];
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className='card anim-fade-up' style={{ padding: '40px 28px', maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, borderRadius: '22px', background: mistakes.length === 0 ? 'var(--green-bg)' : 'var(--gold-bg)', border: `2px solid ${mistakes.length === 0 ? 'var(--green-border)' : 'var(--gold-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 22px' }}>{mistakes.length === 0 ? <CheckCircle size={38} color='var(--green)' /> : <BarChart2 size={38} color='var(--gold)' />}</div>
        <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>{mistakes.length === 0 ? 'مراجعة نظيفة 🌟' : 'ملخص الجلسة'}</h2>
        <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 28 }}>
          صفحات {from} – {to}
        </p>

        {mistakes.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
              {[
                { val: mistakes.length, lbl: 'أخطاء مسجّلة', color: 'var(--red2)' },
                { val: pages.length, lbl: 'صفحات متأثرة', color: 'var(--gold)' },
              ].map((s, i) => (
                <div key={i} className='card-flat' style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            {pages.length > 0 && (
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'var(--bg2)', marginBottom: 22, textAlign: 'right' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink4)', marginBottom: 8 }}>الصفحات المتأثرة</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {pages.map(p => (
                    <span key={p} className='badge badge-gold'>
                      ص {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '22px', borderRadius: '16px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', marginBottom: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', marginBottom: 4 }}>ما شاء الله!</div>
            <div style={{ fontSize: 14, color: 'var(--green2)' }}>لم تسجّل أي أخطاء في هذه المراجعة</div>
          </div>
        )}

        <button className='btn btn-primary btn-lg' style={{ width: '100%' }} onClick={onDone}>
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}

// ─── Mistake Modal ────────────────────────────────────────────────────────────
function MistakeModal({ page, verseKey, verseText, onClose, onSaved }) {
  const [type, setType] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const save = () => {
    if (!type) {
      setErr('اختر نوع الخطأ');
      return;
    }
    setSaving(true);
    const m = {
      id: genId(),
      page,
      verseKey,
      verseText: verseText?.slice(0, 100),
      type,
      note,
      date: new Date().toISOString(),
      resolved: false,
      repetitionCount: 0,
      successCount: 0,
    };
    saveMistake(m);
    setTimeout(() => onSaved(m), 280);
  };

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 18 }}>تسجيل خطأ</div>
            <span className='badge badge-gold'>صفحة {page}</span>
          </div>
        </div>
        <div className='sheet-body'>
          {verseText && (
            <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--bg2)', border: '1px solid var(--border)', marginBottom: 18 }}>
              <div className='quran-text' style={{ fontSize: 17, lineHeight: 2.2 }}>
                {verseText.slice(0, 90)}
                {verseText.length > 90 ? '...' : ''}
              </div>
              {verseKey && <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 6 }}>الآية {verseKey}</div>}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 10 }}>نوع الخطأ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ERROR_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setType(t.id);
                    setErr('');
                  }}
                  style={{
                    padding: '13px 10px',
                    borderRadius: '12px',
                    border: `2px solid ${type === t.id ? t.color : 'var(--border2)'}`,
                    background: type === t.id ? `${t.color}15` : 'var(--surface2)',
                    cursor: 'pointer',
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontFamily: "'Tajawal', sans-serif",
                    fontWeight: 700,
                    fontSize: 13,
                    color: type === t.id ? t.color : 'var(--ink2)',
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 8 }}>ملاحظة (اختياري)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder='اكتب ملاحظة للمراجعة لاحقاً...' className='input' />
          </div>
          {err && <div style={{ color: 'var(--red2)', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>{err}</div>}
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
            إلغاء
          </button>
          <button className='btn btn-danger btn-md' style={{ flex: 1 }} disabled={saving} onClick={save}>
            {saving ? (
              <>
                <Loader2 size={15} className='spin' /> جارٍ الحفظ...
              </>
            ) : (
              'تسجيل الخطأ'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tafsir Modal ─────────────────────────────────────────────────────────────
function TafsirModal({ verseKey, verseText, tafsirId, onClose }) {
  const [tafsir, setTafsir] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetchTafsir(verseKey, tafsirId).then(t => {
      setTafsir(t);
      setLoading(false);
      if (!t) setError(true);
    });
  }, [verseKey, tafsirId]);

  const cleanText = html => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' style={{ maxHeight: '90dvh' }} onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>التفسير</div>
              <div style={{ fontSize: 12, color: 'var(--ink4)' }}>الآية {verseKey}</div>
            </div>
            <button className='btn btn-icon' onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className='sheet-body' style={{ paddingBottom: 20 }}>
          {verseText && (
            <div style={{ padding: '16px 18px', borderRadius: '14px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', marginBottom: 22 }}>
              <div className='quran-text quran-md' style={{ textAlign: 'center', lineHeight: 2.4 }}>
                {verseText}
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className='skel' style={{ height: 18, opacity: 0.6 }} />
              ))}
            </div>
          ) : error || !tafsir?.text ? (
            <div style={{ textAlign: 'center', color: 'var(--ink4)', padding: '28px 0' }}>
              <AlertCircle size={28} style={{ marginBottom: 10 }} />
              <div style={{ fontWeight: 600 }}>لم يتم العثور على تفسير لهذه الآية</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>جرّب تفسيراً آخر من الإعدادات</div>
            </div>
          ) : (
            <div className='tafsir-text'>{cleanText(tafsir.text)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mistakes Screen ──────────────────────────────────────────────────────────
function MistakesScreen({ onFix, onCountChange }) {
  const [mistakes, setMistakes] = useState([]);
  const [tab, setTab] = useState('pending');
  const [filterPage, setFilterPage] = useState('');
  const [filterType, setFilterType] = useState('');

  const load = () => {
    const m = getMistakes();
    setMistakes(m);
    onCountChange?.(m.filter(x => !x.resolved).length);
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = mistakes.filter(m => {
    if (tab === 'pending' && m.resolved) return false;
    if (tab === 'resolved' && !m.resolved) return false;
    if (filterPage && m.page !== Number(filterPage)) return false;
    if (filterType && m.type !== filterType) return false;
    return true;
  });

  const pages = [...new Set(mistakes.map(m => m.page))].sort((a, b) => a - b);
  const pending = mistakes.filter(m => !m.resolved);

  const grouped = {};
  filtered.forEach(m => {
    const d = m.date?.split('T')[0] || 'unknown';
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  const handleDelete = id => {
    if (!confirm('هل تريد حذف هذا الخطأ؟')) return;
    deleteMistake(id);
    load();
  };

  const markResolved = id => {
    updateMistake(id, { resolved: true });
    load();
  };

  return (
    <div className='page-content'>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>سجل الأخطاء</h1>
        <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
          {mistakes.length} خطأ مسجّل · {pending.length} معلّق
        </p>
      </div>

      {/* Stats */}
      {mistakes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'الكل', val: mistakes.length, color: 'var(--ink)' },
            { label: 'معلّق', val: pending.length, color: 'var(--red2)' },
            { label: 'منجز', val: mistakes.filter(x => x.resolved).length, color: 'var(--green)' },
            { label: 'صفحات', val: new Set(mistakes.map(m => m.page)).size, color: 'var(--gold)' },
          ].map((s, i) => (
            <div key={i} className='stat-card' style={{ padding: '12px 10px' }}>
              <div className='stat-num' style={{ fontSize: 24, color: s.color }}>
                {s.val}
              </div>
              <div className='stat-lbl'>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className='tab-bar'>
          {[
            { id: 'pending', l: 'معلّق' },
            { id: 'resolved', l: 'منجز' },
            { id: 'all', l: 'الكل' },
          ].map(t => (
            <button key={t.id} className={`tab-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.l}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <select value={filterPage} onChange={e => setFilterPage(e.target.value)} className='input' style={{ padding: '9px 12px', fontSize: 13 }}>
            <option value=''>كل الصفحات</option>
            {pages.map(p => (
              <option key={p} value={p}>
                صفحة {p}
              </option>
            ))}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className='input' style={{ padding: '9px 12px', fontSize: 13 }}>
            <option value=''>كل الأنواع</option>
            {ERROR_TYPES.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Hard mistakes CTA */}
      {tab === 'pending' && pending.filter(m => m.repetitionCount > 2).length > 0 && (
        <div className='card' style={{ padding: '14px 16px', marginBottom: 16, background: 'var(--red-bg)', borderColor: 'var(--red-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red2)' }}>أخطاء صعبة تحتاج مراجعة</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>{pending.filter(m => m.repetitionCount > 2).length} أخطاء تكررت أكثر من مرتين</div>
          </div>
          <button
            className='btn btn-danger btn-sm'
            onClick={() => {
              const hard = pending.filter(m => m.repetitionCount > 2);
              if (hard.length) onFix(hard[0]);
            }}>
            ابدأ
          </button>
        </div>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <CheckCircle size={50} color='var(--green)' style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink2)' }}>{tab === 'pending' ? 'لا أخطاء معلّقة 🎉' : 'لا توجد نتائج'}</div>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>{formatDate(date)}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className='badge badge-gray'>{grouped[date].length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grouped[date].map(m => (
                <MistakeCard key={m.id} mistake={m} onDelete={() => handleDelete(m.id)} onFix={() => onFix(m)} onResolve={() => markResolved(m.id)} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MistakeCard({ mistake, onDelete, onFix, onResolve }) {
  const errType = ERROR_TYPES.find(t => t.id === mistake.type);
  return (
    <div className='mistake-card' style={{ opacity: mistake.resolved ? 0.6 : 1 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ width: 4, borderRadius: '999px', background: mistake.resolved ? 'var(--green)' : errType?.color || 'var(--red2)', alignSelf: 'stretch', flexShrink: 0, minHeight: 48 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            <span className='badge badge-gold'>ص {mistake.page}</span>
            {mistake.verseKey && <span className='badge badge-gray'>{mistake.verseKey}</span>}
            {mistake.resolved && <span className='badge badge-green'>✓ منجز</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{TYPE_LBL[mistake.type] || mistake.type}</div>
          {mistake.verseText && (
            <div className='quran-text' style={{ fontSize: 14, lineHeight: 2, color: 'var(--ink3)', marginBottom: 4 }}>
              {mistake.verseText.slice(0, 65)}
              {mistake.verseText.length > 65 ? '...' : ''}
            </div>
          )}
          {mistake.note && <div style={{ fontSize: 12, color: 'var(--ink4)', fontStyle: 'italic', marginBottom: 6 }}>{mistake.note}</div>}
          {mistake.successCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className='progress' style={{ flex: 1, height: 4 }}>
                <div className='progress-bar' style={{ width: `${Math.min(100, (mistake.successCount / 3) * 100)}%` }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink4)' }}>{mistake.successCount}/3</span>
            </div>
          )}
          {mistake.repetitionCount > 0 && <div style={{ fontSize: 11, color: 'var(--red2)', marginTop: 4 }}>تكرر {mistake.repetitionCount} مرات</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          {!mistake.resolved && (
            <>
              <button className='btn btn-green-ghost btn-sm' onClick={onFix}>
                راجع
              </button>
              <button className='btn btn-ghost btn-xs' onClick={onResolve} style={{ fontSize: 11 }}>
                ✓ حلّ
              </button>
            </>
          )}
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--red2)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fix Mode ─────────────────────────────────────────────────────────────────
const HINTS = {
  forgot_start: ['ابدأ من الآية السابقة', 'ركّز على بداية الآية'],
  wrong_text: ['اقرأ الآية ببطء كاملة', 'انتبه لكل كلمة'],
  forgot_end: ['ابدأ من منتصف الآية', 'ركّز على نهاية الآية'],
  confused: ['ابدأ من أول الربع', 'فرّق بين الآيتين'],
};

function FixMode({ mistake: init, settings, onBack, onDone }) {
  const [mistake, setMistake] = useState(init);
  const [showVerse, setShowVerse] = useState(false);
  const [result, setResult] = useState(null);
  const [verse, setVerse] = useState(null);
  const [prevVerse, setPrevVerse] = useState(null);
  const [loadingV, setLoadingV] = useState(true);
  const required = settings.requiredChecks || 3;

  const refresh = () => {
    const updated = getMistakes().find(m => m.id === mistake.id);
    if (updated) setMistake(updated);
    return updated;
  };

  useEffect(() => {
    if (mistake.verseKey) {
      const [s, a] = mistake.verseKey.split(':');
      // Fetch current verse
      fetch(`${QAPI}/verses/by_key/${s}:${a}?fields=text_uthmani`)
        .then(r => r.json())
        .then(d => {
          setVerse(d.verse);
          setLoadingV(false);
        });
      // Fetch previous verse for context (if ayah > 1)
      const prevAyah = parseInt(a) - 1;
      if (prevAyah >= 1) {
        fetch(`${QAPI}/verses/by_key/${s}:${prevAyah}?fields=text_uthmani`)
          .then(r => r.json())
          .then(d => setPrevVerse(d.verse));
      }
    } else {
      setLoadingV(false);
    }
  }, []);

  const handleSuccess = () => {
    const newCount = (mistake.successCount || 0) + 1;
    updateMistake(mistake.id, { successCount: newCount, resolved: newCount >= required });
    const updated = refresh();
    setResult('success');
    setShowVerse(false);
  };

  const handleFail = () => {
    updateMistake(mistake.id, { repetitionCount: (mistake.repetitionCount || 0) + 1 });
    refresh();
    setResult('fail');
    setShowVerse(false);
  };

  const hints = HINTS[mistake.type] || HINTS.forgot_start;
  const successCount = mistake.successCount || 0;
  const needed = required - successCount;
  const errType = ERROR_TYPES.find(t => t.id === mistake.type);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '14px 18px', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className='btn btn-ghost btn-sm' style={{ gap: 4 }} onClick={onBack}>
            <ChevronRight size={16} /> رجوع
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 16 }}>وضع التصحيح</div>
            <div style={{ fontSize: 11, color: 'var(--ink4)' }}>صفحة {mistake.page}</div>
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: required }).map((_, i) => (
              <div key={i} style={{ width: 11, height: 11, borderRadius: '50%', border: `2px solid ${i < successCount ? 'var(--green)' : 'var(--border2)'}`, background: i < successCount ? 'var(--green)' : 'transparent', transition: 'all 0.3s' }} />
            ))}
          </div>
        </div>
        {successCount > 0 && (
          <div className='progress' style={{ marginTop: 10 }}>
            <div className='progress-bar' style={{ width: `${(successCount / required) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Result overlay */}
      {result && (
        <div className='overlay anim-fade-in' style={{ zIndex: 200 }}>
          <div className='card anim-fade-up' style={{ padding: '40px 28px', maxWidth: 380, width: 'calc(100% - 32px)', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: '22px', background: mistake.resolved ? 'var(--green-bg)' : result === 'success' ? 'var(--green-bg)' : 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>{mistake.resolved ? <Star size={38} color='var(--green)' /> : result === 'success' ? <CheckCircle size={38} color='var(--green)' /> : <XCircle size={38} color='var(--red2)' />}</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>{mistake.resolved ? 'أحسنت! اكتملت المراجعة 🎉' : result === 'success' ? 'ممتاز! استمر' : 'حاول مجدداً'}</h2>
            <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 20 }}>{mistake.resolved ? `تم حل هذا الخطأ بعد ${required} مراجعات` : result === 'success' ? `${successCount}/${required} نجاحات` : `${mistake.repetitionCount || 0} تكرار`}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {mistake.resolved ? (
                <button className='btn btn-primary btn-md' style={{ flex: 1 }} onClick={onDone}>
                  العودة للأخطاء
                </button>
              ) : (
                <>
                  <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onDone}>
                    خروج
                  </button>
                  <button className='btn btn-primary btn-md' style={{ flex: 1 }} onClick={() => setResult(null)}>
                    {result === 'success' ? 'استمر' : 'حاول مجدداً'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, padding: '20px 18px', overflowY: 'auto' }}>
        {/* Error badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: '12px', background: `${errType?.color || 'var(--red2)'}15`, border: `1px solid ${errType?.color || 'var(--red2)'}30`, marginBottom: 16 }}>
          <XCircle size={16} color={errType?.color || 'var(--red2)'} />
          <span style={{ fontSize: 14, fontWeight: 700, color: errType?.color || 'var(--red2)' }}>{TYPE_LBL[mistake.type]}</span>
          {mistake.note && <span style={{ fontSize: 12, color: 'var(--ink4)', marginRight: 'auto' }}>{mistake.note}</span>}
        </div>

        {/* Hints */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {hints.map((h, i) => (
            <span key={i} style={{ fontSize: 12, padding: '6px 12px', borderRadius: '10px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Star size={11} color='var(--gold)' /> {h}
            </span>
          ))}
        </div>

        {/* Previous verse context */}
        {prevVerse && (
          <div className='context-verse'>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>الآية السابقة (للسياق)</div>
            <div className='quran-text' style={{ fontSize: 17, lineHeight: 2.2 }}>
              {prevVerse.text_uthmani}
            </div>
          </div>
        )}

        {/* Main verse */}
        <div className='card' style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ padding: '26px 18px', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loadingV ? (
              <Loader2 size={24} className='spin' color='var(--ink4)' />
            ) : (
              <div style={{ filter: showVerse ? 'none' : 'blur(12px)', transition: 'filter 0.45s', userSelect: showVerse ? 'text' : 'none', width: '100%' }}>
                <div className='quran-text quran-md' style={{ textAlign: 'center' }}>
                  {verse?.text_uthmani || mistake.verseText}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink4)', background: 'var(--surface2)' }}>
            <span>صفحة {mistake.page}</span>
            {mistake.verseKey && <span>الآية {mistake.verseKey}</span>}
          </div>
        </div>
      </div>

      {/* Bottom actions */}
      <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '16px 18px max(20px,env(safe-area-inset-bottom))' }}>
        <button className='btn btn-md full-w' style={{ marginBottom: 12, gap: 8, background: showVerse ? 'var(--green-bg)' : 'var(--bg2)', color: showVerse ? 'var(--green)' : 'var(--ink2)', border: `1px solid ${showVerse ? 'var(--green-border)' : 'var(--border)'}` }} onClick={() => setShowVerse(!showVerse)}>
          {showVerse ? <EyeOff size={16} /> : <Eye size={16} />}
          {showVerse ? 'إخفاء الآية' : 'إظهار الآية للتحقق'}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button className='btn btn-red-ghost btn-md' onClick={handleFail}>
            <XCircle size={16} /> ما زلت أخطئ
          </button>
          <button className='btn btn-primary btn-md' onClick={handleSuccess}>
            <CheckCircle size={16} /> حفظت هذه المرة
          </button>
        </div>
        {!mistake.resolved && (
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--ink4)' }}>
            يحتاج {needed} {needed === 1 ? 'نجاح' : 'نجاحات'} إضافية للإنجاز
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calendar Screen ──────────────────────────────────────────────────────────
function CalendarScreen({ onStartReview }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedule, setSchedule] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addDate, setAddDate] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [reviewPlan, setReviewPlan] = useState(getReviewPlan());

  const load = () => setSchedule(getSchedule());
  useEffect(() => {
    load();
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const schedMap = {};
  schedule.forEach(s => {
    schedMap[s.date] = s;
  });

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const dayNames = ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'];

  const getDayStr = d => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const upcoming = schedule
    .filter(s => s.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  return (
    <div className='page-content'>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>جدول المراجعة</h1>
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>خطط مراجعتك اليومية وتتبّع تقدمك</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className='btn btn-ghost btn-sm' style={{ gap: 5 }} onClick={() => setShowPlanModal(true)}>
            <Target size={14} /> خطة يومية
          </button>
          <button
            className='btn btn-primary btn-sm'
            style={{ gap: 5 }}
            onClick={() => {
              setAddDate(todayStr);
              setShowAddModal(true);
            }}>
            <Plus size={15} /> إضافة
          </button>
        </div>
      </div>

      {/* Review plan strip */}
      {reviewPlan.enabled && (
        <div className='plan-strip' style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, opacity: 0.7, fontWeight: 700, marginBottom: 3 }}>الخطة اليومية النشطة</div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                مراجعة {reviewPlan.dailyReview} ص · حفظ {reviewPlan.dailyMemorize} ص
              </div>
            </div>
            <button onClick={() => setShowPlanModal(true)} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: 'white', padding: '8px 14px', borderRadius: '10px', fontFamily: "'Tajawal', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              <Edit3 size={14} style={{ verticalAlign: 'middle', marginLeft: 4 }} /> تعديل
            </button>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className='card' style={{ padding: 16, marginBottom: 20 }}>
        {/* Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <button className='btn btn-icon' style={{ width: 34, height: 34 }} onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
            <ChevronRight size={16} />
          </button>
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {monthNames[month]} {year}
          </div>
          <button className='btn btn-icon' style={{ width: 34, height: 34 }} onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
            <ChevronLeft size={16} />
          </button>
        </div>
        {/* Day names */}
        <div className='cal-grid' style={{ marginBottom: 8 }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--ink4)', padding: '2px 0' }}>
              {d}
            </div>
          ))}
        </div>
        <div className='cal-grid'>
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1;
            const dStr = getDayStr(d);
            const hasPlan = !!schedMap[dStr];
            const isToday = dStr === todayStr;
            const isPast = new Date(year, month, d) < today && !isToday;
            const isSelected = selected === dStr;
            return (
              <div key={d} className={`cal-day ${isToday ? 'today' : ''} ${hasPlan && !isToday ? 'has-plan' : ''} ${isPast && !hasPlan ? 'past' : ''}`} style={{ fontWeight: isToday ? 900 : hasPlan ? 700 : 400, outline: isSelected ? `2px solid var(--green)` : 'none', outlineOffset: 1 }} onClick={() => setSelected(isSelected ? null : dStr)}>
                {d}
                {hasPlan && !isToday && <span className='cal-dot' />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected / today plan */}
      {(() => {
        const displayDate = selected || todayStr;
        const plan = schedMap[displayDate];
        return (
          <div style={{ marginBottom: 20 }}>
            <div className='divider' style={{ marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{displayDate === todayStr && !selected ? 'مراجعة اليوم' : formatDate(displayDate)}</span>
            </div>
            {plan ? (
              <div className='card' style={{ padding: '18px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 3 }}>
                      صفحات {plan.from} – {plan.to}
                    </div>
                    {plan.note && <div style={{ fontSize: 13, color: 'var(--ink3)' }}>{plan.note}</div>}
                    <div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 4 }}>{plan.to - plan.from + 1} صفحات</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className='btn btn-primary btn-sm' onClick={() => onStartReview(plan.from, plan.to)}>
                      ابدأ
                    </button>
                    <button
                      className='btn btn-icon btn-sm'
                      onClick={() => {
                        deleteScheduleItem(plan.id);
                        load();
                        setSelected(null);
                      }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <Calendar size={34} color='var(--ink4)' style={{ marginBottom: 10 }} />
                <div style={{ fontSize: 14, color: 'var(--ink4)', marginBottom: 14 }}>لا خطة لهذا اليوم</div>
                <button
                  className='btn btn-green-ghost btn-sm'
                  style={{ gap: 6 }}
                  onClick={() => {
                    setAddDate(displayDate);
                    setShowAddModal(true);
                  }}>
                  <Plus size={14} /> أضف خطة مراجعة
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Upcoming */}
      {upcoming.length > 1 && (
        <div>
          <div className='section-label'>القادمة قريباً</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(s => (
              <div key={s.id} className='card' style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    صفحات {s.from} – {s.to}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 2 }}>{formatDate(s.date)}</div>
                </div>
                <button className='btn btn-primary btn-sm' onClick={() => onStartReview(s.from, s.to)}>
                  ابدأ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAddModal && (
        <AddPlanModal
          defaultDate={addDate}
          onSave={plan => {
            saveScheduleItem({ ...plan, id: genId() });
            load();
            setShowAddModal(false);
          }}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showPlanModal && (
        <ReviewPlanModal
          plan={reviewPlan}
          onSave={p => {
            saveReviewPlan(p);
            setReviewPlan(p);
            setShowPlanModal(false);
          }}
          onClose={() => setShowPlanModal(false)}
        />
      )}
    </div>
  );
}

function AddPlanModal({ defaultDate, onSave, onClose }) {
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [note, setNote] = useState('');

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ fontWeight: 900, fontSize: 18 }}>إضافة خطة مراجعة</div>
        </div>
        <div className='sheet-body'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>التاريخ</label>
              <input type='date' value={date} onChange={e => setDate(e.target.value)} className='input' />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { l: 'من صفحة', v: from, s: setFrom },
                { l: 'إلى صفحة', v: to, s: setTo },
              ].map(f => (
                <div key={f.l}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>{f.l}</label>
                  <input type='number' min={1} max={604} value={f.v} onChange={e => f.s(Number(e.target.value))} className='input' style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: 'var(--green)' }} />
                </div>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>ملاحظة (اختياري)</label>
              <input type='text' value={note} onChange={e => setNote(e.target.value)} placeholder='مثال: ربع الحزب الثاني' className='input' />
            </div>
          </div>
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
            إلغاء
          </button>
          <button className='btn btn-primary btn-md' style={{ flex: 2 }} onClick={() => onSave({ date, from, to, note, completed: false })}>
            حفظ الخطة
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewPlanModal({ plan, onSave, onClose }) {
  const [dailyReview, setDailyReview] = useState(plan.dailyReview || 10);
  const [dailyMemorize, setDailyMemorize] = useState(plan.dailyMemorize || 2);
  const [enabled, setEnabled] = useState(plan.enabled !== false);

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ fontWeight: 900, fontSize: 18 }}>خطة المراجعة اليومية</div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 3 }}>حدّد هدفك اليومي للمراجعة والحفظ</div>
        </div>
        <div className='sheet-body'>
          <div style={{ padding: '14px 16px', borderRadius: '14px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>{enabled ? `ستراجع ${dailyReview} صفحة وتحفظ ${dailyMemorize} صفحة يومياً` : 'الخطة معطّلة حالياً'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {[
              { label: 'صفحات المراجعة اليومية', val: dailyReview, set: setDailyReview, min: 1, max: 30, icon: <RefreshCw size={16} color='var(--green)' /> },
              { label: 'صفحات الحفظ اليومية', val: dailyMemorize, set: setDailyMemorize, min: 0, max: 10, icon: <BookMarked size={16} color='var(--gold)' /> },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {f.icon}
                  <label style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink2)' }}>{f.label}</label>
                  <span style={{ marginRight: 'auto', fontSize: 20, fontWeight: 900, color: 'var(--green)' }}>{f.val}</span>
                </div>
                <input type='range' min={f.min} max={f.max} value={f.val} onChange={e => f.set(Number(e.target.value))} style={{ background: `linear-gradient(to left, var(--bg3) ${100 - ((f.val - f.min) / (f.max - f.min)) * 100}%, var(--green) ${100 - ((f.val - f.min) / (f.max - f.min)) * 100}%)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink4)', marginTop: 4 }}>
                  <span>{f.min}</span>
                  <span>{f.max}</span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>تفعيل الخطة</div>
                <div style={{ fontSize: 12, color: 'var(--ink4)' }}>إظهار الخطة في الرئيسية وإضافة تذكيرات</div>
              </div>
              <label className='switch'>
                <input type='checkbox' checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                <div className='switch-track' />
                <div className='switch-thumb' />
              </label>
            </div>
          </div>
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
            إلغاء
          </button>
          <button className='btn btn-primary btn-md' style={{ flex: 2 }} onClick={() => onSave({ dailyReview, dailyMemorize, enabled })}>
            <Save size={15} /> حفظ الخطة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quarters Screen ──────────────────────────────────────────────────────────
function QuartersScreen({ onPlayAudio, settings }) {
  const [surahs, setSurahs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [verses, setVerses] = useState([]);
  const [loadingV, setLoadingV] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSurahList().then(s => {
      setSurahs(s);
      setLoading(false);
    });
  }, []);

  const handleSelect = async surah => {
    if (selected?.id === surah.id) {
      setSelected(null);
      setVerses([]);
      return;
    }
    setSelected(surah);
    setLoadingV(true);
    const v = await fetchSurahVerses(surah.id);
    setVerses(v);
    setLoadingV(false);
  };

  // Calculate all quarters (hizb quarters) within a surah
  // Each page of the Quran has 2 hizb quarters, so a surah can have multiple.
  // We use hizb_number field from the API.
  const getQuarterDivisions = vv => {
    if (!vv.length) return [];
    const divisions = [];
    let lastHizb = null;

    vv.forEach(v => {
      const hizb = v.hizb_number;
      if (hizb && hizb !== lastHizb) {
        // Each hizb = 2 hizb quarters; track when hizb changes
        lastHizb = hizb;
        divisions.push({
          verseNumber: v.verse_number,
          verseKey: v.verse_key,
          text: v.text_uthmani,
          hizb,
          label: `الحزب ${hizb}`,
        });
      }
    });

    // Also add approximate quarter splits within the surah
    const surahQuarters = [];
    const len = vv.length;
    if (len >= 4) {
      [0, Math.floor(len / 4), Math.floor(len / 2), Math.floor((3 * len) / 4)].forEach((idx, qi) => {
        const v = vv[idx];
        if (v) surahQuarters.push({ verseNumber: v.verse_number, verseKey: v.verse_key, text: v.text_uthmani, label: `الربع ${qi + 1}` });
      });
    }

    return { hizbDivisions: divisions, surahQuarters };
  };

  const filtered = surahs.filter(s => s.name_arabic?.includes(search) || s.name_simple?.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search));

  const { hizbDivisions = [], surahQuarters = [] } = selected && verses.length ? getQuarterDivisions(verses) : {};

  return (
    <div className='page-content'>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>الأرباع والأحزاب</h1>
        <p style={{ fontSize: 13, color: 'var(--ink3)' }}>تصفّح بدايات الأرباع والأحزاب في كل سورة</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={16} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink4)' }} />
        <input type='text' value={search} onChange={e => setSearch(e.target.value)} placeholder='ابحث عن سورة...' className='input' style={{ paddingRight: 38 }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className='skel' style={{ height: 56 }} />
          ))}
        </div>
      ) : (
        filtered.map(surah => (
          <div key={surah.id} style={{ marginBottom: 6 }}>
            <button
              className='card card-hover full-w'
              style={{
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: selected?.id === surah.id ? 'var(--green-bg)' : 'var(--surface)',
                borderColor: selected?.id === surah.id ? 'var(--green-border)' : 'var(--border)',
                cursor: 'pointer',
                fontFamily: "'Tajawal', sans-serif",
                border: `1px solid ${selected?.id === surah.id ? 'var(--green-border)' : 'var(--border)'}`,
                borderRadius: selected?.id === surah.id ? 'var(--r-lg) var(--r-lg) 0 0' : 'var(--r-lg)',
              }}
              onClick={() => handleSelect(surah)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'var(--gold)', flexShrink: 0 }}>{surah.id}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 16, fontFamily: "'Scheherazade New', serif" }}>{surah.name_arabic}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)' }}>
                    {surah.verses_count} آية · {surah.revelation_place === 'makkah' ? 'مكية' : 'مدنية'}
                  </div>
                </div>
              </div>
              <ChevronDown size={17} color='var(--ink4)' style={{ transform: selected?.id === surah.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            {selected?.id === surah.id && (
              <div className='card' style={{ borderRadius: '0 0 var(--r-lg) var(--r-lg)', borderTop: 'none', padding: '18px 16px' }}>
                {loadingV ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} className='skel' style={{ height: 48 }} />
                    ))}
                  </div>
                ) : (
                  <div>
                    {/* Tab view: surah quarters vs hizb */}
                    <div className='tab-bar' style={{ marginBottom: 16 }}>
                      <button
                        className='tab-item active'
                        id='q-tab-quarters'
                        onClick={() => {
                          document.getElementById('q-sec-quarters').style.display = 'block';
                          document.getElementById('q-sec-hizb').style.display = 'none';
                          document.getElementById('q-tab-quarters').classList.add('active');
                          document.getElementById('q-tab-hizb').classList.remove('active');
                        }}>
                        أرباع السورة
                      </button>
                      <button
                        className='tab-item'
                        id='q-tab-hizb'
                        onClick={() => {
                          document.getElementById('q-sec-hizb').style.display = 'block';
                          document.getElementById('q-sec-quarters').style.display = 'none';
                          document.getElementById('q-tab-hizb').classList.add('active');
                          document.getElementById('q-tab-quarters').classList.remove('active');
                        }}>
                        الأحزاب
                      </button>
                    </div>

                    {/* Surah quarters */}
                    <div id='q-sec-quarters'>
                      {surahQuarters.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--ink4)', padding: 16 }}>السورة قصيرة جداً</div>
                      ) : (
                        surahQuarters.map((q, i) => (
                          <QuarterItem
                            key={i}
                            item={q}
                            onPlay={() => {
                              const [s, a] = q.verseKey.split(':');
                              onPlayAudio(s, a, q.verseKey, q.text);
                            }}
                          />
                        ))
                      )}
                    </div>

                    {/* Hizb divisions */}
                    <div id='q-sec-hizb' style={{ display: 'none' }}>
                      {hizbDivisions.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--ink4)', padding: 16 }}>لا يوجد تقسيم حزب داخل هذه السورة</div>
                      ) : (
                        hizbDivisions.map((h, i) => (
                          <QuarterItem
                            key={i}
                            item={h}
                            onPlay={() => {
                              const [s, a] = h.verseKey.split(':');
                              onPlayAudio(s, a, h.verseKey, h.text);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function QuarterItem({ item, onPlay }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--surface2)', border: '1px solid var(--border)', marginBottom: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span className='badge badge-green'>{item.label}</span>
          <span className='badge badge-gold'>آية {item.verseNumber}</span>
        </div>
        <div className='quran-text' style={{ fontSize: 16, lineHeight: 2, color: 'var(--ink)' }}>
          {item.text?.slice(0, 70)}
          {item.text?.length > 70 ? '...' : ''}
        </div>
      </div>
      <button className='btn btn-ghost btn-sm' style={{ flexShrink: 0, padding: '6px 10px' }} onClick={onPlay}>
        <Play size={14} color='var(--gold)' />
      </button>
    </div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────
function SettingsScreen({ settings, onChange }) {
  const [reviewPlan, setReviewPlan] = useState(getReviewPlan());

  return (
    <div className='page-content'>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, marginBottom: 4 }}>الإعدادات</h1>
        <p style={{ fontSize: 13, color: 'var(--ink3)' }}>تخصيص تجربة مراجعة القرآن الكريم</p>
      </div>

      {/* Appearance */}
      <SettingsSection title='المظهر والعرض'>
        <SettingRow label='الوضع الداكن' sub='تغيير مظهر التطبيق للوضع الداكن'>
          <label className='switch'>
            <input type='checkbox' checked={settings.darkMode} onChange={e => onChange({ darkMode: e.target.checked })} />
            <div className='switch-track' />
            <div className='switch-thumb' />
          </label>
        </SettingRow>
        <SettingRow label='حجم خط القرآن' sub='تكبير أو تصغير نص الآيات'>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'sm', l: 'ص', size: 16 },
              { id: 'md', l: 'م', size: 20 },
              { id: 'lg', l: 'ك', size: 24 },
            ].map(s => (
              <button key={s.id} onClick={() => onChange({ quranFontSize: s.id })} style={{ width: 36, height: 36, borderRadius: '10px', border: `1.5px solid ${settings.quranFontSize === s.id ? 'var(--green)' : 'var(--border2)'}`, background: settings.quranFontSize === s.id ? 'var(--green-bg)' : 'transparent', color: settings.quranFontSize === s.id ? 'var(--green)' : 'var(--ink3)', fontWeight: 700, fontSize: s.size - 2, cursor: 'pointer', fontFamily: "'Scheherazade New', serif" }}>
                {s.l}
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingsSection>

      {/* Review */}
      <SettingsSection title='إعدادات المراجعة'>
        <SettingRow label='عدد مرات التحقق' sub={`يحتاج ${settings.requiredChecks || 3} نجاحات لحل الخطأ`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <StepButton dir='dec' onClick={() => onChange({ requiredChecks: Math.max(1, (settings.requiredChecks || 3) - 1) })} />
            <span style={{ fontWeight: 900, fontSize: 22, color: 'var(--green)', minWidth: 28, textAlign: 'center' }}>{settings.requiredChecks || 3}</span>
            <StepButton dir='inc' onClick={() => onChange({ requiredChecks: Math.min(10, (settings.requiredChecks || 3) + 1) })} />
          </div>
        </SettingRow>
      </SettingsSection>

      {/* Tafsir */}
      <SettingsSection title='التفسير'>
        <SettingRow label='التفسير الافتراضي' sub='يُعرض عند الضغط على أي آية'>
          <select value={settings.defaultTafsir} onChange={e => onChange({ defaultTafsir: e.target.value })} className='input' style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}>
            {TAFSIR_OPTIONS.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsSection>

      {/* Audio */}
      <SettingsSection title='الصوت والتلاوة'>
        <SettingRow label='القارئ الافتراضي' sub='للاستماع عبر المشغّل المدمج'>
          <select value={settings.reciter || '7'} onChange={e => onChange({ reciter: e.target.value })} className='input' style={{ width: 'auto', padding: '8px 12px', fontSize: 13, maxWidth: 160 }}>
            {RECITERS.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsSection>

      {/* Data */}
      <SettingsSection title='إدارة البيانات'>
        <SettingRow label='تصدير البيانات' sub='حفظ نسخة احتياطية من أخطائك'>
          <button
            className='btn btn-ghost btn-sm'
            onClick={() => {
              const data = { mistakes: getMistakes(), sessions: getSessions(), schedule: getSchedule() };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'quran-review-backup.json';
              a.click();
            }}>
            تصدير
          </button>
        </SettingRow>
        <SettingRow label='إعادة تعيين الأخطاء' sub='حذف جميع الأخطاء المسجّلة - لا يمكن التراجع'>
          <button
            className='btn btn-red-ghost btn-sm'
            onClick={() => {
              if (confirm('هل تريد حذف جميع الأخطاء؟')) {
                localStorage.removeItem('q_mistakes');
                window.location.reload();
              }
            }}>
            حذف الكل
          </button>
        </SettingRow>
        <SettingRow label='إعادة تعيين الجدول' sub='حذف جميع خطط المراجعة'>
          <button
            className='btn btn-red-ghost btn-sm'
            onClick={() => {
              if (confirm('هل تريد حذف جميع الخطط؟')) {
                localStorage.removeItem('q_schedule');
                window.location.reload();
              }
            }}>
            حذف الكل
          </button>
        </SettingRow>
      </SettingsSection>

      {/* About */}
      <div className='card-flat' style={{ padding: '20px', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: '16px', background: 'linear-gradient(135deg, var(--green), var(--green2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', boxShadow: '0 4px 14px rgba(26,102,68,0.3)' }}>
          <BookOpen size={24} color='white' />
        </div>
        <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 24, color: 'var(--gold2)', marginBottom: 6 }}>مراجع القرآن</div>
        <div style={{ fontSize: 13, color: 'var(--ink4)' }}>تطبيق لتتبع وتحسين حفظ القرآن الكريم</div>
        <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 8, fontFamily: "'Scheherazade New', serif" }}>﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾</div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className='section-label'>{title}</div>
      <div className='card' style={{ padding: '0 18px' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, sub, children }) {
  return (
    <div className='settings-row'>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function StepButton({ dir, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 32, height: 32, borderRadius: '9px', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 900, fontSize: 20, fontFamily: "'Tajawal', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink2)', lineHeight: 1 }}>
      {dir === 'inc' ? '+' : '−'}
    </button>
  );
}
