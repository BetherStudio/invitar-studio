import { createClient } from '@supabase/supabase-js'
import { parseTemplate, applyChanges } from './parser.js'

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Estado global ─────────────────────────────────────────────────────────────
let originalHtml = null
let parsed       = null
let currentHtml  = null
let temaReps     = []
let localImgUrl  = null
let liveActive   = false
let iframeReady  = false
let liveTimer    = null

// ── Render UI ─────────────────────────────────────────────────────────────────
document.getElementById('root').innerHTML = `
<div style="display:grid;grid-template-rows:48px 1fr;grid-template-columns:340px 1fr;height:100vh;background:#0f0f0f;color:#e0e0e0;font-family:'Inter',system-ui,sans-serif;font-size:12px">

  <!-- HEADER -->
  <div style="grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:0 18px;background:#171717;border-bottom:1px solid #2a2a2a">
    <span style="font-weight:700;font-size:14px;color:#c0dd97">InvitAR Studio</span>
    <span id="statusBadge" style="font-size:10px;padding:2px 8px;border-radius:99px;background:#2a2a2a;color:#888">Sin plantilla</span>
    <div style="margin-left:auto;display:flex;gap:8px">
      <button id="btnApply" style="padding:6px 14px;border-radius:6px;border:none;background:#2d4a1e;color:#c0dd97;cursor:pointer;font-size:11px;font-weight:600">Aplicar cambios</button>
      <button id="btnExport" style="padding:6px 14px;border-radius:6px;border:none;background:#c0dd97;color:#0f0f0f;cursor:pointer;font-size:11px;font-weight:700">Exportar HTML</button>
    </div>
  </div>

  <!-- PANEL IZQUIERDO -->
  <div style="overflow-y:auto;background:#141414;border-right:1px solid #2a2a2a;display:flex;flex-direction:column">

    <!-- CARGA DE PLANTILLA -->
    <div style="padding:14px;border-bottom:1px solid #2a2a2a">
      <div style="font-size:10px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px">Plantilla HTML base</div>
      <div id="dropZone" style="border:2px dashed #2a2a2a;border-radius:8px;padding:16px;text-align:center;cursor:pointer;background:#0f0f0f;transition:.15s" onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" accept=".html,.htm" style="display:none">
        <i class="ti ti-file-code" style="font-size:22px;color:#555;display:block;margin-bottom:6px"></i>
        <div style="color:#777;font-size:11px">Arrastrá tu HTML o hacé clic</div>
        <div style="color:#555;font-size:10px;margin-top:2px">Cualquier plantilla de invitación</div>
      </div>
      <div id="loadStatus" style="font-size:10px;color:#639922;margin-top:6px;display:none"></div>
    </div>

    <!-- TABS -->
    <div style="display:flex;border-bottom:1px solid #2a2a2a;background:#0f0f0f;overflow-x:auto;flex-shrink:0" id="tabs">
      ${['Evento','Colores','Efectos','Temática','Imagen'].map((t,i)=>`<button class="tab ${i===0?'active':''}" data-tab="${i}" style="padding:8px 12px;border:none;background:none;color:${i===0?'#c0dd97':'#666'};cursor:pointer;font-size:10px;font-weight:${i===0?'600':'400'};border-bottom:2px solid ${i===0?'#c0dd97':'transparent'};white-space:nowrap;transition:.1s">${t}</button>`).join('')}
    </div>

    <!-- TAB CONTENIDO -->
    <div style="flex:1;overflow-y:auto;padding:14px" id="tabContent"></div>
  </div>

  <!-- PANEL DERECHO — VISOR -->
  <div style="display:flex;flex-direction:column;background:#0a0a0a">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #2a2a2a;background:#141414;flex-shrink:0">
      <button id="btnLive" onclick="toggleLive()" style="padding:4px 10px;border-radius:5px;border:none;background:#2a2a2a;color:#aaa;cursor:pointer;font-size:10px">▶ Activar visor</button>
      <button onclick="refreshLive()" style="padding:4px 8px;border-radius:5px;border:none;background:#2a2a2a;color:#aaa;cursor:pointer;font-size:10px"><i class="ti ti-refresh" style="font-size:11px"></i></button>
      <button onclick="openInvite()" style="padding:4px 10px;border-radius:5px;border:none;background:#2a2a2a;color:#aaa;cursor:pointer;font-size:10px" title="Simular click en Abrir Invitación">🎉 Abrir</button>
      <div style="margin-left:auto;display:flex;gap:6px">
        <button onclick="setScale('mobile')" style="padding:3px 8px;border-radius:5px;border:1px solid #333;background:none;color:#888;cursor:pointer;font-size:10px"><i class="ti ti-device-mobile" style="font-size:11px"></i> 375px</button>
        <button onclick="setScale('desktop')" style="padding:3px 8px;border-radius:5px;border:1px solid #333;background:none;color:#888;cursor:pointer;font-size:10px"><i class="ti ti-device-desktop" style="font-size:11px"></i> Full</button>
      </div>
      <span id="liveDot" style="width:8px;height:8px;border-radius:50%;background:#e24b4a;flex-shrink:0"></span>
    </div>
    <div style="flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:16px" id="iframeWrap">
      <div id="liveEmpty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#444;text-align:center;font-size:13px">
        <i class="ti ti-eye-off" style="font-size:48px;margin-bottom:12px;opacity:.3"></i>
        <div>Cargá una plantilla para activar el visor</div>
      </div>
      <iframe id="liveFrame" style="display:none;border:none;border-radius:8px;box-shadow:0 4px 32px rgba(0,0,0,.5);transition:.2s" sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"></iframe>
    </div>
  </div>

</div>
`

