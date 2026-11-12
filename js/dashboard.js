/* ============================================================
   dashboard.js — آمار کلی و نوبت‌های در انتظار
   ============================================================ */
(function (B) {
  'use strict';

  const { $, toFa, esc, toNum, money, jalali } = B.utils;

  function render() {
    /* ---------- کارت‌های آمار ---------- */
    const stats = $('#stats');
    if (stats) {
      const pending = B.db.services.filter(s => !s.done).length;
      const done = B.db.services.filter(s => s.done).length;
      const totalIncome = B.db.finances.reduce((sum, f) => sum + toNum(f.amount), 0);

      stats.innerHTML = `
        <div class="stat">
          <div class="label">تعداد مشتریان</div>
          <div class="num">${toFa(B.db.customers.length)} <small>نفر</small></div>
        </div>
        <div class="stat">
          <div class="label">خدمات در انتظار</div>
          <div class="num">${toFa(pending)} <small>مورد</small></div>
        </div>
        <div class="stat">
          <div class="label">خدمات انجام‌شده</div>
          <div class="num">${toFa(done)} <small>مورد</small></div>
        </div>
        <div class="stat">
          <div class="label">مجموع درآمد</div>
          <div class="num">${money(totalIncome)} <small>تومان</small></div>
        </div>`;
    }

    /* ---------- نوبت‌های در انتظار ---------- */
    const dashServices = $('#dashServices');
    if (dashServices) {
      const pendingList = B.db.services
        .filter(s => !s.done)
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .slice(0, 5);

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
  }

  B.dashboard = { render };
})(window.Baharan);