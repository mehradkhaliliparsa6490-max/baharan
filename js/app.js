/* ============================================================
   app.js — اتصال رویدادها + راه‌اندازی برنامه + احراز هویت
   ============================================================ */
(function (B) {
  'use strict';

  const { $, $$, toast, todayJalaliInput, FA_DIGITS } = B.utils;
  const { closeModal } = B.ui;

  /* ---------- احراز هویت ---------- */
  function initAuth() {
    const loginView = $('#loginView');
    const appView = $('#appView');
    const publicView = $('#publicView');
    const isPublic = location.search.includes('request') || location.hash.includes('request');

    if (isPublic) {
      loginView.classList.add('hidden');
      B.publicForm.show();
      return;
    }

    if (sessionStorage.getItem('baharan_auth') === '1') {
      loginView.classList.add('hidden');
      B.publicForm.showApp();
    } else {
      loginView.classList.remove('hidden');
      appView.classList.add('hidden');
      publicView.classList.add('hidden');
    }

    const doLogin = () => {
      const pass = $('#loginPass').value.trim();
      if (pass === '123456') {
        sessionStorage.setItem('baharan_auth', '1');
        loginView.classList.add('hidden');
        B.publicForm.showApp();
        $('#loginPass').value = '';
        $('#loginError').style.display = 'none';
      } else {
        $('#loginError').style.display = 'block';
      }
    };

    $('#btnLogin')?.addEventListener('click', doLogin);
    $('#loginPass')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });

    $('#btnLogout')?.addEventListener('click', () => {
      sessionStorage.removeItem('baharan_auth');
      location.reload();
    });
  }

  /* ---------- فرمت ورودی اعداد و تاریخ ---------- */
  function initInputMasks() {
    document.addEventListener('input', e => {
      /* اعداد: تبدیل ارقام لاتین به فارسی */
      if (e.target.matches('.num-input')) {
        const val = e.target.value;
        const faVal = val.replace(/\d/g, d => FA_DIGITS[+d]);
        if (e.target.value !== faVal) {
          const start = e.target.selectionStart;
          e.target.value = faVal;
          e.target.setSelectionRange(start, start);
        }
      }

      /* تاریخ شمسی: ماسک ۱۴۰۳/۰۱/۰۱ */
      if (e.target.matches('.jalali-date')) {
        let val = e.target.value.replace(/[^\d۰-۹\/]/g, '');
        val = val.replace(/[۰-۹]/g, d => String(FA_DIGITS.indexOf(d))); // موقتاً به لاتین
        val = val.replace(/\//g, '');
        if (val.length > 4) val = val.slice(0, 4) + '/' + val.slice(4);
        if (val.length > 7) val = val.slice(0, 7) + '/' + val.slice(7);
        if (val.length > 10) val = val.slice(0, 10);
        const faVal = val.replace(/\d/g, d => FA_DIGITS[+d]);
        if (e.target.value !== faVal) {
          e.target.value = faVal;
        }
      }
    });
  }

  /* ---------- تب‌ها ---------- */
  function bindTabs() {
    $('#tabs').addEventListener('click', e => {
      const btn = e.target.closest('.tab');
      if (!btn) return;
      const tab = btn.dataset.tab;
      $$('.tab').forEach(t => t.classList.toggle('active', t === btn));
      $$('.tab-panel').forEach(p =>
        p.classList.toggle('hidden', p.id !== 'tab-' + tab));
      if (tab === 'request') B.settings.render();
    });
  }

  /* ---------- Delegation ---------- */
  function bindDelegation() {
    document.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      if (e.target === $('#modal')) { closeModal(); return; }

      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;

      switch (action) {
        case 'edit-customer':   return B.customers.openForm(id);
        case 'cons-customer':   return B.customers.openConsumables(id);
        case 'del-customer':    return B.customers.remove(id);
        case 'toggle-service':  return B.services.toggle(id);
        case 'edit-service':    return B.services.openForm(id);
        case 'del-service':     return B.services.remove(id);
        case 'del-income':      return B.finance.remove(id);
        case 'del-income-invoice':
          return toast('این درآمد از یک فاکتور ثبت شده است؛ فاکتور را از تب «فاکتور» حذف کنید.');
        case 'view-invoice':    return B.invoices.view(id);
        case 'print-invoice':   return B.invoices.print(id);
        case 'del-invoice':     return B.invoices.remove(id);
      }
    });
  }

  /* ---------- جستجوها ---------- */
  function bindSearchInputs() {
    $('#customerSearch')?.addEventListener('input', B.customers.render);
    $('#serviceSearch')?.addEventListener('input', B.services.render);
    $('#financeSearch')?.addEventListener('input', B.finance.render);
    $('#serviceFilter')?.addEventListener('change', B.services.render);
  }

  /* ---------- دکمه‌های افزودن ---------- */
  function bindAddButtons() {
    $('#btnAddCustomer')?.addEventListener('click', () => B.customers.openForm(null));
    $('#btnAddService')?.addEventListener('click', () => B.services.openForm(null));
    $('#btnAddIncome')?.addEventListener('click', B.finance.openForm);
    $('#btnOpenPublic')?.addEventListener('click', B.publicForm.show);
    $('#btnOpenPublic2')?.addEventListener('click', B.publicForm.show);
  }

  /* ---------- فرم فاکتور ---------- */
  function bindInvoiceForm() {
    $('#btnAddItem')?.addEventListener('click', () => B.invoices.addRow());
    $('#itemsBody')?.addEventListener('input', B.invoices.updateTotals);
    $('#itemsBody')?.addEventListener('click', e => {
      const removeBtn = e.target.closest('[data-remove-row]');
      if (!removeBtn) return;
      removeBtn.closest('tr')?.remove();
      B.invoices.updateTotals();
    });
    ['#invCustomer', '#invDate', '#invDiscount', '#invTax', '#invNote'].forEach(sel => {
      $(sel)?.addEventListener('input', B.invoices.updateTotals);
      $(sel)?.addEventListener('change', B.invoices.updateTotals);
    });
    $('#btnSaveInvoice')?.addEventListener('click', B.invoices.save);
    $('#btnPreviewInvoice')?.addEventListener('click', () => {
      B.invoices.renderPreview();
      toast('پیش‌نمایش به‌روزرسانی شد');
    });
  }

  function bindMisc() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
    });
  }

  /* ---------- راه‌اندازی ---------- */
  function init() {
    initAuth();
    initInputMasks();
    bindTabs();
    bindDelegation();
    bindSearchInputs();
    bindAddButtons();
    bindInvoiceForm();
    bindMisc();

    B.settings.bindActions();
    B.publicForm.bindSubmit();
  }

  B.app = { init };
  init();
})(window.Baharan);