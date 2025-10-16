// ===== Utils =====
const $=(s,p=document)=>p.querySelector(s); const $$=(s,p=document)=>Array.from(p.querySelectorAll(s));
function todayKey(d=new Date()){return d.toISOString().slice(0,10)} function ymdToDate(ymd){const [y,m,d]=ymd.split('-').map(n=>+n); return new Date(y,m-1,d)}
function addDays(d,n){const x=new Date(d); x.setDate(x.getDate()+n); return x} function weekRange(base){const d=new Date(base); const day=d.getDay(); const mon=day===0?-6:1-day; const start=addDays(d,mon); return [start,addDays(start,6)]}
function monthRange(base){const d=new Date(base); return [new Date(d.getFullYear(),d.getMonth(),1), new Date(d.getFullYear(),d.getMonth()+1,0)]} function fmtTime(t){return t||""}
function fmtMonthTitle(date){return date.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}

// ===== Persistência =====
const store={load(){const raw=localStorage.getItem("metaxp4"); if(!raw) return {
  character:{name:"Aventureiro",level:1,xp:0,next:100,baseNext:100},
  attributes:[], missions:[], completions:{}, xpLog:[],
  gold:0, achievementsAwarded:{}, // chave => true
  rewards:[], rewardsHistory:[]   // {id,name,cost} / {date,name,cost}
}; return JSON.parse(raw)}, save(d){localStorage.setItem("metaxp4",JSON.stringify(d))}}; let state=store.load()

// ===== XP, Ouro e Streak =====
function diffMul(d){ if(d==='hard') return 2; if(d==='medium') return 1.5; return 1; }
function diffLabel(d){ return d==='hard'?'Difícil': (d==='medium'?'Média':'Fácil'); }

function nextRequirement(prev){return Math.max(10,Math.round(prev*1.10))}
function grantXPCharacter(xp){ let c=state.character; c.xp+=xp; let leveled=false; while(c.xp>=c.next){ c.xp-=c.next; c.level+=1; c.next=nextRequirement(c.next); leveled=true; awardGold("level:"+c.level, 10, `Nível ${c.level}`) } if(leveled) toast(`🎉 Subiu para o nível ${c.level}! +10 🪙`) }
function findAttr(id){return state.attributes.find(a=>a.id===id)} function grantXPAttribute(id,xp){const a=findAttr(id); if(!a) return; a.xp+=xp; while(a.xp>=a.next){a.xp-=a.next; a.level+=1; a.next=nextRequirement(a.next)}}
function streakBonus(s, d){
  let base = 0; if(s>=30) base=10; else if(s>=7) base=5; else if(s>=3) base=2; else base=0;
  const mul = diffMul(d||'easy');
  return Math.round(base * mul);
}
function prevOccurrenceDate(m,dateKey){ if(m.recur==="once")return null; const d=ymdToDate(dateKey); for(let i=1;i<=28;i++){ const prev=addDays(d,-i); const k=todayKey(prev); if(k<m.date)break; if(m.recur==="weekly"){ const wd=prev.getDay(); if((m.weekdays||[]).includes(wd)) return k } } return null }

// ===== UI Header =====
function renderHeader(){ $("#charNameView").textContent=state.character.name; $("#charLevel").textContent=state.character.level; $("#charXP").textContent=state.character.xp; $("#charNext").textContent=state.character.next; const pct=Math.min(100,Math.round(100*state.character.xp/state.character.next)); $("#charXPFill").style.width=pct+"%"; $("#goldBalance").textContent=state.gold }

// ===== Tabs =====
$$(".tab").forEach(t=>t.addEventListener("click",()=>{ $$(".tab").forEach(x=>x.classList.remove("active")); t.classList.add("active"); const n=t.dataset.tab;
  $("#tab-missoes").style.display=n==="missoes"?"":"none"; $("#tab-atributos").style.display=n==="atributos"?"":"none"; $("#tab-conquistas").style.display=n==="conquistas"?"":"none";
  $("#tab-calendario").style.display=n==="calendario"?"":"none"; $("#tab-rewards").style.display=n==="rewards"?"":"none"; $("#tab-config").style.display=n==="config"?"":"none";
}));

// ===== Personagem =====
$("#editCharBtn").onclick=()=>{ $("#charName").value=state.character.name; $("#baseNext").value=state.character.baseNext||100; openModal("#charModal") }
$("#charSave").onclick=()=>{ const name=$("#charName").value.trim()||"Aventureiro"; const baseNext=Math.max(10,parseInt($("#baseNext").value||"100",10)); state.character.name=name; state.character.baseNext=baseNext; if(state.character.level===1) state.character.next=baseNext; store.save(state); renderHeader(); closeModal("#charModal") }

