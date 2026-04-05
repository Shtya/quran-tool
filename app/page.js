'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, BarChart2, Calendar, Settings, ChevronRight, ChevronLeft, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, Moon, Sun, Mic, BookMarked, AlignJustify, Layers, List, ArrowRight, Flame, Star, Target, TrendingUp, Volume2, ScrollText, Info, X, Check, ChevronDown, Menu, Grid3X3, Headphones, BookText, Play, Pause, StopCircle, SkipForward, SkipBack, Music2, Loader2, Search, Edit3, Save, Clock, Award, Bookmark, ChevronUp, Hash, LayoutDashboard, BookOpenCheck, AlertCircle } from 'lucide-react';

// ─── localStorage Store ───────────────────────────────────────────────────────
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

// BUG FIX: Use correct tafsir endpoint - GET /tafsirs/{tafsir_id}/by_ayah/{ayah_key}
async function fetchTafsir(verseKey, tafsirId = '169') {
  try {
    const r = await fetch(`${QAPI}/tafsirs/${tafsirId}/by_ayah/${verseKey}`);
    if (!r.ok) throw new Error(`Tafsir fetch failed: ${r.status}`);
    const d = await r.json();
    return d.tafsir || null;
  } catch (e) {
    console.warn('Tafsir error:', e);
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

// BUG FIX: Correct audio URL building. CDN uses numeric file ID = surah*1000+ayah
function getAudioUrl(surah, ayah, reciterId = '7') {
  const surahInt = parseInt(surah, 10);
  const ayahInt = parseInt(ayah, 10);
  // Primary: verses.quran.com
  return `https://verses.quran.com/${reciterId}/${String(surahInt).padStart(3, '0')}${String(ayahInt).padStart(3, '0')}.mp3`;
}
function getAudioUrlFallback(surah, ayah, reciterId = '7') {
  const surahInt = parseInt(surah, 10);
  const ayahInt = parseInt(ayah, 10);
  const fileId = surahInt * 1000 + ayahInt;
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${fileId}.mp3`;
}

const RECITERS = [
  { id: '7', name: 'مشاري العفاسي' },
  { id: '1', name: 'عبد الباسط عبد الصمد' },
  { id: '5', name: 'سعد الغامدي' },
  { id: '11', name: 'محمود الحصري' },
  { id: '12', name: 'محمد صديق المنشاوي' },
];

const TAFSIR_OPTIONS = [
  { id: '169', name: 'الميسر' },
  { id: '91', name: 'ابن كثير' },
  { id: '93', name: 'الجلالين' },
  { id: '94', name: 'الطبري' },
];

const ERROR_TYPES = [
  { id: 'forgot_start', label: 'نسيان بداية الآية', color: '#e74c3c' },
  { id: 'wrong_text', label: 'خطأ في النص', color: '#e67e22' },
  { id: 'forgot_end', label: 'نسيان نهاية الآية', color: '#9b59b6' },
  { id: 'confused', label: 'خلط بين آيتين', color: '#3498db' },
];
const TYPE_LBL = {
  forgot_start: 'نسيان بداية الآية',
  wrong_text: 'خطأ في النص',
  forgot_end: 'نسيان نهاية الآية',
  confused: 'خلط بين آيتين',
};

// ─── Global CSS ───────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Cairo:wght@300;400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #F7F3EC;
  --bg2: #EDE6D8;
  --bg3: #E2D8C8;
  --surface: #FEFCF8;
  --surface2: #F6F1E8;
  --surface3: #EFE9DC;
  --border: rgba(110,85,45,0.1);
  --border2: rgba(110,85,45,0.18);
  --border3: rgba(110,85,45,0.28);

  --ink: #1C1208;
  --ink2: #3A2A14;
  --ink3: #7A6040;
  --ink4: #B09870;

  --emerald: #0F5C3A;
  --emerald2: #1A7A50;
  --emerald3: #28A06A;
  --emerald4: #50C88A;
  --emerald-bg: rgba(15,92,58,0.07);
  --emerald-border: rgba(15,92,58,0.15);
  --emerald-glow: rgba(15,92,58,0.2);

  --amber: #8A5E14;
  --amber2: #B07A20;
  --amber3: #D4A040;
  --amber-bg: rgba(138,94,20,0.07);
  --amber-border: rgba(138,94,20,0.18);

  --crimson: #7A1818;
  --crimson2: #A82828;
  --crimson-bg: rgba(122,24,24,0.06);
  --crimson-border: rgba(122,24,24,0.15);

  --indigo: #3A2878;
  --indigo-bg: rgba(58,40,120,0.07);
  --indigo-border: rgba(58,40,120,0.15);

  --shadow-xs: 0 1px 3px rgba(28,18,8,0.06), 0 1px 2px rgba(28,18,8,0.04);
  --shadow-sm: 0 2px 8px rgba(28,18,8,0.08), 0 1px 3px rgba(28,18,8,0.05);
  --shadow-md: 0 4px 20px rgba(28,18,8,0.1), 0 2px 6px rgba(28,18,8,0.06);
  --shadow-lg: 0 8px 40px rgba(28,18,8,0.12), 0 3px 10px rgba(28,18,8,0.07);
  --shadow-xl: 0 16px 60px rgba(28,18,8,0.16), 0 6px 20px rgba(28,18,8,0.09);

  --r-xs: 5px;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 22px;
  --r-2xl: 28px;
  --r-full: 999px;

  --quran-sm: 20px;
  --quran-md: 24px;
  --quran-lg: 30px;

  --sidebar-w: 250px;
  --header-h: 60px;
}

.dark {
  --bg: #0C1008;
  --bg2: #111608;
  --bg3: #171E0E;
  --surface: #141A0A;
  --surface2: #1A2210;
  --surface3: #202A15;
  --border: rgba(140,120,60,0.1);
  --border2: rgba(140,120,60,0.17);
  --border3: rgba(140,120,60,0.27);

  --ink: #EAE0CC;
  --ink2: #C8B898;
  --ink3: #8A7850;
  --ink4: #584A30;

  --emerald: #28C278;
  --emerald2: #3AD88A;
  --emerald3: #50E8A0;
  --emerald4: #70F0B8;
  --emerald-bg: rgba(40,194,120,0.09);
  --emerald-border: rgba(40,194,120,0.2);
  --emerald-glow: rgba(40,194,120,0.25);

  --amber: #D4A040;
  --amber2: #E8B850;
  --amber3: #F4CC60;
  --amber-bg: rgba(212,160,64,0.09);
  --amber-border: rgba(212,160,64,0.2);

  --crimson: #E04848;
  --crimson2: #F06060;
  --crimson-bg: rgba(224,72,72,0.09);
  --crimson-border: rgba(224,72,72,0.2);

  --indigo: #8878D8;
  --indigo-bg: rgba(136,120,216,0.09);
  --indigo-border: rgba(136,120,216,0.2);

  --shadow-xs: 0 1px 3px rgba(0,0,0,0.25);
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 20px rgba(0,0,0,0.38);
  --shadow-lg: 0 8px 40px rgba(0,0,0,0.46);
  --shadow-xl: 0 16px 60px rgba(0,0,0,0.55);
}

html { scroll-behavior: smooth; }
body {
  font-family: 'Cairo', sans-serif;
  background: var(--bg);
  color: var(--ink);
  direction: rtl;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
  overflow-x: hidden;
}

.font-quran {
  font-family: 'Scheherazade New', 'Noto Naskh Arabic', 'Amiri', serif !important;
}

/* ── App Shell ── */
.app-shell {
  display: flex;
  min-height: 100dvh;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-left: 1px solid var(--border2);
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
  padding: 18px 16px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}
.sidebar-logo {
  width: 40px; height: 40px;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--emerald), var(--emerald2));
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 14px var(--emerald-glow);
}
.sidebar-nav {
  flex: 1;
  padding: 10px 10px;
  overflow-y: auto;
}
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--r-md);
  cursor: pointer;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink3);
  background: none;
  border: none;
  width: 100%;
  text-align: right;
  font-family: 'Cairo', sans-serif;
  transition: all 0.15s;
  margin-bottom: 2px;
}
.sidebar-item:hover { background: var(--bg2); color: var(--ink2); }
.sidebar-item.active {
  background: var(--emerald-bg);
  color: var(--emerald);
  border: 1px solid var(--emerald-border);
}
.sidebar-item.active svg { stroke: var(--emerald); }
.sidebar-badge {
  margin-right: auto;
  min-width: 20px; height: 20px;
  border-radius: 999px;
  background: var(--crimson2);
  color: white;
  font-size: 10px;
  font-weight: 800;
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
  padding: 0 22px;
  position: sticky;
  top: 0;
  z-index: 40;
  backdrop-filter: blur(14px);
}

/* Page content */
.page-content {
  flex: 1;
  padding: 26px 26px 100px;
  max-width: 860px;
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
    padding: 16px 15px 90px;
  }
  .top-bar {
    padding: 0 14px;
  }
  .hide-mobile { display: none !important; }
}

@media (min-width: 769px) {
  .bottom-nav { display: none !important; }
  .mobile-menu-btn { display: none !important; }
}

/* ── Bottom Nav ── */
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: var(--surface);
  border-top: 1px solid var(--border2);
  padding: 5px 2px max(8px, env(safe-area-inset-bottom));
  display: flex; justify-content: space-around;
  backdrop-filter: blur(16px);
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  padding: 5px 6px;
  border-radius: var(--r-md);
  cursor: pointer; background: none; border: none;
  color: var(--ink4);
  font-family: 'Cairo', sans-serif;
  transition: all 0.15s; font-size: 10px; font-weight: 700;
  min-width: 50px; flex: 1; max-width: 70px;
}
.nav-item.active { color: var(--emerald); background: var(--emerald-bg); }

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
  transition: box-shadow 0.2s, transform 0.18s, border-color 0.2s;
  cursor: pointer;
}
.card-hover:hover { box-shadow: var(--shadow-md); transform: translateY(-2px); border-color: var(--border2); }

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-family: 'Cairo', sans-serif;
  font-weight: 700; cursor: pointer; border: none; border-radius: var(--r-md);
  transition: all 0.15s; white-space: nowrap; outline: none;
  letter-spacing: 0.01em;
}
.btn:active:not(:disabled) { transform: scale(0.96); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-xs  { padding: 4px 9px; font-size: 11.5px; border-radius: var(--r-xs); }
.btn-sm  { padding: 7px 14px; font-size: 13px; }
.btn-md  { padding: 10px 18px; font-size: 14px; }
.btn-lg  { padding: 13px 26px; font-size: 15px; }

.btn-primary { background: var(--emerald); color: white; box-shadow: 0 3px 10px var(--emerald-glow); }
.btn-primary:hover:not(:disabled) { background: var(--emerald2); box-shadow: 0 5px 16px var(--emerald-glow); }

.btn-amber { background: var(--amber); color: white; }
.btn-amber:hover:not(:disabled) { background: var(--amber2); }

.btn-danger { background: var(--crimson2); color: white; }
.btn-danger:hover:not(:disabled) { background: var(--crimson); }

.btn-ghost { background: var(--bg2); color: var(--ink2); border: 1px solid var(--border2); }
.btn-ghost:hover:not(:disabled) { background: var(--bg3); }

.btn-outline { background: transparent; color: var(--ink2); border: 1.5px solid var(--border2); }
.btn-outline:hover:not(:disabled) { background: var(--bg2); }

.btn-emerald-ghost { background: var(--emerald-bg); color: var(--emerald); border: 1px solid var(--emerald-border); }
.btn-emerald-ghost:hover:not(:disabled) { background: rgba(15,92,58,0.13); }

.btn-amber-ghost { background: var(--amber-bg); color: var(--amber); border: 1px solid var(--amber-border); }
.btn-red-ghost { background: var(--crimson-bg); color: var(--crimson2); border: 1px solid var(--crimson-border); }
.btn-red-ghost:hover:not(:disabled) { background: rgba(122,24,24,0.12); }

.btn-icon {
  width: 36px; height: 36px; padding: 0;
  border-radius: var(--r-md); background: var(--bg2); color: var(--ink2); border: 1px solid var(--border);
}
.btn-icon:hover:not(:disabled) { background: var(--bg3); }

.btn-circle {
  width: 44px; height: 44px; padding: 0;
  border-radius: 50%; background: var(--emerald); color: white;
  box-shadow: 0 3px 12px var(--emerald-glow);
  border: none; cursor: pointer; transition: all 0.15s;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Cairo', sans-serif;
}
.btn-circle:hover:not(:disabled) { background: var(--emerald2); transform: scale(1.04); }
.btn-circle:active:not(:disabled) { transform: scale(0.96); }
.btn-circle:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Inputs ── */
.input {
  width: 100%; padding: 10px 13px;
  border-radius: var(--r-md); border: 1.5px solid var(--border2);
  background: var(--surface); color: var(--ink);
  font-family: 'Cairo', sans-serif;
  font-size: 14px; outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
  direction: rtl;
}
.input:focus { border-color: var(--emerald); box-shadow: 0 0 0 3px var(--emerald-bg); }
.input::placeholder { color: var(--ink4); }
select.input { cursor: pointer; }
textarea.input { resize: none; line-height: 1.8; }

/* ── Badge ── */
.badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 700;
}
.badge-emerald { background: var(--emerald-bg); color: var(--emerald); border: 1px solid var(--emerald-border); }
.badge-amber  { background: var(--amber-bg);  color: var(--amber2);  border: 1px solid var(--amber-border); }
.badge-red   { background: var(--crimson-bg);   color: var(--crimson2);  border: 1px solid var(--crimson-border); }
.badge-gray  { background: var(--bg2); color: var(--ink3); border: 1px solid var(--border); }
.badge-indigo { background: var(--indigo-bg); color: var(--indigo); border: 1px solid var(--indigo-border); }

/* ── Progress ── */
.progress { height: 4px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
.progress-bar {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--emerald), var(--emerald3));
  transition: width 0.5s cubic-bezier(0.4,0,0.2,1);
}

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
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
  padding: 8px 8px; border-radius: var(--r-sm);
  font-size: 13px; font-weight: 700; cursor: pointer;
  color: var(--ink3); background: transparent; border: none;
  font-family: 'Cairo', sans-serif;
  transition: all 0.15s;
}
.tab-item.active {
  background: var(--surface); color: var(--emerald);
  box-shadow: var(--shadow-sm);
}

/* ── Modal/Sheet ── */
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  display: flex; align-items: flex-end; justify-content: center;
  animation: fadeIn 0.2s ease;
}
@media (min-width: 640px) { .overlay { align-items: center; } }

.sheet {
  width: 100%; max-width: 520px;
  background: var(--surface);
  border-radius: var(--r-2xl) var(--r-2xl) 0 0;
  padding: 0 0 max(24px, env(safe-area-inset-bottom));
  animation: slideUp 0.3s cubic-bezier(0.4,0,0.2,1);
  max-height: 92dvh; overflow-y: auto;
}
@media (min-width: 640px) {
  .sheet {
    border-radius: var(--r-2xl);
    animation: scaleIn 0.26s cubic-bezier(0.34,1.4,0.64,1);
  }
}
.sheet-handle { width: 36px; height: 4px; border-radius: 999px; background: var(--border3); margin: 12px auto 16px; }
.sheet-header { padding: 0 20px 14px; border-bottom: 1px solid var(--border); margin-bottom: 18px; }
.sheet-body { padding: 0 20px; }
.sheet-footer { padding: 16px 20px 0; border-top: 1px solid var(--border); margin-top: 18px; }

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
  border-radius: var(--r-sm); font-size: 12.5px; font-weight: 600;
  cursor: pointer; transition: all 0.12s; position: relative;
}
.cal-day.today { background: var(--emerald); color: white; font-weight: 800; }
.cal-day.has-plan { background: var(--emerald-bg); color: var(--emerald); border: 1px solid var(--emerald-border); }
.cal-day.past { color: var(--ink4); }
.cal-day:hover:not(.today) { background: var(--bg2); }
.cal-dot { position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%; background: var(--amber); }

/* ── Audio Player ── */
.audio-player {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  background: var(--surface);
  border-top: 1px solid var(--border2);
  padding: 10px 18px max(10px, env(safe-area-inset-bottom));
  z-index: 80;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
  backdrop-filter: blur(16px);
  animation: slideUp 0.26s cubic-bezier(0.4,0,0.2,1);
}
@media (min-width: 769px) {
  .audio-player { right: var(--sidebar-w); }
}
.audio-progress {
  cursor: pointer; appearance: none; width: 100%; height: 3px;
  border-radius: 999px; background: var(--bg3); outline: none;
}
.audio-progress::-webkit-slider-thumb {
  appearance: none; width: 13px; height: 13px; border-radius: 50%;
  background: var(--emerald); box-shadow: 0 1px 5px var(--emerald-glow);
}

/* ── Quran Text ── */
.quran-text {
  font-family: 'Scheherazade New', 'Noto Naskh Arabic', 'Amiri', serif;
  line-height: 2.8;
  color: var(--ink);
  text-align: justify;
  direction: rtl;
}
.quran-sm  { font-size: var(--quran-sm); }
.quran-md  { font-size: var(--quran-md); }
.quran-lg  { font-size: var(--quran-lg); }

.verse-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.8em; height: 1.8em; border-radius: 50%;
  background: var(--amber-bg); border: 1px solid var(--amber-border);
  color: var(--amber2); font-size: 0.56em;
  font-family: 'Cairo', sans-serif; font-weight: 700;
  vertical-align: middle; margin: 0 4px; flex-shrink: 0;
  cursor: pointer; transition: all 0.12s;
  -webkit-tap-highlight-color: transparent;
}
.verse-num:hover { background: var(--amber); color: white; border-color: var(--amber); }

.verse-span {
  cursor: pointer; border-radius: 4px;
  padding: 2px 2px; transition: background 0.12s;
  display: inline;
  -webkit-tap-highlight-color: transparent;
}
.verse-span:hover { background: var(--amber-bg); }
.verse-span.has-mistake { background: var(--crimson-bg); border-bottom: 2px solid var(--crimson2); border-radius: 2px; }
.verse-span.selected { background: var(--emerald-bg); outline: 2px solid var(--emerald-border); border-radius: 4px; }
.verse-span.playing { background: var(--amber-bg); border-bottom: 2px solid var(--amber3); }

.bismillah {
  text-align: center;
  font-family: 'Scheherazade New', serif;
  font-size: clamp(21px, 5vw, 28px);
  color: var(--amber2);
  padding: 18px 20px;
  border-radius: var(--r-xl);
  background: linear-gradient(135deg, var(--amber-bg), var(--emerald-bg));
  border: 1px solid var(--amber-border);
  margin-bottom: 20px;
  line-height: 2.2;
}

.surah-header-divider {
  text-align: center; padding: 14px;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--amber-bg) 0%, var(--emerald-bg) 100%);
  border: 1px solid var(--border);
  margin: 20px 0;
}

/* ── Stat cards ── */
.stat-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 16px 12px;
  text-align: center; box-shadow: var(--shadow-xs);
}
.stat-num { font-size: 28px; font-weight: 900; line-height: 1; }
.stat-lbl { font-size: 11px; font-weight: 700; color: var(--ink3); margin-top: 5px; letter-spacing: 0.02em; }

/* ── Settings ── */
.settings-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 15px 0; border-bottom: 1px solid var(--border);
}
.settings-row:last-child { border-bottom: none; }

/* ── Switch ── */
.switch { position: relative; width: 46px; height: 26px; cursor: pointer; }
.switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.switch-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: var(--bg3); border: 1.5px solid var(--border2); transition: all 0.2s;
}
.switch input:checked + .switch-track { background: var(--emerald); border-color: var(--emerald); }
.switch-thumb {
  position: absolute; top: 4px; right: 4px;
  width: 16px; height: 16px; border-radius: 50%;
  background: white; transition: all 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
  pointer-events: none;
}
.switch input:checked ~ .switch-thumb { right: calc(100% - 20px); }

/* ── Section Label ── */
.section-label {
  font-size: 10.5px; font-weight: 800; letter-spacing: 0.1em;
  color: var(--ink4); text-transform: uppercase; margin-bottom: 10px;
}

/* ── Animations ── */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes spin { to { transform: rotate(360deg); } }

.anim-fade-up { animation: fadeUp 0.36s ease both; }
.anim-fade-in { animation: fadeIn 0.26s ease both; }
.d1 { animation-delay: 0.06s; } .d2 { animation-delay: 0.12s; }
.d3 { animation-delay: 0.18s; } .d4 { animation-delay: 0.24s; }

.spin { animation: spin 0.9s linear infinite; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 999px; }

/* ── Utils ── */
.full-w { width: 100%; }
.flex { display: flex; }
.flex-col { display: flex; flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
.p-4 { padding: 16px; } .p-5 { padding: 20px; }
.mb-3 { margin-bottom: 12px; } .mb-4 { margin-bottom: 16px; }
.text-center { text-align: center; }
.no-select { user-select: none; -webkit-user-select: none; }

/* ── Tafsir ── */
.tafsir-text {
  font-size: 15px; line-height: 2.3; color: var(--ink2);
  font-family: 'Noto Naskh Arabic', 'Amiri', serif;
}

/* ── Mistake card ── */
.mistake-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 13px 15px;
  box-shadow: var(--shadow-xs); transition: box-shadow 0.18s, border-color 0.18s;
}
.mistake-card:hover { box-shadow: var(--shadow-sm); border-color: var(--border2); }

/* ── Review plan strip ── */
.plan-strip {
  background: linear-gradient(135deg, var(--emerald) 0%, var(--emerald2) 60%, var(--emerald3) 100%);
  border-radius: var(--r-xl); padding: 18px 20px;
  color: white; position: relative; overflow: hidden;
}
.plan-strip::before {
  content: ''; position: absolute; top: -20px; right: -20px;
  width: 100px; height: 100px; border-radius: 50%;
  background: rgba(255,255,255,0.07);
}

/* ── Sidebar backdrop ── */
.sidebar-backdrop {
  display: none;
  position: fixed; inset: 0; z-index: 59;
  background: rgba(0,0,0,0.38);
  backdrop-filter: blur(3px);
}
.sidebar-backdrop.visible { display: block; animation: fadeIn 0.2s ease; }

/* ── Verse action menu ── */
.verse-menu {
  position: fixed;
  z-index: 200;
  background: var(--surface);
  border: 1px solid var(--border2);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-xl);
  min-width: 200px;
  overflow: hidden;
  animation: scaleIn 0.2s cubic-bezier(0.34,1.4,0.64,1);
  transform-origin: top center;
}
.verse-menu-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 15px; cursor: pointer;
  font-size: 13.5px; font-weight: 700; color: var(--ink2);
  transition: background 0.12s;
  background: none; border: none; width: 100%;
  font-family: 'Cairo', sans-serif;
  text-align: right;
}
.verse-menu-item:hover { background: var(--bg2); color: var(--ink); }
.verse-menu-item + .verse-menu-item { border-top: 1px solid var(--border); }

input[type=range] {
  -webkit-appearance: none; width: 100%; height: 4px;
  border-radius: 999px; background: var(--bg3); outline: none; cursor: pointer;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
  background: var(--emerald); box-shadow: 0 2px 6px var(--emerald-glow);
}
`;

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [settings, setSettingsState] = useState(getSettings);
  const [screen, setScreen] = useState('home');
  const [reviewRange, setReviewRange] = useState({ from: 1, to: 10 });
  const [fixMistake, setFixMistake] = useState(null);
  const [navTab, setNavTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Audio player state - stored in ref for audio object, state for UI
  const [audioState, setAudioState] = useState({
    playing: false,
    verseKey: null,
    verseText: null,
    currentTime: 0,
    duration: 0,
    loading: false,
    surah: null,
    ayah: null,
  });
  const audioRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings.darkMode]);

  useEffect(() => {
    const m = getMistakes();
    setPendingCount(m.filter(x => !x.resolved).length);
  }, [screen]);

  const updateSettings = useCallback(updates => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      document.documentElement.classList.toggle('dark', next.darkMode);
      return next;
    });
  }, []);

  const goTo = tab => {
    setNavTab(tab);
    const screenMap = { home: 'home', calendar: 'calendar', mistakes: 'mistakes_list', quarters: 'quarters', settings: 'settings' };
    setScreen(screenMap[tab] || 'home');
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

  // BUG FIX: Audio play with proper cancellation and correct surah/ayah mapping
  const playAudio = useCallback(
    async (surah, ayah, verseKey, verseText) => {
      // Cancel any previous audio
      cancelledRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current.onloadedmetadata = null;
        audioRef.current.ontimeupdate = null;
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
      }

      const audio = new Audio();
      audioRef.current = audio;
      cancelledRef.current = false;

      // Validate surah/ayah
      const surahInt = parseInt(surah, 10);
      const ayahInt = parseInt(ayah, 10);

      if (isNaN(surahInt) || isNaN(ayahInt) || surahInt < 1 || ayahInt < 1) {
        console.error('Invalid surah/ayah:', surah, ayah);
        return;
      }

      const primaryUrl = getAudioUrl(surahInt, ayahInt, settings.reciter || '7');
      const fallbackUrl = getAudioUrlFallback(surahInt, ayahInt, settings.reciter || '7');

      setAudioState({
        playing: false,
        verseKey,
        verseText,
        currentTime: 0,
        duration: 0,
        loading: true,
        surah: surahInt,
        ayah: ayahInt,
      });

      const tryPlay = (url, isFallback = false) => {
        return new Promise((resolve, reject) => {
          if (cancelledRef.current) {
            reject('cancelled');
            return;
          }
          audio.src = url;
          audio.load();

          audio.onloadedmetadata = () => {
            if (cancelledRef.current) {
              reject('cancelled');
              return;
            }
            setAudioState(s => ({ ...s, duration: audio.duration, loading: false }));
          };

          audio.ontimeupdate = () => {
            if (cancelledRef.current) return;
            setAudioState(s => ({ ...s, currentTime: audio.currentTime }));
          };

          audio.onended = () => {
            if (cancelledRef.current) return;
            setAudioState(s => ({ ...s, playing: false, currentTime: 0 }));
          };

          audio.onerror = () => {
            if (cancelledRef.current) {
              reject('cancelled');
              return;
            }
            if (!isFallback) {
              // Try fallback
              audio.onerror = null;
              audio.onloadedmetadata = null;
              audio.ontimeupdate = null;
              audio.onended = null;
              tryPlay(fallbackUrl, true).then(resolve).catch(reject);
            } else {
              setAudioState(s => ({ ...s, loading: false }));
              reject('audio_error');
            }
          };

          audio
            .play()
            .then(() => {
              if (cancelledRef.current) {
                audio.pause();
                reject('cancelled');
                return;
              }
              setAudioState(s => ({ ...s, playing: true, loading: false }));
              resolve();
            })
            .catch(e => {
              if (cancelledRef.current) {
                reject('cancelled');
                return;
              }
              if (!isFallback) {
                audio.onerror = null;
                audio.onloadedmetadata = null;
                audio.ontimeupdate = null;
                audio.onended = null;
                tryPlay(fallbackUrl, true).then(resolve).catch(reject);
              } else {
                setAudioState(s => ({ ...s, loading: false }));
                reject(e);
              }
            });
        });
      };

      try {
        await tryPlay(primaryUrl, false);
      } catch (e) {
        if (e !== 'cancelled') {
          console.warn('Audio playback failed:', e);
          setAudioState(s => ({ ...s, loading: false, playing: false }));
        }
      }
    },
    [settings.reciter],
  );

  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current
        .play()
        .then(() => {
          if (!cancelledRef.current) setAudioState(s => ({ ...s, playing: true }));
        })
        .catch(() => {});
    } else {
      audioRef.current.pause();
      setAudioState(s => ({ ...s, playing: false }));
    }
  }, []);

  const closePlayer = useCallback(() => {
    cancelledRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current.onloadedmetadata = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
    }
    setAudioState({ playing: false, verseKey: null, verseText: null, currentTime: 0, duration: 0, loading: false, surah: null, ayah: null });
  }, []);

  const seekAudio = useCallback(t => {
    if (audioRef.current && !isNaN(t)) {
      audioRef.current.currentTime = t;
      setAudioState(s => ({ ...s, currentTime: t }));
    }
  }, []);

  const hasPlayer = !!audioState.verseKey;

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
          hasPlayer={hasPlayer}
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
      <div style={{ paddingBottom: hasPlayer ? 'calc(80px + env(safe-area-inset-bottom, 0px))' : undefined }}>
        {screen === 'home' && <HomeScreen onStartReview={startReview} settings={settings} />}
        {screen === 'calendar' && <CalendarScreen onStartReview={startReview} />}
        {screen === 'mistakes_list' && <MistakesScreen onFix={openFixMode} onCountChange={setPendingCount} />}
        {screen === 'quarters' && <QuartersScreen onPlayAudio={playAudio} settings={settings} playingKey={audioState.verseKey} />}
        {screen === 'settings' && <SettingsScreen settings={settings} onChange={updateSettings} />}
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
              <BookOpen size={19} color='white' />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 16, color: 'var(--emerald)' }}>مراجع</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink4)', marginTop: 1 }}>القرآن الكريم</div>
            </div>
          </div>
          <nav className='sidebar-nav'>
            {navItems.map(({ id, label, Icon }) => (
              <button key={id} className={`sidebar-item ${navTab === id ? 'active' : ''}`} onClick={() => goTo(id)}>
                <Icon size={17} strokeWidth={1.8} />
                <span>{label}</span>
                {id === 'mistakes' && pendingCount > 0 && <span className='sidebar-badge'>{pendingCount}</span>}
              </button>
            ))}
          </nav>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 13, color: 'var(--ink4)', textAlign: 'center', lineHeight: 2 }}>﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾</div>
          </div>
        </aside>

        {/* Sidebar backdrop */}
        <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

        {/* Main */}
        <div className='main-content'>
          <header className='top-bar'>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className='btn btn-icon mobile-menu-btn' onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Menu size={17} />
              </button>
              <span style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--ink)' }}>{navItems.find(n => n.id === navTab)?.label || 'مراجع'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {pendingCount > 0 && <span className='badge badge-red hide-mobile'>{pendingCount} خطأ معلّق</span>}
              <button className='btn btn-icon' onClick={() => updateSettings({ darkMode: !settings.darkMode })}>
                {settings.darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>

          {renderScreen()}
        </div>

        {/* Bottom nav */}
        {screen !== 'review' && screen !== 'fix' && (
          <nav className='bottom-nav'>
            {navItems.map(({ id, label, Icon }) => (
              <button key={id} className={`nav-item ${navTab === id ? 'active' : ''}`} onClick={() => goTo(id)}>
                <Icon size={20} strokeWidth={1.8} />
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        {/* Verse info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--amber2)', marginBottom: 2 }}>الآية {verseKey}</div>
          {verseText && (
            <div className='quran-text' style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {verseText.slice(0, 55)}
              {verseText.length > 55 ? '…' : ''}
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--ink4)', minWidth: 34, textAlign: 'center' }}>{formatTime(currentTime)}</span>
          <button className='btn-circle' onClick={onToggle} disabled={loading} style={{ width: 40, height: 40 }}>
            {loading ? <Loader2 size={17} className='spin' color='white' /> : playing ? <Pause size={17} color='white' /> : <Play size={17} color='white' />}
          </button>
          <span style={{ fontSize: 11, color: 'var(--ink4)', minWidth: 34, textAlign: 'center' }}>{formatTime(duration)}</span>
          <button className='btn btn-icon' onClick={onClose} style={{ width: 32, height: 32 }}>
            <X size={14} />
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
        dir='ltr'
        onChange={e => onSeek(Number(e.target.value))}
        style={{
          background: `linear-gradient(to left, var(--bg3) ${100 - progress}%, var(--emerald) ${100 - progress}%)`,
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
  const [reviewPlan, setReviewPlan] = useState(getReviewPlan);
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
      {/* Welcome */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }} className='anim-fade-up'>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)', marginBottom: 3 }}>مرحباً بك</h1>
          <p style={{ fontSize: 13, color: 'var(--ink3)' }}>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        {streak.current > 0 && (
          <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r-lg)', padding: '10px 14px', textAlign: 'center' }}>
            <Flame size={18} color='var(--amber2)' style={{ marginBottom: 2 }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--amber2)', lineHeight: 1 }}>{streak.current}</div>
            <div style={{ fontSize: 9.5, color: 'var(--ink4)', fontWeight: 700, marginTop: 1 }}>يوم متواصل</div>
          </div>
        )}
      </div>

      {/* Today plan banner */}
      {todayPlan ? (
        <div className='plan-strip anim-fade-up d1' style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10.5, opacity: 0.75, fontWeight: 700, marginBottom: 3 }}>مراجعة اليوم</div>
              <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 2 }}>
                صفحات {todayPlan.from} – {todayPlan.to}
              </div>
              {todayPlan.note && <div style={{ fontSize: 12, opacity: 0.7 }}>{todayPlan.note}</div>}
            </div>
            <button onClick={() => onStartReview(todayPlan.from, todayPlan.to)} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: 'white', padding: '9px 18px', borderRadius: 'var(--r-md)', fontFamily: "'Cairo', sans-serif", fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              ابدأ الآن <ChevronLeft size={15} />
            </button>
          </div>
        </div>
      ) : (
        reviewPlan.enabled && (
          <div className='card anim-fade-up d1' style={{ padding: 14, marginBottom: 18, borderColor: 'var(--emerald-border)', background: 'var(--emerald-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--emerald)', fontWeight: 700, marginBottom: 2 }}>خطة المراجعة اليومية</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 700 }}>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }} className='anim-fade-up d2'>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--ink)' }}>
            {stats.total}
          </div>
          <div className='stat-lbl'>إجمالي الأخطاء</div>
        </div>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--emerald)' }}>
            {stats.resolved}
          </div>
          <div className='stat-lbl'>تم حلها</div>
        </div>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--crimson2)' }}>
            {stats.pending}
          </div>
          <div className='stat-lbl'>معلّقة</div>
        </div>
      </div>

      {/* Progress */}
      {stats.total > 0 && (
        <div className='card anim-fade-up d2' style={{ padding: 16, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>نسبة إنجاز المراجعة</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--emerald)' }}>{resolvedPct}%</span>
          </div>
          <div className='progress'>
            <div className='progress-bar' style={{ width: `${resolvedPct}%` }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 7 }}>
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
          padding: '20px 22px',
          borderRadius: 'var(--r-xl)',
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, var(--emerald) 0%, var(--emerald2) 60%, var(--emerald3) 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          boxShadow: '0 8px 28px var(--emerald-glow)',
          transition: 'all 0.2s',
          marginBottom: 14,
          fontFamily: "'Cairo', sans-serif",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 36px var(--emerald-glow)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 28px var(--emerald-glow)';
        }}>
        <div style={{ width: 50, height: 50, borderRadius: '13px', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BookOpen size={24} color='white' />
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 2 }}>ابدأ مراجعة جديدة</div>
          <div style={{ fontSize: 12.5, opacity: 0.76 }}>اختر نطاق الصفحات وابدأ الآن</div>
        </div>
        <ChevronLeft size={20} opacity={0.6} />
      </button>

      {/* Recent sessions */}
      {recentSessions.length > 0 && (
        <div className='anim-fade-up d4'>
          <div className='section-label' style={{ marginBottom: 8 }}>
            آخر الجلسات
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {recentSessions.map((s, i) => (
              <div key={i} className='card-flat' style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                    صفحات {s.fromPage} – {s.toPage}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 2 }}>{formatDate(s.date)}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{s.mistakeCount > 0 ? <span className='badge badge-red'>{s.mistakeCount} خطأ</span> : <span className='badge badge-emerald'>نظيف ✓</span>}</div>
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
  const [mode, setMode] = useState('pages');
  const [loadingSurahs, setLoadingSurahs] = useState(false);

  useEffect(() => {
    setLoadingSurahs(true);
    fetchSurahList().then(s => {
      setSurahs(s);
      setLoadingSurahs(false);
    });
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
            <div style={{ width: 42, height: 42, borderRadius: '11px', background: 'var(--emerald-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color='var(--emerald)' />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>ابدأ مراجعة</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>اختر نطاق الصفحات</div>
            </div>
          </div>
        </div>

        <div className='sheet-body'>
          <div className='tab-bar' style={{ marginBottom: 16 }}>
            <button className={`tab-item ${mode === 'pages' ? 'active' : ''}`} onClick={() => setMode('pages')}>
              <Hash size={13} /> بالصفحات
            </button>
            <button className={`tab-item ${mode === 'surah' ? 'active' : ''}`} onClick={() => setMode('surah')}>
              <BookText size={13} /> بالسورة
            </button>
          </div>

          {mode === 'pages' ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
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
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 5 }}>{f.label}</label>
                    <input type='number' min={1} max={604} value={f.val} onChange={e => f.set(Number(e.target.value))} className='input' style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: 'var(--emerald)', padding: '9px' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  { l: 'صفحة واحدة', d: 0 },
                  { l: '5 صفحات', d: 4 },
                  { l: '10 صفحات', d: 9 },
                  { l: '20 صفحة', d: 19 },
                ].map(p => (
                  <button
                    key={p.l}
                    onClick={() => {
                      setTo(Math.min(604, from + p.d));
                      setErr('');
                    }}
                    style={{ padding: '5px 11px', borderRadius: '999px', border: '1.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Cairo', sans-serif" }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 14 }}>
              {loadingSurahs ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink4)' }}>
                  <Loader2 size={22} className='spin' style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13 }}>جارٍ تحميل قائمة السور...</div>
                </div>
              ) : (
                surahs.map(s => (
                  <button
                    key={s.id}
                    style={{ width: '100%', padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", marginBottom: 2 }}
                    onClick={() => {
                      const pg = s.pages?.[0] || 1;
                      const pgEnd = s.pages?.[s.pages.length - 1] || pg + 2;
                      setFrom(pg);
                      setTo(pgEnd);
                      setMode('pages');
                      setErr('');
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, color: 'var(--amber2)', flexShrink: 0 }}>{s.id}</div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Scheherazade New', serif", fontWeight: 700, fontSize: 15 }}>{s.name_arabic}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink4)' }}>{s.verses_count} آية</div>
                    </div>
                    <ChevronLeft size={13} color='var(--ink4)' />
                  </button>
                ))
              )}
            </div>
          )}

          <div style={{ padding: '10px 14px', borderRadius: '11px', background: 'var(--emerald-bg)', border: '1px solid var(--emerald-border)', marginBottom: 14, textAlign: 'center' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--emerald)' }}>
              {Math.max(0, to - from + 1)} {to - from === 0 ? 'صفحة' : 'صفحات'}
            </span>
          </div>
          {err && <div style={{ color: 'var(--crimson2)', fontSize: 12.5, textAlign: 'center', marginBottom: 10 }}>{err}</div>}
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
            إلغاء
          </button>
          <button
            className='btn btn-primary btn-md'
            style={{ flex: 2, fontSize: 15, fontWeight: 900 }}
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
function ReviewPage({ from, to, settings, onFinish, onPlayAudio, playingKey, hasPlayer }) {
  const [page, setPage] = useState(from);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionMistakes, setSessionMistakes] = useState([]);
  const [pageMistakes, setPageMistakes] = useState([]);
  const [showSummary, setShowSummary] = useState(false);

  // BUG FIX: Use a separate ref for the active verse so actions execute with fresh data
  const [activeVerse, setActiveVerse] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const menuRef = useRef(null);

  // BUG FIX: Modals use their own state that is set atomically with the verse reference
  const [mistakeModalVerse, setMistakeModalVerse] = useState(null);
  const [tafsirModalVerse, setTafsirModalVerse] = useState(null);

  const sessionStart = useRef(new Date().toISOString());
  const touchX = useRef(null);

  const qSizeClass = { sm: 'quran-sm', md: 'quran-md', lg: 'quran-lg' }[settings.quranFontSize] || 'quran-md';

  const loadPage = useCallback(async () => {
    setLoading(true);
    setActiveVerse(null);
    setMenuPos(null);
    const v = await fetchPageVerses(page);
    setVerses(v);
    setPageMistakes(getMistakes().filter(m => m.page === page));
    setLoading(false);
  }, [page]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  // Close menu on outside click
  useEffect(() => {
    const handler = e => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setActiveVerse(null);
        setMenuPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, []);

  const handleVerseClick = (verse, e) => {
    e.stopPropagation();
    e.preventDefault();

    // BUG FIX: If same verse, toggle off
    if (activeVerse?.id === verse.id) {
      setActiveVerse(null);
      setMenuPos(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuH = 148;
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
    setMistakeModalVerse(null);
    setPageMistakes(getMistakes().filter(x => x.page === page));
  };

  // BUG FIX: Extract surah/ayah directly from verse_key, no ambiguity
  const handlePlayAudio = verse => {
    if (!verse?.verse_key) return;
    const parts = verse.verse_key.split(':');
    if (parts.length !== 2) return;
    const [surahStr, ayahStr] = parts;
    onPlayAudio(surahStr, ayahStr, verse.verse_key, verse.text_uthmani);
    closeMenu();
  };

  // BUG FIX: Actions execute immediately with a captured reference - no stale state
  const handleRecordMistake = verse => {
    closeMenu();
    setMistakeModalVerse(verse);
  };

  const handleShowTafsir = verse => {
    closeMenu();
    setTafsirModalVerse(verse);
  };

  const total = to - from + 1;
  const progress = total > 1 ? ((page - from) / (total - 1)) * 100 : 100;
  const mistakeKeys = new Set(pageMistakes.map(m => m.verseKey).filter(Boolean));

  // Group verses by surah
  const groups = [];
  verses.forEach(v => {
    const s = v.chapter_id ? String(v.chapter_id) : v.verse_key?.split(':')?.[0];
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
      <div className='fixed top-[2px] left-[50px]  ' style={{ zIndex: 40, padding: '11px 16px' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink4)' }}>
            {page - from + 1} / {total}
          </div>
          <button
            onClick={handleFinish}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: '10px', border: '1.5px solid var(--crimson-border)', background: 'var(--crimson-bg)', color: 'var(--crimson2)', fontFamily: "'Cairo', sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', transition: 'all 0.18s' }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'var(--crimson2)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '0 3px 10px rgba(122,24,24,0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'var(--crimson-bg)';
              e.currentTarget.style.color = 'var(--crimson2)';
              e.currentTarget.style.boxShadow = '0 1px 4px rgba(122,24,24,0.1)';
            }}>
            <Check size={13} strokeWidth={2.5} />
            أنهيت
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: `18px 16px ${hasPlayer ? '150px' : '110px'}` }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className='skel' style={{ height: 48, opacity: 0.6 }} />
            ))}
          </div>
        ) : (
          <>
            {verses[0]?.verse_number === 1 && <div className='bismillah'>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}

            {groups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: 20 }}>
                {group.verses[0]?.verse_number === 1 && gi > 0 && (
                  <div className='surah-header-divider'>
                    <div className='quran-text' style={{ fontSize: 12, color: 'var(--amber2)' }}>
                      ـ ـ ـ سورة جديدة ـ ـ ـ
                    </div>
                    <div className='quran-text' style={{ fontSize: 21, color: 'var(--amber3)', marginTop: 5 }}>
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
        <div ref={menuRef} className='verse-menu' style={{ top: menuPos.top, left: menuPos.left, right: 'auto', width: 210 }}>
          <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink4)', fontWeight: 700 }}>الآية {activeVerse.verse_key}</div>
          </div>
          {/* BUG FIX: Use onMouseDown to capture verse before onBlur fires */}
          <button
            className='verse-menu-item'
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              handleRecordMistake(activeVerse);
            }}>
            <Plus size={14} color='var(--crimson2)' /> تسجيل خطأ
          </button>
          <button
            className='verse-menu-item'
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              handleShowTafsir(activeVerse);
            }}>
            <BookText size={14} color='var(--emerald)' /> عرض التفسير
          </button>
          <button
            className='verse-menu-item'
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              handlePlayAudio(activeVerse);
            }}>
            <Volume2 size={14} color='var(--amber2)' /> استمع للآية
          </button>
        </div>
      )}

      {/* Bottom controls */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '9px 14px max(12px,env(safe-area-inset-bottom))', zIndex: 30, backdropFilter: 'blur(14px)' }}>
        
        <div style={{ display: 'flex', gap: 9 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1, gap: 5 }} disabled={page <= from} onClick={() => setPage(p => p - 1)}>
            <ChevronRight size={16} /> السابقة
          </button>
          <button
            className='btn btn-primary btn-md'
            style={{ flex: 1, gap: 5 }}
            onClick={() => {
              if (page < to) setPage(p => p + 1);
              else handleFinish();
            }}>
            {page < to ? 'التالية' : 'إنهاء'} <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* Mistake Modal */}
      {mistakeModalVerse && <MistakeModal page={page} verseKey={mistakeModalVerse.verse_key} verseText={mistakeModalVerse.text_uthmani} onClose={() => setMistakeModalVerse(null)} onSaved={onMistakeSaved} />}

      {/* Tafsir Modal */}
      {tafsirModalVerse && <TafsirModal verseKey={tafsirModalVerse.verse_key} verseText={tafsirModalVerse.text_uthmani} tafsirId={settings.defaultTafsir} onClose={() => setTafsirModalVerse(null)} />}
    </div>
  );
}

