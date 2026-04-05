'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { BookOpen, BarChart2, Calendar, Settings, ChevronRight, ChevronLeft, Plus, Trash2, RefreshCw, CheckCircle, XCircle, Eye, EyeOff, Moon, Sun, BookMarked, List, Flame, Star, Volume2, Info, X, Check, ChevronDown, Menu, Grid3X3, BookText, Play, Pause, Loader2, Search, Save, Clock, Bookmark, Hash, LayoutDashboard, AlertCircle, Zap, Lightbulb, Edit2, CheckSquare } from 'lucide-react';

// ─── localStorage Store ───────────────────────────────────────────────────────
const STORE = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch {
      return [];
    }
  },
  getOne(key, d = {}) {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(d));
    } catch {
      return d;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch {}
  },
  push(key, item) {
    const a = this.get(key);
    a.push(item);
    this.set(key, a);
    return item;
  },
  update(key, id, up) {
    const a = this.get(key);
    const i = a.findIndex(x => x.id === id);
    if (i !== -1) {
      a[i] = { ...a[i], ...up };
      this.set(key, a);
      return a[i];
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
function updateScheduleItem(id, u) {
  return STORE.update('q_schedule', id, u);
}
function getSettings() {
  return STORE.getOne('q_settings', {
    requiredChecks: 3,
    darkMode: false,
    defaultTafsir: '91',
    quranFontSize: 'md',
    reciter: 'ar.alafasy',
    tajweedColors: true,
    palette: 'teal',
  });
}
function saveSettings(s) {
  STORE.set('q_settings', s);
}
function getBookmarks() {
  return STORE.get('q_bookmarks');
}
function toggleBookmark(verseKey) {
  const bms = getBookmarks();
  const idx = bms.findIndex(b => b.verseKey === verseKey);
  if (idx !== -1) {
    STORE.remove('q_bookmarks', bms[idx].id);
    return false;
  }
  STORE.push('q_bookmarks', { id: genId(), verseKey, date: new Date().toISOString() });
  return true;
}
function getLastPosition() {
  return STORE.getOne('q_last_pos', { page: 1, verseKey: null });
}
function saveLastPosition(page, verseKey) {
  STORE.set('q_last_pos', { page, verseKey, date: new Date().toISOString() });
}
function getStreak() {
  return STORE.getOne('q_streak', { current: 0, best: 0, lastDate: null });
}
function updateStreak() {
  const s = getStreak(),
    today = new Date().toDateString(),
    yesterday = new Date(Date.now() - 86400000).toDateString();
  if (s.lastDate === today) return s;
  const cur = s.lastDate === yesterday ? s.current + 1 : 1;
  const u = { current: cur, best: Math.max(cur, s.best || 0), lastDate: today };
  STORE.set('q_streak', u);
  return u;
}

// ─── Color Palettes ───────────────────────────────────────────────────────────
const PALETTES = {
  teal: {
    name: 'فيروزي',
    light: {
      bg: '#F0FAF6',
      bg2: '#E1F5EE',
      bg3: '#C8EDDF',
      surface: '#FAFFFE',
      surface2: '#F0FAF6',
      border: 'rgba(15,110,86,0.08)',
      border2: 'rgba(15,110,86,0.15)',
      border3: 'rgba(15,110,86,0.25)',
      green: '#0F6E56',
      green2: '#1D9E75',
      green3: '#5DCAA5',
      greenGlow: 'rgba(15,110,86,0.2)',
      greenBg: 'rgba(15,110,86,0.07)',
      greenBorder: 'rgba(15,110,86,0.18)',
    },
    dark: {
      bg: '#04140E',
      bg2: '#071C14',
      bg3: '#0A2419',
      surface: '#061510',
      surface2: '#091A13',
      border: 'rgba(93,202,165,0.08)',
      border2: 'rgba(93,202,165,0.15)',
      border3: 'rgba(93,202,165,0.25)',
      green: '#5DCAA5',
      green2: '#9FE1CB',
      green3: '#C8EDDF',
      greenGlow: 'rgba(93,202,165,0.22)',
      greenBg: 'rgba(93,202,165,0.09)',
      greenBorder: 'rgba(93,202,165,0.2)',
    },
  },
  emerald: {
    name: 'زمردي',
    light: {
      bg: '#F0FAF2',
      bg2: '#DCF5E2',
      bg3: '#C0ECCC',
      surface: '#F8FFF9',
      surface2: '#EEF9F1',
      border: 'rgba(11,68,27,0.08)',
      border2: 'rgba(11,68,27,0.15)',
      border3: 'rgba(11,68,27,0.25)',
      green: '#0D5236',
      green2: '#1A7A50',
      green3: '#3BAF74',
      greenGlow: 'rgba(13,82,54,0.2)',
      greenBg: 'rgba(13,82,54,0.07)',
      greenBorder: 'rgba(13,82,54,0.18)',
    },
    dark: {
      bg: '#030E07',
      bg2: '#061209',
      bg3: '#091A0D',
      surface: '#050F08',
      surface2: '#07140A',
      border: 'rgba(59,175,116,0.08)',
      border2: 'rgba(59,175,116,0.15)',
      border3: 'rgba(59,175,116,0.25)',
      green: '#3BAF74',
      green2: '#60CF96',
      green3: '#97E8BE',
      greenGlow: 'rgba(59,175,116,0.22)',
      greenBg: 'rgba(59,175,116,0.09)',
      greenBorder: 'rgba(59,175,116,0.2)',
    },
  },
  sapphire: {
    name: 'ياقوتي',
    light: {
      bg: '#EEF4FD',
      bg2: '#DCEBFA',
      bg3: '#C3D9F7',
      surface: '#F8FBFF',
      surface2: '#EEF4FD',
      border: 'rgba(24,95,165,0.08)',
      border2: 'rgba(24,95,165,0.15)',
      border3: 'rgba(24,95,165,0.25)',
      green: '#185FA5',
      green2: '#378ADD',
      green3: '#85B7EB',
      greenGlow: 'rgba(24,95,165,0.2)',
      greenBg: 'rgba(24,95,165,0.07)',
      greenBorder: 'rgba(24,95,165,0.18)',
    },
    dark: {
      bg: '#020A14',
      bg2: '#040D1A',
      bg3: '#071220',
      surface: '#030C17',
      surface2: '#05101C',
      border: 'rgba(133,183,235,0.08)',
      border2: 'rgba(133,183,235,0.15)',
      border3: 'rgba(133,183,235,0.25)',
      green: '#85B7EB',
      green2: '#B5D4F4',
      green3: '#D6E9FA',
      greenGlow: 'rgba(133,183,235,0.22)',
      greenBg: 'rgba(133,183,235,0.09)',
      greenBorder: 'rgba(133,183,235,0.2)',
    },
  },
  amber: {
    name: 'عنبري',
    light: {
      bg: '#FDF5E8',
      bg2: '#FAE9CC',
      bg3: '#F5D8A0',
      surface: '#FFFDF7',
      surface2: '#FDF5E8',
      border: 'rgba(133,79,11,0.08)',
      border2: 'rgba(133,79,11,0.15)',
      border3: 'rgba(133,79,11,0.25)',
      green: '#854F0B',
      green2: '#BA7517',
      green3: '#EF9F27',
      greenGlow: 'rgba(133,79,11,0.2)',
      greenBg: 'rgba(133,79,11,0.07)',
      greenBorder: 'rgba(133,79,11,0.18)',
    },
    dark: {
      bg: '#130C02',
      bg2: '#1C1203',
      bg3: '#261805',
      surface: '#100A01',
      surface2: '#171003',
      border: 'rgba(239,159,39,0.08)',
      border2: 'rgba(239,159,39,0.15)',
      border3: 'rgba(239,159,39,0.25)',
      green: '#EF9F27',
      green2: '#FAC775',
      green3: '#FAEEDA',
      greenGlow: 'rgba(239,159,39,0.22)',
      greenBg: 'rgba(239,159,39,0.09)',
      greenBorder: 'rgba(239,159,39,0.2)',
    },
  },
  rose: {
    name: 'وردي',
    light: {
      bg: '#FDF0F4',
      bg2: '#FAD9E6',
      bg3: '#F5BAD0',
      surface: '#FFFAFC',
      surface2: '#FDF0F4',
      border: 'rgba(153,53,86,0.08)',
      border2: 'rgba(153,53,86,0.15)',
      border3: 'rgba(153,53,86,0.25)',
      green: '#993556',
      green2: '#D4537E',
      green3: '#ED93B1',
      greenGlow: 'rgba(153,53,86,0.2)',
      greenBg: 'rgba(153,53,86,0.07)',
      greenBorder: 'rgba(153,53,86,0.18)',
    },
    dark: {
      bg: '#140508',
      bg2: '#1C070D',
      bg3: '#260A12',
      surface: '#100304',
      surface2: '#180609',
      border: 'rgba(237,147,177,0.08)',
      border2: 'rgba(237,147,177,0.15)',
      border3: 'rgba(237,147,177,0.25)',
      green: '#ED93B1',
      green2: '#F4C0D1',
      green3: '#FAE9F1',
      greenGlow: 'rgba(237,147,177,0.22)',
      greenBg: 'rgba(237,147,177,0.09)',
      greenBorder: 'rgba(237,147,177,0.2)',
    },
  },
  purple: {
    name: 'بنفسجي',
    light: {
      bg: '#F1EFFD',
      bg2: '#E1DEFA',
      bg3: '#CABDF6',
      surface: '#FAFAFE',
      surface2: '#F1EFFD',
      border: 'rgba(83,74,183,0.08)',
      border2: 'rgba(83,74,183,0.15)',
      border3: 'rgba(83,74,183,0.25)',
      green: '#534AB7',
      green2: '#7F77DD',
      green3: '#AFA9EC',
      greenGlow: 'rgba(83,74,183,0.2)',
      greenBg: 'rgba(83,74,183,0.07)',
      greenBorder: 'rgba(83,74,183,0.18)',
    },
    dark: {
      bg: '#060513',
      bg2: '#0A0820',
      bg3: '#0D0B2A',
      surface: '#04030F',
      surface2: '#080618',
      border: 'rgba(175,169,236,0.08)',
      border2: 'rgba(175,169,236,0.15)',
      border3: 'rgba(175,169,236,0.25)',
      green: '#AFA9EC',
      green2: '#CECBF6',
      green3: '#EEEDFE',
      greenGlow: 'rgba(175,169,236,0.22)',
      greenBg: 'rgba(175,169,236,0.09)',
      greenBorder: 'rgba(175,169,236,0.2)',
    },
  },
  slate: {
    name: 'رمادي',
    light: {
      bg: '#F2F0EA',
      bg2: '#E6E4DC',
      bg3: '#D4D2CA',
      surface: '#FEFEFE',
      surface2: '#F2F0EA',
      border: 'rgba(95,94,90,0.08)',
      border2: 'rgba(95,94,90,0.15)',
      border3: 'rgba(95,94,90,0.25)',
      green: '#5F5E5A',
      green2: '#888780',
      green3: '#B4B2A9',
      greenGlow: 'rgba(95,94,90,0.2)',
      greenBg: 'rgba(95,94,90,0.07)',
      greenBorder: 'rgba(95,94,90,0.18)',
    },
    dark: {
      bg: '#0D0D0B',
      bg2: '#141412',
      bg3: '#1C1C19',
      surface: '#0A0A09',
      surface2: '#111110',
      border: 'rgba(180,178,169,0.08)',
      border2: 'rgba(180,178,169,0.15)',
      border3: 'rgba(180,178,169,0.25)',
      green: '#B4B2A9',
      green2: '#D3D1C7',
      green3: '#F1EFE8',
      greenGlow: 'rgba(180,178,169,0.22)',
      greenBg: 'rgba(180,178,169,0.09)',
      greenBorder: 'rgba(180,178,169,0.2)',
    },
  },
  coral: {
    name: 'مرجاني',
    light: {
      bg: '#FDF0EB',
      bg2: '#FAD8CC',
      bg3: '#F5B9A4',
      surface: '#FFFAF8',
      surface2: '#FDF0EB',
      border: 'rgba(153,60,29,0.08)',
      border2: 'rgba(153,60,29,0.15)',
      border3: 'rgba(153,60,29,0.25)',
      green: '#993C1D',
      green2: '#D85A30',
      green3: '#F0997B',
      greenGlow: 'rgba(153,60,29,0.2)',
      greenBg: 'rgba(153,60,29,0.07)',
      greenBorder: 'rgba(153,60,29,0.18)',
    },
    dark: {
      bg: '#130601',
      bg2: '#1C0A02',
      bg3: '#260E03',
      surface: '#100401',
      surface2: '#170803',
      border: 'rgba(240,153,123,0.08)',
      border2: 'rgba(240,153,123,0.15)',
      border3: 'rgba(240,153,123,0.25)',
      green: '#F0997B',
      green2: '#F5C4B3',
      green3: '#FAE9E4',
      greenGlow: 'rgba(240,153,123,0.22)',
      greenBg: 'rgba(240,153,123,0.09)',
      greenBorder: 'rgba(240,153,123,0.2)',
    },
  },
};

function buildPaletteCss(palette, dark) {
  const p = PALETTES[palette] || PALETTES.teal;
  const vars = dark ? p.dark : p.light;
  return `
    --bg: ${vars.bg}; --bg2: ${vars.bg2}; --bg3: ${vars.bg3};
    --surface: ${vars.surface}; --surface2: ${vars.surface2};
    --border: ${vars.border}; --border2: ${vars.border2}; --border3: ${vars.border3};
    --green: ${vars.green}; --green2: ${vars.green2}; --green3: ${vars.green3};
    --green-glow: ${vars.greenGlow}; --green-bg: ${vars.greenBg}; --green-border: ${vars.greenBorder};
  `;
}

// ─── Smart Schedule (simplified: review-only) ─────────────────────────────────
function generateReviewSchedule({ startPage, endPage, days, startDate }) {
  const result = [];
  const totalPages = endPage - startPage + 1;
  const pagesPerDay = Math.ceil(totalPages / days);
  const dateObj = new Date(startDate);
  let cursor = startPage;
  for (let day = 0; day < days && cursor <= endPage; day++) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + day);
    const dateStr = d.toISOString().split('T')[0];
    const to = Math.min(endPage, cursor + pagesPerDay - 1);
    result.push({ id: genId(), date: dateStr, from: cursor, to, type: 'review', completed: false, note: `مراجعة صفحات ${cursor}–${to}` });
    cursor = to + 1;
  }
  return result;
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
function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60),
    sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Quran API ────────────────────────────────────────────────────────────────
