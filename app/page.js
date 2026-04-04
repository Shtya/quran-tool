"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  BookOpen, BarChart2, Calendar, Settings, ChevronRight, ChevronLeft,
  Plus, Trash2, RefreshCw, CheckCircle, XCircle, Eye, EyeOff,
  Moon, Sun, Mic, BookMarked, AlignJustify, Layers, List,
  ArrowRight, Flame, Star, Target, TrendingUp, Volume2, ScrollText,
  Info, X, Check, ChevronDown, Menu, Grid3X3, Headphones, BookText
} from "lucide-react";

// ─── MongoDB API Layer ─────────────────────────────────────────────────────────
const API = {
  async get(collection, query = {}) {
    try {
      const qs = new URLSearchParams({ collection, query: JSON.stringify(query) });
      const res = await fetch(`/api/db?${qs}`);
      if (!res.ok) throw new Error("DB read failed");
      return await res.json();
    } catch { return []; }
  },
  async post(collection, doc) {
    try {
      const res = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, doc }),
      });
      if (!res.ok) throw new Error("DB write failed");
      return await res.json();
    } catch { return null; }
  },
  async put(collection, id, updates) {
    try {
      const res = await fetch("/api/db", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, id, updates }),
      });
      if (!res.ok) throw new Error("DB update failed");
      return await res.json();
    } catch { return null; }
  },
  async delete(collection, id) {
    try {
      const res = await fetch(`/api/db?collection=${collection}&id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("DB delete failed");
      return true;
    } catch { return false; }
  },
};

// ─── Local Storage Fallback (until MongoDB API is connected) ──────────────────
const STORE = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
  },
  getOne(key, defaultVal = {}) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(defaultVal)); } catch { return defaultVal; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  },
  push(key, item) {
    const arr = this.get(key);
    arr.push(item);
    this.set(key, arr);
  },
  update(key, id, updates) {
    const arr = this.get(key);
    const i = arr.findIndex(x => x.id === id);
    if (i !== -1) { arr[i] = { ...arr[i], ...updates }; this.set(key, arr); return arr[i]; }
    return null;
  },
  remove(key, id) {
    this.set(key, this.get(key).filter(x => x.id !== id));
  },
};

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function getMistakes() { return STORE.get("q_mistakes"); }
function saveMistake(m) { STORE.push("q_mistakes", m); }
function updateMistake(id, u) { return STORE.update("q_mistakes", id, u); }
function deleteMistake(id) { STORE.remove("q_mistakes", id); }

function getSessions() { return STORE.get("q_sessions"); }
function saveSession(s) { STORE.push("q_sessions", s); }

function getSchedule() { return STORE.get("q_schedule"); }
function saveScheduleItem(item) { STORE.push("q_schedule", item); }
function updateScheduleItem(id, u) { return STORE.update("q_schedule", id, u); }
function deleteScheduleItem(id) { STORE.remove("q_schedule", id); }

function getSettings() {
  return STORE.getOne("q_settings", {
    requiredChecks: 3,
    darkMode: false,
    defaultTafsir: "ar.muyassar",
    quranFontSize: "md",
    reciter: "ar.alafasy",
  });
}
function saveSettings(s) { STORE.set("q_settings", s); }

function getStreak() {
  return STORE.getOne("q_streak", { current: 0, best: 0, lastDate: null });
}
function updateStreak() {
  const streak = getStreak(), today = new Date().toDateString(), yesterday = new Date(Date.now() - 86400000).toDateString();
  if (streak.lastDate === today) return streak;
  const cur = streak.lastDate === yesterday ? streak.current + 1 : 1;
  const updated = { current: cur, best: Math.max(cur, streak.best || 0), lastDate: today };
  STORE.set("q_streak", updated);
  return updated;
}

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d), today = new Date(), yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "اليوم";
  if (date.toDateString() === yesterday.toDateString()) return "الأمس";
  return date.toLocaleDateString("ar-SA", { weekday: "long", month: "long", day: "numeric" });
}

function toAr(n) { return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]); }

// ─── Quran API ────────────────────────────────────────────────────────────────
const QAPI = "https://api.quran.com/api/v4";
async function fetchPageVerses(page) {
  try {
    const r = await fetch(`${QAPI}/verses/by_page/${page}?translations=&fields=text_uthmani,verse_number,juz_number,hizb_number&per_page=50`);
    const d = await r.json(); return d.verses || [];
  } catch { return []; }
}
async function fetchTafsir(verseKey, tafsirId = "ar.muyassar") {
  try {
    const r = await fetch(`${QAPI}/tafsirs/${tafsirId}/by_ayah/${verseKey}`);
    const d = await r.json(); return d.tafsir || null;
  } catch { return null; }
}
async function fetchSurahList() {
  try {
    const r = await fetch(`${QAPI}/chapters?language=ar`);
    const d = await r.json(); return d.chapters || [];
  } catch { return []; }
}
async function fetchSurahVerses(surahNum) {
  try {
    const r = await fetch(`${QAPI}/verses/by_chapter/${surahNum}?fields=text_uthmani,verse_number&per_page=300`);
    const d = await r.json(); return d.verses || [];
  } catch { return []; }
}

// Quarter boundaries per surah (approximate starting verse numbers of each hizb quarter)
const HIZB_QUARTERS = {};

// ─── Global Styles ────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Cream / warm beige palette for light */
  --bg: #F7F3EE;
  --bg2: #EDE8E0;
  --bg3: #E4DDD3;
  --surface: #FFFFFF;
  --surface2: #FAF8F5;
  --border: rgba(139,110,80,0.14);
  --border2: rgba(139,110,80,0.22);

  /* Typography */
  --ink: #1C1410;
  --ink2: #4A3D30;
  --ink3: #8B7355;
  --ink4: #B8A090;

  /* Brand */
  --green: #1D6B4E;
  --green2: #28895F;
  --green3: #4DAD82;
  --green-bg: rgba(29,107,78,0.08);
  --green-border: rgba(29,107,78,0.2);

  --gold: #A0722A;
  --gold2: #C4933F;
  --gold3: #E4B86A;
  --gold-bg: rgba(160,114,42,0.08);
  --gold-border: rgba(160,114,42,0.2);

  --red: #8B2020;
  --red2: #C0392B;
  --red-bg: rgba(139,32,32,0.08);
  --red-border: rgba(139,32,32,0.2);

  /* Shadows */
  --shadow-xs: 0 1px 3px rgba(28,20,16,0.06);
  --shadow-sm: 0 2px 8px rgba(28,20,16,0.08);
  --shadow-md: 0 4px 20px rgba(28,20,16,0.1);
  --shadow-lg: 0 8px 40px rgba(28,20,16,0.12);
  --shadow-xl: 0 16px 60px rgba(28,20,16,0.16);

  /* Radius */
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 18px;
  --r-xl: 24px;
  --r-2xl: 32px;

  /* Font sizes */
  --quran-sm: 20px;
  --quran-md: 24px;
  --quran-lg: 28px;
}

.dark {
  --bg: #0F1209;
  --bg2: #161A0F;
  --bg3: #1E2418;
  --surface: #1A1F12;
  --surface2: #232A1A;
  --border: rgba(180,160,100,0.1);
  --border2: rgba(180,160,100,0.18);

  --ink: #EAE0CC;
  --ink2: #C8B898;
  --ink3: #8A7A5A;
  --ink4: #5A4E38;

  --green: #3DAA7A;
  --green2: #4EC28A;
  --green3: #6ED4A0;
  --green-bg: rgba(61,170,122,0.1);
  --green-border: rgba(61,170,122,0.22);

  --gold: #C4933F;
  --gold2: #D8A850;
  --gold3: #ECC870;
  --gold-bg: rgba(196,147,63,0.1);
  --gold-border: rgba(196,147,63,0.22);

  --red: #C0392B;
  --red2: #E05545;
  --red-bg: rgba(192,57,43,0.1);
  --red-border: rgba(192,57,43,0.22);

  --shadow-xs: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.35);
  --shadow-md: 0 4px 20px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 40px rgba(0,0,0,0.45);
  --shadow-xl: 0 16px 60px rgba(0,0,0,0.5);
}

html { scroll-behavior: smooth; }
body {
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  background: var(--bg);
  color: var(--ink);
  direction: rtl;
  -webkit-font-smoothing: antialiased;
  min-height: 100dvh;
  overflow-x: hidden;
}

/* ── Typography ── */
.font-quran { font-family: 'Scheherazade New', 'Noto Naskh Arabic', serif; }
.font-ui { font-family: 'IBM Plex Sans Arabic', sans-serif; }

/* ── Layout ── */
.page { min-height: 100dvh; background: var(--bg); }
.container { max-width: 520px; margin: 0 auto; padding: 0 16px; }
.container-wide { max-width: 680px; margin: 0 auto; padding: 0 16px; }

/* ── Cards ── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-sm);
}
.card-2 {
  background: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
}
.card-hover { transition: box-shadow 0.2s, transform 0.2s; }
.card-hover:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }

/* ── Buttons ── */
.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  font-weight: 600; cursor: pointer; border: none; border-radius: var(--r-md);
  transition: all 0.18s; white-space: nowrap; outline: none;
}
.btn:active { transform: scale(0.96); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

.btn-sm { padding: 7px 14px; font-size: 13px; border-radius: var(--r-sm); }
.btn-md { padding: 11px 20px; font-size: 14px; }
.btn-lg { padding: 14px 28px; font-size: 16px; }
.btn-xl { padding: 17px 32px; font-size: 17px; }

.btn-primary {
  background: var(--green); color: white;
  box-shadow: 0 4px 14px rgba(29,107,78,0.3);
}
.btn-primary:hover:not(:disabled) { background: var(--green2); box-shadow: 0 6px 20px rgba(29,107,78,0.4); }

.btn-gold {
  background: var(--gold); color: white;
  box-shadow: 0 4px 14px rgba(160,114,42,0.28);
}
.btn-gold:hover:not(:disabled) { background: var(--gold2); }

.btn-danger {
  background: var(--red); color: white;
  box-shadow: 0 4px 14px rgba(139,32,32,0.25);
}
.btn-danger:hover:not(:disabled) { background: var(--red2); }

.btn-outline {
  background: transparent; color: var(--ink2);
  border: 1.5px solid var(--border2);
}
.btn-outline:hover:not(:disabled) { background: var(--bg2); }

.btn-ghost {
  background: var(--bg2); color: var(--ink2);
  border: 1px solid var(--border);
}
.btn-ghost:hover:not(:disabled) { background: var(--bg3); }

.btn-green-ghost {
  background: var(--green-bg); color: var(--green);
  border: 1px solid var(--green-border);
}
.btn-green-ghost:hover:not(:disabled) { background: rgba(29,107,78,0.14); }

.btn-gold-ghost {
  background: var(--gold-bg); color: var(--gold);
  border: 1px solid var(--gold-border);
}

.btn-red-ghost {
  background: var(--red-bg); color: var(--red2);
  border: 1px solid var(--red-border);
}
.btn-red-ghost:hover:not(:disabled) { background: rgba(139,32,32,0.14); }

.btn-icon {
  width: 40px; height: 40px; padding: 0;
  border-radius: var(--r-md);
  background: var(--bg2);
  color: var(--ink2);
  border: 1px solid var(--border);
}
.btn-icon:hover:not(:disabled) { background: var(--bg3); }

/* ── Inputs ── */
.input {
  width: 100%; padding: 11px 14px;
  border-radius: var(--r-md); border: 1.5px solid var(--border2);
  background: var(--surface); color: var(--ink);
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  font-size: 14px; outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
  direction: rtl;
}
.input:focus { border-color: var(--green); box-shadow: 0 0 0 3px var(--green-bg); }
.input::placeholder { color: var(--ink4); }

select.input { cursor: pointer; appearance: none; }
textarea.input { resize: none; line-height: 1.7; }

/* ── Badge & Tag ── */
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 10px; border-radius: 999px;
  font-size: 11px; font-weight: 700;
}
.badge-green { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.badge-gold  { background: var(--gold-bg);  color: var(--gold);  border: 1px solid var(--gold-border); }
.badge-red   { background: var(--red-bg);   color: var(--red2);  border: 1px solid var(--red-border); }
.badge-gray  { background: var(--bg2); color: var(--ink3); border: 1px solid var(--border); }

/* ── Progress ── */
.progress { height: 5px; border-radius: 999px; background: var(--bg3); overflow: hidden; }
.progress-bar {
  height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, var(--green), var(--green3));
  transition: width 0.6s cubic-bezier(0.4,0,0.2,1);
}

/* ── Divider ── */
.divider {
  display: flex; align-items: center; gap: 12px;
  color: var(--ink4); font-size: 13px;
}
.divider::before, .divider::after {
  content: ''; flex: 1; height: 1px;
  background: var(--border);
}

/* ── Tabs ── */
.tab-bar {
  display: flex; gap: 4px;
  background: var(--bg2); border: 1px solid var(--border);
  border-radius: var(--r-md); padding: 4px;
}
.tab-item {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 8px; border-radius: var(--r-sm);
  font-size: 13px; font-weight: 600; cursor: pointer;
  color: var(--ink3); background: transparent; border: none;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  transition: all 0.18s;
}
.tab-item.active {
  background: var(--surface); color: var(--green);
  box-shadow: var(--shadow-sm);
}

/* ── Bottom Nav ── */
.bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
  background: var(--surface);
  border-top: 1px solid var(--border);
  padding: 8px 8px max(8px, env(safe-area-inset-bottom));
  display: flex; justify-content: space-around;
  backdrop-filter: blur(12px);
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  padding: 6px 12px; border-radius: var(--r-md);
  cursor: pointer; background: none; border: none;
  color: var(--ink4); font-family: 'IBM Plex Sans Arabic', sans-serif;
  transition: all 0.18s; font-size: 11px; font-weight: 500;
  min-width: 56px;
}
.nav-item.active { color: var(--green); background: var(--green-bg); }
.nav-item.active svg { stroke: var(--green); }

/* ── Quran Text ── */
.quran-text {
  font-family: 'Scheherazade New', 'Noto Naskh Arabic', serif;
  line-height: 2.6;
  color: var(--ink);
  text-align: justify;
  direction: rtl;
}
.quran-text-sm  { font-size: var(--quran-sm); }
.quran-text-md  { font-size: var(--quran-md); }
.quran-text-lg  { font-size: var(--quran-lg); }

.verse-num {
  display: inline-flex; align-items: center; justify-content: center;
  width: 1.8em; height: 1.8em; border-radius: 50%;
  background: var(--gold-bg); border: 1px solid var(--gold-border);
  color: var(--gold); font-size: 0.62em;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  vertical-align: middle; margin: 0 3px; flex-shrink: 0;
}

.verse-span {
  cursor: pointer; border-radius: 4px;
  padding: 1px 2px; transition: background 0.15s;
  display: inline;
}
.verse-span:hover { background: var(--gold-bg); }
.verse-span.has-mistake {
  background: var(--red-bg);
  border-bottom: 2px solid var(--red2);
}
.verse-span.selected { background: var(--green-bg); }

/* ── Bismillah ── */
.bismillah {
  text-align: center;
  font-family: 'Scheherazade New', serif;
  font-size: clamp(22px, 5vw, 28px);
  color: var(--gold2);
  padding: 18px;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--gold-bg), var(--green-bg));
  border: 1px solid var(--gold-border);
  margin-bottom: 20px;
  line-height: 2;
}

/* ── Surah Header ── */
.surah-header {
  text-align: center; padding: 16px;
  border-radius: var(--r-lg);
  background: linear-gradient(135deg, var(--gold-bg), var(--green-bg));
  border: 1px solid var(--border); margin: 20px 0;
}

/* ── Modal / Sheet ── */
.overlay {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(5px);
  display: flex; align-items: flex-end; justify-content: center;
  animation: fadeIn 0.2s ease;
}
@media (min-width: 640px) { .overlay { align-items: center; } }

.sheet {
  width: 100%; max-width: 500px;
  background: var(--surface);
  border-radius: var(--r-2xl) var(--r-2xl) 0 0;
  padding: 0 0 max(24px, env(safe-area-inset-bottom));
  animation: slideUp 0.3s cubic-bezier(0.4,0,0.2,1);
  max-height: 90dvh; overflow-y: auto;
}
@media (min-width: 640px) {
  .sheet {
    border-radius: var(--r-2xl);
    animation: scaleIn 0.28s cubic-bezier(0.34,1.5,0.64,1);
  }
}
.sheet-handle {
  width: 36px; height: 4px; border-radius: 999px;
  background: var(--border2); margin: 14px auto 20px;
}
.sheet-header { padding: 0 20px 16px; border-bottom: 1px solid var(--border); margin-bottom: 20px; }
.sheet-body { padding: 0 20px; }
.sheet-footer { padding: 16px 20px 0; border-top: 1px solid var(--border); margin-top: 20px; }

/* ── Popover ── */
.popover {
  position: absolute; z-index: 200;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--r-lg);
  box-shadow: var(--shadow-xl);
  min-width: 180px;
  animation: scaleIn 0.2s cubic-bezier(0.34,1.5,0.64,1);
  transform-origin: top center;
}
.popover-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; cursor: pointer;
  font-size: 14px; font-weight: 500; color: var(--ink2);
  border-radius: var(--r-sm); transition: background 0.15s;
  background: none; border: none; width: 100%;
  font-family: 'IBM Plex Sans Arabic', sans-serif;
  text-align: right;
}
.popover-item:hover { background: var(--bg2); color: var(--ink); }

/* ── Skeleton ── */
.skel {
  background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: var(--r-md);
}

/* ── Calendar ── */
.cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.cal-day {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  border-radius: var(--r-sm); font-size: 13px; font-weight: 500;
  cursor: pointer; transition: all 0.15s; position: relative;
}
.cal-day.today { background: var(--green); color: white; }
.cal-day.has-plan { background: var(--green-bg); color: var(--green); }
.cal-day.past { color: var(--ink4); }
.cal-day.other-month { color: var(--ink4); opacity: 0.4; }
.cal-day:hover:not(.today) { background: var(--bg2); }
.cal-dot {
  position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
  width: 4px; height: 4px; border-radius: 50%; background: var(--gold);
}

/* ── Animations ── */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }

.anim-fade-up { animation: fadeUp 0.4s ease both; }
.anim-fade-in { animation: fadeIn 0.3s ease both; }
.delay-1 { animation-delay: 0.06s; }
.delay-2 { animation-delay: 0.12s; }
.delay-3 { animation-delay: 0.18s; }
.delay-4 { animation-delay: 0.24s; }

/* ── Scrollbar ── */
::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 999px; }

/* ── Misc ── */
.section-label {
  font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
  color: var(--ink4); text-transform: uppercase; margin-bottom: 12px;
}
.separator { height: 1px; background: var(--border); margin: 0; }

.no-select { user-select: none; -webkit-user-select: none; }
.full-w { width: 100%; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
.p-4 { padding: 16px; }
.p-5 { padding: 20px; }
.mb-3 { margin-bottom: 12px; }
.mb-4 { margin-bottom: 16px; }

/* ── Tafsir ── */
.tafsir-text {
  font-size: 15px; line-height: 2.2; color: var(--ink2);
  font-family: 'Noto Naskh Arabic', 'Scheherazade New', serif;
}

/* ── Settings ── */
.settings-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 0; border-bottom: 1px solid var(--border);
}
.settings-row:last-child { border-bottom: none; }

/* ── Switch ── */
.switch {
  position: relative; width: 44px; height: 24px;
  cursor: pointer;
}
.switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.switch-track {
  position: absolute; inset: 0; border-radius: 999px;
  background: var(--bg3); border: 1.5px solid var(--border2);
  transition: all 0.2s;
}
.switch input:checked + .switch-track { background: var(--green); border-color: var(--green); }
.switch-thumb {
  position: absolute; top: 3px; right: 3px;
  width: 16px; height: 16px; border-radius: 50%;
  background: white; transition: all 0.2s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}
.switch input:checked ~ .switch-thumb { right: calc(100% - 19px); }

/* ── Range Slider ── */
input[type=range] {
  -webkit-appearance: none; width: 100%; height: 4px;
  border-radius: 999px; background: var(--bg3); outline: none; cursor: pointer;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
  background: var(--green); cursor: pointer;
  box-shadow: 0 2px 6px rgba(29,107,78,0.4);
}

/* ── Quarter feature ── */
.quarter-card {
  padding: 14px 16px; border-radius: var(--r-md);
  background: var(--surface2); border: 1px solid var(--border);
  margin-bottom: 8px;
}

/* ── Reading mode ── */
.reading-bg { background: var(--bg); min-height: 100dvh; }
.dark .reading-bg { background: var(--bg); }

/* ── Header ── */
.sticky-header {
  position: sticky; top: 0; z-index: 40;
  background: rgba(var(--surface-rgb, 255,255,255), 0.92);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.dark .sticky-header { background: rgba(26,31,18,0.93); }

/* ── Stat card ── */
.stat-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 18px 16px;
  text-align: center; box-shadow: var(--shadow-xs);
}
.stat-num { font-size: 30px; font-weight: 800; line-height: 1; }
.stat-lbl { font-size: 11px; font-weight: 600; color: var(--ink3); margin-top: 5px; }

/* ── Mistake card ── */
.mistake-card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--r-lg); padding: 14px 16px;
  box-shadow: var(--shadow-xs); transition: box-shadow 0.2s;
}
.mistake-card:hover { box-shadow: var(--shadow-sm); }

/* full-page screens that have bottom nav */
.with-bottom-nav { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
`;

// ─── Error Types ──────────────────────────────────────────────────────────────
const ERROR_TYPES = [
  { id: "forgot_start", label: "نسيان بداية الآية", icon: "←" },
  { id: "wrong_text",   label: "خطأ في النص",       icon: "✏" },
  { id: "forgot_end",   label: "نسيان نهاية الآية", icon: "→" },
  { id: "confused",     label: "خلط بين آيتين",     icon: "⇄" },
];

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [settings, setSettingsState] = useState(getSettings());
  const [screen, setScreen] = useState("home");
  const [reviewRange, setReviewRange] = useState({ from: 1, to: 10 });
  const [fixMistake, setFixMistake] = useState(null);
  const [navTab, setNavTab] = useState("home");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", settings.darkMode);
  }, [settings.darkMode]);

  const updateSettings = (updates) => {
    const next = { ...settings, ...updates };
    setSettingsState(next);
    saveSettings(next);
    document.documentElement.classList.toggle("dark", next.darkMode);
  };

  const goTo = (tab) => {
    setNavTab(tab);
    if (tab === "home") setScreen("home");
    else if (tab === "calendar") setScreen("calendar");
    else if (tab === "mistakes") setScreen("mistakes_list");
    else if (tab === "quarters") setScreen("quarters");
    else if (tab === "settings") setScreen("settings");
  };

  const startReview = (from, to) => {
    setReviewRange({ from, to });
    setScreen("review");
  };

  const openFixMode = (m) => {
    setFixMistake(m);
    setScreen("fix");
  };

  const renderScreen = () => {
    if (screen === "review") {
      return (
        <ReviewPage
          from={reviewRange.from}
          to={reviewRange.to}
          settings={settings}
          onFinish={() => { setNavTab("home"); setScreen("home"); }}
        />
      );
    }
    if (screen === "fix") {
      return (
        <FixMode
          mistake={fixMistake}
          settings={settings}
          onBack={() => setScreen("mistakes_list")}
          onDone={() => { setFixMistake(null); setScreen("mistakes_list"); }}
        />
      );
    }
    return (
      <div className="page with-bottom-nav">
        {screen === "home" && <HomeScreen onStartReview={startReview} settings={settings} />}
        {screen === "calendar" && <CalendarScreen onStartReview={startReview} />}
        {screen === "mistakes_list" && <MistakesScreen onFix={openFixMode} />}
        {screen === "quarters" && <QuartersScreen />}
        {screen === "settings" && <SettingsScreen settings={settings} onChange={updateSettings} />}
        <BottomNav active={navTab} onChange={goTo} />
      </div>
    );
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {renderScreen()}
    </>
  );
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ active, onChange }) {
  const items = [
    { id: "home",      label: "الرئيسية",   Icon: BookOpen },
    { id: "calendar",  label: "الجدول",      Icon: Calendar },
    { id: "mistakes",  label: "الأخطاء",     Icon: List },
    { id: "quarters",  label: "الأرباع",     Icon: Grid3X3 },
    { id: "settings",  label: "الإعدادات",   Icon: Settings },
  ];
  return (
    <nav className="bottom-nav">
      {items.map(({ id, label, Icon }) => (
        <button key={id} className={`nav-item ${active === id ? "active" : ""}`} onClick={() => onChange(id)}>
          <Icon size={22} strokeWidth={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ onStartReview, settings }) {
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0, todayMistakes: 0, pagesReviewed: 0 });
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [todayPlan, setTodayPlan] = useState(null);

  useEffect(() => {
    const m = getMistakes();
    const today = new Date().toDateString();
    setStats({
      total: m.length,
      resolved: m.filter(x => x.resolved).length,
      pending: m.filter(x => !x.resolved).length,
      todayMistakes: m.filter(x => new Date(x.date).toDateString() === today).length,
      pagesReviewed: new Set(m.map(x => x.page)).size,
    });
    setStreak(getStreak());
    const sched = getSchedule();
    const todayStr = new Date().toISOString().split("T")[0];
    setTodayPlan(sched.find(s => s.date === todayStr) || null);
  }, []);

  const resolvedPct = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div style={{ padding: "0 0 8px" }}>
      {/* App Header */}
      <div style={{ padding: "20px 20px 16px", background: "var(--surface)", borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
        <div className="container" style={{ padding: 0, maxWidth: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: "10px", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BookOpen size={20} color="white" />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "var(--green)", lineHeight: 1.2 }}>مراجع القرآن</div>
                <div style={{ fontSize: 11, color: "var(--ink4)" }}>تتبع حفظك ومراجعتك</div>
              </div>
            </div>
            {streak.current > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "var(--gold-bg)", border: "1px solid var(--gold-border)", borderRadius: "12px", padding: "6px 12px" }}>
                <Flame size={18} color="var(--gold2)" />
                <span style={{ fontSize: 14, fontWeight: 800, color: "var(--gold)", lineHeight: 1 }}>{streak.current}</span>
                <span style={{ fontSize: 10, color: "var(--gold3)" }}>يوم</span>
              </div>
            )}
          </div>
          <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 15, color: "var(--ink3)", textAlign: "center", padding: "10px 0 2px" }}>
            ﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 20 }}>
        {/* Today plan */}
        {todayPlan && (
          <div className="card anim-fade-up" style={{ padding: "16px", marginBottom: 16, background: "var(--green-bg)", borderColor: "var(--green-border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 3 }}>مراجعة اليوم</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>صفحات {todayPlan.from} – {todayPlan.to}</div>
                {todayPlan.note && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3 }}>{todayPlan.note}</div>}
              </div>
              <button className="btn btn-primary btn-md" onClick={() => onStartReview(todayPlan.from, todayPlan.to)}>
                ابدأ الآن
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }} className="anim-fade-up delay-1">
          <div className="stat-card">
            <div className="stat-num" style={{ color: "var(--ink)" }}>{stats.total}</div>
            <div className="stat-lbl">إجمالي الأخطاء</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: "var(--green)" }}>{stats.resolved}</div>
            <div className="stat-lbl">تمت مراجعتها</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: "var(--red2)" }}>{stats.pending}</div>
            <div className="stat-lbl">متبقية</div>
          </div>
        </div>

        {/* Progress */}
        {stats.total > 0 && (
          <div className="card anim-fade-up delay-1" style={{ padding: "16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--ink3)" }}>نسبة الإنجاز</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--green)" }}>{resolvedPct}%</span>
            </div>
            <div className="progress"><div className="progress-bar" style={{ width: `${resolvedPct}%` }} /></div>
          </div>
        )}

        {/* Main action */}
        <button
          className="anim-fade-up delay-2"
          onClick={() => setShowModal(true)}
          style={{ width: "100%", padding: "20px 24px", borderRadius: "20px", border: "none", cursor: "pointer", background: "linear-gradient(135deg, var(--green) 0%, var(--green2) 100%)", color: "white", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 8px 28px rgba(29,107,78,0.35)", transition: "all 0.2s", marginBottom: 12, fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 36px rgba(29,107,78,0.45)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(29,107,78,0.35)"; }}
        >
          <div style={{ width: 52, height: 52, borderRadius: "14px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <BookOpen size={26} color="white" />
          </div>
          <div style={{ flex: 1, textAlign: "right" }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 3 }}>ابدأ مراجعة جديدة</div>
            <div style={{ fontSize: 13, opacity: 0.78 }}>اختر نطاق الصفحات للمراجعة</div>
          </div>
          <ChevronLeft size={22} opacity={0.6} />
        </button>

        {/* Secondary actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }} className="anim-fade-up delay-3">
          <ActionCard icon={<RefreshCw size={22} color="var(--gold)" />} label="راجع أخطائك" sub={`${stats.pending} خطأ معلّق`} color="var(--gold-bg)" borderColor="var(--gold-border)" disabled={stats.pending === 0} onClick={() => {}} />
          <ActionCard icon={<Target size={22} color="var(--green)" />} label="الأخطاء الصعبة" sub="ابدأ بالأصعب" color="var(--green-bg)" borderColor="var(--green-border)" onClick={() => {}} />
        </div>

        {stats.todayMistakes > 0 && (
          <div className="anim-fade-up delay-4" style={{ marginTop: 14, textAlign: "center", padding: "10px 16px", borderRadius: "12px", background: "var(--gold-bg)", border: "1px solid var(--gold-border)" }}>
            <span style={{ fontSize: 13, color: "var(--gold)", fontWeight: 600 }}>سجّلت {stats.todayMistakes} أخطاء اليوم</span>
          </div>
        )}
      </div>

      {showModal && <StartReviewModal onStart={(f, t) => { setShowModal(false); onStartReview(f, t); }} onClose={() => setShowModal(false)} />}
    </div>
  );
}

function ActionCard({ icon, label, sub, color, borderColor, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{ padding: "16px", borderRadius: "16px", border: `1.5px solid ${borderColor || "var(--border)"}`, background: color || "var(--surface)", cursor: disabled ? "not-allowed" : "pointer", textAlign: "right", display: "flex", flexDirection: "column", gap: 10, opacity: disabled ? 0.45 : 1, transition: "all 0.18s", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}
    >
      {icon}
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 12, color: "var(--ink3)" }}>{sub}</div>
      </div>
    </button>
  );
}

// ─── Start Review Modal ───────────────────────────────────────────────────────
function StartReviewModal({ onStart, onClose }) {
  const [from, setFrom] = useState(1);
  const [to, setTo]     = useState(10);
  const [err, setErr]   = useState("");

  const validate = () => {
    if (from < 1 || from > 604 || to < from || to > 604) { setErr("تحقق من أرقام الصفحات (1 – 604)"); return false; }
    return true;
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: "12px", background: "var(--green-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BookOpen size={20} color="var(--green)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>ابدأ مراجعة</div>
              <div style={{ fontSize: 13, color: "var(--ink3)" }}>اختر نطاق الصفحات</div>
            </div>
          </div>
        </div>
        <div className="sheet-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
            {[{ label: "من صفحة", val: from, set: v => { setFrom(v); setErr(""); } },
              { label: "إلى صفحة", val: to,   set: v => { setTo(v);   setErr(""); } }].map(f => (
              <div key={f.label}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink3)", marginBottom: 6 }}>{f.label}</label>
                <input type="number" min={1} max={604} value={f.val}
                  onChange={e => f.set(Number(e.target.value))}
                  className="input" style={{ textAlign: "center", fontSize: 22, fontWeight: 800, color: "var(--green)", padding: "10px" }}
                />
              </div>
            ))}
          </div>

          {/* Presets */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {[{ l: "1 صفحة", t: from }, { l: "5 صفحات", t: from + 4 }, { l: "10 صفحات", t: from + 9 }, { l: "20 صفحة", t: from + 19 }].map(p => (
              <button key={p.l} onClick={() => { setTo(Math.min(604, p.t)); setErr(""); }}
                style={{ padding: "6px 14px", borderRadius: "999px", border: "1.5px solid var(--border2)", background: "var(--bg2)", color: "var(--ink2)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
                {p.l}
              </button>
            ))}
          </div>

          <div style={{ padding: "12px 16px", borderRadius: "12px", background: "var(--green-bg)", border: "1px solid var(--green-border)", marginBottom: 14, textAlign: "center" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--green)" }}>
              {Math.max(0, to - from + 1)} {to - from + 1 === 1 ? "صفحة" : "صفحات"}
            </span>
          </div>

          {err && <div style={{ color: "var(--red2)", fontSize: 13, textAlign: "center", marginBottom: 10 }}>{err}</div>}
        </div>
        <div className="sheet-footer" style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary btn-md" style={{ flex: 2, fontSize: 16, fontWeight: 800 }} onClick={() => { if (validate()) onStart(from, to); }}>
            ابدأ المراجعة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Review Page ──────────────────────────────────────────────────────────────
function ReviewPage({ from, to, settings, onFinish }) {
  const [page, setPage] = useState(from);
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionMistakes, setSessionMistakes] = useState([]);
  const [pageMistakes, setPageMistakes] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [activeVerse, setActiveVerse] = useState(null);
  const [popoverPos, setPopoverPos] = useState(null);
  const [showMistakeModal, setShowMistakeModal] = useState(false);
  const [showTafsirModal, setShowTafsirModal] = useState(false);
  const sessionStart = useRef(new Date().toISOString());
  const touchX = useRef(null);

  const fontSizeMap = { sm: "quran-text-sm", md: "quran-text-md", lg: "quran-text-lg" };
  const qFontClass = fontSizeMap[settings.quranFontSize] || "quran-text-md";

  const loadPage = useCallback(async () => {
    setLoading(true);
    const v = await fetchPageVerses(page);
    setVerses(v);
    setLoading(false);
    setPageMistakes(getMistakes().filter(m => m.page === page));
    setActiveVerse(null);
    setPopoverPos(null);
  }, [page]);

  useEffect(() => { loadPage(); }, [loadPage]);

  const handleVerseClick = (verse, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveVerse(verse);
    setPopoverPos({ top: rect.bottom + window.scrollY + 6, left: rect.left, right: rect.right });
  };

  const closePopover = () => { setActiveVerse(null); setPopoverPos(null); };

  const handleFinish = () => {
    saveSession({ date: sessionStart.current, fromPage: from, toPage: to, pageCount: to - from + 1, mistakeCount: sessionMistakes.length });
    updateStreak();
    setShowSummary(true);
  };

  const onMistakeSaved = (m) => {
    setSessionMistakes(p => [...p, m]);
    setShowMistakeModal(false);
    setActiveVerse(null);
    setPageMistakes(getMistakes().filter(x => x.page === page));
  };

  const total = to - from + 1;
  const progress = ((page - from) / total) * 100;
  const mistakeVerseKeys = new Set(pageMistakes.map(m => m.verseKey).filter(Boolean));

  // Group verses by surah
  const groups = [];
  verses.forEach(v => {
    const s = v.verse_key?.split(":")?.[0];
    const last = groups[groups.length - 1];
    if (!last || last.surah !== s) groups.push({ surah: s, verses: [v] });
    else last.verses.push(v);
  });

  if (showSummary) {
    return <SessionSummary mistakes={sessionMistakes} from={from} to={to} onDone={onFinish} />;
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column" }}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => {
        if (!touchX.current) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 60) {
          if (dx < 0 && page < to) setPage(p => p + 1);
          else if (dx > 0 && page > from) setPage(p => p - 1);
        }
        touchX.current = null;
      }}
      onClick={popoverPos ? closePopover : undefined}
    >
      {/* Header */}
      <div className="sticky-header" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn btn-ghost btn-sm" style={{ gap: 4, color: "var(--red2)", borderColor: "var(--red-border)", background: "var(--red-bg)" }} onClick={handleFinish}>
            <Check size={15} /> أنهيت
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 16 }}>صفحة {page}</div>
            <div style={{ fontSize: 11, color: "var(--ink4)" }}>{page - from + 1} / {total}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {sessionMistakes.length > 0 && (
              <span className="badge badge-red">{sessionMistakes.length} خطأ</span>
            )}
          </div>
        </div>
        {/* Progress */}
        <div className="progress" style={{ marginTop: 10 }}>
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Quran Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 110px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skel" style={{ height: 48, opacity: 0.6 }} />)}
          </div>
        ) : (
          <>
            {verses[0]?.verse_number === 1 && (
              <div className="bismillah">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
            )}

            <div style={{ textAlign: "center", marginBottom: 18, fontSize: 12, color: "var(--ink4)" }}>
              اضغط على أي آية لعرض الخيارات · اسحب للتنقل
            </div>

            {groups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: 20 }}>
                {group.verses[0]?.verse_number === 1 && gi > 0 && (
                  <div className="surah-header">
                    <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 16, color: "var(--gold2)", marginBottom: 6 }}>سورة جديدة</div>
                    <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 22, color: "var(--gold3)" }}>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
                  </div>
                )}
                <div className={`quran-text ${qFontClass}`}>
                  {group.verses.map(verse => {
                    const hasMistake = mistakeVerseKeys.has(verse.verse_key);
                    const isActive = activeVerse?.id === verse.id;
                    return (
                      <span key={verse.id}>
                        <span
                          className={`verse-span ${hasMistake ? "has-mistake" : ""} ${isActive ? "selected" : ""}`}
                          onClick={e => { e.stopPropagation(); handleVerseClick(verse, e); }}
                        >
                          {verse.text_uthmani}
                        </span>
                        <span className="verse-num">{toAr(verse.verse_number)}</span>
                        {" "}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Verse Popover */}
      {popoverPos && activeVerse && (
        <div
          className="popover"
          style={{ position: "fixed", top: Math.min(popoverPos.top, window.innerHeight - 200), right: 16, left: 16, maxWidth: 280, margin: "0 auto" }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ padding: "8px 8px 0" }}>
            <div style={{ fontSize: 11, color: "var(--ink4)", padding: "0 6px 8px", borderBottom: "1px solid var(--border)", marginBottom: 6 }}>
              الآية {activeVerse.verse_key}
            </div>
          </div>
          <div style={{ padding: "0 8px 8px" }}>
            <button className="popover-item" onClick={() => { setShowMistakeModal(true); closePopover(); }}>
              <Plus size={16} color="var(--red2)" /> تسجيل خطأ
            </button>
            <button className="popover-item" onClick={() => { setShowTafsirModal(true); closePopover(); }}>
              <BookText size={16} color="var(--green)" /> عرض التفسير
            </button>
            <button className="popover-item" onClick={() => {
              try {
                const [surah, ayah] = activeVerse.verse_key.split(":");
                window.open(`https://quran.com/${surah}/${ayah}`, "_blank");
              } catch {}
              closePopover();
            }}>
              <Volume2 size={16} color="var(--gold)" /> استمع للآية
            </button>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "12px 16px max(16px,env(safe-area-inset-bottom))", backdropFilter: "blur(12px)", zIndex: 30 }}>
        {/* Page pills */}
        <div style={{ display: "flex", justifyContent: "center", gap: 5, marginBottom: 12, overflowX: "auto", padding: "0 4px" }}>
          {Array.from({ length: Math.min(9, total) }).map((_, i) => {
            const offset = Math.max(0, Math.min(page - from - 4, total - 9));
            const p = from + offset + i;
            if (p > to) return null;
            const isCur = p === page;
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{ minWidth: isCur ? 38 : 30, height: 30, borderRadius: "8px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: isCur ? 800 : 500, background: isCur ? "var(--green)" : "var(--bg2)", color: isCur ? "white" : "var(--ink3)", transition: "all 0.2s", fontFamily: "'IBM Plex Sans Arabic', sans-serif", flexShrink: 0 }}>
                {p}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button className="btn btn-ghost btn-md" style={{ flex: 1, gap: 6 }} disabled={page <= from} onClick={() => setPage(p => p - 1)}>
            <ChevronRight size={18} /> السابقة
          </button>
          <button className="btn btn-primary btn-md" style={{ flex: 1, gap: 6 }} onClick={() => { if (page < to) setPage(p => p + 1); else handleFinish(); }}>
            {page < to ? "التالية" : "إنهاء"} <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      {/* Mistake Modal */}
      {showMistakeModal && activeVerse && (
        <MistakeModal
          page={page}
          verseKey={activeVerse.verse_key}
          verseText={activeVerse.text_uthmani}
          onClose={() => setShowMistakeModal(false)}
          onSaved={onMistakeSaved}
        />
      )}

      {/* Tafsir Modal */}
      {showTafsirModal && activeVerse && (
        <TafsirModal
          verseKey={activeVerse.verse_key}
          verseText={activeVerse.text_uthmani}
          tafsirId={settings.defaultTafsir}
          onClose={() => setShowTafsirModal(false)}
        />
      )}
    </div>
  );
}

// ─── Session Summary ──────────────────────────────────────────────────────────
function SessionSummary({ mistakes, from, to, onDone }) {
  const pages = [...new Set(mistakes.map(m => m.page))];
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card anim-fade-up" style={{ padding: "36px 24px", maxWidth: 420, width: "100%", textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: "20px", background: mistakes.length === 0 ? "var(--green-bg)" : "var(--gold-bg)", border: `1.5px solid ${mistakes.length === 0 ? "var(--green-border)" : "var(--gold-border)"}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          {mistakes.length === 0
            ? <CheckCircle size={36} color="var(--green)" />
            : <BarChart2 size={36} color="var(--gold)" />
          }
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          {mistakes.length === 0 ? "مراجعة نظيفة 🌟" : "ملخص الجلسة"}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 24 }}>صفحات {from} – {to}</div>

        {mistakes.length > 0 ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
              <div className="card-2" style={{ padding: "16px 12px", borderRadius: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: "var(--red2)" }}>{mistakes.length}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>أخطاء مسجّلة</div>
              </div>
              <div className="card-2" style={{ padding: "16px 12px", borderRadius: "14px", textAlign: "center" }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: "var(--gold)" }}>{pages.length}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>صفحات</div>
              </div>
            </div>
            {pages.length > 0 && (
              <div style={{ padding: "12px 16px", borderRadius: "12px", background: "var(--bg2)", border: "1px solid var(--border)", marginBottom: 20, textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink4)", marginBottom: 8 }}>الصفحات المتأثرة</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {pages.map(p => <span key={p} className="badge badge-gold">ص {p}</span>)}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: "20px", borderRadius: "14px", background: "var(--green-bg)", border: "1px solid var(--green-border)", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--green)", marginBottom: 4 }}>ما شاء الله!</div>
            <div style={{ fontSize: 13, color: "var(--green2)" }}>لم تسجّل أي أخطاء في هذه المراجعة</div>
          </div>
        )}

        <button className="btn btn-primary btn-lg" style={{ width: "100%" }} onClick={onDone}>
          العودة للرئيسية
        </button>
      </div>
    </div>
  );
}

