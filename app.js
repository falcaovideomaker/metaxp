/* Meta XP 2.3.2 (app.js) — Conquistas exibindo ouro + auto-premiação
   Compatível com o index.html 2.3.1
   - Mostra +X 🪙 na aba Conquistas
   - Ao cumprir critério, concede ouro automaticamente (uma vez)
   - Mantém dados existentes do localStorage (metaxp6) */

// ---------- Utilidades ----------
const $=(s,p=document)=>p.querySelector(s);
const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));

function todayKey(d=new Date()){ return d.toISOString().slice(0,10); }
function ymdToDate(ymd){ const [y,m,d]=ymd.split("-").map(n=>+n); return new Date(y,m-1,d); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function weekRange(base){
  const d=new Date(base);
  const day=d.getDay();
  const mon = day===0 ? -6 : (1-day);
  const start=addDays(d,mon);
  return [start, addDays(start,6)];
}
function monthRange(base){
  const d=new Date(base);
  return [ new Date(d.getFullYear(), d.getMonth(), 1),
           new Date(d.getFullYear(), d.getMonth()+1, 0) ];
}
function fmtTime(t){ return t||""; }
function nextRequirement(prev){ return Math.max(10, Math.round(prev*1.10)); }

// ---------- Estado & Persistência ----------
const store={
  load(){
    const raw=localStorage.getItem("metaxp6");
    if(!raw){
      return {
        character:{name:"Aventureiro", level:1, xp:0, next:100, baseNext:100},
        attributes:[],
        missions:[],
        completions:{},
        xpLog:[],
        gold:0,
        achievementsAwarded:{},   // mapa: key -> true
        rewards:[],
        rewardsHistory:[]
      };
    }
    try{
      const d=JSON.parse(raw);
      // Preenche campos que possam não existir em instalações antigas
      d.character = d.character || {name:"Aventureiro", level:1, xp:0, next:100, baseNext:100};
      if(d.character.baseNext==null) d.character.baseNext=100;
      d.attributes = d.attributes || [];
      d.missions = d.missions || [];
      d.completions = d.completions || {};
      d.xpLog = d.xpLog || [];
      d.gold = d.gold || 0;
      d.achievementsAwarded = d.achievementsAwarded || {};
      d.rewards = d.rewards || [];
      d.rewardsHistory = d.rewardsHistory || [];
      return d;
    }catch(e){
      // Em caso de corrupção, recomeça seguro
      return {
        character:{name:"Aventureiro", level:1, xp:0, next:100, baseNext:100},
        attributes:[], missions:[], completions:{},
        xpLog:[], gold:0, achievementsAwarded:{},
        rewards:[], rewardsHistory:[]
      };
    }
  },
  save(d){ localStorage.setItem("metaxp6", JSON.stringify(d)); }
};
let state = store.load();

// ---------- Lógica de XP ----------
function grantXPCharacter(xp){
  let c=state.character;
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

function findAttr(id){ return state.attributes.find(a=>a.id===id); }
function grantXPAttribute(attrId, xp){
  const a = findAttr(attrId);
  if(!a) return;
  a.xp += xp;
  while(a.xp >= a.next){
    a.xp -= a.next;
    a.level += 1;
    a.next = nextRequirement(a.next);
  }
}

// ---------- Ouro & Conquistas ----------
function awardGold(key, amount, reason){
  if(state.achievementsAwarded[key]) return; // idempotente
  state.achievementsAwarded[key] = true;
  state.gold += amount;
  store.save(state);
  renderHeader();
  toast(`🪙 +${amount} ouro — ${reason}`);
}

// Funções auxiliares de estatística para conquistas
function uniqueDates(){ return [...new Set(state.xpLog.map(x=>x.date))].sort(); }
function longestGlobalStreak(){
  const ds=uniqueDates();
  if(ds.length===0) return 0;
  let best=1, cur=1;
  for(let i=1;i<ds.length;i++){
    const prev=new Date(ds[i-1]);
    const curd=new Date(ds[i]);
    const delta=(curd-prev)/(1000*60*60*24);
    if(delta===1) cur++;
    else if(delta>1) cur=1;
    if(cur>best) best=cur;
  }
  return best;
}
function maxCompletionsInOneDay(){
  const map={};
  state.xpLog.forEach(x=>{ map[x.date]=(map[x.date]||0)+1; });
  return Math.max(0, ...(Object.values(map).length?Object.values(map):[0]));
}
function maxAttrLevel(){ return Math.max(0, ...(state.attributes.map(a=>a.level).length?state.attributes.map(a=>a.level):[0])); }

// Lista de conquistas (com ouro)
const ACHS=[
  {key:'first',    title:'Primeiro Passo',          desc:'Conclua sua primeira missão.', gold:2,  check:()=>Object.keys(state.completions).length>=1},
  {key:'ten',      title:'Dez Missões',             desc:'Conclua 10 missões.',         gold:5,  check:()=>Object.keys(state.completions).length>=10},
  {key:'fifty',    title:'Cinquenta Missões',       desc:'Conclua 50 missões.',         gold:15, check:()=>Object.keys(state.completions).length>=50},
  {key:'hundred',  title:'Cem Missões',             desc:'Conclua 100 missões.',        gold:25, check:()=>Object.keys(state.completions).length>=100},

  {key:'streak3',  title:'Trinca de Vitória',       desc:'Faça 3 dias seguidos com pelo menos 1 missão.', gold:2,  check:()=>longestGlobalStreak()>=3},
  {key:'streak7',  title:'Semana de Foco',          desc:'Faça 7 dias seguidos com pelo menos 1 missão.', gold:5,  check:()=>longestGlobalStreak()>=7},
  {key:'streak30', title:'Mês de Constância',       desc:'Faça 30 dias seguidos com pelo menos 1 missão.', gold:15, check:()=>longestGlobalStreak()>=30},

  {key:'attr5',    title:'Aspirante',               desc:'Leve um atributo ao nível 5.',  gold:5,  check:()=>maxAttrLevel()>=5},
  {key:'attr10',   title:'Especialista',            desc:'Leve um atributo ao nível 10.', gold:10, check:()=>maxAttrLevel()>=10},
  {key:'attr20',   title:'Mestre',                  desc:'Leve um atributo ao nível 20.', gold:20, check:()=>maxAttrLevel()>=20},

  {key:'gold100',  title:'Bolso Cheio',             desc:'Acumule 100 🪙 de ouro.',       gold:5,  check:()=>state.gold>=100},
  {key:'gold500',  title:'Tesouro do Rei',          desc:'Acumule 500 🪙 de ouro.',       gold:15, check:()=>state.gold>=500},

  {key:'char5',    title:'Subida Épica',            desc:'Alcance o nível 5 do personagem.',  gold:5,  check:()=>state.character.level>=5},
  {key:'char10',   title:'Campeão do Reino',        desc:'Alcance o nível 10 do personagem.', gold:15, check:()=>state.character.level>=10},

  {key:'sameDay5', title:'Incansável',              desc:'Conclua 5 missões no mesmo dia.', gold:10, check:()=>maxCompletionsInOneDay()>=5},
];

function renderAchievements(){
  const box = $("#achList");
  if(!box) return; // caso a aba não exista no HTML atual

  box.innerHTML = "";
  if(ACHS.length===0){
    const empty=$("#achEmpty"); if(empty) empty.style.display="";
    return;
  }
  const empty=$("#achEmpty"); if(empty) empty.style.display="none";

  ACHS.forEach(a=>{
    const eligible = a.check();
    // Se elegível e ainda não premiado, concede ouro
    if(eligible) awardGold(a.key, a.gold, a.title);

    const got = !!state.achievementsAwarded[a.key];
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `
      <div class="row" style="align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:900;">
            <span class="trophy">🏆</span>${a.title}
          </div>
          <div class="muted small">${a.desc}</div>
        </div>
        <span class="chip">Recompensa: +${a.gold} 🪙</span>
        <span class="chip">${got ? "Obtida" : "Pendente"}</span>
      </div>`;
    box.appendChild(row);
  });
}

// ---------- Cabeçalho / UI básica ----------
function renderHeader(){
  const c=state.character;
  const nameV=$("#charNameView"); if(nameV) nameV.textContent=c.name;
  const lvl=$("#charLevel"); if(lvl) lvl.textContent=c.level;
  const xp=$("#charXP"); if(xp) xp.textContent=c.xp;
  const nxt=$("#charNext"); if(nxt) nxt.textContent=c.next;
  const gold=$("#goldBalance"); if(gold) gold.textContent=state.gold;
  const fill=$("#charXPFill");
  if(fill){
    const pct=Math.min(100, Math.round(100*c.xp/c.next));
    fill.style.width = pct+"%";
  }
}

// ---------- Atributos ----------
function renderAttributes(){
  const wrap=$("#attrList"); if(!wrap) return;
  wrap.innerHTML="";
  if(state.attributes.length===0){
    const e=$("#attrEmpty"); if(e) e.style.display="";
    return;
  }
  const e=$("#attrEmpty"); if(e) e.style.display="none";
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
        <button class="chip" data-del="${a.id}">Excluir</button>
      </div>`;
    wrap.appendChild(card);
  });
  $$("button[data-del]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-del");
    if(confirm("Excluir atributo? Missões que o usam perderão essa referência.")){
      state.attributes = state.attributes.filter(x=>x.id!==id);
      state.missions.forEach(m=>m.attrXP=(m.attrXP||[]).filter(ax=>ax.attrId!==id));
      store.save(state);
      renderAttributes();
      renderMissionModalAttrList();
    }
  });
}
const addAttrBtn = $("#addAttr");
if(addAttrBtn){
  addAttrBtn.onclick=()=>{
    const name=$("#newAttrName").value.trim();
    if(!name) return alert("Dê um nome ao atributo.");
    const id="a"+Math.random().toString(36).slice(2,8);
    state.attributes.push({id,name,level:1,xp:0,next:100});
    $("#newAttrName").value="";
    store.save(state);
    renderAttributes();
    renderMissionModalAttrList();
  };
}

// ---------- Missões ----------
function missionOccurrencesInRange(missions,start,end){
  const occs=[];
  const sK=todayKey(start), eK=todayKey(end);
  missions.forEach(m=>{
    if(m.recur==="once"){
      if(m.date>=sK && m.date<=eK)
        occs.push({id:`${m.id}@${m.date}`, mission:m, date:m.date, time:m.time||"00:00"});
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
  const base = $("#baseDate") && $("#baseDate").value ? ymdToDate($("#baseDate").value) : new Date();
  const mode = $("#range") ? $("#range").value : "day";
  let start,end;
  if(mode==="day"){ start=base; end=base; }
  if(mode==="week"){ [start,end]=weekRange(base); }
  if(mode==="month"){ [start,end]=monthRange(base); }
  const occs = missionOccurrencesInRange(state.missions,start,end)
                .sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time));
  const emp=$("#missionEmpty");
  if(emp) emp.style.display = occs.length? "none": "";

  occs.forEach(occ=>{
    const m=occ.mission;
    const completed=!!state.completions[occ.id];
    const attrs=(m.attrXP||[]).map(ax=>{
      const attr=findAttr(ax.attrId);
      return attr? `<span class="chip">${attr.name}: +${ax.xp} XP</span>` : "";
    }).join(" ");
    const wrap=document.createElement("div");
    wrap.className="goal";
    wrap.innerHTML = `
      <div class="meta">
        <div><strong>🗡️ ${m.title}</strong> ${completed?"✅":""}</div>
        <div class="small muted">${occ.date} ${fmtTime(m.time)} • ${m.recur==="once"?"Única":"Semanal"}</div>
        <div class="small" style="margin-top:6px;">
          <span class="chip">Personagem: ~+${m.charXP||0} XP</span>
          ${attrs}
        </div>
      </div>
      <div class="actions">
        ${completed
          ? `<button data-undo="${occ.id}">Desfazer</button>`
          : `<button data-done="${occ.id}">Concluir</button>`}
        <button data-delm="${m.id}" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button>
      </div>`;
    list.appendChild(wrap);
  });

  $$("button[data-done]").forEach(b=>b.onclick=()=>completeOccurrence(b.getAttribute("data-done")));
  $$("button[data-undo]").forEach(b=>b.onclick=()=>undoOccurrence(b.getAttribute("data-undo")));
  $$("button[data-delm]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-delm");
    if(confirm("Excluir esta missão (todas as ocorrências futuras)?")){
      state.missions = state.missions.filter(x=>x.id!==id);
      Object.keys(state.completions).forEach(k=>{ if(k.startsWith(id+"@")) delete state.completions[k]; });
      store.save(state);
      renderMissions(); renderCalendar(); renderAchievements(); renderStats();
    }
  });
}

function prevOccurrenceDate(m,dateKey){
  if(m.recur==="once") return null;
  const d=ymdToDate(dateKey);
  for(let i=1;i<=28;i++){
    const prev=addDays(d,-i);
    const k=todayKey(prev);
    if(k<m.date) break;
    if(m.recur==="weekly"){
      const wd=prev.getDay();
      if((m.weekdays||[]).includes(wd)) return k;
    }
  }
  return null;
}

function completeOccurrence(occId){
  if(state.completions[occId]) return;
  const [mId,date]=occId.split("@");
  const m=state.missions.find(x=>x.id===mId);
  if(!m) return;

  // Streak simples por ocorrência semanal
  const prevKey = prevOccurrenceDate(m,date);
  if(prevKey && state.completions[`${m.id}@${prevKey}`]) m.streak=(m.streak||0)+1;
  else m.streak=1;
  m.lastDone = date;

  // XP e log
  const charXP = Math.max(0, m.charXP||0);
  grantXPCharacter(charXP);
  (m.attrXP||[]).forEach(ax=>grantXPAttribute(ax.attrId, Math.max(0, ax.xp||0)));
  state.completions[occId] = true;
  state.xpLog.push({date, charXP, missionId:m.id});

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

// ---------- Modal de Missão ----------
function openModal(s){ const m=$(s); if(m) m.classList.add("open"); }
function closeModal(s){ const m=$(s); if(m) m.classList.remove("open"); }

const newMissionBtn=$("#newMission");
if(newMissionBtn){
  newMissionBtn.onclick=()=>{ openModal("#missionModal"); renderMissionModalAttrList(); };
}
const createMissionBtn=$("#createMission");
if(createMissionBtn){
  createMissionBtn.onclick=()=>{
    const title=$("#mTitle").value.trim();
    if(!title) return alert("Dê um título para a missão.");
    const recur=$("#mRecur").value;
    const date=$("#mDate").value || todayKey();
    const time=$("#mTime").value || "07:00";
    const charXP=Math.max(0, parseInt($("#mXP").value||"0",10));
    const payload={
      id:"m"+Math.random().toString(36).slice(2,8),
      title, recur, date, time,
      weekdays: (recur==="weekly") ? selectedWeekdays() : [],
      charXP, attrXP: collectAttrAlloc(),
      streak:0, lastDone:null
    };
    state.missions.push(payload);
    store.save(state);

    $("#mTitle").value=""; $("#mXP").value="10"; $("#mDate").value=""; $("#mTime").value="07:00";
    $$("#mWeekdays input[type=checkbox]").forEach(cb=>cb.checked=false);
    $("#mAttrList").innerHTML="";
    closeModal("#missionModal");
    renderMissions(); renderCalendar();
  };
}
function selectedWeekdays(){ return $$("#mWeekdays input[type=checkbox]:checked").map(cb=>parseInt(cb.value,10)); }

function renderMissionModalAttrList(){
  const box=$("#mAttrList"); if(!box) return;
  box.innerHTML="";
  if(state.attributes.length===0){
    box.innerHTML=`<p class="muted small">Sem atributos. Crie alguns na aba “Atributos”.</p>`;
    return;
  }
  addAttrAllocLine();
}
const addAttrAllocBtn=$("#addAttrAlloc");
if(addAttrAllocBtn){ addAttrAllocBtn.onclick=addAttrAllocLine; }

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
  del.textContent="–"; del.onclick=()=>line.remove();
  line.append(sel,xp,del);
  box.appendChild(line);
}
function collectAttrAlloc(){
  return $$("#mAttrList .attrLine").map(l=>({attrId:$("select",l).value, xp:Math.max(0, parseInt($("input",l).value||"0",10))}));
}

// ---------- Calendário & Stats ----------
let calCursor = new Date();

function fmtMonthTitle(date){ return date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'}); }

function renderCalendar(){
  const title=$("#calMonthTitle"), grid=$("#calendarGrid");
  if(!title||!grid) return;
  title.textContent = fmtMonthTitle(calCursor);
  grid.innerHTML="";
  const y=calCursor.getFullYear(), m=calCursor.getMonth();
  const first=new Date(y,m,1);
  const start=first.getDay();
  const days=new Date(y,m+1,0).getDate();
  for(let i=0;i<start;i++){ const d=document.createElement("div"); d.className="calcell"; grid.appendChild(d); }
  for(let day=1; day<=days; day++){
    const key=todayKey(new Date(y,m,day));
    const count=state.xpLog.filter(x=>x.date===key).length;
    const cell=document.createElement("div");
    cell.className="calcell";
    cell.innerHTML=`<div class="daynum">${String(day).padStart(2,"0")}</div><div class="calmark">${count>0? "✅×"+count : ""}</div>`;
    grid.appendChild(cell);
  }
}
const prevMonthBtn=$("#prevMonth"); if(prevMonthBtn) prevMonthBtn.onclick=()=>{ calCursor=new Date(calCursor.getFullYear(), calCursor.getMonth()-1,1); renderCalendar(); };
const nextMonthBtn=$("#nextMonth"); if(nextMonthBtn) nextMonthBtn.onclick=()=>{ calCursor=new Date(calCursor.getFullYear(), calCursor.getMonth()+1,1); renderCalendar(); };

function renderStats(){
  const today=todayKey();
  const [ws,we]=weekRange(new Date());
  const inWeek=state.xpLog.filter(x=>{const d=ymdToDate(x.date); return d>=ws && d<=we;});
  const todayXP=state.xpLog.filter(x=>x.date===today).reduce((s,x)=>s+x.charXP,0);
  const weekXP=inWeek.reduce((s,x)=>s+x.charXP,0);
  const sDay = state.missions.filter(m=>(m.lastDone===today)&&(m.streak||0)>=2).length;
  const el1=$("#xpToday"); if(el1) el1.textContent=todayXP;
  const el2=$("#xpWeek"); if(el2) el2.textContent=weekXP;
  const el3=$("#streakOfDay"); if(el3) el3.textContent=sDay;
}

// ---------- Recompensas ----------
function renderRewards(){
  const list=$("#rewardList"); if(!list) return;
  list.innerHTML="";
  const empty=$("#rewardEmpty");
  if(state.rewards.length===0){ if(empty) empty.style.display=""; }
  else { if(empty) empty.style.display="none"; }
  state.rewards.forEach(r=>{
    const row=document.createElement("div");
    row.className="reward";
    row.innerHTML=`
      <div class="meta">
        <div><strong>${r.name}</strong></div>
        <div class="small muted">Custa ${r.cost} 🪙</div>
      </div>
      <div class="actions">
        <button data-buy="${r.id}">Comprar</button>
        <button data-delr="${r.id}" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button>
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
    store.save(state);
    renderHeader(); renderRewards(); renderRewardHistory();
    toast(`Você comprou "${r.name}" por ${r.cost} 🪙`);
  });
  $$("button[data-delr]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-delr");
    if(confirm("Excluir esta recompensa?")){
      state.rewards = state.rewards.filter(x=>x.id!==id);
      store.save(state);
      renderRewards();
    }
  });
}
const addRewardBtn=$("#addReward");
if(addRewardBtn){
  addRewardBtn.onclick=()=>{
    const name=$("#rewardName").value.trim();
    const cost=Math.max(1, parseInt($("#rewardCost").value||"1",10));
    if(!name) return alert("Dê um nome para a recompensa.");
    const id="r"+Math.random().toString(36).slice(2,8);
    state.rewards.push({id,name,cost});
    $("#rewardName").value="";
    $("#rewardCost").value="50";
    store.save(state);
    renderRewards();
  };
}
function renderRewardHistory(){
  const box=$("#rewardHistory"), empty=$("#rewardHistoryEmpty");
  if(!box) return;
  box.innerHTML="";
  if(state.rewardsHistory.length===0){ if(empty) empty.style.display=""; return; }
  if(empty) empty.style.display="none";
  state.rewardsHistory.forEach(h=>{
    const row=document.createElement("div");
    row.className="row";
    row.innerHTML=`<span class="chip">${h.date}</span><span>${h.name}</span><span class="chip">-${h.cost} 🪙</span>`;
    box.appendChild(row);
  });
}

