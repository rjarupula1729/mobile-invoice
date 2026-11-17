'use strict';

const APP_VERSION = 'v13';

const $ = (id) => document.getElementById(id);

const VEGETABLES = [
  'Tomato', 'Onion', 'Potato', 'Carrot', 'Beans', 'Cabbage', 'Cauliflower',
  'Brinjal', 'Okra', 'Green Peas', 'Spinach', 'Coriander', 'Green Chilli',
  'Ginger', 'Garlic', 'Lemon', 'Cucumber', 'Capsicum', 'Beetroot',
  'Bottle Gourd', 'Bitter Gourd', 'Pumpkin', 'Radish', 'Drumstick',
  'Curry Leaves', 'Mint', 'Banana', 'Coconut', 'Sweet Potato', 'Mushroom'
];

const LS = {
  settings: 'ci_settings', draft: 'ci_draft', counter: 'ci_counter',
  customVeg: 'ci_custom_veg', sales: 'ci_sales'
};

let settings = { shopName: '', shopAddress: '', shopPhone: '', currency: 'Rs' };
let items = [];
let invoiceCounter = 1;
let customVeg = [];
let sales = []; // completed bills: {no, iso, time, cust, items, subtotal, discount, total}
let billRecorded = false; // current bill already logged to today's sales

/* ---------- persistence ---------- */

function saveAll() {
  localStorage.setItem(LS.settings, JSON.stringify(settings));
  localStorage.setItem(LS.draft, JSON.stringify({
    items,
    custName: $('custName').value,
    custPhone: $('custPhone').value,
    discount: $('discount').value
  }));
}

function loadAll() {
  try {
    const s = JSON.parse(localStorage.getItem(LS.settings));
    if (s) settings = { ...settings, ...s };
  } catch (e) {}
  invoiceCounter = parseInt(localStorage.getItem(LS.counter), 10) || 1;
  try {
    const cv = JSON.parse(localStorage.getItem(LS.customVeg));
    if (Array.isArray(cv)) customVeg = cv;
  } catch (e) {}
  try {
    const sl = JSON.parse(localStorage.getItem(LS.sales));
    if (Array.isArray(sl)) {
      const cutoff = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
      sales = sl.filter(s => s.iso >= cutoff); // keep storage small: drop >90 days
    }
  } catch (e) {}
  try {
    const d = JSON.parse(localStorage.getItem(LS.draft));
    if (d) {
      items = Array.isArray(d.items) ? d.items : [];
      $('custName').value = d.custName || '';
      $('custPhone').value = d.custPhone || '';
      $('discount').value = d.discount || '';
    }
  } catch (e) {}
}

/* ---------- helpers ---------- */

function money(n) {
  return (settings.currency || 'Rs') + ' ' + Number(n || 0).toFixed(2);
}

function pdfMoney(n) {
  // jsPDF standard fonts only support Latin-1; fall back to "Rs" for symbols like ₹
  const sym = [...(settings.currency || 'Rs')].every(c => c.codePointAt(0) <= 0xff)
    ? settings.currency : 'Rs';
  return sym + ' ' + Number(n || 0).toFixed(2);
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) || n < 0 ? 0 : n;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmtDate(iso) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '-' + MONTHS[+m[2] - 1] + '-' + m[1] : iso;
}

function todayIso() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
}

function setStatus(msg, cls) {
  const el = $('statusMsg');
  el.textContent = msg || '';
  el.className = 'status center ' + (cls || 'muted');
}

/* ---------- rendering ---------- */

function renderSettings() {
  $('shopName').value = settings.shopName;
  $('shopAddress').value = settings.shopAddress;
  $('shopPhone').value = settings.shopPhone;
  $('currency').value = settings.currency;
  $('settingsSummary').textContent = settings.shopName ? '— ' + settings.shopName : '';
}

