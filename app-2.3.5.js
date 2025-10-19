/* Meta XP — app.js 2.3.5
   - Missões (única/semanal) com dificuldade (x1/x1.5/x2)
   - Streak e bônus de streak
   - Atributos com nível/XP progressivo (+10% por nível) + ÍCONE selecionável (grade no modal)
   - Conquistas com ouro visível e concessão automática
   - Recompensas (comprar com ouro) + histórico
   - Calendário de conclusões
   - Exportar/Importar JSON
   - Temas: medieval (padrão), pink, minimal (sem ícones)
   - Sobrevivência: sono & água com metas e XP
   - Avatar do personagem (galeria no modal)
*/

/////////////////////////////
// Helpers
/////////////////////////////
var $  = function (s, p){ return (p||document).querySelector(s); };
var $$ = function (s, p){ return Array.from((p||document).querySelectorAll(s)); };
function todayKey(d){ if(!d) d=new Date(); return d.toISOString().slice(0,10); }
function ymdToDate(ymd){ var a=ymd.split('-'); return new Date(+a[0], +a[1]-1, +a[2]); }
function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
function weekRange(base){
  var d=new Date(base), day=d.getDay(), mon=(day===0?-6:1-day), start=addDays(d,mon);
  return [start, addDays(start,6)];
}
function monthRange(base){
  var d=new Date(base);
  return [ new Date(d.getFullYear(), d.getMonth(), 1),
           new Date(d.getFullYear(), d.getMonth()+1, 0) ];
}
function fmtMonthTitle(date){ return date.toLocaleDateString('pt-BR',{month:'long', year:'numeric'}); }

/////////////////////////////
// Persistência
/////////////////////////////
var store = {
  key: "metaxp6",
  load: function(){
    var raw = localStorage.getItem(this.key);
    if(!raw){
      return {
        character:{name:"Aventureiro", level:1, xp:0, next:100, baseNext:100, avatar:null},
        attributes:[],
        missions:[],
        completions:{},
        xpLog:[],
        gold:0,
        achievementsAwarded:{},
        rewards:[],
        rewardsHistory:[],
        survival:{},
        theme: localStorage.getItem('metaxp_theme') || 'medieval'
      };
    }
    try{
      var obj=JSON.parse(raw);
      obj.character = obj.character || {name:"Aventureiro", level:1, xp:0, next:100, baseNext:100, avatar:null};
      if (typeof obj.character.avatar === "undefined") obj.character.avatar=null;
      obj.survival = obj.survival || {};
      obj.theme = obj.theme || localStorage.getItem('metaxp_theme') || 'medieval';
      obj.attributes = obj.attributes || [];
      obj.missions = obj.missions || [];
      obj.completions = obj.completions || {};
      obj.xpLog = obj.xpLog || [];
      obj.gold = obj.gold || 0;
      obj.achievementsAwarded = obj.achievementsAwarded || {};
      obj.rewards = obj.rewards || [];
      obj.rewardsHistory = obj.rewardsHistory || [];
      return obj;
    }catch(e){
      return {
        character:{name:"Aventureiro", level:1, xp:0, next:100, baseNext:100, avatar:null},
        attributes:[], missions:[], completions:{}, xpLog:[],
        gold:0, achievementsAwarded:{}, rewards:[], rewardsHistory:[],
        survival:{}, theme:'medieval'
      };
    }
  },
  save: function(d){ localStorage.setItem(this.key, JSON.stringify(d)); }
};
var state = store.load();

// atributo Saúde garantido
function ensureHealthAttribute(){
  var exists = (state.attributes||[]).some(function(a){ return (a.name||"").toLowerCase()==='saúde' || a.id==='health'; });
  if(!exists){
    state.attributes.push({ id:'health', name:'Saúde', level:1, xp:0, next:100 });
    store.save(state);
  }
}
ensureHealthAttribute();

/////////////////////////////
// Progressão / Dificuldade
/////////////////////////////
function nextRequirement(prev){ return Math.max(10, Math.round(prev*1.10)); }
function diffMul(d){ if(d==='hard') return 2; if(d==='medium') return 1.5; return 1; }
function diffLabel(d){ return d==='hard'?'Difícil' : (d==='medium'?'Média':'Fácil'); }
function findAttr(id){ return state.attributes.find(function(a){ return a.id===id; }); }

function grantXPCharacter(xp){
  var c=state.character, leveled=false;
  c.xp += xp;
  while(c.xp >= c.next){
    c.xp -= c.next;
    c.level += 1;
    c.next = nextRequirement(c.next);
    leveled = true;
    awardGold("level:"+c.level, 10, "Nível "+c.level);
  }
  if(leveled) toast("🎉 Subiu para o nível "+c.level+"! +10 🪙");
}
function grantXPAttribute(id,xp){
  var a=findAttr(id); if(!a) return;
  a.xp += xp;
  while(a.xp >= a.next){
    a.xp -= a.next;
    a.level += 1;
    a.next = nextRequirement(a.next);
  }
}
function streakBonus(s,d){
  var base=0;
  if(s>=30) base=10; else if(s>=7) base=5; else if(s>=3) base=2;
  var mul=diffMul(d||'easy');
  return Math.round(base*mul);
}
function prevOccurrenceDate(m,dateKey){
  if(m.recur==="once") return null;
  var d = ymdToDate(dateKey);
  for(var i=1;i<=28;i++){
    var prev = addDays(d,-i), k=todayKey(prev);
    if(k < m.date) break;
    if(m.recur==="weekly"){
      var wd=prev.getDay();
      if((m.weekdays||[]).indexOf(wd)>=0) return k;
    }
  }
  return null;
}

/////////////////////////////
// Header
/////////////////////////////
function renderHeader(){
  var nameEl = $("#charNameView");
  var lvlEl  = $("#charLevel");
  var xpEl   = $("#charXP");
  var nextEl = $("#charNext");
  var fillEl = $("#charXPFill");
  var goldEl = $("#goldBalance");
  if(nameEl) nameEl.textContent = state.character.name;
  if(lvlEl)  lvlEl.textContent  = state.character.level;
  if(xpEl)   xpEl.textContent   = state.character.xp;
  if(nextEl) nextEl.textContent = state.character.next;
  if(fillEl) fillEl.style.width = Math.min(100, Math.round(100*state.character.xp/state.character.next))+"%";
  if(goldEl) goldEl.textContent = state.gold;

  // avatar no header
  var avatarImg = $("#charAvatar") || $("#charAvatarImg");
  if(avatarImg){
    if(state.character.avatar){
      avatarImg.src = state.character.avatar;
      avatarImg.style.display = "";
    }else{
      avatarImg.style.display = "none";
    }
  }
}

