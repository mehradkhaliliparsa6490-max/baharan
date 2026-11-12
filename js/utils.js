/* ============================================================
   utils.js — ابزارهای عمومی: انتخابگر، اعداد، تاریخ، Toast
   ============================================================ */
window.Baharan = window.Baharan || {};

(function (B) {
  'use strict';

  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const toFa = v => String(v ?? '').replace(/\d/g, d => FA_DIGITS[+d]);
  const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /* تبدیل امن ورودی به عدد (پشتیبانی از ارقام فارسی) */
  const toNum = v => {
    const s = String(v ?? '')
      .replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
      .replace(/[^\d.-]/g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const money = v => toFa(toNum(v).toLocaleString('en-US')).replace(/,/g, '٬');

  const normDigits = s => String(s ?? '')
    .replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
    .replace(/[^\d]/g, '');

  /* ---------- تاریخ: میلادی ↔ شمسی ---------- */
  const JMONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

  function todayISO() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function tsToISO(ts) {
    const d = new Date(ts);
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function toJalali(gy, gm, gd) {
    const gdm = [0,31,59,90,120,151,181,212,243,273,304,334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + gdm[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461);   days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
  }

  /* تبدیل شمسی به میلادی */
  function toGregorian(jy, jm, jd) {
    var gy = (jy <= 979) ? 621 : 1600;
    jy -= (jy <= 979) ? 0 : 979;
    var days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    gy += 400 * Math.floor(days / 146097); days %= 146097;
    if (days > 36524) {
      gy += 100 * Math.floor(--days / 36524); days %= 36524;
      if (days >= 365) days++;
    }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    gy += Math.floor((days - 1) / 365); if (days > 365) days = (days - 1) % 365;
    var gd = days + 1;
    var sal_a = [0, 31, ((gy % 4 == 0 && gy % 100 != 0) || (gy % 400 == 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    var gm = 0;
    for (gm = 1; gm <= 12 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
    return [gy, gm, gd];
  }

  /* نمایش تاریخ ISO میلادی به شمسی (برای جداول) */
  function jalali(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '—';
    const [jy, jm, jd] = toJalali(+m[1], +m[2], +m[3]);
    return `${toFa(jd)} ${JMONTHS[jm - 1]} ${toFa(jy)}`;
  }

  /* تبدیل تاریخ ISO میلادی به رشته شمسی برای input */
  function gregorianToJalaliStr(iso) {
    if (!iso) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const [jy, jm, jd] = toJalali(+m[1], +m[2], +m[3]);
    return toFa(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`);
  }

  /* تبدیل رشته شمسی (۱۴۰۳/۰۱/۰۱) به ISO میلادی (YYYY-MM-DD) */
  function jalaliToGregorianIso(str) {
    if (!str) return todayISO();
    const s = String(str).replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)));
    const parts = s.split(/[\/\-]/).map(p => p.trim()).filter(Boolean);
    if (parts.length === 3) {
      const jy = parseInt(parts[0], 10);
      const jm = parseInt(parts[1], 10);
      const jd = parseInt(parts[2], 10);
      if (jy > 1300 && jy < 1500 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= 31) {
        const [gy, gm, gd] = toGregorian(jy, jm, jd);
        return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
      }
    }
    return todayISO();
  }

  /* تاریخ امروز به شمسی برای input */
  function todayJalaliInput() {
    return gregorianToJalaliStr(todayISO());
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  B.utils = {
    $, $$, toFa, esc, toNum, money, normDigits, uid,
    todayISO, tsToISO, jalali, toGregorian, toJalali,
    gregorianToJalaliStr, jalaliToGregorianIso, todayJalaliInput,
    toast
  };
})(window.Baharan);