function renderItems() {
  const list = $('itemsList');
  list.innerHTML = '';
  items.forEach((it, i) => {
    const row = document.createElement('div');
    row.className = 'item-row';

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = it.name;

    const qty = document.createElement('input');
    qty.type = 'number'; qty.min = '0'; qty.step = 'any';
    qty.value = it.qty;
    qty.title = 'Quantity (' + it.unit + ')';
    qty.addEventListener('change', () => {
      items[i].qty = num(qty.value);
      renderTotals(); saveAll();
    });
    const qtyWrap = document.createElement('div');
    qtyWrap.appendChild(qty);
    const unitTag = document.createElement('span');
    unitTag.className = 'unit-tag';
    unitTag.textContent = it.unit;
    qtyWrap.appendChild(unitTag);

    const rate = document.createElement('input');
    rate.type = 'number'; rate.min = '0'; rate.step = 'any';
    rate.value = it.rate;
    rate.title = 'Rate per ' + it.unit;
    rate.addEventListener('change', () => {
      items[i].rate = num(rate.value);
      renderTotals(); saveAll();
    });

    const amt = document.createElement('div');
    amt.className = 'amount';
    amt.dataset.idx = i;
    amt.textContent = (it.qty * it.rate).toFixed(2);

    const rm = document.createElement('button');
    rm.className = 'remove-btn';
    rm.type = 'button';
    rm.textContent = '×';
    rm.title = 'Remove item';
    rm.addEventListener('click', () => {
      items.splice(i, 1);
      renderItems(); renderTotals(); saveAll();
    });

    row.append(name, qtyWrap, rate, amt, rm);
    list.appendChild(row);
  });
  $('emptyMsg').classList.toggle('hidden', items.length > 0);
  $('itemCount').textContent = items.length ? '(' + items.length + ')' : '';
}

function renderTotals() {
  let sub = 0;
  items.forEach((it, i) => {
    const amt = it.qty * it.rate;
    sub += amt;
    const el = document.querySelector('.amount[data-idx="' + i + '"]');
    if (el) el.textContent = amt.toFixed(2);
  });
  const disc = num($('discount').value);
  $('subtotal').textContent = money(sub);
  $('grandTotal').textContent = money(Math.max(0, sub - disc));
}

/* ---------- item entry ---------- */

function addItem() {
  const name = $('itemName').value.trim();
  const qty = num($('itemQty').value);
  const rate = num($('itemRate').value);
  if (!name) { setStatus('Enter an item name.', 'err'); $('itemName').focus(); return; }
  if (qty <= 0) { setStatus('Enter a quantity.', 'err'); $('itemQty').focus(); return; }
  items.push({ name, qty, unit: $('itemUnit').value, rate });
  $('itemName').value = ''; $('itemQty').value = ''; $('itemRate').value = '';
  $('itemName').focus();
  renderItems(); renderTotals(); saveAll();
  setStatus('', '');
}

function allVeg() {
  return VEGETABLES.concat(customVeg);
}

function buildQuickItems() {
  const wrap = $('quickItems');
  const dl = $('vegList');
  wrap.innerHTML = '';
  dl.innerHTML = '';
  allVeg().forEach(v => {
    const chip = document.createElement('button');
    chip.type = 'button';
    const isCustom = customVeg.some(c => c.toLowerCase() === v.toLowerCase());
    chip.className = 'chip' + (isCustom ? ' custom' : '');
    chip.textContent = v;
    chip.addEventListener('click', () => {
      $('itemName').value = v;
      $('itemQty').focus();
    });
    if (isCustom) {
      const x = document.createElement('span');
      x.className = 'chip-x';
      x.textContent = '×';
      x.title = 'Remove "' + v + '" from list';
      x.addEventListener('click', (e) => {
        e.stopPropagation();
        customVeg = customVeg.filter(c => c.toLowerCase() !== v.toLowerCase());
        localStorage.setItem(LS.customVeg, JSON.stringify(customVeg));
        buildQuickItems();
      });
      chip.appendChild(x);
    }
    wrap.appendChild(chip);
    const opt = document.createElement('option');
    opt.value = v;
    dl.appendChild(opt);
  });
}

