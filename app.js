
/* =========================================================
   Meta XP — Theme Add-on 2.3.3
   - Adiciona 3 temas: medieval, pink e minimalista
   - Injeta CSS e cria os botões de troca dentro da aba Configurações
   - Persistência em localStorage ('metaxp_theme')
   - Seguro para colar no final do seu app.js atual (não remove nada)
   ========================================================= */

(function(){
  const THEME_KEY = 'metaxp_theme';
  const THEMES = ['medieval','pink','minimal'];
  const currentSaved = (localStorage.getItem(THEME_KEY) || 'medieval');

  // --- Inject CSS for themes (variables + overrides) ---
  const css = `
  /* ====== Base: usar variáveis para cores principais ====== */
  :root{
    --bg:#17130e; --bg2:#1e1912; --paper:#221b12; --ink:#e8d9b8; --muted:#cbbf9b;
    --accent:#d4a05a; --accent2:#8fb873; --edge:#3a2b1a; --danger:#7a1f1f;
    --ctl-bg:#14100b; --ctl-border:#2a2217; --chip-bg:#14100b; --chip-border:#2a2217;
  }
  /* ====== Tema: MEDIEVAL (padrão) ====== */
  body.theme-medieval{
    --bg:#17130e; --bg2:#1e1912; --paper:#221b12; --ink:#e8d9b8; --muted:#cbbf9b;
    --accent:#d4a05a; --accent2:#8fb873; --edge:#3a2b1a; --danger:#7a1f1f;
    --ctl-bg:#14100b; --ctl-border:#2a2217; --chip-bg:#14100b; --chip-border:#2a2217;
    --btn-grad-1:#6b4f2c; --btn-grad-2:#8a6a3f;
  }
  body.theme-medieval header{ background:#110d09cc; }
  body.theme-medieval .wood{ background:linear-gradient(180deg, #3a2b1a, #2c2115); border:1px solid #23190f; box-shadow: inset 0 1px 0 #5b4228, 0 8px 24px #00000070; }
  body.theme-medieval .card{ background:linear-gradient(180deg, #1e1912, #17130e); border:1px solid #2a2217; }
  body.theme-medieval .chip{ background:var(--chip-bg); border:1px solid var(--chip-border); }
  body.theme-medieval input, body.theme-medieval select, body.theme-medieval button, body.theme-medieval textarea{ background:var(--ctl-bg); border:1px solid var(--ctl-border); color:var(--ink); }
  body.theme-medieval button{ background-image:linear-gradient(90deg, var(--btn-grad-1), var(--btn-grad-2)); color:#f5e8c8; }

  /* ====== Tema: PINK (feminino) ====== */
  body.theme-pink{
    --bg:#2b1522; --bg2:#220f1b; --paper:#2e1826; --ink:#ffe7f3; --muted:#e7b5d1;
    --accent:#ff7ab6; --accent2:#b0ffe3; --edge:#4a203a; --danger:#9b2e5a;
    --ctl-bg:#20101a; --ctl-border:#3b2231; --chip-bg:#24141e; --chip-border:#3b2231;
    --btn-grad-1:#ff7ab6; --btn-grad-2:#ff9ac9;
  }
  body.theme-pink header{ background:#2a0f22cc; }
  body.theme-pink .wood{ background:linear-gradient(180deg, #5a2748, #3e1b33); border:1px solid #2c1425; box-shadow: inset 0 1px 0 #7a3762, 0 8px 24px #00000070; }
  body.theme-pink .card{ background:linear-gradient(180deg, #2b1723, #21101a); border:1px solid #3b2231; }
  body.theme-pink .chip{ background:var(--chip-bg); border:1px solid var(--chip-border); }
  body.theme-pink input, body.theme-pink select, body.theme-pink button, body.theme-pink textarea{ background:var(--ctl-bg); border:1px solid var(--ctl-border); color:var(--ink); }
  body.theme-pink button{ background-image:linear-gradient(90deg, var(--btn-grad-1), var(--btn-grad-2)); color:#2b0f21; font-weight:800; }
  body.theme-pink .xpbar .fill{ background:linear-gradient(90deg, var(--accent), var(--accent2)); }

  /* ====== Tema: MINIMAL ====== */
  body.theme-minimal{
    --bg:#f7f7f8; --bg2:#f7f7f8; --paper:#ffffff; --ink:#1c1c1c; --muted:#6a6a6a;
    --accent:#2b77ff; --accent2:#22c55e; --edge:#dadada; --danger:#b42318;
    --ctl-bg:#ffffff; --ctl-border:#dadada; --chip-bg:#ffffff; --chip-border:#dadada;
    --btn-grad-1:#2b77ff; --btn-grad-2:#60a5ff;
  }
  body.theme-minimal header{ background:#ffffffcc; border-bottom:1px solid var(--edge); backdrop-filter:saturate(130%) blur(8px); }
  body.theme-minimal .wood{ background:linear-gradient(180deg, #ffffff, #fbfbfb); border:1px solid var(--edge); box-shadow: inset 0 1px 0 #ffffff, 0 8px 18px #00000010; color:#0f172a; }
  body.theme-minimal .card{ background:var(--paper); border:1px solid var(--edge); box-shadow: 0 12px 24px #0000000d, inset 0 1px 0 #ffffff; }
  body.theme-minimal .chip{ background:var(--chip-bg); border:1px solid var(--chip-border); color:#0f172a; }
  body.theme-minimal input, body.theme-minimal select, body.theme-minimal button, body.theme-minimal textarea{ background:var(--ctl-bg); border:1px solid var(--ctl-border); color:var(--ink); }
  body.theme-minimal button{ background-image:linear-gradient(90deg, var(--btn-grad-1), var(--btn-grad-2)); color:#ffffff; }
  body.theme-minimal .xpbar .bar{ background:#eef2f7; border:1px solid #e5e7eb; }
  body.theme-minimal .xpbar .fill{ background:linear-gradient(90deg, var(--accent), var(--accent2)); }
  body.theme-minimal body{ font-family:system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; }

  /* ====== Backdrops e corpo usando vars ====== */
  body{
    color:var(--ink);
    background:
      radial-gradient(1200px 800px at 15% -10%, rgba(0,0,0,.15), transparent),
      radial-gradient(1200px 800px at 115% 110%, rgba(0,0,0,.15), transparent),
      linear-gradient(180deg, var(--bg), var(--bg2));
  }
  .tabs{ background:#0f0c09ee; }
  body.theme-minimal .tabs{ background:#ffffffee; }
  .goal, .reward{ background:var(--chip-bg); border:1px solid var(--chip-border); }
  `;
  const style = document.createElement('style');
  style.id = 'metaxp-theme-styles';
  style.textContent = css;
  document.head.appendChild(style);

  // --- Apply theme ---
  function applyTheme(name){
    THEMES.forEach(t=>document.body.classList.remove('theme-'+t));
    const chosen = THEMES.includes(name) ? name : 'medieval';
    document.body.classList.add('theme-'+chosen);
    localStorage.setItem(THEME_KEY, chosen);
    updateThemeButtons(chosen);
  }

  // --- Update buttons text to show (ativo) ---
  function updateThemeButtons(active){
    const row = document.querySelector('#tab-config .card:nth-of-type(2) .row');
    if(!row) return;
    row.querySelectorAll('button[data-theme]').forEach(btn=>{
      const t = btn.getAttribute('data-theme');
      const label = btn.getAttribute('data-label');
      btn.textContent = label + (t===active ? ' (ativo)' : '');
    });
  }

  // --- Build controls inside Config tab ---
  function buildThemeControls(){
    const targetRow = document.querySelector('#tab-config .card:nth-of-type(2) .row');
    if(!targetRow) return;

    // Substitui o conteúdo da linha por 3 botões de tema
    targetRow.innerHTML = '';
    const mk = (label, theme) => {
      const b = document.createElement('button');
      b.className = 'wood';
      b.setAttribute('data-theme', theme);
      b.setAttribute('data-label', label);
      b.textContent = label;
      b.style.flex = '1';
      b.addEventListener('click', ()=>applyTheme(theme));
      return b;
    };
    targetRow.appendChild(mk('🎖️ Medieval', 'medieval'));
    targetRow.appendChild(mk('🌸 Pink', 'pink'));
    targetRow.appendChild(mk('🧼 Minimalista', 'minimal'));
  }

  // --- Init after DOM is ready (in case app built the tab later) ---
  function initTheme(){
    try{
      buildThemeControls();
      applyTheme(currentSaved);
    }catch(e){ /* no-op */ }
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    setTimeout(initTheme, 0);
  } else {
    document.addEventListener('DOMContentLoaded', initTheme);
  }
})();