// ===== Atributos =====
function renderAttributes(){ const wrap=$("#attrList"); wrap.innerHTML=""; if(state.attributes.length===0){$("#attrEmpty").style.display=""; return} $("#attrEmpty").style.display="none";
  const attrs=[...state.attributes].sort((a,b)=>b.level-a.level|| (b.xp/b.next)-(a.xp/a.next));
  attrs.forEach(a=>{ const pct=Math.round(100*a.xp/a.next); const card=document.createElement("div"); card.className="card";
    card.innerHTML=`<div class="row" style="align-items:center;"><div style="flex:1;"><div style="font-weight:900;">${a.name}</div><div class="small muted">Nv. ${a.level} — ${a.xp}/${a.next} XP</div><div class="xpbar small" style="margin-top:6px;"><div class="bar"><div class="fill" style="width:${pct}%"></div></div></div></div><button class="chip wood" data-del="${a.id}">Excluir</button></div>`;
    wrap.appendChild(card) });
  $$("button[data-del]").forEach(b=>b.onclick=()=>{ const id=b.getAttribute("data-del"); if(confirm("Excluir atributo? Missões que o usam perderão essa referência.")){ state.attributes=state.attributes.filter(x=>x.id!==id); state.missions.forEach(m=>m.attrXP=(m.attrXP||[]).filter(ax=>ax.attrId!==id)); store.save(state); renderAttributes(); renderMissionModalAttrList() } })
}
$("#addAttr").onclick=()=>{ const name=$("#newAttrName").value.trim(); if(!name) return alert("Dê um nome ao atributo."); const id="a"+Math.random().toString(36).slice(2,8); state.attributes.push({id,name,level:1,xp:0,next:100}); $("#newAttrName").value=""; store.save(state); renderAttributes(); renderMissionModalAttrList() }

// ===== Missões =====
function missionOccurrencesInRange(missions,start,end){ const occs=[]; const sK=todayKey(start), eK=todayKey(end); missions.forEach(m=>{
  if(m.recur==="once"){ if(m.date>=sK && m.date<=eK) occs.push({id:`${m.id}@${m.date}`,mission:m,date:m.date,time:m.time||"00:00"}) }
  else if(m.recur==="weekly"){ const w=m.weekdays||[]; let d=new Date(start); while(d<=end){ if(w.includes(d.getDay())){ const k=todayKey(d); if(k>=m.date) occs.push({id:`${m.id}@${k}`,mission:m,date:k,time:m.time||"00:00"}) } d=addDays(d,1) } }
}); return occs }
function renderMissions(){ const list=$("#missionList"); list.innerHTML=""; const base=$("#baseDate").value? ymdToDate($("#baseDate").value): new Date(); const mode=$("#range").value; let start,end;
  if(mode==="day"){start=base; end=base} if(mode==="week"){[start,end]=weekRange(base)} if(mode==="month"){[start,end]=monthRange(base)}
  const occs=missionOccurrencesInRange(state.missions,start,end).sort((a,b)=>a.date.localeCompare(b.date)||a.time.localeCompare(b.time)); $("#missionEmpty").style.display=occs.length?"none":"";
  occs.forEach(occ=>{ const m=occ.mission; const completed=!!state.completions[occ.id]; const attrs=(m.attrXP||[]).map(ax=>{const attr=findAttr(ax.attrId); return attr? `<span class="attrTag">${attr.name}: +${ax.xp} XP</span>`:""}).join(" ");
    const wrap=document.createElement("div"); wrap.className="goal"; wrap.innerHTML=`<div class="meta"><div><strong>🗡️ ${m.title}</strong> ${completed?"✅":""} <span class="chip">🔥 x${m.streak||0}</span></div><div class="small muted">${occ.date} ${fmtTime(m.time)} • ${m.recur==="once"?"Única":"Semanal"}</div><div class="small" style="margin-top:6px;"><span class="chip">Dificuldade: ${diffLabel(m.difficulty||"easy")}</span><span class="chip">Mult.: x${diffMul(m.difficulty||"easy")}</span><span class="chip">Personagem: ~+${Math.round((m.charXP||0)*diffMul(m.difficulty||"easy"))} XP</span><span class="chip">Bônus streak: +${streakBonus(m.streak||0, m.difficulty||"easy")} XP</span>${attrs}</div></div><div class="actions">${completed? `<button data-undo="${occ.id}" class="wood">Desfazer</button>`:`<button data-done="${occ.id}" class="wood">Concluir</button>`}<button data-delm="${m.id}" class="wood" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button></div>`;
    list.appendChild(wrap) });
  $$("button[data-done]").forEach(b=>b.onclick=()=>completeOccurrence(b.getAttribute("data-done")));
  $$("button[data-undo]").forEach(b=>b.onclick=()=>undoOccurrence(b.getAttribute("data-undo")));
  $$("button[data-delm]").forEach(b=>b.onclick=()=>{ const id=b.getAttribute("data-delm"); if(confirm("Excluir esta missão (todas as ocorrências futuras)?")){ state.missions=state.missions.filter(x=>x.id!==id); Object.keys(state.completions).forEach(k=>{if(k.startsWith(id+'@')) delete state.completions[k]}); store.save(state); renderMissions(); renderCalendar(); renderAchievements(); renderStats() } })
}
function completeOccurrence(occId){ if(state.completions[occId]) return; const [mId,date]=occId.split("@"); const m=state.missions.find(x=>x.id===mId); if(!m) return;
  const prevKey=prevOccurrenceDate(m,date); if(prevKey && state.completions[`${m.id}@${prevKey}`]) m.streak=(m.streak||0)+1; else m.streak=1; m.lastDone=date;
  awardStreakGold(m); const mul = diffMul(m.difficulty||'easy');
const bonus = streakBonus(m.streak||0, m.difficulty||'easy');
const charXP = Math.round((m.charXP||0)*mul) + bonus; grantXPCharacter(charXP); (m.attrXP||[]).forEach(ax=>grantXPAttribute(ax.attrId, Math.round((ax.xp||0)* (diffMul(m.difficulty||'easy')) )));
  state.completions[occId]=true; state.xpLog.push({date, charXP, missionId:m.id}); store.save(state);
  renderHeader(); renderAttributes(); renderMissions(); renderCalendar(); renderAchievements(); renderStats()
}
function undoOccurrence(occId){ if(!state.completions[occId]) return; if(!confirm("Isso apenas desmarca a conclusão. O XP e ouro já concedidos permanecem. Continuar?")) return; delete state.completions[occId]; store.save(state); renderMissions(); renderCalendar(); renderAchievements(); renderStats() }