// ── Tabs ──────────────────────────────────────────────────────────────────────
let activeTab = 0

document.getElementById('tabs').addEventListener('click', e => {
  const btn = e.target.closest('.tab')
  if (!btn) return
  activeTab = +btn.dataset.tab
  document.querySelectorAll('.tab').forEach((t, i) => {
    t.style.color = i === activeTab ? '#c0dd97' : '#666'
    t.style.fontWeight = i === activeTab ? '600' : '400'
    t.style.borderBottom = `2px solid ${i === activeTab ? '#c0dd97' : 'transparent'}`
  })
  renderTab()
})

function renderTab() {
  const el = document.getElementById('tabContent')
  const f  = parsed?.fields ?? {}

  if (activeTab === 0) {
    el.innerHTML = `
    ${!parsed ? `<div style="color:#555;text-align:center;padding:40px 0;font-size:11px"><i class="ti ti-arrow-up" style="font-size:24px;display:block;margin-bottom:8px;opacity:.3"></i>Cargá un HTML para ver los campos</div>` : `
    ${field('f-titulo',   'Título de la página',   f.titulo)}
    ${field('f-nombre',   'Nombre / protagonistas', f.nombre)}
    ${row([field('f-dia','Día',f.dia,'70px'), field('f-mes','Mes',f.mes), field('f-anio','Año',f.anio,'80px')])}
    ${row([field('f-hora','Hora (HH:MM)',f.hora), field('f-dur','Duración hs','5','80px')])}
    <div style="height:1px;background:#2a2a2a;margin:12px 0"></div>
    ${field('f-salon',    'Nombre del salón / lugar', f.salon)}
    ${field('f-addr1',    'Dirección línea 1',        f.addr1)}
    ${field('f-addr2',    'Dirección línea 2',        f.addr2)}
    ${field('f-maps',     'Query para mapas',         f.mapsQuery)}
    <div style="height:1px;background:#2a2a2a;margin:12px 0"></div>
    ${field('f-msgsi',    'Mensaje / frase principal', f.msgSi, null, true)}
    ${field('f-footer',   'Footer',                    f.footerTxt, null, true)}
    <div style="height:1px;background:#2a2a2a;margin:12px 0"></div>
    ${field('f-stars',    'Estrellitas / emojis deco', f.tStars)}
    ${field('f-femojis',  'Footer emojis (separados por coma)', f.footerEmojis)}
    ${field('f-rain',     'Pool lluvia de emojis', f.rainPool)}
    `}
    `
  } else if (activeTab === 1) {
    const root = parsed?.cssRoot ?? ''
    el.innerHTML = `
    <div style="font-size:10px;color:#888;margin-bottom:6px">Bloque :root con variables CSS</div>
    <textarea id="f-cssroot" style="${TA}" rows="16" placeholder=":root {\n  --red: #E60012;\n  --blue: #009AC7;\n  ...}">${root}</textarea>
    <div id="cssChips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px"></div>
    `
    updateCssChips(root)
    document.getElementById('f-cssroot')?.addEventListener('input', e => {
      updateCssChips(e.target.value)
      scheduleLive()
    })
  } else if (activeTab === 2) {
    el.innerHTML = `
    <div style="font-size:10px;color:#888;margin-bottom:10px">Efectos visuales para inyectar en la invitación</div>
    <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Lluvia de emojis</div>
    ${field('f-rain', 'Emojis del pool (separados por coma)', parsed?.fields?.rainPool ?? '')}
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${['🦖,🌿,🥚','🦋,🌸,🌺','❄️,⛄,🌟','🎉,⭐,🎈','🍄,⭐,🪙'].map(p =>
        `<button onclick="document.getElementById('f-rain').value='${p}';scheduleLive()" style="${BTN}">${p.split(',')[0]}</button>`
      ).join('')}
    </div>
    <div style="height:1px;background:#2a2a2a;margin:12px 0"></div>
    <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">CSS adicional / efectos custom</div>
    <textarea id="f-extracss" style="${TA}" rows="8" placeholder="/* CSS extra */\n.mi-clase { color: red; }"></textarea>
    <div style="height:1px;background:#2a2a2a;margin:12px 0"></div>
    <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Snippets de efectos</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <button onclick="injectEffect('nieve')"     style="${BTN} width:100%">❄️ Nieve</button>
      <button onclick="injectEffect('confetti')"  style="${BTN} width:100%">🎊 Confetti</button>
      <button onclick="injectEffect('burbujas')"  style="${BTN} width:100%">🫧 Burbujas</button>
      <button onclick="injectEffect('luciernas')" style="${BTN} width:100%">✨ Luciérnagas</button>
      <button onclick="injectEffect('petalos')"   style="${BTN} width:100%">🌸 Pétalos</button>
    </div>
    `
  } else if (activeTab === 3) {
    el.innerHTML = `
    <div style="font-size:10px;color:#888;margin-bottom:8px">Pegá el bloque de temática generado por el asistente</div>
    <textarea id="f-temaraw" style="${TA}" rows="12" placeholder="Pegá el bloque completo de temática aquí..."></textarea>
    <button onclick="parseTema()" style="${BTN} margin-top:8px;width:100%">Aplicar temática</button>
    <div id="temaStatus" style="font-size:10px;color:#639922;margin-top:6px"></div>
    <div id="temaList" style="margin-top:10px"></div>
    `
    renderTemaList()
  } else if (activeTab === 4) {
    const imgs = parsed ? detectImages(originalHtml) : []
    el.innerHTML = `
    <div style="font-size:10px;color:#888;margin-bottom:8px">Cargá una imagen desde tu PC para usarla en la invitación</div>
    <div id="imgDrop" style="border:2px dashed #2a2a2a;border-radius:8px;padding:20px;text-align:center;cursor:pointer;background:#0f0f0f;transition:.15s" onclick="document.getElementById('imgInput').click()">
      <input type="file" id="imgInput" accept="image/*" style="display:none">
      <i class="ti ti-upload" style="font-size:24px;color:#555;display:block;margin-bottom:6px"></i>
      <div style="color:#777;font-size:11px">Arrastrá o hacé clic</div>
      <div style="color:#555;font-size:10px;margin-top:2px">PNG, JPG, WebP, GIF</div>
    </div>
    <div id="imgPreview" style="display:none;margin-top:12px">
      <div style="background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/12px 12px;border-radius:8px;overflow:hidden;max-height:160px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">
        <img id="imgThumb" style="max-width:100%;max-height:160px;object-fit:contain">
      </div>
      <div id="imgName" style="font-size:10px;color:#888;margin-bottom:8px"></div>
      ${imgs.length ? `
      <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Imágenes detectadas en la plantilla</div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:10px" id="detectedImgs">
        ${imgs.map((img,i) => `
        <button onclick="replaceDetectedImg('${img.src}')" style="${BTN} width:100%;justify-content:flex-start;gap:8px;overflow:hidden">
          <span style="flex-shrink:0;font-size:13px">${img.icon}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left">${img.label}</span>
          <span style="flex-shrink:0;font-size:9px;color:#555">${img.src.slice(-18)}</span>
        </button>`).join('')}
      </div>
      ` : ''}
      <div style="font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">O aplicar como</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button onclick="useImgAs('cover')"     style="${BTN}"><i class="ti ti-layout-bottombar" style="font-size:11px"></i> Fondo portada</button>
        <button onclick="useImgAs('main')"      style="${BTN}"><i class="ti ti-background" style="font-size:11px"></i> Fondo scroll</button>
        <button onclick="useImgAs('hero')"      style="${BTN}"><i class="ti ti-user" style="font-size:11px"></i> Hero img</button>
        <button onclick="useImgAs('cover-img')" style="${BTN}"><i class="ti ti-photo" style="font-size:11px"></i> Cover img</button>
        <button onclick="useImgAs('gifsi')"     style="${BTN}"><i class="ti ti-mood-happy" style="font-size:11px"></i> GIF Sí</button>
        <button onclick="useImgAs('gifno')"     style="${BTN}"><i class="ti ti-mood-sad" style="font-size:11px"></i> GIF No</button>
      </div>
    </div>
    `
    initImgLoader()
  }

  document.querySelectorAll('#tabContent input, #tabContent textarea, #tabContent select').forEach(el => {
    el.addEventListener('input', scheduleLive)
  })
}

