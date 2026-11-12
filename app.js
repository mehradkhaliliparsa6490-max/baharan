/* ============================================================
   دفتر فنی و مهندسی بهاران تصفیه — منطق برنامه
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     ابزارهای عمومی
     ============================================================ */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
  const toFa  = v => String(v ?? '').replace(/\d/g, d => FA_DIGITS[+d]);
  const uid   = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  const toNum = v => {
    const n = Number(String(v ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const money = v => toFa(toNum(v).toLocaleString('en-US')).replace(/,/g, '٬');

  const normDigits = s => String(s ?? '')
    .replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d)))
    .replace(/[^\d]/g, '');

  /* ============================================================
     تاریخ: میلادی ← شمسی
     ============================================================ */
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
    let days = (365 * gy)
      + Math.floor((gy2 + 3) / 4)
      - Math.floor((gy2 + 99) / 100)
      + Math.floor((gy2 + 399) / 400)
      - 80 + gd + gdm[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461);   days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
  }

  function jalali(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '—';
    const [jy, jm, jd] = toJalali(+m[1], +m[2], +m[3]);
    return `${toFa(jd)} ${JMONTHS[jm - 1]} ${toFa(jy)}`;
  }

  /* ============================================================
     Toast
     ============================================================ */
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  /* ============================================================
     ذخیره‌سازی
     ============================================================ */
  const STORAGE_KEY = 'baharan_office_v1';

  function defaultDB() {
    return { customers: [], services: [], finances: [], invoices: [],
             settings: { prefix: 'BH', next: 1001 } };
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
      if (!db.settings || typeof db.settings !== 'object') db.settings = { prefix: 'BH', next: 1001 };
      return db;
    } catch (_) { return defaultDB(); }
  }

  let db = loadDB();

  function saveDB() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }
    catch (_) { toast('ذخیره اطلاعات در مرورگر ممکن نشد'); }
  }

  /* ============================================================
     مودال
     ============================================================ */
  function openModal(title, bodyHTML, onMount) {
    $('#modalTitle').textContent = title;
    $('#modalBody').innerHTML = bodyHTML;
    $('#modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    if (typeof onMount === 'function') onMount();
  }
  function closeModal() {
    $('#modal').classList.add('hidden');
    $('#modalBody').innerHTML = '';
    document.body.style.overflow = '';
  }
  function bindEnter(form, btn) {
    if (!form || !btn) return;
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.type !== 'checkbox') {
        e.preventDefault();
        btn.click();
      }
    });
  }

  /* ============================================================
     مشتری: پیدا کردن یا ایجاد خودکار
     ============================================================ */
  function ensureCustomer(name, phone, address) {
    const p = normDigits(phone);
    let c = null;
    if (p) c = db.customers.find(x => normDigits(x.phone) === p);
    if (c) {
      if (!c.name && name) c.name = name;
      if (address && !c.address) c.address = address;
      return { customer: c, created: false };
    }
    c = { id: uid(), name: name || 'بدون نام', phone: phone || '',
          address: address || '', createdAt: Date.now(), consumables: [] };
    db.customers.push(c);
    return { customer: c, created: true };
  }

  /* ============================================================
     رندر: select و datalist مشتری
     ============================================================ */
  function renderCustomerOptions() {
    const sel = $('#invCustomer');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">— انتخاب مشتری —</option>' +
        db.customers.map(c =>
          `<option value="${c.id}">${esc(c.name)}${c.phone ? ' — ' + esc(c.phone) : ''}</option>`
        ).join('');
      if (db.customers.some(c => c.id === cur)) sel.value = cur;
    }
    const dl = $('#customerNames');
    if (dl) {
      const names = [...new Set(db.customers.map(c => c.name).filter(Boolean))];
      dl.innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
    }
  }

  /* ============================================================
     رندر: جدول مشتریان
     ============================================================ */
  function renderCustomers() {
    const tbody = $('#customersBody');
    if (!tbody) return;
    const q = ($('#customerSearch')?.value || '').trim().toLowerCase();
    const rows = db.customers.filter(c =>
      !q || [c.name, c.phone, c.address].join(' ').toLowerCase().includes(q)
    );
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">مشتری‌ای ثبت نشده است.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((c, i) => {
      const serviceCount = db.services.filter(s => s.customerId === c.id).length;
      const consCount = (c.consumables || []).length;
      return `
        <tr>
          <td>${toFa(i + 1)}</td>
          <td><strong>${esc(c.name)}</strong></td>
          <td>${esc(c.phone || '—')}</td>
          <td class="addr" title="${esc(c.address || '')}">${esc(c.address || '—')}</td>
          <td>${c.createdAt ? jalali(tsToISO(c.createdAt)) : '—'}</td>
          <td>${toFa(serviceCount)}</td>
          <td>${toFa(consCount)}</td>
          <td class="actions">
            <button class="btn ghost sm" data-action="edit-customer" data-id="${c.id}">ویرایش</button>
            <button class="btn ghost sm" data-action="cons-customer" data-id="${c.id}">اقلام مصرفی</button>
            <button class="btn danger sm" data-action="del-customer" data-id="${c.id}">حذف</button>
          </td>
        </tr>`;
    }).join('');
  }

  /* ============================================================
     رندر: جدول خدمات (اولویت بر اساس زمان ثبت)
     ============================================================ */
  function renderServices() {
    const tbody = $('#servicesBody');
    if (!tbody) return;
    const filter = $('#serviceFilter')?.value || 'all';
    const q = ($('#serviceSearch')?.value || '').trim().toLowerCase();

    let list = [...db.services];
    list.sort((a, b) => {
      const doneA = a.done ? 1 : 0;
      const doneB = b.done ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });
    if (filter === 'pending') list = list.filter(s => !s.done);
    if (filter === 'done')    list = list.filter(s => s.done);
    if (q) list = list.filter(s => [s.name, s.phone, s.service, s.note].join(' ').toLowerCase().includes(q));

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">خدمتی یافت نشد.</td></tr>';
      return;
    }
    let rank = 0;
    tbody.innerHTML = list.map(s => {
      const badge = s.done ? '<span class="badge ok">انجام‌شده</span>' : '<span class="badge wait">در انتظار</span>';
      const priority = s.done ? '<span class="muted">—</span>' : `<span class="rank">${toFa(++rank)}</span>`;
      const source = s.source === 'online' ? '<span class="badge online">آنلاین</span>' : '<span class="badge manual">دستی</span>';
      const toggleLabel = s.done ? 'بازگشت به انتظار' : 'انجام شد';
      const toggleClass = s.done ? 'ghost' : 'ok';
      return `
        <tr>
          <td>${priority}</td>
          <td><strong>${esc(s.name)}</strong></td>
          <td>${esc(s.phone || '—')}</td>
          <td class="wrap-cell">${esc(s.service)}</td>
          <td>${jalali(s.date)}</td>
          <td>${badge}</td>
          <td>${source}</td>
          <td class="actions">
            <button class="btn ${toggleClass} sm" data-action="toggle-service" data-id="${s.id}">${toggleLabel}</button>
            <button class="btn ghost sm" data-action="edit-service" data-id="${s.id}">ویرایش</button>
            <button class="btn danger sm" data-action="del-service" data-id="${s.id}">حذف</button>
          </td>
        </tr>`;
    }).join('');
  }

  /* ============================================================
     رندر: جدول مالی
     ============================================================ */
  function renderFinance() {
    const tbody = $('#financeBody');
    if (!tbody) return;
    const q = ($('#financeSearch')?.value || '').trim().toLowerCase();

    let list = [...db.finances].sort((a, b) => {
      const d = String(b.date || '').localeCompare(String(a.date || ''));
      return d !== 0 ? d : (b.createdAt || 0) - (a.createdAt || 0);
    });
    if (q) list = list.filter(f => [f.title, f.customerName, f.note].join(' ').toLowerCase().includes(q));

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">درآمدی ثبت نشده است.</td></tr>';
    } else {
      tbody.innerHTML = list.map(f => {
        const source = f.source === 'invoice' ? '<span class="badge online">فاکتور</span>' : '<span class="badge manual">دستی</span>';
        const del = f.source === 'invoice'
          ? `<button class="btn ghost sm" data-action="del-income-invoice" data-id="${f.id}">حذف</button>`
          : `<button class="btn danger sm" data-action="del-income" data-id="${f.id}">حذف</button>`;
        return `
          <tr>
            <td>${jalali(f.date)}</td>
            <td class="wrap-cell">${esc(f.title)}</td>
            <td>${esc(f.customerName || '—')}</td>
            <td><strong>${money(f.amount)}</strong> تومان</td>
            <td>${source}</td>
            <td class="actions">${del}</td>
          </tr>`;
      }).join('');
    }
    const total = db.finances.reduce((sum, f) => sum + toNum(f.amount), 0);
    const totalEl = $('#financeTotal');
    if (totalEl) totalEl.textContent = money(total) + ' تومان';
  }

  /* ============================================================
     رندر: فاکتورهای صادرشده
     ============================================================ */
  function renderInvoices() {
    const tbody = $('#invoicesBody');
    if (!tbody) return;
    if (!db.invoices.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">فاکتوری صادر نشده است.</td></tr>';
      return;
    }
    tbody.innerHTML = db.invoices.map(inv => `
      <tr>
        <td><strong>${esc(inv.number)}</strong></td>
        <td>${jalali(inv.date)}</td>
        <td>${esc(inv.customerName || '—')}</td>
        <td><strong>${money(inv.total)}</strong> تومان</td>
        <td>${toFa((inv.items || []).length)}</td>
        <td class="actions">
          <button class="btn ghost sm" data-action="view-invoice" data-id="${inv.id}">مشاهده</button>
          <button class="btn ghost sm" data-action="print-invoice" data-id="${inv.id}">چاپ</button>
          <button class="btn danger sm" data-action="del-invoice" data-id="${inv.id}">حذف</button>
        </td>
      </tr>`).join('');
  }

  /* ============================================================
     رندر: داشبورد
     ============================================================ */
  function renderDashboard() {
    const stats = $('#stats');
    if (stats) {
      const pending = db.services.filter(s => !s.done).length;
      const done = db.services.filter(s => s.done).length;
      const totalIncome = db.finances.reduce((sum, f) => sum + toNum(f.amount), 0);
      stats.innerHTML = `
        <div class="stat"><div class="label">تعداد مشتریان</div><div class="num">${toFa(db.customers.length)} <small>نفر</small></div></div>
        <div class="stat"><div class="label">خدمات در انتظار</div><div class="num">${toFa(pending)} <small>مورد</small></div></div>
        <div class="stat"><div class="label">خدمات انجام‌شده</div><div class="num">${toFa(done)} <small>مورد</small></div></div>
        <div class="stat"><div class="label">مجموع درآمد</div><div class="num">${money(totalIncome)} <small>تومان</small></div></div>`;
    }
    const dashServices = $('#dashServices');
    if (dashServices) {
      const pendingList = db.services.filter(s => !s.done)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).slice(0, 5);
      dashServices.innerHTML = pendingList.length
        ? pendingList.map((s, i) => `
            <tr>
              <td><span class="rank">${toFa(i + 1)}</span></td>
              <td>${esc(s.name)}</td>
              <td class="wrap-cell">${esc(s.service)}</td>
              <td>${jalali(s.date)}</td>
            </tr>`).join('')
        : '<tr><td colspan="4" class="empty">نوبت در انتظاری وجود ندارد.</td></tr>';
    }
    const dashFinance = $('#dashFinance');
    if (dashFinance) {
      const lastFin = [...db.finances]
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 5);
      dashFinance.innerHTML = lastFin.length
        ? lastFin.map(f => `
            <tr>
              <td class="wrap-cell">${esc(f.title)}</td>
              <td><strong>${money(f.amount)}</strong></td>
              <td>${jalali(f.date)}</td>
            </tr>`).join('')
        : '<tr><td colspan="3" class="empty">درآمدی ثبت نشده است.</td></tr>';
    }
  }

  /* ============================================================
     رندر: تنظیمات
     ============================================================ */
  function renderSettings() {
    const p = $('#setPrefix');
    if (p && document.activeElement !== p) p.value = db.settings.prefix;
    const n = $('#setNext');
    if (n && document.activeElement !== n) n.value = db.settings.next;
    const link = $('#publicLinkInput');
    if (link) link.value = publicURL();
    const warn = $('#localWarn');
    if (warn) warn.classList.toggle('hidden', location.protocol !== 'file:');
  }

  /* ============================================================
     فاکتور: ردیف‌ها و محاسبات
     ============================================================ */
  function addItemRow(title = '', qty = 1, price = '') {
    const tbody = $('#itemsBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="i-title" placeholder="شرح خدمت / کالا" value="${esc(title)}"></td>
      <td><input class="i-qty" type="number" min="1" step="1" value="${toFa(qty)}" style="text-align:center"></td>
      <td><input class="i-price" type="number" min="0" step="1000" value="${esc(price)}" placeholder="0"></td>
      <td class="row-total" style="font-weight:700">۰</td>
      <td><button type="button" class="btn danger sm" data-remove-row>حذف</button></td>`;
    tbody.appendChild(tr);
    updateInvoiceTotals();
  }

  function readItems() {
    return $$('#itemsBody tr').map(tr => {
      const t = tr.querySelector('.i-title');
      const q = tr.querySelector('.i-qty');
      const p = tr.querySelector('.i-price');
      if (!t || !q || !p) return null;
      const title = t.value.trim();
      const qty = toNum(q.value);
      const price = toNum(p.value);
      if (!title || qty <= 0) return null;
      return { title, qty, price };
    }).filter(Boolean);
  }

  function updateInvoiceTotals() {
    $$('#itemsBody tr').forEach(tr => {
      const qtyEl = tr.querySelector('.i-qty');
      const priceEl = tr.querySelector('.i-price');
      const totalEl = tr.querySelector('.row-total');
      if (!qtyEl || !priceEl || !totalEl) return;
      totalEl.textContent = money(toNum(qtyEl.value) * toNum(priceEl.value));
    });
    renderInvoicePreview();
  }

  function invoiceHTML(d) {
    const items = Array.isArray(d.items) ? d.items : [];
    const rows = items.length
      ? items.map((it, i) => `
          <tr>
            <td>${toFa(i + 1)}</td>
            <td>${esc(it.title)}</td>
            <td>${toFa(it.qty)}</td>
            <td>${money(it.price)}</td>
            <td>${money(it.qty * it.price)}</td>
          </tr>`).join('')
      : '<tr><td colspan="5" class="empty">آیتمی ثبت نشده است.</td></tr>';
    const discount = toNum(d.discount);
    const tax = toNum(d.tax);
    const subtotal = toNum(d.subtotal);
    const total = toNum(d.total);
    return `
      <div class="inv-head">
        <div>
          <div class="inv-title">فاکتور فروش</div>
          <div class="muted small">دفتر فنی و مهندسی بهاران تصفیه</div>
        </div>
        <div class="inv-meta">
          <div>شماره: <strong>${esc(d.number || '—')}</strong></div>
          <div>تاریخ: <strong>${jalali(d.date)}</strong></div>
        </div>
      </div>
      <div class="inv-customer">
        <div><span class="muted">مشتری:</span> <strong>${esc(d.customerName || '—')}</strong></div>
        <div><span class="muted">شماره تماس:</span> ${esc(d.customerPhone || '—')}</div>
        <div><span class="muted">آدرس:</span> ${esc(d.customerAddress || '—')}</div>
      </div>
      <table class="inv-table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>شرح خدمت / کالا</th>
            <th style="width:70px">تعداد</th>
            <th style="width:130px">قیمت واحد (تومان)</th>
            <th style="width:130px">جمع (تومان)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="inv-summary">
        <div class="row"><span>جمع کل:</span><span>${money(subtotal)} تومان</span></div>
        <div class="row"><span>تخفیف:</span><span>${money(discount)} تومان</span></div>
        <div class="row"><span>مالیات (${toFa(toNum(d.taxPercent))}٪):</span><span>${money(tax)} تومان</span></div>
        <div class="row total"><span>مبلغ قابل پرداخت:</span><span>${money(total)} تومان</span></div>
      </div>
      ${d.note ? `<div class="inv-note">${esc(d.note)}</div>` : ''}
      <div class="inv-sign">مهر و امضا</div>`;
  }

  function renderInvoicePreview() {
    const box = $('#invoicePreview');
    if (!box) return null;
    const customerId = $('#invCustomer')?.value || '';
    const customer = db.customers.find(c => c.id === customerId) || null;
    const items = readItems();
    const subtotal = items.reduce((sum, it) => sum + it.qty * it.price, 0);
    const discount = Math.min(toNum($('#invDiscount')?.value), subtotal);
    const taxPercent = toNum($('#invTax')?.value);
    const tax = Math.round((subtotal - discount) * taxPercent / 100);
    const total = subtotal - discount + tax;
    const data = {
      number: `${db.settings.prefix}-${db.settings.next}`,
      date: $('#invDate')?.value || todayISO(),
      customerName: customer ? customer.name : '—',
      customerPhone: customer ? customer.phone : '',
      customerAddress: customer ? customer.address : '',
      items, subtotal, discount, taxPercent, tax, total,
      note: ($('#invNote')?.value || '').trim()
    };
    box.innerHTML = invoiceHTML(data);
    const totalLive = $('#invTotalLive');
    if (totalLive) totalLive.textContent = money(total) + ' تومان';
    const subtotalEl = $('#invSubtotal');
    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    return data;
  }

  /* ============================================================
     فرم مشتری
     ============================================================ */
  function openCustomerForm(id) {
    const c = id ? db.customers.find(x => x.id === id) : null;
    openModal(c ? 'ویرایش مشتری' : 'ثبت مشتری جدید', `
      <form id="customerForm" novalidate>
        <div class="grid">
          <div>
            <label>نام و نام خانوادگی *</label>
            <input id="cName" value="${esc(c ? c.name : '')}" placeholder="مثلاً علی رضایی">
          </div>
          <div>
            <label>شماره تماس *</label>
            <input id="cPhone" inputmode="tel" value="${esc(c ? c.phone : '')}" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
          </div>
        </div>
        <div style="margin-top:14px">
          <label>آدرس</label>
          <textarea id="cAddress" rows="2" placeholder="آدرس مشتری">${esc(c ? c.address : '')}</textarea>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" id="cSave">ذخیره</button>
          <button type="button" class="btn ghost" data-close>انصراف</button>
        </div>
      </form>
    `, () => {
      const saveBtn = $('#cSave');
      const form = $('#customerForm');
      saveBtn.onclick = () => {
        const name = $('#cName').value.trim();
        const phone = $('#cPhone').value.trim();
        const address = $('#cAddress').value.trim();
        if (!name) return toast('نام مشتری را وارد کنید');
        if (normDigits(phone).length < 8) return toast('شماره تماس معتبر نیست');
        const dup = db.customers.find(x =>
          x.id !== (c ? c.id : null) && normDigits(x.phone) === normDigits(phone));
        if (dup) return toast('این شماره تماس قبلاً ثبت شده است');
        if (c) Object.assign(c, { name, phone, address });
        else db.customers.push({ id: uid(), name, phone, address, createdAt: Date.now(), consumables: [] });
        saveDB();
        closeModal();
        renderAll();
        toast(c ? 'اطلاعات مشتری ویرایش شد' : 'مشتری جدید ثبت شد');
      };
      bindEnter(form, saveBtn);
      $('#cName').focus();
    });
  }

  /* ============================================================
     فرم خدمت
     ============================================================ */
  function openServiceForm(id) {
    const s = id ? db.services.find(x => x.id === id) : null;
    openModal(s ? 'ویرایش خدمت' : 'ثبت خدمت جدید', `
      <form id="serviceForm" novalidate>
        <div class="grid">
          <div>
            <label>نام مشتری *</label>
            <input id="sName" list="customerNames" autocomplete="off"
                   value="${esc(s ? s.name : '')}" placeholder="نام مشتری">
            <datalist id="customerNames"></datalist>
          </div>
          <div>
            <label>شماره تماس *</label>
            <input id="sPhone" inputmode="tel" value="${esc(s ? s.phone : '')}" placeholder="۰۹۱۲۳۴۵۶۷۸۹">
          </div>
          <div>
            <label>خدمت درخواستی *</label>
            <input id="sService" value="${esc(s ? s.service : '')}" placeholder="مثلاً سرویس دستگاه">
          </div>
          <div>
            <label>تاریخ درخواست</label>
            <input id="sDate" type="date" value="${esc(s ? s.date : todayISO())}">
          </div>
        </div>
        <div style="margin-top:14px">
          <label>توضیحات</label>
          <textarea id="sNote" rows="2" placeholder="اختیاری">${esc(s ? (s.note || '') : '')}</textarea>
        </div>
        <label class="check">
          <input type="checkbox" id="sDone" ${s && s.done ? 'checked' : ''}>
          این خدمت انجام شده است
        </label>
        <div class="form-actions">
          <button type="button" class="btn primary" id="sSave">ذخیره</button>
          <button type="button" class="btn ghost" data-close>انصراف</button>
        </div>
      </form>
    `, () => {
      const dl = $('#customerNames');
      if (dl) {
        const names = [...new Set(db.customers.map(c => c.name).filter(Boolean))];
        dl.innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
      }
      $('#sName').addEventListener('input', () => {
        const val = $('#sName').value.trim();
        const found = db.customers.find(c => c.name.trim() === val);
        if (found && found.phone) $('#sPhone').value = found.phone;
      });
      const saveBtn = $('#sSave');
      const form = $('#serviceForm');
      saveBtn.onclick = () => {
        const name = $('#sName').value.trim();
        const phone = $('#sPhone').value.trim();
        const service = $('#sService').value.trim();
        const date = $('#sDate').value || todayISO();
        const note = $('#sNote').value.trim();
        const done = $('#sDone').checked;
        if (!name) return toast('نام مشتری را وارد کنید');
        if (normDigits(phone).length < 8) return toast('شماره تماس معتبر نیست');
        if (!service) return toast('خدمت درخواستی را وارد کنید');
        const { customer, created } = ensureCustomer(name, phone);
        if (s) {
          Object.assign(s, { customerId: customer.id, name, phone, service, date, note, done });
        } else {
          db.services.push({
            id: uid(), customerId: customer.id, name, phone, service, date, note, done,
            source: 'manual', createdAt: Date.now()
          });
        }
        saveDB();
        closeModal();
        renderAll();
        toast(created ? 'خدمت ثبت و مشتری جدید اضافه شد' : (s ? 'خدمت ویرایش شد' : 'خدمت جدید ثبت شد'));
      };
      bindEnter(form, saveBtn);
      $('#sName').focus();
    });
  }

  /* ============================================================
     اقلام مصرفی مشتری
     ============================================================ */
  function openConsumables(customerId) {
    const c = db.customers.find(x => x.id === customerId);
    if (!c) return;
    if (!Array.isArray(c.consumables)) c.consumables = [];
    const rows = c.consumables.length
      ? c.consumables.map((x, i) => `
          <tr>
            <td>${toFa(i + 1)}</td>
            <td class="wrap-cell">${esc(x.title)}</td>
            <td>${esc(x.qty || '—')}</td>
            <td>${jalali(x.date)}</td>
            <td class="wrap-cell">${esc(x.note || '—')}</td>
            <td><button class="btn danger sm" data-del-cons="${x.id}">حذف</button></td>
          </tr>`).join('')
      : '<tr><td colspan="6" class="empty">موردی ثبت نشده است.</td></tr>';
    openModal('اقلام مصرفی مشتری', `
      <div class="muted small" style="margin-bottom:12px">
        مشتری: <strong>${esc(c.name)}</strong>
      </div>
      <div class="table-wrap">
        <table class="mini">
          <thead>
            <tr><th>#</th><th>عنوان</th><th>مقدار</th><th>تاریخ</th><th>توضیح</th><th></th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <form id="consForm" novalidate style="margin-top:16px">
        <div class="grid">
          <div><label>عنوان قلم *</label><input id="csTitle" placeholder="مثلاً فیلتر شنی"></div>
          <div><label>مقدار</label><input id="csQty" placeholder="مثلاً ۲ عدد"></div>
          <div><label>تاریخ</label><input id="csDate" type="date" value="${todayISO()}"></div>
          <div><label>توضیح</label><input id="csNote" placeholder="اختیاری"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" id="csAdd">افزودن قلم</button>
          <button type="button" class="btn ghost" data-close>بستن</button>
        </div>
      </form>
    `, () => {
      $('#csAdd').onclick = () => {
        const title = $('#csTitle').value.trim();
        if (!title) return toast('عنوان قلم را وارد کنید');
        c.consumables.push({
          id: uid(), title,
          qty: $('#csQty').value.trim() || '۱',
          date: $('#csDate').value || todayISO(),
          note: $('#csNote').value.trim()
        });
        saveDB();
        renderCustomers();
        openConsumables(customerId);
        toast('قلم مصرفی اضافه شد');
      };
      $$('[data-del-cons]', $('#modalBody')).forEach(btn => {
        btn.onclick = () => {
          c.consumables = c.consumables.filter(x => x.id !== btn.dataset.delCons);
          saveDB();
          renderCustomers();
          openConsumables(customerId);
          toast('قلم مصرفی حذف شد');
        };
      });
      $('#csTitle').focus();
    });
  }

  /* ============================================================
     فرم درآمد دستی
     ============================================================ */
  function openIncomeForm() {
    const options = db.customers.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
    openModal('ثبت درآمد', `
      <form id="incomeForm" novalidate>
        <div class="grid">
          <div><label>شرح *</label><input id="fTitle" placeholder="مثلاً سرویس دوره‌ای دستگاه"></div>
          <div><label>مبلغ (تومان) *</label><input id="fAmount" type="number" min="0" step="1000" placeholder="0"></div>
          <div><label>تاریخ</label><input id="fDate" type="date" value="${todayISO()}"></div>
          <div>
            <label>مشتری (اختیاری)</label>
            <select id="fCustomer"><option value="">—</option>${options}</select>
          </div>
        </div>
        <div style="margin-top:14px">
          <label>توضیح</label>
          <input id="fNote" placeholder="اختیاری">
        </div>
        <div class="form-actions">
          <button type="button" class="btn primary" id="fSave">ذخیره</button>
          <button type="button" class="btn ghost" data-close>انصراف</button>
        </div>
      </form>
    `, () => {
      const saveBtn = $('#fSave');
      const form = $('#incomeForm');
      saveBtn.onclick = () => {
        const title = $('#fTitle').value.trim();
        const amount = toNum($('#fAmount').value);
        const date = $('#fDate').value || todayISO();
        const customerId = $('#fCustomer').value;
        const customer = db.customers.find(c => c.id === customerId) || null;
        const note = $('#fNote').value.trim();
        if (!title) return toast('شرح درآمد را وارد کنید');
        if (amount <= 0) return toast('مبلغ معتبر وارد کنید');
        db.finances.push({
          id: uid(), title, amount, date,
          customerId: customer ? customer.id : '',
          customerName: customer ? customer.name : '',
          note, source: 'manual', createdAt: Date.now()
        });
        saveDB();
        closeModal();
        renderAll();
        toast('درآمد ثبت شد');
      };
      bindEnter(form, saveBtn);
      $('#fTitle').focus();
    });
  }

  /* ============================================================
     فاکتور: ذخیره و چاپ
     ============================================================ */
  function saveInvoice() {
    const customerId = $('#invCustomer')?.value || '';
    const customer = db.customers.find(c => c.id === customerId);
    if (!customer) return toast('ابتدا مشتری را انتخاب کنید');
    const data = renderInvoicePreview();
    if (!data || !data.items.length) return toast('حداقل یک آیتم با شرح و تعداد وارد کنید');
    const inv = {
      id: uid(), number: data.number, date: data.date,
      customerId: customer.id, customerName: customer.name,
      customerPhone: customer.phone, customerAddress: customer.address,
      items: data.items, subtotal: data.subtotal, discount: data.discount,
      taxPercent: data.taxPercent, tax: data.tax, total: data.total,
      note: data.note, createdAt: Date.now()
    };
    db.invoices.unshift(inv);
    db.settings.next = toNum(db.settings.next) + 1;
    db.finances.unshift({
      id: uid(), title: `فاکتور ${inv.number}`, amount: inv.total, date: inv.date,
      customerId: customer.id, customerName: customer.name,
      source: 'invoice', invoiceId: inv.id, note: '', createdAt: Date.now()
    });
    saveDB();
    const itemsBody = $('#itemsBody');
    if (itemsBody) itemsBody.innerHTML = '';
    if ($('#invDiscount')) $('#invDiscount').value = '0';
    if ($('#invTax')) $('#invTax').value = '0';
    if ($('#invNote')) $('#invNote').value = '';
    addItemRow();
    renderAll();
    toast('فاکتور ذخیره و درآمد آن ثبت شد');
  }

  function printInvoice(id) {
    const inv = db.invoices.find(x => x.id === id);
    if (!inv) return;
    closeModal();
    const area = $('#printArea');
    if (!area) return;
    area.innerHTML = `<div class="invoice-paper">${invoiceHTML(inv)}</div>`;
    window.print();
  }

  /* ============================================================
     لینک عمومی — با مسیریابی هش (سازگار با file:// و Acode)
     ============================================================ */
  function publicURL() {
    // پاک‌سازی کوئری و هش قبلی، سپس افزودن #request
    const base = location.href.split('#')[0].split('?')[0];
    return base + '#request';
  }

  /* ============================================================
     رندر کلی
     ============================================================ */
  function renderAll() {
    renderCustomerOptions();
    renderCustomers();
    renderServices();
    renderFinance();
    renderInvoices();
    renderDashboard();
    renderSettings();
    renderInvoicePreview();
  }

  /* ============================================================
     نمایش فرم عمومی / پنل
     ============================================================ */
  function showPublic() {
    $('#publicView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    const d = $('#pubDate');
    if (d && !d.value) d.value = todayISO();
  }
  function showApp() {
    $('#publicView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    const invDate = $('#invDate');
    if (invDate && !invDate.value) invDate.value = todayISO();
    renderAll();
    const itemsBody = $('#itemsBody');
    if (itemsBody && !itemsBody.children.length) addItemRow();
  }

  /* ============================================================
     رویدادها
     ============================================================ */
  function bindEvents() {

    // ---- تب‌ها
    $('#tabs').addEventListener('click', e => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      $$('.tab').forEach(t => t.classList.toggle('active', t === btn));
      $$('.tab-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'tab-' + tab));
      if (tab === 'request') renderSettings();
    });

    // ---- event delegation برای دکمه‌های داخل جدول‌ها و مودال
    document.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      if (e.target === $('#modal')) { closeModal(); return; }
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'edit-customer') return openCustomerForm(id);
      if (action === 'cons-customer') return openConsumables(id);

      if (action === 'del-customer') {
        const c = db.customers.find(x => x.id === id);
        if (!c) return;
        if (!confirm(`مشتری «${c.name}» حذف شود؟ خدمات و سوابق مالی حفظ می‌شوند.`)) return;
        db.customers = db.customers.filter(x => x.id !== id);
        saveDB(); renderAll(); toast('مشتری حذف شد');
        return;
      }

      if (action === 'toggle-service') {
        const s = db.services.find(x => x.id === id);
        if (!s) return;
        s.done = !s.done;
        saveDB(); renderAll();
        toast(s.done ? 'خدمت انجام‌شده ثبت شد' : 'خدمت به حالت در انتظار بازگشت');
        return;
      }

      if (action === 'edit-service') return openServiceForm(id);

      if (action === 'del-service') {
        if (!confirm('این خدمت حذف شود؟')) return;
        db.services = db.services.filter(x => x.id !== id);
        saveDB(); renderAll(); toast('خدمت حذف شد');
        return;
      }

      if (action === 'del-income') {
        if (!confirm('این درآمد حذف شود؟')) return;
        db.finances = db.finances.filter(x => x.id !== id);
        saveDB(); renderAll(); toast('درآمد حذف شد');
        return;
      }

      if (action === 'del-income-invoice') {
        toast('این درآمد از یک فاکتور ثبت شده است؛ فاکتور را از تب «فاکتور» حذف کنید.');
        return;
      }

      if (action === 'view-invoice') {
        const inv = db.invoices.find(x => x.id === id);
        if (!inv) return;
        openModal('فاکتور ' + inv.number, `
          <div class="invoice-paper">${invoiceHTML(inv)}</div>
          <div class="form-actions">
            <button class="btn primary" id="invPrintBtn">چاپ فاکتور</button>
            <button class="btn ghost" data-close>بستن</button>
          </div>
        `, () => { $('#invPrintBtn').onclick = () => printInvoice(inv.id); });
        return;
      }

      if (action === 'print-invoice') return printInvoice(id);

      if (action === 'del-invoice') {
        if (!confirm('فاکتور و درآمد مرتبط با آن حذف شود؟')) return;
        db.invoices = db.invoices.filter(x => x.id !== id);
        db.finances = db.finances.filter(f => f.invoiceId !== id);
        saveDB(); renderAll(); toast('فاکتور و درآمد آن حذف شد');
        return;
      }
    });

    // ---- جستجوها
    $('#customerSearch')?.addEventListener('input', renderCustomers);
    $('#serviceSearch')?.addEventListener('input', renderServices);
    $('#financeSearch')?.addEventListener('input', renderFinance);
    $('#serviceFilter')?.addEventListener('change', renderServices);

    // ---- افزودن
    $('#btnAddCustomer')?.addEventListener('click', () => openCustomerForm(null));
    $('#btnAddService')?.addEventListener('click', () => openServiceForm(null));
    $('#btnAddIncome')?.addEventListener('click', openIncomeForm);

    // ---- نمایش فرم عمومی
    $('#btnOpenPublic')?.addEventListener('click', showPublic);
    $('#btnOpenPublic2')?.addEventListener('click', showPublic);

    // ---- فاکتور
    $('#btnAddItem')?.addEventListener('click', () => addItemRow());
    $('#itemsBody')?.addEventListener('input', updateInvoiceTotals);
    $('#itemsBody')?.addEventListener('click', e => {
      const removeBtn = e.target.closest('[data-remove-row]');
      if (!removeBtn) return;
      removeBtn.closest('tr')?.remove();
      updateInvoiceTotals();
    });
    ['#invCustomer', '#invDate', '#invDiscount', '#invTax', '#invNote'].forEach(sel => {
      $(sel)?.addEventListener('input', updateInvoiceTotals);
      $(sel)?.addEventListener('change', updateInvoiceTotals);
    });
    $('#btnSaveInvoice')?.addEventListener('click', saveInvoice);
    $('#btnPreviewInvoice')?.addEventListener('click', () => {
      renderInvoicePreview();
      toast('پیش‌نمایش به‌روزرسانی شد');
    });

    // ---- تنظیمات
    $('#btnSaveSettings')?.addEventListener('click', () => {
      const prefix = ($('#setPrefix')?.value || '').trim() || 'BH';
      const next = Math.max(1, Math.floor(toNum($('#setNext')?.value) || 1));
      db.settings.prefix = prefix;
      db.settings.next = next;
      saveDB(); renderAll(); toast('تنظیمات ذخیره شد');
    });

    // ---- کپی لینک
    $('#btnCopyLink')?.addEventListener('click', async () => {
      const input = $('#publicLinkInput');
      if (!input) return;
      const value = input.value || publicURL();
      try {
        await navigator.clipboard.writeText(value);
        toast('لینک کپی شد');
      } catch (_) {
        input.select();
        try { document.execCommand('copy'); toast('لینک کپی شد'); }
        catch (__) { toast('کپی خودکار ممکن نشد؛ لینک را دستی انتخاب کنید'); }
      }
    });

    // ---- پشتیبان
    $('#btnBackup')?.addEventListener('click', () => {
      try {
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `baharan-backup-${todayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toast('فایل پشتیبان دانلود شد');
      } catch (_) { toast('تهیه پشتیبان ممکن نشد'); }
    });

    // ---- بازیابی
    $('#restoreFile')?.addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (!data || typeof data !== 'object') throw new Error('invalid');
          if (!confirm('اطلاعات فعلی با فایل پشتیبان جایگزین شود؟')) return;
          const fresh = defaultDB();
          ['customers','services','finances','invoices'].forEach(k => {
            if (Array.isArray(data[k])) fresh[k] = data[k];
          });
          if (data.settings && typeof data.settings === 'object') {
            fresh.settings.prefix = String(data.settings.prefix || 'BH');
            fresh.settings.next = Math.max(1, toNum(data.settings.next) || 1);
          }
          db = fresh;
          saveDB(); renderAll(); toast('اطلاعات بازیابی شد');
        } catch (_) { toast('فایل پشتیبان معتبر نیست'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // ---- بستن مودال با Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
    });

    // ---- فرم عمومی: ثبت درخواست
    $('#publicForm')?.addEventListener('submit', e => {
      e.preventDefault();
      const name = $('#pubName').value.trim();
      const phone = $('#pubPhone').value.trim();
      const service = $('#pubService').value.trim();
      const date = $('#pubDate').value || todayISO();
      const note = $('#pubNote').value.trim();
      if (!name) return toast('نام خود را وارد کنید');
      if (normDigits(phone).length < 8) return toast('شماره تماس معتبر نیست');
      if (!service) return toast('خدمت درخواستی را وارد کنید');
      const { customer } = ensureCustomer(name, phone);
      db.services.push({
        id: uid(), customerId: customer.id,
        name, phone, service, date, note,
        done: false, source: 'online', createdAt: Date.now()
      });
      saveDB();
      const rank = db.services.filter(s => !s.done).length;
      const result = $('#publicResult');
      result.classList.remove('hidden');
      result.innerHTML = `
        <div class="success-box">
          <div class="ok-icon">✓</div>
          <h3>درخواست شما ثبت شد</h3>
          <p>شماره پیگیری (اولویت در صف): <strong>${toFa(rank)}</strong></p>
          <p class="muted small">همکاران ما در اسرع وقت با شما تماس خواهند گرفت.</p>
          <button type="button" class="btn ghost" id="pubAgain">ثبت درخواست جدید</button>
        </div>`;
      $('#publicForm').classList.add('hidden');
      $('#pubAgain').onclick = () => {
        result.classList.add('hidden');
        result.innerHTML = '';
        const form = $('#publicForm');
        form.classList.remove('hidden');
        form.reset();
        const d = $('#pubDate');
        if (d) d.value = todayISO();
        $('#pubName').focus();
      };
      toast('درخواست شما با موفقیت ثبت شد');
    });

    // ---- بازگشت از فرم عمومی به پنل
    $('#backToApp')?.addEventListener('click', e => {
      e.preventDefault();
      try {
        const clean = location.href.split('?')[0].split('#')[0];
        history.replaceState(null, '', clean);
      } catch (_) { /* نادیده */ }
      showApp();
    });
  }

  /* ============================================================
     راه‌اندازی — پشتیبانی از ?request=1 و #request
     ============================================================ */
  function init() {
    bindEvents();
    const params = new URLSearchParams(location.search);
    const hashRaw = location.hash.replace(/^#\/?/, '');
    const hashKey = hashRaw.split('=')[0];
    const isPublic = params.has('request') || hashKey === 'request';
    if (isPublic) showPublic();
    else showApp();
  }

  init();

})();