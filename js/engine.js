/* ═══════════════════════════════════════════
   Engine — 视觉小说引擎（零依赖）
   ═══════════════════════════════════════════ */
'use strict';

/* ── 资源表 ── */
const BG = {
  alley:   'assets/bg/alley_rain.jpg',
  shop:    'assets/bg/shop.jpg',
  shop_night:'assets/bg/shop.jpg',
  bedroom: 'assets/bg/bedroom.jpg',
  bath:    'assets/bg/bath.jpg',
  church:  'assets/bg/church.jpg',
  abyss:   'assets/bg/abyss.jpg',
  street:  'assets/bg/street.jpg',
  dawn:    'assets/bg/dawn.jpg',
};
const CHARA = {
  sylas_base:'assets/char/sylas_base.webp',
  sylas_shy:'assets/char/sylas_shy.webp',
  sylas_lust:'assets/char/sylas_lust.webp',
  sylas_pain:'assets/char/sylas_pain.webp',
  sylas_smile:'assets/char/sylas_smile.webp',
  sylas_smirk:'assets/char/sylas_smirk.webp',
  vera:'assets/char/vera.webp',
  inquisitor:'assets/char/inquisitor.webp',
  lilith:'assets/char/lilith.webp',
};
const SPEAKER_AVATAR = { sylas:'sylas_base', me:'vera', morel:'inquisitor', lilith:'lilith', narr:null };

const ENDINGS_META = {
  long1:{type:'长结局', title:'晨光', desc:'他第一次为自己而渴望。心核复燃之夜，黎明把你们照得无处可藏。', hint:'共鸣线 · 一切数值圆满时的黎明'},
  long2:{type:'长结局', title:'契约', desc:'你用真名锁住了他。他终于「举」了，也终于空了。', hint:'支配线 · 诱他交出真名'},
  long3:{type:'长结局', title:'归还', desc:'你解开锁链送他还乡。三年后，夜里有敲门声。', hint:'放逐线 · 牵绊足够深的离别'},
  short1:{type:'短结局', title:'空匣', desc:'心核彻底熄灭。你养大了一尊完美的空壳。', hint:'侵蚀值过高 · 他被磨成了器物'},
  short2:{type:'短结局', title:'饥饿', desc:'回收日到了。你没有追出去。', hint:'放逐线 · 或心核彻底枯竭'},
  short3:{type:'短结局', title:'审判', desc:'火刑架下，你选择了沉默。', hint:'序章或调查中 · 把他交给教会'},
  short4:{type:'短结局', title:'饲主', desc:'谁也没有跨过那条线。平淡也是一种答案。', hint:'共鸣线 · 但你始终没有读懂他'},
  short5:{type:'短结局', title:'同族', desc:'他跟着她走了。你目送。', hint:'共鸣线终章 · 让他独自面对'},
  short6:{type:'短结局', title:'人间', desc:'他折断自己的角，做了个凡人。', hint:'共鸣线觉醒之夜 · 请他留下做个凡人'},
};

/* ── 全局状态 ── */
const G = {
  story:{},               // 合并后的节点表
  cur:null, nodeId:null,
  stats:{core:35, trust:0, taint:0, bond:10},
  flags:{}, playerName:'薇拉',
  history:[], typing:false, typeTimer:null, fullText:'', chapterDone:null,
  r18Passed:false, skipHold:false, endingShown:false,
};

