/* Meta XP — app.js 2.3.4-themes
   - Missões (única/semanal) com dificuldade (x1/x1.5/x2)
   - Streak e bônus de streak
   - Atributos com nível/XP progressivo (+10% por nível)
   - Conquistas com ouro visível e concessão automática
   - Recompensas (comprar com ouro) + histórico
   - Calendário de conclusões
   - Exportar/Importar JSON
   - Temas: medieval (padrão), pink, minimal (sem ícones)
*/

/////////////////////////////
// Helpers
/////////////////////////////
const $  = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));
const todayKey = (d=new Date()) => d.toISOString().slice(0,10);
const ymdToDate = (ymd) => { const [y,m,d]=ymd.split('-').map(n=>+n); return new Date(y, m-1, d) };
const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x };
const weekRange = (base)=>{ const d=new Date(base); const day=d.getDay(); const mon=day===0?-6:1-day; const start=addDays(d,mon); return [start,addDays(start,6)] };
const monthRange = (base)=>{ const d=new Date(base); return [new Date(d.getFullYear(), d.getMonth(), 1), new Date(d.getFullYear(), d.getMonth()+1, 0)] };
const fmtMonthTitle = (date)=> date.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});

/////////////////////////////
// Persistência
/////////////////////////////
const store = {
  key: "metaxp6",
  load(){
    const raw = localStorage.getItem(this.key);
    if(!raw) return {
      character:{name:"Aventureiro", level:1, xp:0, next:100, baseNext:100},
      attributes:[],
      missions:[],
      completions:{},
      xpLog:[],
      gold:0,
      achievementsAwarded:{},
      rewards:[],
      rewardsHistory:[],
      theme: localStorage.getItem('metaxp_theme') || 'medieval'
    };
    try { return JSON.parse(raw) } catch(e){ return {
      character:{name:"Aventureiro", level:1, xp:0, next:100, baseNext:100},
      attributes:[], missions:[], completions:{}, xpLog:[],
      gold:0, achievementsAwarded:{}, rewards:[], rewardsHistory:[],
      theme:'medieval'
    }}
  },
  save(d){ localStorage.setItem(this.key, JSON.stringify(d)) }
};
let state = store.load();

// --- Sobrevivência: init ---
if (!state.survival) state.survival = {};        // { 'YYYY-MM-DD': { sleep:number, water:number, awarded?:true } }
if (!state.meta) state.meta = {};                // reserva (se precisar futuramente)

// Garante atributo "Saúde"
function ensureHealthAttribute(){
  const exists = state.attributes?.some(a => a.name.toLowerCase() === 'saúde' || a.id === 'health');
  if (!exists){
    const id = 'health';
    if (!state.attributes) state.attributes = [];
    state.attributes.push({ id, name:'Saúde', level:1, xp:0, next:100 });
    store.save(state);
  }
}
ensureHealthAttribute();

/////////////////////////////
// Progressão / Dificuldade
/////////////////////////////
function nextRequirement(prev){ return Math.max(10, Math.round(prev*1.10)) }
function diffMul(d){ if(d==='hard') return 2; if(d==='medium') return 1.5; return 1 }
function diffLabel(d){ return d==='hard'?'Difícil' : (d==='medium'?'Média':'Fácil') }
function findAttr(id){ return state.attributes.find(a=>a.id===id) }

function grantXPCharacter(xp){
  let c = state.character;
  c.xp += xp;
  let leveled = false;
  while(c.xp >= c.next){
    c.xp -= c.next;
    c.level += 1;
    c.next = nextRequirement(c.next);
    leveled = true;
    awardGold("level:"+c.level, 10, `Nível ${c.level}`);
  }
  if(leveled) toast(`🎉 Subiu para o nível ${c.level}! +10 🪙`);
}
function grantXPAttribute(id,xp){
  const a = findAttr(id); if(!a) return;
  a.xp += xp;
  while(a.xp >= a.next){
    a.xp -= a.next;
    a.level += 1;
    a.next = nextRequirement(a.next);
  }
}
function streakBonus(s,d){
  let base=0;
  if(s>=30) base=10; else if(s>=7) base=5; else if(s>=3) base=2;
  const mul = diffMul(d||'easy');
  return Math.round(base*mul);
}
function prevOccurrenceDate(m,dateKey){
  if(m.recur==="once") return null;
  const d = ymdToDate(dateKey);
  for(let i=1;i<=28;i++){
    const prev = addDays(d, -i);
    const k = todayKey(prev);
    if(k < m.date) break;
    if(m.recur==="weekly"){
      const wd = prev.getDay();
      if((m.weekdays||[]).includes(wd)) return k;
    }
  }
  return null;
}