/////////////////////////////
// Tabs
/////////////////////////////
$$(".tab").forEach(function(t){
  t.addEventListener("click", function(){
    $$(".tab").forEach(function(x){ x.classList.remove("active"); });
    t.classList.add("active");
    var n=t.dataset.tab;
    var map = {
      missoes:"#tab-missoes",
      atributos:"#tab-atributos",
      conquistas:"#tab-conquistas",
      calendario:"#tab-calendario",
      rewards:"#tab-rewards",
      survival:"#tab-survival",
      config:"#tab-config"
    };
    Object.keys(map).forEach(function(k){
      var el=$(map[k]); if(!el) return;
      el.style.display = (n===k) ? "" : "none";
    });
  });
});

/////////////////////////////
// Modal Personagem (avatar)
/////////////////////////////
function openModal(s){ var m=$(s); if(m) m.classList.add("open"); }
function closeModal(s){ var m=$(s); if(m) m.classList.remove("open"); }

var btnEdit=$("#editCharBtn");
if(btnEdit){
  btnEdit.onclick=function(){
    var n=$("#charName"), b=$("#baseNext");
    if(n) n.value = state.character.name || "Aventureiro";
    if(b) b.value = state.character.baseNext || 100;

    // avatares (opcional; se tiver pasta /avatars)
    var box=$("#avatarPicker"), prev=$("#charAvatarPreview");
    if(box){
      box.innerHTML="";
      var count=20, paths=[];
      for(var i=1;i<=count;i++) paths.push("avatars/"+String(i).padStart(3,"0")+".png");
      if(prev){
        prev.style.display = state.character.avatar ? "" : "none";
        if(state.character.avatar) prev.src = state.character.avatar;
        prev.style.width="64px"; prev.style.height="64px";
        prev.style.borderRadius="8px"; prev.style.border="2px solid var(--accent)";
      }
      box.style.display="flex"; box.style.flexWrap="wrap"; box.style.gap="8px"; box.style.margin="8px 0";

      paths.forEach(function(path){
        var img=document.createElement("img");
        img.src=path; img.alt="avatar";
        img.style.width="48px"; img.style.height="48px";
        img.style.borderRadius="8px"; img.style.cursor="pointer";
        img.style.border="2px solid transparent";
        if(state.character.avatar===path) img.style.border="2px solid var(--accent)";
        img.onerror=function(){ img.remove(); };
        img.addEventListener("click", function(){
          state.character.avatar = path;
          if(prev){ prev.src=path; prev.style.display=""; }
          store.save(state); renderHeader();
          Array.from(box.querySelectorAll("img")).forEach(function(el){ el.style.border="2px solid transparent"; });
          img.style.border="2px solid var(--accent)";
        });
        box.appendChild(img);
      });
    }
    openModal("#charModal");
  };
}
var btnCharSave=$("#charSave");
if(btnCharSave){
  btnCharSave.onclick=function(){
    var name=(( $("#charName") && $("#charName").value )||"").trim() || "Aventureiro";
    var baseNext=Math.max(10, parseInt( ($("#baseNext") && $("#baseNext").value) || "100",10 ));
    state.character.name=name;
    state.character.baseNext=baseNext;
    if(state.character.level===1) state.character.next=baseNext;
    store.save(state); renderHeader(); closeModal("#charModal");
  };
}

/////////////////////////////
// Atributos (com ÍCONE)
/////////////////////////////
var selectedAttrIconPath = null;   // seleção atual do modal

function buildAttrIconGrid(){
  var box = $("#attrIconGrid");
  if(!box) return;

  selectedAttrIconPath = null;
  box.innerHTML="";
  var TOTAL=350;            // ajuste se tiver outro total
  var BASE="icons/attributes/";

  // layout
  box.style.display="grid";
  box.style.gridTemplateColumns="repeat(auto-fill, minmax(64px, 1fr))";
  box.style.gap="10px";
  box.style.maxHeight="50vh";
  box.style.overflow="auto";

  function clearSelection(){
    box.querySelectorAll("img[data-attr-icon]").forEach(function(img){
      img.style.outline="none"; img.style.boxShadow="none";
    });
  }

  for(var i=1;i<=TOTAL;i++){
    var n=String(i).padStart(3,"0"), src=BASE+n+".png";
    var img=document.createElement("img");
    img.setAttribute("data-attr-icon", n);
    img.src=src; img.alt="Ícone "+n;
    img.style.width="64px"; img.style.height="64px";
    img.style.objectFit="contain";
    img.style.background="#0e0b08";
    img.style.border="1px solid #2a2217";
    img.style.borderRadius="10px";
    img.style.cursor="pointer";
    img.style.transition="transform .06s ease";
    img.onerror=(function(el){ return function(){ el.remove(); }; })(img);
    img.addEventListener("mouseenter", (function(el){ return function(){ el.style.transform="scale(1.03)"; }; })(img));
    img.addEventListener("mouseleave", (function(el){ return function(){ el.style.transform="scale(1)"; }; })(img));
    img.addEventListener("click", (function(el, path){
      return function(){
        selectedAttrIconPath = path;
        clearSelection();
        el.style.outline="2px solid var(--accent)";
        el.style.boxShadow="0 0 0 2px #000 inset";
        var prev=$("#attrIconPreview");
        if(prev){ prev.src=path; prev.style.display=""; }
      };
    })(img, src));
    box.appendChild(img);
  }
}

// abrir modal de novo atributo (mesmo modal existente)
var btnNewAttrWithIcon = $("#btnNewAttrWithIcon") || $("#btnNewAttr");
if(btnNewAttrWithIcon){
  btnNewAttrWithIcon.addEventListener("click", function(){
    openModal("#attrNewModal");
    buildAttrIconGrid();
  });
}

// criar atributo com ícone (um único fluxo)
var btnCreateAttr = $("#createAttrWithIcon") || $("#addAttr");
if(btnCreateAttr){
  btnCreateAttr.addEventListener("click", function(){
    var name = ( ($("#newAttrNameWithIcon") && $("#newAttrNameWithIcon").value) || ($("#newAttrName") && $("#newAttrName").value) || "" ).trim();
    if(!name){ alert("Dê um nome ao atributo."); return; }
    var id = "a"+Math.random().toString(36).slice(2,8);
    state.attributes.push({ id:id, name:name, level:1, xp:0, next:100, icon:(selectedAttrIconPath||null) });
    try{ if($("#newAttrNameWithIcon")) $("#newAttrNameWithIcon").value=""; }catch(e){}
    try{ if($("#newAttrName")) $("#newAttrName").value=""; }catch(e){}
    store.save(state); renderAttributes(); closeModal("#attrNewModal");
  });
}

