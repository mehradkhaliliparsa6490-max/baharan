/* ============================================================
   customers.js — جدول مشتریان + فرم + اقلام مصرفی
   ============================================================ */
(function (B) {
  'use strict';

  const { $, $$, toFa, esc, normDigits, uid, todayISO, tsToISO, jalali, toast } = B.utils;
  const { openModal, closeModal, bindEnter, renderAll } = B.ui;
  const { saveDB } = B.storage;

  /* ---------- پر کردن select فاکتور و datalist ---------- */
  function renderOptions() {
    const sel = $('#invCustomer');
    if (sel) {
      const cur = sel.value;
      sel.innerHTML = '<option value="">— انتخاب مشتری —</option>' +
        B.db.customers.map(c =>
          `<option value="${c.id}">${esc(c.name)}${c.phone ? ' — ' + esc(c.phone) : ''}</option>`
        ).join('');
      if (B.db.customers.some(c => c.id === cur)) sel.value = cur;
    }

    const dl = $('#customerNames');
    if (dl) {
      const names = [...new Set(B.db.customers.map(c => c.name).filter(Boolean))];
      dl.innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
    }
  }

  /* ---------- جدول مشتریان ---------- */
  function render() {
    const tbody = $('#customersBody');
    if (!tbody) return;

    const q = ($('#customerSearch')?.value || '').trim().toLowerCase();
    const rows = B.db.customers.filter(c =>
      !q || [c.name, c.phone, c.address].join(' ').toLowerCase().includes(q)
    );

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">مشتری‌ای ثبت نشده است.</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map((c, i) => {
      const serviceCount = B.db.services.filter(s => s.customerId === c.id).length;
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

  /* ---------- فرم مشتری ---------- */
  function openForm(id) {
    const c = id ? B.db.customers.find(x => x.id === id) : null;

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

        const dup = B.db.customers.find(x =>
          x.id !== (c ? c.id : null) && normDigits(x.phone) === normDigits(phone));
        if (dup) return toast('این شماره تماس قبلاً ثبت شده است');

        if (c) Object.assign(c, { name, phone, address });
        else B.db.customers.push({
          id: uid(), name, phone, address,
          createdAt: Date.now(), consumables: []
        });

        saveDB();
        closeModal();
        renderAll();
        toast(c ? 'اطلاعات مشتری ویرایش شد' : 'مشتری جدید ثبت شد');
      };

      bindEnter(form, saveBtn);
      $('#cName').focus();
    });
  }

  /* ---------- اقلام مصرفی ---------- */
  function openConsumables(customerId) {
    const c = B.db.customers.find(x => x.id === customerId);
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
        render();
        openConsumables(customerId);
        toast('قلم مصرفی اضافه شد');
      };

      $$('[data-del-cons]', $('#modalBody')).forEach(btn => {
        btn.onclick = () => {
          c.consumables = c.consumables.filter(x => x.id !== btn.dataset.delCons);
          saveDB();
          render();
          openConsumables(customerId);
          toast('قلم مصرفی حذف شد');
        };
      });

      $('#csTitle').focus();
    });
  }

  /* ---------- حذف مشتری ---------- */
  function remove(id) {
    const c = B.db.customers.find(x => x.id === id);
    if (!c) return;
    if (!confirm(`مشتری «${c.name}» حذف شود؟ خدمات و سوابق مالی حفظ می‌شوند.`)) return;
    B.db.customers = B.db.customers.filter(x => x.id !== id);
    saveDB();
    renderAll();
    toast('مشتری حذف شد');
  }

  B.customers = { renderOptions, render, openForm, openConsumables, remove };
})(window.Baharan);