// ===== Conquistas & Ouro =====
function awardGold(key, amount, reason){ if(state.achievementsAwarded[key]) return; state.achievementsAwarded[key]=true; state.gold += amount; toast(`🪙 +${amount} ouro — ${reason}`); }
function awardStreakGold(m){ m.streakAwards = m.streakAwards || {}; const steps=[{s:3,g:2},{s:7,g:5},{s:30,g:15}];
  for(const step of steps){ if(m.streak>=step.s && !m.streakAwards[step.s]){ m.streakAwards[step.s]=true; awardGold(`streak:${m.id}:${step.s}`, step.g, `Streak ${step.s}+ em "${m.title}"`) } } store.save(state); renderHeader() }
function renderAchievements(){ const box=$("#achList"); box.innerHTML=""; const ach=computeAchievements(); if(ach.length===0){$("#achEmpty").style.display=""; return} $("#achEmpty").style.display="none";
  ach.forEach(a=>{ const card=document.createElement("div"); card.className="card"; const got = !!state.achievementsAwarded[a.key]; card.innerHTML=`<div class="row" style="align-items:center;"><div style="flex:1;"><div style="font-weight:900;"><span class="trophy">🏆</span>${a.title}</div><div class="muted small">${a.desc}</div></div><span class="chip">${got? "Obtida":"Pendente"}</span></div>`; box.appendChild(card) })
}
function computeAchievements(){
  const out=[]; const total=Object.keys(state.completions).length;
  out.push({key:"first", title:"Primeiro Passo", desc:"Conclua sua primeira missão."});
  out.push({key:"ten", title:"Dez Missões", desc:"Conclua 10 missões."});
  out.push({key:"fifty", title:"Cinquenta Missões", desc:"Conclua 50 missões."});
  if(total>=1) awardGold("first", 2, "Primeira missão");
  if(total>=10) awardGold("ten", 5, "Dez missões");
  if(total>=50) awardGold("fifty", 15, "Cinquenta missões");
  // níveis já premiados em grantXPCharacter
  // streaks já premiadas em awardStreakGold
  return out;
}

