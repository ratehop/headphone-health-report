/* =====================================================================
   耳机佩戴报告 v4.6.0 — app.js
   数据层与解析层照搬 v3.2（含全部踩坑防御），UI 层为 finesse 重制。
   ===================================================================== */
(function(){
'use strict';
/* 出错时留下线索（不影响使用，只为排障） */
window.addEventListener('error', function(ev){ window.__err = (ev.message||'?') + ' @' + (ev.lineno||'?') + ':' + (ev.colno||'?'); });
var $ = function(id){ return document.getElementById(id); };
var TYPE = 'HKQuantityTypeIdentifierHeadphoneAudioExposure';
var devices = [], ALL = [], STATE = { anchor:0, page:0, period:'week', offset:0, busy:false, cached:null, devIdx:-1 };

/* ---------- 配色与深浅模式（设置页可切换，持久化） ----------
   11 套配色 = 环境彩底（玻璃模糊的底色）+ 强调色，仅深色一态。
   中性面板/文字系统全主题共享，对比度（AA）逐主题验证。
   ⚠️ 必须与 style.css 里的 [data-color="..."] 一一对应；
      默认色 tangerine（橘光橙）与应用图标同一套橙。 */
var COLORS = [
  { id:'tangerine', name:'橘光橙', a:'#7a4310', b:'#4a2809', c:'#2c1806', ad:'#ff9a3c' },
  { id:'azure',    name:'海盐蓝',   a:'#1d3f74', b:'#0f1f3a', c:'#12294d', ad:'#74b3ff' },
  { id:'coral',    name:'落日珊瑚', a:'#54210f', b:'#2b1108', c:'#38150a', ad:'#ff8a5c' },
  { id:'crimson',  name:'绯红',     a:'#5c1128', b:'#2e0915', c:'#3d0c1c', ad:'#ff6b8a' },
  { id:'blossom',  name:'樱花粉',   a:'#571430', b:'#2d0a1a', c:'#3a0d21', ad:'#ff7aa2' },
  { id:'violet',   name:'葡萄紫',   a:'#37246e', b:'#1c123a', c:'#241748', ad:'#a18aff' },
  { id:'magenta',  name:'红紫',     a:'#6e1a48', b:'#511236', c:'#41143c', ad:'#f06fb4' },
  { id:'mint',     name:'薄荷绿',   a:'#12503a', b:'#0a2e20', c:'#0c3a29', ad:'#55d6a0' },
  { id:'forest',   name:'森林绿',   a:'#1d5227', b:'#0f2e16', c:'#143a1c', ad:'#7fd48f' },
  { id:'amber',    name:'落日橙',   a:'#6b3d08', b:'#3a2005', c:'#482806', ad:'#ffb84d' },
  { id:'graphite', name:'石墨灰',   a:'#33333c', b:'#1a1a21', c:'#22222a', ad:'#aeaeb2' }
];
STATE.color = 'tangerine';
function setColor(id, save){
  for(var i=0;i<COLORS.length;i++){
    if(COLORS[i].id === id){
      STATE.color = id;
      document.documentElement.setAttribute('data-color', id);
      /* 同步 <meta name="theme-color">，让状态栏跟着配色走 */
      var tc = document.querySelector('meta[name="theme-color"]');
      if(tc) tc.setAttribute('content', COLORS[i].b);
      /* 防御：网格未渲染时跳过高亮同步（buildColorGrid 稍后会调一次补上） */
      var __g = document.getElementById('colorGrid');
      if(__g) Array.prototype.forEach.call(__g.querySelectorAll('.cbtn'), function(b){
        var on = b.dataset.c === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if(save){ try{ localStorage.setItem('hp_color_v2', id); }catch(e){} }
      break;
    }
  }
}
function initAppearance(){
  var c = null;
  try{ c = localStorage.getItem('hp_color_v2'); }catch(e){}
  /* 预览钩子：?color=azure 可直接指定配色（不写进 localStorage），
     配合 ?demo=1 可以在没有 ZIP 的环境里逐个主题核对对比度。 */
  var q = /[?#&]color=([a-z]+)/.exec(location.search + location.hash);
  if(q && COLORS.some(function(x){ return x.id===q[1]; })) c = q[1];
  setColor(COLORS.some(function(x){ return x.id===c; }) ? c : 'tangerine', false);
  buildColorGrid();
}
function buildColorGrid(){
  var grid = $('colorGrid'), html = '';
  COLORS.forEach(function(c){
    var accent = c.ad;
    html += '<button type="button" class="cbtn" data-c="'+c.id+'" role="radio" aria-pressed="false" aria-label="配色 '+c.name+'" style="--sw-a:'+c.a+';--sw-b:'+c.b+';--sw-c:'+c.c+';--sw-accent:'+accent+'">'
      + '<span class="sw"><span class="ck"><svg viewBox="0 0 24 24"><path d="M5 13l4 4 10-10"/></svg></span></span>'
      + '<span class="nm">'+c.name+'</span></button>';
  });
  grid.innerHTML = html;
  setColor(STATE.color, false);
  Array.prototype.forEach.call(grid.querySelectorAll('.cbtn'), function(b){
    b.addEventListener('click', function(){ setColor(b.dataset.c, true); });
  });
}

/* ---------- helpers ---------- */
function pad(n){ return n < 10 ? '0' + n : '' + n; }
function hmHTML(sec){ sec = Math.max(0, Math.round(sec || 0)); var h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60); return '<span class="n">'+h+'</span><span class="u">h</span><span class="n">'+pad(m)+'</span><span class="u">min</span>'; }
function hmText(sec){ sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec/3600)+'h'+pad(Math.floor((sec%3600)/60))+'min'; }
function dayMS(ms){ var d = new Date(ms); d.setHours(0,0,0,0); return d.getTime(); }
function addDays(ms, n){ var d = new Date(ms); d.setDate(d.getDate()+n); return dayMS(d.getTime()); }
function fmtDate(ms){ var d = new Date(ms); return d.getFullYear()+'.'+pad(d.getMonth()+1)+'.'+pad(d.getDate()); }
function fmtDT(ms){ var d = new Date(ms); return fmtDate(ms)+' '+pad(d.getHours())+':'+pad(d.getMinutes()); }
function fmtMD(ms){ var d = new Date(ms); return pad(d.getMonth()+1)+'.'+pad(d.getDate()); }
function parseDate(s){ var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s); if(!m) return NaN; return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], +m[6]).getTime(); }
function attr(tag, name){ var m = new RegExp('\\b' + name + '="([^"]*)"').exec(tag); return m ? m[1] : ''; }
function parseDevice(dev){
  var n = /name:([^,>]+)/.exec(dev || '');
  var i = /localIdentifier:([^,>]+)/.exec(dev || '');
  var full = (i ? i[1] : '').trim();
  var mac = full.replace(/-(tacl|tsco|ble|le)$/i, '').trim();
  var name = (n ? n[1] : '').trim();
  if(!name) name = mac ? '耳机 ' + mac.slice(-5) : '耳机';
  return { name:name, id:mac };
}
/* ---------- 设备类型与图标（支持全部品牌，不再有苹果白名单） ----------
   苹果设备用官方产品图（透明底 PNG/WebP），其它品牌统一用线稿 SVG，
   两者都放进同一个 .deco 图标框里，保证视觉尺寸一致、绝不会被裁掉一半。 */
var ICON_SVG = {
  earbuds:'<svg class="art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12c-6 0-10 5-10 12 0 6 3 10 6 11v9a4 4 0 0 0 8 0v-9c3-1 6-5 6-11 0-7-4-12-10-12z"/><path d="M42 12c-6 0-10 5-10 12 0 6 3 10 6 11v9a4 4 0 0 0 8 0v-9c3-1 6-5 6-11 0-7-4-12-10-12z"/><path d="M15.5 19.5a7 7 0 0 1 6.5-7"/></svg>',
  overear:'<svg class="art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 38v-5a21 21 0 0 1 42 0v5"/><rect x="5" y="34" width="12" height="19" rx="6"/><rect x="47" y="34" width="12" height="19" rx="6"/><path d="M12 33h40"/></svg>',
  speaker:'<svg class="art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="14" y="6" width="36" height="52" rx="13"/><circle cx="32" cy="23" r="5"/><circle cx="32" cy="43" r="9"/></svg>',
  all:'<svg class="art" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="11" y="14" width="42" height="36" rx="9"/><path d="M22 31h20M22 41h11"/></svg>'
};
var APPLE_IMG = { max:'./assets/airpodsmax.webp', pro:'./assets/airpodspro.webp', std:'./assets/airpods.webp' };
function appleImage(name){
  var n = String(name || '').toLowerCase();
  if(n.indexOf('airpods max') >= 0 || n.indexOf('airpodsmax') >= 0) return APPLE_IMG.max;
  if(n.indexOf('airpods pro') >= 0 || n.indexOf('airpodspro') >= 0) return APPLE_IMG.pro;
  if(n.indexOf('airpods') >= 0 || n.indexOf('earpods') >= 0 || n.indexOf('air pod') >= 0) return APPLE_IMG.std;
  return '';
}
function deviceKind(name){
  var n = String(name || '').toLowerCase();
  if(/airpod|earpod|air pod/.test(n)) return 'apple';
  if(/speaker|音箱|音响|homepod|小度|boom ?box/.test(n)) return 'speaker';
  if(/headphone|头戴|over-?ear|w820|w830|wh-|quiet ?comfort|bose|sony|akg|sennheiser|铁三角/.test(n)) return 'overear';
  return 'earbuds';
}
/* 统一出口：产品图 <img> 或线稿 <svg>，尺寸交给 .deco 框控制 */
function deviceArt(name, extraCls){
  var url = appleImage(name);
  var cls = 'art' + (extraCls ? ' ' + extraCls : '');
  if(url) return '<img class="'+cls+'" src="'+url+'" alt="" decoding="async">';
  var svg = ICON_SVG[deviceKind(name)] || ICON_SVG.earbuds;
  return svg.replace('class="art"', 'class="'+cls+'"');
}