function addVeg() {
  const name = $('newVeg').value.trim().replace(/\s+/g, ' ');
  if (!name) return;
  if (allVeg().some(v => v.toLowerCase() === name.toLowerCase())) {
    setStatus('"' + name + '" is already in the list.', 'err');
    $('newVeg').value = '';
    return;
  }
  customVeg.push(name);
  localStorage.setItem(LS.customVeg, JSON.stringify(customVeg));
  $('newVeg').value = '';
  buildQuickItems();
  setStatus('Added "' + name + '" to quick pick.', 'ok');
}

/* ---------- PDF ---------- */

function invoiceData() {
  return {
    shopName: settings.shopName || 'Vegetable Shop',
    shopAddress: settings.shopAddress,
    shopPhone: settings.shopPhone,
    no: $('invoiceNo').value.trim() || String(invoiceCounter),
    date: fmtDate($('invoiceDate').value || new Date().toISOString().slice(0, 10)),
    custName: $('custName').value.trim(),
    items,
    discount: num($('discount').value),
    subtotal: items.reduce((s, it) => s + it.qty * it.rate, 0)
  };
}

function buildPdf(d) {
  const { jsPDF } = window.jspdf;
  const W = 80, M = 5; // 80mm receipt width, 5mm margins
  const inner = W - 2 * M;
  const COL = { name: 30, qty: 47, rate: 61 }; // name wrap width; qty/rate right edges (amt = W-M)

  // One layout routine, run twice: draw=false measures the exact height,
  // draw=true renders onto a page sized to fit — nothing gets clipped.
  function layout(doc, draw) {
    let y = 8;
    const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size); };
    const text = (t, x, yy, o) => { if (draw) doc.text(t, x, yy, o); };
    const dash = () => {
      if (draw) {
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(M, y, W - M, y);
        doc.setLineDashPattern([], 0);
      }
      y += 3;
    };

    // header
    font('bold', 13);
    doc.splitTextToSize(d.shopName, inner).forEach(l => {
      text(l, W / 2, y, { align: 'center' }); y += 4.5;
    });
    font('normal', 7.5);
    if (d.shopAddress) {
      doc.splitTextToSize(d.shopAddress, inner).forEach(l => {
        text(l, W / 2, y, { align: 'center' }); y += 3.2;
      });
    }
    if (d.shopPhone) { text('Ph: ' + d.shopPhone, W / 2, y, { align: 'center' }); y += 3.2; }
    y += 1;
    dash();

    // meta
    font('normal', 8);
    text('Invoice: ' + d.no, M, y);
    text('Date: ' + d.date, W - M, y, { align: 'right' });
    y += 3.6;
    if (d.custName) { text('Customer: ' + d.custName, M, y); y += 3.6; }
    dash();

    // table header
    font('bold', 8);
    text('Item', M, y);
    text('Qty', COL.qty, y, { align: 'right' });
    text('Rate', COL.rate, y, { align: 'right' });
    text('Amt', W - M, y, { align: 'right' });
    y += 1.5;
    dash();

    // rows
    font('normal', 8);
    d.items.forEach(it => {
      const lines = doc.splitTextToSize(it.name, COL.name);
      text(lines, M, y);
      text(it.qty + ' ' + it.unit, COL.qty, y, { align: 'right' });
      text(it.rate.toFixed(2), COL.rate, y, { align: 'right' });
      text((it.qty * it.rate).toFixed(2), W - M, y, { align: 'right' });
      y += lines.length * 3.6 + 1.2;
    });
    dash();

    // totals
    const total = Math.max(0, d.subtotal - d.discount);
    text('Subtotal', M, y);
    text(pdfMoney(d.subtotal), W - M, y, { align: 'right' });
    y += 3.6;
    if (d.discount > 0) {
      text('Discount', M, y);
      text('- ' + pdfMoney(d.discount), W - M, y, { align: 'right' });
      y += 3.6;
    }
    font('bold', 11);
    text('TOTAL', M, y + 0.5);
    text(pdfMoney(total), W - M, y + 0.5, { align: 'right' });
    y += 5;
    dash();

    font('normal', 7.5);
    text('Thank you! Visit again.', W / 2, y, { align: 'center' });
    return y;
  }

  const measure = new jsPDF({ unit: 'mm', format: [W, 400] });
  const height = layout(measure, false) + 6; // + bottom margin
  // jsPDF swaps format dims to match the declared orientation — for a short
  // receipt (W > height) 'portrait' would flip the page to height × W and clip
  // the right columns. Declare 'landscape' in that case so dims stay [W, H].
  const doc = new jsPDF({
    unit: 'mm',
    format: [W, height],
    orientation: height > W ? 'portrait' : 'landscape'
  });
  layout(doc, true);

  const fileName = 'invoice-' + d.no + '.pdf';
  return { blob: doc.output('blob'), fileName, doc };
}