// ===== Calendário & Stats =====
let calCursor=new Date()
function renderCalendar(){ $("#calMonthTitle").textContent=fmtMonthTitle(calCursor); const grid=$("#calendarGrid"); grid.innerHTML=""; const y=calCursor.getFullYear(), m=calCursor.getMonth(); const first=new Date(y,m,1); const start=first.getDay(); const days=new Date(y,m+1,0).getDate();
  for(let i=0;i<start;i++){const d=document.createElement("div"); d.className="calcell"; grid.appendChild(d)}
  for(let day=1;day<=days;day++){ const key=todayKey(new Date(y,m,day)); const count=state.xpLog.filter(x=>x.date===key).length; const cell=document.createElement("div"); cell.className="calcell"; cell.innerHTML=`<div class="daynum">${String(day).padStart(2,'0')}</div><div class="calmark">${count>0? "✅×"+count:""}</div>`; grid.appendChild(cell) }
}
$("#prevMonth").onclick=()=>{ calCursor=new Date(calCursor.getFullYear(),calCursor.getMonth()-1,1); renderCalendar() }
$("#nextMonth").onclick=()=>{ calCursor=new Date(calCursor.getFullYear(),calCursor.getMonth()+1,1); renderCalendar() }
function renderStats(){ const today=todayKey(); const [ws,we]=weekRange(new Date()); const inWeek=state.xpLog.filter(x=>{const d=ymdToDate(x.date); return d>=ws && d<=we}); const todayXP=state.xpLog.filter(x=>x.date===today).reduce((s,x)=>s+x.charXP,0); const weekXP=inWeek.reduce((s,x)=>s+x.charXP,0); $("#xpToday").textContent=todayXP; $("#xpWeek").textContent=weekXP; const streakOfDay=state.missions.filter(m=>(m.lastDone===today)&&(m.streak||0)>=2).length; $("#streakOfDay").textContent=streakOfDay }

// ===== Recompensas (ouro) =====
function renderRewards(){ const list=$("#rewardList"); list.innerHTML=""; if(state.rewards.length===0){$("#rewardEmpty").style.display="";} else {$("#rewardEmpty").style.display="none";}
  state.rewards.forEach(r=>{ const row=document.createElement("div"); row.className="reward"; row.innerHTML=`<div class="meta"><div><strong>${r.name}</strong></div><div class="small muted">Custa ${r.cost} 🪙</div></div><div class="actions"><button class="wood" data-buy="${r.id}">Comprar</button><button class="wood" data-delr="${r.id}" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button></div>`; list.appendChild(row) });
  $$("button[data-buy]").forEach(b=>b.onclick=()=>{ const id=b.getAttribute("data-buy"); const r=state.rewards.find(x=>x.id===id); if(!r) return; if(state.gold<r.cost) return alert("Ouro insuficiente."); state.gold -= r.cost; state.rewardsHistory.unshift({date:todayKey(), name:r.name, cost:r.cost}); store.save(state); renderHeader(); renderRewards(); renderRewardHistory(); toast(`Você comprou "${r.name}" por ${r.cost} 🪙`) });
  $$("button[data-delr]").forEach(b=>b.onclick=()=>{ const id=b.getAttribute("data-delr"); if(confirm("Excluir esta recompensa?")){ state.rewards=state.rewards.filter(x=>x.id!==id); store.save(state); renderRewards() } })
}
$("#addReward").onclick=()=>{ const name=$("#rewardName").value.trim(); const cost=Math.max(1, parseInt($("#rewardCost").value||"1",10)); if(!name) return alert("Dê um nome para a recompensa."); const id="r"+Math.random().toString(36).slice(2,8); state.rewards.push({id,name,cost}); $("#rewardName").value=""; $("#rewardCost").value="50"; store.save(state); renderRewards() }
function renderRewardHistory(){ const box=$("#rewardHistory"); const empty=$("#rewardHistoryEmpty"); box.innerHTML=""; if(state.rewardsHistory.length===0){ empty.style.display=""; return } empty.style.display="none"; state.rewardsHistory.forEach(h=>{ const row=document.createElement("div"); row.className="row"; row.innerHTML=`<span class="chip">${h.date}</span><span>${h.name}</span><span class="chip">-${h.cost} 🪙</span>`; box.appendChild(row) }) }