/* ---------- 权威统计算法（与 v3.2 一致） ---------- */
function mergeBlocks(recs){
  var b = [], i;
  for(i=0;i<recs.length;i++){
    var s = recs[i].s, e = recs[i].e;
    if(!b.length || s > b[b.length-1][1]) b.push([s,e]);
    else if(e > b[b.length-1][1]) b[b.length-1][1] = e;
  }
  return b;
}
function sessionsOf(blocks, gapMs){
  var out = [], i;
  for(i=0;i<blocks.length;i++){
    var s = blocks[i][0], e = blocks[i][1];
    if(!out.length || s - out[out.length-1].e > gapMs) out.push({ s:s, e:e, d:(e-s)/1000 });
    else { out[out.length-1].e = e; out[out.length-1].d += (e-s)/1000; }
  }
  return out;
}
function statsFor(recs){
  if(!recs.length) return null;
  var blocks = mergeBlocks(recs), i, dedup = 0;
  for(i=0;i<blocks.length;i++) dedup += (blocks[i][1]-blocks[i][0])/1000;
  var raw = 0, energy = 0, d;
  for(i=0;i<recs.length;i++){
    d = Math.max(0,(recs[i].e-recs[i].s)/1000);
    raw += d; energy += d * Math.pow(10, recs[i].v/10);
  }
  var db = raw > 0 ? 10*Math.log10(energy/raw) : 0;
  var sessions = sessionsOf(blocks, 5*60*1000);
  var maxS = sessions[0] || { s:recs[0].s, e:recs[0].e, d:0 };
  for(i=0;i<sessions.length;i++) if(sessions[i].d > maxS.d) maxS = sessions[i];
  var dayMap = {}, monthMap = {}, k;
  for(i=0;i<recs.length;i++){
    d = Math.max(0,(recs[i].e-recs[i].s))/1000;
    k = dayMS(recs[i].s); dayMap[k] = (dayMap[k]||0) + d;
    var dt = new Date(recs[i].s); k = dt.getFullYear()*12 + dt.getMonth(); monthMap[k] = (monthMap[k]||0) + d;
  }
  var bestDayK = null, bestDaySec = -1;
  for(k in dayMap) if(dayMap[k] > bestDaySec){ bestDaySec = dayMap[k]; bestDayK = +k; }
  var bestMonK = null, bestMonSec = -1;
  for(k in monthMap) if(monthMap[k] > bestMonSec){ bestMonSec = monthMap[k]; bestMonK = +k; }
  var keys = Object.keys(dayMap).map(Number).sort(function(a,b){ return a-b; });
  var best = { s:keys[0], e:keys[0], n:1 }, cs = keys[0], ce = keys[0], run = 1;
  for(i=1;i<keys.length;i++){
    if(addDays(keys[i-1],1) === keys[i]){ run++; ce = keys[i]; }
    else { if(run > best.n) best = { s:cs, e:ce, n:run }; cs = ce = keys[i]; run = 1; }
  }
  if(run > best.n) best = { s:cs, e:ce, n:run };
  return {
    n:recs.length, first:recs[0].s, last:recs[recs.length-1].e,
    firstDur:(recs[0].e-recs[0].s)/1000, lastDur:(recs[recs.length-1].e-recs[recs.length-1].s)/1000,
    total:dedup, db:db, sessions:sessions.length, avg:dedup/sessions.length,
    max:maxS.d, maxS:maxS.s, maxE:maxS.e,
    bestDay:bestDayK, bestDaySec:bestDaySec,
    bestMonthY:Math.floor(bestMonK/12), bestMonthM:bestMonK%12, bestMonthSec:bestMonSec,
    streak:best.n, streakS:best.s, streakE:best.e, days:keys.length
  };
}
function windowTotal(recs, anchor, days){
  var start = addDays(anchor, -(days-1)), sel = [], i;
  for(i=0;i<recs.length;i++){ var dk = dayMS(recs[i].s); if(dk >= start && dk <= anchor) sel.push(recs[i]); }
  var b = mergeBlocks(sel), s = 0;
  for(i=0;i<b.length;i++) s += (b[i][1]-b[i][0])/1000;
  return s;
}
function rangeTotal(from, to){
  var src = scopeRecs(), sel = [], i;
  for(i=0;i<src.length;i++){ var dk = dayMS(src[i].s); if(dk >= from && dk <= to) sel.push(src[i]); }
  var b = mergeBlocks(sel), s = 0;
  for(i=0;i<b.length;i++) s += (b[i][1]-b[i][0])/1000;
  return s;
}
function seriesData(period, count, offset){
  var a = STATE.anchor, out = [], i, from, to;
  if(period === 'week'){
    var base = addDays(a, -offset*count);
    for(i=count-1;i>=0;i--){ var d = addDays(base,-i); out.push({ label:fmtMD(d), sec:rangeTotal(d,d) }); }
    from = fmtMD(addDays(base,-(count-1))); to = fmtMD(base);
  } else if(period === 'month'){
    var mon = dayMS(a); var wd = new Date(mon).getDay(); mon = addDays(mon, -((wd+6)%7) - offset*count*7);
    for(i=count-1;i>=0;i--){ var m = addDays(mon,-i*7), sun = addDays(m,6); out.push({ label:fmtMD(m), sec:rangeTotal(m,sun) }); }
    from = fmtMD(addDays(mon,-(count-1)*7)); to = fmtMD(addDays(mon,6));
  } else if(period === 'year'){
    var ad = new Date(a), idx = ad.getFullYear()*12 + ad.getMonth() - offset*count;
    for(i=count-1;i>=0;i--){
      var k = idx-i, y = Math.floor(k/12), mo = k%12;
      var f = new Date(y,mo,1).getTime(), l = new Date(y,mo+1,0).getTime();
      out.push({ label:pad(mo+1)+'月', sec:rangeTotal(f,l) });
    }
    var kf = idx-(count-1), kl = idx;
    from = Math.floor(kf/12)+'.'+pad(kf%12+1); to = Math.floor(kl/12)+'.'+pad(kl%12+1);
  } else {
    var y0 = new Date(a).getFullYear() - offset*count;
    for(i=count-1;i>=0;i--){ var y = y0-i; out.push({ label:String(y), sec:rangeTotal(new Date(y,0,1).getTime(), new Date(y,11,31).getTime()) }); }
    from = String(y0-(count-1)); to = String(y0);
  }
  return { rows:out, from:from, to:to, count:count };
}

