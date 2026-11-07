/* Prototype: chuyển trạng thái bằng hash, đếm lùi, hiện mật khẩu. Không gọi mạng. */
(function () {
  var bar = document.querySelector('[data-preview]');
  var chips = bar ? [].slice.call(bar.querySelectorAll('[data-view]')) : [];
  var timers = [];
  function fmt(s) { var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function counts() {
    timers.forEach(clearInterval); timers = [];
    [].forEach.call(document.querySelectorAll('[data-count]'), function (el) {
      if (el.closest('[hidden]')) return;
      var left = parseInt(el.dataset.count, 10); el.textContent = fmt(left);
      timers.push(setInterval(function () {
        if (left > 0) left--; el.textContent = fmt(left);
        if (left === 0 && el.dataset.done) document.dispatchEvent(new CustomEvent('countdone', { detail: el.dataset.done }));
      }, 1000));
    });
  }
  function set(v, keep) {
    if (!chips.some(function (c) { return c.dataset.view === v; })) v = chips[0].dataset.view;
    document.body.dataset.view = v;
    [].forEach.call(document.querySelectorAll('[data-v]'), function (e) { e.hidden = e.dataset.v.split(' ').indexOf(v) < 0; });
    [].forEach.call(document.querySelectorAll('[data-nv]'), function (e) { e.hidden = e.dataset.nv.split(' ').indexOf(v) >= 0; });
    [].forEach.call(document.querySelectorAll('[data-dis]'), function (e) { e.setAttribute('aria-disabled', e.dataset.dis.split(' ').indexOf(v) >= 0 ? 'true' : 'false'); });
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.view === v)); });
    if (!keep) history.replaceState(null, '', '#' + v);
    counts();
    document.dispatchEvent(new CustomEvent('view', { detail: v }));
  }
  window.authSet = set;
  if (chips.length) {
    chips.forEach(function (c) { c.addEventListener('click', function () { set(c.dataset.view); }); });
    window.addEventListener('hashchange', function () { set(location.hash.slice(1), true); });
    set(location.hash.slice(1), true);
  }
  // nút bị chặn: không chạy hành động, đọc lý do bằng aria-describedby
  document.addEventListener('click', function (e) {
    var d = e.target.closest('[aria-disabled="true"]');
    if (d) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('submit', function (e) {
    var b = e.target.querySelector('[type="submit"][aria-disabled="true"]');
    if (b) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  [].forEach.call(document.querySelectorAll('[data-pw]'), function (btn) {
    btn.addEventListener('click', function () {
      var i = document.getElementById(btn.dataset.pw), show = i.type === 'password';
      i.type = show ? 'text' : 'password'; btn.textContent = show ? 'Ẩn' : 'Hiện'; btn.setAttribute('aria-pressed', String(show));
    });
  });
  [].forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () { var o = btn.textContent; btn.textContent = 'Đã sao chép'; setTimeout(function () { btn.textContent = o; }, 1500); });
  });
})();