/* ---------- review ---------- */

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showReview() {
  if (!items.length) { setStatus('Add at least one item first.', 'err'); return; }
  const d = invoiceData();
  const total = Math.max(0, d.subtotal - d.discount);

  let h = '<div class="r-shop">' + esc(d.shopName) + '</div>';
  if (d.shopAddress) h += '<div class="r-sub">' + esc(d.shopAddress) + '</div>';
  if (d.shopPhone) h += '<div class="r-sub">Ph: ' + esc(d.shopPhone) + '</div>';
  h += '<div class="r-dash"></div>';
  h += '<div class="r-row"><span>Invoice: ' + esc(d.no) + '</span><span>' + esc(d.date) + '</span></div>';
  if (d.custName) h += '<div>Customer: ' + esc(d.custName) + '</div>';
  h += '<div class="r-dash"></div>';
  h += '<table><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr>';
  d.items.forEach(it => {
    h += '<tr><td class="c1">' + esc(it.name) + '</td>'
      + '<td class="r c2">' + it.qty + ' ' + esc(it.unit) + '</td>'
      + '<td class="r c3">' + it.rate.toFixed(2) + '</td>'
      + '<td class="r c4">' + (it.qty * it.rate).toFixed(2) + '</td></tr>';
  });
  h += '</table><div class="r-dash"></div>';
  h += '<div class="r-row"><span>Subtotal</span><span>' + esc(money(d.subtotal)) + '</span></div>';
  if (d.discount > 0) {
    h += '<div class="r-row"><span>Discount</span><span>- ' + esc(money(d.discount)) + '</span></div>';
  }
  h += '<div class="r-row r-total"><span>TOTAL</span><span>' + esc(money(total)) + '</span></div>';
  h += '<div class="r-dash"></div><div class="r-thanks">Thank you! Visit again.</div>';

  $('receiptPreview').innerHTML = h;
  $('reviewModal').classList.remove('hidden');
}

function hideReview() {
  $('reviewModal').classList.add('hidden');
}

function openPdf() {
  if (!items.length) { setStatus('Add at least one item first.', 'err'); return; }
  const { blob } = buildPdf(invoiceData());
  window.open(URL.createObjectURL(blob), '_blank');
}

/* ---------- share / download ---------- */