/* ---------- 渲染 ---------- */
function countUp(el, sec, animate){
  /* 概览 hero 的唯一重拍动效；减少动效时直接落定终值 */
  var reduced = false;
  try{ reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var target = Math.max(0, Math.round(sec || 0));
  function paint(v){ el.innerHTML = hmHTML(v); }
  if(reduced || target <= 0 || animate === false){ paint(target); return; }
  var t0 = null, DUR = 900;
  function step(ts){
    if(!t0) t0 = ts;
    var p = Math.min(1, (ts - t0)/DUR);
    var e = 1 - Math.pow(1-p, 3);
    paint(Math.round(target * e));
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
/* ---------- 当前统计范围：全部设备 / 某一台设备 ---------- */
function scopeDev(){ return (STATE.devIdx >= 0 && devices[STATE.devIdx]) ? devices[STATE.devIdx] : null; }
function scopeRecs(){ var d = scopeDev(); return d ? d.recs : ALL; }
function scopeTopDev(){
  var d = scopeDev();
  if(d) return d;
  return devices.slice().sort(function(a,b){ return b.total - a.total; })[0] || null;
}
function renderOverview(animate){
  var s = statsFor(scopeRecs());
  if(!s) return;
  var dev = scopeDev();
  $('ovRange').textContent = fmtDate(s.first).replace(/\./g,'/') + ' – ' + fmtDate(s.last).replace(/\./g,'/');
  countUp($('ovTotal'), s.total, animate);
  var span = Math.max(1, (dayMS(s.last)-dayMS(s.first))/86400000 + 1);
  $('ovPct').textContent = Math.round(s.days/span*100) + '% 的天数有佩戴记录';
  $('ovPeriod').textContent = '已读取历史 · ' + s.days + ' 个有记录日 · ' + (dev ? dev.name : devices.length + ' 副设备');
  $('ovCount').textContent = s.sessions.toLocaleString('zh-CN');
  $('ovAvg').innerHTML = hmHTML(s.avg);
  $('ovMax').innerHTML = hmHTML(s.max);
  $('ovMaxFt').textContent = fmtDT(s.maxS) + ' – ' + fmtDT(s.maxE);
  $('ovDb').textContent = Math.round(s.db);
  var art = scopeTopDev();
  $('ovArt').innerHTML = deviceArt(art ? art.name : '耳机');
  $('ovFirst').textContent = fmtDate(s.first);
  $('ovFirstFt').textContent = '当次 ' + hmText(s.firstDur);
  $('ovLast').textContent = fmtDate(s.last);
  $('ovLastFt').textContent = '当次 ' + hmText(s.lastDur);
  /* 日均：全跨度 ÷ 与只算有记录的日子，两种口径都摆出来 */
  var spanD = Math.max(1, Math.round((dayMS(s.last)-dayMS(s.first))/86400000)+1);
  $('ovDaily').innerHTML = hmHTML(s.total/spanD);
  $('ovDailyFt').textContent = '跨度 ' + spanD + ' 天';
  $('ovRecDay').innerHTML = hmHTML(s.total/Math.max(1,s.days));
  $('ovRecDayFt').textContent = s.days + ' 天有记录';
}
/* 顶部设备切换条：切到哪台，「第一次佩戴 / 最后一次佩戴」就跟着哪台走 */
function renderChips(){
  var box = $('ovChips');
  if(!box) return;
  var html = '<button type="button" class="chip'+(STATE.devIdx<0?' on':'')+'" data-i="-1">'+ICON_SVG.all+'<span>全部设备</span></button>';
  devices.forEach(function(d,i){
    html += '<button type="button" class="chip'+(STATE.devIdx===i?' on':'')+'" data-i="'+i+'">'+deviceArt(d.name)+'<span>'+d.name+'</span></button>';
  });
  box.innerHTML = html;
}
function renderStats(){
  var s = statsFor(scopeRecs());
  if(!s) return;
  $('stScope').textContent = scopeDev() ? (scopeDev().name + ' · 个人纪录') : '个人纪录 · 已读取全部历史';
  $('stDay').innerHTML = hmHTML(s.bestDaySec);
  $('stDayFt').textContent = fmtDate(s.bestDay);
  $('stSess').innerHTML = hmHTML(s.max);
  $('stSessFt').textContent = fmtDT(s.maxS) + ' – ' + fmtDT(s.maxE);
  $('stStreak').innerHTML = '<span class="n">'+s.streak+'</span><span class="u">天</span>';
  $('stStreakFt').textContent = fmtDate(s.streakS) + ' – ' + fmtDate(s.streakE);
  $('stMonth').innerHTML = hmHTML(s.bestMonthSec);
  $('stMonthFt').textContent = s.bestMonthY + '年' + (s.bestMonthM+1) + '月';
  var top = scopeTopDev();
  if(top){
    $('stTopName').textContent = top.name;
    $('stTopTime').innerHTML = hmHTML(top.total);
    $('stTopArt').innerHTML = deviceArt(top.name);
  }
  renderChart();
}
function renderChart(){
  var cfg = { week:[7,'日'], month:[5,'周'], year:[12,'月'], total:[5,'年'] }[STATE.period];
  var res = seriesData(STATE.period, cfg[0], STATE.offset);
  $('chartRange').textContent = res.from + ' – ' + res.to;
  var max = 0, i;
  for(i=0;i<res.rows.length;i++) if(res.rows[i].sec > max) max = res.rows[i].sec;
  var html = '', sum = 0, maxRow = res.rows[0];
  for(i=0;i<res.rows.length;i++){
    var r = res.rows[i]; sum += r.sec;
    if(r.sec > maxRow.sec) maxRow = r;
  }
  for(i=0;i<res.rows.length;i++){
    var r2 = res.rows[i];
    var pct = max > 0 ? Math.max(2, r2.sec/max*100) : 0;
    var isMax = max > 0 && r2 === maxRow;
    var val = r2.sec > 0 ? hmText(r2.sec) : '无记录';
    html += '<div class="col'+(isMax?' max':'')+'">'
      + '<div class="track"><div class="fill'+(r2.sec<=0?' zero':'')+(isMax?' top':'')+'" data-h="'+pct+'"></div></div>'
      + '<div class="val">'+(isMax ? val : (r2.sec > 0 ? '&nbsp;' : '')) +'</div>'
      + '<div class="lb">'+r2.label+'</div></div>';
  }
  $('chartBars').innerHTML = html;
  $('chartBars').setAttribute('aria-label', '佩戴时长柱状图，' + res.from + ' 至 ' + res.to + '，合计 ' + hmText(sum) + '，最高 ' + hmText(maxRow.sec));
  $('chartMax').textContent = '最高 ' + hmText(maxRow.sec);
  $('chartSum').textContent = '合计 ' + hmText(sum);
  $('chartNext').classList.toggle('off', STATE.offset === 0);
  requestAnimationFrame(function(){
    Array.prototype.forEach.call($('chartBars').querySelectorAll('.fill'), function(el){
      el.style.setProperty('--fh', el.dataset.h + '%');
      el.style.height = el.dataset.h + '%';
    });
  });
}

function deviceWindow(){
  var days = +$('devPeriod').value;
  var total = days === 0 ? STATE.allTotal : windowTotal(ALL, STATE.anchor, days);
  var list = devices.map(function(d){
    var t = days === 0 ? d.total : windowTotal(d.recs, STATE.anchor, days);
    return { name:d.name, id:d.id, sec:t, pct: total > 0 ? t/total*100 : 0 };
  }).filter(function(x){ return x.sec > 0; }).sort(function(a,b){ return b.sec-a.sec; });
  return { total:total, list:list, days:days };
}
/* ---------- 设备轮播：把某张卡精确居中 ---------- */
function centerCard(el, idx, smooth){
  var cards = el.children;
  if(!cards || !cards[idx]) return;
  var c = cards[idx], cr = el.getBoundingClientRect(), rr = c.getBoundingClientRect();
  var delta = (rr.left + rr.width/2) - (cr.left + cr.width/2);
  var left = el.scrollLeft + delta;
  var max = Math.max(0, el.scrollWidth - el.clientWidth);
  left = Math.max(0, Math.min(max, left));
  if(el.scrollTo){
    try{ el.scrollTo({ left:left, behavior: smooth ? 'smooth' : 'auto' }); }
    catch(e){ el.scrollLeft = left; }
  } else el.scrollLeft = left;
}
/* 当前最接近视口中心的那张卡 */
function nearestCard(el){
  var cr = el.getBoundingClientRect(), mid = cr.left + cr.width/2, best = 0, bd = Infinity;
  Array.prototype.forEach.call(el.children, function(c,i){
    var r = c.getBoundingClientRect();
    var d = Math.abs(r.left + r.width/2 - mid);
    if(d < bd){ bd = d; best = i; }
  });
  return best;
}
function renderDevices(){
  var w = deviceWindow();
  $('devTotal').innerHTML = hmHTML(w.total);
  $('devTotalSub').textContent = (w.days === 0 ? '全部累计佩戴时长' : '近'+w.days+'天总佩戴时长') + ' · 截至 ' + fmtDate(STATE.anchor);
  var car = $('carousel'), dots = $('dots'), html = '';
  w.list.forEach(function(x){
    html += '<div class="dcard card"><div class="deco">'+deviceArt(x.name)+'</div>'
      + '<div class="nm">'+x.name+'</div>'
      + '<div class="big">'+hmHTML(x.sec)+'</div>'
      + '<div class="share">'+x.pct.toFixed(0)+'% 的佩戴时长'+(x.id?' · '+x.id:'')+'</div></div>';
  });
  if(!html) html = '<div class="dcard card"><div class="deco">'+ICON_SVG.earbuds+'</div><div class="nm">暂无数据</div><div class="share">该周期内没有耳机音量记录</div></div>';
  car.innerHTML = html;
  dots.innerHTML = w.list.map(function(_,i){
    return '<button type="button" class="dot'+(i===0?' on':'')+'" data-i="'+i+'" aria-label="第 '+(i+1)+' 台设备"></button>';
  }).join('');
  $('devList').innerHTML = w.list.map(function(x){
    return '<div class="drow"><div class="di">'+deviceArt(x.name)+'</div><div class="l">'+x.name+'</div><div class="r">'+hmText(x.sec)+'</div></div>';
  }).join('') || '<div class="listhint">该周期没有记录</div>';
  $('devFoot').textContent = '共 '+w.list.length+' 副设备 · 时长按重叠区间去重';
  car.onscroll = function(){
    var idx = nearestCard(car);
    Array.prototype.forEach.call(dots.children, function(el,i){ el.className = i===idx ? 'dot on' : 'dot'; });
  };
  /* 首屏就让第一张卡落在正中，而不是永远靠左 */
  requestAnimationFrame(function(){ centerCard(car, 0, false); });
}

/* ---------- 洞察：聆听人格 / 音量健康 / 时段 / 星期 / 日历 ----------
   口径说明：夜间 22–06、session 取 5 分钟间隔、
   日均按首末跨度、时段与星期按记录起止时间拆分。 */
var PERSONAS = {
  BOOM:{n:'午夜蹦迪王', m:'邻居以为你睡了，其实你耳朵里在开演唱会。'},
  EMOO:{n:'深夜 emo 人', m:'一到半夜就循环，听的不是歌，是心事。'},
  WILD:{n:'间歇性通宵选手', m:'平时不出现，一出现就是通宵加满音量。'},
  MOON:{n:'月亮不睡我不睡', m:'偶尔失眠，一失眠就听到天亮。'},
  SHOT:{n:'睡前来一针', m:'每晚必须来一小段，还得大声，不然睡不着。'},
  HUSH:{n:'哄睡专业户', m:'每晚轻轻听一会儿才肯睡，耳机是你的安抚奶嘴。'},
  BLIP:{n:'深夜闪现党', m:'半夜突然上线，炸两首就消失。'},
  MIST:{n:'夜间幽灵', m:'来无影去无踪，音量小到像没来过。'},
  TANK:{n:'人形音响', m:'从早听到晚还开这么大声，耳朵是租来的吗？'},
  BUSY:{n:'勿扰模式本人', m:'耳机一戴，谁也不爱。别人以为你在专注，其实也算是吧。'},
  YOLO:{n:'梭哈型听众', m:'要么不听，一听就是半天，音量拉满。'},
  LAZY:{n:'躺平听客', m:'想起来才听，一听就瘫一下午。'},
  RUSH:{n:'通勤战神', m:'每天准点上线，到站准点下线，音量专治地铁。'},
  LOOP:{n:'打卡型听众', m:'每天听一点，不多不少，比上班打卡还准。'},
  PING:{n:'快闪型听众', m:'偶尔上线，响一下就走。'},
  DUST:{n:'耳机吃灰人', m:'耳机买来主要是为了拥有。'},
  OUCH:{n:'耳膜刺客', m:'你的耳膜想跟你谈谈。'},
  GLUE:{n:'长在耳朵上', m:'医生建议你把耳机摘下来洗个澡。'},
  IRON:{n:'全勤铁人', m:'你对耳机比对谁都专一。'}
};
/* 四维组合 → 人格代号（19 种人格的组合表） */
var PERSONA_BY_TRAIT = {
  NLRH:'BOOM', NLRQ:'EMOO', NLFH:'WILD', NLFQ:'MOON',
  NSRH:'SHOT', NSRQ:'HUSH', NSFH:'BLIP', NSFQ:'MIST',
  DLRH:'TANK', DLRQ:'BUSY', DLFH:'YOLO', DLFQ:'LAZY',
  DSRH:'RUSH', DSRQ:'LOOP', DSFH:'PING', DSFQ:'DUST'
};
var SLOT_DEFS = [
  {k:'early',   n:'清晨', h:[5,6,7,8]},
  {k:'morning', n:'上午', h:[9,10,11]},
  {k:'noon',    n:'中午', h:[12,13]},
  {k:'afternoon',n:'下午',h:[14,15,16,17]},
  {k:'evening', n:'晚上', h:[18,19,20,21,22]},
  {k:'night',   n:'深夜', h:[23,0,1,2,3,4]}
];
var WD_NAMES = ['一','二','三','四','五','六','日'];
function clamp01(v){ return v < 0 ? 0 : (v > 1 ? 1 : v); }
function percentile(arr, p){
  if(!arr.length) return 0;
  var a = arr.slice().sort(function(x,y){ return x-y; });
  var idx = (a.length-1)*p, lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? a[lo] : a[lo] + (a[hi]-a[lo])*(idx-lo);
}
/* 一段记录跨小时时按秒拆到每个小时桶 */
function hourBuckets(recs){
  var b = [], i;
  for(i=0;i<24;i++) b.push(0);
  for(i=0;i<recs.length;i++){
    var s = recs[i].s, e = recs[i].e, guard = 0;
    while(s < e && guard++ < 600){
      var d = new Date(s);
      var end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()+1, 0, 0, 0).getTime();
      if(end <= s) end = s + 3600000;
      b[d.getHours()] += (Math.min(e, end) - s)/1000;
      s = end;
    }
  }
  return b;
}
function slotStats(hb){
  var total = 0, i, j;
  for(i=0;i<24;i++) total += hb[i];
  var list = SLOT_DEFS.map(function(d){
    var v = 0;
    for(j=0;j<d.h.length;j++) v += hb[d.h[j]];
    return { key:d.k, name:d.n, sec:v, pct: total > 0 ? v/total*100 : 0 };
  });
  return { total:total, list:list };
}
function weekBuckets(recs){
  var b = [], i;
  for(i=0;i<7;i++) b.push(0);
  for(i=0;i<recs.length;i++){
    var d = new Date(recs[i].s);
    b[(d.getDay()+6)%7] += (recs[i].e-recs[i].s)/1000;
  }
  return b;
}
/* 每天的累计秒数 */
function dayMapOf(recs){
  var m = {}, i;
  for(i=0;i<recs.length;i++){
    var k = dayMS(recs[i].s);
    m[k] = (m[k]||0) + (recs[i].e-recs[i].s)/1000;
  }
  return m;
}
/* 超 80dB 的时间占比 + 近 7 天 loud 时长 */
function loudStats(recs, anchor){
  var loud = 0, total = 0, week = 0, i;
  var from = addDays(anchor, -6);
  for(i=0;i<recs.length;i++){
    var dur = (recs[i].e-recs[i].s)/1000;
    total += dur;
    if(recs[i].v > 80){
      loud += dur;
      var dk = dayMS(recs[i].s);
      if(dk >= from && dk <= anchor) week += dur;
    }
  }
  return { pct: total > 0 ? loud/total*100 : 0, weekSec:week, totalSec:total };
}
/* 聆听人格：四维判定 + 隐藏款 */
function personaOf(recs, s, hb){
  hb = hb || hourBuckets(recs);
  var i;
  var night = 0, nightHours = [22,23,0,1,2,3,4,5];
  for(i=0;i<nightHours.length;i++) night += hb[nightHours[i]];
  var total = 0;
  for(i=0;i<24;i++) total += hb[i];
  var nightRatio = total > 0 ? night/total : 0;
  var spanDays = Math.max(1, Math.round((dayMS(s.last)-dayMS(s.first))/86400000)+1);
  var avgSess = s.sessions > 0 ? s.total/s.sessions : 0;
  var habit = s.days/spanDays;
  var db = s.db;
  var code = null, hidden = false;
  if(db >= 85 && spanDays >= 7){ code = 'OUCH'; hidden = true; }
  else if(s.total/spanDays >= 6*3600 && spanDays >= 7){ code = 'GLUE'; hidden = true; }
  else if(s.streak >= 365 && spanDays >= 7){ code = 'IRON'; hidden = true; }
  if(!code){
    code = (nightRatio >= 0.3 ? 'N' : 'D')
         + (avgSess >= 2400 ? 'L' : 'S')
         + ((habit >= 0.7 && spanDays >= 14) ? 'R' : 'F')
         + (db >= 70 ? 'H' : 'Q');
  }
  var key = PERSONA_BY_TRAIT[code] || code;
  var p = PERSONAS[key] || PERSONAS.DUST;
  /* 四条 trait 轴：阈值刚好落在中点 50% */
  var traits = [
    { k:'时间', l:'昼', r:'夜', v: clamp01(nightRatio/0.6) },
    { k:'时长', l:'短', r:'长', v: clamp01(avgSess/4800) },
    { k:'习惯', l:'随缘', r:'天天', v: clamp01(habit/1.4) },
    { k:'音量', l:'轻', r:'响', v: clamp01(db/140) }
  ];
  return {
    code:code, key:key, name:p.n, mock:p.m, hidden:hidden, traits:traits,
    raw:{ night:nightRatio, avgSess:avgSess, habit:habit, db:db, span:spanDays }
  };
}
function renderInsights(){
  var recs = scopeRecs();
  var s = statsFor(recs);
  if(!s) return;
  var dev = scopeDev();
  $('insScope').textContent = (dev ? dev.name : '全部设备') + ' · 全历史';
  var spanDays = Math.max(1, Math.round((dayMS(s.last)-dayMS(s.first))/86400000)+1);

  /* 人格 */
  var hb = hourBuckets(recs);
  var ps = personaOf(recs, s, hb);
  $('psCode').textContent = ps.key;
  $('psName').textContent = ps.name;
  $('psMock').textContent = ps.mock;
  var th = '', i;
  for(i=0;i<ps.traits.length;i++){
    var t = ps.traits[i], right = t.v >= 0.5;
    var pos = Math.max(4, Math.min(96, Math.round(t.v*100)));
    th += '<div class="ptrait"><span class="k">'+t.k+'</span>'
      + '<div class="tr"><i class="dot" style="left:'+pos+'%"></i></div>'
      + '<span class="ax"><b'+(right?'':' class="on"')+'>'+t.l+'</b><b'+(right?' class="on"':'')+'>'+t.r+'</b></span>'
      + '<span class="v">'+Math.round(t.v*100)+'%</span></div>';
  }
  $('psTraits').innerHTML = th;
  $('psNote').textContent = (ps.hidden ? '隐藏款达成 · ' : '')
    + '四维 ' + ps.code + ' · '
    + '夜间 ' + Math.round(ps.raw.night*100) + '% · 平均每次 ' + hmText(ps.raw.avgSess)
    + ' · 有记录 ' + Math.round(ps.raw.habit*100) + '% 的日子 · 平均音量 ' + Math.round(ps.raw.db) + ' dB';

  /* 音量健康 */
  var db = s.db;
  var tag = db < 70 ? {t:'舒适', c:'#2f9e63'} : (db < 80 ? {t:'适中', c:'#0c8055'} : (db < 85 ? {t:'偏大', c:'#c73e1d'} : {t:'过大', c:'#c4103a'}));
  $('volAvg').innerHTML = Math.round(db) + '<span class="u">dB</span>';
  $('volTag').textContent = tag.t;
  $('volTag').style.setProperty('--tagc', tag.c);
  var ls = loudStats(recs, STATE.anchor);
  $('loudFill').style.width = Math.min(100, ls.pct) + '%';
  $('volLoud').textContent = Math.round(ls.pct) + '%';
  $('volFoot').innerHTML = '有 <b>' + Math.round(ls.pct) + '%</b> 的时间超过 80 dB；'
    + 'WHO 建议 80 dB 每周累计不超过 40 小时 —— 最近 7 天你用了 <b>' + hmText(ls.weekSec) + '</b>。';

  /* 24 小时时段钟 */
  var hmax = 0, hpk = 0;
  for(i=0;i<24;i++){ if(hb[i] > hmax){ hmax = hb[i]; hpk = i; } }
  var ch = '', sp = '';
  for(i=0;i<24;i++){
    var ratio = hmax > 0 ? hb[i]/hmax : 0;
    var len = 5 + ratio*70;
    var op = 0.22 + 0.78*ratio;
    sp += '<i class="sp" style="--a:'+(i*15)+'deg;--l:'+len.toFixed(1)+'px;--o:'+op.toFixed(2)+'"></i>';
  }
  sp += '<span class="lab n">0</span><span class="lab e">6</span><span class="lab s">12</span><span class="lab w">18</span>';
  $('clock').innerHTML = sp;
  $('clockTip').innerHTML = hmax > 0 ? '<b>' + hpk + ' 点</b>听得最多，累计 ' + hmText(hb[hpk]) : '这段时间没有记录';

  /* 时段占比 */
  var sl = slotStats(hb), smax = -1;
  for(i=0;i<sl.list.length;i++) if(sl.list[i].pct > smax) smax = sl.list[i].pct;
  var sh = '';
  for(i=0;i<sl.list.length;i++){
    var x = sl.list[i];
    sh += '<div class="slot'+(x.pct === smax && smax > 0 ? ' on':'')+'"><div class="n">'+x.name+'</div>'
      + '<div class="p">'+Math.round(x.pct)+'%</div><div class="h">'+hmText(x.sec)+'</div></div>';
  }
  $('slots').innerHTML = sh;

  /* 星期分布 */
  var wb = weekBuckets(recs), wmax = 0, wpk = 0;
  for(i=0;i<7;i++){ if(wb[i] > wmax){ wmax = wb[i]; wpk = i; } }
  var wh = '';
  for(i=0;i<7;i++){
    var pct = wmax > 0 ? wb[i]/wmax*100 : 0;
    wh += '<div class="wd'+(i===wpk?' on':'')+'"><div class="b" style="height:'+Math.max(4, Math.round(pct*0.76))+'px"></div>'
      + '<div class="l">'+WD_NAMES[i]+'</div></div>';
  }
  $('weekRow').innerHTML = wh;
  $('weekTip').innerHTML = wmax > 0 ? '周<b>' + WD_NAMES[wpk] + '</b>听得最多，累计 ' + hmText(wmax) : '这段时间没有记录';

  /* 聆听日历 */
  renderCalendar(recs, s, spanDays);

  /* 换算 */
  $('eqDays').textContent = Math.round(s.total/86400);
  $('eqSongs').textContent = Math.round(s.total/210).toLocaleString('zh-CN');
  $('eqDaily').innerHTML = hmHTML(s.total/spanDays);
  $('eqDailyFt').textContent = '跨度 ' + spanDays + ' 天';
  $('eqRecDay').innerHTML = hmHTML(s.total/Math.max(1,s.days));
  $('eqRecDayFt').textContent = s.days + ' 天有记录';
}
/* 日历：跨度 ≤371 天按天（53 周），否则按月（每年一行） */
function renderCalendar(recs, s, spanDays){
  var dm = dayMapOf(recs), i, w, d, yi, mi, kk;
  var keys = Object.keys(dm).map(Number).sort(function(a,b){ return a-b; });
  var first = keys.length ? keys[0] : STATE.anchor;
  var last = keys.length ? keys[keys.length-1] : STATE.anchor;
  var html = '', head = '';
  if(spanDays <= 371){
    var cols = 53, cw = 5, ch = 5, gap = 2;
    var lastDay = dayMS(last);
    var dow = (new Date(lastDay).getDay()+6)%7;
    var gridStart = addDays(addDays(lastDay, -dow), -52*7);
    var vals = [];
    for(var k in dm) if(dm[k] > 0) vals.push(dm[k]);
    var q1 = percentile(vals, .25), q2 = percentile(vals, .5), q3 = percentile(vals, .75);
    head = '最近 <b>53 周</b> · ' + fmtDate(first) + ' 起';
    html = '<div class="calgrid" style="grid-template-columns:13px repeat('+cols+','+cw+'px);'
         + 'grid-template-rows:12px repeat(7,'+ch+'px);gap:'+gap+'px">';
    for(var w=0; w<cols; w++){
      for(var d=0; d<7; d++){
        var ts = addDays(gridStart, w*7+d);
        var sec = dm[ts] || 0;
        var lv = !sec ? 0 : (sec <= q1 ? 1 : (sec <= q2 ? 2 : (sec <= q3 ? 3 : 4)));
        html += '<i class="c l'+lv+'" style="grid-column:'+(w+2)+';grid-row:'+(d+2)+'" title="'+fmtDate(ts)+' · '+hmText(sec)+'"></i>';
      }
    }
    /* 月份标签：每个月第一次出现的周；太挤就跳过，避免叠字 */
    var lm = -1, lastW = -9;
    for(w=0; w<cols-5; w++){
      var t2 = addDays(gridStart, w*7);
      var m2 = new Date(t2).getMonth();
      if(m2 !== lm && (w - lastW) >= 3){
        lm = m2; lastW = w;
        html += '<span class="cm" style="grid-column:'+(w+2)+';grid-row:1">'+(m2+1)+'月</span>';
      }
    }
    html += '<span class="clab" style="grid-column:1;grid-row:2">一</span>'
          + '<span class="clab" style="grid-column:1;grid-row:5">四</span>'
          + '<span class="clab" style="grid-column:1;grid-row:8">日</span>';
    html += '</div>';
  } else {
    /* 按月：每年一行，12 列 */
    var byMonth = {};
    for(i=0;i<recs.length;i++){
      var dt = new Date(recs[i].s);
      var key = dt.getFullYear()*12 + dt.getMonth();
      byMonth[key] = (byMonth[key]||0) + (recs[i].e-recs[i].s)/1000;
    }
    var y0 = new Date(first).getFullYear(), y1 = new Date(last).getFullYear();
    var years = [];
    for(var y=y0; y<=y1; y++) years.push(y);
    var mvals = [];
    for(var kk in byMonth) if(byMonth[kk] > 0) mvals.push(byMonth[kk]);
    var m1 = percentile(mvals,.25), m2 = percentile(mvals,.5), m3 = percentile(mvals,.75);
    head = '按月 · <b>' + y0 + '–' + y1 + '</b>';
    html = '<div class="calgrid" style="grid-template-columns:30px repeat(12,1fr);'
         + 'grid-template-rows:12px repeat('+years.length+',22px);gap:3px">';
    for(var mi=0; mi<12; mi++){
      if(mi % 3 === 0) html += '<span class="cm" style="grid-column:'+(mi+2)+';grid-row:1">'+(mi+1)+'月</span>';
    }
    for(yi=0; yi<years.length; yi++){
      html += '<span class="clab" style="grid-column:1;grid-row:'+(yi+2)+'">'+years[yi]+'</span>';
      for(mi=0; mi<12; mi++){
        var key2 = years[yi]*12 + mi;
        var sec2 = byMonth[key2] || 0;
        var lv2 = !sec2 ? 0 : (sec2 <= m1 ? 1 : (sec2 <= m2 ? 2 : (sec2 <= m3 ? 3 : 4)));
        html += '<i class="c l'+lv2+'" style="grid-column:'+(mi+2)+';grid-row:'+(yi+2)+'" title="'+years[yi]+'.'+pad(mi+1)+' · '+hmText(sec2)+'"></i>';
      }
    }
    html += '</div>';
  }
  $('calHead').innerHTML = head;
  $('cal').innerHTML = html;
  var cover = spanDays > 0 ? Math.min(100, Math.round(s.days/spanDays*100)) : 0;
  $('calStats').innerHTML =
      '<div class="cs"><div class="v">'+s.days+'</div><div class="n">天有记录</div></div>'
    + '<div class="cs"><div class="v">'+s.streak+'</div><div class="n">最长连续（天）</div></div>'
    + '<div class="cs"><div class="v">'+cover+'%</div><div class="n">跨度覆盖率</div></div>';
}

/* ---------- 导航 ---------- */
var PAGES = 5;
var PAGE_W = 1;          /* 单页宽度（px），随窗口更新 */
var DRAG = null;         /* 拖拽中的实时偏移 */

/* 视差：按当前页与目标页的相对距离，给每页写 --par
   0 = 居中（正常），1 = 完全移出视口（缩到 .94、亮度 .65） */
function applyParallax(pos){
  var pages = $('pagesTrack').children;
  for(var i=0;i<pages.length;i++){
    var d = Math.abs(i - pos);                 /* 距离（单位=页） */
    var par = Math.max(0, Math.min(1, d));
    pages[i].style.setProperty('--par', par.toFixed(3));
  }
}
function updateTabs(){
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(el){
    var on = +el.dataset.i === STATE.page;
    el.classList.toggle('on', on);
    el.setAttribute('aria-current', on ? 'page' : 'false');
  });
}
function gotoPage(i, instant){
  var target = Math.max(0, Math.min(PAGES-1, i));
  STATE.page = target;
  DRAG = null;
  var track = $('pagesTrack');
  if(instant){
    track.style.transition = 'none';
    track.style.transform = 'translateX(' + (-target * PAGE_W) + 'px)';
    /* 强制回流后恢复过渡，避免下一次切换没有动画 */
    void track.offsetWidth;
    track.style.transition = '';
  }else{
    track.style.transform = 'translateX(' + (-target * PAGE_W) + 'px)';
  }
  applyParallax(target);
  updateTabs();
}
function measurePage(){
  var vp = $('pagesViewport');
  PAGE_W = vp.clientWidth || 1;
  var track = $('pagesTrack');
  track.style.transition = 'none';
  track.style.transform = 'translateX(' + (-STATE.page * PAGE_W) + 'px)';
  void track.offsetWidth;
  track.style.transition = '';
  applyParallax(STATE.page);
}
function bindNav(){
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(el){
    el.addEventListener('click', function(){ gotoPage(+el.dataset.i); });
  });
  measurePage();
  var vp = $('pagesViewport'), sx=0, sy=0, dragging=false, horiz=false, locked=false;

  /* 横向滚动区命中检测：设备切换条(.chips)、设备轮播(.carousel)、日历网格(.calgrid)…
     这些区域里滑动只滚自己的内容，不翻页。
     之前的白名单只有 .carousel/.seg，漏了概览页顶部的 .chips，
     所以设备超过 2 个时滑设备栏会直接翻到第二页。
     这里改成通用检测：沿 DOM 往上找 overflow-x 为 auto/scroll 且真的溢出
     （scrollWidth > clientWidth）的祖先，命中就锁掉翻页手势。
     容器内容没溢出（设备只有 1~2 个）时依然可以翻页，手感不被牺牲。 */
  function inScroller(el){
    while(el && el !== vp){
      if(el.nodeType === 1){
        var ox = '';
        try{ ox = window.getComputedStyle(el).overflowX; }catch(e){}
        if(ox === 'auto' || ox === 'scroll'){
          if(el.scrollWidth > el.clientWidth + 1) return true;
        }
      }
      el = el.parentNode;
    }
    return false;
  }

  /* 统一手势层：同时支持触摸与指针（桌面鼠标也能横向拖动翻页） */
  function gestureStart(cx, cy, target){
    if($('settingsSheet').classList.contains('open')) return; /* 设置面板打开时不翻页 */
    locked = inScroller(target);
    if(locked) return;
    sx = cx; sy = cy;
    dragging = true; horiz = false;
    DRAG = 0;
  }
  function gestureMove(cx, cy, ev){
    if(!dragging) return;
    var dx = cx - sx, dy = cy - sy;
    if(!horiz && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)*1.2){ horiz = true; dragging = true; }
    if(horiz && ev && ev.cancelable) ev.preventDefault();
    if(!horiz) return;
    /* 跟手：轨道实时跟随手指，两端加阻尼 */
    var raw = dx;
    var min = -(STATE.page) * PAGE_W;          /* 往左最多滑到第 0 页 */
    var max = (PAGES-1 - STATE.page) * PAGE_W;
    if(raw < min) raw = min + (raw - min) * 0.32;  /* 越界阻尼 */
    if(raw > max) raw = max + (raw - max) * 0.32;
    DRAG = raw;
    var track = $('pagesTrack');
    track.style.transition = 'none';
    track.style.transform = 'translateX(' + (-STATE.page * PAGE_W + raw) + 'px)';
    /* 视差跟着手指走 */
    applyParallax(STATE.page + (-raw / PAGE_W));
  }
  function gestureEnd(cx){
    if(!dragging) return;
    dragging = false;
    var dx = cx - sx;
    if(horiz){
      var th = PAGE_W * 0.28;                 /* 超过 28% 页宽就翻页 */
      var fast = Math.abs(dx) > 12;          /* 快速轻扫也翻 */
      if(Math.abs(dx) > th || (fast && Math.abs(dx) > 42)){
        gotoPage(STATE.page + (dx < 0 ? 1 : -1));
      }else{
        gotoPage(STATE.page);                 /* 弹回原页 */
      }
    }else{
      var track2 = $('pagesTrack');
      track2.style.transition = '';
      track2.style.transform = 'translateX(' + (-STATE.page * PAGE_W) + 'px)';
      applyParallax(STATE.page);
    }
    horiz = false;
    DRAG = null;
  }
  /* 触摸 */
  vp.addEventListener('touchstart', function(e){
    if(e.touches.length !== 1) return;
    gestureStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
  }, { passive:true });
  vp.addEventListener('touchmove', function(e){
    if(!dragging) return;
    gestureMove(e.touches[0].clientX, e.touches[0].clientY, e);
  }, { passive:false });
  vp.addEventListener('touchend', function(e){
    gestureEnd(e.changedTouches[0].clientX);
  }, { passive:true });
  vp.addEventListener('touchcancel', function(e){
    dragging = false; horiz = false; DRAG = null;
    gotoPage(STATE.page);
  }, { passive:true });
  /* 指针（鼠标 / 触控笔）：桌面端也能拖动翻页 */
  vp.addEventListener('pointerdown', function(e){
    if(e.pointerType === 'touch') return;   /* 触摸交给上面的 touch 事件 */
    if(e.button !== 0) return;
    gestureStart(e.clientX, e.clientY, e.target);
  }, { passive:true });
  vp.addEventListener('pointermove', function(e){
    if(e.pointerType === 'touch') return;
    if(!dragging) return;
    gestureMove(e.clientX, e.clientY, e);
  }, { passive:false });
  vp.addEventListener('pointerup', function(e){
    if(e.pointerType === 'touch') return;
    gestureEnd(e.clientX);
  }, { passive:true });
  /* 窗口尺寸变化时重算页宽，避免轨道错位 */
  window.addEventListener('resize', function(){ measurePage(); });
  Array.prototype.forEach.call($('seg').querySelectorAll('button'), function(b){
    b.addEventListener('click', function(){
      STATE.period = b.dataset.p; STATE.offset = 0;
      Array.prototype.forEach.call($('seg').querySelectorAll('button'), function(x){
        var on = x===b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      renderChart();
    });
  });
  $('chartPrev').onclick = function(){ STATE.offset++; renderChart(); };
  $('chartNext').onclick = function(){ STATE.offset = Math.max(0, STATE.offset-1); renderChart(); };
  $('devPeriod').onchange = renderDevices;
  /* 圆点也能点：点第几个就滑到第几张卡 */
  $('dots').addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('.dot') : null;
    if(!b) return;
    centerCard($('carousel'), +b.getAttribute('data-i'), true);
  });
  $('ovChips').addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('.chip') : null;
    if(!b) return;
    STATE.devIdx = parseInt(b.getAttribute('data-i'), 10);
    if(isNaN(STATE.devIdx)) STATE.devIdx = -1;
    renderChips(); renderOverview(false); renderStats(); renderInsights();
  });
  $('closeBtn').onclick = function(){ $('appScreen').classList.add('hidden'); show('home'); };
  /* 右上角齿轮 → 设置面板；面板内返回箭头关闭 */
  var sheet = $('settingsSheet');
  function openSheet(){
    sheet.classList.add('open');
    sheet.setAttribute('aria-hidden','false');
    sheet.querySelector('.sheet-body').scrollTop = 0;
  }
  function closeSheet(){
    sheet.classList.remove('open');
    sheet.setAttribute('aria-hidden','true');
  }
  $('settingsBtn').onclick = openSheet;
  $('setBack').onclick = closeSheet;
  window.__openSheet = openSheet;
  window.__closeSheet = closeSheet;
}