// ─── Session Summary ──────────────────────────────────────────────────────────
function SessionSummary({ mistakes, from, to, onDone }) {
  const pages = [...new Set(mistakes.map(m => m.page))];
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className='card anim-fade-up' style={{ padding: '36px 26px', maxWidth: 420, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 76, height: 76, borderRadius: '20px', background: mistakes.length === 0 ? 'var(--emerald-bg)' : 'var(--amber-bg)', border: `2px solid ${mistakes.length === 0 ? 'var(--emerald-border)' : 'var(--amber-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>{mistakes.length === 0 ? <CheckCircle size={36} color='var(--emerald)' /> : <BarChart2 size={36} color='var(--amber2)' />}</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 5 }}>{mistakes.length === 0 ? 'مراجعة نظيفة 🌟' : 'ملخص الجلسة'}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 24 }}>
          صفحات {from} – {to}
        </p>

        {mistakes.length > 0 ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 18 }}>
              {[
                { val: mistakes.length, lbl: 'أخطاء مسجّلة', color: 'var(--crimson2)' },
                { val: pages.length, lbl: 'صفحات متأثرة', color: 'var(--amber2)' },
              ].map((s, i) => (
                <div key={i} className='card-flat' style={{ padding: '14px', textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 3 }}>{s.lbl}</div>
                </div>
              ))}
            </div>
            {pages.length > 0 && (
              <div style={{ padding: '11px 14px', borderRadius: '11px', background: 'var(--bg2)', marginBottom: 18, textAlign: 'right' }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink4)', marginBottom: 7 }}>الصفحات المتأثرة</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {pages.map(p => (
                    <span key={p} className='badge badge-amber'>
                      ص {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: '20px', borderRadius: '14px', background: 'var(--emerald-bg)', border: '1px solid var(--emerald-border)', marginBottom: 24 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--emerald)', marginBottom: 3 }}>ما شاء الله!</div>
            <div style={{ fontSize: 13, color: 'var(--emerald2)' }}>لم تسجّل أي أخطاء في هذه المراجعة</div>
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
    setTimeout(() => {
      setSaving(false);
      onSaved(m);
    }, 250);
  };

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>تسجيل خطأ</div>
            <span className='badge badge-amber'>صفحة {page}</span>
          </div>
        </div>
        <div className='sheet-body'>
          {verseText && (
            <div style={{ padding: '11px 13px', borderRadius: '11px', background: 'var(--bg2)', border: '1px solid var(--border)', marginBottom: 16 }}>
              <div className='quran-text' style={{ fontSize: 16, lineHeight: 2.2 }}>
                {verseText.slice(0, 90)}
                {verseText.length > 90 ? '…' : ''}
              </div>
              {verseKey && <div style={{ fontSize: 10.5, color: 'var(--ink4)', marginTop: 5 }}>الآية {verseKey}</div>}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 9 }}>نوع الخطأ</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {ERROR_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setType(t.id);
                    setErr('');
                  }}
                  style={{
                    padding: '12px 10px',
                    borderRadius: '11px',
                    border: `2px solid ${type === t.id ? t.color : 'var(--border2)'}`,
                    background: type === t.id ? `${t.color}14` : 'var(--surface2)',
                    cursor: 'pointer',
                    textAlign: 'right',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    fontFamily: "'Cairo', sans-serif",
                    fontWeight: 700,
                    fontSize: 12.5,
                    color: type === t.id ? t.color : 'var(--ink2)',
                    transition: 'all 0.13s',
                  }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 7 }}>ملاحظة (اختياري)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder='اكتب ملاحظة للمراجعة لاحقاً...' className='input' />
          </div>
          {err && <div style={{ color: 'var(--crimson2)', fontSize: 12.5, textAlign: 'center', marginBottom: 9 }}>{err}</div>}
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
            إلغاء
          </button>
          <button className='btn btn-danger btn-md' style={{ flex: 1 }} disabled={saving} onClick={save}>
            {saving ? (
              <>
                <Loader2 size={14} className='spin' /> جارٍ الحفظ...
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
    setTafsir(null);
    fetchTafsir(verseKey, tafsirId)
      .then(t => {
        setTafsir(t);
        setLoading(false);
        if (!t) setError(true);
      })
      .catch(() => {
        setLoading(false);
        setError(true);
      });
  }, [verseKey, tafsirId]);

  const cleanText = html => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
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
              <div style={{ fontWeight: 900, fontSize: 17 }}>التفسير</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink4)', marginTop: 1 }}>الآية {verseKey}</div>
            </div>
            <button className='btn btn-icon' onClick={onClose}>
              <X size={17} />
            </button>
          </div>
        </div>
        <div className='sheet-body' style={{ paddingBottom: 20 }}>
          {verseText && (
            <div style={{ padding: '14px 16px', borderRadius: '13px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', marginBottom: 20 }}>
              <div className='quran-text quran-md' style={{ textAlign: 'center', lineHeight: 2.5 }}>
                {verseText}
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className='skel' style={{ height: 16, opacity: 0.7 - i * 0.08 }} />
              ))}
            </div>
          ) : error || !tafsir?.text ? (
            <div style={{ textAlign: 'center', color: 'var(--ink4)', padding: '24px 0' }}>
              <AlertCircle size={26} style={{ marginBottom: 9 }} />
              <div style={{ fontWeight: 700, fontSize: 14 }}>لم يتم العثور على تفسير لهذه الآية</div>
              <div style={{ fontSize: 12, marginTop: 5 }}>جرّب تفسيراً آخر من الإعدادات</div>
            </div>
          ) : (
            <div style={{ fontSize: 15, lineHeight: 2.3, color: 'var(--ink2)', fontFamily: "'Noto Naskh Arabic', 'Amiri', serif", direction: 'rtl' }}>{cleanText(tafsir.text)}</div>
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

  const load = useCallback(() => {
    const m = getMistakes();
    setMistakes(m);
    onCountChange?.(m.filter(x => !x.resolved).length);
  }, [onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

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
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 3 }}>سجل الأخطاء</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>
          {mistakes.length} خطأ مسجّل · {pending.length} معلّق
        </p>
      </div>

      {mistakes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, marginBottom: 18 }}>
          {[
            { label: 'الكل', val: mistakes.length, color: 'var(--ink)' },
            { label: 'معلّق', val: pending.length, color: 'var(--crimson2)' },
            { label: 'منجز', val: mistakes.filter(x => x.resolved).length, color: 'var(--emerald)' },
            { label: 'صفحات', val: new Set(mistakes.map(m => m.page)).size, color: 'var(--amber2)' },
          ].map((s, i) => (
            <div key={i} className='stat-card' style={{ padding: '11px 8px' }}>
              <div className='stat-num' style={{ fontSize: 22, color: s.color }}>
                {s.val}
              </div>
              <div className='stat-lbl'>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
          <select value={filterPage} onChange={e => setFilterPage(e.target.value)} className='input' style={{ padding: '8px 11px', fontSize: 13 }}>
            <option value=''>كل الصفحات</option>
            {pages.map(p => (
              <option key={p} value={p}>
                صفحة {p}
              </option>
            ))}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className='input' style={{ padding: '8px 11px', fontSize: 13 }}>
            <option value=''>كل الأنواع</option>
            {ERROR_TYPES.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {tab === 'pending' && pending.filter(m => m.repetitionCount > 2).length > 0 && (
        <div className='card' style={{ padding: '13px 14px', marginBottom: 14, background: 'var(--crimson-bg)', borderColor: 'var(--crimson-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--crimson2)' }}>أخطاء صعبة تحتاج مراجعة</div>
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

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
          <CheckCircle size={44} color='var(--emerald)' style={{ marginBottom: 13 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink2)' }}>{tab === 'pending' ? 'لا أخطاء معلّقة 🎉' : 'لا توجد نتائج'}</div>
        </div>
      ) : (
        sortedDates.map(date => (
          <div key={date} style={{ marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink2)' }}>{formatDate(date)}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span className='badge badge-gray'>{grouped[date].length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
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
    <div className='mistake-card' style={{ opacity: mistake.resolved ? 0.58 : 1 }}>
      <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
        <div style={{ width: 3, borderRadius: '999px', background: mistake.resolved ? 'var(--emerald)' : errType?.color || 'var(--crimson2)', alignSelf: 'stretch', flexShrink: 0, minHeight: 44 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
            <span className='badge badge-amber'>ص {mistake.page}</span>
            {mistake.verseKey && <span className='badge badge-gray'>{mistake.verseKey}</span>}
            {mistake.resolved && <span className='badge badge-emerald'>✓ منجز</span>}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{TYPE_LBL[mistake.type] || mistake.type}</div>
          {mistake.verseText && (
            <div className='quran-text' style={{ fontSize: 13.5, lineHeight: 1.9, color: 'var(--ink3)', marginBottom: 3 }}>
              {mistake.verseText.slice(0, 65)}
              {mistake.verseText.length > 65 ? '…' : ''}
            </div>
          )}
          {mistake.note && <div style={{ fontSize: 11.5, color: 'var(--ink4)', fontStyle: 'italic', marginBottom: 5 }}>{mistake.note}</div>}
          {mistake.successCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div className='progress' style={{ flex: 1, height: 3 }}>
                <div className='progress-bar' style={{ width: `${Math.min(100, (mistake.successCount / 3) * 100)}%` }} />
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink4)' }}>{mistake.successCount}/3</span>
            </div>
          )}
          {mistake.repetitionCount > 0 && <div style={{ fontSize: 10.5, color: 'var(--crimson2)', marginTop: 3 }}>تكرر {mistake.repetitionCount} مرات</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          {!mistake.resolved && (
            <>
              <button className='btn btn-emerald-ghost btn-sm' onClick={onFix}>
                راجع
              </button>
              <button className='btn btn-ghost btn-xs' onClick={onResolve} style={{ fontSize: 10.5 }}>
                ✓ حلّ
              </button>
            </>
          )}
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--crimson2)', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Trash2 size={13} />
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
    if (!mistake.verseKey) {
      setLoadingV(false);
      return;
    }
    const [s, a] = mistake.verseKey.split(':');
    setLoadingV(true);
    fetch(`${QAPI}/verses/by_key/${s}:${a}?fields=text_uthmani`)
      .then(r => r.json())
      .then(d => {
        setVerse(d.verse || null);
        setLoadingV(false);
      })
      .catch(() => {
        setLoadingV(false);
      });

    const prevAyah = parseInt(a) - 1;
    if (prevAyah >= 1) {
      fetch(`${QAPI}/verses/by_key/${s}:${prevAyah}?fields=text_uthmani`)
        .then(r => r.json())
        .then(d => setPrevVerse(d.verse || null))
        .catch(() => {});
    }
  }, [mistake.verseKey]);

  const handleSuccess = () => {
    const newCount = (mistake.successCount || 0) + 1;
    const isResolved = newCount >= required;
    updateMistake(mistake.id, { successCount: newCount, resolved: isResolved });
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
      <div style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '13px 16px', backdropFilter: 'blur(14px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button className='btn btn-ghost btn-sm' style={{ gap: 3 }} onClick={onBack}>
            <ChevronRight size={15} /> رجوع
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>وضع التصحيح</div>
            <div style={{ fontSize: 10.5, color: 'var(--ink4)' }}>صفحة {mistake.page}</div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: required }).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${i < successCount ? 'var(--emerald)' : 'var(--border2)'}`, background: i < successCount ? 'var(--emerald)' : 'transparent', transition: 'all 0.3s' }} />
            ))}
          </div>
        </div>
        {successCount > 0 && (
          <div className='progress' style={{ marginTop: 9 }}>
            <div className='progress-bar' style={{ width: `${(successCount / required) * 100}%` }} />
          </div>
        )}
      </div>

      {/* Result overlay */}
      {result && (
        <div className='overlay anim-fade-in' style={{ zIndex: 200 }}>
          <div className='card anim-fade-up' style={{ padding: '36px 24px', maxWidth: 360, width: 'calc(100% - 32px)', textAlign: 'center' }}>
            <div style={{ width: 76, height: 76, borderRadius: '20px', background: mistake.resolved ? 'var(--emerald-bg)' : result === 'success' ? 'var(--emerald-bg)' : 'var(--crimson-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{mistake.resolved ? <Star size={36} color='var(--emerald)' /> : result === 'success' ? <CheckCircle size={36} color='var(--emerald)' /> : <XCircle size={36} color='var(--crimson2)' />}</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 7 }}>{mistake.resolved ? 'أحسنت! اكتملت المراجعة 🎉' : result === 'success' ? 'ممتاز! استمر' : 'حاول مجدداً'}</h2>
            <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 18 }}>{mistake.resolved ? `تم حل هذا الخطأ بعد ${required} مراجعات` : result === 'success' ? `${successCount}/${required} نجاحات` : `${mistake.repetitionCount || 0} تكرار`}</p>
            <div style={{ display: 'flex', gap: 9 }}>
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
      <div style={{ flex: 1, padding: '18px 16px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: '11px', background: `${errType?.color || 'var(--crimson2)'}14`, border: `1px solid ${errType?.color || 'var(--crimson2)'}28`, marginBottom: 14 }}>
          <XCircle size={15} color={errType?.color || 'var(--crimson2)'} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: errType?.color || 'var(--crimson2)' }}>{TYPE_LBL[mistake.type]}</span>
          {mistake.note && <span style={{ fontSize: 11.5, color: 'var(--ink4)', marginRight: 'auto' }}>{mistake.note}</span>}
        </div>

        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {hints.map((h, i) => (
            <span key={i} style={{ fontSize: 12, padding: '5px 11px', borderRadius: '9px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', color: 'var(--amber2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Star size={10} color='var(--amber2)' /> {h}
            </span>
          ))}
        </div>

        {prevVerse && (
          <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--amber2)', marginBottom: 5 }}>الآية السابقة (للسياق)</div>
            <div className='quran-text' style={{ fontSize: 16, lineHeight: 2.2 }}>
              {prevVerse.text_uthmani}
            </div>
          </div>
        )}

        <div className='card' style={{ marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '24px 16px', minHeight: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {loadingV ? (
              <Loader2 size={22} className='spin' color='var(--ink4)' />
            ) : (
              <div style={{ filter: showVerse ? 'none' : 'blur(11px)', transition: 'filter 0.4s', userSelect: showVerse ? 'text' : 'none', width: '100%' }}>
                <div className='quran-text quran-md' style={{ textAlign: 'center' }}>
                  {verse?.text_uthmani || mistake.verseText || ''}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '9px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink4)', background: 'var(--surface2)' }}>
            <span>صفحة {mistake.page}</span>
            {mistake.verseKey && <span>الآية {mistake.verseKey}</span>}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)', padding: '14px 16px max(18px,env(safe-area-inset-bottom))' }}>
        <button className='btn btn-md full-w' style={{ marginBottom: 11, gap: 7, background: showVerse ? 'var(--emerald-bg)' : 'var(--bg2)', color: showVerse ? 'var(--emerald)' : 'var(--ink2)', border: `1px solid ${showVerse ? 'var(--emerald-border)' : 'var(--border)'}` }} onClick={() => setShowVerse(!showVerse)}>
          {showVerse ? <EyeOff size={15} /> : <Eye size={15} />}
          {showVerse ? 'إخفاء الآية' : 'إظهار الآية للتحقق'}
        </button>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className='btn btn-red-ghost btn-md' onClick={handleFail}>
            <XCircle size={15} /> ما زلت أخطئ
          </button>
          <button className='btn btn-primary btn-md' onClick={handleSuccess}>
            <CheckCircle size={15} /> حفظت هذه المرة
          </button>
        </div>
        {!mistake.resolved && (
          <div style={{ textAlign: 'center', marginTop: 9, fontSize: 12, color: 'var(--ink4)' }}>
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
  const [reviewPlan, setReviewPlan] = useState(getReviewPlan);

  const load = () => setSchedule(getSchedule());
  useEffect(() => {
    load();
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 3 }}>جدول المراجعة</h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>خطط مراجعتك اليومية وتتبّع تقدمك</p>
        </div>
        <div style={{ display: 'flex', gap: 7 }}>
          <button className='btn btn-ghost btn-sm' style={{ gap: 4 }} onClick={() => setShowPlanModal(true)}>
            <Target size={13} /> خطة يومية
          </button>
          <button
            className='btn btn-primary btn-sm'
            style={{ gap: 4 }}
            onClick={() => {
              setAddDate(todayStr);
              setShowAddModal(true);
            }}>
            <Plus size={14} /> إضافة
          </button>
        </div>
      </div>

      {reviewPlan.enabled && (
        <div className='plan-strip' style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 10.5, opacity: 0.72, fontWeight: 700, marginBottom: 2 }}>الخطة اليومية النشطة</div>
              <div style={{ fontSize: 16, fontWeight: 900 }}>
                مراجعة {reviewPlan.dailyReview} ص · حفظ {reviewPlan.dailyMemorize} ص
              </div>
            </div>
            <button onClick={() => setShowPlanModal(true)} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: 'white', padding: '7px 13px', borderRadius: '9px', fontFamily: "'Cairo', sans-serif", fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }}>
              تعديل
            </button>
          </div>
        </div>
      )}

      <div className='card' style={{ padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button className='btn btn-icon' style={{ width: 32, height: 32 }} onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>
            <ChevronRight size={15} />
          </button>
          <div style={{ fontWeight: 800, fontSize: 15 }}>
            {monthNames[month]} {year}
          </div>
          <button className='btn btn-icon' style={{ width: 32, height: 32 }} onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>
            <ChevronLeft size={15} />
          </button>
        </div>
        <div className='cal-grid' style={{ marginBottom: 7 }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--ink4)', padding: '2px 0' }}>
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
              <div key={d} className={`cal-day ${isToday ? 'today' : ''} ${hasPlan && !isToday ? 'has-plan' : ''} ${isPast && !hasPlan ? 'past' : ''}`} style={{ fontWeight: isToday ? 900 : hasPlan ? 700 : 400, outline: isSelected ? `2px solid var(--emerald)` : 'none', outlineOffset: 1 }} onClick={() => setSelected(isSelected ? null : dStr)}>
                {d}
                {hasPlan && !isToday && <span className='cal-dot' />}
              </div>
            );
          })}
        </div>
      </div>

      {(() => {
        const displayDate = selected || todayStr;
        const plan = schedMap[displayDate];
        return (
          <div style={{ marginBottom: 18 }}>
            <div className='divider' style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{displayDate === todayStr && !selected ? 'مراجعة اليوم' : formatDate(displayDate)}</span>
            </div>
            {plan ? (
              <div className='card' style={{ padding: '16px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>
                      صفحات {plan.from} – {plan.to}
                    </div>
                    {plan.note && <div style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{plan.note}</div>}
                    <div style={{ fontSize: 11.5, color: 'var(--ink4)', marginTop: 3 }}>{plan.to - plan.from + 1} صفحات</div>
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button className='btn btn-primary btn-sm' onClick={() => onStartReview(plan.from, plan.to)}>
                      ابدأ
                    </button>
                    <button
                      className='btn btn-icon'
                      style={{ width: 32, height: 32 }}
                      onClick={() => {
                        deleteScheduleItem(plan.id);
                        load();
                        setSelected(null);
                      }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <Calendar size={30} color='var(--ink4)' style={{ marginBottom: 9 }} />
                <div style={{ fontSize: 13.5, color: 'var(--ink4)', marginBottom: 12 }}>لا خطة لهذا اليوم</div>
                <button
                  className='btn btn-emerald-ghost btn-sm'
                  style={{ gap: 5 }}
                  onClick={() => {
                    setAddDate(displayDate);
                    setShowAddModal(true);
                  }}>
                  <Plus size={13} /> أضف خطة مراجعة
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {upcoming.length > 1 && (
        <div>
          <div className='section-label'>القادمة قريباً</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {upcoming.map(s => (
              <div key={s.id} className='card' style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    صفحات {s.from} – {s.to}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink4)', marginTop: 2 }}>{formatDate(s.date)}</div>
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
          <div style={{ fontWeight: 900, fontSize: 17 }}>إضافة خطة مراجعة</div>
        </div>
        <div className='sheet-body'>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 5 }}>التاريخ</label>
              <input type='date' value={date} onChange={e => setDate(e.target.value)} className='input' />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11 }}>
              {[
                { l: 'من صفحة', v: from, s: setFrom },
                { l: 'إلى صفحة', v: to, s: setTo },
              ].map(f => (
                <div key={f.l}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 5 }}>{f.l}</label>
                  <input type='number' min={1} max={604} value={f.v} onChange={e => f.s(Number(e.target.value))} className='input' style={{ textAlign: 'center', fontSize: 20, fontWeight: 900, color: 'var(--emerald)' }} />
                </div>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 5 }}>ملاحظة (اختياري)</label>
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
          <div style={{ fontWeight: 900, fontSize: 17 }}>خطة المراجعة اليومية</div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 2 }}>حدّد هدفك اليومي للمراجعة والحفظ</div>
        </div>
        <div className='sheet-body'>
          <div style={{ padding: '12px 14px', borderRadius: '13px', background: 'var(--emerald-bg)', border: '1px solid var(--emerald-border)', marginBottom: 18 }}>
            <div style={{ fontSize: 13, color: 'var(--emerald)', fontWeight: 700 }}>{enabled ? `ستراجع ${dailyReview} صفحة وتحفظ ${dailyMemorize} صفحة يومياً` : 'الخطة معطّلة حالياً'}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { label: 'صفحات المراجعة اليومية', val: dailyReview, set: setDailyReview, min: 1, max: 30, icon: <RefreshCw size={15} color='var(--emerald)' /> },
              { label: 'صفحات الحفظ اليومية', val: dailyMemorize, set: setDailyMemorize, min: 0, max: 10, icon: <BookMarked size={15} color='var(--amber2)' /> },
            ].map(f => (
              <div key={f.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
                  {f.icon}
                  <label style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink2)' }}>{f.label}</label>
                  <span style={{ marginRight: 'auto', fontSize: 19, fontWeight: 900, color: 'var(--emerald)' }}>{f.val}</span>
                </div>
                <input type='range' min={f.min} max={f.max} value={f.val} onChange={e => f.set(Number(e.target.value))} style={{ background: `linear-gradient(to left, var(--bg3) ${100 - ((f.val - f.min) / (f.max - f.min)) * 100}%, var(--emerald) ${100 - ((f.val - f.min) / (f.max - f.min)) * 100}%)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--ink4)', marginTop: 3 }}>
                  <span>{f.min}</span>
                  <span>{f.max}</span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>تفعيل الخطة</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink4)' }}>إظهار الخطة في الرئيسية</div>
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
            <Save size={14} /> حفظ الخطة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quarters Screen ──────────────────────────────────────────────────────────
function QuartersScreen({ onPlayAudio, settings, playingKey }) {
  const [surahs, setSurahs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [verses, setVerses] = useState([]);
  const [loadingV, setLoadingV] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('quarters'); // quarters | hizb

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

  // BUG FIX: Correct quarter calculation
  // Surah quarters: divide verses into 4 equal parts
  // Hizb: group by hizb_number changes
  const getSurahQuarters = vv => {
    if (!vv || vv.length === 0) return [];
    const len = vv.length;
    // For short surahs (< 4 verses), return what we have
    const count = Math.min(4, len);
    const result = [];
    for (let qi = 0; qi < count; qi++) {
      const idx = Math.floor((qi / count) * len);
      const v = vv[idx];
      if (v) {
        result.push({
          verseNumber: v.verse_number,
          verseKey: v.verse_key,
          text: v.text_uthmani,
          label: qi === 0 ? 'بداية السورة' : `الربع ${qi + 1}`,
          chapter_id: v.chapter_id,
        });
      }
    }
    return result;
  };

  const getHizbDivisions = vv => {
    if (!vv || vv.length === 0) return [];
    const divisions = [];
    let lastHizb = null;
    vv.forEach(v => {
      const hizb = v.hizb_number;
      if (hizb && hizb !== lastHizb) {
        lastHizb = hizb;
        divisions.push({
          verseNumber: v.verse_number,
          verseKey: v.verse_key,
          text: v.text_uthmani,
          label: `الحزب ${hizb}`,
          chapter_id: v.chapter_id,
        });
      }
    });
    return divisions;
  };

  const surahQuarters = selected && verses.length ? getSurahQuarters(verses) : [];
  const hizbDivisions = selected && verses.length ? getHizbDivisions(verses) : [];

  const filtered = surahs.filter(s => s.name_arabic?.includes(search) || s.name_simple?.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search));

  const displayItems = activeTab === 'quarters' ? surahQuarters : hizbDivisions;

  return (
    <div className='page-content'>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 3 }}>الأرباع والأحزاب</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>تصفّح بدايات الأرباع والأحزاب في كل سورة</p>
      </div>

      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={15} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink4)' }} />
        <input type='text' value={search} onChange={e => setSearch(e.target.value)} placeholder='ابحث عن سورة...' className='input' style={{ paddingRight: 36 }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className='skel' style={{ height: 52 }} />
          ))}
        </div>
      ) : (
        filtered.map(surah => (
          <div key={surah.id} style={{ marginBottom: 5 }}>
            <button
              style={{
                width: '100%',
                padding: '13px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: selected?.id === surah.id ? 'var(--emerald-bg)' : 'var(--surface)',
                border: `1px solid ${selected?.id === surah.id ? 'var(--emerald-border)' : 'var(--border)'}`,
                borderRadius: selected?.id === surah.id && !loadingV ? 'var(--r-lg) var(--r-lg) 0 0' : 'var(--r-lg)',
                cursor: 'pointer',
                fontFamily: "'Cairo', sans-serif",
                transition: 'all 0.15s',
              }}
              onClick={() => handleSelect(surah)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'var(--amber-bg)', border: '1px solid var(--amber-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--amber2)', flexShrink: 0 }}>{surah.id}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Scheherazade New', serif", color: 'var(--ink)' }}>{surah.name_arabic}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)' }}>
                    {surah.verses_count} آية · {surah.revelation_place === 'makkah' ? 'مكية' : 'مدنية'}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} color='var(--ink4)' style={{ transform: selected?.id === surah.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            {selected?.id === surah.id && (
              <div className='card' style={{ borderRadius: '0 0 var(--r-lg) var(--r-lg)', borderTop: 'none', padding: '16px 14px' }}>
                {loadingV ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} className='skel' style={{ height: 44 }} />
                    ))}
                  </div>
                ) : (
                  <>
                    <div className='tab-bar' style={{ marginBottom: 14 }}>
                      <button className={`tab-item ${activeTab === 'quarters' ? 'active' : ''}`} onClick={() => setActiveTab('quarters')}>
                        أرباع السورة
                      </button>
                      <button className={`tab-item ${activeTab === 'hizb' ? 'active' : ''}`} onClick={() => setActiveTab('hizb')}>
                        الأحزاب
                      </button>
                    </div>

                    {displayItems.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'var(--ink4)', padding: '14px 0', fontSize: 13 }}>{activeTab === 'hizb' ? 'لا يوجد تقسيم حزب داخل هذه السورة' : 'السورة قصيرة جداً'}</div>
                    ) : (
                      displayItems.map((q, i) => (
                        <QuarterItem
                          key={i}
                          item={q}
                          isPlaying={playingKey === q.verseKey}
                          onPlay={() => {
                            if (!q.verseKey) return;
                            const [s, a] = q.verseKey.split(':');
                            onPlayAudio(s, a, q.verseKey, q.text);
                          }}
                        />
                      ))
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function QuarterItem({ item, onPlay, isPlaying }) {
  return (
    <div style={{ padding: '11px 13px', borderRadius: 'var(--r-md)', background: isPlaying ? 'var(--emerald-bg)' : 'var(--surface2)', border: `1px solid ${isPlaying ? 'var(--emerald-border)' : 'var(--border)'}`, marginBottom: 7, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <span className={`badge ${isPlaying ? 'badge-emerald' : 'badge-emerald'}`}>{item.label}</span>
          <span className='badge badge-amber'>آية {item.verseNumber}</span>
        </div>
        <div className='quran-text' style={{ fontSize: 15.5, lineHeight: 2, color: 'var(--ink)', overflow: 'hidden' }}>
          {item.text?.slice(0, 75)}
          {item.text?.length > 75 ? '…' : ''}
        </div>
      </div>
      <button className='btn btn-ghost btn-sm' style={{ flexShrink: 0, padding: '5px 9px' }} onClick={onPlay}>
        {isPlaying ? <Volume2 size={13} color='var(--emerald)' /> : <Play size={13} color='var(--amber2)' />}
      </button>
    </div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────
function SettingsScreen({ settings, onChange }) {
  return (
    <div className='page-content'>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 3 }}>الإعدادات</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>تخصيص تجربة مراجعة القرآن الكريم</p>
      </div>

      <SettingsSection title='المظهر والعرض'>
        <SettingRow label='الوضع الداكن' sub='تغيير مظهر التطبيق للوضع الداكن'>
          <label className='switch'>
            <input type='checkbox' checked={settings.darkMode} onChange={e => onChange({ darkMode: e.target.checked })} />
            <div className='switch-track' />
            <div className='switch-thumb' />
          </label>
        </SettingRow>
        <SettingRow label='حجم خط القرآن' sub='تكبير أو تصغير نص الآيات'>
          <div style={{ display: 'flex', gap: 5 }}>
            {[
              { id: 'sm', l: 'ص', size: 14 },
              { id: 'md', l: 'م', size: 18 },
              { id: 'lg', l: 'ك', size: 22 },
            ].map(s => (
              <button key={s.id} onClick={() => onChange({ quranFontSize: s.id })} style={{ width: 34, height: 34, borderRadius: '9px', border: `1.5px solid ${settings.quranFontSize === s.id ? 'var(--emerald)' : 'var(--border2)'}`, background: settings.quranFontSize === s.id ? 'var(--emerald-bg)' : 'transparent', color: settings.quranFontSize === s.id ? 'var(--emerald)' : 'var(--ink3)', fontWeight: 700, fontSize: s.size - 2, cursor: 'pointer', fontFamily: "'Scheherazade New', serif" }}>
                {s.l}
              </button>
            ))}
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title='إعدادات المراجعة'>
        <SettingRow label='عدد مرات التحقق' sub={`يحتاج ${settings.requiredChecks || 3} نجاحات لحل الخطأ`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <StepButton dir='dec' onClick={() => onChange({ requiredChecks: Math.max(1, (settings.requiredChecks || 3) - 1) })} />
            <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--emerald)', minWidth: 26, textAlign: 'center' }}>{settings.requiredChecks || 3}</span>
            <StepButton dir='inc' onClick={() => onChange({ requiredChecks: Math.min(10, (settings.requiredChecks || 3) + 1) })} />
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title='التفسير'>
        <SettingRow label='التفسير الافتراضي' sub='يُعرض عند الضغط على أي آية'>
          <select value={settings.defaultTafsir} onChange={e => onChange({ defaultTafsir: e.target.value })} className='input' style={{ width: 'auto', padding: '7px 11px', fontSize: 13 }}>
            {TAFSIR_OPTIONS.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title='الصوت والتلاوة'>
        <SettingRow label='القارئ الافتراضي' sub='للاستماع عبر المشغّل المدمج'>
          <select value={settings.reciter || '7'} onChange={e => onChange({ reciter: e.target.value })} className='input' style={{ width: 'auto', padding: '7px 11px', fontSize: 13, maxWidth: 155 }}>
            {RECITERS.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsSection>

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
        <SettingRow label='إعادة تعيين الأخطاء' sub='حذف جميع الأخطاء المسجّلة'>
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

      <div className='card-flat' style={{ padding: '18px', textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: '14px', background: 'linear-gradient(135deg, var(--emerald), var(--emerald2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 12px var(--emerald-glow)' }}>
          <BookOpen size={22} color='white' />
        </div>
        <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 22, color: 'var(--amber2)', marginBottom: 5 }}>مراجع القرآن</div>
        <div style={{ fontSize: 12.5, color: 'var(--ink4)' }}>تطبيق لتتبع وتحسين حفظ القرآن الكريم</div>
        <div style={{ fontSize: 12, color: 'var(--ink4)', marginTop: 7, fontFamily: "'Scheherazade New', serif", lineHeight: 2 }}>﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾</div>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div className='section-label'>{title}</div>
      <div className='card' style={{ padding: '0 16px' }}>
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, sub, children }) {
  return (
    <div className='settings-row'>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{label}</div>
        {sub && <div style={{ fontSize: 11.5, color: 'var(--ink4)', marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function StepButton({ dir, onClick }) {
  return (
    <button onClick={onClick} style={{ width: 30, height: 30, borderRadius: '8px', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 900, fontSize: 18, fontFamily: "'Cairo', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink2)', lineHeight: 1 }}>
      {dir === 'inc' ? '+' : '−'}
    </button>
  );
}