async function sharePdf() {
  if (!items.length) { setStatus('Add at least one item first.', 'err'); return; }
  const { blob, fileName } = buildPdf(invoiceData());
  const file = new File([blob], fileName, { type: 'application/pdf' });
  const total = $('grandTotal').textContent;

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Invoice ' + fileName,
        text: 'Invoice ' + $('invoiceNo').value + ' — Total ' + total
      });
      setStatus('Invoice shared.', 'ok');
      return;
    } catch (e) {
      if (e.name === 'AbortError') return; // user cancelled the share sheet
    }
  }
  // fallback (no Web Share / insecure context):
  // download the PDF, then open WhatsApp — to the customer's chat if their
  // number is set, otherwise to the contact picker — so they can attach it.
  downloadPdf();
  const phone = $('custPhone').value.replace(/\D/g, '');
  const text = encodeURIComponent(
    'Invoice ' + $('invoiceNo').value + ' — Total ' + total +
    '\n(PDF downloaded — attach it to this chat to send it.)'
  );
  const url = phone ? 'https://wa.me/' + phone + '?text=' + text
                    : 'https://wa.me/?text=' + text;
  window.open(url, '_blank');
  setStatus('PDF downloaded. Attach it in the WhatsApp chat that opened.', 'ok');
}

function downloadPdf() {
  if (!items.length) { setStatus('Add at least one item first.', 'err'); return; }
  const { blob, fileName } = buildPdf(invoiceData());
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  setStatus('PDF saved: ' + fileName, 'ok');
}

/* ---------- sales log ---------- */

function saveSales() {
  localStorage.setItem(LS.sales, JSON.stringify(sales));
}

function archiveCurrent() {
  if (!items.length || billRecorded) return;
  const d = invoiceData();
  sales.push({
    no: d.no,
    iso: todayIso(),
    time: new Date().toTimeString().slice(0, 5),
    cust: d.custName,
    items: items.map(it => ({ name: it.name, qty: it.qty, unit: it.unit, rate: it.rate })),
    subtotal: d.subtotal,
    discount: d.discount,
    total: Math.max(0, d.subtotal - d.discount)
  });
  billRecorded = true;
  saveSales();
  renderToday();
}

function confirmBill() {
  if (!items.length) { setStatus('Add at least one item first.', 'err'); return; }
  if (billRecorded) {
    setStatus('Bill #' + $('invoiceNo').value + ' is already saved.', 'ok');
  } else {
    archiveCurrent();
    setStatus('Bill #' + $('invoiceNo').value + ' saved to today\'s sales.', 'ok');
  }
  showReview();
}

function todayItemSummary() {
  const agg = {};
  sales.filter(s => s.iso === todayIso()).forEach(b => b.items.forEach(it => {
    const k = it.name.toLowerCase() + '|' + it.unit;
    if (!agg[k]) agg[k] = { name: it.name, unit: it.unit, qty: 0, amt: 0 };
    agg[k].qty += it.qty;
    agg[k].amt += it.qty * it.rate;
  }));
  return Object.values(agg).sort((a, b) => b.amt - a.amt);
}

function renderToday() {
  const t = sales.filter(s => s.iso === todayIso());
  $('todayCount').textContent = t.length + (t.length === 1 ? ' bill' : ' bills');
  $('todayTotal').textContent = t.length ? money(t.reduce((s, b) => s + b.total, 0)) : '';
  const list = $('soldToday');
  list.innerHTML = '';
  todayItemSummary().forEach(s => {
    const row = document.createElement('div');
    row.className = 'sold-row';
    const n = document.createElement('span'); n.textContent = s.name;
    const q = document.createElement('span'); q.className = 'q';
    q.textContent = (Math.round(s.qty * 100) / 100) + ' ' + s.unit;
    const a = document.createElement('span'); a.className = 'a';
    a.textContent = money(s.amt);
    row.append(n, q, a);
    list.appendChild(row);
  });
}

function clearToday() {
  if (!confirm('Delete all of today\'s sales records? This cannot be undone.')) return;
  sales = sales.filter(s => s.iso !== todayIso());
  saveSales();
  renderToday();
  setStatus('Today\'s records cleared.', 'ok');
}