/* ---------- 文件 / 解析 ---------- */
function show(id){ ['home','loading','error'].forEach(function(s){ $(s).classList.toggle('hidden', s !== id); }); window.scrollTo(0,0); }
function status(t){ $('status').textContent = t; }
/* ---------- 原生 ZIP 解析 + 流式解压（低内存，手机端关键） ----------
   健康导出 zip 约 22MB，但其中 导出.xml 解压后约 430MB。
   整体解压会让内存峰值超过 iPhone 承受范围，Safari 会直接回收标签页。
   这里自己解析 ZIP 中央目录，只把目标条目的原始 deflate 数据交给浏览器原生
   DecompressionStream 流式解压，边解压边解析，内存占用降到几十 MB。 */
function readBlobBuf(blob){
  if(blob && blob.arrayBuffer) return blob.arrayBuffer();
  return new Promise(function(res, rej){
    var fr = new FileReader();
    fr.onload = function(){ res(fr.result); };
    fr.onerror = function(){ rej(new Error('read-failed')); };
    fr.onabort = function(){ rej(new Error('read-aborted')); };
    try{ fr.readAsArrayBuffer(blob); }catch(e){ rej(new Error('read-failed')); }
  });
}
function blobStream(blob){
  if(blob.stream) return blob.stream();
  return new ReadableStream({          // 极老内核兜底
    start:function(c){
      readBlobBuf(blob).then(
        function(b){ c.enqueue(new Uint8Array(b)); c.close(); },
        function(e){ c.error(e); }
      );
    }
  });
}
function findZipXmlEntry(file){
  var TAIL = Math.min(file.size, 66000);
  return readBlobBuf(file.slice(file.size - TAIL)).then(function(tailBuf){
    var t = new Uint8Array(tailBuf), eocd = -1, i;
    for(i = t.length - 22; i >= 0; i--){
      if(t[i] === 0x50 && t[i+1] === 0x4b && t[i+2] === 0x05 && t[i+3] === 0x06){ eocd = i; break; }
    }
    if(eocd < 0) throw new Error('bad-zip');
    var dv = new DataView(t.buffer, t.byteOffset, t.byteLength);
    var count  = dv.getUint16(eocd + 10, true);
    var cdSize = dv.getUint32(eocd + 12, true);
    var cdOff  = dv.getUint32(eocd + 16, true);
    if(cdOff === 0xFFFFFFFF || count === 0xFFFF) throw new Error('zip64-unsupported');
    return readBlobBuf(file.slice(cdOff, cdOff + cdSize)).then(function(cdBuf){
      var c = new Uint8Array(cdBuf);
      var cv = new DataView(c.buffer, c.byteOffset, c.byteLength);
      var dec = new TextDecoder('utf-8'), p = 0, best = null, k;
      for(k = 0; k < count && p + 46 <= c.length; k++){
        if(cv.getUint32(p, true) !== 0x02014b50) break;
        var method     = cv.getUint16(p + 10, true);
        var compSize   = cv.getUint32(p + 20, true);
        var uncompSize = cv.getUint32(p + 24, true);
        var nameLen    = cv.getUint16(p + 28, true);
        var extraLen   = cv.getUint16(p + 30, true);
        var cmtLen     = cv.getUint16(p + 32, true);
        var localOff   = cv.getUint32(p + 42, true);
        var name = '';
        try{ name = dec.decode(c.subarray(p + 46, p + 46 + nameLen)); }catch(e){}
        if(/\.xml$/i.test(name) && !/cda/i.test(name) && method === 8 && compSize > 0 && uncompSize !== 0xFFFFFFFF){
          if(!best || uncompSize > best.uncompSize){
            best = { name:name, compSize:compSize, uncompSize:uncompSize, localOff:localOff };
          }
        }
        p += 46 + nameLen + extraLen + cmtLen;
      }
      if(!best) throw new Error('no-stream');
      return readBlobBuf(file.slice(best.localOff, best.localOff + 30)).then(function(lhBuf){
        var l = new Uint8Array(lhBuf);
        var lv = new DataView(l.buffer, l.byteOffset, l.byteLength);
        if(l.length < 30 || lv.getUint32(0, true) !== 0x04034b50) throw new Error('bad-local-header');
        var lNameLen = lv.getUint16(26, true), lExtraLen = lv.getUint16(28, true);
        best.dataStart = best.localOff + 30 + lNameLen + lExtraLen;
        return best;
      });
    });
  });
}
/* 原生流式解压：把 File 的一段切片直接交给 DecompressionStream。
   内存只占流缓冲（几十 KB），不读整包；
   也不会出现「TypedArray 视图被 detach」的崩溃点。 */