const QAPI = 'https://api.quran.com/api/v4';
async function fetchPageVerses(page) {
  try {
    const r = await fetch(`${QAPI}/verses/by_page/${page}?translations=&fields=text_uthmani,verse_number,juz_number,hizb_number,chapter_id,id&per_page=50`);
    const d = await r.json();
    return d.verses || [];
  } catch {
    return [];
  }
}
async function fetchTafsir(verseKey, tafsirId = '91') {
  try {
    const r = await fetch(`${QAPI}/tafsirs/${tafsirId}/by_ayah/${verseKey}`);
    if (!r.ok) throw new Error(`${r.status}`);
    const d = await r.json();
    return d.tafsir || null;
  } catch (e) {
    console.warn('Tafsir fetch error:', e);
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
    const r = await fetch(`${QAPI}/verses/by_chapter/${surahNum}?fields=text_uthmani,verse_number,juz_number,hizb_number,rub_el_hizb_number,id&per_page=300`);
    const d = await r.json();
    return d.verses || [];
  } catch {
    return [];
  }
}

// ─── Audio ────────────────────────────────────────────────────────────────────
const EVERYAYAH_RECITERS = {
  'ar.alafasy': 'Alafasy_128kbps',
  'ar.abdurrahmaansudais': 'AbdulSamad_128kbps_anti_hf',
  'ar.abdulsamad': 'Abdul_Basit_Murattal_192kbps',
  'ar.husary': 'Husary_128kbps',
  'ar.minshawi': 'Minshawy_Murattal_128kbps',
  'ar.saoodshuraym': 'Saood_ash-Shuraym_128kbps',
};
const SURAH_VERSE_COUNTS = [0, 7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 54, 53, 60, 109, 101, 51, 53, 81, 60, 15, 49, 31, 60, 40, 61, 58, 53, 58, 76, 62, 34, 40, 31, 25, 43, 58, 7, 18, 65, 27, 44, 20, 25, 33, 44, 30, 26, 16, 24, 26, 32, 30, 28, 28, 20, 18, 16, 22, 32, 25, 29, 20, 37, 26, 17, 20, 24, 26, 29, 30, 26, 25, 24, 22, 25, 12, 27, 22, 28, 22, 24, 26, 33, 30, 26, 31, 32, 29, 23, 25, 21, 24, 13, 7, 65, 18, 15, 21, 11, 20, 13, 14, 14, 7, 19, 7, 19, 10, 20, 19, 20, 12, 24, 10, 33, 30, 8, 19, 18, 20, 13, 17, 19, 26, 16, 14, 19, 19, 10, 20, 23, 17, 13, 15, 27, 6, 12, 20, 6, 15, 10, 12, 12, 18, 12, 16, 13, 16, 16, 20, 18, 11, 6, 9, 19, 9, 5, 8, 6, 8, 9, 6, 8, 29, 22, 28, 28, 29, 26, 27, 27, 22, 24, 20, 21, 14, 17, 18, 12, 15, 15, 16, 19, 15, 8, 17, 10, 26, 11, 11, 10, 10, 5, 13, 13, 12, 17, 20, 13, 15, 14, 15, 15, 10, 13, 12, 18, 16, 12, 19, 7, 10, 12, 13, 19, 16, 10, 9, 5, 7, 4, 53, 44, 26, 26, 26, 27, 20, 11, 35, 23, 5, 35, 35, 5, 8, 4, 9, 4, 4, 4, 4, 10, 2, 13, 4, 13, 4, 9, 4, 2, 4, 3, 5, 4, 5, 5, 3, 5, 3, 4, 4, 5, 5, 3, 3, 5, 4, 3, 4, 3, 3, 4, 11, 4, 4, 3, 3, 3, 3, 2, 3, 2, 2, 7, 72, 11, 20, 28, 52, 69, 18, 24, 44, 25, 24, 35, 46, 208, 15, 16, 16, 232, 6, 3];
function getVerseGlobalId(surah, ayah) {
  let t = 0;
  for (let i = 1; i < surah; i++) t += SURAH_VERSE_COUNTS[i] || 0;
  return t + ayah;
}
function getAudioUrlEveryayah(surah, ayah, reciterId) {
  const s = String(surah).padStart(3, '0'),
    a = String(ayah).padStart(3, '0');
  return `https://everyayah.com/data/${EVERYAYAH_RECITERS[reciterId] || 'Alafasy_128kbps'}/${s}${a}.mp3`;
}
function getAudioUrlCDN(reciterId, surah, ayah) {
  return `https://cdn.islamic.network/quran/audio/128/${reciterId}/${getVerseGlobalId(surah, ayah)}.mp3`;
}

const RECITERS = [
  { id: 'ar.alafasy', name: 'مشاري العفاسي' },
  { id: 'ar.abdurrahmaansudais', name: 'عبد الرحمن السديس' },
  { id: 'ar.abdulsamad', name: 'عبد الباسط عبد الصمد' },
  { id: 'ar.husary', name: 'محمود خليل الحصري' },
  { id: 'ar.minshawi', name: 'محمد صديق المنشاوي' },
  { id: 'ar.saoodshuraym', name: 'سعود الشريم' },
];

const TAFSIR_OPTIONS = [
  { id: '91', name: 'الميسر' },
  { id: '16', name: 'ابن كثير' },
  { id: '94', name: 'الطبري' },
  { id: '97', name: 'القرطبي' },
];

const ERROR_TYPES = [
  { id: 'forgot_start', label: 'نسيان البداية', color: '#c0392b' },
  { id: 'wrong_text', label: 'خطأ في النص', color: '#d35400' },
  { id: 'forgot_end', label: 'نسيان النهاية', color: '#8e44ad' },
  { id: 'confused', label: 'خلط بين آيتين', color: '#2980b9' },
];
const TYPE_LBL = { forgot_start: 'نسيان البداية', wrong_text: 'خطأ في النص', forgot_end: 'نسيان النهاية', confused: 'خلط بين آيتين' };
const HINTS = {
  forgot_start: ['ابدأ من الآية السابقة', 'ركّز على بداية الآية'],
  wrong_text: ['اقرأ الآية ببطء كاملة', 'انتبه لكل كلمة'],
  forgot_end: ['ابدأ من منتصف الآية', 'ركّز على نهاية الآية'],
  confused: ['ابدأ من أول الربع', 'فرّق بين الآيتين'],
};

// ─── Tajweed Engine ───────────────────────────────────────────────────────────
const TAJWEED_COLORS = { ghunna: '#12A121', ikhfa: '#9B1D8A', idgham: '#CC3300', iqlab: '#2255CC', qalqala: '#8B4500', madd: '#008B8B', idhhar: '#006400' };
const TANWIN = /[\u064B\u064C\u064D]/,
  SUKUN = /\u0652/,
  SHADDA = /\u0651/,
  QALQALA_LETTERS = /[قطبجد]/,
  IDGHAM_LETTERS = /[يرملون]/,
  IKHFA_LETTERS = /[تثجدذزسشصضطظفقك]/,
  IQLAB_LETTER = /[ب]/,
  IDHHAR_LETTERS = /[حخعغهء]/,
  SUN_LETTERS = /[تثدذرزسشصضطظلن]/;