function renderAttributes(){
  var wrap=$("#attrList"); if(!wrap) return;
  wrap.innerHTML="";
  if(state.attributes.length===0){ if($("#attrEmpty")) $("#attrEmpty").style.display=""; return; }
  if($("#attrEmpty")) $("#attrEmpty").style.display="none";

  var attrs = state.attributes.slice().sort(function(a,b){
    return (b.level-a.level) || ((b.xp/b.next)-(a.xp/a.next));
  });

  attrs.forEach(function(a){
    var pct=Math.round(100*a.xp/a.next);
    var card=document.createElement("div");
    card.className="card";

    var iconHTML = a.icon ? ('<img src="'+a.icon+'" alt="" style="width:24px;height:24px;object-fit:contain;border-radius:6px;background:#0e0b08;border:1px solid #2a2217;">') : '';

    card.innerHTML =
      '<div class="row" style="align-items:center;">' +
        '<div style="flex:1; display:flex; align-items:center; gap:10px;">' +
          (iconHTML) +
          '<div>' +
            '<div style="font-weight:900;">'+a.name+'</div>' +
            '<div class="small muted">Nv. '+a.level+' — '+a.xp+'/'+a.next+' XP</div>' +
            '<div class="xpbar small" style="margin-top:6px;">' +
              '<div class="bar"><div class="fill" style="width:'+pct+'%"></div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="chip wood" data-del="'+a.id+'">Excluir</button>' +
      '</div>';

    wrap.appendChild(card);
  });

  $$("button[data-del]").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-del");
      if(confirm("Excluir atributo? Missões que o usam perderão essa referência.")){
        state.attributes = state.attributes.filter(function(x){ return x.id!==id; });
        state.missions.forEach(function(m){
          m.attrXP = (m.attrXP||[]).filter(function(ax){ return ax.attrId!==id; });
        });
        store.save(state); renderAttributes(); renderMissionModalAttrList();
      }
    };
  });
}