function nativeXmlStream(file){
  if(typeof DecompressionStream === 'undefined') return Promise.resolve(null);
  return findZipXmlEntry(file).then(function(info){
    var ds;
    try{ ds = new DecompressionStream('deflate-raw'); }catch(e){ return null; }
    var part = file.slice(info.dataStart, info.dataStart + info.compSize);
    return blobStream(part).pipeThrough(ds);
  }).catch(function(){ return null; });
}
function jszipXmlStream(buf){
  return JSZip.loadAsync(buf).then(function(zip){
    var entries = [];
    zip.forEach(function(path, entry){
      if(!entry.dir && /\.xml$/i.test(path) && !/cda/i.test(path)) entries.push(entry);
    });
    if(!entries.length) throw new Error('压缩包里没有找到健康数据 XML，请确认选择的是健康 App 导出的 zip。');
    entries.sort(function(a,b){ return ((b._data&&b._data.uncompressedSize)||0) - ((a._data&&a._data.uncompressedSize)||0); });
    var e = entries[0];
    var size = (e._data && e._data.uncompressedSize) || 0;
    if(size > 120*1024*1024){
      status('正在解压（数据较大，请勿切换应用）…');
    } else {
      status('正在解压健康数据（较大，请稍候）…');
    }
    return e.async('uint8array');
  }).then(function(u8){
    var done = false;
    return new ReadableStream({
      pull:function(c){
        if(done){ c.close(); return; }
        done = true;
        c.enqueue(u8); c.close();
      }
    });
  });
}
function readBuffer(file){
  var key = (file.name||'')+'|'+(file.size||0)+'|'+(file.lastModified||0);
  if(STATE.cached && STATE.cached.key === key && STATE.cached.buf) return Promise.resolve(STATE.cached.buf);
  return new Promise(function(resolve, reject){
    /* iOS Safari 上 file.arrayBuffer() 读大文件常抛 "The I/O read operation failed"，
       FileReader 对同一场景稳定得多，因此优先使用它。 */
    function withFileReader(){
      var fr = new FileReader();
      fr.onload = function(){ resolve(fr.result); };
      fr.onerror = function(){ reject(new Error('read-failed')); };
      fr.onabort = function(){ reject(new Error('read-aborted')); };
      try{ fr.readAsArrayBuffer(file); }
      catch(e){ reject(new Error('read-failed')); }
    }
    function withArrayBuffer(){
      if(!file.arrayBuffer) return withFileReader();
      file.arrayBuffer().then(resolve).catch(function(){ withFileReader(); });
    }
    if(file.size && file.size > 4*1024*1024) withFileReader(); else withArrayBuffer();
  }).then(function(buf){
    if(!buf || !buf.byteLength) throw new Error('read-empty');
    STATE.cached = { key:key, buf:buf };   // 只缓存成功的结果
    return buf;
  }).catch(function(err){
    STATE.cached = null;                  // 失败不缓存，避免重选时命中坏数据
    throw err;
  });
}
function parseXml(stream){
  return new Promise(function(resolve, reject){
    var reader = stream.getReader();
    var decoder = new TextDecoder('utf-8');
    var carry = '', count = 0, map = {}, NEEDLE = 'HeadphoneAudioExposure';
    function emit(tag){
      if(attr(tag,'type') !== TYPE) return;
      var v = parseFloat(attr(tag,'value'));
      var s = parseDate(attr(tag,'startDate')), e = parseDate(attr(tag,'endDate'));
      if(!isFinite(v) || !isFinite(s) || !isFinite(e)) return;
      var info = parseDevice(attr(tag,'device'));
      var key = info.id || info.name;
      if(!map[key]) map[key] = { name:info.name, id:info.id, recs:[] };
      map[key].recs.push({ s:s, e:e, v:v }); count++;
      if(count % 4000 === 0) status('已解析 ' + count.toLocaleString('zh-CN') + ' 条记录…');
    }
    /* 只在命中 NEEDLE 的位置回溯标签起点，比对全部 <Record> 跑正则快数倍 */
    function handle(text, final){
      carry += text;
      var idx = 0, consumed = 0;
      while(true){
        var k = carry.indexOf(NEEDLE, idx);
        if(k < 0) break;
        var tagStart = carry.lastIndexOf('<Record', k);
        var tagEnd = carry.indexOf('>', k);
        if(tagEnd < 0){ if(!final) break; tagEnd = carry.length - 1; }
        if(tagStart < 0){ if(!final) break; tagStart = 0; }
        emit(carry.slice(tagStart, tagEnd + 1));
        idx = tagEnd + 1; consumed = idx;
      }
      if(consumed > 0) carry = carry.slice(consumed);
      if(carry.length > 262144) carry = carry.slice(-65536);   // 防止尾部无限膨胀
    }
    reader.read().then(function step(res){
      if(res.done){
        handle('', true);
        devices = Object.keys(map).map(function(k){ return map[k]; })
          .filter(function(d){ return d.recs.length >= 5; })
          .map(function(d){ d.recs.sort(function(a,b){ return a.s-b.s; }); d.total = statsFor(d.recs).total; return d; })
          .sort(function(a,b){ return b.recs.length - a.recs.length; });
        if(!devices.length) reject(new Error('没有找到耳机音量记录。请确认这份 iPhone「健康」导出里确实有戴耳机时产生的音量暴露记录。'));
        else resolve();
        return;
      }
      handle(decoder.decode(res.value, { stream:true }));
      return reader.read().then(step);
    }).catch(reject);
  });
}
function finishReport(){
  ALL = []; devices.forEach(function(d){ ALL = ALL.concat(d.recs); });
  ALL.sort(function(a,b){ return a.s-b.s; });
  STATE.anchor = dayMS(ALL[ALL.length-1].e);
  ALL.forEach(function(r){ if(r.e > STATE.anchor) STATE.anchor = dayMS(r.e); });
  STATE.allTotal = statsFor(ALL).total;
  var topDev = devices.slice().sort(function(a,b){ return b.total - a.total; })[0];
  STATE.topName = topDev ? topDev.name : '';
  renderOverview(true); renderStats(); renderDevices(); renderChips(); renderInsights();
  $('appScreen').classList.remove('hidden');
  ['home','loading','error'].forEach(function(x){ $(x).classList.add('hidden'); });
  gotoPage(0);
  bindNav();
  STATE.busy = false;
  STATE.cached = null;              // 报告已生成，释放缓存的原始数据
  clearPicking();
  resetFileInput();                 // 解析完成后才清空，绝不在 change 里动 value
  markStage('done');
}
function analyze(file, retried){
  if(STATE.busy) return;
  STATE.busy = true;
  show('loading'); status('正在读取压缩包…');
  markStage('read');
  var nativeOK = (typeof DecompressionStream !== 'undefined');
  var p;
  if(nativeOK){
    STATE_PATH = '原生流式';
    p = nativeXmlStream(file).then(function(st){
      if(st){ status('正在流式解压（省内存，较快）…'); return st; }
      STATE_PATH = '兼容模式(整包解压)';
      status('正在解压健康数据（较大，请稍候）…');
      return readBuffer(file).then(jszipXmlStream);
    });
  } else {
    STATE_PATH = '兼容模式(整包解压)';
    p = readBuffer(file).then(jszipXmlStream);
  }
  p.then(function(stream){ status('正在解析耳机记录…'); markStage('parse'); return parseXml(stream); })
  .then(finishReport).catch(function(err){
    STATE.busy = false;
    var msg = (err && err.message) ? err.message : String(err);
    var low = String(msg).toLowerCase();
    /* 原生路径失败时只回退一次。旧代码在这里递归调用 analyze，
       而 usedNative 每次都是新的局部变量 → 无限重试 → 内存爆掉 → 页面被系统回收重载。 */
    if(!retried && STATE_PATH === '原生流式'){
      STATE_PATH = '兼容模式(重试)';
      STATE.cached = null;
      status('正在换用兼容模式重试…');
      markStage('retry');
      setTimeout(function(){ analyze(file, true); }, 80);
      return;
    }
    resetFileInput();
    markStage('error');
    if(/read-failed|read-aborted|read-empty|i\/o|out of memory|allocation failed|quota/.test(low)){
      msg = '读取文件失败：手机内存不足或文件被占用。请关闭其他页面后重试；若反复失败，建议改用电脑打开，或换用 Safari 的「文件」App 重新导出。';
    } else if(/empty-xml|no-stream/.test(low)){
      msg = '解压失败：压缩包内容不完整或格式异常。请重新导出一次健康数据再试。';
    } else if(/no such|zip|crc|central directory|invalid|unsupported/.test(low)){
      msg = '压缩包已损坏或不是健康 App 导出的 zip。请重新导出后导入。';
    }
    $('errMsg').textContent = msg;
    try{ $('errMsg').textContent += ' ｜ 环境：' + ENV + ' · ' + (typeof STATE_PATH !== 'undefined' ? STATE_PATH : ''); }catch(e){}
    show('error');
  });
}
/* 用 <label for> 关联触发，避免 input.click() 在 iOS WebView 里引发页面导航/重载。
   在打开选择器之前清空 value，保证连续选同一个文件也能触发 change（切勿在 change 里清空，会让 File 句柄失效）。 */
