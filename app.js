// ======= Estado & Util =======
const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => Array.from(p.querySelectorAll(s));

function todayKey(d=new Date()){ return d.toISOString().slice(0,10); } // YYYY-MM-DD
function ymdToDate(ymd){ const [y,m,d]=ymd.split('-').map(n=>+n); return new Date(y, m-1, d); }
function addDays(d, n){ const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function weekRange(base){
  const d = new Date(base);
  const day = d.getDay(); // 0 dom
  const mondayOffset = day===0 ? -6 : 1-day;
  const start = addDays(d, mondayOffset);
  return [start, addDays(start, 6)];
}
function monthRange(base){
  const d = new Date(base);
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth()+1, 0);
  return [start, end];
}
function fmtTime(t){ return t || ""; }

const store = {
  load(){
    const raw = localStorage.getItem("metaxp2");
    if(!raw) return {
      character:{ name:"Herói", level:1, xp:0, next:100, baseNext:100 },
      attributes:[],
      missions:[],
      completions:{} // key: occurrenceId (missionId@YYYY-MM-DD) => true
    };
    return JSON.parse(raw);
  },
  save(d){ localStorage.setItem("metaxp2", JSON.stringify(d)); }
};
let state = store.load();

// ======= XP & Nível =======
function nextRequirement(prev){ return Math.max(10, Math.round(prev*1.10)); } // +10% arredondado
function grantXPCharacter(xp){
  let c = state.character;
  c.xp += xp;
  while(c.xp >= c.next){
    c.xp -= c.next;
    c.level += 1;
    c.next = nextRequirement(c.next);
    toast(`Subiu para o nível ${c.level}!`);
  }
}
function findAttr(id){ return state.attributes.find(a=>a.id===id); }
function grantXPAttribute(id, xp){
  const a = findAttr(id);
  if(!a) return;
  a.xp += xp;
  while(a.xp >= a.next){
    a.xp -= a.next;
    a.level += 1;
    a.next = nextRequirement(a.next);
  }
}

// ======= UI: Header =======
function renderHeader(){
  $("#charNameView").textContent = state.character.name;
  $("#charLevel").textContent = state.character.level;
  $("#charXP").textContent = state.character.xp;
  $("#charNext").textContent = state.character.next;
  const pct = Math.min(100, Math.round(100 * state.character.xp / state.character.next));
  $("#charXPFill").style.width = pct + "%";
}

// ======= Tabs =======
$$(".tab").forEach(t => t.addEventListener("click", () => {
  $$(".tab").forEach(x => x.classList.remove("active"));
  t.classList.add("active");
  const name = t.dataset.tab;
  $("#tab-missoes").style.display = name==="missoes" ? "" : "none";
  $("#tab-atributos").style.display = name==="atributos" ? "" : "none";
}));

// ======= Personagem Modal =======
$("#editCharBtn").onclick = () => {
  $("#charName").value = state.character.name;
  $("#baseNext").value = state.character.baseNext || 100;
  openModal("#charModal");
};
$("#charSave").onclick = () => {
  const name = $("#charName").value.trim() || "Herói";
  const baseNext = Math.max(10, parseInt($("#baseNext").value||"100",10));
  state.character.name = name;
  state.character.baseNext = baseNext;
  if(state.character.level===1 && state.character.next !== baseNext){
    // só alinhar se ainda no lvl 1 (evita bagunçar progressões existentes)
    state.character.next = baseNext;
  }
  store.save(state);
  renderHeader();
  closeModal("#charModal");
};

// ======= Atributos =======
function renderAttributes(){
  const wrap = $("#attrList");
  wrap.innerHTML = "";
  if(state.attributes.length===0){
    $("#attrEmpty").style.display = "";
    return;
  }
  $("#attrEmpty").style.display = "none";
  state.attributes.forEach(a => {
    const card = document.createElement("div");
    card.className = "card";
    const pct = Math.round(100 * a.xp / a.next);
    card.innerHTML = `
      <div class="row" style="align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:700;">${a.name}</div>
          <div class="small muted">Nv. ${a.level} — ${a.xp}/${a.next} XP</div>
          <div class="xpbar small" style="margin-top:8px;">
            <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          </div>
        </div>
        <button class="chip" data-del="${a.id}" style="background:#36132a;">Excluir</button>
      </div>
    `;
    wrap.appendChild(card);
  });
  // delete listeners
  $$("button[data-del]").forEach(b => b.onclick = () => {
    const id = b.getAttribute("data-del");
    if(confirm("Excluir atributo? Missões que o referenciam continuarão existindo.")){
      state.attributes = state.attributes.filter(a => a.id !== id);
      state.missions.forEach(m => {
        m.attrXP = (m.attrXP||[]).filter(x => x.attrId !== id);
      });
      store.save(state); renderAttributes(); renderMissionModalAttrList();
    }
  });
}
$("#addAttr").onclick = () => {
  const name = $("#newAttrName").value.trim();
  if(!name) return alert("Dê um nome para o atributo.");
  const id = "a"+Math.random().toString(36).slice(2,8);
  state.attributes.push({ id, name, level:1, xp:0, next:100 });
  $("#newAttrName").value = "";
  store.save(state); renderAttributes(); renderMissionModalAttrList();
};

