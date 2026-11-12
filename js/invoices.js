/* ============================================================
   invoices.js — ساخت، پیش‌نمایش، ذخیره و چاپ فاکتور
   ============================================================ */
(function (B) {
  'use strict';

  const { $, $$, toFa, esc, toNum, money, uid, todayISO, jalali, toast } = B.utils;
  const { openModal, closeModal } = B.ui;
  const { saveDB } = B.storage;

  /* ---------- افزودن ردیف ---------- */
  function addRow(title = '', qty = 1, price = '') {
    const tbody = $('#itemsBody');
    if (!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="i-title" placeholder="شرح خدمت / کالا" value="${esc(title)}"></td>
      <td><input class="i-qty" type="number" min="1" step="1" value="${toFa(qty)}"></td>
      <td><input class="i-price" type="number" min="0" step="1000" value="${esc(price)}" placeholder="0"></td>
      <td class="row-total" style="font-weight:700">۰</td>
      <td><button type="button" class="btn danger sm" data-remove-row>حذف</button></td>`;
    tbody.appendChild(tr);
    updateTotals();
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

  function updateTotals() {
    $$('#itemsBody tr').forEach(tr => {
      const qtyEl = tr.querySelector('.i-qty');
      const priceEl = tr.querySelector('.i-price');
      const totalEl = tr.querySelector('.row-total');
      if (!qtyEl || !priceEl || !totalEl) return;
      totalEl.textContent = money(toNum(qtyEl.value) * toNum(priceEl.value));
    });
    renderPreview();
  }

  /* ---------- ساخت HTML فاکتور (با اطلاعات پرداخت) ---------- */
  function buildHTML(d) {
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

    /* ✅ اطلاعات کارت از تنظیمات جاری خوانده می‌شود */
    const cardNumber = (B.db.settings.cardNumber || '').trim();
    const cardHolder = (B.db.settings.cardHolder || '').trim();
    const paymentBlock = (cardNumber || cardHolder) ? `
      <div class="inv-payment">
        <div class="inv-payment-title">اطلاعات پرداخت</div>
        ${cardNumber ? `<div class="inv-payment-row"><span>شماره کارت:</span><strong dir="ltr">${esc(cardNumber)}</strong></div>` : ''}
        ${cardHolder ? `<div class="inv-payment-row"><span>صاحب کارت:</span><strong>${esc(cardHolder)}</strong></div>` : ''}
      </div>
    ` : '';

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
      ${paymentBlock}
      ${d.note ? `<div class="inv-note">${esc(d.note)}</div>` : ''}
      <div class="inv-sign">مهر و امضا</div>`;
  }

  /* ---------- پیش‌نمایش زنده ---------- */
  function renderPreview() {
    const box = $('#invoicePreview');
    if (!box) return null;

    const customerId = $('#invCustomer')?.value || '';
    const customer = B.db.customers.find(c => c.id === customerId) || null;

    const items = readItems();
    const subtotal = items.reduce((sum, it) => sum + it.qty * it.price, 0);
    const discount = Math.min(toNum($('#invDiscount')?.value), subtotal);
    const taxPercent = toNum($('#invTax')?.value);
    const tax = Math.round((subtotal - discount) * taxPercent / 100);
    const total = subtotal - discount + tax;

    const data = {
      number: `${B.db.settings.prefix}-${B.db.settings.next}`,
      date: $('#invDate')?.value || todayISO(),
      customerName: customer ? customer.name : '—',
      customerPhone: customer ? customer.phone : '',
      customerAddress: customer ? customer.address : '',
      items, subtotal, discount, taxPercent, tax, total,
      note: ($('#invNote')?.value || '').trim()
    };

    box.innerHTML = buildHTML(data);

    const totalLive = $('#invTotalLive');
    if (totalLive) totalLive.textContent = money(total) + ' تومان';
    const subtotalEl = $('#invSubtotal');
    if (subtotalEl) subtotalEl.textContent = money(subtotal);

    return data;
  }

  /* ---------- جدول فاکتورهای صادرشده ---------- */
  function renderList() {
    const tbody = $('#invoicesBody');
    if (!tbody) return;

    if (!B.db.invoices.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">فاکتوری صادر نشده است.</td></tr>';
      return;
    }

    tbody.innerHTML = B.db.invoices.map(inv => `
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

  /* ---------- ذخیره فاکتور و ثبت درآمد ---------- */
  function save() {
    const customerId = $('#invCustomer')?.value || '';
    const customer = B.db.customers.find(c => c.id === customerId);
    if (!customer) return toast('ابتدا مشتری را انتخاب کنید');

    const data = renderPreview();
    if (!data || !data.items.length) return toast('حداقل یک آیتم با شرح و تعداد وارد کنید');

    const inv = {
      id: uid(), number: data.number, date: data.date,
      customerId: customer.id, customerName: customer.name,
      customerPhone: customer.phone, customerAddress: customer.address,
      items: data.items, subtotal: data.subtotal,
      discount: data.discount, taxPercent: data.taxPercent,
      tax: data.tax, total: data.total,
      note: data.note, createdAt: Date.now()
    };

    B.db.invoices.unshift(inv);
    B.db.settings.next = toNum(B.db.settings.next) + 1;

    B.db.finances.unshift({
      id: uid(),
      title: `فاکتور ${inv.number}`,
      amount: inv.total, date: inv.date,
      customerId: customer.id, customerName: customer.name,
      source: 'invoice', invoiceId: inv.id,
      note: '', createdAt: Date.now()
    });

    saveDB();

    const itemsBody = $('#itemsBody');
    if (itemsBody) itemsBody.innerHTML = '';
    if ($('#invDiscount')) $('#invDiscount').value = '0';
    if ($('#invTax')) $('#invTax').value = '0';
    if ($('#invNote')) $('#invNote').value = '';
    addRow();

    B.ui.renderAll();
    toast('فاکتور ذخیره و درآمد آن ثبت شد');
  }

  /* ============================================================
     استایل مستقل سند چاپ (برای دانلود یا iframe)
     ============================================================ */
  function getPrintStyles() {
    return `
      * { box-sizing: border-box; }
      html, body {
        margin:0; padding:0;
        background:#fff;
        direction:rtl;
        font-family:'Vazirmatn','Segoe UI',Tahoma,Arial,sans-serif;
        font-size:13px; color:#1e2a44; line-height:1.7;
      }
      body { padding: 12mm; }
      @page { margin: 8mm; }
      .invoice-paper { background:#fff; width:100%; }
      .inv-head {
        display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap;
        border-bottom:2px dashed rgba(31,45,80,.25);
        padding-bottom:12px; margin-bottom:16px;
      }
      .inv-title { font-size:20px; font-weight:800; color:#2f6df6; }
      .inv-meta { font-size:13px; color:#5b6785; display:grid; gap:4px; }
      .inv-customer { display:grid; gap:6px; font-size:13.5px; margin-bottom:16px; }
      .inv-table { width:100%; border-collapse:collapse; font-size:13px; }
      .inv-table th, .inv-table td {
        border:1px solid rgba(31,45,80,.2); padding:8px 10px;
        text-align:right; vertical-align:middle;
      }
      .inv-table th { background:#f4f7ff; font-weight:700; color:#5b6785; }
      .inv-summary { margin-top:16px; display:grid; gap:6px; }
      .inv-summary .row {
        display:flex; justify-content:space-between; gap:12px;
        font-size:13.5px; max-width:380px; margin-inline-start:auto;
      }
      .inv-summary .row.total {
        font-weight:800; font-size:16px; color:#2f6df6;
        border-top:1px dashed rgba(31,45,80,.3);
        padding-top:8px; margin-top:4px;
      }
      .inv-payment {
        margin-top:14px; padding:12px 16px;
        background:#f0f6ff; border-radius:10px;
        border-right:3px solid #2f6df6; font-size:13px;
      }
      .inv-payment-title { font-weight:800; color:#2f6df6; font-size:12.5px; margin-bottom:6px; }
      .inv-payment-row { display:flex; gap:8px; align-items:baseline; margin-bottom:4px; flex-wrap:wrap; }
      .inv-payment-row:last-child { margin-bottom:0; }
      .inv-payment-row span { color:#5b6785; }
      .inv-payment-row strong {
        color:#1e2a44; font-family:'Consolas','Monaco',monospace;
        font-size:14px; letter-spacing:.5px;
      }
      .inv-note {
        margin-top:14px; font-size:13px; color:#5b6785; white-space:pre-line;
        padding:8px 12px; background:#f8faff;
        border-right:3px solid #2f6df6; border-radius:6px;
      }
      .inv-sign { margin-top:40px; text-align:left; font-size:13px; color:#8a93a8; }
      .muted { color:#5b6785; }
      .small { font-size:12px; }
      .empty { text-align:center; color:#8a93a8; padding:20px; }
    `;
  }

  /* ============================================================
     ساخت سند HTML کامل و مستقل (برای دانلود)
     ============================================================ */
  function buildStandaloneHTML(inv) {
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>فاکتور ${esc(inv.number)}</title>
<style>
${getPrintStyles()}
body { padding: 20px; }
.toolbar {
  position:fixed; top:0; left:0; right:0;
  padding:12px; background:#2f6df6; color:#fff;
  display:flex; gap:10px; justify-content:center;
  z-index:100; box-shadow:0 2px 10px rgba(0,0,0,.2);
}
.toolbar button {
  padding:8px 20px; border:0; border-radius:8px;
  background:#fff; color:#2f6df6; font-family:inherit;
  font-size:14px; font-weight:700; cursor:pointer;
}
.invoice-paper { margin-top:70px; }
@media print {
  .toolbar { display:none !important; }
  .invoice-paper { margin-top:0 !important; }
  body { padding:0 !important; }
}
</style>
</head>
<body>
<div class="toolbar">
  <button onclick="window.print()">🖨️ چاپ فاکتور</button>
</div>
<div class="invoice-paper">${buildHTML(inv)}</div>
</body>
</html>`;
  }

  /* ============================================================
     نوار ابزار چاپ
     ============================================================ */
  function showPrintBar(inv) {
    let bar = document.getElementById('printBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'printBar';
      document.body.appendChild(bar);
    }

    bar.innerHTML = `
      <button type="button" class="btn ok" id="pbPrint">🖨️ چاپ</button>
      <button type="button" class="btn" id="pbDownload">💾 دانلود</button>
      <button type="button" class="btn danger" id="pbClose">✕ بستن</button>
    `;

    document.getElementById('pbPrint').onclick = () => {
      try { window.print(); }
      catch (e) { console.error(e); toast('چاپ ممکن نشد — از دانلود استفاده کنید'); }
    };

    document.getElementById('pbDownload').onclick = () => downloadInvoiceHTML(inv);

    document.getElementById('pbClose').onclick = () => exitPrintPreview();
  }

  /* ============================================================
     دانلود فایل HTML مستقل
     ============================================================ */
  function downloadInvoiceHTML(inv) {
    try {
      const html = buildStandaloneHTML(inv);
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `factor-${inv.number}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast('فایل فاکتور دانلود شد — آن را در مرورگر باز کنید و چاپ بزنید');
    } catch (e) {
      console.error(e);
      toast('امکان دانلود فایل فاکتور نیست');
    }
  }

  /* ============================================================
     خروج از حالت پیش‌نمایش
     ============================================================ */
  function exitPrintPreview() {
    document.body.classList.remove('print-preview');
    const bar = document.getElementById('printBar');
    if (bar) { bar.innerHTML = ''; bar.remove(); }
    const area = $('#printArea');
    if (area) area.innerHTML = '';
  }

  /* ============================================================
     چاپ فاکتور — پیش‌نمایش تمام‌صفحه + چاپ خودکار + دانلود
     ============================================================ */
  function print(id) {
    const inv = B.db.invoices.find(x => x.id === id);
    if (!inv) return toast('فاکتور یافت نشد');

    closeModal();

    const area = $('#printArea');
    if (!area) return toast('ناحیه چاپ یافت نشد');

    /* ۱. قرار دادن محتوا */
    area.innerHTML = `<div class="invoice-paper">${buildHTML(inv)}</div>`;

    /* ۲. باز کردن حالت پیش‌نمایش */
    document.body.classList.add('print-preview');

    /* ۳. نمایش نوار ابزار */
    showPrintBar(inv);

    /* ۴. اسکرول به بالا */
    window.scrollTo(0, 0);

    /* ۵. تلاش برای چاپ خودکار با تأخیر
       (اگر مرورگر پشتیبانی کند، پنجره چاپ باز می‌شود؛
        اگر نه، کاربر از دکمه «چاپ» نوار ابزار استفاده می‌کند) */
    setTimeout(() => {
      try {
        window.print();
      } catch (e) {
        console.warn('window.print پشتیبانی نمی‌شود؛ از دکمه چاپ نوار ابزار استفاده کنید');
      }
    }, 800);
  }

  /* ---------- مشاهده در مودال ---------- */
  function view(id) {
    const inv = B.db.invoices.find(x => x.id === id);
    if (!inv) return;
    openModal('فاکتور ' + inv.number, `
      <div class="invoice-paper">${buildHTML(inv)}</div>
      <div class="form-actions">
        <button class="btn primary" id="invPrintBtn">🖨️ چاپ فاکتور</button>
        <button class="btn ghost" id="invDownloadBtn">💾 دانلود</button>
        <button class="btn ghost" data-close>بستن</button>
      </div>
    `, () => {
      $('#invPrintBtn').onclick = () => print(inv.id);
      $('#invDownloadBtn').onclick = () => downloadInvoiceHTML(inv);
    });
  }

  /* ---------- حذف فاکتور ---------- */
  function remove(id) {
    if (!confirm('فاکتور و درآمد مرتبط با آن حذف شود؟')) return;
    B.db.invoices = B.db.invoices.filter(x => x.id !== id);
    B.db.finances = B.db.finances.filter(f => f.invoiceId !== id);
    saveDB();
    B.ui.renderAll();
    toast('فاکتور و درآمد آن حذف شد');
  }

  B.invoices = { addRow, readItems, updateTotals, buildHTML,
                 renderPreview, renderList, save, print, view, remove,
                 downloadInvoiceHTML, exitPrintPreview };
})(window.Baharan);