function isArabicDiacritic(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 0x064b && c <= 0x065f) || c === 0x0670 || c === 0x0671;
}
function isArabicLetter(ch) {
  const c = ch.charCodeAt(0);
  return (c >= 0x0600 && c <= 0x06ff) || (c >= 0xfb50 && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfeff);
}
function getPrevLetterCluster(chars, idx) {
  let i = idx - 1;
  while (i >= 0 && isArabicDiacritic(chars[i])) i--;
  if (i < 0 || !isArabicLetter(chars[i])) return null;
  let cl = chars[i],
    j = i + 1;
  while (j < idx && isArabicDiacritic(chars[j])) {
    cl += chars[j];
    j++;
  }
  return cl;
}
function getPrevTwoLetters(chars, idx) {
  let l = '',
    i = idx - 1,
    c = 0;
  while (i >= 0 && c < 2) {
    if (!isArabicDiacritic(chars[i]) && isArabicLetter(chars[i])) {
      l = chars[i] + l;
      c++;
    }
    i--;
  }
  return l;
}
function isMaddLetter(chars, idx, base, diac) {
  if (base === 'ا' || base === 'آ') {
    const p = getPrevLetterCluster(chars, idx);
    if (p && /[\u064E]/.test(p)) return true;
  }
  if (base === 'و' && SUKUN.test(diac)) {
    const p = getPrevLetterCluster(chars, idx);
    if (p && /[\u064F]/.test(p)) return true;
  }
  if (base === 'ي' && SUKUN.test(diac)) {
    const p = getPrevLetterCluster(chars, idx);
    if (p && /[\u0650]/.test(p)) return true;
  }
  return false;
}
function getTajweedColor(chars, idx, cluster) {
  const base = cluster[0],
    diac = cluster.slice(1);
  if (SHADDA.test(diac)) {
    if (/[منيو]/.test(base)) return TAJWEED_COLORS.ghunna;
    return TAJWEED_COLORS.idgham;
  }
  if (QALQALA_LETTERS.test(base) && SUKUN.test(diac)) return TAJWEED_COLORS.qalqala;
  const pc = getPrevLetterCluster(chars, idx);
  if (pc) {
    const pb = pc[0],
      pd = pc.slice(1),
      nk = pb === 'ن' && SUKUN.test(pd),
      tw = TANWIN.test(pd);
    if (nk || tw) {
      if (IQLAB_LETTER.test(base)) return TAJWEED_COLORS.iqlab;
      if (IDGHAM_LETTERS.test(base)) return TAJWEED_COLORS.idgham;
      if (IKHFA_LETTERS.test(base)) return TAJWEED_COLORS.ikhfa;
      if (IDHHAR_LETTERS.test(base)) return TAJWEED_COLORS.idhhar;
    }
  }
  const pt = getPrevTwoLetters(chars, idx);
  if (pt === 'ال' && SUN_LETTERS.test(base) && SHADDA.test(diac)) return TAJWEED_COLORS.madd;
  if (isMaddLetter(chars, idx, base, diac)) return TAJWEED_COLORS.madd;
  if (TANWIN.test(diac)) return TAJWEED_COLORS.ghunna;
  return null;
}
function applyTajweed(text) {
  if (!text) return [];
  const chars = [...text],
    segs = [];
  let i = 0;
  while (i < chars.length) {
    const ch = chars[i];
    let cl = ch,
      j = i + 1;
    while (j < chars.length && isArabicDiacritic(chars[j])) {
      cl += chars[j];
      j++;
    }
    const color = getTajweedColor(chars, i, cl);
    if (color && segs.length > 0 && segs[segs.length - 1].color === color) segs[segs.length - 1].text += cl;
    else if (!color && segs.length > 0 && !segs[segs.length - 1].color) segs[segs.length - 1].text += cl;
    else segs.push({ text: cl, color });
    i = j;
  }
  return segs;
}
function TajweedText({ text }) {
  const segs = applyTajweed(text);
  return (
    <span>
      {segs.map((s, i) =>
        s.color ? (
          <span key={i} style={{ color: s.color }}>
            {s.text}
          </span>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
function buildCSS(palette, dark) {
  const p = PALETTES[palette] || PALETTES.teal;
  const v = dark ? p.dark : p.light;
  return `
@import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Tajawal:wght@300;400;500;700;800;900&family=Amiri:wght@400;700&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:${v.bg};--bg2:${v.bg2};--bg3:${v.bg3};
  --surface:${v.surface};--surface2:${v.surface2};
  --border:${v.border};--border2:${v.border2};--border3:${v.border3};
  --green:${v.green};--green2:${v.green2};--green3:${v.green3};
  --green-glow:${v.greenGlow};--green-bg:${v.greenBg};--green-border:${v.greenBorder};
  ${
    dark
      ? `
  --ink:#EDE0C4;--ink2:#C8B08A;--ink3:#887250;--ink4:#564830;
  --shadow-xs:0 1px 3px rgba(0,0,0,0.3);--shadow-sm:0 2px 8px rgba(0,0,0,0.38);
  --shadow-md:0 4px 20px rgba(0,0,0,0.44);--shadow-lg:0 8px 40px rgba(0,0,0,0.52);--shadow-xl:0 16px 60px rgba(0,0,0,0.6);
  `
      : `
  --ink:#1A1208;--ink2:#382815;--ink3:#7A5E38;--ink4:#B09060;
  --shadow-xs:0 1px 3px rgba(20,12,4,0.06),0 1px 2px rgba(20,12,4,0.04);
  --shadow-sm:0 2px 8px rgba(20,12,4,0.08);--shadow-md:0 4px 20px rgba(20,12,4,0.1);
  --shadow-lg:0 8px 40px rgba(20,12,4,0.12);--shadow-xl:0 16px 60px rgba(20,12,4,0.16);
  `
  }
  --gold:#7A5010;--gold2:#9E6A1A;--gold3:#C48A30;
  --gold-bg:rgba(122,80,16,0.07);--gold-border:rgba(122,80,16,0.18);
  --red:#6E1414;--red2:#9B2020;
  --red-bg:rgba(110,20,20,0.06);--red-border:rgba(110,20,20,0.15);
  --blue:#1A3468;--blue-bg:rgba(26,52,104,0.07);--blue-border:rgba(26,52,104,0.15);
  --r-xs:4px;--r-sm:8px;--r-md:12px;--r-lg:16px;--r-xl:22px;--r-2xl:28px;--r-full:999px;
  --quran-sm:19px;--quran-md:23px;--quran-lg:29px;
  --sidebar-w:248px;--header-h:58px;
}
html{scroll-behavior:smooth;}
body{font-family:'Tajawal',sans-serif;background:var(--bg);color:var(--ink);direction:rtl;-webkit-font-smoothing:antialiased;min-height:100dvh;overflow-x:hidden;}
.app-shell{display:flex;min-height:100dvh;}
.sidebar{width:var(--sidebar-w);background:var(--surface);border-left:1px solid var(--border2);display:flex;flex-direction:column;position:fixed;top:0;right:0;height:100dvh;z-index:60;transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);}
.sidebar-brand{padding:16px 14px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:11px;}
.sidebar-logo{width:42px;height:42px;border-radius:13px;background:linear-gradient(150deg,var(--green) 0%,var(--green3) 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 14px var(--green-glow);}
.sidebar-nav{flex:1;padding:10px;overflow-y:auto;}
.sidebar-item{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:var(--r-md);cursor:pointer;font-size:14px;font-weight:700;color:var(--ink3);background:none;border:none;width:100%;text-align:right;font-family:'Tajawal',sans-serif;transition:all 0.15s;margin-bottom:2px;}
.sidebar-item:hover{background:var(--bg2);color:var(--ink2);}
.sidebar-item.active{background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);}
.sidebar-badge{margin-right:auto;min-width:20px;height:20px;border-radius:999px;background:var(--red2);color:white;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 5px;}
.main-content{flex:1;margin-right:var(--sidebar-w);min-height:100dvh;display:flex;flex-direction:column;}
.top-bar{height:var(--header-h);background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 20px;position:sticky;top:0;z-index:40;backdrop-filter:blur(16px);}
.page-content{flex:1;padding:24px 24px 100px;max-width:820px;width:100%;margin:0 auto;}
@media(max-width:768px){
  .sidebar{transform:translateX(100%);}
  .sidebar.open{transform:translateX(0);box-shadow:var(--shadow-xl);}
  .main-content{margin-right:0;}
  .page-content{padding:16px 14px 96px;}
  .top-bar{padding:0 13px;}
  .hide-mobile{display:none!important;}
}
@media(min-width:769px){.bottom-nav{display:none!important;}.mobile-menu-btn{display:none!important;}}
.bottom-nav{position:fixed;bottom:0;left:0;right:0;z-index:50;background:var(--surface);border-top:1px solid var(--border2);padding:4px 2px max(8px,env(safe-area-inset-bottom));display:flex;justify-content:space-around;backdrop-filter:blur(16px);}
.nav-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 6px;border-radius:var(--r-md);cursor:pointer;background:none;border:none;color:var(--ink4);font-family:'Tajawal',sans-serif;transition:all 0.15s;font-size:10px;font-weight:700;min-width:50px;flex:1;max-width:70px;}
.nav-item.active{color:var(--green);background:var(--green-bg);}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);box-shadow:var(--shadow-xs);}
.card-flat{background:var(--surface2);border:1px solid var(--border);border-radius:var(--r-md);}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;font-family:'Tajawal',sans-serif;font-weight:700;cursor:pointer;border:none;border-radius:var(--r-md);transition:all 0.15s;white-space:nowrap;outline:none;}
.btn:active:not(:disabled){transform:scale(0.96);}
.btn:disabled{opacity:0.4;cursor:not-allowed;}
.btn-xs{padding:4px 9px;font-size:11.5px;}
.btn-sm{padding:7px 14px;font-size:13px;}
.btn-md{padding:10px 18px;font-size:14px;}
.btn-lg{padding:13px 26px;font-size:15px;}
.btn-primary{background:var(--green);color:white;box-shadow:0 3px 10px var(--green-glow);}
.btn-primary:hover:not(:disabled){background:var(--green2);box-shadow:0 5px 16px var(--green-glow);}
.btn-gold{background:var(--gold);color:white;}
.btn-gold:hover:not(:disabled){background:var(--gold2);}
.btn-danger{background:var(--red2);color:white;}
.btn-ghost{background:var(--bg2);color:var(--ink2);border:1px solid var(--border2);}
.btn-ghost:hover:not(:disabled){background:var(--bg3);}
.btn-green-ghost{background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);}
.btn-green-ghost:hover:not(:disabled){background:var(--green-bg);}
.btn-red-ghost{background:var(--red-bg);color:var(--red2);border:1px solid var(--red-border);}
.btn-icon{width:36px;height:36px;padding:0;border-radius:var(--r-md);background:var(--bg2);color:var(--ink2);border:1px solid var(--border);}
.btn-icon:hover:not(:disabled){background:var(--bg3);}
.btn-circle{width:44px;height:44px;padding:0;border-radius:50%;background:var(--green);color:white;box-shadow:0 3px 12px var(--green-glow);border:none;cursor:pointer;transition:all 0.15s;display:flex;align-items:center;justify-content:center;}
.btn-circle:hover:not(:disabled){background:var(--green2);}
.btn-circle:disabled{opacity:0.4;cursor:not-allowed;}
.input{width:100%;padding:10px 13px;border-radius:var(--r-md);border:1.5px solid var(--border2);background:var(--surface);color:var(--ink);font-family:'Tajawal',sans-serif;font-size:14px;outline:none;transition:border-color 0.18s,box-shadow 0.18s;direction:rtl;}
.input:focus{border-color:var(--green);box-shadow:0 0 0 3px var(--green-bg);}
.input::placeholder{color:var(--ink4);}
select.input{cursor:pointer;}
textarea.input{resize:none;line-height:1.8;}
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;}
.badge-green{background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);}
.badge-gold{background:var(--gold-bg);color:var(--gold2);border:1px solid var(--gold-border);}
.badge-red{background:var(--red-bg);color:var(--red2);border:1px solid var(--red-border);}
.badge-gray{background:var(--bg2);color:var(--ink3);border:1px solid var(--border);}
.badge-blue{background:var(--blue-bg);color:var(--blue);border:1px solid var(--blue-border);}
.progress{height:4px;border-radius:999px;background:var(--bg3);overflow:hidden;}
.progress-bar{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--green),var(--green3));transition:width 0.5s cubic-bezier(0.4,0,0.2,1);}
.divider{display:flex;align-items:center;gap:12px;color:var(--ink4);font-size:12px;}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:var(--border);}
.tab-bar{display:flex;gap:3px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--r-md);padding:4px;}
.tab-item{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;padding:8px;border-radius:var(--r-sm);font-size:13px;font-weight:700;cursor:pointer;color:var(--ink3);background:transparent;border:none;font-family:'Tajawal',sans-serif;transition:all 0.15s;}
.tab-item.active{background:var(--surface);color:var(--green);box-shadow:var(--shadow-sm);}
.overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.52);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease;}
@media(min-width:640px){.overlay{align-items:center;}}
.sheet{width:100%;max-width:520px;background:var(--surface);border-radius:var(--r-2xl) var(--r-2xl) 0 0;padding:0 0 max(24px,env(safe-area-inset-bottom));animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1);max-height:92dvh;overflow-y:auto;}
@media(min-width:640px){.sheet{border-radius:var(--r-2xl);animation:scaleIn 0.26s cubic-bezier(0.34,1.4,0.64,1);}}
.sheet-handle{width:36px;height:4px;border-radius:999px;background:var(--border3);margin:12px auto 16px;}
.sheet-header{padding:0 20px 14px;border-bottom:1px solid var(--border);margin-bottom:18px;}
.sheet-body{padding:0 20px;}
.sheet-footer{padding:16px 20px 0;border-top:1px solid var(--border);margin-top:18px;}
.skel{background:linear-gradient(90deg,var(--bg2) 25%,var(--bg3) 50%,var(--bg2) 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:var(--r-md);}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px;}
.cal-day{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:var(--r-sm);font-size:12.5px;font-weight:600;cursor:pointer;transition:all 0.12s;position:relative;flex-direction:column;gap:1px;}
.cal-day.today{background:var(--green);color:white;font-weight:800;}
.cal-day.has-task{background:var(--green-bg);color:var(--green);border:1px solid var(--green-border);}
.cal-day.completed{background:var(--bg2);color:var(--ink4);border:1px dashed var(--border2);}
.cal-day.past{color:var(--ink4);}
.cal-day:hover:not(.today){background:var(--bg2);}
.cal-dot{width:4px;height:4px;border-radius:50%;background:var(--green);position:absolute;bottom:3px;left:50%;transform:translateX(-50%);}
.audio-player{position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border2);padding:10px 18px max(10px,env(safe-area-inset-bottom));z-index:80;box-shadow:0 -4px 24px rgba(0,0,0,0.1);backdrop-filter:blur(20px);animation:slideUp 0.26s cubic-bezier(0.4,0,0.2,1);}
@media(min-width:769px){.audio-player{right:var(--sidebar-w);}}
.quran-text{font-family:var(--font-amiri),'Noto Naskh Arabic','Amiri',serif;line-height:2.55;color:var(--ink);text-align:justify;direction:rtl;}
.quran-sm{font-size:var(--quran-sm);}
.quran-md{font-size:var(--quran-md);}
.quran-lg{font-size:var(--quran-lg);}
.verse-num{display:inline-flex;align-items:center;justify-content:center;width:1.8em;height:1.8em;border-radius:50%;background:var(--gold-bg);border:1px solid var(--gold-border);color:var(--gold2);font-size:0.56em;font-family:'Tajawal',sans-serif;font-weight:700;vertical-align:middle;margin:0 3px;flex-shrink:0;cursor:pointer;transition:all 0.12s;-webkit-tap-highlight-color:transparent;}
.verse-num:hover{background:var(--gold);color:white;border-color:var(--gold);}
.verse-span{cursor:pointer;border-radius:4px;padding:2px;transition:background 0.12s;display:inline;-webkit-tap-highlight-color:transparent;}
.verse-span:hover{background:var(--gold-bg);}
.verse-span.has-mistake{background:var(--red-bg);border-bottom:2px solid var(--red2);}
.verse-span.selected{background:var(--green-bg);outline:2px solid var(--green-border);border-radius:4px;}
.verse-span.playing{background:var(--gold-bg);border-bottom:2px solid var(--gold3);}
.verse-span.bookmarked{background:var(--blue-bg);}
.bismillah{text-align:center;font-family:var(--font-amiri),serif;font-size:clamp(20px,5vw,27px);color:var(--gold2);padding:18px 20px;border-radius:var(--r-xl);background:linear-gradient(135deg,var(--gold-bg),var(--green-bg));border:1px solid var(--gold-border);margin-bottom:18px;line-height:2.2;}
.surah-divider{text-align:center;padding:13px;border-radius:var(--r-lg);background:linear-gradient(135deg,var(--gold-bg) 0%,var(--green-bg) 100%);border:1px solid var(--border);margin:18px 0;}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:15px 12px;text-align:center;box-shadow:var(--shadow-xs);}
.stat-num{font-size:26px;font-weight:900;line-height:1;}
.stat-lbl{font-size:11px;font-weight:700;color:var(--ink3);margin-top:4px;}
.settings-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--border);}
.settings-row:last-child{border-bottom:none;}
.switch{position:relative;width:46px;height:26px;cursor:pointer;}
.switch input{opacity:0;width:0;height:0;position:absolute;}
.switch-track{position:absolute;inset:0;border-radius:999px;background:var(--bg3);border:1.5px solid var(--border2);transition:all 0.2s;}
.switch input:checked+.switch-track{background:var(--green);border-color:var(--green);}
.switch-thumb{position:absolute;top:4px;right:4px;width:16px;height:16px;border-radius:50%;background:white;transition:all 0.2s;box-shadow:0 1px 4px rgba(0,0,0,0.2);pointer-events:none;}
.switch input:checked~.switch-thumb{right:calc(100% - 20px);}
.section-label{font-size:10.5px;font-weight:800;letter-spacing:0.12em;color:var(--ink4);text-transform:uppercase;margin-bottom:10px;}
.sidebar-backdrop{display:none;position:fixed;inset:0;z-index:59;background:rgba(0,0,0,0.38);backdrop-filter:blur(3px);}
.sidebar-backdrop.visible{display:block;animation:fadeIn 0.2s ease;}
.verse-menu{position:fixed;z-index:200;background:var(--surface);border:1px solid var(--border2);border-radius:var(--r-lg);box-shadow:var(--shadow-xl);min-width:205px;overflow:hidden;animation:scaleIn 0.18s cubic-bezier(0.34,1.4,0.64,1);}
.verse-menu-item{display:flex;align-items:center;gap:10px;padding:12px 15px;cursor:pointer;font-size:13.5px;font-weight:700;color:var(--ink2);transition:background 0.12s;background:none;border:none;width:100%;font-family:'Tajawal',sans-serif;text-align:right;}
.verse-menu-item:hover{background:var(--bg2);}
.verse-menu-item+.verse-menu-item{border-top:1px solid var(--border);}
input[type=range]{-webkit-appearance:none;width:100%;height:4px;border-radius:999px;background:var(--bg3);outline:none;cursor:pointer;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:17px;height:17px;border-radius:50%;background:var(--green);box-shadow:0 2px 6px var(--green-glow);}
.mistake-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:13px 15px;box-shadow:var(--shadow-xs);transition:box-shadow 0.18s,border-color 0.18s;}
.bm-indicator{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--blue);vertical-align:middle;margin-right:3px;}
.verse-hidden{filter:blur(10px);user-select:none;pointer-events:none;transition:filter 0.4s;}
.verse-revealed{filter:none;transition:filter 0.4s;}
.ward-card{background:linear-gradient(135deg,var(--green) 0%,var(--green2) 60%,var(--green3) 100%);border-radius:var(--r-xl);padding:20px;color:white;position:relative;overflow:hidden;}
.ward-card::after{content:'﷽';position:absolute;bottom:-12px;left:8px;font-family:var(--font-amiri),serif;font-size:88px;opacity:0.05;line-height:1;pointer-events:none;}
.palette-btn{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:all 0.15s;flex-shrink:0;}
.palette-btn.active{border-color:var(--ink);transform:scale(1.15);}
.review-header{position:sticky;top:0;z-index:40;background:var(--surface);border-bottom:1px solid var(--border);padding:11px 16px;backdrop-filter:blur(16px);}
.review-footer{position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding:9px 14px max(12px,env(safe-area-inset-bottom));z-index:30;backdrop-filter:blur(14px);}
.review-footer2{position:fixed;bottom:0;left:0 ;padding:9px 14px max(12px,env(safe-area-inset-bottom)) ;}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes slideUp{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.92);}to{opacity:1;transform:scale(1);}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}
@keyframes shimmer{0%{background-position:-200% center;}100%{background-position:200% center;}}
@keyframes spin{to{transform:rotate(360deg);}}
.anim-fade-up{animation:fadeUp 0.36s ease both;}
.d1{animation-delay:0.06s;}.d2{animation-delay:0.12s;}.d3{animation-delay:0.18s;}.d4{animation-delay:0.24s;}
.spin{animation:spin 0.9s linear infinite;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-thumb{background:var(--border2);border-radius:999px;}
`;
}

// ─── Tajweed Legend Modal ─────────────────────────────────────────────────────
function TajweedModal({ onClose }) {
  const items = [
    { label: 'غنة (ميم/نون مشددة)', color: TAJWEED_COLORS.ghunna, desc: 'الغنة في النون والميم المشددتين' },
    { label: 'إخفاء', color: TAJWEED_COLORS.ikhfa, desc: 'إخفاء النون الساكنة والتنوين' },
    { label: 'إدغام', color: TAJWEED_COLORS.idgham, desc: 'إدغام النون الساكنة في حروف يرملون' },
    { label: 'إقلاب', color: TAJWEED_COLORS.iqlab, desc: 'قلب النون ساكنة إلى ميم عند الباء' },
    { label: 'قلقلة', color: TAJWEED_COLORS.qalqala, desc: 'حروف قطب جد ساكنة' },
    { label: 'مد', color: TAJWEED_COLORS.madd, desc: 'حروف المد الثلاثة' },
    { label: 'إظهار', color: TAJWEED_COLORS.idhhar, desc: 'إظهار النون الساكنة عند حروف الحلق' },
  ];
  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 17 }}>دليل ألوان التجويد</div>
            <button className='btn btn-icon' onClick={onClose}>
              <X size={17} />
            </button>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 4 }}>الألوان المستخدمة في عرض نص القرآن الكريم</div>
        </div>
        <div className='sheet-body' style={{ paddingBottom: 20 }}>
          {items.map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 'var(--r-md)', background: `${item.color}18`, border: `2px solid ${item.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: item.color }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: item.color, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ink3)' }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [settings, setSettingsState] = useState(getSettings);
  const [screen, setScreen] = useState('home');
  const [reviewRange, setReviewRange] = useState({ from: 1, to: 10 });
  const [page, setPage] = useState(reviewRange.from);
  const [reviewTaskId, setReviewTaskId] = useState(null); // connected calendar task
  const [fixMistake, setFixMistake] = useState(null);
  const [navTab, setNavTab] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [showTajweedModal, setShowTajweedModal] = useState(false);
  const [allVerses, setAllVerses] = useState([]); // shared verses for auto-continue
  const [audioState, setAudioState] = useState({ playing: false, verseKey: null, verseText: null, currentTime: 0, duration: 0, loading: false, surah: null, ayah: null });
  const audioRef = useRef(null);
  const cancelledRef = useRef(false);
  const allVersesRef = useRef([]);

  // Keep ref in sync
  useEffect(() => {
    allVersesRef.current = allVerses;
  }, [allVerses]);

  useEffect(() => {
    setPendingCount(getMistakes().filter(x => !x.resolved).length);
  }, [screen]);

  const updateSettings = useCallback(updates => {
    setSettingsState(prev => {
      const next = { ...prev, ...updates };
      saveSettings(next);
      return next;
    });
  }, []);

  const goTo = tab => {
    setNavTab(tab);
    const map = { home: 'home', calendar: 'calendar', mistakes: 'mistakes_list', quarters: 'quarters', settings: 'settings' };
    setScreen(map[tab] || 'home');
    setSidebarOpen(false);
  };

  // Start review, optionally connected to a calendar task
  const startReview = (from, to, taskId = null) => {
    setReviewRange({ from, to });
    setReviewTaskId(taskId);
    setScreen('review');
  };

  const finishReview = taskId => {
    if (taskId) {
      updateScheduleItem(taskId, { completed: true });
    }
    setNavTab('home');
    setScreen('home');
    setReviewTaskId(null);
  };

  const openFixMode = m => {
    setFixMistake(m);
    setScreen('fix');
  };

  // ─── AUDIO with auto-continue ─────────────────────────────────────────────
  const playVerseAudio = useCallback(
    async (surah, ayah, verseKey, verseText, autoNext = false) => {
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

      const sInt = parseInt(surah, 10),
        aInt = parseInt(ayah, 10);
      if (isNaN(sInt) || isNaN(aInt) || sInt < 1 || aInt < 1) return;

      const reciter = settings.reciter || 'ar.alafasy';
      const primary = getAudioUrlEveryayah(sInt, aInt, reciter);
      const fallback = getAudioUrlCDN(reciter, sInt, aInt);

      setAudioState({ playing: false, verseKey, verseText, currentTime: 0, duration: 0, loading: true, surah: sInt, ayah: aInt });

      const tryPlay = (url, isFb = false) =>
        new Promise((res, rej) => {
          if (cancelledRef.current) {
            rej('cancelled');
            return;
          }
          audio.src = url;
          audio.load();
          audio.onloadedmetadata = () => {
            if (!cancelledRef.current) setAudioState(s => ({ ...s, duration: audio.duration, loading: false }));
          };
          audio.ontimeupdate = () => {
            if (!cancelledRef.current) setAudioState(s => ({ ...s, currentTime: audio.currentTime }));
          };
          audio.onended = () => {
            if (cancelledRef.current) return;
            // Auto-continue to next verse
            const verses = allVersesRef.current;
            const idx = verses.findIndex(v => v.verse_key === verseKey);
            if (idx !== -1 && idx < verses.length - 1) {
              const next = verses[idx + 1];
              const [ns, na] = next.verse_key.split(':');
              playVerseAudio(ns, na, next.verse_key, next.text_uthmani, true);
            } else {
              setAudioState(s => ({ ...s, playing: false, currentTime: 0 }));
            }
          };
          audio.onerror = () => {
            if (cancelledRef.current) {
              rej('cancelled');
              return;
            }
            if (!isFb) {
              audio.onerror = null;
              audio.onloadedmetadata = null;
              audio.ontimeupdate = null;
              audio.onended = null;
              tryPlay(fallback, true).then(res).catch(rej);
            } else {
              setAudioState(s => ({ ...s, loading: false }));
              rej('error');
            }
          };
          audio
            .play()
            .then(() => {
              if (cancelledRef.current) {
                audio.pause();
                rej('cancelled');
                return;
              }
              setAudioState(s => ({ ...s, playing: true, loading: false }));
              res();
            })
            .catch(e => {
              if (cancelledRef.current) {
                rej('cancelled');
                return;
              }
              if (!isFb) {
                audio.onerror = null;
                audio.onloadedmetadata = null;
                audio.ontimeupdate = null;
                audio.onended = null;
                tryPlay(fallback, true).then(res).catch(rej);
              } else {
                setAudioState(s => ({ ...s, loading: false }));
                rej(e);
              }
            });
        });

      try {
        await tryPlay(primary, false);
      } catch (e) {
        if (e !== 'cancelled') {
          setAudioState(s => ({ ...s, loading: false, playing: false }));
        }
      }
    },
    [settings.reciter],
  );

  const playAudio = useCallback(
    (surah, ayah, verseKey, verseText) => {
      playVerseAudio(surah, ayah, verseKey, verseText, false);
    },
    [playVerseAudio],
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

  const css = buildCSS(settings.palette || 'teal', settings.darkMode);

  const renderScreen = () => {
    if (screen === 'review') return <ReviewPage page={page} setPage={setPage} from={reviewRange.from} to={reviewRange.to} taskId={reviewTaskId} settings={settings} onFinish={() => finishReview(reviewTaskId)} onPlayAudio={playAudio} onClosePlayer={closePlayer} playingKey={audioState.verseKey} hasPlayer={hasPlayer} onVersesLoaded={setAllVerses} />;
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
      <div style={{ paddingBottom: hasPlayer ? 'calc(88px + env(safe-area-inset-bottom,0px))' : undefined }}>
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
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className='app-shell'>
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className='sidebar-brand'>
            <div className='sidebar-logo'>
              <BookOpen size={19} color='white' />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 17, color: 'var(--green)' }}>مراجع</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink4)', marginTop: 1 }}>القرآن الكريم</div>
            </div>
          </div>
          <nav className='sidebar-nav'>
            {navItems.map(({ id, label, Icon }) => (
              <button key={id} className={`sidebar-item ${navTab === id ? 'active' : ''}`} onClick={() => goTo(id)}>
                <Icon size={16} strokeWidth={1.8} />
                <span>{label}</span>
                {id === 'mistakes' && pendingCount > 0 && <span className='sidebar-badge'>{pendingCount}</span>}
              </button>
            ))}
          </nav>
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontFamily: "var(--font-amiri),serif", fontSize: 13, color: 'var(--ink4)', textAlign: 'center', lineHeight: 2.2 }}>﴿ وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا ﴾</div>
          </div>
        </aside>

        <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

        <div className='main-content'>
          <header className='top-bar'>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className='btn btn-icon mobile-menu-btn' onClick={() => setSidebarOpen(!sidebarOpen)}>
                <Menu size={17} />
              </button>
              <span style={{ fontWeight: 800, fontSize: 15.5, color: 'var(--ink)' }}>{screen === 'review' ? 'مراجعة' : screen === 'fix' ? 'تصحيح' : navItems.find(n => n.id === navTab)?.label || 'مراجع'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {pendingCount > 0 && <span className='badge badge-red hide-mobile'>{pendingCount} خطأ</span>}
              <button className='btn btn-icon' title='دليل التجويد' onClick={() => setShowTajweedModal(true)}>
                <Info size={16} />
              </button>
              <button className='btn btn-icon' onClick={() => updateSettings({ darkMode: !settings.darkMode })}>
                {settings.darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </header>
          {renderScreen()}
        </div>

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

        {hasPlayer && <AudioPlayer from={reviewRange.from} to={reviewRange.to} setPage={setPage} page={page} state={audioState} onToggle={togglePlayPause} onClose={closePlayer} onSeek={seekAudio} />}
        {showTajweedModal && <TajweedModal onClose={() => setShowTajweedModal(false)} />}
      </div>
    </>
  );
}

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ page, setPage, from, to, state, onToggle, onClose, onSeek, handleFinish }) {
  const { playing, verseKey, verseText, currentTime, duration, loading } = state;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className='audio-player'
      style={{
        padding: 15,
        borderRadius: 0,
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
      }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'nowrap',
          width: '100%',
          minWidth: 0,
        }}>
        {/* Verse info */}
        <div
          style={{
            minWidth: 0,
            flex: '0 1 220px',
            overflow: 'hidden',
          }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: 'var(--gold2)',
              marginBottom: 2,
              whiteSpace: 'nowrap',
            }}>
            الآية {verseKey}
          </div>

          {verseText && (
            <div
              className='quran-text'
              style={{
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--ink2)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
              {verseText}
            </div>
          )}
        </div>

        {/* Navigation buttons icons only */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}>
          <button
            className='btn btn-ghost btn-icon'
            disabled={page <= from}
            onClick={() => setPage(p => p - 1)}
            title='السابقة'
            aria-label='السابقة'
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <ChevronRight size={16} />
          </button>

          <button
            className='btn btn-primary btn-icon'
            onClick={() => {
              if (page < to) setPage(p => p + 1);
             }}
            title={page < to ? 'التالية' : 'إنهاء'}
            aria-label={page < to ? 'التالية' : 'إنهاء'}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {page < to ? <ChevronLeft size={16} /> : <Check size={16} />}
          </button>
        </div>

        {/* Audio controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
            paddingInline: 6,
            borderInline: '1px solid var(--border)',
          }}>
           

          <button
            className='btn-circle'
            onClick={onToggle}
            disabled={loading}
            style={{
              width: 38,
              height: 38,
              flexShrink: 0,
            }}>
            {loading ? (
              <Loader2 size={17} className='spin' color='white' />
            ) : playing ? (
              <Pause size={17} color='white' />
            ) : (
              <Play size={17} color='white' />
            )}
          </button>

          <span
            style={{
              fontSize: 11,
              color: 'var(--ink4)',
              minWidth: 34,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Seekbar in same row */}
        <div
          style={{
            flex: 1,
            minWidth: 90,
            display: 'flex',
            alignItems: 'center',
          }}>
          <input
            type='range'
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            dir='ltr'
            onChange={e => onSeek(Number(e.target.value))}
            style={{
              width: '100%',
              margin: 0,
              background: `linear-gradient(to left, var(--bg3) ${100 - progress}%, var(--green) ${100 - progress}%)`,
            }}
          />
        </div>

        {/* Close */}
        <button
          className='btn btn-icon'
          onClick={onClose}
          title='إغلاق'
          aria-label='إغلاق'
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            flexShrink: 0,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({ onStartReview, settings }) {
  const [showModal, setShowModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, resolved: 0, pending: 0 });
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [todayPlan, setTodayPlan] = useState([]);
  const [recentSessions, setRecentSessions] = useState([]);
  const [lastPos, setLastPos] = useState(null);

  useEffect(() => {
    const m = getMistakes(),
      sess = getSessions();
    setStats({ total: m.length, resolved: m.filter(x => x.resolved).length, pending: m.filter(x => !x.resolved).length });
    setStreak(getStreak());
    const todayStr = new Date().toISOString().split('T')[0];
    setTodayPlan(getSchedule().filter(s => s.date === todayStr && !s.completed));
    setRecentSessions(sess.slice(-3).reverse());
    const lp = getLastPosition();
    if (lp?.page && lp.page > 0) setLastPos(lp);
  }, []);

  const resolvedPct = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className='page-content'>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }} className='anim-fade-up'>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 900, color: 'var(--ink)', marginBottom: 3 }}>السلام عليكم</h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>{new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        {streak.current > 0 && (
          <div style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', padding: '10px 14px', textAlign: 'center' }}>
            <Flame size={18} color='var(--gold2)' style={{ marginBottom: 2 }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--gold2)', lineHeight: 1 }}>{streak.current}</div>
            <div style={{ fontSize: 9.5, color: 'var(--ink4)', fontWeight: 700, marginTop: 1 }}>يوم</div>
          </div>
        )}
      </div>

      {todayPlan.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          {todayPlan.map(plan => (
            <div key={plan.id} className='ward-card anim-fade-up d1' style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 10.5, opacity: 0.75, fontWeight: 700, marginBottom: 3 }}>🔄 مراجعة اليوم</div>
                  <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 2 }}>
                    صفحات {plan.from} – {plan.to}
                  </div>
                  <div style={{ fontSize: 11.5, opacity: 0.7 }}>{plan.to - plan.from + 1} صفحة</div>
                </div>
                <button onClick={() => onStartReview(plan.from, plan.to, plan.id)} style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)', color: 'white', padding: '9px 18px', borderRadius: 'var(--r-md)', fontFamily: "'Tajawal',sans-serif", fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  ابدأ <ChevronLeft size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}


      <button className='anim-fade-up d3' onClick={() => setShowModal(true)} style={{ width: '100%', padding: '18px 22px', borderRadius: 'var(--r-xl)', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,var(--green) 0%,var(--green2) 60%,var(--green3) 100%)', color: 'white', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 8px 28px var(--green-glow)', transition: 'all 0.2s', marginBottom: 14, fontFamily: "'Tajawal',sans-serif" }}>
        <div style={{ width: 48, height: 48, borderRadius: '13px', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <BookOpen size={24} color='white' />
        </div>
        <div style={{ flex: 1, textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 2 }}>ابدأ مراجعة جديدة</div>
          <div style={{ fontSize: 12.5, opacity: 0.76 }}>اختر نطاق الصفحات وابدأ الآن</div>
        </div>
        <ChevronLeft size={20} opacity={0.6} />
      </button>

      {lastPos && (
        <div className='anim-fade-up d1' style={{ marginBottom: 14 }}>
          <button onClick={() => onStartReview(lastPos.page, Math.min(604, lastPos.page + 4))} style={{ width: '100%', padding: '12px 16px', borderRadius: 'var(--r-lg)', border: '1px solid var(--gold-border)', background: 'var(--gold-bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, fontFamily: "'Tajawal',sans-serif" }}>
            <Clock size={18} color='var(--gold2)' />
            <div style={{ flex: 1, textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold2)' }}>استكمال من آخر موضع</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>
                صفحة {lastPos.page} · {formatDate(lastPos.date)}
              </div>
            </div>
            <ChevronLeft size={14} color='var(--gold2)' />
          </button>
        </div>
      )}

 

      {stats.total > 0 && (
        <div className='card anim-fade-up d2' style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink2)' }}>إنجاز المراجعة</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: 'var(--green)' }}>{resolvedPct}%</span>
          </div>
          <div className='progress'>
            <div className='progress-bar' style={{ width: `${resolvedPct}%` }} />
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchSurahList().then(s => {
      setSurahs(s);
      setLoading(false);
    });
  }, []);

  const validate = () => {
    if (from < 1 || from > 604 || to < from || to > 604) {
      setErr('تحقق من أرقام الصفحات (1–604)');
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
            <div style={{ width: 42, height: 42, borderRadius: '11px', background: 'var(--green-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color='var(--green)' />
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
                    <input type='number' min={1} max={604} value={f.val} onChange={e => f.set(Number(e.target.value))} className='input' style={{ textAlign: 'center', fontSize: 22, fontWeight: 900, color: 'var(--green)', padding: '9px' }} />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  { l: 'صفحة', d: 0 },
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
                    style={{ padding: '5px 11px', borderRadius: '999px', border: '1.5px solid var(--border2)', background: 'var(--bg2)', color: 'var(--ink2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Tajawal',sans-serif" }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ maxHeight: 250, overflowY: 'auto', marginBottom: 14 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--ink4)' }}>
                  <Loader2 size={22} className='spin' />
                  <div style={{ fontSize: 13, marginTop: 8 }}>جارٍ التحميل...</div>
                </div>
              ) : (
                surahs.map(s => (
                  <button
                    key={s.id}
                    style={{ width: '100%', padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', borderRadius: 'var(--r-md)', cursor: 'pointer', fontFamily: "'Tajawal',sans-serif", marginBottom: 2 }}
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
                    <div style={{ width: 30, height: 30, borderRadius: '8px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, color: 'var(--gold2)', flexShrink: 0 }}>{s.id}</div>
                    <div style={{ flex: 1, textAlign: 'right' }}>
                      <div style={{ fontFamily: "var(--font-amiri),serif", fontWeight: 700, fontSize: 15 }}>{s.name_arabic}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink4)' }}>{s.verses_count} آية</div>
                    </div>
                    <ChevronLeft size={13} color='var(--ink4)' />
                  </button>
                ))
              )}
            </div>
          )}
          <div style={{ padding: '10px 14px', borderRadius: '11px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', marginBottom: 14, textAlign: 'center' }}>
            <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--green)' }}>{Math.max(0, to - from + 1)} صفحات</span>
          </div>
          {err && <div style={{ color: 'var(--red2)', fontSize: 12.5, textAlign: 'center', marginBottom: 10 }}>{err}</div>}
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
function ReviewPage({ page, setPage, from, to, taskId, settings, onFinish, onPlayAudio, playingKey, hasPlayer, onClosePlayer, onVersesLoaded }) {
  const [verses, setVerses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sessionMistakes, setSessionMistakes] = useState([]);
  const [pageMistakes, setPageMistakes] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [activeVerse, setActiveVerse] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [mistakeModalVerse, setMistakeModalVerse] = useState(null);
  const [tafsirModalVerse, setTafsirModalVerse] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const menuRef = useRef(null);
  const sessionStart = useRef(new Date().toISOString());
  const qSizeClass = { sm: 'quran-sm', md: 'quran-md', lg: 'quran-lg' }[settings.quranFontSize] || 'quran-md';
  const showTajweed = settings.tajweedColors !== false;

  const loadPage = useCallback(async () => {
    setLoading(true);
    setActiveVerse(null);
    setMenuPos(null);
    const v = await fetchPageVerses(page);
    setVerses(v);
    onVersesLoaded && onVersesLoaded(v);
    setPageMistakes(getMistakes().filter(m => m.page === page));
    setBookmarks(getBookmarks());
    saveLastPosition(page, null);
    setLoading(false);
  }, [page, onVersesLoaded]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

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
    if (activeVerse?.id === verse.id) {
      setActiveVerse(null);
      setMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuH = 200,
      spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow > menuH ? rect.bottom + 6 : rect.top - menuH - 6;
    setActiveVerse(verse);
    setMenuPos({ top: Math.max(8, Math.min(top, window.innerHeight - menuH - 8)), left: Math.max(8, Math.min(rect.left, window.innerWidth - 215)) });
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

  const handlePlayAudio = verse => {
    if (!verse?.verse_key) return;
    const parts = verse.verse_key.split(':');
    if (parts.length !== 2) return;
    onPlayAudio(parts[0], parts[1], verse.verse_key, verse.text_uthmani);
    closeMenu();
  };

  const onMistakeSaved = m => {
    setSessionMistakes(p => [...p, m]);
    setMistakeModalVerse(null);
    setPageMistakes(getMistakes().filter(x => x.page === page));
  };

  const total = to - from + 1;
  const progress = total > 1 ? ((page - from) / (total - 1)) * 100 : 100;
  const mistakeKeys = new Set(pageMistakes.map(m => m.verseKey).filter(Boolean));
  const bookmarkKeys = new Set(bookmarks.map(b => b.verseKey));

  const groups = [];
  verses.forEach(v => {
    const s = v.chapter_id ? String(v.chapter_id) : v.verse_key?.split(':')?.[0];
    const last = groups[groups.length - 1];
    if (!last || last.surah !== s) groups.push({ surah: s, verses: [v] });
    else last.verses.push(v);
  });

  if (showSummary) return <SessionSummary mistakes={sessionMistakes} from={from} to={to} taskId={taskId} onDone={onFinish} />;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div className=' ' style={{ position : "fixed" , left : "100px" , top : 12  , zIndex : 40 }} >
        <div style={{ display: 'flex' , gap : 6, alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 10.5, color: 'var(--ink4)', fontWeight: 600 }}>
              {page - from + 1}/{total} صفحة
            </span> 
          </div>
          <button onClick={handleFinish} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: '10px', border: '1.5px solid var(--green-border)', background: 'var(--green-bg)', color: 'var(--green)', fontFamily: "'Tajawal',sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            <Check size={13} strokeWidth={2.5} /> {taskId ? 'أنهيت ✓' : 'أنهيت'}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px', paddingBottom: hasPlayer ? '160px' : '100px', overscrollBehavior: 'contain' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className='skel' style={{ height: 48, opacity: 0.6 }} />
            ))}
          </div>
        ) : (
          <>
            {verses[0]?.verse_number === 1 && verses[0]?.chapter_id !== 9 && <div className='bismillah'>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>}
            {groups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: 16 }}>
                {group.verses[0]?.verse_number === 1 && gi > 0 && group.surah !== '9' && (
                  <div className='surah-divider'>
                    <div className='quran-text' style={{ fontSize: 12, color: 'var(--gold2)' }}>
                      ـ ـ ـ سورة جديدة ـ ـ ـ
                    </div>
                    <div className='quran-text' style={{ fontSize: 21, color: 'var(--gold3)', marginTop: 5 }}>
                      بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </div>
                  </div>
                )}
                <div className={`quran-text ${qSizeClass}`}>
                  {group.verses.map(verse => {
                    const hasMistake = mistakeKeys.has(verse.verse_key);
                    const isActive = activeVerse?.id === verse.id;
                    const isPlaying = playingKey === verse.verse_key;
                    const isBookmarked = bookmarkKeys.has(verse.verse_key);
                    return (
                      <span key={verse.id}>
                        <span className={`verse-span ${hasMistake ? 'has-mistake' : ''} ${isActive ? 'selected' : ''} ${isPlaying ? 'playing' : ''} ${isBookmarked ? 'bookmarked' : ''}`} onClick={e => handleVerseClick(verse, e)}>
                          {isBookmarked && <span className='bm-indicator' />}
                          {showTajweed ? <TajweedText text={verse.text_uthmani} /> : verse.text_uthmani}
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

      {menuPos && activeVerse && (
        <div ref={menuRef} className='verse-menu' style={{ top: menuPos.top, left: menuPos.left, right: 'auto', width: 215 }}>
          <div style={{ padding: '6px 12px 4px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10.5, color: 'var(--ink4)', fontWeight: 700 }}>الآية {activeVerse.verse_key}</div>
          </div>
          <button
            className='verse-menu-item'
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              closeMenu();
              setMistakeModalVerse(activeVerse);
            }}>
            <Plus size={14} color='var(--red2)' /> تسجيل خطأ
          </button>
          <button
            className='verse-menu-item'
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              closeMenu();
              setTafsirModalVerse(activeVerse);
            }}>
            <BookText size={14} color='var(--green)' /> عرض التفسير
          </button>
          <button
            className='verse-menu-item'
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();

              if (playingKey === activeVerse.verse_key) {
                onClosePlayer();
                closeMenu();
                return;
              }

              handlePlayAudio(activeVerse);
              closeMenu();
            }}>
            <Volume2 size={14} color='var(--gold2)' />
            {playingKey === activeVerse.verse_key ? 'إيقاف الاستماع' : 'استمع للآية'}
          </button>
          <button
            className='verse-menu-item'
            onMouseDown={e => {
              e.preventDefault();
              e.stopPropagation();
              toggleBookmark(activeVerse.verse_key);
              setBookmarks(getBookmarks());
              closeMenu();
            }}>
            <Bookmark size={14} color='var(--blue)' /> {bookmarkKeys.has(activeVerse.verse_key) ? 'إزالة العلامة' : 'وضع علامة'}
          </button>
        </div>
      )}

      <div className='review-footer' style={{ bottom: 0 }}>
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

      {mistakeModalVerse && <MistakeModal page={page} verseKey={mistakeModalVerse.verse_key} verseText={mistakeModalVerse.text_uthmani} onClose={() => setMistakeModalVerse(null)} onSaved={onMistakeSaved} />}
      {tafsirModalVerse && <TafsirModal verseKey={tafsirModalVerse.verse_key} verseText={tafsirModalVerse.text_uthmani} tafsirId={settings.defaultTafsir || '91'} onClose={() => setTafsirModalVerse(null)} />}
    </div>
  );
}

// ─── Session Summary ──────────────────────────────────────────────────────────
function SessionSummary({ mistakes, from, to, taskId, onDone }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className='card anim-fade-up' style={{ padding: '36px 26px', maxWidth: 400, width: '100%', textAlign: 'center' }}>
        <div style={{ width: 76, height: 76, borderRadius: '20px', background: mistakes.length === 0 ? 'var(--green-bg)' : 'var(--gold-bg)', border: `2px solid ${mistakes.length === 0 ? 'var(--green-border)' : 'var(--gold-border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>{mistakes.length === 0 ? <CheckCircle size={36} color='var(--green)' /> : <BarChart2 size={36} color='var(--gold2)' />}</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 5 }}>{mistakes.length === 0 ? 'مراجعة نظيفة 🌟' : 'ملخص الجلسة'}</h2>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 20 }}>
          صفحات {from} – {to}
        </p>
        {taskId && <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', marginBottom: 18, fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>✓ تم تحديد المهمة كمكتملة في الجدول</div>}
        {mistakes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 11, marginBottom: 18 }}>
            <div className='card-flat' style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--red2)' }}>{mistakes.length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 3 }}>أخطاء</div>
            </div>
            <div className='card-flat' style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold2)' }}>{[...new Set(mistakes.map(m => m.page))].length}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 3 }}>صفحات</div>
            </div>
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
    const m = { id: genId(), page, verseKey, verseText: verseText?.slice(0, 100), type, note, date: new Date().toISOString(), resolved: false, repetitionCount: 0, successCount: 0 };
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
            <span className='badge badge-gold'>صفحة {page}</span>
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
                  style={{ padding: '12px 10px', borderRadius: '11px', border: `2px solid ${type === t.id ? t.color : 'var(--border2)'}`, background: type === t.id ? `${t.color}14` : 'var(--surface2)', cursor: 'pointer', textAlign: 'right', fontFamily: "'Tajawal',sans-serif", fontWeight: 700, fontSize: 12.5, color: type === t.id ? t.color : 'var(--ink2)', transition: 'all 0.13s' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink3)', marginBottom: 7 }}>ملاحظة (اختياري)</div>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder='اكتب ملاحظة...' className='input' />
          </div>
          {err && <div style={{ color: 'var(--red2)', fontSize: 12.5, textAlign: 'center', marginBottom: 9 }}>{err}</div>}
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
            إلغاء
          </button>
          <button className='btn btn-danger btn-md' style={{ flex: 1 }} disabled={saving} onClick={save}>
            {saving ? (
              <>
                <Loader2 size={14} className='spin' /> حفظ...
              </>
            ) : (
              'تسجيل'
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
  const [selectedId, setSelectedId] = useState(tafsirId || '91');

  const load = useCallback(
    async id => {
      setLoading(true);
      setError(false);
      setTafsir(null);
      try {
        const t = await fetchTafsir(verseKey, id);
        setTafsir(t);
        if (!t) setError(true);
      } catch {
        setError(true);
      }
      setLoading(false);
    },
    [verseKey],
  );

  useEffect(() => {
    load(selectedId);
  }, [selectedId, load]);

  const cleanText = html => {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' style={{ maxHeight: '92dvh' }} onClick={e => e.stopPropagation()}>
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
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 14 }}>
            {TAFSIR_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setSelectedId(t.id)} style={{ padding: '5px 11px', borderRadius: '999px', border: `1.5px solid ${selectedId === t.id ? 'var(--green)' : 'var(--border2)'}`, background: selectedId === t.id ? 'var(--green-bg)' : 'var(--surface2)', color: selectedId === t.id ? 'var(--green)' : 'var(--ink3)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Tajawal',sans-serif" }}>
                {t.name}
              </button>
            ))}
          </div>
          {verseText && (
            <div style={{ padding: '14px 16px', borderRadius: '13px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', marginBottom: 18 }}>
              <div className='quran-text quran-md' style={{ textAlign: 'center', lineHeight: 2.5 }}>
                {verseText}
              </div>
            </div>
          )}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className='skel' style={{ height: 16, opacity: 0.7 - i * 0.1 }} />
              ))}
            </div>
          ) : error || !tafsir?.text ? (
            <div style={{ textAlign: 'center', color: 'var(--ink4)', padding: '24px 0' }}>
              <AlertCircle size={26} style={{ marginBottom: 9 }} />
              <div style={{ fontWeight: 700, fontSize: 14 }}>لم يتم العثور على تفسير</div>
              <div style={{ fontSize: 12, marginTop: 5 }}>جرّب تفسيراً آخر</div>
            </div>
          ) : (
            <div style={{ fontSize: 15, lineHeight: 2.4, color: 'var(--ink)', fontFamily: "'Noto Naskh Arabic',var(--font-amiri),serif", direction: 'rtl', textAlign: 'justify', whiteSpace: 'pre-line' }}>{cleanText(tafsir.text)}</div>
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
            { label: 'معلّق', val: pending.length, color: 'var(--red2)' },
            { label: 'منجز', val: mistakes.filter(x => x.resolved).length, color: 'var(--green)' },
            { label: 'صفحات', val: new Set(mistakes.map(m => m.page)).size, color: 'var(--gold2)' },
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
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
          <CheckCircle size={44} color='var(--green)' style={{ marginBottom: 13 }} />
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
                <MistakeCard
                  key={m.id}
                  mistake={m}
                  onDelete={() => {
                    if (!confirm('حذف هذا الخطأ؟')) return;
                    deleteMistake(m.id);
                    load();
                  }}
                  onFix={() => onFix(m)}
                  onResolve={() => {
                    updateMistake(m.id, { resolved: true });
                    load();
                  }}
                />
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
        <div style={{ width: 3, borderRadius: '999px', background: mistake.resolved ? 'var(--green)' : errType?.color || 'var(--red2)', alignSelf: 'stretch', flexShrink: 0, minHeight: 44 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 5 }}>
            <span className='badge badge-gold'>ص {mistake.page}</span>
            {mistake.verseKey && <span className='badge badge-gray'>{mistake.verseKey}</span>}
            {mistake.resolved && <span className='badge badge-green'>✓ منجز</span>}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{TYPE_LBL[mistake.type] || mistake.type}</div>
          {mistake.verseText && (
            <div className='quran-text' style={{ fontSize: 13.5, lineHeight: 1.9, color: 'var(--ink3)', marginBottom: 3 }}>
              {mistake.verseText.slice(0, 65)}
              {mistake.verseText.length > 65 ? '…' : ''}
            </div>
          )}
          {mistake.note && <div style={{ fontSize: 11.5, color: 'var(--ink4)', fontStyle: 'italic' }}>{mistake.note}</div>}
          {mistake.successCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 5 }}>
              <div className='progress' style={{ flex: 1, height: 3 }}>
                <div className='progress-bar' style={{ width: `${Math.min(100, (mistake.successCount / 3) * 100)}%` }} />
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink4)' }}>{mistake.successCount}/3</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          {!mistake.resolved && (
            <>
              <button className='btn btn-green-ghost btn-sm' onClick={onFix}>
                راجع
              </button>
              <button className='btn btn-ghost btn-xs' onClick={onResolve}>
                ✓ حلّ
              </button>
            </>
          )}
          <button onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--red2)', cursor: 'pointer', padding: 3, display: 'flex' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fix Mode ─────────────────────────────────────────────────────────────────
