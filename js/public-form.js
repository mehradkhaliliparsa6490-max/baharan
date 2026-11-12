/* ============================================================
   public-form.js — فرم عمومی با تاریخ شمسی
   ============================================================ */
(function (B) {
  'use strict';

  const { $, toFa, normDigits, uid, todayISO, todayJalaliInput,
          jalaliToGregorianIso } = B.utils;
  const { saveDB, ensureCustomer } = B.storage;

  function show() {
    $('#publicView').classList.remove('hidden');
    $('#appView').classList.add('hidden');
    const d = $('#pubDate');
    if (d && !d.value) d.value = todayJalaliInput();
  }

  function showApp() {
    $('#publicView').classList.add('hidden');
    $('#appView').classList.remove('hidden');
    const invDate = $('#invDate');
    if (invDate && !invDate.value) invDate.value = todayJalaliInput();
    B.ui.renderAll();
    const itemsBody = $('#itemsBody');
    if (itemsBody && !itemsBody.children.length) B.invoices.addRow();
  }

  function bindSubmit() {
    $('#publicForm')?.addEventListener('submit', e => {
      e.preventDefault();

      const name = $('#pubName').value.trim();
      const phone = $('#pubPhone').value.trim();
      const service = $('#pubService').value.trim();
      const dateISO = jalaliToGregorianIso($('#pubDate').value);
      const note = $('#pubNote').value.trim();

      if (!name) return B.utils.toast('نام خود را وارد کنید');
      if (normDigits(phone).length < 8) return B.utils.toast('شماره تماس معتبر نیست');
      if (!service) return B.utils.toast('خدمت درخواستی را وارد کنید');

      const { customer } = ensureCustomer(name, phone);

      B.db.services.push({
        id: uid(), customerId: customer.id,
        name, phone, service, date: dateISO, note,
        done: false, source: 'online', createdAt: Date.now()
      });
      saveDB();

      const rank = B.db.services.filter(s => !s.done).length;
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
        if (d) d.value = todayJalaliInput();
        $('#pubName').focus();
      };

      B.utils.toast('درخواست شما با موفقیت ثبت شد');
    });

    $('#backToApp')?.addEventListener('click', e => {
      e.preventDefault();
      try {
        const clean = location.href.split('?')[0].split('#')[0];
        history.replaceState(null, '', clean);
      } catch (_) {}
      window.location.reload();
    });
  }

  B.publicForm = { show, showApp, bindSubmit };
})(window.Baharan);