/* ── DOM 快捷 ── */
const $ = id => document.getElementById(id);
const el = {
  ageGate:$('age-gate'), title:$('title-screen'), nameScr:$('name-screen'), game:$('game-screen'),
  bg:$('bg-layer'), bgPrev:$('bg-prev'), charaImg:$('chara-img'),
  dlg:$('dialog-box'), dlgName:$('dialog-name'), dlgText:$('dialog-text'), dlgAvatar:$('dialog-avatar'),
  avFrame:document.querySelector('.dialog-avatar-frame'),
  choices:$('choice-layer'), chapter:$('chapter-card'), chapterText:$('chapter-text'),
  barCore:$('bar-core'), barTrust:$('bar-trust'), barTaint:$('bar-taint'), barBond:$('bar-bond'),
  hint:$('float-hint'), historyPanel:$('history-panel'), historyList:$('history-list'),
  galleryPanel:$('gallery-panel'), galleryList:$('gallery-list'), galleryCount:$('gallery-count'),
  r18Veil:$('r18-veil'), toast:$('toast'),
};

/* ── 存档工具 ── */
const SAVE_KEY = 'isv_save', GALLERY_KEY = 'isv_gallery';
const saveGame = (silent) => {
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      nodeId:G.nodeId, stats:G.stats, flags:G.flags, playerName:G.playerName, r18Passed:G.r18Passed,
      hist:G.history.slice(-30), ts:Date.now(),
    }));
    if(!silent) showToast('已存档 ✦ 灰烬港记得你');
  }catch(e){ showToast('存档失败：浏览器存储不可用'); }
};
const loadSaveData = () => { try{ return JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){ return null; } };
const loadGame = () => {
  const d = loadSaveData();
  if(!d){ showToast('没有找到存档'); return false; }
  G.nodeId = d.nodeId; G.stats = d.stats; G.flags = d.flags||{};
  G.playerName = d.playerName||'薇拉'; G.r18Passed = !!d.r18Passed;
  G.history = d.hist||[];
  showScreen('game'); renderStats(); gotoNode(G.nodeId, true);
  return true;
};
const getGallery = () => { try{ return JSON.parse(localStorage.getItem(GALLERY_KEY))||[]; }catch(e){ return []; } };
const unlockEnding = id => {
  const g = getGallery();
  if(!g.includes(id)){ g.push(id); localStorage.setItem(GALLERY_KEY, JSON.stringify(g)); showToast('✦ 结局解锁：' + ENDINGS_META[id].title); }
};

/* ── 屏幕切换 ── */
function showScreen(name){
  ['ageGate','title','nameScr','game'].forEach(k=>el[k]&&el[k].classList.remove('active'));
  ({ageGate:el.ageGate, title:el.title, name:el.nameScr, game:el.game})[name].classList.add('active');
}
let toastTimer;
function showToast(msg){ el.toast.textContent = msg; el.toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2200); }

/* ── 数值 ── */
function applyEffects(fx){
  if(!fx) return;
  const map = {core:[-0,100], trust:[-50,100], taint:[0,100], bond:[0,100]};
  const labels = {core:'心核', trust:'信任', taint:'侵蚀', bond:'牵绊'};
  for(const k of ['core','trust','taint','bond']){
    if(typeof fx[k] === 'number'){
      const [lo,hi] = map[k];
      const before = G.stats[k];
      G.stats[k] = Math.max(lo, Math.min(hi, before + fx[k]));
      const diff = G.stats[k]-before;
      if(diff!==0){
        const span = document.createElement('span');
        span.textContent = `${labels[k]} ${diff>0?'+':''}${diff}`;
        if(labels[k]==='侵蚀') span.style.color = diff>0?'#e88a6f':'var(--gold-bright)';
        el.hint.appendChild(span);
        setTimeout(()=>span.remove(),1800);
      }
    }
  }
  (fx.flags||[]).forEach(f=>G.flags[f]=true);
  renderStats();
}
function renderStats(){
  el.barCore.style.width = G.stats.core+'%';
  el.barTrust.style.width = ((G.stats.trust+50)/150*100)+'%';
  el.barTaint.style.width = G.stats.taint+'%';
  el.barBond.style.width = G.stats.bond+'%';
}