function buildDayReportPdf() {
  const bills = sales.filter(s => s.iso === todayIso());
  const grand = bills.reduce((s, b) => s + b.total, 0);

  const { jsPDF } = window.jspdf;
  const W = 80, M = 5, inner = W - 2 * M;

  function layout(doc, draw) {
    let y = 8;
    const font = (st, sz) => { doc.setFont('helvetica', st); doc.setFontSize(sz); };
    const text = (t, x, yy, o) => { if (draw) doc.text(t, x, yy, o); };
    const dash = () => {
      if (draw) {
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(M, y, W - M, y);
        doc.setLineDashPattern([], 0);
      }
      y += 3;
    };

    font('bold', 13);
    doc.splitTextToSize(settings.shopName || 'Vegetable Shop', inner).forEach(l => {
      text(l, W / 2, y, { align: 'center' }); y += 4.5;
    });
    font('normal', 8);
    text('DAY REPORT', W / 2, y, { align: 'center' }); y += 3.6;
    text(fmtDate(todayIso()), W / 2, y, { align: 'center' }); y += 3.6;
    dash();

    // bills table — final total per invoice only
    font('bold', 8);
    text('Bill No', M, y);
    text('Cust-Name', 22, y);
    text('Amount', 58, y, { align: 'right' });
    text('Time', W - M, y, { align: 'right' });
    y += 1.5;
    dash();
    font('normal', 8);
    bills.forEach(b => {
      const cust = b.cust ? doc.splitTextToSize(b.cust, 18) : ['-'];
      text('#' + b.no, M, y);
      text(cust, 22, y);
      text(pdfMoney(b.total), 58, y, { align: 'right' });
      text(b.time, W - M, y, { align: 'right' });
      y += cust.length * 3.4;
    });
    dash();

    font('bold', 11);
    text('TOTAL SALES', M, y + 0.5);
    text(pdfMoney(grand), W - M, y + 0.5, { align: 'right' });
    y += 5;
    dash();
    font('normal', 7.5);
    text('Generated by Mobile Invoice ' + APP_VERSION, W / 2, y, { align: 'center' });
    return y;
  }

  const measure = new jsPDF({ unit: 'mm', format: [W, 400] });
  const height = layout(measure, false) + 6;
  const doc = new jsPDF({
    unit: 'mm', format: [W, height],
    orientation: height > W ? 'portrait' : 'landscape'
  });
  layout(doc, true);
  return { doc, fileName: 'day-report-' + todayIso() + '.pdf', bills: bills.length };
}

function dayReport() {
  const { doc, fileName, bills } = buildDayReportPdf();
  if (!bills) { setStatus('No sales recorded today yet.', 'err'); return; }
  downloadDoc(doc, fileName);
  setStatus('Day report downloaded.', 'ok');
}

