/* =====================================================================
   耳机佩戴报告 v4.0.0 — app.js
   数据层与解析层照搬 v3.2（含全部踩坑防御），UI 层为 finesse 重制。
   ===================================================================== */
(function(){
'use strict';
var $ = function(id){ return document.getElementById(id); };
var TYPE = 'HKQuantityTypeIdentifierHeadphoneAudioExposure';
var devices = [], ALL = [], STATE = { anchor:0, page:0, period:'week', offset:0, busy:false, cached:null };

/* ---------- 配色与深浅模式（设置页可切换，持久化） ----------
   10 套配色 = 环境彩底（玻璃模糊的底色）+ 强调色，深浅两态各一套。
   中性面板/文字系统全主题共享，对比度（AA）逐主题逐模式验证。 */
var COLORS = [
  { id:'azure',    name:'海盐蓝', a:'#9ec5ff', b:'#d7e9ff', c:'#b9d9ff', al:'#0066cc', ad:'#74b3ff' },
  { id:'coral',    name:'落日珊瑚', a:'#ffc9ad', b:'#ffe4d2', c:'#ffd9be', al:'#c73e1d', ad:'#ff8a5c' },
  { id:'crimson',  name:'绯红',   a:'#ffbccb', b:'#ffdbe3', c:'#ffccd7', al:'#c4103a', ad:'#ff6b8a' },
  { id:'blossom',  name:'樱花粉', a:'#ffbcd8', b:'#ffdcec', c:'#ffcee0', al:'#c2255c', ad:'#ff7aa2' },
  { id:'violet',   name:'葡萄紫', a:'#c8bcff', b:'#e0daff', c:'#d4ccff', al:'#5f3dc4', ad:'#a18aff' },
  { id:'magenta',  name:'红紫',   a:'#ffadcf', b:'#e3c3ff', c:'#ffc3e1', al:'#b5206d', ad:'#f06fb4' },
  { id:'mint',     name:'薄荷绿', a:'#a7e8c8', b:'#d3f4e2', c:'#bdefd7', al:'#0c8055', ad:'#55d6a0' },
  { id:'forest',   name:'森林绿', a:'#b4e3b8', b:'#dbf2da', c:'#c4ebc5', al:'#2b7a3f', ad:'#7fd48f' },
  { id:'amber',    name:'落日橙', a:'#ffd79a', b:'#ffe8c2', c:'#ffddb0', al:'#a35a00', ad:'#ffb84d' },
  { id:'graphite', name:'石墨灰', a:'#c9c9d1', b:'#e4e4ea', c:'#d6d6de', al:'#3f3f46', ad:'#aeaeb2' }
];
STATE.mode = 'auto';       // light | dark | auto
STATE.color = 'azure';
var mql = null;
try{ mql = window.matchMedia('(prefers-color-scheme: dark)'); }catch(e){}

function systemDark(){ return !!(mql && mql.matches); }
function applyMode(){
  var dark = STATE.mode === 'dark' || (STATE.mode === 'auto' && systemDark());
  document.documentElement.classList.toggle('dark', dark);
  var mt = document.querySelector('meta[name="theme-color"]');
  if(mt) mt.setAttribute('content', dark ? '#0b0b0f' : '#eef3fb');
  Array.prototype.forEach.call($('modeSeg').querySelectorAll('button'), function(b){
    var on = b.dataset.m === STATE.mode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
function setColor(id, save){
  for(var i=0;i<COLORS.length;i++){
    if(COLORS[i].id === id){
      STATE.color = id;
      document.documentElement.setAttribute('data-color', id);
      /* 防御：网格未渲染时跳过高亮同步（buildColorGrid 稍后会调一次补上） */
      var __g = document.getElementById('colorGrid');
      if(__g) Array.prototype.forEach.call(__g.querySelectorAll('.cbtn'), function(b){
        var on = b.dataset.c === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if(save){ try{ localStorage.setItem('hp_color', id); }catch(e){} }
      break;
    }
  }
}
function setMode(m, save){
  STATE.mode = (m==='light'||m==='dark') ? m : 'auto';
  applyMode();
  if(save){ try{ localStorage.setItem('hp_mode', STATE.mode); }catch(e){} }
}
function initAppearance(){
  var c = null, m = null;
  try{ c = localStorage.getItem('hp_color'); m = localStorage.getItem('hp_mode'); }catch(e){}
  if(!c){ try{ c = localStorage.getItem('hp_theme') === 'x' ? null : null; }catch(e){} }
  setColor(COLORS.some(function(x){ return x.id===c; }) ? c : 'azure', false);
  setMode(m === 'light' || m === 'dark' ? m : 'auto', false);
  if(mql && mql.addEventListener) mql.addEventListener('change', function(){ if(STATE.mode==='auto') applyMode(); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-theme-toggle]'), function(el){
    el.addEventListener('click', function(){
      /* 快捷按钮：在 浅色 / 深色 之间切换（不进入自动） */
      var dark = document.documentElement.classList.contains('dark');
      setMode(dark ? 'light' : 'dark', true);
    });
  });
  Array.prototype.forEach.call($('modeSeg').querySelectorAll('button'), function(b){
    b.addEventListener('click', function(){ setMode(b.dataset.m, true); });
  });
  buildColorGrid();
}
function buildColorGrid(){
  var grid = $('colorGrid'), html = '';
  var dark = document.documentElement.classList.contains('dark');
  COLORS.forEach(function(c){
    var accent = dark ? c.ad : c.al;
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
/* 苹果耳机白名单：只统计 AirPods 全系 / AirPods Pro / AirPods Max / EarPods，其他品牌与无名字设备一律屏蔽 */
function isAppleHeadphone(name){
  var n = String(name || '').toLowerCase().replace(/\s+/g, '');
  return /airpods?|earpods?|airpod|earpod/.test(n);
}

/* ---------- 设备图片映射（Apple 产品图 + 通用图标，本地 assets） ---------- */
var IMAGES = {
  airpods:'./assets/airpods.webp', airpodspro:'./assets/airpodspro.webp', airpodsmax:'./assets/airpodsmax.webp',
  generic_earbuds:'./assets/generic_earbuds.svg', generic_headphones:'./assets/generic_headphones.svg', generic_speaker:'./assets/generic_speaker.svg',
  earbuds_blue:'./assets/earbuds_blue.svg', earbuds_green:'./assets/earbuds_green.svg', earbuds_orange:'./assets/earbuds_orange.svg'
};
function deviceImage(name, id){
  var n = (name || '').toLowerCase();
  if(n.indexOf('airpods max') >= 0 || n.indexOf('airpodsmax') >= 0) return IMAGES.airpodsmax;
  if(n.indexOf('airpods pro') >= 0 || n.indexOf('airpodspro') >= 0) return IMAGES.airpodspro;
  if(n.indexOf('airpods') >= 0 || n.indexOf('earpods') >= 0 || n.indexOf('air pod') >= 0) return IMAGES.airpods;
  if(/buds|enco|tws|air|open|free|fly|pods|iKF|cmf|realme|oppo|vivo|huawei|小米|漫步者|声阔|万魔/i.test(name || '')){
    var h = 0, s = String(name || '');
    for(var q=0;q<s.length;q++) h = (h*31 + s.charCodeAt(q)) >>> 0;
    return [IMAGES.generic_earbuds, IMAGES.earbuds_blue, IMAGES.earbuds_green, IMAGES.earbuds_orange][h % 4];
  }
  if(/headphone|头戴|耳机|w820|wh-|quietcomfort|qc|sony|bose|漫步者|edifier|m30/i.test(name || '')) return IMAGES.generic_headphones;
  if(/speaker|音箱|音响|homepod|小度|sound/i.test(name || '')) return IMAGES.generic_speaker;
  return IMAGES.generic_earbuds;
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
  var sel = [], i;
  for(i=0;i<ALL.length;i++){ var dk = dayMS(ALL[i].s); if(dk >= from && dk <= to) sel.push(ALL[i]); }
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
function countUp(el, sec){
  /* 概览 hero 的唯一重拍动效；减少动效时直接落定终值 */
  var reduced = false;
  try{ reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
  var target = Math.max(0, Math.round(sec || 0));
  function paint(v){ el.innerHTML = hmHTML(v); }
  if(reduced || target <= 0){ paint(target); return; }
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
function renderOverview(s){
  $('ovRange').textContent = fmtDate(s.first).replace(/\./g,'/') + ' – ' + fmtDate(s.last).replace(/\./g,'/');
  countUp($('ovTotal'), s.total);
  var span = Math.max(1, (dayMS(s.last)-dayMS(s.first))/86400000 + 1);
  $('ovPct').textContent = Math.round(s.days/span*100) + '% 的天数有佩戴记录';
  $('ovPeriod').textContent = '已读取历史 · ' + s.days + ' 个有记录日 · ' + devices.length + ' 副设备';
  $('ovCount').textContent = s.sessions.toLocaleString('zh-CN');
  $('ovAvg').innerHTML = hmHTML(s.avg);
  $('ovMax').innerHTML = hmHTML(s.max);
  $('ovMaxFt').textContent = fmtDT(s.maxS) + ' – ' + fmtDT(s.maxE);
  $('ovDb').textContent = Math.round(s.db);
  $('ovImg').src = deviceImage(STATE.topName, '');
  $('ovImg').alt = STATE.topName || '耳机';
  $('ovFirst').textContent = fmtDate(s.first);
  $('ovFirstFt').textContent = '当次 ' + hmText(s.firstDur);
  $('ovLast').textContent = fmtDate(s.last);
  $('ovLastFt').textContent = '当次 ' + hmText(s.lastDur);
}
function renderStats(s){
  $('stDay').innerHTML = hmHTML(s.bestDaySec);
  $('stDayFt').textContent = fmtDate(s.bestDay);
  $('stSess').innerHTML = hmHTML(s.max);
  $('stSessFt').textContent = fmtDT(s.maxS) + ' – ' + fmtDT(s.maxE);
  $('stStreak').innerHTML = '<span class="n">'+s.streak+'</span><span class="u">天</span>';
  $('stStreakFt').textContent = fmtDate(s.streakS) + ' – ' + fmtDate(s.streakE);
  $('stMonth').innerHTML = hmHTML(s.bestMonthSec);
  $('stMonthFt').textContent = s.bestMonthY + '年' + (s.bestMonthM+1) + '月';
  var top = devices.slice().sort(function(a,b){ return b.total - a.total; })[0];
  if(top){
    $('stTopName').textContent = top.name;
    $('stTopTime').innerHTML = hmHTML(top.total);
    $('stTopImg').src = deviceImage(top.name, top.id);
    $('stTopImg').alt = top.name;
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
function renderDevices(){
  var w = deviceWindow();
  $('devTotal').innerHTML = hmHTML(w.total);
  $('devTotalSub').textContent = (w.days === 0 ? '全部累计佩戴时长' : '近'+w.days+'天总佩戴时长') + ' · 截至 ' + fmtDate(STATE.anchor);
  var car = $('carousel'), dots = $('dots'), html = '';
  w.list.forEach(function(x){
    html += '<div class="dcard card"><div class="nm">'+x.name+'</div>'
      + '<div class="eq"><img src="'+deviceImage(x.name,x.id)+'" alt="'+x.name+'"></div>'
      + '<div class="big">'+hmHTML(x.sec)+'</div>'
      + '<div class="share">'+x.pct.toFixed(0)+'% 的佩戴时长'+(x.id?' · '+x.id:'')+'</div></div>';
  });
  if(!html) html = '<div class="dcard card"><div class="nm">暂无数据</div><div class="share">该周期内没有耳机音量记录</div></div>';
  car.innerHTML = html;
  dots.innerHTML = w.list.map(function(_,i){ return '<i'+(i===0?' class="on"':'')+'></i>'; }).join('');
  $('devList').innerHTML = w.list.map(function(x){
    return '<div class="drow"><div class="l">'+x.name+'</div><div class="r">'+hmText(x.sec)+'</div></div>';
  }).join('') || '<div class="listhint">该周期没有记录</div>';
  $('devFoot').textContent = '共 '+w.list.length+' 副设备 · 时长按重叠区间去重';
  car.onscroll = function(){
    var idx = Math.round(car.scrollLeft / Math.max(1, car.clientWidth));
    Array.prototype.forEach.call(dots.children, function(el,i){ el.className = i===idx?'on':''; });
  };
}

/* ---------- 导航 ---------- */
var PAGES = 5;
function gotoPage(i){
  STATE.page = Math.max(0, Math.min(PAGES-1, i));
  $('pagesTrack').style.transform = 'translateX(-' + (STATE.page*(100/PAGES)) + '%)';
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(el){
    var on = +el.dataset.i === STATE.page;
    el.classList.toggle('on', on);
    el.setAttribute('aria-current', on ? 'page' : 'false');
  });
}
function bindNav(){
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(el){
    el.addEventListener('click', function(){ gotoPage(+el.dataset.i); });
  });
  var vp = $('pagesViewport'), sx=0, sy=0, dragging=false, horiz=false, locked=false;
  vp.addEventListener('touchstart', function(e){
    if(e.touches.length !== 1) return;
    /* 让内嵌横向滚动区（设备轮播/周期选择）自己处理手势 */
    var t = e.target;
    locked = false;
    while(t && t !== vp){ if(t.classList && (t.classList.contains('carousel') || t.classList.contains('seg'))){ locked = true; break; } t = t.parentNode; }
    if(locked) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    dragging = true; horiz = false;
  }, { passive:true });
  vp.addEventListener('touchmove', function(e){
    if(!dragging) return;
    var dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
    if(!horiz && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)*1.25) horiz = true;
    if(horiz && e.cancelable) e.preventDefault();
  }, { passive:false });
  vp.addEventListener('touchend', function(e){
    if(!dragging) return;
    dragging = false;
    var dx = (e.changedTouches[0].clientX - sx);
    if(horiz && Math.abs(dx) > 55) gotoPage(STATE.page + (dx < 0 ? 1 : -1));
    horiz = false;
  }, { passive:true });
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
  $('closeBtn').onclick = function(){ $('appScreen').classList.add('hidden'); show('home'); };
  $('infoBtn').onclick = function(){ var n=$('noteBox'); n.classList.toggle('hidden'); };
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
          .filter(function(d){ return isAppleHeadphone(d.name) && d.recs.length >= 5; })
          .map(function(d){ d.recs.sort(function(a,b){ return a.s-b.s; }); d.total = statsFor(d.recs).total; return d; })
          .sort(function(a,b){ return b.recs.length - a.recs.length; });
        if(!devices.length) reject(new Error('没有找到 AirPods / EarPods 的音量记录。已按你的设置只统计苹果耳机，其他品牌与未命名设备已屏蔽。请确认该 iPhone「健康」压缩包里确实有 AirPods 佩戴记录。'));
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
  var s = statsFor(ALL);
  renderOverview(s); renderStats(s); renderDevices();
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
  envEl.textContent = ENV + ' · v4.0.0';
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
  if(opener) opener.addEventListener('click', function(){ gotoPage(3); });
})();

/* ---------- 演示钩子：?demo=1 直接生成示例报告（用于无 ZIP 环境验证界面） ---------- */
if(/(^|[?&])demo=1(&|$)/.test(location.search)){
  (function(){
    var base = new Date(); base.setHours(0,0,0,0);
    base = dayMS(base.getTime()) - 400*86400000;
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
      mkDev('AA-BB-CC-DD-EE-FF-tacl', 'AirPods Pro', 400, .72, 2.4),
      mkDev('11-22-33-44-55-66-tacl', 'AirPods', 400, .30, 1.5)
    ];
    devices.forEach(function(d){ d.recs.sort(function(a,b){ return a.s-b.s; }); d.total = statsFor(d.recs).total; });
    finishReport();
  })();
}

initAppearance();
})();
