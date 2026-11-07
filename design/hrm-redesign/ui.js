/* Tiện ích dùng chung cho prototype HRM: định dạng vi-VN và toast. Không gọi mạng. */
const vnd = (n) => (n < 0 ? '−' : '') + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' ₫';
const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const dec = (n, d = 1) => n.toFixed(d).replace('.', ',');
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
let toastTm;
function toast(msg, undoFn) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `<span>${msg}</span>${undoFn ? '<button type="button" id="tundo">Hoàn tác</button>' : ''}`; t.hidden = false;
  if (undoFn) t.querySelector('#tundo').addEventListener('click', () => { undoFn(); t.hidden = true; });
  clearTimeout(toastTm); toastTm = setTimeout(() => (t.hidden = true), 6000);
}