// ======= Missões =======
function renderMissions(){
  const list = $("#missionList");
  list.innerHTML = "";
  const base = $("#baseDate").value ? ymdToDate($("#baseDate").value) : new Date();
  const mode = $("#range").value;
  let start, end;
  if(mode==="day"){ start = base; end = base; }
  if(mode==="week"){ [start, end] = weekRange(base); }
  if(mode==="month"){ [start, end] = monthRange(base); }

  const occs = missionOccurrencesInRange(state.missions, start, end);
  $("#missionEmpty").style.display = occs.length ? "none" : "";
  occs.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  occs.forEach(occ => {
    const m = occ.mission;
    const wrap = document.createElement("div");
    wrap.className = "goal";
    const completed = !!state.completions[occ.id];
    const attrs = (m.attrXP||[]).map(ax => {
      const attr = findAttr(ax.attrId);
      return attr ? `<span class="attrTag">${attr.name}: +${ax.xp} XP</span>` : "";
    }).join(" ");
    wrap.innerHTML = `
      <div class="meta">
        <div><strong>${m.title}</strong> ${completed ? "✅" : ""}</div>
        <div class="small muted">
          ${occ.date} ${fmtTime(m.time)} • ${m.recur==="once" ? "Única" : "Semanal"}
        </div>
        <div class="small" style="margin-top:6px;">
          <span class="chip">Personagem: +${m.charXP||0} XP</span>
          ${attrs}
        </div>
      </div>
      <div class="actions">
        ${completed ? `<button data-undo="${occ.id}">Desfazer</button>` : `<button data-done="${occ.id}">Concluir</button>`}
        <button data-delm="${m.id}">Excluir</button>
      </div>
    `;
    list.appendChild(wrap);
  });

  // handlers
  $$("button[data-done]").forEach(b => b.onclick = () => completeOccurrence(b.getAttribute("data-done")));
  $$("button[data-undo]").forEach(b => b.onclick = () => undoOccurrence(b.getAttribute("data-undo")));
  $$("button[data-delm]").forEach(b => b.onclick = () => {
    const id = b.getAttribute("data-delm");
    if(confirm("Excluir esta missão (todas as ocorrências futuras)?")){
      state.missions = state.missions.filter(x => x.id !== id);
      // limpeza de completions relacionadas
      Object.keys(state.completions).forEach(k => { if(k.startsWith(id+"@")) delete state.completions[k]; });
      store.save(state); renderMissions();
    }
  });
}

function missionOccurrencesInRange(missions, start, end){
  const occs = [];
  const startKey = todayKey(start);
  const endKey = todayKey(end);
  missions.forEach(m => {
    if(m.recur==="once"){
      if(m.date >= startKey && m.date <= endKey){
        occs.push({ id: `${m.id}@${m.date}`, mission:m, date:m.date, time:m.time||"00:00" });
      }
    } else if(m.recur==="weekly"){
      // gerar datas de start..end conforme weekdays
      const weekdays = m.weekdays||[]; // [0..6]
      let d = new Date(start);
      while(d <= end){
        if(weekdays.includes(d.getDay())){
          const key = todayKey(d);
          // começa a valer a partir de m.date (data de início)
          if(key >= m.date){ 
            occs.push({ id: `${m.id}@${key}`, mission:m, date:key, time:m.time||"00:00" });
          }
        }
        d = addDays(d, 1);
      }
    }
  });
  return occs;
}