/////////////////////////////
// Missões
/////////////////////////////
function missionOccurrencesInRange(missions,start,end){
  var occs=[], sK=todayKey(start), eK=todayKey(end);
  missions.forEach(function(m){
    if(m.recur==="once"){
      if(m.date>=sK && m.date<=eK) occs.push({id:(m.id+"@"+m.date), mission:m, date:m.date, time:m.time||"00:00"});
    }else if(m.recur==="weekly"){
      var w=m.weekdays||[], d=new Date(start);
      while(d<=end){
        if(w.indexOf(d.getDay())>=0){
          var k=todayKey(d);
          if(k>=m.date) occs.push({id:(m.id+"@"+k), mission:m, date:k, time:m.time||"00:00"});
        }
        d=addDays(d,1);
      }
    }
  });
  return occs;
}
function renderMissions(){
  var list=$("#missionList"); if(!list) return;
  list.innerHTML="";
  var base = ($("#baseDate") && $("#baseDate").value) ? ymdToDate($("#baseDate").value) : new Date();
  var mode = ($("#range") && $("#range").value) || "day";
  var start,end;
  if(mode==="day"){ start=base; end=base; }
  if(mode==="week"){ var r=weekRange(base); start=r[0]; end=r[1]; }
  if(mode==="month"){ var r2=monthRange(base); start=r2[0]; end=r2[1]; }

  var occs = missionOccurrencesInRange(state.missions,start,end)
    .sort(function(a,b){ return a.date.localeCompare(b.date) || a.time.localeCompare(b.time); });

  if($("#missionEmpty")) $("#missionEmpty").style.display = occs.length? "none": "";

  occs.forEach(function(occ){
    var m=occ.mission, completed=!!state.completions[occ.id];
    var attrs=(m.attrXP||[]).map(function(ax){
      var attr=findAttr(ax.attrId);
      return attr ? ('<span class="attrTag">'+attr.name+': +'+Math.round((ax.xp||0)*diffMul(m.difficulty||'easy'))+' XP</span>') : "";
    }).join(" ");

    var wrap=document.createElement("div");
    wrap.className="goal";
    wrap.innerHTML =
      '<div class="meta">' +
        '<div><strong>🗡️ '+m.title+'</strong> '+(completed?"✅":"")+' <span class="chip">🔥 x'+(m.streak||0)+'</span></div>' +
        '<div class="small muted">'+occ.date+' '+(m.time||"00:00")+' • '+(m.recur==="once"?"Única":"Semanal")+'</div>' +
        '<div class="small" style="margin-top:6px;">' +
          '<span class="chip">Dificuldade: '+diffLabel(m.difficulty||"easy")+'</span>' +
          '<span class="chip">Mult.: x'+diffMul(m.difficulty||"easy")+'</span>' +
          '<span class="chip">Personagem: ~+'+Math.round((m.charXP||0)*diffMul(m.difficulty||"easy"))+' XP</span>' +
          '<span class="chip">Bônus streak: +'+streakBonus(m.streak||0, m.difficulty||'easy')+' XP</span>' +
          attrs +
        '</div>' +
      '</div>' +
      '<div class="actions">' +
        (completed? ('<button data-undo="'+occ.id+'" class="wood">Desfazer</button>') : ('<button data-done="'+occ.id+'" class="wood">Concluir</button>')) +
        '<button data-delm="'+m.id+'" class="wood" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button>' +
      '</div>';

    list.appendChild(wrap);
  });

  $$("button[data-done]").forEach(function(b){ b.onclick=function(){ completeOccurrence(b.getAttribute("data-done")); }; });
  $$("button[data-undo]").forEach(function(b){ b.onclick=function(){ undoOccurrence(b.getAttribute("data-undo")); }; });
  $$("button[data-delm]").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-delm");
      if(confirm("Excluir esta missão (todas as ocorrências futuras)?")){
        state.missions = state.missions.filter(function(x){ return x.id!==id; });
        Object.keys(state.completions).forEach(function(k){ if(k.indexOf(id+'@')===0) delete state.completions[k]; });
        store.save(state);
        renderMissions(); renderCalendar(); renderAchievements(); renderStats();
      }
    };
  });
}
function completeOccurrence(occId){
  if(state.completions[occId]) return;
  var parts=occId.split("@"), mId=parts[0], date=parts[1];
  var m = state.missions.find(function(x){ return x.id===mId; }); if(!m) return;

  var prevKey = prevOccurrenceDate(m,date);
  if(prevKey && state.completions[m.id+"@"+prevKey]) m.streak=(m.streak||0)+1; else m.streak=1;
  m.lastDone=date; awardStreakGold(m);

  var mul = diffMul(m.difficulty||'easy');
  var bonus = streakBonus(m.streak||0, m.difficulty||'easy');
  var charXP = Math.round((m.charXP||0)*mul) + bonus;
  grantXPCharacter(charXP);
  (m.attrXP||[]).forEach(function(ax){ grantXPAttribute(ax.attrId, Math.round((ax.xp||0)*mul)); });

  state.completions[occId]=true;
  state.xpLog.push({date:date, charXP:charXP, missionId:m.id, difficulty:(m.difficulty||'easy')});
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

// Modal Missão util (atributos)
function selectedWeekdays(){
  return $$("#mWeekdays input[type=checkbox]:checked").map(function(cb){ return parseInt(cb.value,10); });
}
function renderMissionModalAttrList(){
  var box=$("#mAttrList"); if(!box) return;
  box.innerHTML="";
  if(state.attributes.length===0){
    box.innerHTML='<p class="muted small">Sem atributos. Crie alguns na aba “Atributos”.</p>';
    return;
  }
  addAttrAllocLine();
}
var btnAddAttrAlloc=$("#addAttrAlloc");
if(btnAddAttrAlloc){ btnAddAttrAlloc.onclick=addAttrAllocLine; }
function addAttrAllocLine(){
  var box=$("#mAttrList"); if(!box) return;
  var line=document.createElement("div");
  line.className="attrLine";
  var sel=document.createElement("select");
  state.attributes.forEach(function(a){
    var o=document.createElement("option"); o.value=a.id; o.textContent=a.name; sel.appendChild(o);
  });
  var xp=document.createElement("input");
  xp.type="number"; xp.min="0"; xp.value="5"; xp.style.width="120px";
  var del=document.createElement("button");
  del.textContent="–"; del.className="wood"; del.onclick=function(){ line.remove(); };
  line.appendChild(sel); line.appendChild(xp); line.appendChild(del);
  box.appendChild(line);
}
function collectAttrAlloc(){
  return $$("#mAttrList .attrLine").map(function(l){
    return { attrId:$("select",l).value, xp:Math.max(0, parseInt($("input",l).value||"0",10)) };
  });
}

var btnNewMission=$("#newMission");
if(btnNewMission){
  btnNewMission.onclick=function(){
    openModal("#missionModal"); renderMissionModalAttrList();
  };
}
var btnCreateMission=$("#createMission");
if(btnCreateMission){
  btnCreateMission.onclick=function(){
    var title = ( $("#mTitle") && $("#mTitle").value || "" ).trim();
    if(!title){ alert("Dê um título para a missão."); return; }
    var recur = ( $("#mRecur") && $("#mRecur").value ) || "once";
    var date  = ( $("#mDate") && $("#mDate").value ) || todayKey();
    var time  = ( $("#mTime") && $("#mTime").value ) || "07:00";
    var charXP= Math.max(0, parseInt( ($("#mXP") && $("#mXP").value) || "0", 10 ));
    var payload={
      id:"m"+Math.random().toString(36).slice(2,8),
      title:title, recur:recur, date:date, time:time,
      difficulty: ( $("#mDiff") ? $("#mDiff").value : 'easy' ),
      weekdays: recur==="weekly" ? selectedWeekdays() : [],
      charXP:charXP,
      attrXP: collectAttrAlloc(),
      streak:0, lastDone:null
    };
    state.missions.push(payload);
    store.save(state);
    if($("#mTitle")) $("#mTitle").value="";
    if($("#mXP"))    $("#mXP").value="10";
    if($("#mDate"))  $("#mDate").value="";
    if($("#mTime"))  $("#mTime").value="07:00";
    $$("#mWeekdays input[type=checkbox]").forEach(function(cb){ cb.checked=false; });
    if($("#mAttrList")) $("#mAttrList").innerHTML="";
    closeModal("#missionModal");
    renderMissions(); renderCalendar();
  };
}

/////////////////////////////
// Ouro / Conquistas
/////////////////////////////
function awardGold(key, amount, reason){
  if(state.achievementsAwarded[key]) return;
  state.achievementsAwarded[key]=true;
  state.gold += amount;
  toast("🪙 +"+amount+" ouro — "+reason);
  renderHeader(); store.save(state);
}
function awardStreakGold(m){
  m.streakAwards = m.streakAwards || {};
  var steps=[{s:3,g:2},{s:7,g:5},{s:30,g:15}];
  steps.forEach(function(step){
    if(m.streak>=step.s && !m.streakAwards[step.s]){
      m.streakAwards[step.s]=true;
      awardGold("streak:"+m.id+":"+step.s, step.g, 'Streak '+step.s+'+ em "'+m.title+'"');
    }
  });
}

function uniqueDates(){ return Array.from(new Set(state.xpLog.map(function(x){ return x.date; }))).sort(); }
function longestGlobalStreak(){
  var ds=uniqueDates(); if(ds.length===0) return 0;
  var best=1, cur=1;
  for(var i=1;i<ds.length;i++){
    var prev=new Date(ds[i-1]), curd=new Date(ds[i]);
    var delta=(curd-prev)/(1000*60*60*24);
    if(delta===1) cur++; else if(delta>1) cur=1;
    if(cur>best) best=cur;
  }
  return best;
}
function maxCompletionsInOneDay(){
  var map={}; state.xpLog.forEach(function(x){ map[x.date]=(map[x.date]||0)+1; });
  var arr=Object.values(map); if(arr.length===0) return 0;
  return Math.max.apply(Math, arr);
}
function countHardMissionsDone(){ return state.xpLog.filter(function(x){ return x.difficulty==='hard'; }).length; }
function maxAttrLevel(){ if(state.attributes.length===0) return 0; return Math.max.apply(Math, state.attributes.map(function(a){ return a.level; })); }

var ACHS = [
  {key:'first',   title:'Primeiro Passo',       desc:'Conclua sua primeira missão.',                 gold:2,  check:function(){ return Object.keys(state.completions).length>=1; }},
  {key:'ten',     title:'Dez Missões',          desc:'Conclua 10 missões.',                          gold:5,  check:function(){ return Object.keys(state.completions).length>=10; }},
  {key:'fifty',   title:'Cinquenta Missões',    desc:'Conclua 50 missões.',                          gold:15, check:function(){ return Object.keys(state.completions).length>=50; }},
  {key:'hundred', title:'Cem Missões',          desc:'Conclua 100 missões.',                         gold:25, check:function(){ return Object.keys(state.completions).length>=100; }},

  {key:'hard5',   title:'Herói de Ferro',       desc:'Conclua 5 missões difíceis.',                  gold:10, check:function(){ return countHardMissionsDone()>=5; }},
  {key:'hard20',  title:'Veterano das Batalhas',desc:'Conclua 20 missões difíceis.',                 gold:20, check:function(){ return countHardMissionsDone()>=20; }},
  {key:'hard50',  title:'Mestre das Provas',    desc:'Conclua 50 missões difíceis.',                 gold:30, check:function(){ return countHardMissionsDone()>=50; }},

  {key:'streak3',  title:'Trinca de Vitória',   desc:'Alcance 3 de streak em qualquer missão.',      gold:2,  check:function(){ return Math.max.apply(Math, state.missions.map(function(m){return m.streak||0;}))>=3; }},
  {key:'streak7',  title:'Semana de Foco',      desc:'Alcance 7 de streak em qualquer missão.',      gold:5,  check:function(){ return Math.max.apply(Math, state.missions.map(function(m){return m.streak||0;}))>=7; }},
  {key:'streak30', title:'Mês de Constância',   desc:'Alcance 30 de streak em qualquer missão.',     gold:15, check:function(){ return Math.max.apply(Math, state.missions.map(function(m){return m.streak||0;}))>=30; }},

  {key:'attr5',   title:'Aspirante',            desc:'Leve um atributo ao nível 5.',                 gold:5,  check:function(){ return maxAttrLevel()>=5; }},
  {key:'attr10',  title:'Especialista',         desc:'Leve um atributo ao nível 10.',                gold:10, check:function(){ return maxAttrLevel()>=10; }},
  {key:'attr20',  title:'Mestre',               desc:'Leve um atributo ao nível 20.',                gold:20, check:function(){ return maxAttrLevel()>=20; }},

  {key:'gold100', title:'Bolso Cheio',          desc:'Acumule 100 🪙 de ouro.',                       gold:5,  check:function(){ return state.gold>=100; }},
  {key:'gold500', title:'Tesouro do Rei',       desc:'Acumule 500 🪙 de ouro.',                       gold:15, check:function(){ return state.gold>=500; }},

  {key:'char5',   title:'Subida Épica',         desc:'Alcançar o nível 5 de personagem.',            gold:5,  check:function(){ return state.character.level>=5; }},
  {key:'char10',  title:'Campeão do Reino',     desc:'Alcançar o nível 10 de personagem.',           gold:15, check:function(){ return state.character.level>=10; }},

  {key:'daily7',  title:'Discípulo do Hábito',  desc:'Conclua ao menos 1 missão por 7 dias seguidos.', gold:10, check:function(){ return longestGlobalStreak()>=7; }},
  {key:'daily30', title:'Guerreiro das Rotinas',desc:'Conclua ao menos 1 missão por 30 dias seguidos.',gold:25, check:function(){ return longestGlobalStreak()>=30; }},
  {key:'sameDay5',title:'Incansável',           desc:'Conclua 5 missões no mesmo dia.',              gold:10, check:function(){ return maxCompletionsInOneDay()>=5; }}
];

function renderAchievements(){
  var box=$("#achList"); if(!box) return;
  box.innerHTML="";
  if(ACHS.length===0){ if($("#achEmpty")) $("#achEmpty").style.display=""; return; }
  if($("#achEmpty")) $("#achEmpty").style.display="none";
  ACHS.forEach(function(a){
    var got=!!state.achievementsAwarded[a.key];
    if(a.check()) awardGold(a.key, a.gold, a.title);
    var row=document.createElement("div");
    row.className="card";
    row.innerHTML =
      '<div class="row" style="align-items:center;">' +
        '<div style="flex:1;">' +
          '<div style="font-weight:900;"><span class="trophy">🏆</span>'+a.title+'</div>' +
          '<div class="muted small">'+a.desc+'</div>' +
        '</div>' +
        '<span class="chip">+'+a.gold+' 🪙</span>' +
        '<span class="chip">'+(got?"Obtida":"Pendente")+'</span>' +
      '</div>';
    box.appendChild(row);
  });
}

/////////////////////////////
// Calendário e Stats
/////////////////////////////
var calCursor = new Date();
function renderCalendar(){
  var title=$("#calMonthTitle"), grid=$("#calendarGrid");
  if(!title || !grid) return;
  title.textContent = fmtMonthTitle(calCursor);
  grid.innerHTML="";
  var y=calCursor.getFullYear(), m=calCursor.getMonth();
  var first=new Date(y,m,1), start=first.getDay(), days=new Date(y,m+1,0).getDate();
  for(var i=0;i<start;i++){ var d=document.createElement("div"); d.className="calcell"; grid.appendChild(d); }
  for(var day=1; day<=days; day++){
    var key=todayKey(new Date(y,m,day));
    var count=state.xpLog.filter(function(x){ return x.date===key; }).length;
    var cell=document.createElement("div");
    cell.className="calcell";
    cell.innerHTML='<div class="daynum">'+String(day).padStart(2,'0')+'</div><div class="calmark">'+(count>0? "✅×"+count:"")+'</div>';
    grid.appendChild(cell);
  }
}
var btnPrev=$("#prevMonth"), btnNext=$("#nextMonth");
if(btnPrev){ btnPrev.onclick=function(){ calCursor=new Date(calCursor.getFullYear(), calCursor.getMonth()-1, 1); renderCalendar(); }; }
if(btnNext){ btnNext.onclick=function(){ calCursor=new Date(calCursor.getFullYear(), calCursor.getMonth()+1, 1); renderCalendar(); }; }

function renderStats(){
  var t=todayKey(), r=weekRange(new Date()), ws=r[0], we=r[1];
  var inWeek=state.xpLog.filter(function(x){ var d=ymdToDate(x.date); return d>=ws && d<=we; });
  var todayXP=state.xpLog.filter(function(x){ return x.date===t; }).reduce(function(s,x){ return s+x.charXP; },0);
  var weekXP=inWeek.reduce(function(s,x){ return s+x.charXP; },0);
  if($("#xpToday")) $("#xpToday").textContent=todayXP;
  if($("#xpWeek"))  $("#xpWeek").textContent=weekXP;
  var streakOfDay = state.missions.filter(function(m){ return (m.lastDone===t) && (m.streak||0)>=2; }).length;
  if($("#streakOfDay")) $("#streakOfDay").textContent=streakOfDay;
}

/////////////////////////////
// Recompensas
/////////////////////////////
function renderRewards(){
  var list=$("#rewardList"); if(!list) return;
  list.innerHTML="";
  if(state.rewards.length===0){ if($("#rewardEmpty")) $("#rewardEmpty").style.display=""; }
  else { if($("#rewardEmpty")) $("#rewardEmpty").style.display="none"; }

  state.rewards.forEach(function(r){
    var row=document.createElement("div");
    row.className="reward";
    row.innerHTML =
      '<div class="meta"><div><strong>'+r.name+
      '</strong></div><div class="small muted">Custa '+r.cost+' 🪙</div></div>' +
      '<div class="actions">' +
        '<button class="wood" data-buy="'+r.id+'">Comprar</button>' +
        '<button class="wood" data-delr="'+r.id+'" style="background:linear-gradient(90deg,#5c2a2a,#7a1f1f);">Excluir</button>' +
      '</div>';
    list.appendChild(row);
  });

  $$("button[data-buy]").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-buy");
      var r=state.rewards.find(function(x){ return x.id===id; }); if(!r) return;
      if(state.gold<r.cost){ alert("Ouro insuficiente."); return; }
      state.gold -= r.cost;
      state.rewardsHistory.unshift({date:todayKey(), name:r.name, cost:r.cost});
      store.save(state); renderHeader(); renderRewards(); renderRewardHistory();
      toast('Você comprou "'+r.name+'" por '+r.cost+' 🪙');
    };
  });
  $$("button[data-delr]").forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute("data-delr");
      if(confirm("Excluir esta recompensa?")){
        state.rewards = state.rewards.filter(function(x){ return x.id!==id; });
        store.save(state); renderRewards();
      }
    };
  });
}
var btnAddReward=$("#addReward");
if(btnAddReward){
  btnAddReward.onclick=function(){
    var name=(( $("#rewardName") && $("#rewardName").value )||"").trim();
    var cost=Math.max(1, parseInt( ( $("#rewardCost") && $("#rewardCost").value ) || "1", 10 ));
    if(!name){ alert("Dê um nome para a recompensa."); return; }
    var id="r"+Math.random().toString(36).slice(2,8);
    state.rewards.push({id:id, name:name, cost:cost});
    if($("#rewardName")) $("#rewardName").value="";
    if($("#rewardCost")) $("#rewardCost").value="50";
    store.save(state); renderRewards();
  };
}
function renderRewardHistory(){
  var box=$("#rewardHistory"), empty=$("#rewardHistoryEmpty"); if(!box||!empty) return;
  box.innerHTML="";
  if(state.rewardsHistory.length===0){ empty.style.display=""; return; }
  empty.style.display="none";
  state.rewardsHistory.forEach(function(h){
    var row=document.createElement("div");
    row.className="row";
    row.innerHTML='<span class="chip">'+h.date+'</span><span>'+h.name+'</span><span class="chip">-'+h.cost+' 🪙</span>';
    box.appendChild(row);
  });
}