// ── Detectar imágenes ─────────────────────────────────────────────────────────
function detectImages(html) {
  if (!html) return []
  const results = []
  const seen = new Set()
  const iconMap = { gif:'🎞️', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', webp:'🖼️', svg:'🖼️' }
  const labelMap = src => {
    if (src.includes('cover')) return 'Cover / portada'
    if (/mario|hero|personaje/i.test(src)) return 'Hero / personaje'
    if (/si|yes|sí/i.test(src)) return 'GIF — Sí voy'
    if (/no/i.test(src)) return 'GIF — No voy'
    if (/juego|game/i.test(src)) return 'Sprite juego'
    return src
  }
  const rx = /src="([^"]+\.(png|jpg|jpeg|gif|webp|svg))"/gi
  let m
  while ((m = rx.exec(html)) !== null) {
    const src = m[1]
    if (src.startsWith('data:') || seen.has(src)) continue
    seen.add(src)
    const ext = src.split('.').pop().toLowerCase()
    results.push({ src, icon: iconMap[ext] ?? '🖼️', label: labelMap(src) })
  }
  return results
}

window.replaceDetectedImg = function(originalSrc) {
  if (!localImgUrl) { toast('Cargá una imagen primero', 'warn'); return }
  if (!originalHtml) return
  originalHtml = originalHtml.split(`src="${originalSrc}"`).join(`src="${localImgUrl}"`)
  if (parsed) {
    Object.keys(parsed.originals).forEach(k => { if (parsed.originals[k] === originalSrc) parsed.originals[k] = localImgUrl })
    Object.keys(parsed.fields).forEach(k => { if (parsed.fields[k] === originalSrc) parsed.fields[k] = localImgUrl })
  }
  scheduleLive()
  toast(`✓ ${originalSrc.slice(-20)} reemplazada`)
  renderTab()
}