function resetFileInput(){ try{ $('file').value = ''; }catch(e){} }
/* 标记「正在选文件」。本地文件模式下，选完文件后页面可能被浏览器重建；
   重新加载时看到这个标记，就能告诉用户真实原因，而不是让人以为网页坏了。 */
function markPicking(){ try{ localStorage.setItem('hp_importing', String(Date.now())); }catch(e){} }
function clearPicking(){ try{ localStorage.removeItem('hp_importing'); }catch(e){} }
/* 点击时只打标记，不修改 input.value：
   在 label 触发系统文件选择器的同一事件里改 value，iOS 上可能干扰选择流程。
   value 改为每次解析结束后清空（见 analyze），同样能保证重选同一文件触发 change。 */
$('pickBtn').onclick = function(){ markPicking(); };
$('retryBtn').onclick = function(){ markPicking(); };

/* ---------- 环境诊断：首页与设置页各一行小字，用来判断问题出在设备/浏览器还是代码 ---------- */
function iosVersion(){
  var m = /OS (\d+)[._](\d+)/.exec(navigator.userAgent || '');
  return m ? ('iOS ' + m[1] + '.' + m[2]) : '非 iOS';
}
function nativeStreamOK(){
  if(typeof DecompressionStream === 'undefined') return false;
  try{ new DecompressionStream('deflate-raw'); return true; }catch(e){ return false; }
}
var ENV = iosVersion() + ' · 流式解压' + (nativeStreamOK() ? '可用' : '不可用');
var STATE_PATH = '未开始';
try{
  var envEl = document.createElement('div');
  envEl.className = 'envline';
  envEl.textContent = ENV + ' · v4.6.0';
  var envHost = $('envHost');
  if(envHost) envHost.appendChild(envEl);
  var env2 = $('envLine2');
  if(env2) env2.textContent = ENV;
}catch(e){}