/////////////////////////////
// Export/Import
/////////////////////////////
var btnExport=$("#exportBtn");
if(btnExport){
  btnExport.onclick=function(){
    var data=JSON.stringify(state,null,2);
    var blob=new Blob([data],{type:"application/json"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a"); a.href=url; a.download="metaxp_backup.json"; a.click();
    URL.revokeObjectURL(url);
  };
}
var inputImport=$("#importFile");
if(inputImport){
  inputImport.onchange=function(e){
    var file=e.target.files[0]; if(!file) return;
    var reader=new FileReader();
    reader.onload=function(){
      try{
        var obj=JSON.parse(reader.result);
        state=obj; store.save(state);
        renderAll(); alert("Importação concluída!");
      }catch(err){ alert("Arquivo inválido."); }
    };
    reader.readAsText(file);
  };
}

/////////////////////////////
// Temas
/////////////////////////////
var THEME_STYLE_ID='metaxp-dynamic-theme';
var THEME_STYLES={
  medieval: ':root[data-theme="medieval"]{--bg:#17130e;--bg2:#1e1912;--paper:#221b12;--ink:#e8d9b8;--muted:#cbbf9b;--accent:#d4a05a;--accent2:#8fb873;--edge:#3a2b1a;} :root[data-theme="medieval"] body{color:var(--ink);}',
  pink:     ':root[data-theme="pink"]{--bg:#2a1120;--bg2:#1b0b14;--paper:#2d1523;--ink:#ffe7f4;--muted:#ffc9e3;--accent:#ff4fa0;--accent2:#ffa0d0;--edge:#3c0f2a;} :root[data-theme="pink"] body{color:var(--ink);}',
  minimal:  ':root[data-theme="minimal"]{--bg:#0f0f10;--bg2:#0f0f10;--paper:#111213;--ink:#ffffff;--muted:#c7c8c9;--accent:#d0d0d0;--accent2:#bdbdbd;--edge:#1f1f20;} :root[data-theme="minimal"] body{color:var(--ink);}'
};
function ensureThemeStyleTag(){
  var tag=document.getElementById(THEME_STYLE_ID);
  if(!tag){ tag=document.createElement("style"); tag.id=THEME_STYLE_ID; document.head.appendChild(tag); }
  return tag;
}
function applyTheme(theme){
  try{ localStorage.setItem('metaxp_theme', theme); }catch(e){}
  document.documentElement.setAttribute('data-theme', theme);
  ensureThemeStyleTag().textContent = THEME_STYLES[theme] || THEME_STYLES.medieval;

  var tabs = Array.from(document.querySelectorAll('.tabs .tab'));
  if(theme==='minimal' || theme==='pink'){
    tabs.forEach(function(t){
      var txt=(t.textContent||'');
      t.textContent=txt.replace(/^[^\p{L}\p{N}]+/u,'').trim();
    });
  }else if(theme==='medieval'){
    var originals={
      missoes:'🗡️ Missões',
      atributos:'🛡️ Atributos',
      conquistas:'🏆 Conquistas',
      calendario:'📜 Calendário',
      rewards:'💰 Recompensas',
      survival:'🌿 Sobrevivência',
      config:'⚙️ Configurações'
    };
    tabs.forEach(function(t){
      var key=t.dataset.tab;
      if(originals[key]) t.textContent=originals[key];
    });
  }
}
function ensureThemeButtons(){
  var btnMed=$("#themeMedieval"), btnPink=$("#themePink"), btnMin=$("#themeMinimal");
  if(!btnMed || !btnPink || !btnMin){
    var card=document.createElement("div");
    card.className="card";
    card.innerHTML =
      '<h3 style="margin:0 0 8px 0;">Aparência</h3>' +
      '<div class="row">' +
        '<button id="themeMedieval" class="wood">RPG Medieval</button>' +
        '<button id="themePink" class="wood">Pink</button>' +
        '<button id="themeMinimal" class="wood">Minimal</button>' +
      '</div>' +
      '<p class="muted">Escolha um tema. A preferência fica salva neste dispositivo.</p>';
    ( $("#tab-config") || $("main") || document.body ).prepend(card);
    btnMed=$("#themeMedieval"); btnPink=$("#themePink"); btnMin=$("#themeMinimal");
  }
  function bind(btn,theme){
    if(!btn || btn.__bound) return;
    btn.__bound=true; btn.addEventListener('click', function(){ applyTheme(theme); });
  }
  bind(btnMed,'medieval'); bind(btnPink,'pink'); bind(btnMin,'minimal');
  applyTheme(localStorage.getItem('metaxp_theme') || state.theme || 'medieval');
}

/////////////////////////////
// Sobrevivência (Sono & Água)
/////////////////////////////
var SV_SLEEP_GOAL=8.0, SV_WATER_GOAL=2.0, SV_CHAR_XP_ON_GOAL=5, SV_HEALTH_XP_ON_GOAL=5;
function svGet(day){ return state.survival[day] || { sleep:0, water:0, awarded:false }; }
function svSet(day,data){ state.survival[day] = { sleep:(data.sleep||0), water:(data.water||0), awarded: !!data.awarded }; }
function renderSurvival(){
  var wrap=$("#tab-survival"); if(!wrap) return;
  var dateInput=$("#svDate");
  if(dateInput && !dateInput.value) dateInput.value=todayKey();
  if($("#svGoalsText")) $("#svGoalsText").textContent = SV_SLEEP_GOAL+"h de sono • "+SV_WATER_GOAL.toFixed(1)+"L de água";
  var key = (dateInput && dateInput.value) || todayKey();
  var rec=svGet(key);
  if($("#svSleep")) $("#svSleep").value = rec.sleep || "";
  if($("#svWater")) $("#svWater").value = rec.water || "";
  renderSurvivalHistory();
}
var btnSvToday=$("#svToday");
if(btnSvToday){
  btnSvToday.addEventListener("click", function(){
    var k=todayKey(); if($("#svDate")) $("#svDate").value=k;
    var rec=svGet(k);
    if($("#svSleep")) $("#svSleep").value=rec.sleep||"";
    if($("#svWater")) $("#svWater").value=rec.water||"";
  });
}
var btnSvSave=$("#svSave");
if(btnSvSave){
  btnSvSave.addEventListener("click", function(){
    var day = ($("#svDate") && $("#svDate").value) || todayKey();
    var sleep = parseFloat( ($("#svSleep") && $("#svSleep").value) || "0" );
    var water = parseFloat( ($("#svWater") && $("#svWater").value) || "0" );
    if( (isNaN(sleep)||sleep<=0) && (isNaN(water)||water<=0) ){ alert("Digite pelo menos um valor (> 0) para salvar."); return; }
    if(sleep<0 || sleep>24){ alert("Horas de sono deve estar entre 0 e 24."); return; }
    if(water<0){ alert("Água deve ser >= 0."); return; }

    var prev=svGet(day), already=!!prev.awarded;
    svSet(day,{sleep:sleep, water:water, awarded:prev.awarded}); store.save(state);

    var hitSleep = sleep>=SV_SLEEP_GOAL, hitWater = water>=SV_WATER_GOAL;
    if(!already && (hitSleep || hitWater)){
      var totalChar=0,totalHealth=0, health = state.attributes.find(function(a){ return a.id==='health' || (a.name||'').toLowerCase()==='saúde'; });
      if(hitSleep){ totalChar+=SV_CHAR_XP_ON_GOAL; totalHealth+=SV_HEALTH_XP_ON_GOAL; }
      if(hitWater){ totalChar+=SV_CHAR_XP_ON_GOAL; totalHealth+=SV_HEALTH_XP_ON_GOAL; }
      if(totalChar>0) grantXPCharacter(totalChar);
      if(health && totalHealth>0) grantXPAttribute(health.id, totalHealth);
      var d=svGet(day); d.awarded=true; svSet(day,d); store.save(state);
      toast("🌿 Metas do dia atingidas! +"+totalChar+" XP personagem, +"+totalHealth+" XP em Saúde");
    }else{
      toast("🌿 Dados de "+day+" salvos!");
    }
    renderHeader(); renderAttributes(); renderSurvivalHistory();
  });
}
function renderSurvivalHistory(){
  var box=$("#svHistory"); if(!box) return;
  box.innerHTML="";
  var days=[], t=new Date();
  for(var i=0;i<7;i++){
    var d=addDays(t,-i), k=todayKey(d);
    if(state.survival[k]) days.push(k);
  }
  if(days.length===0){ box.innerHTML='<div class="muted">Sem registros nos últimos 7 dias.</div>'; return; }

  var table=document.createElement("div");
  table.style.display="grid";
  table.style.gridTemplateColumns="120px 1fr 1fr";
  table.style.gap="8px";
  table.style.alignItems="center";
  table.innerHTML = '<div class="muted small">Data</div><div class="muted small">😴 Sono</div><div class="muted small">💧 Água</div>';

  function bar(pct, ok, label){
    return '<div style="display:flex;align-items:center;gap:8px;">' +
             '<div style="flex:1;height:10px;border:1px solid #2a2217;border-radius:999px;background:#0e0b08;overflow:hidden;">' +
               '<div style="height:100%;width:'+pct+'%;'+(ok?'background:linear-gradient(90deg,#8fb873,#5aa75a);':'background:linear-gradient(90deg,#6b4f2c,#8a6a3f);')+'"></div>' +
             '</div>' +
             '<span class="small '+(ok?'':'muted')+'">'+label+'</span>' +
           '</div>';
  }

  days.forEach(function(k){
    var r=svGet(k), pSleep=Math.min(100, Math.round((r.sleep||0)/SV_SLEEP_GOAL*100)), pWater=Math.min(100, Math.round((r.water||0)/SV_WATER_GOAL*100));
    var okSleep=(r.sleep||0)>=SV_SLEEP_GOAL, okWater=(r.water||0)>=SV_WATER_GOAL;
    var row=document.createElement("div"); row.style.display="contents";
    row.innerHTML = '<div><span class="chip">'+k+'</span></div>' +
                    '<div>'+bar(pSleep, okSleep, (r.sleep||0)+'h')+'</div>' +
                    '<div>'+bar(pWater, okWater, (r.water||0)+'L')+'</div>';
    table.appendChild(row);
  });
  box.appendChild(table);
}

/////////////////////////////
// UI util
/////////////////////////////
function toast(msg){
  var el=document.createElement("div");
  el.textContent=msg;
  el.style.position="fixed"; el.style.bottom="20px"; el.style.left="50%";
  el.style.transform="translateX(-50%)";
  el.style.background="#14100b"; el.style.border="1px solid #2a2217";
  el.style.padding="10px 14px"; el.style.borderRadius="999px";
  el.style.boxShadow="0 10px 30px #00000055"; el.style.zIndex="1000";
  document.body.appendChild(el);
  setTimeout(function(){ el.remove(); },1800);
}
/* ====== PATCH: grade de ícones + criação robusta ====== */
(function () {
  const ICON_BASE  = 'icons/attributes/';
  const ICON_COUNT = 350;
  let __attrIconSelected = null;

  function renderAttrIconGrid() {
    const grid = document.getElementById('iconGrid');
    const prev = document.getElementById('attrIconPreview');
    const hint = document.getElementById('attrIconHint');
    if (!grid) return;

    // fundo claro pro container da grade
    grid.style.background = 'transparent';
    grid.style.padding = '0';

    // Fundo claro pra prévia
    if (prev) {
      prev.style.display = 'none';
      prev.style.background = '#ececec';
      prev.style.borderRadius = '8px';
      prev.style.border = '2px solid var(--accent)';
    }

    // se já renderizou, só reaplica seleção
    if (grid.__rendered) {
      grid.querySelectorAll('img').forEach(img => {
        img.style.outline = (img.dataset.path === __attrIconSelected)
          ? '2px solid var(--accent)' : 'none';
      });
      if (__attrIconSelected && prev) {
        prev.src = __attrIconSelected;
        prev.style.display = '';
        if (hint) hint.textContent = __attrIconSelected.split('/').pop();
      }
      return;
    }

    grid.innerHTML = '';
    for (let i = 1; i <= ICON_COUNT; i++) {
      const file = String(i).padStart(3, '0') + '.png';
      const path = ICON_BASE + file;

      const img = new Image();
      img.src = path;
      img.alt = file;
      img.dataset.path = path;

      // 👇 deixa o ícone legível em tema escuro
      img.style.width = '40px';
      img.style.height = '40px';
      img.style.borderRadius = '8px';
      img.style.cursor = 'pointer';
      img.style.background = '#ececec';        // fundo claro
      img.style.border = '1px solid #d6d6d6';  // borda suave
      img.style.boxShadow = 'inset 0 1px 0 #fff6';
      img.style.outline = 'none';

      img.onerror = () => { img.remove(); };

      img.onclick = () => {
        __attrIconSelected = path;
        grid.querySelectorAll('img').forEach(el => el.style.outline = 'none');
        img.style.outline = '2px solid var(--accent)';
        if (prev) {
          prev.src = path;
          prev.style.display = '';
          prev.style.background = '#ececec';
        }
        if (hint) hint.textContent = file;
      };

      grid.appendChild(img);
    }
    grid.__rendered = true;
  }

  // Envolve openModal p/ carregar grade ao abrir
  const _openModal = window.openModal || (sel => document.querySelector(sel)?.classList.add('open'));
  if (!_openModal.__patched) {
    window.openModal = function (sel) {
      _openModal(sel);
      if (sel === '#attrNewModal') {
        __attrIconSelected = null;
        const prev = document.getElementById('attrIconPreview');
        const hint = document.getElementById('attrIconHint');
        const name = document.getElementById('attrName2');
        if (prev) { prev.src = ''; prev.style.display = 'none'; prev.style.background = '#ececec'; }
        if (hint) hint.textContent = 'Selecione um ícone abaixo';
        if (name) name.value = (name.value || '').trim(); // normaliza
        renderAttrIconGrid();
      }
    };
    window.openModal.__patched = true;
  }

  // Botão Criar atributo (evita múltiplos binds)
  const btn = document.getElementById('createAttrWithIcon');
  if (btn && !btn.__bound) {
    btn.__bound = true;
    // garante que NÃO é submit de form
    btn.setAttribute('type', 'button');

    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      const nameEl = document.getElementById('attrName2');
      const name = (nameEl && typeof nameEl.value === 'string') ? nameEl.value.trim() : '';

      if (!name) { alert('Dê um nome ao atributo.'); return; }
      if (!__attrIconSelected) { alert('Selecione um ícone.'); return; }

      const id = 'a' + Math.random().toString(36).slice(2, 8);
      if (!Array.isArray(state.attributes)) state.attributes = [];
      state.attributes.push({ id, name, level: 1, xp: 0, next: 100, icon: __attrIconSelected });

      try { store.save(state); } catch(e) {}

      // fecha modal e limpa
      if (nameEl) nameEl.value = '';
      __attrIconSelected = null;
      document.getElementById('attrNewModal')?.classList.remove('open');
      // re-render
      if (typeof renderAttributes === 'function') renderAttributes();
    }, { once: false });
  }

  // Injeta ícone no card de atributo (mantém seu render)
  if (!window.renderAttributes.__withIcons) {
    const __old = window.renderAttributes;
    window.renderAttributes = function () {
      __old && __old();

      const wrap = document.getElementById('attrList');
      if (!wrap) return;

      const sorted = [...(state.attributes || [])]
        .sort((a,b)=> (b.level - a.level) || (b.xp/(b.next||1) - a.xp/(a.next||1)));

      wrap.querySelectorAll('.card').forEach((card, idx) => {
        const a = sorted[idx];
        if (!a || !a.icon) return;
        const title = card.querySelector('div[style*="font-weight:900"]');
        if (title && !title.querySelector('img.attr-ic')) {
          const ic = document.createElement('img');
          ic.className = 'attr-ic';
          ic.src = a.icon;
          ic.alt = '';
          ic.style.width = '18px';
          ic.style.height = '18px';
          ic.style.borderRadius = '4px';
          ic.style.marginRight = '6px';
          ic.style.verticalAlign = '-3px';
          ic.style.background = '#ececec';
          ic.style.border = '1px solid #d6d6d6';
          title.prepend(ic);
        }
      });
    };
    window.renderAttributes.__withIcons = true;
  }
})();
/* ====== PATCH FINAL: remover ícone duplicado à esquerda ====== */
(function () {
  const __old = window.renderAttributes;
  window.renderAttributes = function () {
    __old && __old();

    const wrap = document.getElementById('attrList');
    if (!wrap) return;

    // remove imagens duplicadas escuras dentro do card (as que vêm da versão antiga)
    wrap.querySelectorAll('.card img').forEach(img => {
      if (img && img.alt === '' && !img.classList.contains('attr-ic')) {
        img.remove();
      }
    });
  };
})();
/* ====== PATCH: suprimir alerta "Dê um nome ao atributo." quando o modal de ícones estiver aberto ====== */
(function () {
  const oldAlert = window.alert;
  window.alert = function (msg) {
    // Se o modal de novo atributo com ícone estiver aberto, ignoramos só esse alerta específico.
    const modalOpen = document.getElementById('attrNewModal')?.classList.contains('open');
    if (modalOpen && typeof msg === 'string' && /Dê um nome ao atributo\.?/.test(msg)) {
      return; // não mostra o alerta
    }
    return oldAlert(msg);
  };
})();

/////////////////////////////
// Filtros Missões / Modals
/////////////////////////////
if($("#range")){ $("#range").value="day"; $("#range").onchange=renderMissions; }
if($("#baseDate")){ $("#baseDate").valueAsDate=new Date(); $("#baseDate").onchange=renderMissions; }
$$(".modal").forEach(function(m){
  m.addEventListener("click", function(e){ if(e.target===m) m.classList.remove("open"); });
});

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
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', renderAll, {once:true});
}else{
  renderAll();
}
