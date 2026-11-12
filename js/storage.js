/* ============================================================
   storage.js — ذخیره‌سازی در localStorage + ensureCustomer
   ============================================================ */
(function (B) {
  'use strict';

  const { normDigits, uid, toast } = B.utils;

  const STORAGE_KEY = 'baharan_office_v1';

  function defaultDB() {
    return {
      customers: [], services: [], finances: [], invoices: [],
      settings: {
        prefix: 'BH',
        next: 1001,
        cardNumber: '',
        cardHolder: ''
      }
    };
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultDB();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultDB();
      const db = Object.assign(defaultDB(), parsed);
      ['customers','services','finances','invoices'].forEach(k => {
        if (!Array.isArray(db[k])) db[k] = [];
      });
      if (!db.settings || typeof db.settings !== 'object')
        db.settings = { prefix: 'BH', next: 1001, cardNumber: '', cardHolder: '' };
      if (typeof db.settings.cardNumber !== 'string') db.settings.cardNumber = '';
      if (typeof db.settings.cardHolder !== 'string') db.settings.cardHolder = '';
      return db;
    } catch (_) { return defaultDB(); }
  }

  function saveDB() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(B.db)); }
    catch (_) { toast('ذخیره اطلاعات در مرورگر ممکن نشد'); }
  }

  function ensureCustomer(name, phone, address) {
    const p = normDigits(phone);
    let c = null;
    if (p) c = B.db.customers.find(x => normDigits(x.phone) === p);

    if (c) {
      if (!c.name && name) c.name = name;
      if (address && !c.address) c.address = address;
      return { customer: c, created: false };
    }

    c = {
      id: uid(), name: name || 'بدون نام', phone: phone || '',
      address: address || '', createdAt: Date.now(), consumables: []
    };
    B.db.customers.push(c);
    return { customer: c, created: true };
  }

  B.db = loadDB();

  B.storage = { STORAGE_KEY, defaultDB, loadDB, saveDB, ensureCustomer };
})(window.Baharan);