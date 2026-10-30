/* G1 – biểu đồ SVG thuần + bộ lọc kỳ + trạng thái thẻ dashboard (prototype, không phải code production).
   Biểu đồ: <figure class="card g1-chart" data-g1-chart data-g1-card ...><script type="application/json">{cấu hình}</script></figure>
   Cấu hình: id, title, unit, dec, type (line|bars), dir (h|v), mode (grouped|stacked), labels[], series[{name,data[],dash}],
   targets{name,data[]}, catName, valueLabels, snapshot (không phụ thuộc kỳ), foot, byPeriod{7d|today|month:{labels,series}}.
   Mọi biểu đồ có: tên + đơn vị, tooltip (chuột/chạm/focus/phím mũi tên), bảng số liệu thay thế, legend có chữ. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var G1 = window.G1 = window.G1 || {};
  var b = document.body;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fmt(n, d) {
    d = d || 0; var s = Math.abs(n).toFixed(d).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (n < 0 ? '−' : '') + s.join(',');
  }
  function svgEl(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e); return e;
  }
  /* Thoát đủ cho cả nội dung và giá trị thuộc tính. Khi dùng dữ liệu thật: dựng DOM bằng textContent/setAttribute (xem tài liệu, mục rủi ro JS) */
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function nice(max) {
    if (!(max > 0)) return { top: 1, step: 0.25 };
    var raw = max / 4, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), nrm = raw / mag;
    var s = (nrm <= 1 ? 1 : nrm <= 2 ? 2 : nrm <= 2.5 ? 2.5 : nrm <= 5 ? 5 : 10) * mag;
    return { step: s, top: Math.ceil(max / s - 1e-9) * s };
  }
  function tickDec(step) { return step >= 1 && step % 1 === 0 ? 0 : (step < 0.1 ? 2 : 1); }
  function ic(n, c) { return '<svg class="icon' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#' + n + '"/></svg>'; }
  function toast(k, t, x) { if (window.gmepToast) window.gmepToast(k, t, x); }

  /* ---------- Biểu đồ ---------- */
  function currentCfg(fig) {
    var base = fig._base, p = fig._period || 'month', v = base.byPeriod && (base.byPeriod[p] || (p === 'custom' ? base.byPeriod.month : null));
    if (!v) return base;
    var c = {}; for (var k in base) c[k] = base[k]; for (k in v) c[k] = v[k]; return c;
  }
  function buildChart(fig) {
    var base = fig._base;
    var id = 'g1c-' + base.id;
    var sub = 'Đơn vị: <strong>' + esc(base.unit) + '</strong> · ' + (base.fixedScope ? esc(base.fixedScope) : '<span data-branch-label>' + esc(base.scope || 'Tất cả chi nhánh') + '</span>') + ' · ' +
      (base.snapshot ? 'ảnh chụp lúc 09:15 30/10/2026 (không phụ thuộc kỳ lọc)' : '<span data-g1-period-text>' + (G1.PERIODS[b.getAttribute('data-period')] || '') + '</span>');
    var cfg = currentCfg(fig), leg = '';
    cfg.series.forEach(function (s, i) {
      leg += '<li>' + (cfg.type === 'line' ? '<span class="g1-sw g1-sw--line g1-b' + (i + 1) + (s.dash ? ' g1-sw--dash' : '') + '"></span>' : '<span class="g1-sw g1-b' + (i + 1) + '"></span>') + esc(s.name) + '</li>';
    });
    if (cfg.targets) leg += '<li><span class="g1-sw g1-sw--tick"></span>' + esc(cfg.targets.name) + '</li>';
    if (cfg.provisional !== undefined) leg += '<li><span class="g1-sw g1-sw--prov"></span>' + esc(cfg.provNote || 'Số tạm (chưa chốt ngày)') + '</li>';
    fig.innerHTML = '<script type="application/json">' + fig._json + '<\/script>' +
      '<div class="g1-chart__head"><div><h3 class="g1-chart__title" id="' + id + '">' + esc(base.title) + '</h3><p class="g1-chart__unit">' + sub + '</p></div>' +
      '<div class="segmented" role="group" aria-label="Cách xem: ' + esc(base.title) + '"><button class="segmented__item" aria-pressed="true" data-g1-chartview="chart">Biểu đồ</button><button class="segmented__item" aria-pressed="false" data-g1-chartview="table">Bảng số liệu</button></div></div>' +
      '<div class="g1-chart__plot"></div><div class="g1-chart__table" hidden></div><ul class="g1-chart__legend" aria-label="Chú giải">' + leg + '</ul>' +
      (base.foot ? '<p class="g1-chart__foot">' + esc(base.foot) + '</p>' : '');
    fig.setAttribute('aria-labelledby', id);
  }
  function buildTable(fig, cfg) {
    var u = cfg.unit, h = '<th scope="col">' + esc(cfg.catName || 'Mục') + '</th>';
    cfg.series.forEach(function (s) { h += '<th scope="col" class="col-num">' + esc(s.name) + ' (' + esc(u) + ')</th>'; });
    var tot = cfg.mode === 'stacked' || cfg.total;
    if (tot) h += '<th scope="col" class="col-num">Tổng (' + esc(u) + ')</th>';
    if (cfg.targets) h += '<th scope="col" class="col-num">' + esc(cfg.targets.name) + ' (' + esc(u) + ')</th>';
    var rows = '';
    cfg.labels.forEach(function (l, i) {
      var sum = 0, r = '<th scope="row">' + esc(l) + (cfg.provisional === i ? ' (số tạm)' : '') + '</th>';
      cfg.series.forEach(function (s) { sum += s.data[i]; r += '<td class="col-num">' + fmt(s.data[i], cfg.dec) + '</td>'; });
      if (tot) r += '<td class="col-num"><strong>' + fmt(sum, cfg.dec) + '</strong></td>';
      if (cfg.targets) r += '<td class="col-num">' + fmt(cfg.targets.data[i], cfg.dec) + '</td>';
      rows += '<tr>' + r + '</tr>';
    });
    $('.g1-chart__table', fig).innerHTML = '<div class="table-scroll" style="max-height:340px;overflow:auto"><table class="table table--compact"><caption class="sr-only">Số liệu của biểu đồ ' + esc(fig._base.title) + '</caption><thead><tr>' + h + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function draw(fig) {
    var cfg = currentCfg(fig), plot = $('.g1-chart__plot', fig); if (!plot) return;
    plot.innerHTML = '';
    buildTable(fig, cfg);
    var W = Math.max(280, plot.clientWidth || (fig.clientWidth - 48) || 600), n = cfg.labels.length, ns = cfg.series.length;
    var narrow = W < 480, horiz = cfg.type === 'bars' && cfg.dir === 'h', stacked = cfg.mode === 'stacked';
    var ml, mr, mt, mb, H, top, step, band = 0, Lc = 0, Lv = 0, pw = 0, ph = 0;
    var totals = cfg.labels.map(function (_, i) { var t = 0; cfg.series.forEach(function (s) { t += s.data[i]; }); return t; });
    var max = 0;
    cfg.series.forEach(function (s) { s.data.forEach(function (v, i) { var m = stacked ? totals[i] : v; if (m > max) max = m; }); });
    if (cfg.targets) cfg.targets.data.forEach(function (v) { if (v > max) max = v; });
    var sc = nice(max); top = sc.top; step = sc.step;
    var td = tickDec(step);

    if (cfg.type === 'line') {
      ml = 48; mr = 18; mt = 10; mb = 30; H = narrow ? 200 : (cfg.height || 250); pw = W - ml - mr; ph = H - mt - mb;
    } else if (horiz) {
      var longest = 0; cfg.labels.forEach(function (l) { if (l.length > longest) longest = l.length; });
      ml = Math.min(narrow ? 100 : 170, Math.max(80, longest * 7 + 14)); mr = cfg.valueLabels ? 68 : 16; mt = 6; mb = 28;
      band = cfg.band || (stacked ? 44 : ns * 18 + 16); Lc = n * band; Lv = W - ml - mr; H = mt + mb + Lc;
    } else {
      ml = 48; mr = 12; mt = cfg.valueLabels ? 24 : 10; mb = 30; H = narrow ? 230 : (cfg.height || 270); Lc = W - ml - mr; Lv = H - mt - mb; band = Lc / n;
    }
    var svg = svgEl('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'group', tabindex: '0',
      'aria-label': cfg.title + '. ' + n + ' mốc, đơn vị ' + cfg.unit + '. Dùng phím mũi tên trái/phải để xem từng giá trị.' });
    var hl = svgEl('rect', { class: 'g1-hl', x: 0, y: 0, width: 0, height: 0, visibility: 'hidden' }, svg);
    function T(x, y, txt, cls, anchor) { var t = svgEl('text', { x: x, y: y, class: cls || 'g1-ax', 'text-anchor': anchor || 'start' }, svg); t.textContent = txt; return t; }

    var X, Y, cursor, dots = [], R;
    if (cfg.type === 'line') {
      for (var v = 0; v <= top + 1e-9; v += step) {
        var yy = mt + ph - (v / top) * ph;
        svgEl('line', { class: v === 0 ? 'g1-base' : 'g1-grid', x1: ml, x2: ml + pw, y1: yy, y2: yy }, svg);
        T(ml - 8, yy + 4, fmt(v, td), 'g1-ax', 'end');
      }
      X = function (i) { return ml + (n === 1 ? pw / 2 : i * pw / (n - 1)); };
      Y = function (val) { return mt + ph - (val / top) * ph; };
      var k = Math.ceil(n / (narrow ? 4 : 7));
      cfg.labels.forEach(function (l, i) { if (i % k === 0 || i === n - 1 && (n - 1) % k > k / 2) T(X(i), H - 8, l, 'g1-ax', 'middle'); });
      cfg.series.forEach(function (s, si) {
        var prov = !s.dash && cfg.provisional === n - 1 && n > 1;       /* điểm cuối là số tạm: đoạn cuối nét chấm, điểm rỗng */
        var upto = prov ? n - 1 : n;
        var d = s.data.slice(0, upto).map(function (val, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(val).toFixed(1); }).join(' ');
        var attrs = { class: 'g1-line g1-k' + (si + 1), d: d }; if (s.dash) attrs['stroke-dasharray'] = '7 5';
        svgEl('path', attrs, svg);
        if (prov) {
          svgEl('path', { class: 'g1-line g1-k' + (si + 1), 'stroke-dasharray': '2 5', d: 'M' + X(n - 2).toFixed(1) + ' ' + Y(s.data[n - 2]).toFixed(1) + ' L' + X(n - 1).toFixed(1) + ' ' + Y(s.data[n - 1]).toFixed(1) }, svg);
          svgEl('circle', { class: 'g1-open g1-k' + (si + 1), r: 4.5, cx: X(n - 1), cy: Y(s.data[n - 1]) }, svg);
        }
      });
      cursor = svgEl('line', { class: 'g1-cursor', x1: 0, x2: 0, y1: mt, y2: mt + ph, visibility: 'hidden' }, svg);
      cfg.series.forEach(function (s, si) { dots.push(svgEl('circle', { class: 'g1-dot g1-f' + (si + 1), r: 5, cx: 0, cy: 0, visibility: 'hidden' }, svg)); });
    } else {
      var ax0 = ml, ay0 = mt;
      R = function (ci, off, thick, v0, v1) {
        var c0 = ci * band + off, a = v0 / top * Lv, bb = v1 / top * Lv;
        return horiz ? { x: ax0 + a, y: ay0 + c0, w: Math.max(0, bb - a), h: thick } : { x: ax0 + c0, y: ay0 + Lv - bb, w: thick, h: Math.max(0, bb - a) };
      };
      for (var t = 0; t <= top + 1e-9; t += step) {
        if (horiz) { var gx = ml + t / top * Lv; svgEl('line', { class: t === 0 ? 'g1-base' : 'g1-grid', x1: gx, x2: gx, y1: mt, y2: mt + Lc }, svg); T(gx, mt + Lc + 18, fmt(t, td), 'g1-ax', 'middle'); }
        else { var gy = mt + Lv - t / top * Lv; svgEl('line', { class: t === 0 ? 'g1-base' : 'g1-grid', x1: ml, x2: ml + Lc, y1: gy, y2: gy }, svg); T(ml - 8, gy + 4, fmt(t, td), 'g1-ax', 'end'); }
      }
      var gap = horiz ? 14 : Math.min(band * 0.34, 28);
      var thick = stacked ? band - gap : (band - gap) / ns;
      if (!horiz) thick = Math.min(thick, stacked ? 56 : 40);
      var off0 = horiz ? gap / 2 : (band - (stacked ? thick : thick * ns)) / 2;
      cfg.labels.forEach(function (l, i) {
        var lbl = l;
        if (horiz) T(ml - 8, mt + i * band + band / 2 + 4, lbl, 'g1-ax', 'end');
        else { var mc = Math.max(4, Math.floor(band / 6.6)); if (lbl.length > mc) lbl = lbl.slice(0, mc - 1) + '…'; T(ml + i * band + band / 2, H - 8, lbl, 'g1-ax', 'middle'); }
        var run = 0;
        cfg.series.forEach(function (s, si) {
          var val = s.data[i], r = stacked ? R(i, off0, thick, run, run + val) : R(i, off0 + si * thick, thick, 0, val);
          run += val;
          if (r.w > 0 && r.h > 0) svgEl('rect', { class: 'g1-f' + (si + 1) + (stacked ? ' g1-seg' : '') + (cfg.provisional === i ? ' g1-prov' : ''), x: r.x.toFixed(1), y: r.y.toFixed(1), width: r.w.toFixed(1), height: r.h.toFixed(1), rx: stacked ? 0 : 2 }, svg);
          if (cfg.valueLabels && !stacked) {
            if (horiz) T(r.x + r.w + 6, r.y + r.h / 2 + 4, fmt(val, cfg.dec), 'g1-val');
            else T(r.x + r.w / 2, r.y - 6, fmt(val, cfg.dec), 'g1-val', 'middle');
          }
        });
        if (cfg.valueLabels && stacked) {
          var tr = R(i, off0, thick, 0, totals[i]);
          if (horiz) T(tr.x + tr.w + 6, tr.y + tr.h / 2 + 4, fmt(totals[i], cfg.dec), 'g1-val');
          else T(tr.x + tr.w / 2, tr.y - 6, fmt(totals[i], cfg.dec), 'g1-val', 'middle');
        }
        if (cfg.targets) {
          var tv = cfg.targets.data[i], tp = tv / top * Lv;
          if (horiz) svgEl('line', { class: 'g1-target', x1: ml + tp, x2: ml + tp, y1: mt + i * band + 3, y2: mt + (i + 1) * band - 3 }, svg);
          else svgEl('line', { class: 'g1-target', x1: ml + i * band + 4, x2: ml + (i + 1) * band - 4, y1: mt + Lv - tp, y2: mt + Lv - tp }, svg);
        }
      });
    }
    plot.appendChild(svg);

    /* Tooltip + tương tác */
    var tip = document.createElement('div'); tip.className = 'g1-tip'; tip.setAttribute('aria-hidden', 'true'); tip.hidden = true; plot.appendChild(tip);
    var sr = document.createElement('span'); sr.className = 'sr-only'; sr.setAttribute('aria-live', 'polite'); plot.appendChild(sr);
    var active = -1;
    function hide() {
      active = -1; tip.hidden = true; hl.setAttribute('visibility', 'hidden');
      if (cursor) cursor.setAttribute('visibility', 'hidden'); dots.forEach(function (d) { d.setAttribute('visibility', 'hidden'); });
    }
    function show(i, kb) {
      i = Math.max(0, Math.min(n - 1, i)); if (i === active) return; active = i;
      var lab = cfg.labels[i] + (cfg.provisional === i ? ' (số tạm)' : '');
      var html = '<b>' + esc(lab) + '</b>', speak = lab + ': ', sum = 0;
      cfg.series.forEach(function (s, si) {
        sum += s.data[i];
        html += '<span><span><i class="g1-b' + (si + 1) + '"></i>' + esc(s.name) + '</span><strong>' + fmt(s.data[i], cfg.dec) + ' ' + esc(cfg.unit) + '</strong></span>';
        speak += s.name + ' ' + fmt(s.data[i], cfg.dec) + ' ' + cfg.unit + '; ';
      });
      if (stacked) { html += '<span><span>Tổng</span><strong>' + fmt(sum, cfg.dec) + ' ' + esc(cfg.unit) + '</strong></span>'; speak += 'tổng ' + fmt(sum, cfg.dec) + '. '; }
      if (cfg.targets) { html += '<span><span>' + esc(cfg.targets.name) + '</span><strong>' + fmt(cfg.targets.data[i], cfg.dec) + ' ' + esc(cfg.unit) + '</strong></span>'; speak += cfg.targets.name + ' ' + fmt(cfg.targets.data[i], cfg.dec) + '.'; }
      tip.innerHTML = html; tip.hidden = false; if (kb) sr.textContent = speak;   /* chỉ đọc khi dùng bàn phím, tránh ồn khi rê chuột; bảng số liệu là đường chính cho trình đọc màn hình */
      var tw = tip.offsetWidth, th = tip.offsetHeight, lx, ly;
      if (cfg.type === 'line') {
        var cx = X(i); cursor.setAttribute('x1', cx); cursor.setAttribute('x2', cx); cursor.setAttribute('visibility', 'visible');
        cfg.series.forEach(function (s, si) { dots[si].setAttribute('cx', cx); dots[si].setAttribute('cy', Y(s.data[i])); dots[si].setAttribute('visibility', 'visible'); });
        lx = cx + 14; if (lx + tw > W) lx = cx - tw - 14; ly = mt + 4;
      } else if (horiz) {
        hl.setAttribute('x', ml); hl.setAttribute('y', mt + i * band); hl.setAttribute('width', Lv); hl.setAttribute('height', band); hl.setAttribute('visibility', 'visible');
        lx = ml + Math.min(Lv * 0.4, Lv - tw); if (lx < 0) lx = 4; ly = mt + (i + 1) * band + 2; if (ly + th > H) ly = mt + i * band - th - 2; if (ly < 0) ly = 0;
      } else {
        hl.setAttribute('x', ml + i * band); hl.setAttribute('y', mt); hl.setAttribute('width', band); hl.setAttribute('height', Lv); hl.setAttribute('visibility', 'visible');
        lx = ml + (i + 1) * band + 6; if (lx + tw > W) lx = ml + i * band - tw - 6; if (lx < 0) lx = 4; ly = mt + 6;
      }
      tip.style.left = Math.max(0, lx) + 'px'; tip.style.top = ly + 'px';
    }
    function idxAt(e) {
      var r = svg.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (cfg.type === 'line') return n === 1 ? 0 : Math.round((x - ml) / (pw / (n - 1)));
      return Math.floor(((horiz ? y - mt : x - ml)) / band);
    }
    svg.addEventListener('pointermove', function (e) { var i = idxAt(e); if (i >= 0 && i < n) show(i); else hide(); });
    svg.addEventListener('pointerdown', function (e) { var i = idxAt(e); if (i >= 0 && i < n) { active = -1; show(i); } });
    svg.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse' && document.activeElement !== svg) hide(); });
    svg.addEventListener('focus', function () { show(active < 0 ? 0 : active, true); });
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', function (e) {
      var cur = active < 0 ? 0 : active, nx = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nx = cur + 1;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nx = cur - 1;
      else if (e.key === 'Home') nx = 0; else if (e.key === 'End') nx = n - 1;
      else if (e.key === 'Escape') { hide(); return; }
      if (nx !== null) { e.preventDefault(); active = -1; show(nx, true); }
    });
  }
  function initChart(fig) {
    if (!fig._base) {
      var sc = $('script[type="application/json"]', fig); if (!sc) return;
      fig._json = sc.textContent; fig._base = JSON.parse(fig._json); fig._period = b.getAttribute('data-period') || 'month';
    }
    if (!$('.g1-chart__plot', fig)) buildChart(fig);
    draw(fig);
  }
  function initCharts(root) { $$('[data-g1-chart]', root || document).forEach(initChart); }
  G1.initCharts = initCharts;

  document.addEventListener('click', function (e) {
    var how = e.target.closest('[data-g1-how]');
    if (how) { var pn = document.getElementById(how.getAttribute('data-g1-how')); var open = how.getAttribute('aria-expanded') !== 'true'; how.setAttribute('aria-expanded', String(open)); if (pn) pn.hidden = !open; return; }
    var v = e.target.closest('[data-g1-chartview]'); if (!v) return;
    var fig = v.closest('[data-g1-chart]'), chart = v.getAttribute('data-g1-chartview') === 'chart';
    $$('[data-g1-chartview]', fig).forEach(function (x) { x.setAttribute('aria-pressed', String(x === v)); });
    $('.g1-chart__plot', fig).hidden = !chart; $('.g1-chart__table', fig).hidden = chart;
    if (chart) draw(fig);
  });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { $$('[data-g1-chart]').forEach(function (f) { if (f._base && !$('.g1-chart__plot', f).hidden) draw(f); }); }, 150); });

  /* ---------- Bộ lọc kỳ + chi nhánh ---------- */
  var DATE_RE = /^(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])\/(20\d{2})$/;
  function parseD(s) { var m = DATE_RE.exec(s.trim()); if (!m) return null; var d = new Date(+m[3], +m[2] - 1, +m[1]); return d.getDate() === +m[1] ? d : null; }
  function setPeriod(p, text) {
    b.setAttribute('data-period', p);
    $$('[data-g1-period-text]').forEach(function (x) { x.textContent = text || G1.PERIODS[p]; });
    $$('[data-g1-chart]').forEach(function (f) { if (f._base) { f._period = p; if (f._base.byPeriod) { var sc = $('script[type="application/json"]', f); buildChart(f); draw(f); } } });
  }
  function renderFilter(host) {
    var role = b.getAttribute('data-role') || 'CH', periods = (host.getAttribute('data-periods') || 'today,7d,month').split(','), def = host.getAttribute('data-default') || 'month';
    var pick = ['CH', 'QV', 'QL', 'KT'].indexOf(role) >= 0, none = host.hasAttribute('data-no-branch');
    var seg = periods.map(function (p) { return '<button class="segmented__item" aria-pressed="' + (p === def) + '" data-g1-period="' + p + '">' + G1.PERIOD_NAMES[p] + '</button>'; }).join('') +
      '<button class="segmented__item" aria-pressed="false" data-g1-period="custom">Tùy chọn</button>';
    var branch = none ? '' : '<div class="g1-filter__item"><span class="g1-filter__label" id="g1-fl-b">Chi nhánh</span>' + (pick ?
      '<button class="btn btn--secondary" data-g1-branch-open aria-labelledby="g1-fl-b g1-fl-bv">' + ic('map-pin') + '<span id="g1-fl-bv" data-branch-label>' + (role === 'QV' ? 'Tất cả nhóm được giao' : role === 'CH' ? 'Tất cả chi nhánh' : 'Chi nhánh Quận 7') + '</span>' + ic('chevron-down', 'icon--sm') + '</button>' :
      '<span class="row" style="min-height:40px">' + ic('map-pin') + '<strong>Chi nhánh Quận 7</strong><span class="t-caption text-secondary">(chi nhánh của bạn)</span></span>') + '</div>';
    host.className = 'g1-filter'; host.setAttribute('role', 'group'); host.setAttribute('aria-label', 'Bộ lọc dashboard: thời gian và chi nhánh');
    host.innerHTML = '<div class="g1-filter__item"><span class="g1-filter__label" id="g1-fl-t">Khoảng thời gian</span><div class="segmented" role="group" aria-labelledby="g1-fl-t">' + seg + '</div></div>' +
      '<div class="g1-filter__custom" hidden><div class="field"><label class="field__label" for="g1-from">Từ ngày</label><input id="g1-from" class="input" inputmode="numeric" placeholder="dd/MM/yyyy" value="01/10/2026"></div>' +
      '<div class="field"><label class="field__label" for="g1-to">Đến ngày</label><input id="g1-to" class="input" inputmode="numeric" placeholder="dd/MM/yyyy" value="30/10/2026"></div><button class="btn btn--secondary" data-g1-apply>Áp dụng</button><span class="field__error" data-g1-cerr hidden></span></div>' +
      branch + '<div class="g1-filter__asof"><span>Cập nhật lúc <strong data-g1-asof>09:15</strong></span><button class="btn btn--ghost btn--sm" data-g1-refresh>' + ic('refresh', 'icon--sm') + 'Làm mới</button><button class="btn btn--ghost btn--sm" data-g1-reset>Đặt lại mặc định</button></div>';
    host._def = def;
  }
  $$('[data-g1-filter]').forEach(renderFilter);
  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-g1-period]');
    if (p) {
      var f = p.closest('.g1-filter'), val = p.getAttribute('data-g1-period');
      $$('[data-g1-period]', f).forEach(function (x) { x.setAttribute('aria-pressed', String(x === p)); });
      $('.g1-filter__custom', f).hidden = val !== 'custom';
      if (val !== 'custom') setPeriod(val);
    }
    if (e.target.closest('[data-g1-apply]')) {
      var f2 = e.target.closest('.g1-filter'), a = parseD($('#g1-from', f2).value), z = parseD($('#g1-to', f2).value), er = $('[data-g1-cerr]', f2);
      var TODAY = new Date(2026, 9, 30);
      var msg = !a || !z ? 'Nhập ngày theo dd/MM/yyyy, ví dụ 01/10/2026.' : a > z ? 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.' : z > TODAY ? 'Không chọn được ngày trong tương lai. Chọn đến hết 30/10/2026.' : (z - a) / 86400000 + 1 > 366 ? 'Khoảng ngày tối đa 366 ngày (để báo cáo toàn chuỗi vẫn nhanh). Chọn khoảng ngắn hơn.' : '';
      er.hidden = !msg; er.innerHTML = msg ? ic('alert-triangle') + msg : '';
      $('#g1-from', f2).setAttribute('aria-invalid', String(!!msg)); $('#g1-to', f2).setAttribute('aria-invalid', String(!!msg));
      if (!msg) { setPeriod('custom', $('#g1-from', f2).value + ' – ' + $('#g1-to', f2).value); toast('info', 'Đã áp dụng khoảng ngày', 'Prototype: số KPI là số mẫu cố định.'); }
    }
    if (e.target.closest('[data-g1-reset]')) {
      var f3 = e.target.closest('.g1-filter'), d = f3._def; $$('[data-g1-period]', f3).forEach(function (x) { x.setAttribute('aria-pressed', String(x.getAttribute('data-g1-period') === d)); });
      $('.g1-filter__custom', f3).hidden = true; setPeriod(d); toast('info', 'Đã đặt lại bộ lọc', 'Về kỳ và phạm vi mặc định của vai trò.');
    }
    if (e.target.closest('[data-g1-branch-open]')) { var bb = $('.branch-btn'); if (bb) bb.click(); }
    if (e.target.closest('[data-g1-refresh]')) {
      $$('[data-g1-asof]').forEach(function (x) { x.textContent = '09:16'; }); toast('info', 'Đã làm mới', 'Dữ liệu cập nhật lúc 09:16.');
    }
  });

  /* ---------- Trạng thái thẻ (loading / rỗng / lỗi từng thẻ / không quyền / cũ / mất mạng) ---------- */
  /* Chỉ hiện nút xem thử khi dashboard có thẻ minh họa trạng thái đó (tránh “0 khối đã ẩn”) */
  var STATES = [['normal', 'Bình thường'], ['loading', 'Đang tải']];
  if ($('[data-g1-empty]')) STATES.push(['empty', 'Trống']);
  if ($('[data-g1-err]')) STATES.push(['error', 'Lỗi một số thẻ']);
  if ($('[data-g1-deny]')) STATES.push(['denied', 'Thiếu quyền']);
  STATES.push(['stale', 'Dữ liệu cũ'], ['offline', 'Mất kết nối']);
  if ($('[data-g1-multi]')) STATES.push(['pilot', 'Pilot 1 chi nhánh']);
  $$('[data-g1-proto]').forEach(function (h) {
    h.className = 'g1-proto';
    h.innerHTML = '<span class="g1-proto__label">Xem thử trạng thái (chỉ prototype)</span><div class="segmented" role="group" aria-label="Trạng thái thẻ để xem thử">' +
      STATES.map(function (s, i) { return '<button class="segmented__item" aria-pressed="' + (i === 0) + '" data-g1-state="' + s[0] + '">' + s[1] + '</button>'; }).join('') + '</div>' +
      '<span>Đổi kỳ chỉ cập nhật nhãn và biểu đồ đường; số KPI là số mẫu cố định.</span>';
  });
  function title(c) { return c.getAttribute('data-g1-title') || 'khối này'; }
  function skeleton(c) {
    var kp = c.classList.contains('kpi');
    return '<div class="' + (kp ? '' : 'card__body') + ' stack-2" aria-busy="true"><span class="skeleton skeleton--text" style="width:45%"></span><span class="skeleton skeleton--kpi"></span>' + (kp ? '' : '<span class="skeleton skeleton--block"></span>') + '<span class="skeleton skeleton--text" style="width:70%"></span><span class="sr-only">Đang tải ' + title(c) + '</span></div>';
  }
  function errMark(c) {
    if (c.classList.contains('kpi')) return '<span class="kpi__label">' + ic('alert-triangle', 'icon--sm') + esc(title(c)) + '</span><span class="state__text">Không tải được số liệu này.</span><button class="btn btn--secondary btn--sm" data-g1-retry style="align-self:flex-start">Thử lại</button><span class="state__ref">Mã tham chiếu ERR-20261030-0915-A7</span>';
    return '<div class="state"><div class="state__icon state__icon--danger">' + ic('alert-triangle', 'icon--lg') + '</div><div class="state__title">Không tải được “' + esc(title(c)) + '”</div><p class="state__text">Các khối khác vẫn dùng bình thường. Kiểm tra kết nối rồi thử lại; nếu vẫn lỗi, báo mã tham chiếu cho quản trị hệ thống.</p><div class="state__actions"><button class="btn btn--secondary" data-g1-retry>Thử lại</button></div><span class="state__ref">Mã tham chiếu ERR-20261030-0915-A7</span></div>';
  }
  function emptyMark(c) {
    var p = (c.getAttribute('data-g1-empty') || '').split('|');
    if (c.classList.contains('kpi')) return '<span class="kpi__label">' + esc(title(c)) + '</span><span class="kpi__value">0</span><span class="kpi__meta">' + esc(p[0] || 'Chưa có dữ liệu trong kỳ') + '</span>';
    return '<div class="state"><div class="state__icon state__icon--brand">' + ic('inbox', 'icon--lg') + '</div><div class="state__title">' + esc(p[0] || 'Chưa có dữ liệu trong kỳ này') + '</div><p class="state__text">' + esc(p[1] || 'Khi có phát sinh, dữ liệu sẽ hiện ở đây.') + '</p></div>';
  }
  /* Thẻ KPI là <a>: khi chứa nút (Thử lại) phải đổi thành <div> để không lồng <button> trong <a>; khôi phục lại <a> khi tải lại */
  function retag(c, tag, href) {
    var n = document.createElement(tag);
    Array.prototype.forEach.call(c.attributes, function (a) { if (a.name !== 'href') n.setAttribute(a.name, a.value); });
    if (href) n.setAttribute('href', href);
    n.innerHTML = c.innerHTML; n._g1orig = c._g1orig; n._g1cls = c._g1cls; n._g1href = tag === 'DIV' ? c.getAttribute('href') : undefined;
    c.parentNode.replaceChild(n, c); return n;
  }
  function restore(c) {
    if (c._g1orig === undefined) return;
    c.innerHTML = c._g1orig; c.className = c._g1cls; c.hidden = false; c._g1orig = undefined;
    if (c._g1href) c = retag(c, 'A', c._g1href);
    if (c.hasAttribute('data-g1-chart')) initChart(c); else initCharts(c);
  }
  function setCard(c, html, cls) {
    if (c.tagName === 'A') c = retag(c, 'DIV');
    if (c._g1orig === undefined) { c._g1orig = c.innerHTML; c._g1cls = c.className; }
    c.innerHTML = html; if (cls) c.classList.add(cls); return c;
  }
  function chip(c, text, cls) {
    var t = c.querySelector('.kpi__scope, .card__subtitle, .g1-chart__unit'); if (!t) return;
    t.insertAdjacentHTML('beforeend', ' <span class="tag ' + cls + ' g1-chip-state">' + esc(text) + '</span>'); c.classList.add('g1-stale');
  }
  function applyState(name) {
    $$('[data-g1-card]').forEach(restore);
    $$('.g1-statebar, .g1-chip-state').forEach(function (x) { x.remove(); });
    $$('.g1-stale').forEach(function (x) { x.classList.remove('g1-stale'); });
    var nb = $('.net-banner'); if (nb) nb.classList.toggle('is-visible', name === 'offline');
    var first = $('[data-g1-card]'), anchor = first ? first.closest('.g1-kpis') || first.parentNode : null;
    var hidden = [];
    $$('[data-g1-card]').forEach(function (c) {
      if (name === 'loading') setCard(c, skeleton(c));
      else if (name === 'error' && c.hasAttribute('data-g1-err')) setCard(c, errMark(c));
      else if (name === 'empty' && c.hasAttribute('data-g1-empty')) setCard(c, emptyMark(c));
      else if (name === 'denied' && c.hasAttribute('data-g1-deny')) { hidden.push(title(c)); c = setCard(c, c.innerHTML); c.hidden = true; }
      else if (name === 'stale') chip(c, 'Cập nhật 07:58', 'tag--warning');
      else if (name === 'offline') chip(c, 'Số lúc 09:14', 'tag--neutral');
    });
    var msg = '';
    if (name === 'pilot') {
      $$('[data-g1-multi]').forEach(function (m) { if (m._g1h === undefined) { m._g1h = true; } m.hidden = true; });
      msg = '<div class="alert alert--info g1-statebar" role="status">' + ic('info') + '<div class="alert__body"><span class="alert__title">Giai đoạn pilot: hệ thống chỉ có một chi nhánh</span><span>Các khối so sánh giữa chi nhánh được ẩn; chúng tự hiện khi thêm chi nhánh (chỉ là cấu hình).</span></div></div>';
    } else $$('[data-g1-multi]').forEach(function (m) { m.hidden = false; });
    if (name === 'stale') msg = '<div class="alert alert--warning g1-statebar" role="status">' + ic('clock') + '<div class="alert__body"><span class="alert__title">Dữ liệu có thể đã cũ</span><span>Lần cập nhật gần nhất lúc 07:58 (chậm 1 giờ 17 phút). Các con số bên dưới chưa phản ánh giao dịch mới. Thử làm mới hoặc kiểm tra kết nối.</span><div class="alert__actions"><button class="btn btn--secondary btn--sm" data-g1-refresh>Làm mới</button></div></div></div>';
    if (name === 'denied') msg = '<div class="alert alert--neutral g1-statebar" role="status">' + ic('lock') + '<div class="alert__body"><span class="alert__title">' + hidden.length + ' khối đã ẩn do vai trò hiện tại chưa được cấp quyền</span><span>' + (hidden.length ? esc(hidden.join(', ')) + '. ' : '') + 'Cần xem thêm? Liên hệ quản lý chi nhánh hoặc quản trị hệ thống để được cấp quyền.</span></div></div>';
    if (name === 'error') msg = '<div class="alert alert--danger g1-statebar" role="alert">' + ic('alert-triangle') + '<div class="alert__body"><span class="alert__title">Một số khối không tải được</span><span>Các khối còn lại vẫn đúng và dùng được. Bấm “Thử lại” ở từng khối bị lỗi.</span></div></div>';
    if (msg && anchor) anchor.insertAdjacentHTML('beforebegin', msg);
  }
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-g1-state]');
    if (s) { $$('[data-g1-state]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === s)); }); applyState(s.getAttribute('data-g1-state')); }
    var r = e.target.closest('[data-g1-retry]');
    if (r) { var c = r.closest('[data-g1-card]'); if (c) { restore(c); toast('success', 'Đã tải lại', title(c) + ' đã cập nhật.'); } }
  });
  var q = /[?&]state=([a-z]+)/.exec(location.search);
  initCharts();
  if (q) { var sb = $('[data-g1-state="' + q[1] + '"]'); if (sb) sb.click(); }
})();
