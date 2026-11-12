/* ============================================================
   settings.js — تنظیمات فاکتور، لینک عمومی، پشتیبان‌گیری
   ============================================================ */
(function (B) {
  'use strict';

  const { $, toNum, todayISO, toast } = B.utils;
  const { saveDB, defaultDB } = B.storage;

  function publicURL() {
    const base = location.href.split('#')[0].split('?')[0];
    return base + '#request';
  }

  function render() {
    const p = $('#setPrefix');
    if (p && document.activeElement !== p) p.value = B.db.settings.prefix;

    const n = $('#setNext');
    if (n && document.activeElement !== n) n.value = B.utils.toFa(B.db.settings.next);

    const cn = $('#setCardNumber');
    if (cn && document.activeElement !== cn) cn.value = B.db.settings.cardNumber || '';

    const ch = $('#setCardHolder');
    if (ch && document.activeElement !== ch) ch.value = B.db.settings.cardHolder || '';

    const link = $('#publicLinkInput');
    if (link) link.value = publicURL();

    const warn = $('#localWarn');
    if (warn) warn.classList.toggle('hidden', location.protocol !== 'file:');
  }

  function bindActions() {
    $('#btnSaveSettings')?.addEventListener('click', () => {
      const prefix = ($('#setPrefix')?.value || '').trim() || 'BH';
      const next = Math.max(1, Math.floor(toNum($('#setNext')?.value) || 1));

      B.db.settings.prefix = prefix;
      B.db.settings.next = next;
      B.db.settings.cardNumber = ($('#setCardNumber')?.value || '').trim();
      B.db.settings.cardHolder = ($('#setCardHolder')?.value || '').trim();

      saveDB();
      B.ui.renderAll();
      toast('تنظیمات ذخیره شد');
    });

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

    $('#btnBackup')?.addEventListener('click', () => {
      try {
        const blob = new Blob([JSON.stringify(B.db, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `baharan-backup-${todayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        toast('فایل پشتیبان دانلود شد');
      } catch (_) {
        toast('تهیه پشتیبان ممکن نشد');
      }
    });

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
            fresh.settings.cardNumber = String(data.settings.cardNumber || '');
            fresh.settings.cardHolder = String(data.settings.cardHolder || '');
          }

          B.db = fresh;
          saveDB();
          B.ui.renderAll();
          toast('اطلاعات بازیابی شد');
        } catch (_) {
          toast('فایل پشتیبان معتبر نیست');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  B.settings = { render, publicURL, bindActions };
})(window.Baharan);