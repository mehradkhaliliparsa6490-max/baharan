/* ============================================================
   services.js — جدول خدمات با تاریخ شمسی در فرم
   ============================================================ */
(function (B) {
  'use strict';

  const { $, toFa, esc, normDigits, uid, todayISO, todayJalaliInput,
          jalali, jalaliToGregorianIso, gregorianToJalaliStr } = B.utils;
  const { openModal, closeModal, bindEnter, renderAll } = B.ui;
  const { saveDB, ensureCustomer } = B.storage;

  function render() {
    const tbody = $('#servicesBody');
    if (!tbody) return;

    const filter = $('#serviceFilter')?.value || 'all';
    const q = ($('#serviceSearch')?.value || '').trim().toLowerCase();

    let list = [...B.db.services];
    list.sort((a, b) => {
      const doneA = a.done ? 1 : 0;
      const doneB = b.done ? 1 : 0;
      if (doneA !== doneB) return doneA - doneB;
      return (a.createdAt || 0) - (b.createdAt || 0);
    });

    if (filter === 'pending') list = list.filter(s => !s.done);
    if (filter === 'done')    list = list.filter(s => s.done);
    if (q) list = list.filter(s =>
      [s.name, s.phone, s.service, s.note].join(' ').toLowerCase().includes(q));

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty">خدمتی یافت نشد.</td></tr>';
      return;
    }

    let rank = 0;
    tbody.innerHTML = list.map(s => {
      const badge = s.done
        ? '<span class="badge ok">انجام‌شده</span>'
        : '<span class="badge wait">در انتظار</span>';
      const priority = s.done
        ? '<span class="muted">—</span>'
        : `<span class="rank">${toFa(++rank)}</span>`;
      const source = s.source === 'online'
        ? '<span class="badge online">آنلاین</span>'
        : '<span class="badge manual">دستی</span>';
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

  function openForm(id) {
    const s = id ? B.db.services.find(x => x.id === id) : null;
    const dateValue = s ? gregorianToJalaliStr(s.date) : todayJalaliInput();

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
            <label>تاریخ درخواست (شمسی)</label>
            <input id="sDate" class="jalali-date" value="${dateValue}" placeholder="۱۴۰۳/۰۱/۰۱" dir="ltr" style="text-align:right">
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
        const names = [...new Set(B.db.customers.map(c => c.name).filter(Boolean))];
        dl.innerHTML = names.map(n => `<option value="${esc(n)}"></option>`).join('');
      }

      $('#sName').addEventListener('input', () => {
        const val = $('#sName').value.trim();
        const found = B.db.customers.find(c => c.name.trim() === val);
        if (found && found.phone) $('#sPhone').value = found.phone;
      });

      const saveBtn = $('#sSave');
      const form = $('#serviceForm');

      saveBtn.onclick = () => {
        const name = $('#sName').value.trim();
        const phone = $('#sPhone').value.trim();
        const service = $('#sService').value.trim();
        const dateISO = jalaliToGregorianIso($('#sDate').value);
        const note = $('#sNote').value.trim();
        const done = $('#sDone').checked;

        if (!name) return toast('نام مشتری را وارد کنید');
        if (normDigits(phone).length < 8) return toast('شماره تماس معتبر نیست');
        if (!service) return toast('خدمت درخواستی را وارد کنید');

        const { customer, created } = ensureCustomer(name, phone);

        if (s) {
          Object.assign(s, { customerId: customer.id, name, phone, service, date: dateISO, note, done });
        } else {
          B.db.services.push({
            id: uid(), customerId: customer.id,
            name, phone, service, date: dateISO, note, done,
            source: 'manual', createdAt: Date.now()
          });
        }

        saveDB();
        closeModal();
        renderAll();
        toast(created ? 'خدمت ثبت و مشتری جدید اضافه شد'
                     : (s ? 'خدمت ویرایش شد' : 'خدمت جدید ثبت شد'));
      };

      bindEnter(form, saveBtn);
      $('#sName').focus();
    });
  }

  function toggle(id) {
    const s = B.db.services.find(x => x.id === id);
    if (!s) return;
    s.done = !s.done;
    saveDB();
    renderAll();
    toast(s.done ? 'خدمت انجام‌شده ثبت شد' : 'خدمت به حالت در انتظار بازگشت');
  }

  function remove(id) {
    if (!confirm('این خدمت حذف شود؟')) return;
    B.db.services = B.db.services.filter(x => x.id !== id);
    saveDB();
    renderAll();
    toast('خدمت حذف شد');
  }

  B.services = { render, openForm, toggle, remove };
})(window.Baharan);