/////////////////////////////
// Header
/////////////////////////////
function renderHeader(){
  $("#charNameView") && ($("#charNameView").textContent = state.character.name);
  $("#charLevel") && ($("#charLevel").textContent = state.character.level);
  $("#charXP") && ($("#charXP").textContent = state.character.xp);
  $("#charNext") && ($("#charNext").textContent = state.character.next);
  const pct = Math.min(100, Math.round(100*state.character.xp/state.character.next));
  $("#charXPFill") && ($("#charXPFill").style.width = pct+"%");
  $("#goldBalance") && ($("#goldBalance").textContent = state.gold);
}

/////////////////////////////
// Tabs
/////////////////////////////
$$(".tab").forEach(t=>t.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  const n = t.dataset.tab;
  const map = {
    missoes: "#tab-missoes",
    atributos: "#tab-atributos",
    conquistas: "#tab-conquistas",
    calendario: "#tab-calendario",
    rewards: "#tab-rewards",
   survival: "#tab-survival",
    config: "#tab-config"
  };
  Object.entries(map).forEach(([k,sel])=>{
    const el=$(sel); if(!el) return;
    el.style.display = (n===k) ? "" : "none";
  });
}));

$("#editCharBtn") && ($("#editCharBtn").onclick = ()=>{
  $("#charName") && ($("#charName").value = state.character.name);
  $("#baseNext") && ($("#baseNext").value = state.character.baseNext || 100);
  openModal("#charModal");
});
$("#charSave") && ($("#charSave").onclick = ()=>{
  const name = ($("#charName")?.value||"").trim() || "Aventureiro";
  const baseNext = Math.max(10, parseInt($("#baseNext")?.value||"100",10));
  state.character.name = name;
  state.character.baseNext = baseNext;
  if(state.character.level===1) state.character.next = baseNext;
  store.save(state);
  renderHeader();
  closeModal("#charModal");
});