function FixMode({ mistake: init, settings, onBack, onDone }) {
  const [mistake, setMistake] = useState(init);
  const [showVerse, setShowVerse] = useState(false);
  const [result, setResult] = useState(null);
  const [verse, setVerse] = useState(null);
  const [prevVerse, setPrevVerse] = useState(null);
  const [loadingV, setLoadingV] = useState(true);
  const required = settings.requiredChecks || 3;

  const refresh = () => {
    const u = getMistakes().find(m => m.id === mistake.id);
    if (u) setMistake(u);
    return u;
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
      .catch(() => setLoadingV(false));
    const pA = parseInt(a) - 1;
    if (pA >= 1)
      fetch(`${QAPI}/verses/by_key/${s}:${pA}?fields=text_uthmani`)
        .then(r => r.json())
        .then(d => setPrevVerse(d.verse || null))
        .catch(() => {});
  }, [mistake.verseKey]);

  const handleSuccess = () => {
    const newCount = (mistake.successCount || 0) + 1;
    const isResolved = newCount >= required;
    updateMistake(mistake.id, { successCount: newCount, resolved: isResolved });
    const u = refresh();
    if (u) setMistake(u);
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
  const errType = ERROR_TYPES.find(t => t.id === mistake.type);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
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
              <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${i < successCount ? 'var(--green)' : 'var(--border2)'}`, background: i < successCount ? 'var(--green)' : 'transparent', transition: 'all 0.3s' }} />
            ))}
          </div>
        </div>
        {successCount > 0 && (
          <div className='progress' style={{ marginTop: 9 }}>
            <div className='progress-bar' style={{ width: `${(successCount / required) * 100}%` }} />
          </div>
        )}
      </div>

      {result && (
        <div className='overlay anim-fade-in' style={{ zIndex: 200 }}>
          <div className='card anim-fade-up' style={{ padding: '36px 24px', maxWidth: 360, width: 'calc(100% - 32px)', textAlign: 'center' }}>
            <div style={{ width: 76, height: 76, borderRadius: '20px', background: mistake.resolved ? 'var(--green-bg)' : result === 'success' ? 'var(--green-bg)' : 'var(--red-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>{mistake.resolved ? <Star size={36} color='var(--green)' /> : result === 'success' ? <CheckCircle size={36} color='var(--green)' /> : <XCircle size={36} color='var(--red2)' />}</div>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 7 }}>{mistake.resolved ? 'أحسنت! اكتملت المراجعة 🎉' : result === 'success' ? 'ممتاز! استمر' : 'حاول مجدداً'}</h2>
            <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginBottom: 18 }}>{mistake.resolved ? `تم حل الخطأ بعد ${required} مراجعات` : result === 'success' ? `${successCount}/${required}` : 'حاول مرة أخرى'}</p>
            <div style={{ display: 'flex', gap: 9 }}>
              {mistake.resolved ? (
                <button className='btn btn-primary btn-md' style={{ flex: 1 }} onClick={onDone}>
                  العودة
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

      <div style={{ flex: 1, padding: '18px 16px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 14px', borderRadius: '11px', background: `${errType?.color || 'var(--red2)'}14`, border: `1px solid ${errType?.color || 'var(--red2)'}28`, marginBottom: 14 }}>
          <XCircle size={15} color={errType?.color || 'var(--red2)'} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: errType?.color || 'var(--red2)' }}>{TYPE_LBL[mistake.type]}</span>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {hints.map((h, i) => (
            <span key={i} style={{ fontSize: 12, padding: '5px 11px', borderRadius: '9px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', color: 'var(--gold2)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Lightbulb size={10} color='var(--gold2)' /> {h}
            </span>
          ))}
        </div>
        {prevVerse && (
          <div style={{ background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', borderRadius: 'var(--r-lg)', padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--gold2)', marginBottom: 5 }}>الآية السابقة</div>
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
              <div className={showVerse ? 'verse-revealed' : 'verse-hidden'} style={{ width: '100%' }}>
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
        <button className='btn btn-md' style={{ width: '100%', marginBottom: 11, gap: 7, background: showVerse ? 'var(--green-bg)' : 'var(--bg2)', color: showVerse ? 'var(--green)' : 'var(--ink2)', border: `1px solid ${showVerse ? 'var(--green-border)' : 'var(--border)'}` }} onClick={() => setShowVerse(!showVerse)}>
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
      </div>
    </div>
  );
}

// ─── Calendar Screen ──────────────────────────────────────────────────────────
function CalendarScreen({ onStartReview }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [schedule, setSchedule] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showDistModal, setShowDistModal] = useState(false);
  const [editItem, setEditItem] = useState(null);

  const load = () => setSchedule(getSchedule());
  useEffect(() => {
    load();
  }, []);

  const year = currentMonth.getFullYear(),
    month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7;
  const today = new Date(),
    todayStr = today.toISOString().split('T')[0];

  const schedMap = {};
  schedule.forEach(s => {
    if (!schedMap[s.date]) schedMap[s.date] = [];
    schedMap[s.date].push(s);
  });

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const dayNames = ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'];
  const getDayStr = d => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const upcoming = schedule
    .filter(s => s.date >= todayStr && !s.completed)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  const displayDate = selected || todayStr;
  const dayPlans = schedMap[displayDate] || [];

  return (
    <div className='page-content'>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 3 }}>جدول المراجعة</h1>
          <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>خططك اليومية للمراجعة</p>
        </div>
        <button className='btn btn-primary btn-sm' style={{ gap: 5 }} onClick={() => setShowDistModal(true)}>
          <Zap size={14} /> توزيع ذكي
        </button>
      </div>

      <div className='card' style={{ padding: 14, marginBottom: 16 }}>
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
            const d = i + 1,
              dStr = getDayStr(d);
            const plans = schedMap[dStr] || [];
            const hasPlan = plans.length > 0;
            const allDone = hasPlan && plans.every(p => p.completed);
            const isToday = dStr === todayStr;
            const isPast = new Date(year, month, d) < today && !isToday;
            const isSelected = selected === dStr;

            let cls = 'cal-day';
            if (isToday) cls += ' today';
            else if (allDone) cls += ' completed';
            else if (hasPlan) cls += ' has-task';
            else if (isPast) cls += ' past';

            return (
              <div key={d} className={cls} style={{ outline: isSelected ? '2px solid var(--green)' : 'none', outlineOffset: 1 }} onClick={() => setSelected(isSelected ? null : dStr)}>
                <span style={{ fontSize: 12, fontWeight: isToday ? 900 : hasPlan ? 700 : 400 }}>{d}</span>
                {hasPlan && !isToday && <div className='cal-dot' style={{ background: allDone ? 'var(--ink4)' : undefined }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      <div style={{ marginBottom: 18 }}>
        <div className='divider' style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 700 }}>{displayDate === todayStr && !selected ? 'اليوم' : formatDate(displayDate)}</span>
        </div>
        {dayPlans.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {dayPlans.map(plan => (
              <div
                key={plan.id}
                className='card'
                style={{
                  padding: '14px 16px',
                  borderColor: plan.completed ? 'var(--border)' : 'var(--green-border)',
                  background: plan.completed ? 'var(--bg2)' : 'var(--green-bg)',
                  opacity: plan.completed ? 0.65 : 1,
                }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>{plan.completed ? <span className='badge badge-green'>✓ مكتملة</span> : <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>🔄 مراجعة</span>}</div>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>
                      صفحات {plan.from} – {plan.to}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink4)' }}>{plan.to - plan.from + 1} صفحة</div>
                  </div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    {!plan.completed && (
                      <button className='btn btn-primary btn-sm' onClick={() => onStartReview(plan.from, plan.to, plan.id)}>
                        ابدأ
                      </button>
                    )}
                    <button
                      className='btn btn-ghost btn-sm'
                      style={{ padding: '7px 9px' }}
                      onClick={() => {
                        updateScheduleItem(plan.id, { completed: !plan.completed });
                        load();
                      }}>
                      {plan.completed ? <RefreshCw size={13} /> : <CheckSquare size={13} />}
                    </button>
                    <button
                      className='btn btn-icon'
                      style={{ width: 32, height: 32 }}
                      onClick={() => {
                        deleteScheduleItem(plan.id);
                        load();
                      }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <Calendar size={30} color='var(--ink4)' style={{ marginBottom: 9 }} />
            <div style={{ fontSize: 13.5, color: 'var(--ink4)', marginBottom: 10 }}>لا خطة لهذا اليوم</div>
            <button className='btn btn-primary btn-sm' onClick={() => setShowDistModal(true)} style={{ gap: 5 }}>
              <Zap size={13} /> إنشاء جدول
            </button>
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div>
          <div className='section-label' style={{ marginBottom: 8 }}>
            القادمة قريباً
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {upcoming.map(s => (
              <div key={s.id} className='card' style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                    صفحات {s.from} – {s.to}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink4)', marginTop: 2 }}>
                    {formatDate(s.date)} · {s.to - s.from + 1} صفحة
                  </div>
                </div>
                <button className='btn btn-primary btn-sm' onClick={() => onStartReview(s.from, s.to, s.id)}>
                  ابدأ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDistModal && (
        <SmartDistributionModal
          onSave={items => {
            items.forEach(item => saveScheduleItem(item));
            load();
            setShowDistModal(false);
          }}
          onClose={() => setShowDistModal(false)}
        />
      )}
    </div>
  );
}

// ─── Smart Distribution Modal (simplified) ───────────────────────────────────
function SmartDistributionModal({ onSave, onClose }) {
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(30);
  const [days, setDays] = useState(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [preview, setPreview] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  const pagesPerDay = days > 0 ? Math.ceil((endPage - startPage + 1) / days) : 0;
  const totalPages = Math.max(0, endPage - startPage + 1);

  const generatePreview = () => {
    if (startPage > endPage) return;
    const items = generateReviewSchedule({ startPage, endPage, days, startDate });
    setPreview(items);
    setShowPreview(true);
  };

  return (
    <div className='overlay' onClick={onClose}>
      <div className='sheet' style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className='sheet-handle' />
        <div className='sheet-header'>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={20} color='var(--green)' />
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 17 }}>التوزيع الذكي</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)' }}>توزيع صفحات المراجعة على الأيام</div>
            </div>
          </div>
        </div>
        <div className='sheet-body'>
          {!showPreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Summary */}
              <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'var(--green-bg)', border: '1px solid var(--green-border)', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--green)' }}>
                  {pagesPerDay} صفحة/يوم · {totalPages} صفحة إجمالاً
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 2 }}>موزعة على {days} يوم</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>من صفحة</label>
                  <input type='number' min={1} max={604} value={startPage} onChange={e => setStartPage(Number(e.target.value))} className='input' style={{ textAlign: 'center', fontWeight: 900, fontSize: 20, color: 'var(--green)' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>إلى صفحة</label>
                  <input type='number' min={1} max={604} value={endPage} onChange={e => setEndPage(Number(e.target.value))} className='input' style={{ textAlign: 'center', fontWeight: 900, fontSize: 20, color: 'var(--green)' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)' }}>عدد الأيام</label>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--green)' }}>{days} يوم</span>
                </div>
                <input type='range' dir='ltr' min={1} max={60} step={1} value={days} onChange={e => setDays(Number(e.target.value))} style={{ background: `linear-gradient(to left, var(--bg3) ${100 - ((days - 1) / 59) * 100}%, var(--green) ${100 - ((days - 1) / 59) * 100}%)` }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink4)', marginTop: 2 }}>
                  <span>1</span>
                  <span>60</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 6 }}>تاريخ البداية</label>
                <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} className='input' />
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div className='stat-card' style={{ flex: 1, padding: '11px 10px' }}>
                  <div className='stat-num' style={{ color: 'var(--green)', fontSize: 22 }}>
                    {preview.length}
                  </div>
                  <div className='stat-lbl'>أيام</div>
                </div>
                <div className='stat-card' style={{ flex: 1, padding: '11px 10px' }}>
                  <div className='stat-num' style={{ color: 'var(--gold2)', fontSize: 22 }}>
                    {totalPages}
                  </div>
                  <div className='stat-lbl'>صفحة</div>
                </div>
                <div className='stat-card' style={{ flex: 1, padding: '11px 10px' }}>
                  <div className='stat-num' style={{ color: 'var(--ink)', fontSize: 22 }}>
                    {pagesPerDay}
                  </div>
                  <div className='stat-lbl'>صفحة/يوم</div>
                </div>
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {preview.slice(0, 20).map((item, i) => (
                  <div key={i} style={{ padding: '9px 12px', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        صفحات {item.from} – {item.to}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink4)', marginTop: 1 }}>{item.to - item.from + 1} صفحة</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700 }}>{new Date(item.date).toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                  </div>
                ))}
                {preview.length > 20 && <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink4)', padding: 8 }}>و{preview.length - 20} يوم آخر...</div>}
              </div>
            </>
          )}
        </div>
        <div className='sheet-footer' style={{ display: 'flex', gap: 10 }}>
          {showPreview ? (
            <>
              <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={() => setShowPreview(false)}>
                ← تعديل
              </button>
              <button className='btn btn-primary btn-md' style={{ flex: 2 }} onClick={() => onSave(preview)}>
                <CheckCircle size={14} /> حفظ ({preview.length} يوم)
              </button>
            </>
          ) : (
            <>
              <button className='btn btn-ghost btn-md' style={{ flex: 1 }} onClick={onClose}>
                إلغاء
              </button>
              <button className='btn btn-primary btn-md' style={{ flex: 2 }} disabled={startPage > endPage} onClick={generatePreview}>
                <Zap size={14} /> معاينة الجدول
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Quarters Screen (Hizb/Rub el Hizb only) ─────────────────────────────────
function QuartersScreen({ onPlayAudio, settings, playingKey }) {
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

  // Extract only rub el hizb change points (where ۞ appears in mushaf)
  const getRubMarkers = vv => {
    if (!vv || vv.length === 0) return [];
    const markers = [];
    let lastRub = null;
    vv.forEach(v => {
      const rubNum = v.rub_el_hizb_number;
      if (rubNum && rubNum !== lastRub) {
        const rubInHizb = rubNum % 4;
        const hizbNum = Math.ceil(rubNum / 4);
        let label = '';
        switch (rubInHizb) {
          case 1:
            label = `الحزب ${hizbNum} · الربع الأول`;
            break;
          case 2:
            label = `الحزب ${hizbNum} · النصف`;
            break;
          case 3:
            label = `الحزب ${hizbNum} · ثلاثة أرباع`;
            break;
          case 0:
            label = `نهاية الحزب ${hizbNum}`;
            break;
          default:
            label = `ربع ${rubNum}`;
        }
        markers.push({ ...v, label, hizbNum, rubInHizb });
        lastRub = rubNum;
      }
    });
    return markers;
  };

  const filtered = surahs.filter(s => s.name_arabic?.includes(search) || s.name_simple?.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search));

  const markers = selected && verses.length ? getRubMarkers(verses) : [];

  return (
    <div className='page-content'>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 3 }}>أرباع الأحزاب</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>مواضع علامة ۞ في كل سورة</p>
      </div>

      <div style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', marginBottom: 14, fontSize: 12.5, color: 'var(--gold2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: "var(--font-amiri),serif", fontSize: 24, lineHeight: 1 }}>۞</span>
        <span>علامة ربع الحزب — تُقسّم القرآن إلى 240 جزءاً للمراجعة</span>
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
            <button style={{ width: '100%', padding: '13px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: selected?.id === surah.id ? 'var(--green-bg)' : 'var(--surface)', border: `1px solid ${selected?.id === surah.id ? 'var(--green-border)' : 'var(--border)'}`, borderRadius: selected?.id === surah.id && verses.length > 0 ? 'var(--r-lg) var(--r-lg) 0 0' : 'var(--r-lg)', cursor: 'pointer', fontFamily: "'Tajawal',sans-serif", transition: 'all 0.15s' }} onClick={() => handleSelect(surah)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: '9px', background: 'var(--gold-bg)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--gold2)', flexShrink: 0 }}>{surah.id}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "var(--font-amiri),serif" }}>{surah.name_arabic}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink4)' }}>
                    {surah.verses_count} آية · {surah.revelation_place === 'makkah' ? 'مكية' : 'مدنية'}
                  </div>
                </div>
              </div>
              <ChevronDown size={16} color='var(--ink4)' style={{ transform: selected?.id === surah.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            {selected?.id === surah.id && (
              <div className='card' style={{ borderRadius: '0 0 var(--r-lg) var(--r-lg)', borderTop: 'none', padding: '14px' }}>
                {loadingV ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} className='skel' style={{ height: 44 }} />
                    ))}
                  </div>
                ) : markers.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--ink4)', padding: '18px 0', fontSize: 13 }}>
                    <span style={{ fontFamily: "var(--font-amiri),serif", fontSize: 28, display: 'block', marginBottom: 8, opacity: 0.4 }}>۞</span>
                    لا توجد علامات حزب داخل هذه السورة
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink4)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: "var(--font-amiri),serif", fontSize: 16, color: 'var(--gold2)' }}>۞</span>
                      {markers.length} موضع في سورة {surah.name_arabic}
                    </div>
                    {markers.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '11px 13px',
                          borderRadius: 'var(--r-md)',
                          marginBottom: 7,
                          background: playingKey === m.verse_key ? 'var(--green-bg)' : 'var(--surface2)',
                          border: `1px solid ${playingKey === m.verse_key ? 'var(--green-border)' : 'var(--border)'}`,
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <span style={{ fontFamily: "var(--font-amiri),serif", fontSize: 20, color: 'var(--gold2)', lineHeight: 1 }}>۞</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-border)', padding: '2px 8px', borderRadius: '999px' }}>{m.label}</span>
                            <span className='badge badge-gray'>آية {m.verse_number}</span>
                          </div>
                          <div className='quran-text' style={{ fontSize: 15, lineHeight: 1.9, color: 'var(--ink)' }}>
                            {m.text_uthmani?.slice(0, 80)}
                            {m.text_uthmani?.length > 80 ? '…' : ''}
                          </div>
                        </div>
                        <button
                          className='btn btn-ghost btn-sm'
                          style={{ flexShrink: 0, padding: '5px 9px' }}
                          onClick={() => {
                            if (!m.verse_key) return;
                            const [s, a] = m.verse_key.split(':');
                            onPlayAudio(s, a, m.verse_key, m.text_uthmani);
                          }}>
                          {playingKey === m.verse_key ? <Volume2 size={13} color='var(--green)' /> : <Play size={13} color='var(--gold2)' />}
                        </button>
                      </div>
                    ))}
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

// ─── Settings Screen ──────────────────────────────────────────────────────────
function SettingsScreen({ settings, onChange }) {
  const streak = getStreak();
  const bookmarks = getBookmarks();

  return (
    <div className='page-content'>
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 3 }}>الإعدادات</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink3)' }}>تخصيص التطبيق</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 22 }}>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--gold2)' }}>
            {streak.current}
          </div>
          <div className='stat-lbl'>سلسلة الأيام</div>
        </div>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--green)' }}>
            {getSessions().length}
          </div>
          <div className='stat-lbl'>جلسة</div>
        </div>
        <div className='stat-card'>
          <div className='stat-num' style={{ color: 'var(--blue)' }}>
            {bookmarks.length}
          </div>
          <div className='stat-lbl'>علامة</div>
        </div>
      </div>

      {/* Palette */}
      <div style={{ marginBottom: 22 }}>
        <div className='section-label' style={{ marginBottom: 10 }}>
          لون التطبيق
        </div>
        <div className='card' style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {Object.entries(PALETTES).map(([key, p]) => {
              const col = p.light.green;
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={() => onChange({ palette: key })}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: col, border: `3px solid ${settings.palette === key ? 'var(--ink)' : 'transparent'}`, transition: 'all 0.15s', transform: settings.palette === key ? 'scale(1.15)' : 'scale(1)' }} />
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: settings.palette === key ? 'var(--ink)' : 'var(--ink4)' }}>{p.name}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <SettingsSection title='المظهر والعرض'>
        <SettingRow label='الوضع الداكن' sub='تغيير مظهر التطبيق'>
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
              <button key={s.id} onClick={() => onChange({ quranFontSize: s.id })} style={{ width: 34, height: 34, borderRadius: '9px', border: `1.5px solid ${settings.quranFontSize === s.id ? 'var(--green)' : 'var(--border2)'}`, background: settings.quranFontSize === s.id ? 'var(--green-bg)' : 'transparent', color: settings.quranFontSize === s.id ? 'var(--green)' : 'var(--ink3)', fontWeight: 700, fontSize: s.size - 2, cursor: 'pointer', fontFamily: "var(--font-amiri),serif" }}>
                {s.l}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow label='ألوان التجويد' sub='تلوين الحروف حسب أحكام التجويد'>
          <label className='switch'>
            <input type='checkbox' checked={settings.tajweedColors !== false} onChange={e => onChange({ tajweedColors: e.target.checked })} />
            <div className='switch-track' />
            <div className='switch-thumb' />
          </label>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title='إعدادات المراجعة'>
        <SettingRow label='عدد مرات التحقق' sub={`يحتاج ${settings.requiredChecks || 3} نجاحات لحل الخطأ`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <StepButton dir='dec' onClick={() => onChange({ requiredChecks: Math.max(1, (settings.requiredChecks || 3) - 1) })} />
            <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--green)', minWidth: 26, textAlign: 'center' }}>{settings.requiredChecks || 3}</span>
            <StepButton dir='inc' onClick={() => onChange({ requiredChecks: Math.min(10, (settings.requiredChecks || 3) + 1) })} />
          </div>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title='التفسير والتلاوة'>
        <SettingRow label='التفسير الافتراضي' sub='يُعرض عند الضغط على أي آية'>
          <select value={settings.defaultTafsir || '91'} onChange={e => onChange({ defaultTafsir: e.target.value })} className='input' style={{ width: 'auto', padding: '7px 11px', fontSize: 13 }}>
            {TAFSIR_OPTIONS.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </SettingRow>
        <SettingRow label='القارئ الافتراضي' sub='للاستماع عبر المشغّل المدمج'>
          <select value={settings.reciter || 'ar.alafasy'} onChange={e => onChange({ reciter: e.target.value })} className='input' style={{ width: 'auto', padding: '7px 11px', fontSize: 13, maxWidth: 155 }}>
            {RECITERS.map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </SettingRow>
      </SettingsSection>

      <SettingsSection title='إدارة البيانات'>
        <SettingRow label='تصدير البيانات' sub='حفظ نسخة احتياطية'>
          <button
            className='btn btn-ghost btn-sm'
            onClick={() => {
              const data = { mistakes: getMistakes(), sessions: getSessions(), schedule: getSchedule(), bookmarks: getBookmarks() };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'quran-backup.json';
              a.click();
            }}>
            تصدير
          </button>
        </SettingRow>
        <SettingRow label='إعادة تعيين الأخطاء' sub='حذف جميع الأخطاء المسجّلة'>
          <button
            className='btn btn-red-ghost btn-sm'
            onClick={() => {
              if (confirm('حذف جميع الأخطاء؟')) {
                localStorage.removeItem('q_mistakes');
                window.location.reload();
              }
            }}>
            حذف
          </button>
        </SettingRow>
        <SettingRow label='إعادة تعيين الجدول' sub='حذف جميع خطط المراجعة'>
          <button
            className='btn btn-red-ghost btn-sm'
            onClick={() => {
              if (confirm('حذف جميع الخطط؟')) {
                localStorage.removeItem('q_schedule');
                window.location.reload();
              }
            }}>
            حذف
          </button>
        </SettingRow>
      </SettingsSection>

      <div className='card-flat' style={{ padding: 18, textAlign: 'center', marginBottom: 20 }}>
        <div style={{ width: 52, height: 52, borderRadius: '14px', background: 'linear-gradient(135deg,var(--green),var(--green2))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 12px var(--green-glow)' }}>
          <BookOpen size={22} color='white' />
        </div>
        <div style={{ fontFamily: "var(--font-amiri),serif", fontSize: 22, color: 'var(--gold2)', marginBottom: 5 }}>مراجع القرآن</div>
        <div style={{ fontSize: 12, color: 'var(--ink4)', fontFamily: "var(--font-amiri),serif", lineHeight: 2 }}>﴿ إِنَّا نَحْنُ نَزَّلْنَا الذِّكْرَ وَإِنَّا لَهُ لَحَافِظُونَ ﴾</div>
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
    <button onClick={onClick} style={{ width: 30, height: 30, borderRadius: '8px', background: 'var(--bg2)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 900, fontSize: 18, fontFamily: "'Tajawal',sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink2)' }}>
      {dir === 'inc' ? '+' : '−'}
    </button>
  );
}