// ---------- Config / Exportar & Importar ----------
const exportBtn=$("#exportBtn");
if(exportBtn){
  exportBtn.onclick=()=>{
    const data=JSON.stringify(state,null,2);
    const blob=new Blob([data],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download="metaxp_backup.json"; a.click();
    URL.revokeObjectURL(url);
  };
}
const importFile=$("#importFile");
if(importFile){
  importFile.onchange=(e)=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const obj=JSON.parse(reader.result);
        state=obj;
        // Segurança: garantir campos base
        state.achievementsAwarded = state.achievementsAwarded || {};
        state.rewardsHistory = state.rewardsHistory || [];
        store.save(state);
        renderAll();
        alert("Importação concluída!");
      }catch(err){
        alert("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  };
}

// ---------- Tabs ----------
$$(".tab").forEach(t=>t.addEventListener("click",()=>{
  $$(".tab").forEach(x=>x.classList.remove("active"));
  t.classList.add("active");
  const n=t.dataset.tab;
  const ids=["missoes","atributos","conquistas","calendario","rewards","config"];
  ids.forEach(id=>{ const el=$("#tab-"+id); if(el) el.style.display=(n===id)? "": "none"; });
}));

// ---------- Editar Personagem ----------
const editCharBtn=$("#editCharBtn");
if(editCharBtn){
  editCharBtn.onclick=()=>{
    const nm=$("#charName"), bn=$("#baseNext");
    if(nm) nm.value=state.character.name;
    if(bn) bn.value=state.character.baseNext||100;
    openModal("#charModal");
  };
}
const charSave=$("#charSave");
if(charSave){
  charSave.onclick=()=>{
    const name=$("#charName").value.trim()||"Aventureiro";
    const baseNext=Math.max(10, parseInt($("#baseNext").value||"100",10));
    state.character.name=name;
    state.character.baseNext=baseNext;
    if(state.character.level===1) state.character.next=baseNext;
    store.save(state);
    renderHeader();
    closeModal("#charModal");
  };
}

// ---------- Toast ----------
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
  setTimeout(()=>{el.remove();}, 1800);
}

// ---------- Inicialização ----------
(function init(){
  const range=$("#range"); if(range) range.value="day";
  const baseDate=$("#baseDate"); if(baseDate) baseDate.valueAsDate=new Date();
  if(range) range.onchange=renderMissions;
  if(baseDate) baseDate.onchange=renderMissions;
  $$(".modal").forEach(m=>m.addEventListener("click",(e)=>{ if(e.target===m) m.classList.remove("open"); }));
  renderAll();
})();

function renderAll(){
  renderHeader();
  renderAttributes();
  renderMissions();
  renderCalendar();
  renderAchievements(); // <-- chama concessão automática de ouro quando elegível
  renderStats();
  renderRewards();
  renderRewardHistory();
}