/* 浏览器环境检测：
   1) iOS 版 Edge（WebKit 套壳）点「选择文件」后会重载页面，导入必然中断 —— 引导到 Safari
   2) 本地文件模式（file: / edge:）会因临时副本失效而中断 */
(function(){
  var proto = location.protocol || '';
  var ua = navigator.userAgent || '';
  var isEdgeIOS = /EdgiOS/.test(ua);
  var isLocalFile = proto === 'file:' || proto === 'edge:' || proto === 'ms-edge:' || /external-file/.test(location.href);
  var isHttp = /^https?:$/.test(proto);
  var msg = '', tip = '', needSafari = false;

  var lastStage = '';
  try{
    var stamp = localStorage.getItem('hp_importing');
    if(stamp){
      localStorage.removeItem('hp_importing');
      if(Date.now() - parseInt(stamp, 10) < 180000){
        msg = '上次在选完文件后，页面被浏览器重载了，导入因此中断。';
      }
    }
    var stg = localStorage.getItem('hp_stage');
    if(stg){
      var parts = String(stg).split('|');
      var when = parseInt(parts[1], 10) || 0;
      if(when && Date.now() - when < 300000 && parts[0] !== 'done'){
        lastStage = '上次卡在：' + parts[0];
        if(!msg) msg = '上次导入没有走完就中断了。';
      }
    }
  }catch(e){}

  if(isEdgeIOS && isHttp){
    needSafari = true;
    if(!msg) msg = 'iOS 版 Edge 存在一个已知问题：点「选择文件」后会把整个页面重载，导入必然中断。';
    tip = '请改用 Safari 打开本页（Safari 是系统自带的）。点「复制链接」后粘贴到 Safari 地址栏即可。';
  } else if(!msg && isLocalFile){
    msg = isEdgeIOS
      ? 'iOS 版 Edge 打开本地 HTML 时，一点「选择 ZIP」就会重建页面，临时副本随即失效。'
      : 'iOS 上直接打开本地 HTML 时，系统可能中断文件选择。';
    tip = '解决办法：用 http(s) 网址打开（例如 GitHub Pages），数据依然只在手机上解析、不上传。';
  }

  if(!msg) return;
  var w = document.createElement('div');
  w.className = 'edgewarn';
  w.innerHTML = '<b>提示</b>　' + msg +
    (tip ? '<br><span style="opacity:.82">' + tip + '</span>' : '') +
    (needSafari ? '<div class="copyrow"><button class="copybtn" type="button">复制链接</button><span class="copytip"></span></div>' : '') +
    '<br><span style="opacity:.72;font-size:11px">设备：' + ENV + (lastStage ? ' ｜ ' + lastStage : '') + '</span>' +
    '<br><span style="opacity:.6;font-size:11px">轻点本提示可关闭</span>';

  w.onclick = function(ev){
    var el = ev && ev.target;
    var btn = (el && el.closest) ? el.closest('.copybtn') : null;
    if(btn){
      ev.stopPropagation();
      var mark = function(){
        var t = w.querySelector('.copytip');
        if(t) t.textContent = '已复制，去 Safari 粘贴';
      };
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(location.href).then(mark, mark);
        } else { mark(); }
      }catch(e){ mark(); }
      return;
    }
    try{ w.remove(); }catch(e){ w.style.display = 'none'; }
  };
  document.body.appendChild(w);
})();
/* 注意：这里不再在 visibilitychange / pageshow 里清标记。
   页面被系统重载后也会触发这两个事件，清掉标记就等于抹掉了唯一的证据，
   导致用户永远看不到「上次导入被中断」的真实原因。 */

/* 阶段日志：把导入进度写进 localStorage。
   若页面被浏览器重载，下次打开就能看到卡在哪一步，而不是只能猜。 */
function markStage(st){
  try{ localStorage.setItem('hp_stage', st + '|' + Date.now()); }catch(e){}
}

$('file').addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0];
  clearPicking();
  /* 关键修复：这里绝对不能清空 input.value。
     WebKit 上清空会让刚拿到的 File 句柄失效，读取较大 zip 时抛
     "The I/O read operation failed" —— 之前反复失败的真正原因。
     清空动作已挪到点击按钮、打开选择器之前（pickBtn.onclick），效果相同但不破坏句柄。 */
  if(f) analyze(f);
});

/* ---------- 分享逻辑 ---------- */
(function(){
  var SHARE_URL = 'https://headphone-report.app.workbuddy.host/?sharecode=WRWALA5PVK';
  var urls = document.querySelectorAll('[data-sh-url]');
  for(var u=0; u<urls.length; u++) urls[u].textContent = SHARE_URL.replace(/^https?:\/\//, '');
  var tEl = $('shOk');
  function toast(msg){
    if(!tEl) return;
    tEl.textContent = msg; tEl.classList.add('on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ tEl.classList.remove('on'); }, 1800);
  }
  function copy(){
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(SHARE_URL);
    }
    return new Promise(function(res, rej){
      var ta = document.createElement('textarea');
      ta.value = SHARE_URL; ta.setAttribute('readonly','');
      ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0';
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, SHARE_URL.length);
      var ok = false;
      try{ ok = document.execCommand('copy'); }catch(e){}
      document.body.removeChild(ta);
      ok ? res() : rej(new Error('copy-failed'));
    });
  }
  function doCopy(){ copy().then(function(){ toast('链接已复制'); }, function(){ toast('复制失败，请长按链接手动复制'); }); }
  function doShare(){
    if(navigator.share){
      navigator.share({ title:'耳机佩戴报告', text:'看看我的苹果耳机聆听数据', url: SHARE_URL }).catch(function(){});
    } else {
      copy().then(function(){ toast('链接已复制，去粘贴吧'); }, function(){ toast('当前浏览器不支持分享，请复制链接'); });
    }
  }
  var cs = document.querySelectorAll('[data-sh-copy]');
  for(var a=0; a<cs.length; a++) cs[a].addEventListener('click', doCopy);
  var ss = document.querySelectorAll('[data-sh-share]');
  for(var b=0; b<ss.length; b++) ss[b].addEventListener('click', doShare);
  var opener = $('openShare');
  if(opener) opener.addEventListener('click', function(){ gotoPage(4); }); /* 分享页 */
})();

/* ---------- 全局按压反馈：任何模块按下就亮，松手复原（iOS 按钮手感） ----------
   规则一：能点进去的模块（底部标签、设备切换条、分段控件…）照常执行动作；
   规则二：点不进去的模块（卡片、列表行、说明块…）也给一次「我确实碰到了」的反馈；
   按下 → 加 .pressing（底色变实 + 轻微缩放），松手 / 手指划走 / 页面滚动 → 立刻撤销。 */
(function(){
  var SEL = '.card,.chip,.btn,.sh-entry,.drow,.setrow,.cbtn,.seg button,.modese button,'
          + '.tab,.iconbtn,.tn-theme,.arw,.sh-key,.sh-warn,.dot,.drop,.qrbox,.sh-url,.edgewarn,a';
  var cur = null, net = null;
  function off(){
    if(cur){ cur.classList.remove('pressing'); cur = null; }
    if(net){ try{ window.clearTimeout(net); }catch(e){} net = null; }
  }
  function pick(el){
    if(!el || !el.closest) return null;
    return el.closest(SEL);
  }
  document.addEventListener('pointerdown', function(e){
    var el = pick(e.target);
    if(!el) return;
    off();
    el.classList.add('pressing');
    cur = el;
    /* 手指从模块上划走 → 立刻取消高亮 */
    el.addEventListener('pointerleave', function(){ if(cur === el) off(); }, { once:true });
    /* 兜底：极端情况下 pointerup 丢失时，别把高亮留在屏幕上 */
    net = window.setTimeout(off, 30000);
  }, { passive:true });
  ['pointerup','pointercancel','mouseup','touchend','touchcancel'].forEach(function(t){
    window.addEventListener(t, off, { passive:true });
  });
  /* 滚动时手指已经离开卡片，高亮要跟着走 */
  window.addEventListener('scroll', off, { passive:true, capture:true });
  window.addEventListener('blur', off);
  document.addEventListener('visibilitychange', off);
})();