// ===== Modais & Diversos =====
function openModal(s){$(s).classList.add("open")} function closeModal(s){$(s).classList.remove("open")}
$("#newMission").onclick=()=>{ openModal("#missionModal"); renderMissionModalAttrList() }
$("#createMission").onclick=()=>{ const title=$("#mTitle").value.trim(); if(!title) return alert("Dê um título para a missão."); const recur=$("#mRecur").value; const date=$("#mDate").value||todayKey(); const time=$("#mTime").value||"07:00"; const charXP=Math.max(0,parseInt($("#mXP").value||"0",10)); const payload={id:"m"+Math.random().toString(36).slice(2,8), title,recur,date,time, difficulty:($('#mDiff')? $('#mDiff').value : 'easy'), weekdays:recur==="weekly"?selectedWeekdays():[], charXP, attrXP:collectAttrAlloc(), streak:0, lastDone:null}; state.missions.push(payload); store.save(state); $("#mTitle").value=""; $("#mXP").value="10"; $("#mDate").value=""; $("#mTime").value="07:00"; $$("#mWeekdays input[type=checkbox]").forEach(cb=>cb.checked=false); $("#mAttrList").innerHTML=""; closeModal("#missionModal"); renderMissions(); renderCalendar() }
function selectedWeekdays(){return $$("#mWeekdays input[type=checkbox]:checked").map(cb=>parseInt(cb.value,10))}
function renderMissionModalAttrList(){ const box=$("#mAttrList"); box.innerHTML=""; if(state.attributes.length===0){ box.innerHTML=`<p class="muted small">Sem atributos. Crie alguns na aba “Atributos”.</p>`; return } addAttrAllocLine() }
$("#addAttrAlloc").onclick=addAttrAllocLine
function addAttrAllocLine(){ const box=$("#mAttrList"); const line=document.createElement("div"); line.className="attrLine"; const sel=document.createElement("select"); state.attributes.forEach(a=>{const o=document.createElement("option"); o.value=a.id; o.textContent=a.name; sel.appendChild(o)}); const xp=document.createElement("input"); xp.type="number"; xp.min="0"; xp.value="5"; xp.style.width="120px"; const del=document.createElement("button"); del.textContent="–"; del.className="wood"; del.onclick=()=>line.remove(); line.append(sel,xp,del); box.appendChild(line) }
function collectAttrAlloc(){ return $$("#mAttrList .attrLine").map(l=>({attrId:$("select",l).value, xp:Math.max(0,parseInt($("input",l).value||"0",10))})) }

// ===== Exportar / Importar =====
$("#exportBtn").onclick=()=>{ const data=JSON.stringify(state,null,2); const blob=new Blob([data],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="metaxp_ouro_backup.json"; a.click(); URL.revokeObjectURL(url) }
$("#importFile").onchange=(e)=>{ const file=e.target.files[0]; if(!file) return; const reader=new FileReader(); reader.onload=()=>{ try{ const obj=JSON.parse(reader.result); state=obj; store.save(state); renderAll(); alert("Importação concluída!") }catch(err){ alert("Arquivo inválido.") } }; reader.readAsText(file) }

// ===== UI Aux =====
function toast(msg){ const el=document.createElement("div"); el.textContent=msg; el.style.position="fixed"; el.style.bottom="20px"; el.style.left="50%"; el.style.transform="translateX(-50%)"; el.style.background="#14100b"; el.style.border="1px solid #2a2217"; el.style.padding="10px 14px"; el.style.borderRadius="999px"; el.style.boxShadow="0 10px 30px #00000055"; el.style.zIndex="1000"; document.body.appendChild(el); setTimeout(()=>{el.remove()},1800) }

// ===== Stats & Filtros =====
$("#range").value="day"; $("#baseDate").valueAsDate=new Date(); $("#range").onchange=renderMissions; $("#baseDate").onchange=renderMissions
$$(".modal").forEach(m=>m.addEventListener("click",(e)=>{ if(e.target===m) m.classList.remove("open") }))
function renderStats(){ const today=todayKey(); const [ws,we]=weekRange(new Date()); const inWeek=state.xpLog.filter(x=>{const d=ymdToDate(x.date); return d>=ws && d<=we}); const todayXP=state.xpLog.filter(x=>x.date===today).reduce((s,x)=>s+x.charXP,0); const weekXP=inWeek.reduce((s,x)=>s+x.charXP,0); $("#xpToday").textContent=todayXP; $("#xpWeek").textContent=weekXP; const streakOfDay=state.missions.filter(m=>(m.lastDone===today)&&(m.streak||0)>=2).length; $("#streakOfDay").textContent=streakOfDay }

// ===== Achievements render trigger =====
function renderAll(){ renderHeader(); renderAttributes(); renderMissions(); renderCalendar(); renderAchievements(); renderStats(); renderRewards(); renderRewardHistory() }
renderAll()