/* ── 立绘 / 背景 ── */
let curBgKey='';
function setBg(key){
  if(key===curBgKey) return;
  el.bgPrev.style.backgroundImage = el.bg.style.backgroundImage;
  el.bgPrev.classList.add('show');
  el.bg.style.backgroundImage = `url('${BG[key]||BG.alley}')`;
  // force reflow then swap
  void el.bg.offsetWidth;
  el.bg.classList.add('show');
  setTimeout(()=>{ el.bgPrev.classList.remove('show'); }, 1150);
  curBgKey = key;
}
function setChara(key){
  if(!key){ el.charaImg.classList.remove('show'); return; }
  const src = CHARA[key]; if(!src){ el.charaImg.classList.remove('show'); return; }
  if(el.charaImg.src.endsWith(src) && el.charaImg.classList.contains('show')) return;
  el.charaImg.classList.remove('show');
  setTimeout(()=>{ el.charaImg.src = src; el.charaImg.classList.add('show'); }, 220);
}

/* ── 对话渲染 ── */
function renderNode(id){
  const n = G.story[id];
  if(!n){ console.error('missing node', id); return; }
  G.nodeId = id; G.endingShown = false;
  if(n.chapter && G.chapterDone!==n.chapter){
    G.chapterDone = n.chapter;
    el.chapterText.textContent = n.chapter;
    el.chapter.classList.remove('show'); void el.chapter.offsetWidth;
    el.chapter.classList.add('show');
    setTimeout(()=>el.chapter.classList.remove('show'), 2900);
  }
  if(n.bg) setBg(n.bg);
  setChara(n.chara);
  // 头像
  const avKey = n.avatar !== undefined ? n.avatar : (SPEAKER_AVATAR[n.name] ?? n.chara);
  if(avKey && CHARA[avKey]){ el.avFrame.classList.remove('hidden'); el.dlgAvatar.src = CHARA[avKey]; }
  else el.avFrame.classList.add('hidden');
  // 名字
  const dispName = n.name==='me' ? G.playerName : n.name==='sylas' ? (G.flags.awakened?'维兹瑞尔':'赛拉斯') : {narr:'',morel:'莫尔 · 审判官',lilith:'莉莉丝'}[n.name]||'';
  el.dlgName.textContent = dispName;
  el.dlgName.classList.toggle('narrator', n.name==='narr');
  // 文本（占位符）
  const rawText = n.text || '';
  G.fullText = rawText.replace(/\{name\}/g, G.playerName).replace(/「/g,'「').replace(/\n/g,'<br>');
  if(rawText){ typeText(G.fullText); }
  else { el.dlgText.innerHTML = ''; clearInterval(G.typeTimer); G.typing=false; el.dlg.classList.add('ready'); }
  // history
  if(rawText) G.history.push({who:dispName||'—', txt:rawText.replace(/\{name\}/g,G.playerName)});
  if(G.history.length>200) G.history.shift();
  // r18 veil
  if(n.r18 && !G.r18Passed){
    el.r18Veil.classList.add('active');
    return; // 等待确认后再 choices
  }
  afterGate(n);
}
function afterGate(n){
  const node = G.story[G.nodeId];
  if(node.ending && !G.endingShown){ showEnding(node); return; }
  if(node.choices){ setTimeout(renderChoices, 350); }
  else el.dlg.classList.add('ready');
}