/* ---------- 演示钩子：?demo=1 直接生成示例报告（用于无 ZIP 环境验证界面） ---------- */
if(/(^|[?#&])demo=1(&|$)/.test(location.search + location.hash)){
  (function(){
    var base = new Date(); base.setHours(0,0,0,0);
    /* ?short=1 用 200 天跨度，方便验证「按天 53 周」日历模式 */
    var SPAN = /short=1/.test(location.search + location.hash) ? 200 : 400;
    base = dayMS(base.getTime()) - SPAN*86400000;
    function mkDev(id, name, days, prob, dur){
      var recs = [];
      for(var d=0; d<days; d++){
        if(Math.random() > prob) continue;
        var start = base + d*86400000 + (9 + Math.floor(Math.random()*12))*3600000;
        var len = (dur/2 + Math.random()*dur/2)*3600000;
        var s = start, e;
        while(s < start + len){
          e = Math.min(start + len, s + (25 + Math.floor(Math.random()*40))*60000);
          recs.push({ s:s, e:e, v:55 + Math.random()*25 });
          s = e + (2 + Math.random()*6)*60000;
        }
      }
      return { name:name, id:id, recs:recs };
    }
    devices = [
      mkDev('AA-BB-CC-DD-EE-FF-tacl', 'AirPods 4 (ANC)', SPAN, .72, 2.4),
      mkDev('11-22-33-44-55-66-tacl', 'OPPO Enco X2', SPAN, .40, 1.8),
      mkDev('22-33-44-55-66-77-tacl', 'EDIFIER W820NB', Math.round(SPAN*.75), .26, 2.0),
      mkDev('33-44-55-66-77-88-tacl', 'Redmi Speaker-1114', Math.round(SPAN*.65), .18, 2.6),
      mkDev('44-55-66-77-88-99-tacl', 'CMF Buds 2', Math.round(SPAN*.5), .22, 1.2),
      mkDev('55-66-77-88-99-AA-tacl', '小度智能蓝牙音箱Smile', Math.round(SPAN*.4), .12, 3.0)
    ];
    devices.forEach(function(d){ d.recs.sort(function(a,b){ return a.s-b.s; }); d.total = statsFor(d.recs).total; });
    finishReport();
  })();
}

initAppearance();

/* ---------- 自检钩子：?audit=1 输出真实布局测量（供本地校验） ---------- */
if(/(^|[?#&])audit=1(&|$)/.test(location.search + location.hash)){
  (function(){
    var TOUR = /tour=1/.test(location.search + location.hash);
    function m(sel, label){
      var el = document.querySelector(sel);
      if(!el) return label+': MISSING';
      var r = el.getBoundingClientRect();
      return label+': x='+Math.round(r.x)+' y='+Math.round(r.y)+' w='+Math.round(r.width)+' h='+Math.round(r.height);
    }
    function overlap(a,b){
      var ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
      return !(ra.right<=rb.left||rb.right<=ra.left||ra.bottom<=rb.top||rb.bottom<=ra.top);
    }
    function runOnce(tag){
      var out=['=== '+tag+' ==='];
      out.push('视口: '+window.innerWidth+'x'+window.innerHeight);
      out.push(m('.hero-txt','hero文字区'));
      out.push(m('.hero .deco','hero图标框'));
      out.push(m('#ovArt .art','hero内图标'));
      out.push(m('.chips','切换条'));
      out.push(m('.chip.on','选中chip'));
      out.push(m('.tabbar','底栏'));
      var txt=document.querySelector('.hero-txt'), dec=document.querySelector('.hero .deco');
      out.push('hero文字与图标是否重叠: '+(txt&&dec?overlap(txt,dec):'?'));
      var art=document.querySelector('#ovArt .art');
      if(art){ var ar=art.getBoundingClientRect(), dr=dec.getBoundingClientRect();
        out.push('图标是否超出图标框: '+(ar.left<dr.left-1||ar.right>dr.right+1||ar.top<dr.top-1||ar.bottom>dr.bottom+1?'是(溢出)':'否(完整)')); }
      /* 滚动限位：每页滚到底后，scrollTop 应等于 scrollHeight-clientHeight，且不留空白 */
      var pages=document.querySelectorAll('.hp-page');
      out.push('页面数: '+pages.length);
      Array.prototype.forEach.call(pages,function(pg,i){
        pg.scrollTop=pg.scrollHeight;
        var max=pg.scrollHeight-pg.clientHeight;
        out.push('  page'+i+' scrollH='+pg.scrollHeight+' clientH='+pg.clientHeight+' 滚到底scrollTop='+Math.round(pg.scrollTop)+' (上限'+max+') '+(Math.abs(pg.scrollTop-max)<2?'OK 精确到末尾':'留白'+Math.round(max-pg.scrollTop)+'px'));
        pg.scrollTop=0;
      });
      /* 设备卡片居中检查 */
      var car=document.querySelector('.carousel');
      if(car){ var cd=car.querySelector('.dcard'); var cr=car.getBoundingClientRect(), dr2=cd.getBoundingClientRect();
        out.push('设备卡居中偏差: '+Math.round((dr2.left-cr.left)-(cr.right-dr2.right))+'px (0=居中)');
        if(car.children.length>1){
          centerCard(car,1,false);
          var c1=car.children[1], cr2=car.getBoundingClientRect(), rr2=c1.getBoundingClientRect();
          out.push('滑到第2张后居中偏差: '+Math.round((rr2.left-cr2.left)-(cr2.right-rr2.right))+'px');
          out.push('当前圆点序号: '+document.querySelectorAll('.dots .dot.on').length+' 个高亮');
          centerCard(car,0,false);
        }
      }
      var dec3=document.querySelector('.hero .deco');
      if(dec3){ var cs3=getComputedStyle(dec3);
        out.push('hero图标底框: bg='+cs3.backgroundColor+' border='+cs3.borderTopWidth+' pad='+cs3.paddingTop); }
      var di=document.querySelector('.drow .di');
      if(di){ var cs4=getComputedStyle(di);
        out.push('列表图标底框: bg='+cs4.backgroundColor+' border='+cs4.borderTopWidth+' w='+Math.round(di.getBoundingClientRect().width)); }
      /* 按压反馈自检：按下要有 .pressing，松手要清掉 */
      var mc=document.querySelector('.m');
      if(mc && window.PointerEvent){
        var before=getComputedStyle(mc).backgroundColor;
        mc.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        var on=mc.classList.contains('pressing');
        var during=getComputedStyle(mc).backgroundColor;
        window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
        out.push('按压反馈: 按下有高亮='+on+' 底色变化='+(before!==during)+' 松手已清除='+(!mc.classList.contains('pressing')));
      }
      /* chip：按下要缩放 + 变色 */
      var cc=document.querySelectorAll('.chip')[1];
      if(cc && window.PointerEvent){
        var ct0=cc.style.transition; cc.style.transition='none';
        var cb=getComputedStyle(cc).backgroundColor;
        cc.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        var ct=getComputedStyle(cc).transform, ca=getComputedStyle(cc).backgroundColor;
        window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
        cc.style.transition=ct0;
        out.push('chip按压: 缩放='+ct+' 底色变化='+(cb!==ca)+' 松手清除='+(!cc.classList.contains('pressing')));
      }
      /* 设备列表行：按下要有底色 */
      var rw=document.querySelector('.drow');
      if(rw && window.PointerEvent){
        var rt0=rw.style.transition; rw.style.transition='none';
        var rb=getComputedStyle(rw).backgroundColor;
        rw.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
        var ra=getComputedStyle(rw).backgroundColor;
        window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
        rw.style.transition=rt0;
        out.push('列表行按压: 底色 '+rb+' → '+ra+' 变化='+(rb!==ra));
      }
      var chs=document.querySelectorAll('.chip');
      out.push('chip 总数: '+chs.length+' 其中选中: '+document.querySelectorAll('.chip.on').length);
      var res=document.createElement('pre');
      res.id='auditOut'; res.style.cssText='position:fixed;inset:0;z-index:9999;background:#000;color:#0f0;font:12px monospace;padding:12px;white-space:pre-wrap;overflow:auto;margin:0';
      res.textContent=out.join('\n');
      document.body.appendChild(res);
      out.push('@@STATE@@ ' + JSON.stringify({
        devIdx: STATE.devIdx,
        chipOn: (document.querySelector('.chip.on .span')||{}).textContent,
        chipOnRaw: (document.querySelector('.chip.on')||{}).textContent,
        ovPeriod: ($('ovPeriod')||{}).textContent, ovFirst: ($('ovFirst')||{}).textContent,
        ovLast: ($('ovLast')||{}).textContent, ovTotal: ($('ovTotal')||{}).textContent,
        page: STATE.page, devices: devices.length
      }));
      return out.join('\n');
    }
    function clickChip(i){
      var box=$('ovChips'); if(!box) return;
      var cs=box.querySelectorAll('.chip');
      for(var k=0;k<cs.length;k++) if(cs[k].getAttribute('data-i')===String(i)) cs[k].click();
    }
    var steps = TOUR ? [
      function(){ gotoPage(0); clickChip(1); return '概览-切到OPPO'; },
      function(){ clickChip(2); return '概览-切到EDIFIER'; },
      function(){ gotoPage(1); return '统计页'; },
      function(){ gotoPage(2); return '洞察页'; },
      function(){ gotoPage(3); return '设备页'; },
      function(){ gotoPage(4); return '分享页'; },
      function(){ window.__openSheet && window.__openSheet(); return '设置面板'; }
    ] : [ function(){ return '初始(全部设备)'; } ];
    var si=0;
    function step(){
      var tag;
      try{ tag = steps[si % steps.length](); }catch(e){ tag='ERR '+e.message; }
      var txt = runOnce(tag);
      if(si===0 || !TOUR){
        var res=document.getElementById('auditOut');
        if(!res){ res=document.createElement('pre'); res.id='auditOut';
          res.style.cssText='position:fixed;inset:0;z-index:9999;background:#000;color:#0f0;font:11px monospace;padding:10px;white-space:pre-wrap;overflow:auto;margin:0';
          document.body.appendChild(res); }
        res.textContent = txt;
      }
      try{ fetch('/__audit', { method:'POST', headers:{'Content-Type':'text/plain'}, body: txt }); }catch(e){}
      si++;
      if(TOUR && si < steps.length+1) setTimeout(step, 300);
      else if(!TOUR) { /* 单次 */ }
    }
    setTimeout(step, 1500);
  })();
}

/* ---------- 预览钩子：?tour=1 自动轮播各页 / 各设备（仅供本地视觉校验） ---------- */
if(/(^|[?#&])tour=1(&|$)/.test(location.search + location.hash)){
  (function(){
    /* 用真实 DOM 点击事件驱动，走完整的事件委托路径 */
    function clickChip(i){
      var box = $('ovChips');
      var chips = box ? box.querySelectorAll('.chip') : [];
      var target = null;
      for(var k=0;k<chips.length;k++) if(chips[k].getAttribute('data-i') === String(i)) target = chips[k];
      if(target) target.click();
    }
    var seq = [
      function(){ gotoPage(0); },
      function(){ gotoPage(0); clickChip(1); },
      function(){ gotoPage(0); clickChip(2); },
      function(){ gotoPage(1); },
      function(){ gotoPage(2); },
      function(){ gotoPage(3); },
      function(){ gotoPage(0); clickChip(-1); },
      function(){ gotoPage(4); },
      function(){ window.__openSheet && window.__openSheet(); }
    ];
    var i = 0;
    setTimeout(function step(){
      try{ seq[i % seq.length](); }catch(e){}
      i++;
      setTimeout(step, 3800);
    }, 1200);
  })();
}
})();