/////////////////////////////
// Atributos
/////////////////////////////
function renderAttributes(){
  const wrap = $("#attrList"); if(!wrap) return;
  wrap.innerHTML = "";
  if(state.attributes.length===0){ $("#attrEmpty").style.display=""; return }
  $("#attrEmpty").style.display="none";
  const attrs=[...state.attributes].sort((a,b)=>b.level-a.level || (b.xp/b.next)-(a.xp/a.next));
  attrs.forEach(a=>{
    const pct=Math.round(100*a.xp/a.next);
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <div class="row" style="align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:900;">${a.name}</div>
          <div class="small muted">Nv. ${a.level} — ${a.xp}/${a.next} XP</div>
          <div class="xpbar small" style="margin-top:6px;">
            <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <button class="chip wood" data-del="${a.id}">Excluir</button>
      </div>`;
    wrap.appendChild(card);
  });
  $$("button[data-del]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-del");
    if(confirm("Excluir atributo? Missões que o usam perderão essa referência.")){
      state.attributes = state.attributes.filter(x=>x.id!==id);
      state.missions.forEach(m=>m.attrXP=(m.attrXP||[]).filter(ax=>ax.attrId!==id));
      store.save(state);
      renderAttributes(); renderMissionModalAttrList();
    }
  });
}
$("#addAttr") && ($("#addAttr").onclick = ()=>{
  const name = ($("#newAttrName")?.value||"").trim();
  if(!name) return alert("Dê um nome ao atributo.");
  const id="a"+Math.random().toString(36).slice(2,8);
  state.attributes.push({id,name,level:1,xp:0,next:100});
  $("#newAttrName").value="";
  store.save(state);
  renderAttributes(); renderMissionModalAttrList();
});

/////////////////////////////
// Missões
/////////////////////////////
function missionOccurrencesInRange(missions,start,end){
  const occs=[];
  const sK=todayKey(start), eK=todayKey(end);
  missions.forEach(m=>{
    if(m.recur==="once"){
      if(m.date>=sK && m.date<=eK) occs.push({id:`${m.id}@${m.date}`, mission:m, date:m.date, time:m.time||"00:00"});
    }else if(m.recur==="weekly"){
      const w=m.weekdays||[];
      let d=new Date(start);
      while(d<=end){
        if(w.includes(d.getDay())){
          const k=todayKey(d);
          if(k>=m.date) occs.push({id:`${m.id}@${k}`, mission:m, date:k, time:m.time||"00:00"});
        }
        d=addDays(d,1);
      }
    }
  });
  return occs;
}
function renderMissions(){
  const list=$("#missionList"); if(!list) return;
  list.innerHTML="";
  const base = $("#baseDate")?.value ? ymdToDate($("#baseDate").value) : new Date();
  const mode = $("#range")?.value || "day";
  let start,end;
  if(mode==="day"){ start=base; end=base }
  if(mode==="week"){ [start,end]=weekRange(base) }
  if(mode==="month"){ [start,end]=monthRange(base) }

  const occs = missionOccurrencesInRange(state.missions,start,end)
    .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));

  $("#missionEmpty").style.display = occs.length? "none": "";

  occs.forEach(occ=>{
    const m=occ.mission;
    const completed=!!state.completions[occ.id];
    const attrs=(m.attrXP||[]).map(ax=>{
      const attr=findAttr(ax.attrId);
      return attr? `<span class="attrTag">${attr.name}: +${Math.round((ax.xp||0)*diffMul(m.difficulty||'easy'))} XP</span>` : "";
    }).join(" ");
    const wrap=document.createElement("div");
    wrap.className="goal";
    wrap.innerHTML=`
      <div class="meta">
        <div><strong>🗡️ ${m.title}</strong> ${completed?"✅":""} <span class="chip">🔥 x${m.streak||0}</span></div>
        <div class="small muted">${occ.date} ${m.time||"00:00"} • ${m.recur==="once"?"Única":"Semanal"}</div>
        <div class="small" style="margin-top:6px;">
          <span class="chip">Dificuldade: ${diffLabel(m.difficulty||"easy")}</span>
          <span class="chip">Mult.: x${diffMul(m.difficulty||"easy")}</span>
          <span class="chip">Personagem: ~+${Math.round((m.charXP||0)*diffMul(m.difficulty||"easy"))} XP</span>
          <span class="chip">Bônus streak: +${streakBonus(m.streak||0, m.difficulty||"easy")} XP</span>
          ${attrs}
        </div>
      </div>
      <div class="actions">
        ${completed? `<button data-undo="${occ.id}" class="wood">Desfazer</button>`:`<button data-done="${occ.id}" class="wood">Concluir</button>`}
        <button data-delm="${m.id}" class="wood" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button>
      </div>`;
    list.appendChild(wrap);
  });

  $$("button[data-done]").forEach(b=>b.onclick=()=>completeOccurrence(b.getAttribute("data-done")));
  $$("button[data-undo]").forEach(b=>b.onclick=()=>undoOccurrence(b.getAttribute("data-undo")));
  $$("button[data-delm]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-delm");
    if(confirm("Excluir esta missão (todas as ocorrências futuras)?")){
      state.missions = state.missions.filter(x=>x.id!==id);
      Object.keys(state.completions).forEach(k=>{ if(k.startsWith(id+'@')) delete state.completions[k] });
      store.save(state);
      renderMissions(); renderCalendar(); renderAchievements(); renderStats();
    }
  });
}
function completeOccurrence(occId){
  if(state.completions[occId]) return;
  const [mId,date] = occId.split("@");
  const m = state.missions.find(x=>x.id===mId); if(!m) return;

  const prevKey = prevOccurrenceDate(m, date);
  if(prevKey && state.completions[`${m.id}@${prevKey}`]) m.streak=(m.streak||0)+1;
  else m.streak=1;
  m.lastDone=date;
  awardStreakGold(m);

  const mul = diffMul(m.difficulty||'easy');
  const bonus = streakBonus(m.streak||0, m.difficulty||'easy');
  const charXP = Math.round((m.charXP||0)*mul) + bonus;
  grantXPCharacter(charXP);
  (m.attrXP||[]).forEach(ax=>grantXPAttribute(ax.attrId, Math.round((ax.xp||0)*mul)));

  state.completions[occId] = true;
  state.xpLog.push({date, charXP, missionId:m.id, difficulty:(m.difficulty||'easy')});
  store.save(state);
  renderHeader(); renderAttributes(); renderMissions(); renderCalendar(); renderAchievements(); renderStats();
}
function undoOccurrence(occId){
  if(!state.completions[occId]) return;
  if(!confirm("Isso apenas desmarca a conclusão. O XP e ouro já concedidos permanecem. Continuar?")) return;
  delete state.completions[occId];
  store.save(state);
  renderMissions(); renderCalendar(); renderAchievements(); renderStats();
}

// Modal Missão
function openModal(s){ $(s)?.classList.add("open") }
function closeModal(s){ $(s)?.classList.remove("open") }

$("#newMission") && ($("#newMission").onclick = ()=>{ openModal("#missionModal"); renderMissionModalAttrList() });
$("#createMission") && ($("#createMission").onclick = ()=>{
  const title = ($("#mTitle")?.value||"").trim();
  if(!title) return alert("Dê um título para a missão.");
  const recur = $("#mRecur")?.value || "once";
  const date = $("#mDate")?.value || todayKey();
  const time = $("#mTime")?.value || "07:00";
  const charXP = Math.max(0, parseInt($("#mXP")?.value||"0",10));
  const payload = {
    id: "m"+Math.random().toString(36).slice(2,8),
    title, recur, date, time,
    difficulty: ($("#mDiff") ? $("#mDiff").value : 'easy'),
    weekdays: recur==="weekly" ? selectedWeekdays() : [],
    charXP,
    attrXP: collectAttrAlloc(),
    streak:0, lastDone:null
  };
  state.missions.push(payload);
  store.save(state);
  if($("#mTitle")) $("#mTitle").value="";
  if($("#mXP")) $("#mXP").value="10";
  if($("#mDate")) $("#mDate").value="";
  if($("#mTime")) $("#mTime").value="07:00";
  $$("#mWeekdays input[type=checkbox]").forEach(cb=>cb.checked=false);
  $("#mAttrList") && ($("#mAttrList").innerHTML="");
  closeModal("#missionModal");
  renderMissions(); renderCalendar();
});
function selectedWeekdays(){ return $$("#mWeekdays input[type=checkbox]:checked").map(cb=>parseInt(cb.value,10)) }
function renderMissionModalAttrList(){
  const box=$("#mAttrList"); if(!box) return;
  box.innerHTML="";
  if(state.attributes.length===0){
    box.innerHTML=`<p class="muted small">Sem atributos. Crie alguns na aba “Atributos”.</p>`;
    return;
  }
  addAttrAllocLine();
}
$("#addAttrAlloc") && ($("#addAttrAlloc").onclick = addAttrAllocLine);
function addAttrAllocLine(){
  const box=$("#mAttrList"); if(!box) return;
  const line=document.createElement("div");
  line.className="attrLine";
  const sel=document.createElement("select");
  state.attributes.forEach(a=>{
    const o=document.createElement("option");
    o.value=a.id; o.textContent=a.name; sel.appendChild(o);
  });
  const xp=document.createElement("input");
  xp.type="number"; xp.min="0"; xp.value="5"; xp.style.width="120px";
  const del=document.createElement("button");
  del.textContent="–"; del.className="wood"; del.onclick=()=>line.remove();
  line.append(sel,xp,del);
  box.appendChild(line);
}
function collectAttrAlloc(){ return $$("#mAttrList .attrLine").map(l=>({attrId:$("select",l).value, xp:Math.max(0, parseInt($("input",l).value||"0",10))})) }

/////////////////////////////
// Ouro / Conquistas
/////////////////////////////
function awardGold(key, amount, reason){
  if(state.achievementsAwarded[key]) return;
  state.achievementsAwarded[key] = true;
  state.gold += amount;
  toast(`🪙 +${amount} ouro — ${reason}`);
  renderHeader();
  store.save(state);
}
function awardStreakGold(m){
  m.streakAwards = m.streakAwards || {};
  const steps=[{s:3,g:2},{s:7,g:5},{s:30,g:15}];
  for(const step of steps){
    if(m.streak>=step.s && !m.streakAwards[step.s]){
      m.streakAwards[step.s]=true;
      awardGold(`streak:${m.id}:${step.s}`, step.g, `Streak ${step.s}+ em "${m.title}"`);
    }
  }
}

// KPIs p/ conquistas globais
function uniqueDates(){ return [...new Set(state.xpLog.map(x=>x.date))].sort() }
function longestGlobalStreak(){
  const ds=uniqueDates(); if(ds.length===0) return 0;
  let best=1, cur=1;
  for(let i=1;i<ds.length;i++){
    const prev=new Date(ds[i-1]); const curd=new Date(ds[i]);
    const delta=(curd-prev)/(1000*60*60*24);
    if(delta===1) cur++; else if(delta>1) cur=1;
    if(cur>best) best=cur;
  }
  return best;
}
function maxCompletionsInOneDay(){
  const map={}; state.xpLog.forEach(x=>{ map[x.date]=(map[x.date]||0)+1 });
  return Math.max(0, ...Object.values(map));
}
function countHardMissionsDone(){ return state.xpLog.filter(x=>x.difficulty==='hard').length }
function maxAttrLevel(){ return Math.max(0, ...state.attributes.map(a=>a.level)) }

// 20+ conquistas com ouro
const ACHS = [
  {key:'first',   title:'Primeiro Passo',       desc:'Conclua sua primeira missão.',                 gold:2,  check:()=>Object.keys(state.completions).length>=1},
  {key:'ten',     title:'Dez Missões',          desc:'Conclua 10 missões.',                          gold:5,  check:()=>Object.keys(state.completions).length>=10},
  {key:'fifty',   title:'Cinquenta Missões',    desc:'Conclua 50 missões.',                          gold:15, check:()=>Object.keys(state.completions).length>=50},
  {key:'hundred', title:'Cem Missões',          desc:'Conclua 100 missões.',                         gold:25, check:()=>Object.keys(state.completions).length>=100},

  {key:'hard5',   title:'Herói de Ferro',       desc:'Conclua 5 missões difíceis.',                  gold:10, check:()=>countHardMissionsDone()>=5},
  {key:'hard20',  title:'Veterano das Batalhas',desc:'Conclua 20 missões difíceis.',                 gold:20, check:()=>countHardMissionsDone()>=20},
  {key:'hard50',  title:'Mestre das Provas',    desc:'Conclua 50 missões difíceis.',                 gold:30, check:()=>countHardMissionsDone()>=50},

  {key:'streak3',  title:'Trinca de Vitória',   desc:'Alcance 3 de streak em qualquer missão.',      gold:2,  check:()=>Math.max(0,...state.missions.map(m=>m.streak||0))>=3},
  {key:'streak7',  title:'Semana de Foco',      desc:'Alcance 7 de streak em qualquer missão.',      gold:5,  check:()=>Math.max(0,...state.missions.map(m=>m.streak||0))>=7},
  {key:'streak30', title:'Mês de Constância',   desc:'Alcance 30 de streak em qualquer missão.',     gold:15, check:()=>Math.max(0,...state.missions.map(m=>m.streak||0))>=30},

  {key:'attr5',   title:'Aspirante',            desc:'Leve um atributo ao nível 5.',                 gold:5,  check:()=>maxAttrLevel()>=5},
  {key:'attr10',  title:'Especialista',         desc:'Leve um atributo ao nível 10.',                gold:10, check:()=>maxAttrLevel()>=10},
  {key:'attr20',  title:'Mestre',               desc:'Leve um atributo ao nível 20.',                gold:20, check:()=>maxAttrLevel()>=20},

  {key:'gold100', title:'Bolso Cheio',          desc:'Acumule 100 🪙 de ouro.',                       gold:5,  check:()=>state.gold>=100},
  {key:'gold500', title:'Tesouro do Rei',       desc:'Acumule 500 🪙 de ouro.',                       gold:15, check:()=>state.gold>=500},

  {key:'char5',   title:'Subida Épica',         desc:'Alcançar o nível 5 de personagem.',            gold:5,  check:()=>state.character.level>=5},
  {key:'char10',  title:'Campeão do Reino',     desc:'Alcançar o nível 10 de personagem.',           gold:15, check:()=>state.character.level>=10},

  {key:'daily7',  title:'Discípulo do Hábito',  desc:'Conclua ao menos 1 missão por 7 dias seguidos.', gold:10, check:()=>longestGlobalStreak()>=7},
  {key:'daily30', title:'Guerreiro das Rotinas',desc:'Conclua ao menos 1 missão por 30 dias seguidos.',gold:25, check:()=>longestGlobalStreak()>=30},
  {key:'sameDay5',title:'Incansável',           desc:'Conclua 5 missões no mesmo dia.',              gold:10, check:()=>maxCompletionsInOneDay()>=5},
];

function renderAchievements(){
  const box=$("#achList"); if(!box) return;
  box.innerHTML="";
  if(ACHS.length===0){ $("#achEmpty").style.display=""; return }
  $("#achEmpty").style.display="none";
  ACHS.forEach(a=>{
    const got = !!state.achievementsAwarded[a.key];
    if(a.check()) awardGold(a.key, a.gold, a.title);
    const row=document.createElement("div");
    row.className="card";
    row.innerHTML=`
      <div class="row" style="align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:900;"><span class="trophy">🏆</span>${a.title}</div>
          <div class="muted small">${a.desc}</div>
        </div>
        <span class="chip">+${a.gold} 🪙</span>
        <span class="chip">${got? "Obtida":"Pendente"}</span>
      </div>`;
    box.appendChild(row);
  });
}

/////////////////////////////
// Calendário e Stats
/////////////////////////////
let calCursor = new Date();
function renderCalendar(){
  const title=$("#calMonthTitle"); const grid=$("#calendarGrid");
  if(!title || !grid) return;
  title.textContent = fmtMonthTitle(calCursor);
  grid.innerHTML = "";
  const y=calCursor.getFullYear(), m=calCursor.getMonth();
  const first=new Date(y,m,1); const start=first.getDay(); const days=new Date(y,m+1,0).getDate();
  for(let i=0;i<start;i++){ const d=document.createElement("div"); d.className="calcell"; grid.appendChild(d) }
  for(let day=1; day<=days; day++){
    const key=todayKey(new Date(y,m,day));
    const count=state.xpLog.filter(x=>x.date===key).length;
    const cell=document.createElement("div");
    cell.className="calcell";
    cell.innerHTML=`<div class="daynum">${String(day).padStart(2,'0')}</div><div class="calmark">${count>0? "✅×"+count:""}</div>`;
    grid.appendChild(cell);
  }
}
$("#prevMonth") && ($("#prevMonth").onclick=()=>{ calCursor=new Date(calCursor.getFullYear(), calCursor.getMonth()-1,1); renderCalendar() });
$("#nextMonth") && ($("#nextMonth").onclick=()=>{ calCursor=new Date(calCursor.getFullYear(), calCursor.getMonth()+1,1); renderCalendar() });

function renderStats(){
  const today=todayKey();
  const [ws,we]=weekRange(new Date());
  const inWeek=state.xpLog.filter(x=>{ const d=ymdToDate(x.date); return d>=ws && d<=we });
  const todayXP=state.xpLog.filter(x=>x.date===today).reduce((s,x)=>s+x.charXP,0);
  const weekXP=inWeek.reduce((s,x)=>s+x.charXP,0);
  $("#xpToday") && ($("#xpToday").textContent=todayXP);
  $("#xpWeek") && ($("#xpWeek").textContent=weekXP);
  const streakOfDay=state.missions.filter(m=>(m.lastDone===today)&&(m.streak||0)>=2).length;
  $("#streakOfDay") && ($("#streakOfDay").textContent=streakOfDay);
}

/////////////////////////////
// Recompensas
/////////////////////////////
function renderRewards(){
  const list=$("#rewardList"); if(!list) return;
  list.innerHTML="";
  if(state.rewards.length===0){ $("#rewardEmpty").style.display=""; }
  else { $("#rewardEmpty").style.display="none"; }

  state.rewards.forEach(r=>{
    const row=document.createElement("div");
    row.className="reward";
    row.innerHTML=`
      <div class="meta"><div><strong>${r.name}</strong></div><div class="small muted">Custa ${r.cost} 🪙</div></div>
      <div class="actions">
        <button class="wood" data-buy="${r.id}">Comprar</button>
        <button class="wood" data-delr="${r.id}" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button>
      </div>`;
    list.appendChild(row);
  });

  $$("button[data-buy]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-buy");
    const r=state.rewards.find(x=>x.id===id);
    if(!r) return;
    if(state.gold<r.cost) return alert("Ouro insuficiente.");
    state.gold -= r.cost;
    state.rewardsHistory.unshift({date:todayKey(), name:r.name, cost:r.cost});
    store.save(state); renderHeader(); renderRewards(); renderRewardHistory();
    toast(`Você comprou "${r.name}" por ${r.cost} 🪙`);
  });

  $$("button[data-delr]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-delr");
    if(confirm("Excluir esta recompensa?")){
      state.rewards=state.rewards.filter(x=>x.id!==id);
      store.save(state); renderRewards();
    }
  });
}
$("#addReward") && ($("#addReward").onclick=()=>{
  const name = ($("#rewardName")?.value||"").trim();
  const cost = Math.max(1, parseInt($("#rewardCost")?.value||"1",10));
  if(!name) return alert("Dê um nome para a recompensa.");
  const id="r"+Math.random().toString(36).slice(2,8);
  state.rewards.push({id,name,cost});
  $("#rewardName").value=""; $("#rewardCost").value="50";
  store.save(state); renderRewards();
});
function renderRewardHistory(){
  const box=$("#rewardHistory"); const empty=$("#rewardHistoryEmpty");
  if(!box || !empty) return;
  box.innerHTML="";
  if(state.rewardsHistory.length===0){ empty.style.display=""; return }
  empty.style.display="none";
  state.rewardsHistory.forEach(h=>{
    const row=document.createElement("div");
    row.className="row";
    row.innerHTML=`<span class="chip">${h.date}</span><span>${h.name}</span><span class="chip">-${h.cost} 🪙</span>`;
    box.appendChild(row);
  });
}

/////////////////////////////
// Export/Import
/////////////////////////////
$("#exportBtn") && ($("#exportBtn").onclick=()=>{
  const data=JSON.stringify(state,null,2);
  const blob=new Blob([data],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="metaxp_backup.json"; a.click();
  URL.revokeObjectURL(url);
});
$("#importFile") && ($("#importFile").onchange=(e)=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const obj=JSON.parse(reader.result);
      state=obj; store.save(state);
      renderAll(); alert("Importação concluída!");
    }catch(err){ alert("Arquivo inválido.") }
  };
  reader.readAsText(file);
});

/////////////////////////////
// Temas (medieval/pink/minimal)
/////////////////////////////
const THEME_STYLE_ID = 'metaxp-dynamic-theme';
const THEME_STYLES = {
  medieval: `
    :root[data-theme="medieval"]{
      --bg:#17130e; --bg2:#1e1912; --paper:#221b12; --ink:#e8d9b8;
      --muted:#cbbf9b; --accent:#d4a05a; --accent2:#8fb873; --edge:#3a2b1a;
    }
    :root[data-theme="medieval"] body{ color:var(--ink); }
  `,
  pink: `
    :root[data-theme="pink"]{
      --bg:#2a1120; --bg2:#1b0b14; --paper:#2d1523; --ink:#ffe7f4;
      --muted:#ffc9e3; --accent:#ff4fa0; --accent2:#ffa0d0; --edge:#3c0f2a;
    }
    :root[data-theme="pink"] body{ color:var(--ink); }
  `,
  minimal: `
    :root[data-theme="minimal"]{
      --bg:#0f0f10; --bg2:#0f0f10; --paper:#111213; --ink:#ffffff;
      --muted:#c7c8c9; --accent:#d0d0d0; --accent2:#bdbdbd; --edge:#1f1f20;
    }
    :root[data-theme="minimal"] body{ color:var(--ink); }
  `
};

function ensureThemeStyleTag(){
  let tag = document.getElementById(THEME_STYLE_ID);
  if(!tag){
    tag = document.createElement('style');
    tag.id = THEME_STYLE_ID;
    document.head.appendChild(tag);
  }
  return tag;
}
function applyTheme(theme){
  try { localStorage.setItem('metaxp_theme', theme) } catch(e){}
  document.documentElement.setAttribute('data-theme', theme);
  ensureThemeStyleTag().textContent =
    (THEME_STYLES[theme] || THEME_STYLES.medieval);

  // rótulos das abas (remover emojis no minimal/pink; manter no medieval)
  const tabs = Array.from(document.querySelectorAll('.tabs .tab'));
  if (theme === 'minimal' || theme === 'pink') {
    tabs.forEach(t=>{
      const txt = (t.textContent || '');
      t.textContent = txt.replace(/^[^\p{L}\p{N}]+/u, '').trim();
    });
  } else if (theme === 'medieval') {
  const originals = {
    missoes: '🗡️ Missões',
    atributos: '🛡️ Atributos',
    conquistas: '🏆 Conquistas',
    calendario: '📜 Calendário',
    rewards: '💰 Recompensas',
    survival: '🌿 Sobrevivência',
    config: '⚙️ Configurações'
  };
  tabs.forEach((t)=>{
    const key = t.dataset.tab;
    if (originals[key]) t.textContent = originals[key];
  });
}
function ensureThemeButtons(){
  let btnMed=$("#themeMedieval"), btnPink=$("#themePink"), btnMin=$("#themeMinimal");
  if(!btnMed || !btnPink || !btnMin){
    const card=document.createElement("div");
    card.className="card";
    card.innerHTML=`
      <h3 style="margin:0 0 8px 0;">Aparência</h3>
      <div class="row">
        <button id="themeMedieval" class="wood">RPG Medieval</button>
        <button id="themePink" class="wood">Pink</button>
        <button id="themeMinimal" class="wood">Minimal</button>
      </div>
      <p class="muted">Escolha um tema. A preferência fica salva neste dispositivo.</p>`;
    ($("#tab-config")||$("main")||document.body).prepend(card);
    btnMed=$("#themeMedieval"); btnPink=$("#themePink"); btnMin=$("#themeMinimal");
  }
  const bind=(btn,theme)=>{
    if(!btn || btn.__bound) return;
    btn.__bound=true;
    btn.addEventListener('click', ()=>applyTheme(theme));
  };
  bind(btnMed,'medieval'); bind(btnPink,'pink'); bind(btnMin,'minimal');

  applyTheme(localStorage.getItem('metaxp_theme') || state.theme || 'medieval');
}

// ====== Sobrevivência (Sono & Água) ======
const SV_SLEEP_GOAL = 8.0;   // horas
const SV_WATER_GOAL = 2.0;   // litros
const SV_CHAR_XP_ON_GOAL = 5;     // XP no personagem por meta batida
const SV_HEALTH_XP_ON_GOAL = 5;   // XP no atributo "Saúde" por meta batida

function svGet(day){ return state.survival[day] || { sleep:0, water:0 } }
function svSet(day, data){ state.survival[day] = { sleep: data.sleep||0, water: data.water||0, awarded: data.awarded||false } }

function renderSurvival(){
  // data "Hoje" por padrão
  const today = todayKey();
  const dateInput = $("#svDate");
  if (!dateInput.value) dateInput.value = today;
  $("#svGoalsText").textContent = `${SV_SLEEP_GOAL}h de sono • ${SV_WATER_GOAL.toFixed(1)}L de água`;

  // Preenche campos com o que houver salvo
  const rec = svGet(dateInput.value);
  $("#svSleep").value = rec.sleep || "";
  $("#svWater").value = rec.water || "";

  renderSurvivalHistory();
}

$("#svToday")?.addEventListener("click", ()=>{
  $("#svDate").valueAsDate = new Date();
  const rec = svGet(todayKey());
  $("#svSleep").value = rec.sleep || "";
  $("#svWater").value = rec.water || "";
});

$("#svSave")?.addEventListener("click", ()=>{
  const day = $("#svDate").value || todayKey();
  const sleep = parseFloat($("#svSleep").value || "0");
  const water = parseFloat($("#svWater").value || "0");

  if ((isNaN(sleep) || sleep<=0) && (isNaN(water) || water<=0)){
    alert("Digite pelo menos um valor (> 0) para salvar.");
    return;
  }
  if (sleep<0 || sleep>24){ alert("Horas de sono deve estar entre 0 e 24."); return; }
  if (water<0){ alert("Água deve ser >= 0."); return; }

  const prev = svGet(day);
  const alreadyAwarded = !!prev.awarded;
  svSet(day, { sleep, water, awarded: prev.awarded });
  store.save(state);

  // Regras de meta e XP (uma vez por dia)
  const hitSleep = sleep >= SV_SLEEP_GOAL;
  const hitWater = water >= SV_WATER_GOAL;

  if (!alreadyAwarded && (hitSleep || hitWater)){
    // concede XP no personagem + atributo "Saúde" por cada meta batida
    let totalChar = 0, totalHealth = 0;
    const health = state.attributes.find(a => a.name.toLowerCase()==='saúde' || a.id==='health');
    if (hitSleep){ totalChar += SV_CHAR_XP_ON_GOAL; totalHealth += SV_HEALTH_XP_ON_GOAL; }
    if (hitWater){ totalChar += SV_CHAR_XP_ON_GOAL; totalHealth += SV_HEALTH_XP_ON_GOAL; }

    if (totalChar>0) grantXPCharacter(totalChar);
    if (health && totalHealth>0) grantXPAttribute(health.id, totalHealth);

    // marca como premiado no dia pra não duplicar
    const d = svGet(day);
    d.awarded = true;
    svSet(day, d);
    store.save(state);

    toast(`🌿 Metas do dia atingidas! +${totalChar} XP personagem, +${totalHealth} XP em Saúde`);
  } else {
    toast(`🌿 Dados de ${day} salvos!`);
  }

  renderHeader();
  renderAttributes();
  renderSurvivalHistory();
});

// histórico (últimos 7 dias) com mini-barras
function renderSurvivalHistory(){
  const box = $("#svHistory");
  box.innerHTML = "";

  // pega últimos 7 dias em ordem decrescente (hoje -> -6)
  const days = [];
  const today = new Date();
  for (let i=0;i<7;i++){
    const d = addDays(today, -i);
    const k = todayKey(d);
    if (state.survival[k]) days.push(k);
  }
  if (days.length===0){
    box.innerHTML = `<div class="muted">Sem registros nos últimos 7 dias.</div>`;
    return;
  }

  const table = document.createElement("div");
  table.style.display = "grid";
  table.style.gridTemplateColumns = "120px 1fr 1fr";
  table.style.gap = "8px";
  table.style.alignItems = "center";

  // header
  table.innerHTML = `
    <div class="muted small">Data</div>
    <div class="muted small">😴 Sono</div>
    <div class="muted small">💧 Água</div>
  `;

  days.forEach(k=>{
    const r = svGet(k);
    // % para as barras com base nas metas
    const pSleep = Math.min(100, Math.round((r.sleep||0)/SV_SLEEP_GOAL*100));
    const pWater = Math.min(100, Math.round((r.water||0)/SV_WATER_GOAL*100));
    const okSleep = (r.sleep||0) >= SV_SLEEP_GOAL;
    const okWater = (r.water||0) >= SV_WATER_GOAL;

    const bar = (pct, ok, label)=>`
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="flex:1; height:10px; border:1px solid #2a2217; border-radius:999px; background:#0e0b08; overflow:hidden;">
          <div style="height:100%; width:${pct}%; ${ok?'background:linear-gradient(90deg,#8fb873,#5aa75a);':'background:linear-gradient(90deg,#6b4f2c,#8a6a3f);'}"></div>
        </div>
        <span class="small ${ok?'':'muted'}">${label}</span>
      </div>
    `;

    const row = document.createElement("div");
    row.style.display = "contents"; // pra usar grid
    row.innerHTML = `
      <div><span class="chip">${k}</span></div>
      <div>${bar(pSleep, okSleep, (r.sleep??0)+'h')}</div>
      <div>${bar(pWater, okWater, (r.water??0)+'L')}</div>
    `;
    table.appendChild(row);
  });

  box.appendChild(table);
}

/////////////////////////////
// UI util
/////////////////////////////
function toast(msg){
  const el=document.createElement("div");
  el.textContent=msg;
  el.style.position="fixed";
  el.style.bottom="20px";
  el.style.left="50%";
  el.style.transform="translateX(-50%)";
  el.style.background="#14100b";
  el.style.border="1px solid #2a2217";
  el.style.padding="10px 14px";
  el.style.borderRadius="999px";
  el.style.boxShadow="0 10px 30px #00000055";
  el.style.zIndex="1000";
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1800);
}

/////////////////////////////
// Filtros Missões / Modals
/////////////////////////////
if($("#range")) { $("#range").value="day"; $("#range").onchange=renderMissions; }
if($("#baseDate")) { $("#baseDate").valueAsDate=new Date(); $("#baseDate").onchange=renderMissions; }
$$(".modal").forEach(m=>m.addEventListener("click",(e)=>{ if(e.target===m) m.classList.remove("open") }));

/////////////////////////////
// Inicialização
/////////////////////////////
function renderAll(){
  renderHeader();
  renderAttributes();
  renderMissions();
  renderCalendar();
  renderAchievements();
  renderStats();
  renderRewards();
  renderRewardHistory();
  ensureThemeButtons();
  renderSurvival();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', renderAll, {once:true});
} else {
  renderAll();
}
