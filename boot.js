/* Chef & Mixologist: static preview backend.
   Loaded first. It stands in for the server: every call the app makes to /plugin/cm/…, /api/… and /media/… is answered
   here from data/db.json, and the common actions change that in-memory data so screens react. Nothing leaves the
   browser and nothing is saved: reload the page to start again. */
(function () {
  'use strict';
  var HERE = new URL('.', document.currentScript.src).href;
  var realFetch = window.fetch.bind(window);

  // signed in as the owner from the start
  try { sessionStorage.setItem('cm_token', 'demo'); localStorage.setItem('cm_token', 'demo'); localStorage.removeItem('cm_api'); } catch (e) {}
  try { localStorage.removeItem('cm_theme'); } catch (e) {}

  var RAW = null, DB = null;
  // photos live next to the page as plain files: point every /media/… path at them directly
  function relink(o) {
    if (Array.isArray(o)) { o.forEach(function (v, i) { if (typeof v === 'string' && v.indexOf('/media/') === 0) o[i] = HERE + 'media/' + v.split('/').pop(); else relink(v); }); }
    else if (o && typeof o === 'object') { Object.keys(o).forEach(function (k) { var v = o[k]; if (typeof v === 'string' && v.indexOf('/media/') === 0) o[k] = HERE + 'media/' + v.split('/').pop(); else relink(v); }); }
    return o;
  }
  var ready = realFetch(HERE + 'data/db.json').then(function (r) { return r.json(); }).then(function (d) { RAW = relink(d);
    // records the sample data leaves unnumbered need an id to hang photos on
    (RAW.prep.batches || []).forEach(function (b, i) { b.id = b.id || 500 + i; });
    (RAW.suppliers.returns || []).forEach(function (r, i) { r.id = r.id || 600 + i; });
    Object.keys(RAW.wastage || {}).forEach(function (k) { ((RAW.wastage[k] || {}).entries || []).forEach(function (e, i) { e.id = e.id || 700 + i; }); });
    (RAW.roles.roles || []).forEach(function (r) { r.locked = r.name === 'Owner / Admin'; });
    DB = clone(RAW); });
  // the static preview has no offline helper
  try { if (navigator.serviceWorker) { navigator.serviceWorker.register = function () { return Promise.resolve(); }; navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }); } } catch (e) {}
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function now() { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function isoNow() { return new Date().toISOString(); }
  function r2(v, n) { var f = Math.pow(10, n === undefined ? 2 : n); return Math.round(v * f) / f; }
  var OWNER = 'Rahul Banerjee';

  /* ---------- helpers on the data ---------- */
  function inv() { return DB.inventory; }
  function itemById(id) { return inv().items.find(function (i) { return i.id === +id; }); }
  function itemBySku(s) { return inv().items.find(function (i) { return i.sku === s; }); }
  function factor(it, unit) { if (!unit) return 1; var u = (it.units || []).find(function (x) { return x.name === unit; }); return u ? u.factor : 1; }
  function refresh(it) {
    it.lots = it.lots.filter(function (l) { return l.qty > 0.00001; });
    it.onHand = r2(it.lots.reduce(function (a, l) { return a + l.qty; }, 0), 3);
    it.value = r2(it.onHand * it.cost, 2);
    it.hist = (it.hist || []).slice(1).concat([it.onHand]);
  }
  function take(it, qty) {  // oldest use-by first
    var left = qty;
    it.lots.sort(function (a, b) { return a.exp - b.exp; });
    it.lots.forEach(function (l) { var t = Math.min(l.qty, left); l.qty = r2(l.qty - t, 3); left -= t; });
    refresh(it);
  }
  var lotSeq = 90000;
  function addLot(it, qty, exp, name) {
    it.lots.push({ id: ++lotSeq, lot: name || ('L26' + (300 - 0) + '-' + it.sku.slice(-3)), qty: qty, recv: 0, exp: exp == null ? Math.min(it.shelf || 30, 365) : exp, location: it.loc });
    it.lastRecv = 0; refresh(it);
  }
  function addMove(it, type, q, ref, user) {
    inv().moves.unshift({ d: 0, time: now(), sku: it.sku, t: type, q: q, user: user || OWNER, ref: ref || '' });
  }
  function audit(summary, category) {
    DB.audit.rows.unshift({ id: DB.audit.rows.length + 1, at: isoNow(), who: OWNER, summary: summary, category: category || 'stock', outcome: 'done', target: '', ip: '10.0.1.24', device: 'Chrome on Windows', details: { path: '', method: 'POST', status: 201 } });
  }
  function notify(event, title, link, priority) {
    DB.notifications.rows.unshift({ id: Date.now(), event: event, title: title, body: '', link: link || '', priority: priority || 'normal', at: isoNow(), read: false });
    DB.notifications.unread = DB.notifications.rows.filter(function (n) { return !n.read; }).length;
  }
  function err(status, field, msg) { var b = {}; b[field] = [msg]; return [status, b]; }
  var seq = { po: 101, grn: 1100, req: 30, ap: 60, st: 20, rtn: 40, sale: 200, ev: 90, rec: 700, take: 0 };
  function pad(n, w) { return ('0000000' + n).slice(-w); }

  /* ---------- reads ---------- */
  function months() {
    return DB.closing.months;
  }
  function filterAudit(q) {
    var rows = DB.audit.rows, cat = q.get('category') || 'all', size = +(q.get('size') || 25), page = +(q.get('page') || 1);
    if (cat !== 'all') rows = rows.filter(function (r) { return r.category === cat; });
    var who = q.get('who'), s = (q.get('q') || '').toLowerCase();
    if (who) rows = rows.filter(function (r) { return r.who === who; });
    if (s) rows = rows.filter(function (r) { return (r.who + ' ' + r.summary).toLowerCase().indexOf(s) >= 0; });
    return { total: rows.length, page: page, size: size, rows: rows.slice((page - 1) * size, page * size), categories: DB.audit.categories };
  }
  function takeHead(t) { var h = clone(t); delete h.lines; return h; }
  function takeView(id) {
    var t = DB.stocktake_detail[id]; if (!t) return null; var v = clone(t);
    if (v.blind && v.status === 'counting') v.lines.forEach(function (l) { l.expected = null; l.diff = null; l.diffPct = null; l.value = null; });
    return v;
  }
  function closingPreview(month) {
    var cats = {}, items = inv().items;
    items.forEach(function (i) { var c = cats[i.cat] = cats[i.cat] || { opening: 0, purchases: 0, closing: 0, usage: 0 }; c.closing += i.value; });
    Object.keys(cats).forEach(function (k) { cats[k].closing = r2(cats[k].closing, 0); cats[k].purchases = r2(cats[k].closing * 1.9, 0); cats[k].usage = r2(cats[k].purchases, 0); });
    var sum = function (k) { return Object.keys(cats).reduce(function (a, c) { return a + cats[c][k]; }, 0); };
    return { month: month + '-01', label: new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), method: 'fifo', opening: 0, purchases: sum('purchases'), closing: sum('closing'), usage: sum('usage'), categories: cats, previousClosed: true, items: items.length };
  }

  var PH_SINGLE = ['area', 'category', 'person', 'event'], phSeq = 1;
  function phKind(k) { return k; }
  function phList(k) { DB.photos = DB.photos || []; return DB.photos.filter(function (p) { return p.kind === k; }); }
  function get(path, q) {
    var m;
    switch (true) {
      case path === 'branding/': return [200, DB.branding];
      case !!(m = path.match(/^photos\/(\w+)\/$/)): { var kk = phKind(m[1]), cv = {}, cn = {}; phList(m[1]).forEach(function (p) { cv[p.ref] = p.image; cn[p.ref] = (cn[p.ref] || 0) + 1; }); return [200, { covers: cv, counts: cn }]; }
      case !!(m = path.match(/^photos\/(\w+)\/(\d+)\/$/)): return [200, { photos: phList(m[1]).filter(function (p) { return p.ref === +m[2]; }).map(function (p) { return { id: p.id, image: p.image, at: p.at, by: OWNER }; }).reverse(), max: 6, single: PH_SINGLE.indexOf(m[1]) >= 0, canEdit: true }];
      case path === 'profile/': return [200, DB.profile];
      case path === 'inventory/': return [200, inv()];
      case path === 'suppliers/': return [200, DB.suppliers];
      case path === 'recipes/': return [200, DB.recipes];
      case path === 'prep/': return [200, DB.prep];
      case path === 'events/': return [200, DB.events];
      case path === 'sales/': return [200, DB.sales];
      case path === 'setup/': return [200, DB.setup];
      case path === 'team/': return [200, DB.team];
      case path === 'roles/': return [200, DB.roles];
      case path === 'access-requests/': return [200, DB['access-requests']];
      case path === 'org/': return [200, DB.org];
      case path === 'notification-preferences/': return [200, DB['notification-preferences']];
      case path === 'stocktakes/': return [200, DB.stocktakes];
      case path === 'requests/': return [200, DB.requests];
      case path === 'approvals/': return [200, DB.approvals];
      case path === 'audit/': return [200, filterAudit(q)];
      case path === 'closing/': return [200, DB.closing];
      case path === 'closing/preview/': return [200, closingPreview(q.get('month') || '2026-10')];
      case path === 'notifications/': { var rows = DB.notifications.rows; if (q.get('show') === 'unread') rows = rows.filter(function (n) { return !n.read; }); return [200, { unread: DB.notifications.unread, rows: rows }]; }
      case path === 'reports/overview/': return [200, DB.reports[q.get('period') || 'month']];
      case path === 'wastage/': return [200, DB.wastage[q.get('days') || '30'] || DB.wastage['30']];
      case path === 'stocktakes/differences/': return [200, DB.differences[q.get('days') || '90'] || DB.differences['90']];
      case path === 'import/prices/template/': return ['file', 'supplier-price-list.xlsx'];
      case (m = path.match(/^item\/(\d+)\/costing\/$/)) !== null: return DB.costing_items[m[1]] ? [200, DB.costing_items[m[1]]] : [404, {}];
      case (m = path.match(/^stocktakes\/(\d+)\/$/)) !== null: { var v = takeView(+m[1]); return v ? [200, v] : [404, {}]; }
      case (m = path.match(/^closing\/(\d+)\/$/)) !== null: return DB.closing_detail[m[1]] ? [200, DB.closing_detail[m[1]]] : [404, {}];
      case (m = path.match(/^people\/(\d+)\/access\/$/)) !== null: {
        var s = DB.team.staff.find(function (x) { return x.id === +m[1]; }) || { roles: [] }, from = {};
        DB.roles.roles.forEach(function (r) { if (s.roles.indexOf(r.name) >= 0) Object.keys(r.grid).forEach(function (k) { from[k] = r.grid[k]; }); });
        return [200, { overrides: (DB.personAccess || {})[m[1]] || {}, fromRoles: from }];
      }
    }
    return [404, { detail: 'Not found in the preview: ' + path }];
  }

  /* ---------- writes ---------- */
  function limits() { return DB.org.limits || {}; }
  function held(kind, kindLabel, summary, value, payload) {
    var a = { id: ++seq.ap, kind: kind, kindLabel: kindLabel, status: 'pending', statusLabel: 'Waiting', summary: summary, value: value, requestedBy: OWNER, requestedById: 2, createdAt: isoNow(), decidedBy: null, decidedAt: null, reason: '', result: '', sku: null, _payload: payload };
    DB.approvals.pending.unshift(a);
    notify('approval_needed', 'Approve: ' + summary, 'approvals', 'high');
    return [202, { pending: true, approval: a.id, message: 'Sent for approval: ' + summary }];
  }
  function applyMove(it, kind, qty, reason) {
    if (qty > it.onHand + 1e-9) return err(400, 'quantity', it.name + ': only ' + it.onHand + ' ' + it.unit + ' available in your areas');
    take(it, qty);
    addMove(it, kind === 'wastage' ? 'Wastage' : kind === 'issue_beverage' ? 'Issue to beverage' : 'Issue to kitchen', -qty, kind === 'wastage' ? reason : '');
    audit(kind === 'wastage' ? 'recorded wastage of ' + it.name : 'issued ' + it.name, 'stock');
    return [201, { part: it.id, removed: qty }];
  }
  function nextPoRef() { return 'PO-' + pad(++seq.po, 4); }
  function newPO(supId, lines) {
    var sup = (DB.inventory.meta.suppliers.find(function (s) { return s.id === +supId; }) || {}).name || 'Supplier', lead = 1;
    var po = { id: seq.po + 1, po: nextPoRef(), sup: sup, supId: +supId, day: 1, eta: '', late: false, lines: {}, lineIds: {}, prices: {} };
    lines.forEach(function (l, n) {
      var it = itemById(l.part); if (!it) return;
      po.lines[it.sku] = +l.quantity; po.lineIds[it.sku] = 9000 + seq.po * 10 + n;
      if (l.unit_cost != null && l.unit_cost !== '') { it.cost = +l.unit_cost; it.listPrice = +l.unit_cost; refresh(it); }
      po.prices[it.sku] = it.listPrice != null ? it.listPrice : it.cost; lead = Math.max(lead, it.lead || 1);
    });
    po.day = Math.ceil(lead); po.eta = new Date(Date.now() + lead * 864e5).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }).replace(',', '');
    inv().pos.unshift(po); audit('raised ' + po.po + ' to ' + sup, 'purchasing');
    return po;
  }
  function poValue(lines) { return lines.reduce(function (a, l) { var it = itemById(l.part); return a + (it ? (+l.quantity) * (l.unit_cost != null && l.unit_cost !== '' ? +l.unit_cost : it.cost) : 0); }, 0); }

  function write(method, path, body, isForm) {
    var m, b = body || {};
    // ----- stock
    if ((m = path.match(/^item\/(\d+)\/move\/$/))) {
      var it = itemById(m[1]); if (!it) return [404, {}];
      var qty = +b.quantity * factor(it, b.unit);
      if (b.kind === 'wastage' && limits().limitWastage != null && qty * it.cost > limits().limitWastage)
        return held('wastage', 'Wastage', 'Wastage of ' + qty + ' ' + it.unit + ' ' + it.name + ' (' + (b.reason || 'Spoiled') + ')', r2(qty * it.cost, 0), { sku: it.sku, qty: qty, kind: b.kind, reason: b.reason });
      return applyMove(it, b.kind, qty, b.reason || '');
    }
    if ((m = path.match(/^item\/(\d+)\/count\/$/))) {
      var it2 = itemById(m[1]); if (!it2) return [404, {}];
      var target = +b.count * factor(it2, b.unit), diff = r2(target - it2.onHand, 3);
      if (diff < 0) take(it2, -diff); else if (diff > 0) addLot(it2, diff, null, 'FOUND-ON-COUNT');
      if (diff) addMove(it2, 'Adjustment', diff, b.note || 'Stock count');
      audit('counted ' + it2.name, 'stock');
      return [201, { part: it2.id, adjustment: diff }];
    }
    if ((m = path.match(/^item\/(\d+)\/transfer\/$/))) { var it3 = itemById(m[1]); addMove(it3, 'Transfer', +b.quantity * factor(it3, b.unit), 'Between areas'); audit('transferred ' + it3.name, 'stock'); return [201, { part: it3.id, moved: +b.quantity }]; }
    if ((m = path.match(/^item\/(\d+)\/opening-stock\/$/))) { var it4 = itemById(m[1]); addLot(it4, +b.quantity * factor(it4, b.unit), null, b.batch || 'OPENING'); addMove(it4, 'Adjustment', +b.quantity, 'Opening stock'); return [201, { id: lotSeq }]; }
    if ((m = path.match(/^item\/(\d+)\/profile\/$/))) {
      var it5 = itemById(m[1]), p = it5.plan, map = { safety_stock: 'ss', reorder_point: 'rop', max_level: 'max', order_qty: 'q' };
      Object.keys(b).forEach(function (k) {
        if (map[k]) { var o = p[map[k]]; if (b[k] === null || b[k] === '') { o.manual = false; o.value = o.suggested; } else { o.manual = true; o.value = +b[k]; } }
        else if (k === 'avg_daily_use') { it5.avg = b[k] == null ? it5.avg : +b[k]; it5.profile.avgDaily = b[k]; }
        else if (k === 'lead_time_days') { if (b[k] != null) it5.lead = +b[k]; it5.profile.leadDays = b[k]; }
        else if (k === 'usable_pct') it5.profile.usablePct = b[k];
        else if (k === 'shelf_life_days') it5.shelf = b[k] ? +b[k] : 999;
        else if (k === 'storage') it5.profile.storage = b[k];
        else if (k === 'jain_friendly') it5.profile.jain = b[k];
        else if (k === 'allergens') it5.profile.allergens = b[k];
        else if (k === 'hsn_code') it5.profile.hsn = b[k];
        else if (k === 'gst_rate') it5.profile.gst = b[k] ? +b[k] : null;
        else if (k === 'brand') it5.profile.brand = b[k];
        else if (k === 'count_frequency') it5.profile.countFrequency = b[k];
        else if (k === 'fssai_note') it5.profile.fssai = b[k];
      });
      return [200, {}];
    }
    if ((m = path.match(/^item\/(\d+)\/units\/$/))) {
      var it6 = itemById(m[1]), base = it6.units.filter(function (u) { return u.kind !== 'item'; });
      it6.units = base.concat((b.units || []).map(function (u) { return { name: u.name, factor: +u.factor, kind: 'item' }; }));
      return [200, { units: it6.units }];
    }
    if ((m = path.match(/^item\/(\d+)\/archive\/$/)) || (m = path.match(/^item\/(\d+)\/$/)) && method === 'DELETE') {
      inv().items = inv().items.filter(function (i) { return i.id !== +m[1]; }); return [200, {}];
    }
    if ((m = path.match(/^item\/(\d+)\/$/)) && method === 'PATCH') {
      var it7 = itemById(m[1]); if (it7 && b.name) it7.name = b.name; if (it7 && b.cost != null) { it7.cost = +b.cost; it7.listPrice = +b.cost; refresh(it7); } return [200, {}];
    }
    if (path === 'item/' && method === 'POST') {
      var sku = String(b.sku || '').toUpperCase();
      if (itemBySku(sku)) return err(400, 'sku', 'An item with SKU ' + sku + ' already exists');
      var cat = DB.inventory.meta.categories.find(function (c) { return c.id === +b.category; }) || { name: 'Dry goods' };
      var loc = DB.inventory.meta.locations.find(function (c) { return c.id === +b.location; }) || { name: 'Dry store' };
      var sup = DB.inventory.meta.suppliers.find(function (c) { return c.id === +b.supplier; }) || { id: 0, name: '' };
      var tpl = clone(inv().items.find(function (i) { return i.cat === cat.name; }) || inv().items[0]), id = Math.max.apply(null, inv().items.map(function (i) { return i.id; })) + 1;
      Object.assign(tpl, { id: id, sku: sku, name: b.name, cat: cat.name, loc: loc.name, unit: b.unit, cost: +b.cost || 0, listPrice: +b.cost || 0, sup: sup.name, supId: sup.id, pack: +b.pack || 1, shelf: +b.shelf_life_days || 999, lead: +b.lead_time_days || 1, avg: +b.avg_daily_use || 0, lots: [], onHand: 0, value: 0, image: '/media/icon-box.svg', hist: new Array(30).fill(0), priceChange: null, lastRecv: null });
      tpl.units = [{ name: b.unit, factor: 1, kind: 'stock' }];
      inv().items.push(tpl); audit('created ' + tpl.name, 'stock'); return [201, { id: id, sku: sku }];
    }
    // ----- purchasing
    if (path === 'po/' && method === 'POST') {
      var total = poValue(b.lines || []);
      if (limits().limitPo != null && total > limits().limitPo) { var sn = (inv().meta.suppliers.find(function (s) { return s.id === +b.supplier; }) || {}).name; return held('po', 'Purchase order', 'Purchase order to ' + sn + ', ' + b.lines.length + ' line' + (b.lines.length > 1 ? 's' : ''), r2(total, 0), { supplier: b.supplier, lines: b.lines }); }
      var po = newPO(b.supplier, b.lines || []); return [201, { id: po.id, reference: po.po }];
    }
    if ((m = path.match(/^po\/(\d+)\/receive\/$/))) {
      var p0 = inv().pos.find(function (p) { return p.id === +m[1]; }); if (!p0) return [404, {}];
      var skuByLine = {}; Object.keys(p0.lineIds).forEach(function (s) { skuByLine[p0.lineIds[s]] = s; });
      var glines = [], short = false, rejected = false;
      (b.lines || []).forEach(function (l) {
        var s = skuByLine[l.line], it = itemBySku(s); if (!it) return;
        var q = +l.quantity * factor(it, l.unit), ordered = p0.lines[s], ok = l.accepted !== false;
        if (ok && q > 0) { addLot(it, q, l.expiry_date ? Math.max(1, Math.round((new Date(l.expiry_date) - new Date('2026-10-30')) / 864e5)) : null, l.batch); addMove(it, 'Receipt', q, 'GRN-' + (seq.grn + 1)); if (l.unit_cost) { it.cost = +l.unit_cost; it.listPrice = +l.unit_cost; refresh(it); } }
        if (q < ordered) short = true; if (!ok) rejected = true; glines.push([s, ordered, ok ? q : 0]);
      });
      var qc = rejected ? 'Partly rejected' : short ? 'Short delivery' : 'Accepted';
      inv().grns.unshift({ grn: 'GRN-' + pad(++seq.grn, 5), po: p0.po, sup: p0.sup, d: 0, lines: glines, qc: qc, note: b.note || '' });
      inv().pos = inv().pos.filter(function (p) { return p.id !== p0.id; }); audit('posted a goods receipt for ' + p0.po, 'purchasing');
      return [201, { reference: inv().grns[0].grn, qc: qc }];
    }
    if ((m = path.match(/^po\/(\d+)\/cancel\/$/))) { inv().pos = inv().pos.filter(function (p) { return p.id !== +m[1]; }); return [200, {}]; }
    if (path === 'supplier-return/' && method === 'POST') {
      var it8 = itemById(b.part); if (!it8) return [404, {}]; var q8 = +b.quantity * factor(it8, b.unit);
      if (q8 > it8.onHand) return err(400, 'quantity', it8.name + ': only ' + it8.onHand + ' ' + it8.unit + ' available');
      take(it8, q8); addMove(it8, 'Supplier return', -q8, b.reason);
      var rt = { ref: 'RTN-' + pad(++seq.rtn, 5), supplier: it8.sup, item: it8.name, qty: q8, unit: it8.unit, value: r2(q8 * it8.cost, 0), reason: b.reason, at: '30 Oct' };
      DB.suppliers.returns.unshift(rt); return [201, { reference: rt.ref }];
    }
    // ----- kitchen
    if ((m = path.match(/^prep\/(\d+)\/make\/$/))) {
      var pp = DB.prep.preps.find(function (x) { return x.id === +m[1]; }); if (!pp) return [404, {}];
      var qq = +b.quantity, code = 'PREP-261030-' + pp.name.slice(0, 3).toUpperCase() + '-' + (DB.prep.batches.length + 1);
      pp.lots.unshift({ lot: code, qty: qq, exp: Math.max(1, Math.round((pp.shelfHours || 48) / 24)) }); pp.onHand = r2(pp.onHand + qq, 2);
      DB.prep.batches.unshift({ code: code, name: pp.name, qty: qq, unit: pp.unit, cost: r2((pp.unitCost || 0) * qq, 0), at: '30 Oct ' + now(), by: OWNER });
      audit('made a prep batch of ' + pp.name, 'kitchen'); return [201, { code: code, cost: r2((pp.unitCost || 0) * qq, 0) }];
    }
    if (path === 'recipes/' && method === 'POST' || (m = path.match(/^recipes\/(\d+)\/$/)) && method === 'PUT') {
      var id = m ? +m[1] : ++seq.rec, lines = (b.lines || []).map(function (l, n) {
        var it = itemById(l.part) || { id: l.part, name: (DB.recipes.ingredients.find(function (x) { return x.id === +l.part; }) || {}).name || 'Item', unit: 'pcs', cost: 0, profile: {} };
        var usable = ((it.profile && it.profile.usablePct) || 100) / 100, qty = +l.qty * factor(it, l.unit);
        return { id: id * 100 + n, part: it.id, name: it.name, unit: it.unit, qty: qty, useUnit: l.unit && l.unit !== it.unit ? l.unit : null, useQty: l.unit && l.unit !== it.unit ? +l.qty : null, usablePct: r2(usable * 100, 1), asBought: r2(qty / usable, 4), cost: r2(qty / usable * (it.cost || 0), 2) };
      });
      var cost = lines.reduce(function (a, l) { return a + l.cost; }, 0) / (+b.batch_yield || 1);
      var old = DB.recipes.recipes.find(function (r) { return r.id === id; }) || {};
      var row = Object.assign({ image: null, allergens: [], jain: true, missingCosts: [], onMenu: true, target: 30 }, old, { id: id, name: b.name, sku: old.sku || b.sku, kind: b.kind, station: b.station || 'kitchen', category: b.category || '', unit: b.unit || 'pcs', price: b.price ? +b.price : null,
        target: b.target ? +b.target : 30, batchYield: +b.batch_yield || 1, shelfHours: b.shelf_hours || null, method: b.method || '', lines: lines, cost: r2(cost, 2), foodCostPct: b.price ? r2(cost / +b.price * 100, 1) : null });
      if (old.id) Object.assign(old, row); else DB.recipes.recipes.unshift(row);
      if (!old.id && b.kind !== 'prep') DB.sales.menu.push({ sku: row.sku, name: row.name, price: row.price });
      audit('changed a recipe: ' + row.name, 'kitchen'); return [m && method === 'PUT' ? 200 : 201, { id: id }];
    }
    if ((m = path.match(/^photos\/(\w+)\/(\d+)\/$/))) {
      DB.photos = DB.photos || [];
      if (method === 'DELETE') { DB.photos = DB.photos.filter(function (p) { return !(p.kind === m[1] && p.ref === +m[2] && (!b || !b.id || p.id === b.id)); }); return [200, { removed: true }]; }
      if (PH_SINGLE.indexOf(m[1]) >= 0) DB.photos = DB.photos.filter(function (p) { return !(p.kind === m[1] && p.ref === +m[2]); });
      else if (phList(m[1]).filter(function (p) { return p.ref === +m[2]; }).length >= 6) return err(400, 'image', 'Up to 6 photos per record. Remove one first');
      var np = { id: phSeq++, kind: m[1], ref: +m[2], image: URL.createObjectURL(b.get('image')), at: isoNow() }; DB.photos.push(np); return [200, { id: np.id, image: np.image }];
    }
    if ((m = path.match(/^item\/(\d+)\/photo\/$/))) {
      var itp = inv().items.find(function (r) { return r.id === +m[1]; });
      if (itp) itp.img = method === 'DELETE' ? null : URL.createObjectURL(b.get('image'));
      return [200, { image: itp ? itp.img : null }];
    }
    if ((m = path.match(/^recipes\/(\d+)\/photo\/$/))) { var rc = DB.recipes.recipes.find(function (r) { return r.id === +m[1]; }); if (method === 'DELETE') { rc.image = null; return [200, { image: null }]; } rc.image = URL.createObjectURL(b.get('image')); return [200, { image: rc.image }]; }
    if ((m = path.match(/^supplier\/(\d+)\/photo\/$/))) {
      var sp = DB.setup.suppliers.find(function (r) { return r.id === +m[1]; }), sb = DB.suppliers.suppliers.find(function (r) { return r.id === +m[1]; });
      var url = method === 'DELETE' ? null : URL.createObjectURL(b.get('image')); sp.image = url; if (sb) sb.image = url; return [200, { image: url }];
    }
    // ----- requests / approvals
    if (path === 'requests/' && method === 'POST') {
      var r = { id: ++seq.req, ref: 'REQ-' + pad(seq.req, 5), station: b.station, stationLabel: b.station === 'kitchen' ? 'Kitchen' : 'Beverage station', status: 'open', statusLabel: 'Waiting', note: b.note || '', neededBy: b.needed_by, requestedBy: OWNER, requestedById: 2, createdAt: isoNow(),
        lines: (b.lines || []).map(function (l, n) { var it = itemById(l.part); return { id: seq.req * 100 + n, part: it.id, sku: it.sku, name: it.name, unit: it.unit, units: it.units, requested: +l.quantity * factor(it, l.unit), issued: 0, status: 'open', statusLabel: 'Waiting', reason: '', issuedBy: null }; }) };
      DB.requests.open.unshift(r); notify('request_new', 'Kitchen asked for ' + r.lines.length + ' items (' + r.ref + ')', 'requests'); return [201, r];
    }
    if ((m = path.match(/^requests\/(\d+)\/(issue|refuse|cancel)\/$/))) {
      var rq = DB.requests.open.concat(DB.requests.recent).find(function (x) { return x.id === +m[1]; }); if (!rq) return [404, {}];
      if (m[2] === 'issue') (b.lines || []).forEach(function (l) {
        var ln = rq.lines.find(function (x) { return x.id === l.line; }); if (!ln || ln.status !== 'open') return; var it = itemById(ln.part), q = +l.quantity * factor(it, l.unit);
        if (q > 0) { take(it, Math.min(q, it.onHand)); addMove(it, rq.station === 'beverage' ? 'Issue to beverage' : 'Issue to kitchen', -q, rq.ref); ln.issued = r2(ln.issued + q, 3); ln.issuedBy = OWNER; }
        if (ln.issued >= ln.requested || l.done) { ln.status = 'done'; ln.statusLabel = 'Issued'; }
      });
      if (m[2] === 'refuse') { var rl = rq.lines.find(function (x) { return x.id === b.line; }); rl.status = 'refused'; rl.statusLabel = 'Refused'; rl.reason = b.reason; }
      if (m[2] === 'cancel') { rq.status = 'cancelled'; rq.statusLabel = 'Cancelled'; }
      else { var st = rq.lines.every(function (x) { return x.status !== 'open'; }); rq.status = st ? 'done' : rq.lines.some(function (x) { return x.issued > 0; }) ? 'partial' : 'open'; rq.statusLabel = { done: 'Done', partial: 'Partly issued', open: 'Waiting' }[rq.status]; }
      var done = rq.status === 'done' || rq.status === 'cancelled'; DB.requests.open = DB.requests.open.filter(function (x) { return x.id !== rq.id; }); DB.requests.recent = DB.requests.recent.filter(function (x) { return x.id !== rq.id; });
      (done ? DB.requests.recent : DB.requests.open).unshift(rq); return [200, rq];
    }
    if ((m = path.match(/^approvals\/(\d+)\/(approve|reject)\/$/))) {
      var ap = DB.approvals.pending.find(function (x) { return x.id === +m[1]; }); if (!ap) return err(400, 'status', 'Already decided');
      ap.status = m[2] === 'approve' ? 'approved' : 'rejected'; ap.statusLabel = m[2] === 'approve' ? 'Approved' : 'Not approved'; ap.decidedBy = OWNER; ap.decidedAt = isoNow(); ap.reason = b.reason || '';
      if (m[2] === 'approve' && ap._payload) {
        var pl = ap._payload;
        if (ap.kind === 'wastage') applyMove(itemBySku(pl.sku), 'wastage', pl.qty, pl.reason);
        if (ap.kind === 'po') { var po2 = newPO(pl.supplier, pl.lines); ap.result = po2.po; }
      }
      DB.approvals.pending = DB.approvals.pending.filter(function (x) { return x.id !== ap.id; }); DB.approvals.recent.unshift(ap); return [200, ap];
    }
    // ----- stock-takes
    if (path === 'stocktakes/' && method === 'POST') {
      var locName = (DB.inventory.meta.locations.find(function (l) { return l.id === +b.location; }) || {}).name;
      if (DB.stocktakes.takes.some(function (t) { return t.locationId === +b.location && (t.status === 'counting' || t.status === 'review'); })) return err(400, 'location', locName + ' already has a stock-take in progress');
      var its = inv().items.filter(function (i) { return i.loc === locName; }); if (!its.length) return err(400, 'location', 'Nothing is kept in ' + locName);
      var tid = 100 + (++seq.take), head = { id: tid, ref: 'ST-' + pad(tid, 5), location: locName, locationId: +b.location, status: 'counting', statusLabel: 'Counting', blind: b.blind !== false, note: b.note || '', startedBy: OWNER, startedAt: isoNow(), submittedBy: null, decidedBy: null, decidedAt: null, counted: 0, total: its.length, valueDiff: null, canCount: true, canApprove: true };
      DB.stocktakes.takes.unshift(head);
      DB.stocktake_detail[tid] = Object.assign({}, head, { lines: its.map(function (i) { return { part: i.id, sku: i.sku, name: i.name, unit: i.unit, category: i.cat, units: i.units, counted: null, countedBy: null, note: '', expected: i.onHand, diff: null, diffPct: null, value: null }; }).sort(function (a, b2) { return a.category.localeCompare(b2.category) || a.name.localeCompare(b2.name); }) });
      return [201, head];
    }
    if ((m = path.match(/^stocktakes\/(\d+)\/(count|submit|approve|recount|cancel)\/$/))) {
      var t = DB.stocktake_detail[m[1]], head2 = DB.stocktakes.takes.find(function (x) { return x.id === +m[1]; }); if (!t) return [404, {}];
      if (m[2] === 'count') {
        var ln = t.lines.find(function (x) { return x.part === +b.part; }), it9 = itemById(b.part); ln.counted = b.counted == null || b.counted === '' ? null : r2(+b.counted * factor(it9, b.unit), 3); ln.countedBy = OWNER;
        if (ln.counted != null) { ln.diff = r2(ln.counted - ln.expected, 3); ln.diffPct = ln.expected ? r2(ln.diff / ln.expected * 100, 1) : null; ln.value = r2(ln.diff * it9.cost, 0); }
        head2.counted = t.counted = t.lines.filter(function (x) { return x.counted != null; }).length; return [200, { part: ln.part, counted: ln.counted }];
      }
      var left = t.lines.filter(function (x) { return x.counted == null; }).length;
      if (m[2] === 'submit') { if (left) return err(400, 'lines', left + ' item' + (left > 1 ? 's' : '') + ' not counted yet. Enter 0 for anything not found.'); t.status = head2.status = 'review'; t.statusLabel = head2.statusLabel = 'Waiting for approval'; t.submittedBy = head2.submittedBy = OWNER; notify('stocktake_review', head2.ref + ' (' + head2.location + ') is ready to approve', 'stocktake'); }
      if (m[2] === 'recount') { (b.parts || []).forEach(function (pid) { var l2 = t.lines.find(function (x) { return x.part === pid; }); if (l2) { l2.counted = null; l2.diff = null; l2.value = null; l2.diffPct = null; } }); t.status = head2.status = 'counting'; t.statusLabel = head2.statusLabel = 'Counting'; head2.counted = t.counted = t.lines.filter(function (x) { return x.counted != null; }).length; }
      if (m[2] === 'approve') {
        var val = 0; t.lines.forEach(function (l3) { var it10 = itemById(l3.part); if (it10 && l3.diff) { if (l3.diff < 0) take(it10, -l3.diff); else addLot(it10, l3.diff, null, 'FOUND-ON-COUNT'); addMove(it10, 'Adjustment', l3.diff, head2.ref + ' stock-take'); val += l3.value || 0; } });
        t.status = head2.status = 'posted'; t.statusLabel = head2.statusLabel = 'Posted'; t.decidedBy = head2.decidedBy = OWNER; t.decidedAt = head2.decidedAt = isoNow(); t.valueDiff = head2.valueDiff = r2(val, 0); audit('approved and posted ' + head2.ref, 'stock');
      }
      if (m[2] === 'cancel') { t.status = head2.status = 'cancelled'; t.statusLabel = head2.statusLabel = 'Cancelled'; }
      return [200, takeView(+m[1])];
    }
    // ----- sales and events
    if (path === 'sales/' && method === 'POST') {
      var rev = 0, portions = 0, lines = String(b.csv || '').split('\n').slice(1).filter(Boolean);
      lines.forEach(function (ln) { var p = ln.split(','), mi = DB.sales.menu.find(function (x) { return x.sku === p[0].trim(); }); if (mi) { rev += (+p[1] || 0) * (+p[2] || mi.price); portions += +p[1] || 0; } });
      var batch = { id: ++seq.sale, source: b.source, reference: b.reference, date: b.business_date, covers: b.covers ? +b.covers : null, revenue: r2(rev, 0), cost: r2(rev * 0.3, 0), items: portions, shortfalls: [] };
      DB.sales.batches.unshift(batch); audit('imported sales ' + b.reference, 'sales'); return [201, { revenue: batch.revenue, shortfalls: 0, id: batch.id }];
    }
    if ((m = path.match(/^sales\/(\d+)\/void\/$/))) { var sb2 = DB.sales.batches.find(function (x) { return x.id === +m[1]; }); if (sb2) { sb2.source = 'void:' + sb2.source; sb2.revenue = 0; sb2.cost = 0; } return [200, {}]; }
    if (path === 'events/' && method === 'POST') {
      var ev = { id: ++seq.ev, name: b.name, date: b.event_date, licence: b.licence_number, authority: b.issuing_authority || 'West Bengal Excise Directorate', status: 'planned', statusLabel: 'Planned', from: String(b.valid_from || '').slice(5, 16).replace('T', ' '), until: String(b.valid_until || '').slice(5, 16).replace('T', ' '), inWindow: false, guests: b.expected_guests || null, notes: b.notes || '', register: [] };
      DB.events.events.unshift(ev); return [201, { id: ev.id }];
    }
    if ((m = path.match(/^events\/(\d+)\/(open|close|receive|issue|return)\/$/))) {
      var e2 = DB.events.events.find(function (x) { return x.id === +m[1]; }); if (!e2) return [404, {}];
      if (m[2] === 'open') { e2.status = 'open'; e2.statusLabel = 'Open'; e2.inWindow = true; } if (m[2] === 'close') { e2.status = 'closed'; e2.statusLabel = 'Closed'; } return [201, { quantity: +b.quantity || 0 }];
    }
    if ((m = path.match(/^events\/(\d+)\/$/))) { if (method === 'DELETE') DB.events.events = DB.events.events.filter(function (x) { return x.id !== +m[1]; }); else Object.assign(DB.events.events.find(function (x) { return x.id === +m[1]; }) || {}, { name: b.name }); return [200, {}]; }
    if (path === 'liquor-item/') { DB.events.stock.push({ id: 900 + DB.events.stock.length, name: b.name, unit: 'mL', onHand: 0, bottles: 0 }); return [201, {}]; }
    // ----- closing
    if (path === 'closing/' && method === 'POST') { return err(400, 'month', 'The preview has no month ready to close'); }
    if ((m = path.match(/^closing\/(\d+)\/reopen\/$/))) {
      var pr = DB.closing.months.find(function (x) { return x.close && x.close.id === +m[1]; }); if (pr) { pr.close.status = 'reopened'; pr.close.reopenedBy = OWNER; pr.close.reopenedAt = isoNow(); pr.close.reopenReason = b.reason; DB.closing.reopened.unshift(pr.close); pr.close = null; pr.canClose = true; pr.why = ''; } return [200, {}];
    }
    // ----- settings and people
    if (path === 'org/' && method === 'PATCH') {
      var o = DB.org;
      if (b.theme) { o.theme = { theme: b.theme, primary: b.themePrimary || '', accent: b.themeAccent || '' }; DB.branding.theme = o.theme; }
      ['name', 'outlet', 'tagline', 'address', 'address2', 'city', 'state', 'pin', 'country', 'phone', 'email', 'website', 'gstin', 'fssai', 'timezone', 'currency', 'mfaPolicy', 'costingMethod'].forEach(function (k) { if (b[k] !== undefined) o[k] = b[k]; });
      ['foodCostTarget', 'serviceLevel', 'orderCost', 'holdingRate'].forEach(function (k) { if (b[k] !== undefined) o[k] = +b[k]; });
      ['limitWastage', 'limitPo', 'limitCountPct', 'limitCountValue'].forEach(function (k) { if (b[k] !== undefined) o.limits[k] = b[k] === '' || b[k] == null ? null : +b[k]; });
      if (b.whatsappTarget) { o.whatsappTarget = b.whatsappTarget; inv().meta.whatsapp.target = b.whatsappTarget; }
      if (b.whatsappPrices !== undefined) { o.whatsappPrices = !!b.whatsappPrices; inv().meta.whatsapp.prices = !!b.whatsappPrices; }
      DB.branding.name = o.name; DB.branding.outlet = o.outlet; DB.branding.tagline = o.tagline;
      if (b.costingMethod) inv().costing = { method: b.costingMethod, label: { fifo: 'FIFO: first in, first out', lifo: 'LIFO: last in, first out', avg: 'Moving average' }[b.costingMethod] };
      return [200, o];
    }
    if (path === 'org/logo/' || path === 'org/icon/') return [200, DB.org];
    if (path === 'profile/' && method === 'PATCH') { Object.assign(DB.profile, b); return [200, DB.profile]; }
    if (path.indexOf('profile/mfa/') === 0) return err(400, 'code', 'Two-step verification is switched off in the preview');
    if (path === 'profile/password/') return [200, {}];
    if (path.indexOf('profile/devices/') === 0) { return [200, {}]; }
    if (path === 'notifications/' && method === 'POST') {
      DB.notifications.rows.forEach(function (n) { if (b.all || (b.ids || []).indexOf(n.id) >= 0) n.read = true; }); DB.notifications.unread = DB.notifications.rows.filter(function (n) { return !n.read; }).length; return [200, {}];
    }
    if (path === 'notification-preferences/' && method === 'PUT') { (b.prefs || []).forEach(function (p) { var q = DB['notification-preferences'].prefs.find(function (x) { return x.event === p.event; }); if (q) Object.assign(q, p); }); return [200, {}]; }
    if (path === 'team/' && method === 'POST') {
      var u = (b.username || (b.firstName + '.' + (b.lastName || 'new')).toLowerCase()), sid = 100 + DB.team.staff.length;
      DB.team.staff.push({ id: sid, username: u, name: (b.firstName + ' ' + (b.lastName || '')).trim(), firstName: b.firstName, lastName: b.lastName || '', email: b.email || '', phone: b.phone || '', jobTitle: b.jobTitle || '', roles: (b.roles || []).map(function (id) { return (DB.team.roles.find(function (r) { return r.id === id; }) || {}).name; }), active: true, superuser: false, status: 'invited', mfa: false, lastSignIn: null });
      return [201, { id: sid, username: u, activation: location.href.split('#')[0] + '#activate=' + sid + '.sample-link' }];
    }
    if ((m = path.match(/^team\/(\d+)\/$/)) && method === 'PATCH') { var s2 = DB.team.staff.find(function (x) { return x.id === +m[1]; }); if (s2) { Object.assign(s2, b); if (b.roles) s2.roles = b.roles.map(function (id) { return (DB.team.roles.find(function (r) { return r.id === id; }) || {}).name; }); } return [200, {}]; }
    if (path.indexOf('team/') === 0) return [200, {}];
    if (path === 'roles/' && method === 'POST') { var rid = 50 + DB.roles.roles.length; DB.roles.roles.push({ id: rid, name: b.name, description: b.description || '', system: false, areaTeam: false, members: 0, grid: {} }); DB.team.roles.push({ id: rid, name: b.name }); return [201, { id: rid }]; }
    if ((m = path.match(/^roles\/(\d+)\/$/))) { var ro = DB.roles.roles.find(function (x) { return x.id === +m[1]; }); if (method === 'PATCH' && ro && b.grid) ro.grid = b.grid; if (method === 'DELETE') DB.roles.roles = DB.roles.roles.filter(function (x) { return x.id !== +m[1]; }); return [200, {}]; }
    if (path === 'access-requests/' && method === 'POST') { DB['access-requests'].requests.unshift({ id: 50 + DB['access-requests'].requests.length, who: OWNER, userId: 2, area: b.area, areaLabel: b.area, action: b.action || 'read', reach: 'all', hours: +b.hours || 2, reason: b.reason || '', status: 'pending', created: isoNow(), decidedBy: null, note: '', expires: null }); return [201, {}]; }
    if ((m = path.match(/^access-requests\/(\d+)\/(approve|reject|cancel)\/$/))) { var ar = DB['access-requests'].requests.find(function (x) { return x.id === +m[1]; }); if (ar) { ar.status = m[2] === 'approve' ? 'approved' : m[2] === 'reject' ? 'rejected' : 'cancelled'; ar.decidedBy = OWNER; ar.note = b.note || ''; } return [200, {}]; }
    if ((m = path.match(/^roles\/(\d+)\/$/))) {
      var rl = DB.roles.roles.find(function (r) { return r.id === +m[1]; });
      if (!rl) return err(404, 'role', 'Unknown role');
      if (method === 'DELETE') { if (rl.system) return err(400, 'role', 'Built-in roles cannot be deleted'); DB.roles.roles = DB.roles.roles.filter(function (r) { return r.id !== rl.id; }); return [204, null]; }
      if (b.grid && rl.locked) return err(400, 'role', 'The Owner / Admin role always has full access');
      if (b.grid) rl.grid = b.grid; if (b.description !== undefined) rl.description = b.description; if (b.name && !rl.system) rl.name = b.name;
      audit('changed access for the ' + rl.name + ' role', 'access'); return [200, { id: rl.id }];
    }
    if ((m = path.match(/^people\/(\d+)\/access\/$/)) && method === 'PUT') { DB.personAccess = DB.personAccess || {}; DB.personAccess[m[1]] = b.overrides || {}; audit("changed one person's access", 'access'); return [200, {}]; }
    if ((m = path.match(/^people\/(\d+)\/access\/$/))) return [200, {}];
    // ----- masters
    if ((m = path.match(/^supplier\/(\d+)?\/?$/))) {
      var sup2 = m[1] ? DB.setup.suppliers.find(function (x) { return x.id === +m[1]; }) : null;
      if (!sup2) { sup2 = { id: 200 + DB.setup.suppliers.length, image: null, active: true, items: 0, email: '', gstin: '', fssai: '', address: '', notes: '', contact: '', phone: '', whatsapp: '' }; DB.setup.suppliers.push(sup2); inv().meta.suppliers.push({ id: sup2.id, name: b.name, whatsapp: '' }); }
      Object.assign(sup2, { name: b.name, contact: b.contact, phone: b.phone, email: b.email, gstin: b.gstin, fssai: b.fssai, address: b.address, address2: b.address2, city: b.city, state: b.state, pin: b.pin, country: b.country, notes: b.notes, whatsapp: String(b.whatsapp || '').replace(/\D/g, '').replace(/^(\d{10})$/, '91$1') });
      var ms = inv().meta.suppliers.find(function (x) { return x.id === sup2.id; }); if (ms) { ms.name = b.name; ms.whatsapp = sup2.whatsapp; }
      return [method === 'POST' ? 201 : 200, { id: sup2.id }];
    }
    if ((m = path.match(/^supplier\/(\d+)\/(archive|restore)\/$/))) { var s3 = DB.setup.suppliers.find(function (x) { return x.id === +m[1]; }); if (s3) s3.active = m[2] === 'restore'; return [200, {}]; }
    if ((m = path.match(/^(location|category)\/(\d+)?\/?$/)) && (method === 'POST' || method === 'PATCH')) {
      var list = m[1] === 'location' ? DB.setup.locations : DB.setup.categories, ex = m[2] ? list.find(function (x) { return x.id === +m[2]; }) : null;
      var nid = 300 + list.length;
      if (ex) ex.name = b.name; else { list.push(m[1] === 'location' ? { id: 300 + list.length, name: b.name, owner: 'Store / Purchasing', ownerGroup: 5, items: 0 } : { id: 300 + list.length, name: b.name, items: 0 }); inv().meta[m[1] === 'location' ? 'locations' : 'categories'].push({ id: 300 + list.length, name: b.name }); }
      return [method === 'POST' ? 201 : 200, { id: ex ? ex.id : nid }];
    }
    if (path === 'import/items/' && method === 'POST') {
      var rows = String(b.csv || '').split('\n').filter(Boolean).slice(1).map(function (ln, n) { var c = ln.split(','); return { line: n + 2, sku: c[0] || '', name: c[1] || '', action: itemBySku((c[0] || '').toUpperCase()) ? 'Update' : 'New item', errors: c[0] && c[1] ? [] : ['SKU and name are required'] }; });
      var bad = rows.some(function (r) { return r.errors.length; });
      return [200, { rows: rows, created: rows.filter(function (r) { return r.action === 'New item'; }).length, updated: rows.filter(function (r) { return r.action === 'Update'; }).length, ok: !bad && rows.length > 0, committed: !!b.commit && !bad }];
    }
    if (path === 'import/prices/' && method === 'POST') {
      var its2 = inv().items.filter(function (i, n) { return n % 7 === 0; }).slice(0, 14), apply = b.get && b.get('apply');
      var prow = its2.map(function (i, n) { var np = r2(i.cost * (1 + (n % 4 === 0 ? 0.08 : n % 3 === 0 ? -0.04 : 0.03)), 2); return { line: n + 2, supplier: i.sup, sku: i.sku, item: i.name, old: i.cost, new: np, pack: null, change: r2((np - i.cost) / i.cost * 100, 1), action: 'Update price', problem: '' }; });
      if (apply) prow.forEach(function (r) { var it = itemBySku(r.sku); it.cost = r.new; it.listPrice = r.new; it.priceChange = r.change; refresh(it); });
      prow.push({ line: prow.length + 2, supplier: 'Nobody Traders', sku: 'PR-000', item: '', old: null, new: 40, pack: null, change: null, action: '', problem: 'No supplier called "Nobody Traders"' });
      return [200, { applied: apply ? prow.length - 1 : 0, rows: prow }];
    }
    if (path === 'auth/login/') return [200, { token: 'demo' }];
    if (path === 'auth/logout/') return [204, null];
    if (path.indexOf('push/') === 0) return [200, {}];
    return [200, {}];
  }

  /* ---------- intercept fetch ---------- */
  function mediaUrl(path) { return HERE + 'media/' + path.split('/').pop(); }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : input.url, u;
    try { u = new URL(url, location.href); } catch (e) { return realFetch(input, init); }
    var p = u.pathname, i = p.indexOf('/plugin/cm/'), j = p.indexOf('/media/'), k = p.indexOf('/api/');
    if (i < 0 && j < 0 && k < 0) return realFetch(input, init);
    init = init || {};
    var method = (init.method || 'GET').toUpperCase();
    if (j >= 0) return realFetch(mediaUrl(p));
    return ready.then(function () {
      var res;
      if (i >= 0) {
        var path = p.slice(i + '/plugin/cm/'.length), body = init.body, isForm = typeof FormData !== 'undefined' && body instanceof FormData;
        if (!isForm && typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
        if (method === 'DELETE' && u.searchParams.get('id')) body = { id: +u.searchParams.get('id') };
        if (path === 'org/icon/' && method === 'POST' && isForm && body.get('icon')) {   // keep the picked image so the sidebar can show it
          return new Promise(function (ok) {
            var fr = new FileReader();
            fr.onload = function () { DB.branding.icon = DB.org.icon = fr.result; ok(new Response(JSON.stringify(clone(DB.org)), { status: 200, headers: { 'Content-Type': 'application/json' } })); };
            fr.readAsDataURL(body.get('icon'));
          });
        }
        if (path === 'org/icon/' && method === 'DELETE') { DB.branding.icon = DB.org.icon = null; }
        res = method === 'GET' ? get(path, u.searchParams) : write(method, path, body, isForm);
      } else res = [200, {}];  // /api/part/<id>/ photo upload and the like
      var status = res[0], data = res[1];
      if (status === 'file') return realFetch(HERE + 'data/' + data);
      return new Response(status === 204 ? null : JSON.stringify(clone(data)), { status: status, headers: { 'Content-Type': 'application/json' } });
    });
  };

  /* ---------- preview chrome: a small badge and a welcome card ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var css = document.createElement('style');
    css.textContent = '#demoBadge{position:fixed;right:14px;bottom:14px;z-index:90;display:flex;gap:10px;align-items:center;padding:8px 8px 8px 14px;border-radius:99px;background:#2B1710;color:#FFF8F0;font:600 12.5px/1 "Hanken Grotesk",system-ui,sans-serif;box-shadow:0 10px 30px -10px rgba(0,0,0,.5)}' +
      '#demoBadge button{all:unset;cursor:pointer;padding:7px 12px;border-radius:99px;background:#B4420E;color:#fff}#demoBadge button:focus-visible{outline:2px solid #E08A5C;outline-offset:2px}' +
      '#demoWelcome{position:fixed;inset:0;z-index:300;display:grid;place-items:center;background:rgba(30,15,10,.6);padding:16px}#demoWelcome > div{max-width:480px;background:#FFFCF8;border-radius:26px;padding:28px;box-shadow:0 40px 80px -30px rgba(0,0,0,.6);font-family:"Hanken Grotesk",system-ui,sans-serif;color:#24160F}' +
      '#demoWelcome h2{font-family:"Fraunces",Georgia,serif;font-size:26px;margin:0 0 8px}#demoWelcome p{margin:0 0 10px;line-height:1.5;color:#5A463B}#demoWelcome ul{margin:0 0 16px;padding-left:18px;color:#5A463B;line-height:1.6}' +
      '#demoWelcome button{all:unset;cursor:pointer;padding:11px 18px;border-radius:12px;background:#B4420E;color:#fff;font-weight:700}@media (max-width:600px){#demoBadge{right:8px;bottom:8px;font-size:12px}}';
    document.head.appendChild(css);
    var seen = false; try { seen = sessionStorage.getItem('cm_demo_welcome') === '1'; } catch (e) {}
    if (!seen) {
      var w = document.createElement('div'); w.id = 'demoWelcome';
      w.innerHTML = '<div role="dialog" aria-modal="true" aria-labelledby="dw-t"><h2 id="dw-t">Chef &amp; Mixologist, a preview</h2><p>This is the working design of the inventory system with sample data for a cafe in Lake Town: about 160 items, 22 suppliers, 60 recipes and three months of history.</p>' +
        '<ul><li>Use the menu on the left, or the search box to jump anywhere.</li><li>Click any supplier, item, order or person name to open it.</li><li>Try receiving a delivery, a stock-take, a kitchen request or a WhatsApp order: the screens react, but nothing is saved.</li><li>Organisation settings lets you change the colour palette.</li></ul><button type="button" id="dwGo">Explore the preview</button></div>';
      w.querySelector('#dwGo').onclick = function () { w.remove(); try { sessionStorage.setItem('cm_demo_welcome', '1'); } catch (e) {} };
      document.body.appendChild(w); w.querySelector('#dwGo').focus();
    }
  });
})();