function completeOccurrence(occId){
  if(state.completions[occId]) return;
  const [mId, date] = occId.split("@");
  const m = state.missions.find(x => x.id===mId);
  if(!m) return;
  // XP personagem
  grantXPCharacter(m.charXP||0);
  // XP atributos
  (m.attrXP||[]).forEach(ax => grantXPAttribute(ax.attrId, ax.xp||0));
  state.completions[occId] = true;
  store.save(state);
  renderHeader(); renderAttributes(); renderMissions();
}

function undoOccurrence(occId){
  if(!state.completions[occId]) return;
  // Para simplificar, não desfazemos XP (evita inconsistência após level-up).
  // Em uso real, poderíamos manter um log de XP para reverter. Aqui só liberamos a ocorrência.
  if(!confirm("Desfazer apenas marcar como concluída (XP já ganho será mantido). Continuar?")) return;
  delete state.completions[occId];
  store.save(state);
  renderMissions();
}

// ======= Modal Missão (criação) =======
function openModal(sel){ $(sel).classList.add("open"); }
function closeModal(sel){ $(sel).classList.remove("open"); }

$("#newMission").onclick = () => { openModal("#missionModal"); renderMissionModalAttrList(); };
$("#createMission").onclick = () => {
  const title = $("#mTitle").value.trim();
  const recur = $("#mRecur").value;
  const date = $("#mDate").value || todayKey();
  const time = $("#mTime").value || "09:00";
  const charXP = Math.max(0, parseInt($("#mXP").value||"0",10));
  if(!title) return alert("Dê um título para a missão.");
  const payload = {
    id: "m"+Math.random().toString(36).slice(2,8),
    title, recur, date, time,
    weekdays: recur==="weekly" ? selectedWeekdays() : [],
    charXP,
    attrXP: collectAttrAlloc()
  };
  state.missions.push(payload);
  store.save(state);
  $("#mTitle").value = ""; $("#mXP").value = "10"; $("#mDate").value = ""; $("#mTime").value="09:00";
  $$("#mWeekdays input[type=checkbox]").forEach(cb => cb.checked=false);
  $("#mAttrList").innerHTML = "";
  closeModal("#missionModal");
  renderMissions();
};

function selectedWeekdays(){
  return $$("#mWeekdays input[type=checkbox]:checked").map(cb => parseInt(cb.value,10));
}
function renderMissionModalAttrList(){
  const box = $("#mAttrList");
  box.innerHTML = "";
  if(state.attributes.length===0){
    box.innerHTML = `<p class="muted small">Sem atributos. Crie alguns na aba “Atributos”.</p>`;
    return;
  }
  // start with one line by default
  addAttrAllocLine();
}
$("#addAttrAlloc").onclick = addAttrAllocLine;

function addAttrAllocLine(){
  const box = $("#mAttrList");
  const line = document.createElement("div");
  line.className = "attrLine";
  const sel = document.createElement("select");
  state.attributes.forEach(a => {
    const opt = document.createElement("option");
    opt.value = a.id; opt.textContent = a.name;
    sel.appendChild(opt);
  });
  const xp = document.createElement("input");
  xp.type = "number"; xp.min = "0"; xp.value = "5";
  xp.style.width = "120px";
  const del = document.createElement("button");
  del.textContent = "–"; del.style.background = "#36132a";
  del.onclick = () => line.remove();
  line.append(sel, xp, del);
  box.appendChild(line);
}
function collectAttrAlloc(){
  return $$("#mAttrList .attrLine").map(l => {
    const attrId = $("select", l).value;
    const xp = Math.max(0, parseInt($("input", l).value||"0",10));
    return { attrId, xp };
  });
}

// ======= Filtros Missões =======
$("#range").value = "day";
$("#baseDate").valueAsDate = new Date();
$("#range").onchange = renderMissions;
$("#baseDate").onchange = renderMissions;

// ======= Modals close on backdrop =======
$$(".modal").forEach(m => m.addEventListener("click", (e)=>{ if(e.target===m) m.classList.remove("open"); }));

// ======= Inicialização =======
function init(){
  renderHeader();
  renderAttributes();
  renderMissions();
}
function toast(msg){
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position = "fixed";
  el.style.bottom = "20px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.background = "#0c1530";
  el.style.border = "1px solid #243043";
  el.style.padding = "10px 14px";
  el.style.borderRadius = "999px";
  el.style.boxShadow = "0 10px 30px #00000055";
  el.style.zIndex = "1000";
  document.body.appendChild(el);
  setTimeout(()=>{ el.remove(); }, 1800);
}

init();