/* ── 打字机 ── */
function typeText(html){
  clearInterval(G.typeTimer); G.typing = true;
  el.dlg.classList.remove('ready');
  el.dlgText.innerHTML = '';
  const plain = html; // 用字符逐个 append，保留标签：拆分为 tag/char 序列
  const tokens = [];
  let i=0;
  while(i < plain.length){
    if(plain[i]==='<'){
      const j = plain.indexOf('>', i);
      tokens.push({tag: plain.slice(i, j+1)}); i = j+1;
    } else { tokens.push({ch: plain[i]}); i++; }
  }
  let idx=0, buf='';
  const speed = G.skipHold ? 4 : 26;
  G.typeTimer = setInterval(()=>{
    // 一次吐 1 个 token；skip 时 4 个
    let step = G.skipHold?6:1;
    while(step-- > 0 && idx < tokens.length){
      const t = tokens[idx++];
      if(t.tag){ buf += t.tag; } else { buf += t.ch; }
    }
    el.dlgText.innerHTML = buf;
    if(idx >= tokens.length){
      clearInterval(G.typeTimer); G.typing=false;
      afterGate(G.story[G.nodeId]);
    }
  }, speed);
}
function skipType(){
  if(!G.typing) return false;
  clearInterval(G.typeTimer); G.typing=false;
  el.dlgText.innerHTML = G.fullText;
  afterGate(G.story[G.nodeId]);
  return true;
}

/* ── 选项 ── */
function renderChoices(){
  const n = G.story[G.nodeId];
  el.choices.innerHTML='';
  const visible = (n.choices||[]).filter(c=>!c.cond || c.cond(G));
  visible.forEach(c=>{
    const b = document.createElement('button');
    b.className = 'choice-btn' + (c.special?' special':'');
    b.innerHTML = c.text + (c.eff?`<span class="eff">✦ ${c.eff}</span>`:'');
    b.onclick = (ev)=>{
      ev.stopPropagation();
      applyEffects(c.fx);
      el.choices.classList.remove('show'); el.choices.innerHTML='';
      if(c.next === '__save__'){ saveGame(); return; }
      gotoNode(typeof c.next==='function'? c.next(G) : c.next);
    };
    el.choices.appendChild(b);
  });
  el.choices.classList.add('show');
  el.dlg.classList.remove('ready');
}

/* ── 结局画面 ── */
function showEnding(node){
  G.endingShown = true;
  const meta = ENDINGS_META[node.ending];
  unlockEnding(node.ending);
  const wrap = document.createElement('div');
  wrap.className = 'screen active';
  wrap.style.cssText = 'z-index:35;background:rgba(8,4,12,.96)';
  wrap.innerHTML = `
    <div class="gate-card glass-panel" style="max-width:640px">
      <div class="end-type" style="font-size:12px;letter-spacing:.4em;color:var(--rose);margin-bottom:10px">— ${meta.type} · ENDING —</div>
      <h1 style="font-size:clamp(26px,5vw,38px);color:var(--gold-bright);letter-spacing:.15em;margin-bottom:18px">${meta.title}</h1>
      <p style="color:var(--text-dim);line-height:2;font-size:14.5px;margin-bottom:26px">${meta.desc}</p>
      <div style="font-size:34px;margin-bottom:24px">${['long1','long2','long3'].includes(node.ending)?'✦':'🥀'}</div>
      <div class="gate-buttons">
        <button class="btn-gold" onclick="location.reload()">回到标题</button>
      </div>
      <p style="margin-top:16px;font-size:12px;color:var(--text-dim)">结局收集进度可在标题画面 · 结局图鉴中查看</p>
    </div>`;
  document.body.appendChild(wrap);
}

/* ── 节点跳转 ── */
function gotoNode(id, skipSave){
  if(!id || id==='__end__') return;
  el.choices.classList.remove('show'); el.choices.innerHTML='';
  renderNode(id);
  if(!skipSave) saveGame(true);
}

/* ── 对话推进（点击）── */
function advance(){
  if(el.choices.classList.contains('show')) return;
  if(skipType()){ return; }
  const n = G.story[G.nodeId];
  if(n.ending) return;
  if(n.choices) return;
  if(n.next) gotoNode(typeof n.next==='function'? n.next(G) : n.next);
}