// ── Efectos ───────────────────────────────────────────────────────────────────
const EFFECTS = {
  nieve: `(function(){const c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);function sp(){const e=document.createElement('div');const s=6+Math.random()*10;e.style.cssText='position:absolute;top:-20px;left:'+Math.random()*100+'vw;width:'+s+'px;height:'+s+'px;background:rgba(255,255,255,0.85);border-radius:50%;animation:snowFall '+(4+Math.random()*6)+'s linear infinite;';c.appendChild(e);setTimeout(()=>e.remove(),(10+Math.random()*6)*1000);}if(!document.getElementById('snowKf')){const st=document.createElement('style');st.id='snowKf';st.textContent='@keyframes snowFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}';document.head.appendChild(st);}for(let i=0;i<30;i++)setTimeout(sp,i*200);setInterval(sp,600);})();`,
  confetti: `(function(){const cols=['#E60012','#009AC7','#F7C94B','#2ECC40','#FF8C00','#fff'];const c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);function sp(){const e=document.createElement('div');const col=cols[Math.floor(Math.random()*cols.length)];const w=6+Math.random()*8,h=w*0.4;e.style.cssText='position:absolute;top:-20px;left:'+Math.random()*100+'vw;width:'+w+'px;height:'+h+'px;background:'+col+';opacity:.85;animation:confFall '+(3+Math.random()*5)+'s linear infinite;';c.appendChild(e);setTimeout(()=>e.remove(),(8+Math.random()*5)*1000);}if(!document.getElementById('confKf')){const st=document.createElement('style');st.id='confKf';st.textContent='@keyframes confFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}';document.head.appendChild(st);}for(let i=0;i<40;i++)setTimeout(sp,i*150);setInterval(sp,400);})();`,
  burbujas: `(function(){const c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);function sp(){const e=document.createElement('div');const s=14+Math.random()*30;e.style.cssText='position:absolute;bottom:-40px;left:'+Math.random()*100+'vw;width:'+s+'px;height:'+s+'px;border:2px solid rgba(255,255,255,0.5);border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,0.35),transparent 70%);animation:bubbleUp '+(5+Math.random()*7)+'s ease-in infinite;';c.appendChild(e);setTimeout(()=>e.remove(),(12+Math.random()*7)*1000);}if(!document.getElementById('bubKf')){const st=document.createElement('style');st.id='bubKf';st.textContent='@keyframes bubbleUp{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-110vh) scale(0.5);opacity:0}}';document.head.appendChild(st);}for(let i=0;i<20;i++)setTimeout(sp,i*300);setInterval(sp,700);})();`,
  luciernas: `(function(){const c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000';document.body.appendChild(c);const cols=['#ffe066','#c0ff60','#60ffaa'];for(let i=0;i<22;i++){const e=document.createElement('div');const s=4+Math.random()*5;const col=cols[Math.floor(Math.random()*cols.length)];const dur=3+Math.random()*4;const dx=(Math.random()-0.5)*60,dy=(Math.random()-0.5)*60;e.style.cssText='position:absolute;left:'+Math.random()*95+'vw;top:'+(20+Math.random()*70)+'vh;width:'+s+'px;height:'+s+'px;background:'+col+';border-radius:50%;box-shadow:0 0 '+(s*3)+'px '+col+';animation:ff'+i+' '+dur+'s ease-in-out infinite alternate;';const st=document.createElement('style');st.textContent='@keyframes ff'+i+'{0%{transform:translate(0,0);opacity:0.2}50%{opacity:1}100%{transform:translate('+dx+'px,'+dy+'px);opacity:0.3}}';document.head.appendChild(st);c.appendChild(e);}})();`,
  petalos: `(function(){const c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);const emojis=['🌸','🌺','🌹','🌷'];function sp(){const e=document.createElement('div');e.textContent=emojis[Math.floor(Math.random()*emojis.length)];const s=0.7+Math.random()*1.2;e.style.cssText='position:absolute;top:-40px;left:'+Math.random()*100+'vw;font-size:'+s+'rem;opacity:0.8;animation:petalFall '+(5+Math.random()*6)+'s linear infinite;';c.appendChild(e);setTimeout(()=>e.remove(),(11+Math.random()*6)*1000);}if(!document.getElementById('petKf')){const st=document.createElement('style');st.id='petKf';st.textContent='@keyframes petalFall{0%{transform:translateY(-40px) rotate(0)}100%{transform:translateY(110vh) rotate(360deg)}}';document.head.appendChild(st);}for(let i=0;i<18;i++)setTimeout(sp,i*250);setInterval(sp,600);})();`
}