// ─── Mistake Modal ────────────────────────────────────────────────────────────
function MistakeModal({ page, verseKey, verseText, onClose, onSaved }) {
  const [type, setType] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const save = () => {
    if (!type) { setErr("اختر نوع الخطأ"); return; }
    setSaving(true);
    const m = {
      id: genId(), page, verseKey, verseText: verseText?.slice(0, 80),
      type, note, date: new Date().toISOString(),
      resolved: false, repetitionCount: 0, successCount: 0,
    };
    saveMistake(m);
    setTimeout(() => onSaved(m), 250);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>تسجيل خطأ</div>
            <span className="badge badge-gold">صفحة {page}</span>
          </div>
        </div>
        <div className="sheet-body">
          {verseText && (
            <div style={{ padding: "12px 14px", borderRadius: "12px", background: "var(--bg2)", border: "1px solid var(--border)", marginBottom: 18 }}>
              <div className="quran-text" style={{ fontSize: 16, lineHeight: 2.2 }}>
                {verseText.slice(0, 90)}{verseText.length > 90 ? "..." : ""}
              </div>
              {verseKey && <div style={{ fontSize: 11, color: "var(--ink4)", marginTop: 6 }}>الآية {verseKey}</div>}
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", marginBottom: 10 }}>نوع الخطأ</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ERROR_TYPES.map(t => (
                <button key={t.id} onClick={() => { setType(t.id); setErr(""); }}
                  style={{ padding: "12px 10px", borderRadius: "12px", border: `2px solid ${type === t.id ? "var(--green)" : "var(--border2)"}`, background: type === t.id ? "var(--green-bg)" : "var(--surface2)", cursor: "pointer", textAlign: "right", display: "flex", alignItems: "center", gap: 8, fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontWeight: 600, fontSize: 13, color: type === t.id ? "var(--green)" : "var(--ink2)", transition: "all 0.15s" }}>
                  <span style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", marginBottom: 8 }}>ملاحظة (اختياري)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="اكتب ملاحظة للمراجعة لاحقاً..." className="input" />
          </div>

          {err && <div style={{ color: "var(--red2)", fontSize: 13, textAlign: "center", marginBottom: 10 }}>{err}</div>}
        </div>
        <div className="sheet-footer" style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={onClose}>إلغاء</button>
          <button className="btn btn-danger btn-md" style={{ flex: 1 }} disabled={saving} onClick={save}>
            {saving ? "جارٍ الحفظ..." : "تسجيل الخطأ"}
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

  useEffect(() => {
    fetchTafsir(verseKey, tafsirId).then(t => { setTafsir(t); setLoading(false); });
  }, [verseKey, tafsirId]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" style={{ maxHeight: "88dvh" }} onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>التفسير</div>
              <div style={{ fontSize: 12, color: "var(--ink4)" }}>الآية {verseKey}</div>
            </div>
            <button className="btn btn-icon" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        <div className="sheet-body">
          {verseText && (
            <div style={{ padding: "14px 16px", borderRadius: "14px", background: "var(--gold-bg)", border: "1px solid var(--gold-border)", marginBottom: 20 }}>
              <div className="quran-text" style={{ fontSize: 20, lineHeight: 2.4, textAlign: "center" }}>{verseText}</div>
            </div>
          )}
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[1,2,3].map(i => <div key={i} className="skel" style={{ height: 20, opacity: 0.6 }} />)}
            </div>
          ) : tafsir?.text ? (
            <div className="tafsir-text" dangerouslySetInnerHTML={{ __html: tafsir.text.replace(/<[^>]*>/g, "") }} />
          ) : (
            <div style={{ textAlign: "center", color: "var(--ink4)", padding: "24px 0" }}>
              <Info size={24} style={{ marginBottom: 8 }} />
              <div>لم يتم العثور على تفسير</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mistakes Screen ──────────────────────────────────────────────────────────
const DIFF_CFG = {
  easy:   { label: "بسيط",  color: "#22c55e", bg: "rgba(34,197,94,0.1)"   },
  medium: { label: "متوسط", color: "#f59e0b", bg: "rgba(245,158,11,0.1)"  },
  hard:   { label: "صعب",   color: "var(--red2)", bg: "var(--red-bg)"      },
};
const TYPE_LBL = {
  forgot_start: "نسيان بداية الآية",
  wrong_text:   "خطأ في النص",
  forgot_end:   "نسيان نهاية الآية",
  confused:     "خلط بين آيتين",
};

function MistakesScreen({ onFix }) {
  const [mistakes, setMistakes] = useState([]);
  const [tab, setTab] = useState("pending");
  const [filterPage, setFilterPage] = useState("");

  const load = () => setMistakes(getMistakes());
  useEffect(() => { load(); }, []);

  const pending = mistakes.filter(m => !m.resolved);
  const filtered = mistakes.filter(m => {
    if (tab === "pending" && m.resolved) return false;
    if (tab === "resolved" && !m.resolved) return false;
    if (filterPage && m.page !== Number(filterPage)) return false;
    return true;
  });

  const pages = [...new Set(mistakes.map(m => m.page))].sort((a, b) => a - b);

  const grouped = {};
  filtered.forEach(m => {
    const d = m.date?.split("T")[0] || "unknown";
    if (!grouped[d]) grouped[d] = [];
    grouped[d].push(m);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  const handleDelete = id => {
    if (!confirm("هل تريد حذف هذا الخطأ؟")) return;
    deleteMistake(id); load();
  };

  return (
    <div>
      {/* Header */}
      <div className="sticky-header" style={{ padding: "16px 16px 12px" }}>
        <div className="container" style={{ padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>سجل الأخطاء</div>
              <div style={{ fontSize: 12, color: "var(--ink4)" }}>{mistakes.length} خطأ مسجّل</div>
            </div>
            {pending.length > 0 && <span className="badge badge-red">{pending.length} معلّق</span>}
          </div>

          {/* Tabs */}
          <div className="tab-bar" style={{ marginBottom: 10 }}>
            {[{ id: "pending", l: "معلّق" }, { id: "resolved", l: "منجز" }, { id: "all", l: "الكل" }].map(t => (
              <button key={t.id} className={`tab-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.l}</button>
            ))}
          </div>

          {/* Filter by page */}
          <select value={filterPage} onChange={e => setFilterPage(e.target.value)} className="input select-custom" style={{ padding: "8px 12px", fontSize: 13, height: 38 }}>
            <option value="">كل الصفحات</option>
            {pages.map(p => <option key={p} value={p}>صفحة {p}</option>)}
          </select>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 16, paddingBottom: 24 }}>
        {/* Start hard mistakes */}
        {tab === "pending" && pending.filter(m => m.difficulty === "hard").length > 0 && (
          <button className="btn btn-danger btn-md full-w" style={{ marginBottom: 14 }} onClick={() => {
            const h = pending.filter(m => m.difficulty === "hard");
            if (h.length) onFix(h[0]);
          }}>
            <Target size={16} /> ابدأ بمراجعة الأصعب
          </button>
        )}

        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <CheckCircle size={48} color="var(--green)" style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink2)" }}>
              {tab === "pending" ? "لا أخطاء معلّقة 🎉" : "لا توجد نتائج"}
            </div>
          </div>
        ) : (
          sortedDates.map(date => (
            <div key={date} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)" }}>{formatDate(date)}</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 11, color: "var(--ink4)" }}>{grouped[date].length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {grouped[date].map(m => (
                  <MistakeCard key={m.id} mistake={m} onDelete={() => handleDelete(m.id)} onFix={() => onFix(m)} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MistakeCard({ mistake, onDelete, onFix }) {
  return (
    <div className="mistake-card" style={{ opacity: mistake.resolved ? 0.55 : 1 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 3, borderRadius: "999px", background: mistake.resolved ? "var(--green)" : "var(--red2)", alignSelf: "stretch", flexShrink: 0, minHeight: 40 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <span className="badge badge-gold">ص {mistake.page}</span>
            {mistake.resolved && <span className="badge badge-green">✓ منجز</span>}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>
            {TYPE_LBL[mistake.type] || mistake.type}
          </div>
          {mistake.verseText && (
            <div className="quran-text" style={{ fontSize: 14, lineHeight: 1.9, color: "var(--ink3)", marginBottom: mistake.note ? 4 : 0 }}>
              {mistake.verseText.slice(0, 60)}{mistake.verseText.length > 60 ? "..." : ""}
            </div>
          )}
          {mistake.note && <div style={{ fontSize: 12, color: "var(--ink4)", fontStyle: "italic" }}>{mistake.note}</div>}
          {mistake.successCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <div className="progress" style={{ flex: 1 }}>
                <div className="progress-bar" style={{ width: `${(mistake.successCount / 3) * 100}%` }} />
              </div>
              <span style={{ fontSize: 11, color: "var(--ink4)" }}>{mistake.successCount}/3</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {!mistake.resolved && (
            <button className="btn btn-green-ghost btn-sm" onClick={onFix}>راجع</button>
          )}
          <button className="btn btn-sm" style={{ background: "none", border: "none", color: "var(--red2)", fontSize: 12, cursor: "pointer", fontFamily: "'IBM Plex Sans Arabic', sans-serif", padding: "4px 8px" }} onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fix Mode ─────────────────────────────────────────────────────────────────
const HINTS_MAP = {
  forgot_start: ["ابدأ من الآية السابقة", "ركّز على بداية هذه الآية"],
  wrong_text:   ["اقرأ الآية ببطء كاملة", "انتبه لكل كلمة"],
  forgot_end:   ["ابدأ من منتصف الآية",  "ركّز على نهاية الآية"],
  confused:     ["ابدأ من أول الربع",    "فرّق بين الآيتين"],
};

function FixMode({ mistake: init, settings, onBack, onDone }) {
  const [mistake, setMistake] = useState(init);
  const [showAyah, setShowAyah] = useState(false);
  const [result, setResult] = useState(null);
  const [verse, setVerse] = useState(null);
  const [loadingV, setLoadingV] = useState(true);
  const requiredChecks = settings.requiredChecks || 3;

  const refresh = () => {
    const updated = getMistakes().find(m => m.id === mistake.id);
    if (updated) setMistake(updated);
    return updated;
  };

  useEffect(() => {
    if (mistake.verseKey) {
      const [s, a] = mistake.verseKey.split(":");
      fetch(`${QAPI}/verses/by_key/${s}:${a}?fields=text_uthmani`)
        .then(r => r.json()).then(d => { setVerse(d.verse); setLoadingV(false); })
        .catch(() => setLoadingV(false));
    } else { setLoadingV(false); }
  }, []);

  const handleSuccess = () => {
    const newCount = (mistake.successCount || 0) + 1;
    updateMistake(mistake.id, { successCount: newCount, resolved: newCount >= requiredChecks });
    const updated = refresh();
    setResult("success");
    setShowAyah(false);
  };

  const handleFail = () => {
    updateMistake(mistake.id, { repetitionCount: (mistake.repetitionCount || 0) + 1 });
    refresh();
    setResult("fail");
    setShowAyah(false);
  };

  const hints = HINTS_MAP[mistake.type] || HINTS_MAP.forgot_start;
  const successCount = mistake.successCount || 0;
  const needed = requiredChecks - successCount;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="sticky-header" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button className="btn btn-ghost btn-sm" style={{ gap: 4 }} onClick={onBack}>
            <ChevronRight size={16} /> رجوع
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 15 }}>وضع التصحيح</div>
            <div style={{ fontSize: 11, color: "var(--ink4)" }}>صفحة {mistake.page}</div>
          </div>
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 6 }}>
            {Array.from({ length: requiredChecks }).map((_, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${i < successCount ? "var(--green)" : "var(--border2)"}`, background: i < successCount ? "var(--green)" : "transparent", transition: "all 0.3s" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Result overlay */}
      {result && (
        <div className="overlay anim-fade-in" style={{ zIndex: 200 }}>
          <div className="card anim-fade-up" style={{ padding: "36px 28px", maxWidth: 360, width: "calc(100% - 32px)", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: "20px", background: mistake.resolved ? "var(--green-bg)" : result === "success" ? "var(--green-bg)" : "var(--red-bg)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              {mistake.resolved ? <Star size={34} color="var(--green)" /> : result === "success" ? <CheckCircle size={34} color="var(--green)" /> : <XCircle size={34} color="var(--red2)" />}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
              {mistake.resolved ? "أحسنت! اكتملت المراجعة" : result === "success" ? "ممتاز! استمر" : "حاول مجدداً"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 20 }}>
              {mistake.resolved ? `تم حل هذا الخطأ بعد ${requiredChecks} مراجعات`
                : result === "success" ? `${successCount}/${requiredChecks} نجاحات`
                : `${mistake.repetitionCount || 0} تكرار`}
            </div>
            {result === "success" && !mistake.resolved && (
              <div className="progress" style={{ marginBottom: 20 }}>
                <div className="progress-bar" style={{ width: `${(successCount / requiredChecks) * 100}%` }} />
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              {mistake.resolved ? (
                <button className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={onDone}>العودة</button>
              ) : (
                <>
                  <button className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={onDone}>خروج</button>
                  <button className="btn btn-primary btn-md" style={{ flex: 1 }} onClick={() => setResult(null)}>
                    {result === "success" ? "استمر" : "حاول مجدداً"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 16px" }}>
        {/* Error type */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: "14px", background: "var(--red-bg)", border: "1px solid var(--red-border)", marginBottom: 16 }}>
          <XCircle size={16} color="var(--red2)" />
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--red2)" }}>{TYPE_LBL[mistake.type] || mistake.type}</span>
          {mistake.note && <span style={{ fontSize: 12, color: "var(--ink4)", marginRight: "auto" }}>{mistake.note}</span>}
        </div>

        {/* Hints */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {hints.map((h, i) => (
            <span key={i} style={{ fontSize: 12, padding: "6px 12px", borderRadius: "10px", background: "var(--gold-bg)", border: "1px solid var(--gold-border)", color: "var(--gold)", display: "flex", alignItems: "center", gap: 6 }}>
              <Star size={12} color="var(--gold)" /> {h}
            </span>
          ))}
        </div>

        {/* Verse display */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 180 }}>
          {loadingV ? (
            <div className="skel" style={{ width: "100%", height: 120 }} />
          ) : (
            <div style={{ width: "100%", borderRadius: "20px", border: "1px solid var(--border)", overflow: "hidden", background: "var(--surface)" }}>
              <div style={{ padding: "28px 20px", minHeight: 140, display: "flex", alignItems: "center", justifyContent: "center", filter: showAyah ? "none" : "blur(10px)", transition: "filter 0.4s", userSelect: showAyah ? "text" : "none" }}>
                {verse?.text_uthmani || mistake.verseText ? (
                  <div className="quran-text quran-text-md" style={{ textAlign: "center" }}>
                    {verse?.text_uthmani || mistake.verseText}
                  </div>
                ) : (
                  <div style={{ fontSize: 15, color: "var(--ink4)" }}>صفحة {mistake.page} · {mistake.verseKey || "موضع غير محدد"}</div>
                )}
              </div>
              {!showAyah && (
                <div style={{ position: "absolute" }} />
              )}
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink4)" }}>
                <span>صفحة {mistake.page}</span>
                {mistake.verseKey && <span>الآية {mistake.verseKey}</span>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom */}
      <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "16px 16px max(20px,env(safe-area-inset-bottom))" }}>
        <button
          className="btn btn-md full-w"
          style={{ marginBottom: 10, gap: 8, background: showAyah ? "var(--green-bg)" : "var(--bg2)", color: showAyah ? "var(--green)" : "var(--ink2)", border: `1px solid ${showAyah ? "var(--green-border)" : "var(--border)"}` }}
          onClick={() => setShowAyah(!showAyah)}
        >
          {showAyah ? <EyeOff size={16} /> : <Eye size={16} />}
          {showAyah ? "إخفاء الآية" : "إظهار الآية"}
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn btn-red-ghost btn-md" onClick={handleFail}>ما زلت أخطئ</button>
          <button className="btn btn-primary btn-md" onClick={handleSuccess}>
            <CheckCircle size={16} /> حفظت هذه المرة
          </button>
        </div>
        {!mistake.resolved && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "var(--ink4)" }}>
            يحتاج {needed} {needed === 1 ? "نجاح" : "نجاحات"} إضافية
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

  const load = () => setSchedule(getSchedule());
  useEffect(() => { load(); }, []);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const schedMap = {};
  schedule.forEach(s => { schedMap[s.date] = s; });

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthNames = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
  const dayNames = ["ح","ن","ث","ر","خ","ج","س"];

  const getDayStr = (d) => `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;

  const selectedPlan = selected ? schedMap[selected] : null;

  return (
    <div>
      {/* Header */}
      <div className="sticky-header" style={{ padding: "16px 16px 12px" }}>
        <div className="container" style={{ padding: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>جدول المراجعة</div>
              <div style={{ fontSize: 12, color: "var(--ink4)" }}>خطط مراجعتك اليومية</div>
            </div>
            <button className="btn btn-primary btn-sm" style={{ gap: 6 }} onClick={() => { setAddDate(today.toISOString().split("T")[0]); setShowAddModal(true); }}>
              <Plus size={15} /> إضافة
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 16, paddingBottom: 24 }}>
        {/* Month nav */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <button className="btn btn-icon" onClick={nextMonth}><ChevronRight size={18} /></button>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{monthNames[month]} {year}</div>
          <button className="btn btn-icon" onClick={prevMonth}><ChevronLeft size={18} /></button>
        </div>

        {/* Day names */}
        <div className="cal-grid" style={{ marginBottom: 6 }}>
          {dayNames.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--ink4)", padding: "4px 0" }}>{d}</div>
          ))}
        </div>

        {/* Calendar */}
        <div className="card" style={{ padding: "12px" }}>
          <div className="cal-grid">
            {Array.from({ length: (firstDay + 6) % 7 }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const dStr = getDayStr(d);
              const hasPlan = !!schedMap[dStr];
              const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
              const isPast = new Date(year, month, d) < today && !isToday;
              const isSelected = selected === dStr;
              return (
                <div key={d} className={`cal-day ${isToday ? "today" : ""} ${hasPlan && !isToday ? "has-plan" : ""} ${isPast && !hasPlan ? "past" : ""}`}
                  style={{ fontWeight: isToday ? 800 : hasPlan ? 700 : 400, outline: isSelected ? "2px solid var(--green)" : "none" }}
                  onClick={() => setSelected(isSelected ? null : dStr)}
                >
                  {d}
                  {hasPlan && !isToday && <span className="cal-dot" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's plan or selected */}
        {(selected || true) && (() => {
          const todayStr = today.toISOString().split("T")[0];
          const displayDate = selected || todayStr;
          const plan = schedMap[displayDate];
          const isToday2 = displayDate === todayStr;
          return (
            <div style={{ marginTop: 18 }}>
              <div className="divider" style={{ marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{isToday2 && !selected ? "مراجعة اليوم" : selected ? formatDate(selected) : ""}</span>
              </div>
              {plan ? (
                <div className="card" style={{ padding: "18px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800 }}>صفحات {plan.from} – {plan.to}</div>
                      {plan.note && <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 3 }}>{plan.note}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => onStartReview(plan.from, plan.to)}>
                        ابدأ
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => { deleteScheduleItem(plan.id); load(); setSelected(null); }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink4)" }}>
                    {plan.to - plan.from + 1} صفحات · {plan.completed ? "✓ منجز" : "معلّق"}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <Calendar size={32} color="var(--ink4)" style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 14, color: "var(--ink4)", marginBottom: 12 }}>لا خطة لهذا اليوم</div>
                  <button className="btn btn-green-ghost btn-sm" style={{ gap: 6 }} onClick={() => { setAddDate(displayDate); setShowAddModal(true); }}>
                    <Plus size={14} /> أضف خطة
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Upcoming */}
        {schedule.filter(s => s.date >= today.toISOString().split("T")[0]).length > 1 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink3)", marginBottom: 12 }}>المراجعات القادمة</div>
            {schedule
              .filter(s => s.date >= today.toISOString().split("T")[0])
              .sort((a, b) => a.date.localeCompare(b.date))
              .slice(0, 5)
              .map(s => (
                <div key={s.id} className="card" style={{ padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>صفحات {s.from} – {s.to}</div>
                    <div style={{ fontSize: 12, color: "var(--ink4)" }}>{formatDate(s.date)}</div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => onStartReview(s.from, s.to)}>ابدأ</button>
                </div>
              ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddPlanModal
          defaultDate={addDate}
          onSave={(plan) => { saveScheduleItem({ ...plan, id: genId() }); load(); setShowAddModal(false); }}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

function AddPlanModal({ defaultDate, onSave, onClose }) {
  const [date, setDate] = useState(defaultDate || new Date().toISOString().split("T")[0]);
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [note, setNote] = useState("");

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div style={{ fontWeight: 800, fontSize: 18 }}>إضافة خطة مراجعة</div>
        </div>
        <div className="sheet-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 6 }}>التاريخ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[{ l: "من صفحة", v: from, s: setFrom }, { l: "إلى صفحة", v: to, s: setTo }].map(f => (
                <div key={f.l}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 6 }}>{f.l}</label>
                  <input type="number" min={1} max={604} value={f.v} onChange={e => f.s(Number(e.target.value))} className="input" style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "var(--green)" }} />
                </div>
              ))}
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", display: "block", marginBottom: 6 }}>ملاحظة (اختياري)</label>
              <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="مثال: ربع الحزب الثاني" className="input" />
            </div>
          </div>
        </div>
        <div className="sheet-footer" style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost btn-md" style={{ flex: 1 }} onClick={onClose}>إلغاء</button>
          <button className="btn btn-primary btn-md" style={{ flex: 2 }} onClick={() => onSave({ date, from, to, note, completed: false })}>
            حفظ الخطة
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quarters Screen ──────────────────────────────────────────────────────────
function QuartersScreen() {
  const [surahs, setSurahs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [verses, setVerses] = useState([]);
  const [loadingV, setLoadingV] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchSurahList().then(s => { setSurahs(s); setLoading(false); });
  }, []);

  const handleSelect = async (surah) => {
    if (selected?.id === surah.id) { setSelected(null); setVerses([]); return; }
    setSelected(surah);
    setLoadingV(true);
    const v = await fetchSurahVerses(surah.id);
    setVerses(v);
    setLoadingV(false);
  };

  // Calculate quarter starts: split verse count into 4 equal parts
  const getQuarterVerses = (vv) => {
    if (!vv.length) return [];
    const len = vv.length;
    const q = Math.floor(len / 4);
    const starts = [0, q, q * 2, q * 3];
    return starts.map((s, i) => ({ quarter: i + 1, verse: vv[s] })).filter(x => x.verse);
  };

  const filtered = surahs.filter(s =>
    s.name_arabic?.includes(search) ||
    s.name_simple?.toLowerCase().includes(search.toLowerCase()) ||
    String(s.id).includes(search)
  );

  return (
    <div>
      <div className="sticky-header" style={{ padding: "16px 16px 12px" }}>
        <div className="container" style={{ padding: 0 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>بدايات الأرباع</div>
            <div style={{ fontSize: 12, color: "var(--ink4)" }}>ابحث عن بداية كل ربع في أي سورة</div>
          </div>
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث عن سورة..."
            className="input"
          />
        </div>
      </div>

      <div className="container" style={{ paddingTop: 16, paddingBottom: 24 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="skel" style={{ height: 52 }} />)}
          </div>
        ) : (
          filtered.map(surah => (
            <div key={surah.id} style={{ marginBottom: 6 }}>
              <button
                className="card card-hover full-w"
                style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: selected?.id === surah.id ? "var(--green-bg)" : "var(--surface)", borderColor: selected?.id === surah.id ? "var(--green-border)" : "var(--border)", cursor: "pointer", fontFamily: "'IBM Plex Sans Arabic', sans-serif", border: `1px solid ${selected?.id === surah.id ? "var(--green-border)" : "var(--border)"}` }}
                onClick={() => handleSelect(surah)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "10px", background: "var(--gold-bg)", border: "1px solid var(--gold-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--gold)", flexShrink: 0 }}>
                    {surah.id}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Scheherazade New', serif" }}>{surah.name_arabic}</div>
                    <div style={{ fontSize: 11, color: "var(--ink4)" }}>{surah.verses_count} آية · {surah.revelation_place === "makkah" ? "مكية" : "مدنية"}</div>
                  </div>
                </div>
                <ChevronDown size={16} color="var(--ink4)" style={{ transform: selected?.id === surah.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
              </button>

              {selected?.id === surah.id && (
                <div className="card" style={{ borderRadius: "0 0 var(--r-lg) var(--r-lg)", borderTop: "none", padding: "16px" }}>
                  {loadingV ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[1,2,3,4].map(i => <div key={i} className="skel" style={{ height: 40 }} />)}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink4)", marginBottom: 12 }}>بدايات الأرباع الأربعة</div>
                      {getQuarterVerses(verses).map(({ quarter, verse }) => (
                        <div key={quarter} className="quarter-card">
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--green)", marginBottom: 6 }}>الربع {quarter}</div>
                              <div className="quran-text" style={{ fontSize: 16, lineHeight: 2.1, color: "var(--ink)" }}>
                                {verse.text_uthmani?.slice(0, 60)}{verse.text_uthmani?.length > 60 ? "..." : ""}
                              </div>
                            </div>
                            <span className="badge badge-gold">آية {verse.verse_number}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────
function SettingsScreen({ settings, onChange }) {
  const tafsirOptions = [
    { id: "ar.muyassar", label: "الميسر" },
    { id: "ar.jalalayn", label: "الجلالين" },
    { id: "ar.waseet",   label: "الوسيط" },
  ];

  return (
    <div>
      <div className="sticky-header" style={{ padding: "16px 16px 12px" }}>
        <div className="container" style={{ padding: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>الإعدادات</div>
          <div style={{ fontSize: 12, color: "var(--ink4)" }}>تخصيص تجربة المراجعة</div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 20, paddingBottom: 40 }}>

        {/* Appearance */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">المظهر</div>
          <div className="card" style={{ padding: "0 16px" }}>
            <div className="settings-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>الوضع الداكن</div>
                <div style={{ fontSize: 12, color: "var(--ink4)" }}>تغيير مظهر التطبيق</div>
              </div>
              <label className="switch">
                <input type="checkbox" checked={settings.darkMode} onChange={e => onChange({ darkMode: e.target.checked })} />
                <div className="switch-track" />
                <div className="switch-thumb" />
              </label>
            </div>

            <div className="settings-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>حجم خط القرآن</div>
                <div style={{ fontSize: 12, color: "var(--ink4)" }}>تكبير أو تصغير النص</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ id: "sm", l: "ص" }, { id: "md", l: "م" }, { id: "lg", l: "ك" }].map(s => (
                  <button key={s.id}
                    onClick={() => onChange({ quranFontSize: s.id })}
                    style={{ width: 34, height: 34, borderRadius: "10px", border: `1.5px solid ${settings.quranFontSize === s.id ? "var(--green)" : "var(--border2)"}`, background: settings.quranFontSize === s.id ? "var(--green-bg)" : "transparent", color: settings.quranFontSize === s.id ? "var(--green)" : "var(--ink3)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'IBM Plex Sans Arabic', sans-serif" }}>
                    {s.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Review Settings */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">إعدادات المراجعة</div>
          <div className="card" style={{ padding: "0 16px" }}>
            <div className="settings-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>عدد مرات التحقق</div>
                <div style={{ fontSize: 12, color: "var(--ink4)" }}>كم مرة يجب نجاح المراجعة لحل الخطأ</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  style={{ width: 30, height: 30, borderRadius: "8px", background: "var(--bg2)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 800, fontSize: 18, fontFamily: "'IBM Plex Sans Arabic', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => onChange({ requiredChecks: Math.max(1, (settings.requiredChecks || 3) - 1) })}
                >−</button>
                <span style={{ fontWeight: 800, fontSize: 20, color: "var(--green)", minWidth: 24, textAlign: "center" }}>{settings.requiredChecks || 3}</span>
                <button
                  style={{ width: 30, height: 30, borderRadius: "8px", background: "var(--bg2)", border: "1px solid var(--border)", cursor: "pointer", fontWeight: 800, fontSize: 18, fontFamily: "'IBM Plex Sans Arabic', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}
                  onClick={() => onChange({ requiredChecks: Math.min(10, (settings.requiredChecks || 3) + 1) })}
                >+</button>
              </div>
            </div>
          </div>
        </div>

        {/* Tafsir */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">التفسير</div>
          <div className="card" style={{ padding: "0 16px" }}>
            <div className="settings-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>التفسير الافتراضي</div>
                <div style={{ fontSize: 12, color: "var(--ink4)" }}>التفسير المستخدم عند الضغط على آية</div>
              </div>
              <select value={settings.defaultTafsir} onChange={e => onChange({ defaultTafsir: e.target.value })}
                className="input select-custom" style={{ width: "auto", padding: "7px 12px", fontSize: 13 }}>
                {tafsirOptions.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Data */}
        <div style={{ marginBottom: 24 }}>
          <div className="section-label">البيانات</div>
          <div className="card" style={{ padding: "0 16px" }}>
            <div className="settings-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>إعادة تعيين الأخطاء</div>
                <div style={{ fontSize: 12, color: "var(--ink4)" }}>حذف جميع الأخطاء المسجّلة</div>
              </div>
              <button className="btn btn-red-ghost btn-sm" onClick={() => {
                if (confirm("هل تريد حذف جميع الأخطاء؟ لا يمكن التراجع.")) {
                  localStorage.removeItem("q_mistakes");
                  window.location.reload();
                }
              }}>حذف الكل</button>
            </div>
            <div className="settings-row">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>إعادة تعيين الجدول</div>
                <div style={{ fontSize: 12, color: "var(--ink4)" }}>حذف جميع خطط المراجعة</div>
              </div>
              <button className="btn btn-red-ghost btn-sm" onClick={() => {
                if (confirm("هل تريد حذف جميع الخطط؟")) {
                  localStorage.removeItem("q_schedule");
                  window.location.reload();
                }
              }}>حذف الكل</button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="card-2" style={{ padding: "16px", textAlign: "center", border: "1px solid var(--border)", borderRadius: "var(--r-lg)" }}>
          <div style={{ fontFamily: "'Scheherazade New', serif", fontSize: 22, color: "var(--gold2)", marginBottom: 8 }}>مراجع القرآن</div>
          <div style={{ fontSize: 12, color: "var(--ink4)" }}>تطبيق لتتبع وتحسين حفظ القرآن الكريم</div>
        </div>
      </div>
    </div>
  );
}