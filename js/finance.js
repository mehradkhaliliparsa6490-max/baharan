/* ============================================================
   finance.js — جدول درآمدها + فرم ثبت درآمد دستی
   ============================================================ */
(function (B) {
  'use strict';

  const { $, toFa, esc, toNum, money, uid, todayISO, jalali, toast } = B.utils;
  const { openModal, closeModal, bindEnter, renderAll } = B.ui;
  const { saveDB } = B.storage;

  /* ---------- جدول مالی ---------- */
  function render() {
    const tbody = $('#financeBody');
    if (!tbody) return;

    const q = ($('#financeSearch')?.value || '').trim().toLowerCase();

    let list = [...B.db.finances].sort((a, b) => {
      const d = String(b.date || '').localeCompare(String(a.date || ''));
      return d !== 0 ? d : (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (q) list = list.filter(f =>
      [f.title, f.customerName, f.note].join(' ').toLowerCase().includes(q));

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">درآمدی ثبت نشده است.</td></tr>';
    } else {
      tbody.innerHTML = list.map(f => {
        const source = f.source === 'invoice'
          ? '<span class="badge online">فاکتور</span>'
          : '<span class="badge manual">دستی</span>';
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

    const total = B.db.finances.reduce((sum, f) => sum + toNum(f.amount), 0);
    const totalEl = $('#financeTotal');
    if (totalEl) totalEl.textContent = money(total) + ' تومان';
  }

  /* ---------- فرم درآمد دستی ---------- */
  function openForm() {
    const options = B.db.customers
      .map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

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
        const customer = B.db.customers.find(c => c.id === customerId) || null;
        const note = $('#fNote').value.trim();

        if (!title) return toast('شرح درآمد را وارد کنید');
        if (amount <= 0) return toast('مبلغ معتبر وارد کنید');

        B.db.finances.push({
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

  /* ---------- حذف درآمد دستی ---------- */
  function remove(id) {
    if (!confirm('این درآمد حذف شود؟')) return;
    B.db.finances = B.db.finances.filter(x => x.id !== id);
    saveDB();
    renderAll();
    toast('درآمد حذف شد');
  }

  B.finance = { render, openForm, remove };
})(window.Baharan);