window.injectEffect = function(name) {
  const code = EFFECTS[name]
  if (!code) return
  const f = document.getElementById('f-extracss')
  if (!f) return
  if (f.value.includes('/* efecto:' + name + ' */')) { toast('Ese efecto ya está agregado', 'warn'); return }
  f.value = (f.value ? f.value + '\n\n' : '') + '/* efecto:' + name + ' */\n' + code
  scheduleLive()
  toast('✓ Efecto ' + name + ' agregado')
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────
const TA  = 'width:100%;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:6px;color:#e0e0e0;padding:8px;font-size:11px;font-family:inherit;resize:vertical;outline:none;'
const BTN = 'padding:6px 10px;border-radius:6px;border:1px solid #2a2a2a;background:#1a1a1a;color:#ccc;cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;gap:4px;'

function field(id, label, value = '', width = null, textarea = false) {
  const style = `width:${width ?? '100%'};background:#0f0f0f;border:1px solid #2a2a2a;border-radius:6px;color:#e0e0e0;padding:6px 8px;font-size:11px;font-family:inherit;outline:none;`
  return `<div style="margin-bottom:10px;${width ? 'flex:1;' : ''}">
    <label style="display:block;font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">${label}</label>
    ${textarea
      ? `<textarea id="${id}" style="${style}resize:vertical;" rows="2">${value ?? ''}</textarea>`
      : `<input id="${id}" value="${(value ?? '').replace(/"/g,'&quot;')}" style="${style}">`
    }
  </div>`
}

function row(fields) { return `<div style="display:flex;gap:8px">${fields.join('')}</div>` }
function cv(id) { return document.getElementById(id)?.value?.trim() ?? '' }

function updateCssChips(css) {
  const chips = document.getElementById('cssChips')
  if (!chips) return
  const ms = [...css.matchAll(/--[\w-]+\s*:\s*(#[0-9a-fA-F]{3,8})/g)]
  chips.innerHTML = ms.map(m => `<div title="${m[0].trim()}" style="width:18px;height:18px;border-radius:4px;background:${m[1]};border:1px solid #333;flex-shrink:0"></div>`).join('')
}

// ── Carga de plantilla ────────────────────────────────────────────────────────
function loadHtml(html, filename) {
  if (!html || html.trim().length < 50) { alert('Archivo vacío o inválido'); return }
  try {
    originalHtml  = html
    currentHtml   = null
    parsed        = parseTemplate(html)   // ← FIX: se llama AQUÍ
    window.parsed = parsed

    const s = document.getElementById('loadStatus')
    if (s) { s.style.display = 'block'; s.textContent = `✓ ${filename ?? 'Plantilla'} cargada — tipo: ${parsed.type}` }

    const dz = document.getElementById('dropZone')
    if (dz) { dz.style.borderColor = '#639922'; setTimeout(() => { dz.style.borderColor = '#2a2a2a' }, 2000) }

    const badge = document.getElementById('statusBadge')
    if (badge) { badge.textContent = `${filename ?? 'HTML'} · ${parsed.type}`; badge.style.background = '#1a2e0f'; badge.style.color = '#c0dd97' }

    const count = Object.values(parsed.fields).filter(Boolean).length
    toast(`✓ ${count} campos detectados · Plantilla ${parsed.type}`)

    renderTab()
    if (liveActive) updateLive()
  } catch(e) {
    console.error('loadHtml error:', e)
    alert('Error al cargar la plantilla: ' + e.message)
  }
}

document.getElementById('fileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return
  const r = new FileReader()
  r.onload = ev => loadHtml(ev.target.result, f.name)
  r.onerror = () => alert('Error leyendo el archivo')
  r.readAsText(f, 'utf-8')
  e.target.value = ''
})

const dz = document.getElementById('dropZone')
;['dragenter','dragover'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.style.borderColor = '#639922' }))
;['dragleave','dragend'].forEach(evt => dz.addEventListener(evt, () => { dz.style.borderColor = '#2a2a2a' }))
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.style.borderColor = '#2a2a2a'
  const f = e.dataTransfer.files[0]; if (!f) return
  const r = new FileReader()
  r.onload = ev => loadHtml(ev.target.result, f.name)
  r.onerror = () => alert('Error leyendo el archivo')
  r.readAsText(f, 'utf-8')
})

// ── Recopilar campos ──────────────────────────────────────────────────────────
function getFields() {
  return {
    titulo:       cv('f-titulo'),
    nombre:       cv('f-nombre'),
    dia:          cv('f-dia'),
    mes:          cv('f-mes'),
    anio:         cv('f-anio'),
    hora:         cv('f-hora'),
    salon:        cv('f-salon'),
    addr1:        cv('f-addr1'),
    addr2:        cv('f-addr2'),
    mapsQuery:    cv('f-maps'),
    msgSi:        cv('f-msgsi'),
    footerTxt:    cv('f-footer'),
    coverImg:     cv('f-cover') || parsed?.fields?.coverImg || '',
    heroImg:      cv('f-hero')  || parsed?.fields?.heroImg  || '',
    gifSi:        cv('f-gifsi') || parsed?.fields?.gifSi    || '',
    gifNo:        cv('f-gifno') || parsed?.fields?.gifNo    || '',
    tStars:       cv('f-stars'),
    footerEmojis: cv('f-femojis'),
    rainPool:     cv('f-rain'),
  }
}

function getExtra() {
  return { cssRoot: cv('f-cssroot'), extraCss: cv('f-extracss'), temaReps }
}

// ── Aplicar y exportar ────────────────────────────────────────────────────────
document.getElementById('btnApply').addEventListener('click', () => {
  if (!originalHtml) { toast('Cargá una plantilla primero', 'warn'); return }
  currentHtml = applyChanges(originalHtml, parsed.originals, getFields(), getExtra())
  toast('✓ Cambios aplicados')
  if (liveActive) updateLive()
})

document.getElementById('btnExport').addEventListener('click', () => {
  if (!originalHtml) { toast('Cargá una plantilla primero', 'warn'); return }
  const html = currentHtml ?? applyChanges(originalHtml, parsed.originals, getFields(), getExtra())
  const slug = (cv('f-nombre') || 'invitacion').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  a.download = `invitar-${slug}.html`; a.click(); URL.revokeObjectURL(a.href)
  toast('✓ HTML exportado')
  saveToSupabase(html, slug)
})

async function saveToSupabase(html, name) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const filename = `${user.id}/${name}-${Date.now()}.html`
    const { error } = await supabase.storage.from('invitations').upload(filename, new Blob([html], { type: 'text/html' }), { upsert: true })
    if (!error) toast('✓ Guardado en Supabase Storage')
  } catch {}
}

// ── Visor en vivo ─────────────────────────────────────────────────────────────
let liveScale = 'mobile'
let liveBlobUrl = null
const frame = document.getElementById('liveFrame')

function toggleLive() {
  if (!originalHtml) { toast('Cargá una plantilla primero', 'warn'); return }
  liveActive = !liveActive
  const btn = document.getElementById('btnLive')
  if (liveActive) { btn.textContent = '⏸ Pausar visor'; btn.style.background = '#1a2e0f'; btn.style.color = '#c0dd97'; updateLive() }
  else            { btn.textContent = '▶ Activar visor'; btn.style.background = '#2a2a2a'; btn.style.color = '#aaa'; }
}
window.toggleLive = toggleLive

function refreshLive() { if (originalHtml) { liveActive = true; iframeReady = false; updateLive() } }
window.refreshLive = refreshLive

function setScale(s) { liveScale = s; resizeFrame() }
window.setScale = setScale

function openInvite() {
  if (!liveActive || !iframeReady) { toast('Activá el visor primero', 'warn'); return }
  try {
    const d = frame.contentDocument ?? frame.contentWindow.document
    const btn = d.getElementById('btnOpen') ?? d.querySelector('.btn-open')
    if (btn) { btn.click(); toast('✓ Invitación abierta') }
    else {
      const cover = d.getElementById('cover-screen') ?? d.querySelector('[id*="cover"]')
      const main  = d.getElementById('main-invite')  ?? d.querySelector('[id*="main-invite"]')
      if (cover) { cover.style.display = 'none'; cover.style.opacity = '0' }
      if (main)  { main.classList.remove('hidden'); main.style.display = '' }
      toast(cover || main ? '✓ Portada omitida' : 'No se encontró portada', cover || main ? 'ok' : 'warn')
    }
  } catch(e) { toast('Error: ' + e.message, 'warn') }
}
window.openInvite = openInvite

function resizeFrame() {
  const wrap = document.getElementById('iframeWrap')
  if (!wrap || !frame) return
  if (liveScale === 'mobile') {
    const W = 375, scale = Math.min(1, (wrap.offsetWidth - 32) / W)
    frame.style.width = W + 'px'; frame.style.height = '720px'
    frame.style.transform = scale < 1 ? `scale(${scale.toFixed(3)})` : 'none'
    frame.style.transformOrigin = 'top center'
  } else {
    frame.style.width = '100%'; frame.style.height = '720px'; frame.style.transform = 'none'
  }
}

function updateLive(keepScroll = false) {
  if (!originalHtml || !liveActive) return
  const html = applyChanges(originalHtml, parsed.originals, getFields(), getExtra())
  const dot = document.getElementById('liveDot')
  if (dot) dot.style.background = '#ba7517'

  let scroll = 0
  if (keepScroll && iframeReady) { try { scroll = frame.contentWindow.scrollY ?? 0 } catch {} }

  document.getElementById('liveEmpty').style.display = 'none'
  frame.style.display = 'block'
  resizeFrame()

  if (liveBlobUrl) { URL.revokeObjectURL(liveBlobUrl); liveBlobUrl = null }
  liveBlobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))

  iframeReady = false
  frame.onload = () => {
    iframeReady = true
    if (scroll) try { frame.contentWindow.scrollTo({ top: scroll, behavior: 'instant' }) } catch {}
    if (dot) dot.style.background = '#639922'
  }
  frame.src = liveBlobUrl
}

function scheduleLive() {
  clearTimeout(liveTimer)
  if (!liveActive) return
  liveTimer = setTimeout(() => updateLive(true), 700)
}

// ── Temática parser ───────────────────────────────────────────────────────────
window.parseTema = function () {
  const raw = cv('f-temaraw'); if (!raw) return
  const log = []
  const rm = raw.match(/:root\s*\{([^}]+)\}/s)
  if (rm) {
    const f = document.getElementById('f-cssroot')
    if (f) f.value = `:root {\n${rm[1]}\n}`
    updateCssChips(f?.value ?? '')
    log.push('Paleta CSS')
  }
  const imports = raw.match(/@import\s+url\([^)]+\)[^;]*;/g)
  if (imports) {
    const f = document.getElementById('f-extracss')
    if (f) f.value = imports.join('\n') + (f.value ? '\n\n' + f.value : '')
    log.push('Tipografía @import')
  }
  temaReps = []
  raw.split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('//') || line.startsWith(':root')) return
    for (const arrow of [' → ', ' -> ', ' => ']) {
      if (line.includes(arrow)) {
        const parts = line.split(arrow)
        const s = parts[0].trim(), r = parts.slice(1).join(arrow).trim()
        if (s && r && s !== r && s.length > 3) temaReps.push({ s, r, lbl: s.slice(0, 35) })
        break
      }
    }
  })
  if (temaReps.length) log.push(temaReps.length + ' reemplazos')
  const st = document.getElementById('temaStatus')
  if (st) st.textContent = log.length ? '✓ ' + log.join(' · ') : 'Sin datos detectados'
  renderTemaList()
  scheduleLive()
  toast('✓ Temática aplicada')
}

function renderTemaList() {
  const el = document.getElementById('temaList'); if (!el) return
  if (!temaReps.length) { el.innerHTML = ''; return }
  el.innerHTML = `<div style="font-size:10px;color:#666;margin-bottom:6px">${temaReps.length} reemplazos cargados</div>` +
    temaReps.map((r, i) => `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:#0f0f0f;border-radius:4px;margin-bottom:3px">
      <span style="flex:1;font-size:9px;color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.lbl}</span>
      <button onclick="delTema(${i})" style="border:none;background:none;color:#555;cursor:pointer;font-size:13px;line-height:1;flex-shrink:0">×</button>
    </div>`).join('')
}
window.delTema = (i) => { temaReps.splice(i, 1); renderTemaList(); scheduleLive() }

// ── Cargador de imagen local ──────────────────────────────────────────────────
function initImgLoader() {
  const input = document.getElementById('imgInput')
  const drop  = document.getElementById('imgDrop')
  if (!input || !drop) return
  function loadImg(file) {
    if (!file?.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = e => {
      localImgUrl = e.target.result
      const thumb = document.getElementById('imgThumb'); if (thumb) thumb.src = localImgUrl
      const name  = document.getElementById('imgName');  if (name)  name.textContent = file.name + ' · ' + (file.size/1024).toFixed(0) + ' KB'
      const prev  = document.getElementById('imgPreview'); if (prev) prev.style.display = 'block'
    }
    r.readAsDataURL(file)
  }
  input.addEventListener('change', e => { if (e.target.files[0]) loadImg(e.target.files[0]); e.target.value = '' })
  ;['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = '#639922' }))
  ;['dragleave','dragend'].forEach(ev => drop.addEventListener(ev, () => { drop.style.borderColor = '#2a2a2a' }))
  drop.addEventListener('drop', e => { e.preventDefault(); drop.style.borderColor = '#2a2a2a'; loadImg(e.dataTransfer.files[0]) })
}

window.useImgAs = function(target) {
  if (!localImgUrl) { toast('Cargá una imagen primero', 'warn'); return }
  const map = { cover:'f-cover', 'cover-img':'f-cover', hero:'f-hero', gifsi:'f-gifsi', gifno:'f-gifno' }
  if (map[target]) {
    const f = document.getElementById(map[target]); if (f) f.value = localImgUrl
  } else if (target === 'cover' || target === 'main') {
    const f = document.getElementById('f-extracss')
    const sel = target === 'cover' ? '#cover-screen' : '#main-invite'
    const css = '\n' + sel + ' { background-image: url("' + localImgUrl + '") !important; background-size: cover !important; background-position: center !important; }\n'
    if (f) f.value = (f.value + css)
  }
  scheduleLive()
  toast('✓ Imagen aplicada')
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const MASTER_KEY = '124578963#'

function showLoginScreen() {
  const overlay = document.createElement('div')
  overlay.id = 'loginOverlay'
  overlay.style.cssText = 'position:fixed;inset:0;background:#0f0f0f;z-index:99999;display:flex;align-items:center;justify-content:center;'
  overlay.innerHTML = `
    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:36px 32px;width:320px;text-align:center">
      <div style="font-weight:700;font-size:18px;color:#c0dd97;margin-bottom:4px">InvitAR Studio</div>
      <div style="font-size:11px;color:#555;margin-bottom:24px">Acceso privado</div>
      <input id="loginInput" type="password" placeholder="Contraseña"
        style="width:100%;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:6px;color:#e0e0e0;padding:10px 12px;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;text-align:center"
        onkeydown="if(event.key==='Enter') window._doLogin()">
      <div id="loginError" style="font-size:10px;color:#e24b4a;margin-bottom:8px;min-height:14px"></div>
      <button onclick="window._doLogin()" style="width:100%;padding:10px;border-radius:6px;border:none;background:#c0dd97;color:#0f0f0f;cursor:pointer;font-size:13px;font-weight:700">Entrar</button>
    </div>
  `
  document.body.appendChild(overlay)
  setTimeout(() => document.getElementById('loginInput')?.focus(), 50)
}

window._doLogin = function() {
  const val = document.getElementById('loginInput')?.value ?? ''
  if (val === MASTER_KEY) {
    sessionStorage.setItem('invitar_auth', '1')
    document.getElementById('loginOverlay')?.remove()
    supabase.auth.signInAnonymously().catch(() => {})
  } else {
    const err = document.getElementById('loginError')
    if (err) { err.textContent = 'Contraseña incorrecta'; setTimeout(() => err.textContent = '', 2000) }
    document.getElementById('loginInput').value = ''
    document.getElementById('loginInput').focus()
  }
}

if (sessionStorage.getItem('invitar_auth') === '1') {
  supabase.auth.signInAnonymously().catch(() => {})
} else {
  showLoginScreen()
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const t = document.createElement('div')
  t.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type==='warn'?'#2e1a0a':'#1a2e0f'};color:${type==='warn'?'#f0a060':'#c0dd97'};padding:10px 16px;border-radius:8px;font-size:11px;z-index:9999;max-width:300px;line-height:1.5;box-shadow:0 4px 20px rgba(0,0,0,.5);border:1px solid ${type==='warn'?'#4a2a0a':'#2d4a1e'}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 4000)
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderTab()
