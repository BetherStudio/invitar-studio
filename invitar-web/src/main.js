import { createClient } from '@supabase/supabase-js'
import { parseTemplate, applyChanges } from './parser.js'

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Estado global ─────────────────────────────────────────────────────────────
let originalHtml = null
let parsed       = null   // { type, cssRoot, originals, fields }
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
      <iframe id="liveFrame" style="display:none;border:none;border-radius:8px;box-shadow:0 4px 32px rgba(0,0,0,.5);transition:.2s" sandbox="allow-scripts allow-same-origin"></iframe>
    </div>
  </div>

</div>
`

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ['evento', 'colores', 'efectos', 'tematica', 'imagen']
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
    ${field('f-cover',    'Cover img (archivo o URL)', f.coverImg)}
    ${field('f-hero',     'Hero img (archivo o URL)',  f.heroImg)}
    ${row([field('f-gifsi','GIF Sí',f.gifSi), field('f-gifno','GIF No',f.gifNo)])}
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
    <div style="font-size:10px;color:#888;margin-bottom:10px">CSS adicional inyectado en la invitación</div>
    <textarea id="f-extracss" style="${TA}" rows="10" placeholder="/* CSS extra */\n.mi-clase { color: red; }"></textarea>
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
    el.innerHTML = `
    <div style="font-size:10px;color:#888;margin-bottom:8px">Cargá una imagen desde tu PC para usarla en la invitación</div>
    <div id="imgDrop" style="border:2px dashed #2a2a2a;border-radius:8px;padding:20px;text-align:center;cursor:pointer;background:#0f0f0f;transition:.15s" onclick="document.getElementById('imgInput').click()">
      <input type="file" id="imgInput" accept="image/*" style="display:none">
      <i class="ti ti-upload" style="font-size:24px;color:#555;display:block;margin-bottom:6px"></i>
      <div style="color:#777;font-size:11px">Arrastrá o hacé clic</div>
      <div style="color:#555;font-size:10px;margin-top:2px">PNG, JPG, WebP, GIF</div>
    </div>
    <div id="imgPreview" style="display:none;margin-top:12px">
      <div style="background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/12px 12px;border-radius:8px;overflow:hidden;max-height:200px;display:flex;align-items:center;justify-content:center;margin-bottom:10px">
        <img id="imgThumb" style="max-width:100%;max-height:200px;object-fit:contain">
      </div>
      <div id="imgName" style="font-size:10px;color:#888;margin-bottom:8px"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button onclick="useImgAs('cover')" style="${BTN}"><i class="ti ti-layout-bottombar" style="font-size:11px"></i> Fondo portada</button>
        <button onclick="useImgAs('main')" style="${BTN}"><i class="ti ti-background" style="font-size:11px"></i> Fondo scroll</button>
        <button onclick="useImgAs('hero')" style="${BTN}"><i class="ti ti-user" style="font-size:11px"></i> Hero img</button>
        <button onclick="useImgAs('cover-img')" style="${BTN}"><i class="ti ti-photo" style="font-size:11px"></i> Cover img</button>
        <button onclick="useImgAs('gifsi')" style="${BTN}"><i class="ti ti-mood-happy" style="font-size:11px"></i> GIF Sí</button>
        <button onclick="useImgAs('gifno')" style="${BTN}"><i class="ti ti-mood-sad" style="font-size:11px"></i> GIF No</button>
      </div>
    </div>
    `
    initImgLoader()
  }

  // Bind live updates
  document.querySelectorAll('#tabContent input, #tabContent textarea, #tabContent select').forEach(el => {
    el.addEventListener('input', scheduleLive)
  })
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

function row(fields) {
  return `<div style="display:flex;gap:8px">${fields.join('')}</div>`
}

function cv(id) {
  return document.getElementById(id)?.value?.trim() ?? ''
}

function updateCssChips(css) {
  const chips = document.getElementById('cssChips')
  if (!chips) return
  const ms = [...css.matchAll(/--[\w-]+\s*:\s*(#[0-9a-fA-F]{3,8})/g)]
  chips.innerHTML = ms.map(m => `<div title="${m[0].trim()}" style="width:18px;height:18px;border-radius:4px;background:${m[1]};border:1px solid #333;flex-shrink:0"></div>`).join('')
}

// ── Carga de plantilla ────────────────────────────────────────────────────────
function loadHtml(html, filename) {
  if (!html || html.trim().length < 50) { alert('Archivo vacío o inválido'); return }
  originalHtml = html
  currentHtml  = null
  parsed       = parseTemplate(html)

  const s = document.getElementById('loadStatus')
  if (s) { s.style.display = 'block'; s.textContent = `✓ ${filename ?? 'Plantilla'} cargada — tipo: ${parsed.type}` }

  const dz = document.getElementById('dropZone')
  if (dz) { dz.style.borderColor = '#639922'; setTimeout(() => { dz.style.borderColor = '#2a2a2a' }, 2000) }

  const badge = document.getElementById('statusBadge')
  if (badge) { badge.textContent = `${filename ?? 'HTML'} · ${parsed.type}`; badge.style.background = '#1a2e0f'; badge.style.color = '#c0dd97' }

  // Toast
  toast(`✓ ${Object.values(parsed.fields).filter(Boolean).length} campos detectados · Plantilla ${parsed.type}`)

  renderTab()
  if (liveActive) updateLive()
}

document.getElementById('fileInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return
  const r = new FileReader(); r.onload = ev => loadHtml(ev.target.result, f.name); r.readAsText(f, 'utf-8')
  e.target.value = ''
})
const dz = document.getElementById('dropZone')
;['dragenter','dragover'].forEach(evt => dz.addEventListener(evt, e => { e.preventDefault(); dz.style.borderColor = '#639922' }))
;['dragleave','dragend'].forEach(evt => dz.addEventListener(evt, () => { dz.style.borderColor = '#2a2a2a' }))
dz.addEventListener('drop', e => {
  e.preventDefault(); dz.style.borderColor = '#2a2a2a'
  const f = e.dataTransfer.files[0]; if (!f) return
  const r = new FileReader(); r.onload = ev => loadHtml(ev.target.result, f.name); r.readAsText(f, 'utf-8')
})

// ── Recopilar campos del formulario ──────────────────────────────────────────
function getFields() {
  return {
    titulo:      cv('f-titulo'),
    nombre:      cv('f-nombre'),
    dia:         cv('f-dia'),
    mes:         cv('f-mes'),
    anio:        cv('f-anio'),
    hora:        cv('f-hora'),
    salon:       cv('f-salon'),
    addr1:       cv('f-addr1'),
    addr2:       cv('f-addr2'),
    mapsQuery:   cv('f-maps'),
    msgSi:       cv('f-msgsi'),
    footerTxt:   cv('f-footer'),
    coverImg:    cv('f-cover'),
    heroImg:     cv('f-hero'),
    gifSi:       cv('f-gifsi'),
    gifNo:       cv('f-gifno'),
    tStars:      cv('f-stars'),
    footerEmojis:cv('f-femojis'),
    rainPool:    cv('f-rain'),
  }
}

function getExtra() {
  return {
    cssRoot:   cv('f-cssroot'),
    extraCss:  cv('f-extracss'),
    temaReps,
  }
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
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  a.download = `invitar-${slug}.html`; a.click(); URL.revokeObjectURL(a.href)
  toast('✓ HTML exportado')
  // Guardar en Supabase si está logueado
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

function setScale(s) {
  liveScale = s
  resizeFrame()
}
window.setScale = setScale

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

  if (!iframeReady) {
    frame.onload = () => { iframeReady = true; if (scroll) try { frame.contentWindow.scrollTo({ top: scroll, behavior: 'instant' }) } catch {}; if (dot) dot.style.background = '#639922' }
    frame.srcdoc = html
  } else {
    try {
      const doc = frame.contentDocument ?? frame.contentWindow.document
      doc.open(); doc.write(html); doc.close()
      setTimeout(() => { if (scroll) try { frame.contentWindow.scrollTo({ top: scroll, behavior: 'instant' }) } catch {}; if (dot) dot.style.background = '#639922' }, 60)
    } catch { iframeReady = false; frame.onload = () => { iframeReady = true; if (dot) dot.style.background = '#639922' }; frame.srcdoc = html }
  }
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

  // :root
  const rm = raw.match(/:root\s*\{([^}]+)\}/s)
  if (rm) {
    const f = document.getElementById('f-cssroot')
    if (f) f.value = `:root {\n${rm[1]}\n}`
    updateCssChips(f?.value ?? '')
    log.push('Paleta CSS')
  }

  // @import
  const imports = raw.match(/@import\s+url\([^)]+\)[^;]*;/g)
  if (imports) {
    const f = document.getElementById('f-extracss')
    if (f) f.value = imports.join('\n') + (f.value ? '\n\n' + f.value : '')
    log.push('Tipografía @import')
  }

  // Reemplazos con →
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
      const thumb = document.getElementById('imgThumb')
      if (thumb) thumb.src = localImgUrl
      const name = document.getElementById('imgName')
      if (name) name.textContent = file.name + ' · ' + (file.size / 1024).toFixed(0) + ' KB'
      const prev = document.getElementById('imgPreview')
      if (prev) prev.style.display = 'block'
    }
    r.readAsDataURL(file)
  }

  input.addEventListener('change', e => { if (e.target.files[0]) loadImg(e.target.files[0]); e.target.value = '' })
  ;['dragenter','dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.style.borderColor = '#639922' }))
  ;['dragleave','dragend'].forEach(ev => drop.addEventListener(ev, () => { drop.style.borderColor = '#2a2a2a' }))
  drop.addEventListener('drop', e => { e.preventDefault(); drop.style.borderColor = '#2a2a2a'; loadImg(e.dataTransfer.files[0]) })
}

window.useImgAs = function (target) {
  if (!localImgUrl) { toast('Cargá una imagen primero', 'warn'); return }
  const map = { cover: 'f-cover', 'cover-img': 'f-cover', hero: 'f-hero', gifsi: 'f-gifsi', gifno: 'f-gifno' }
  if (map[target]) {
    const f = document.getElementById(map[target]); if (f) f.value = localImgUrl
  } else if (target === 'cover' || target === 'main') {
    // Fondo: inyectar como CSS en extra
    const f = document.getElementById('f-extracss')
    const sel = target === 'cover' ? '#cover-screen' : '#main-invite'
    const css = `\n${sel} { background-image: url("${localImgUrl}") !important; background-size: cover !important; background-position: center !important; }\n`
    if (f) f.value = (f.value + css)
  }
  scheduleLive()
  toast('✓ Imagen aplicada')
}

// ── Supabase Auth (básico) ────────────────────────────────────────────────────
supabase.auth.getSession().then(({ data }) => {
  if (!data.session) {
    // Auto login anónimo si no hay sesión
    supabase.auth.signInAnonymously().catch(() => {})
  }
})

// ── Utils ────────────────────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const t = document.createElement('div')
  t.style.cssText = `position:fixed;bottom:20px;right:20px;background:${type === 'warn' ? '#2e1a0a' : '#1a2e0f'};color:${type === 'warn' ? '#f0a060' : '#c0dd97'};padding:10px 16px;border-radius:8px;font-size:11px;z-index:9999;max-width:300px;line-height:1.5;box-shadow:0 4px 20px rgba(0,0,0,.5);border:1px solid ${type === 'warn' ? '#4a2a0a' : '#2d4a1e'}`
  t.textContent = msg
  document.body.appendChild(t)
  setTimeout(() => t.remove(), 4000)
}

// ── Init ─────────────────────────────────────────────────────────────────────
renderTab()