/* ── 历史 / 图鉴 ── */
function openHistory(){
  el.historyList.innerHTML = G.history.slice(-80).map(h=>
    `<div class="hist-item"><div class="hist-name">${h.who}</div><div class="hist-text">${h.txt}</div></div>`
  ).join('') || '<p style="color:var(--text-dim)">还没有任何回忆。</p>';
  el.historyPanel.classList.add('show');
}
function openGallery(){
  const got = getGallery();
  const order = ['long1','long2','long3','short1','short2','short3','short4','short5','short6'];
  el.galleryCount.textContent = `${got.length} / ${order.length}`;
  el.galleryList.innerHTML = `<div class="gallery-grid">` + order.map(id=>{
    const m = ENDINGS_META[id], has = got.includes(id);
    return `<div class="end-card ${has?'':'locked'}">
      <div class="end-type">${m.type}</div>
      <div class="end-title">${has?m.title:'？？？'}</div>
      <div class="end-desc">${has?m.desc:'尚未抵达这个结局。'}</div>
      <div class="end-hint">${has?'✦ 已解锁':'✦ 提示：'+m.hint}</div>
    </div>`;
  }).join('') + '</div>';
  el.galleryPanel.classList.add('show');
}
document.querySelectorAll('.btn-close').forEach(b=>b.onclick=()=>$(b.dataset.close).classList.remove('show'));

/* ── 事件绑定 ── */
$('btn-age-yes').onclick = ()=>{
  const d = loadSaveData();
  $('title-save-info').textContent = d ? `检测到 ${d.playerName||'薇拉'} 的足迹 · ${new Date(d.ts).toLocaleString('zh-CN')}` : '';
  showScreen('title');
};
$('btn-age-no').onclick = ()=>{ document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;color:#a394b3;font-size:18px;letter-spacing:.3em">🥀 愿你早日长大，再会。</div>'; };
$('btn-start').onclick = ()=>{ G.stats={core:35,trust:0,taint:0,bond:10}; G.flags={}; G.history=[]; G.r18Passed=false; G.chapterDone=null; showScreen('name'); };
$('btn-continue').onclick = ()=>{ if(!loadGame()) showToast('没有找到存档'); };
$('btn-gallery').onclick = openGallery;
$('btn-name-ok').onclick = ()=>{
  G.playerName = ($('player-name').value.trim()||'薇拉').slice(0,8);
  showScreen('game');
  gotoNode('p1', true);
};
$('btn-r18-ok').onclick = ()=>{
  G.r18Passed = true;
  el.r18Veil.classList.remove('active');
  afterGate(G.story[G.nodeId]);
};
$('btn-history').onclick = openHistory;
$('btn-save').onclick = ()=>saveGame();
$('btn-load').onclick = ()=>{ if(confirm('读取上次存档？当前进度将被覆盖。')) loadGame(); };
$('btn-title').onclick = ()=>{ if(confirm('回到标题？（进度已自动保存）')){ saveGame(true); showScreen('title'); const d=loadSaveData(); $('title-save-info').textContent = d?`检测到 ${d.playerName} 的足迹 · ${new Date(d.ts).toLocaleString('zh-CN')}`:''; } };
const skipBtn = $('btn-skip');
const startSkip = ()=>{ G.skipHold = true; if(G.typing){ skipType(); } };
const stopSkip = ()=>{ G.skipHold = false; };
skipBtn.addEventListener('pointerdown', startSkip);
skipBtn.addEventListener('pointerup', stopSkip);
skipBtn.addEventListener('pointerleave', stopSkip);
el.dlg.addEventListener('click', advance);
el.charaImg.addEventListener('click', advance);

/* ── 合并剧本（由 story 文件填充 window.STORY_PARTS）── */
window.STORY_PARTS = window.STORY_PARTS || {};
function mountStory(){
  const parts = window.STORY_PARTS;
  Object.keys(parts).sort().forEach(k=>Object.assign(G.story, parts[k]));
  const total = Object.keys(G.story).length;
  console.log('%c《我养了一个阳痿阴湿魅魔》剧本装载完成','color:#c9a86a', total+' 节点');
  if(!G.story.p1) console.error('缺少序章节点 p1');
}
mountStory();
