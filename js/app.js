/* ============================================================
   app.js — اتصال رویدادهای سراسری + راه‌اندازی برنامه
   این فایل باید آخرین اسکریپت بارگذاری شود.
   ============================================================ */
(function (B) {
  'use strict';

  const { $, $$, toast } = B.utils;
  const { closeModal } = B.ui;

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

  /* ---------- Delegation: کلیک روی دکمه‌های جدول‌ها و مودال ---------- */
  function bindDelegation() {
    document.addEventListener('click', e => {
      /* بستن مودال */
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

  /* ---------- جستجوها و فیلترها ---------- */
  function bindSearchInputs() {
    $('#customerSearch')?.addEventListener('input', B.customers.render);
    $('#serviceSearch')?.addEventListener('input', B.services.render);
    $('#financeSearch')?.addEventListener('input', B.finance.render);
    $('#serviceFilter')?.addEventListener('change', B.services.render);
  }

  /* ---------- دکمه‌های افزودن و مشاهده فرم عمومی ---------- */
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

  /* ---------- بستن مودال با Escape ---------- */
  function bindMisc() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal();
    });
  }

  /* ---------- راه‌اندازی ---------- */
  function init() {
    bindTabs();
    bindDelegation();
    bindSearchInputs();
    bindAddButtons();
    bindInvoiceForm();
    bindMisc();

    B.settings.bindActions();
    B.publicForm.bindSubmit();

    /* تشخیص حالت: ?request=1 یا #request */
    const params = new URLSearchParams(location.search);
    const hashRaw = location.hash.replace(/^#\/?/, '');
    const hashKey = hashRaw.split('=')[0];
    const isPublic = params.has('request') || hashKey === 'request';

    if (isPublic) B.publicForm.show();
    else B.publicForm.showApp();
  }

  B.app = { init };
  init();
})(window.Baharan);