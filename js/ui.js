/* ============================================================
   ui.js — مدیریت مودال + هماهنگ‌کننده‌ی رندر کلی
   ============================================================ */
(function (B) {
  'use strict';

  const { $ } = B.utils;

  /* ---------- مودال ---------- */
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

  /* ---------- رندر کلیه اجزا ---------- */
  function renderAll() {
    B.customers.renderOptions();
    B.customers.render();
    B.services.render();
    B.finance.render();
    B.invoices.renderList();
    B.dashboard.render();
    B.settings.render();
    B.invoices.renderPreview();
  }

  B.ui = { openModal, closeModal, bindEnter, renderAll };
})(window.Baharan);