function downloadDoc(doc, fileName) {
  const url = URL.createObjectURL(doc.output('blob'));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function buildStockReportPdf() {
  const summary = todayItemSummary();
  const bills = sales.filter(s => s.iso === todayIso());

  const { jsPDF } = window.jspdf;
  const W = 80, M = 5, inner = W - 2 * M;

  function layout(doc, draw) {
    let y = 8;
    const font = (st, sz) => { doc.setFont('helvetica', st); doc.setFontSize(sz); };
    const text = (t, x, yy, o) => { if (draw) doc.text(t, x, yy, o); };
    const dash = () => {
      if (draw) {
        doc.setLineDashPattern([0.8, 0.8], 0);
        doc.line(M, y, W - M, y);
        doc.setLineDashPattern([], 0);
      }
      y += 3;
    };

    font('bold', 13);
    doc.splitTextToSize(settings.shopName || 'Vegetable Shop', inner).forEach(l => {
      text(l, W / 2, y, { align: 'center' }); y += 4.5;
    });
    font('normal', 8);
    text('STOCK SOLD SUMMARY', W / 2, y, { align: 'center' }); y += 3.6;
    text(fmtDate(todayIso()) + '  (' + bills.length + ' bills)', W / 2, y, { align: 'center' }); y += 3.6;
    dash();

    font('bold', 8);
    text('Item', M, y);
    text('Qty sold', W - M, y, { align: 'right' });
    y += 1.5;
    dash();
    font('normal', 8);
    summary.forEach(s => {
      const lines = doc.splitTextToSize(s.name, 50);
      text(lines, M, y);
      text((Math.round(s.qty * 100) / 100) + ' ' + s.unit, W - M, y, { align: 'right' });
      y += lines.length * 3.6 + 1.2;
    });
    dash();

    font('normal', 7.5);
    text('Generated by Mobile Invoice ' + APP_VERSION, W / 2, y, { align: 'center' });
    return y;
  }

  const measure = new jsPDF({ unit: 'mm', format: [W, 400] });
  const height = layout(measure, false) + 6;
  const doc = new jsPDF({
    unit: 'mm', format: [W, height],
    orientation: height > W ? 'portrait' : 'landscape'
  });
  layout(doc, true);
  return { doc, fileName: 'stock-summary-' + todayIso() + '.pdf', items: summary.length };
}

function stockReport() {
  const { doc, fileName, items } = buildStockReportPdf();
  if (!items) { setStatus('No sales recorded today yet.', 'err'); return; }
  downloadDoc(doc, fileName);
  setStatus('Stock summary downloaded.', 'ok');
}

function newInvoice() {
  archiveCurrent(); // safety net: log unsaved bill before clearing
  billRecorded = false;
  items = [];
  $('custName').value = '';
  $('custPhone').value = '';
  $('discount').value = '';
  invoiceCounter += 1;
  localStorage.setItem(LS.counter, String(invoiceCounter));
  $('invoiceNo').value = String(invoiceCounter);
  renderItems(); renderTotals(); saveAll();
  setStatus('New invoice #' + invoiceCounter, 'ok');
}

/* ---------- init ---------- */

function init() {
  $('appVer').textContent = APP_VERSION;
  loadAll();
  renderSettings();
  buildQuickItems();
  renderItems();
  renderTotals();
  $('invoiceNo').value = String(invoiceCounter);
  $('invoiceDate').value = todayIso();
  renderToday();

  ['shopName', 'shopAddress', 'shopPhone'].forEach(id =>
    $(id).addEventListener('input', () => {
      settings[id] = $(id).value.trim();
      $('settingsSummary').textContent = settings.shopName ? '— ' + settings.shopName : '';
      saveAll();
    }));
  $('currency').addEventListener('input', () => {
    settings.currency = $('currency').value.trim() || 'Rs';
    renderTotals(); saveAll();
  });

  $('addItemBtn').addEventListener('click', addItem);
  [$('itemName'), $('itemQty'), $('itemRate')].forEach(el =>
    el.addEventListener('keydown', e => { if (e.key === 'Enter') addItem(); }));

  $('addVegBtn').addEventListener('click', addVeg);
  $('newVeg').addEventListener('keydown', e => { if (e.key === 'Enter') addVeg(); });

  ['custName', 'custPhone', 'discount'].forEach(id =>
    $(id).addEventListener('input', () => { renderTotals(); saveAll(); }));

  $('saveBillBtn').addEventListener('click', confirmBill);
  $('shareBtn').addEventListener('click', sharePdf);
  $('downloadBtn').addEventListener('click', downloadPdf);
  $('newBtn').addEventListener('click', newInvoice);

  $('reviewBtn').addEventListener('click', showReview);
  $('reviewClose').addEventListener('click', hideReview);
  $('reviewModal').addEventListener('click', e => { if (e.target === $('reviewModal')) hideReview(); });
  $('reviewShare').addEventListener('click', sharePdf);
  $('reviewDownload').addEventListener('click', downloadPdf);
  $('reviewOpenPdf').addEventListener('click', openPdf);
  $('dayReportBtn').addEventListener('click', dayReport);
  $('stockReportBtn').addEventListener('click', stockReport);
  $('clearDayBtn').addEventListener('click', clearToday);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', init);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildPdf, buildDayReportPdf, buildStockReportPdf, loadAll };
}
