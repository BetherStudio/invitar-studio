import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── Estado global ─────────────────────────────────────────────────────────────
let originalHtml  = null
let currentHtml   = null
let parsed        = null
let temaReps      = []
let manualReps    = []
let localImgUrl   = null
let liveActive    = false
let iframeReady   = false
let liveTimer     = null
let liveBlobUrl   = null
let liveScale     = 'mobile'
let activeView    = 'library' // library | editor | assets
let categories    = []
let templates     = []
let assets        = []
let activeCategory = null

const frame = document.getElementById('root')

// ── AUTH ──────────────────────────────────────────────────────────────────────
const MASTER_KEY = '124578963#'

function showLogin() {
  document.getElementById('root').innerHTML = `
  <div style="position:fixed;inset:0;background:#0f0f0f;display:flex;align-items:center;justify-content:center;font-family:'Inter',system-ui,sans-serif">
    <div style="background:#141414;border:1px solid #2a2a2a;border-radius:12px;padding:40px 32px;width:320px;text-align:center">
      <div style="font-size:28px;margin-bottom:8px">🎉</div>
      <div style="font-weight:700;font-size:18px;color:#c0dd97;margin-bottom:4px">InvitAR Studio</div>
      <div style="font-size:11px;color:#555;margin-bottom:24px">Sistema de gestión de invitaciones</div>
      <input id="loginInput" type="password" placeholder="Contraseña"
        style="width:100%;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:6px;color:#e0e0e0;
               padding:10px 12px;font-size:13px;outline:none;margin-bottom:10px;text-align:center"
        onkeydown="if(event.key==='Enter')window._doLogin()">
      <div id="loginError" style="font-size:10px;color:#e24b4a;margin-bottom:8px;min-height:14px"></div>
      <button onclick="window._doLogin()"
        style="width:100%;padding:10px;border-radius:6px;border:none;background:#c0dd97;
               color:#0f0f0f;cursor:pointer;font-size:13px;font-weight:700">Entrar</button>
    </div>
  </div>`
  setTimeout(() => document.getElementById('loginInput')?.focus(), 50)
}

window._doLogin = function() {
  const val = document.getElementById('loginInput')?.value ?? ''
  if (val === MASTER_KEY) {
    sessionStorage.setItem('invitar_auth', '1')
    init()
  } else {
    const err = document.getElementById('loginError')
    if (err) { err.textContent = 'Contraseña incorrecta'; setTimeout(() => err.textContent = '', 2000) }
    document.getElementById('loginInput').value = ''
    document.getElementById('loginInput').focus()
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function init() {
  renderShell()
  await loadCategories()
  await loadTemplates()
  await loadAssets()
  renderLibrary()
}

// ── SHELL ─────────────────────────────────────────────────────────────────────
function renderShell() {
  document.getElementById('root').innerHTML = `
  <div id="app" style="display:flex;flex-direction:column;height:100vh;background:#0f0f0f;color:#e0e0e0;font-family:'Inter',system-ui,sans-serif;font-size:12px">

    <!-- TOPBAR -->
    <div style="display:flex;align-items:center;gap:12px;padding:0 18px;height:48px;background:#171717;border-bottom:1px solid #2a2a2a;flex-shrink:0">
      <span style="font-size:16px">🎉</span>
      <span style="font-weight:700;font-size:14px;color:#c0dd97">InvitAR Studio</span>
      <div style="display:flex;gap:2px;margin-left:16px">
        <button onclick="showView('library')" id="nav-library" class="navbtn active">📚 Biblioteca</button>
        <button onclick="showView('editor')"  id="nav-editor"  class="navbtn">✏️ Editor</button>
        <button onclick="showView('assets')"  id="nav-assets"  class="navbtn">🖼️ Imágenes</button>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px" id="editorActions" style="display:none">
        <button id="btnApply"  onclick="applyChanges()" style="padding:6px 14px;border-radius:6px;border:none;background:#2d4a1e;color:#c0dd97;cursor:pointer;font-size:11px;font-weight:600;display:none">Aplicar</button>
        <button id="btnExport" onclick="exportHtml()"   style="padding:6px 14px;border-radius:6px;border:none;background:#c0dd97;color:#0f0f0f;cursor:pointer;font-size:11px;font-weight:700;display:none">Exportar HTML</button>
        <button id="btnSaveTemplate" onclick="saveTemplate()" style="padding:6px 14px;border-radius:6px;border:none;background:#1a2e4a;color:#97c0dd;cursor:pointer;font-size:11px;font-weight:600;display:none">💾 Guardar plantilla</button>
      </div>
    </div>

    <!-- MAIN -->
    <div id="mainContent" style="flex:1;overflow:hidden;display:flex"></div>
  </div>

  <style>
    .navbtn { padding:6px 14px;border-radius:6px;border:none;background:none;color:#888;cursor:pointer;font-size:11px;font-weight:500;transition:.1s }
    .navbtn:hover { background:#2a2a2a;color:#ccc }
    .navbtn.active { background:#2a2a2a;color:#c0dd97 }
    .cat-card { background:#141414;border:1px solid #2a2a2a;border-radius:10px;padding:16px;cursor:pointer;transition:.15s;text-align:center }
    .cat-card:hover { border-color:#444;background:#1a1a1a }
    .cat-card.active { border-color:#639922;background:#1a2e0f }
    .tpl-card { background:#141414;border:1px solid #2a2a2a;border-radius:10px;overflow:hidden;cursor:pointer;transition:.15s }
    .tpl-card:hover { border-color:#444;transform:translateY(-2px) }
    .asset-card { background:#141414;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;cursor:pointer;transition:.15s }
    .asset-card:hover { border-color:#444 }
    .tab { padding:8px 12px;border:none;background:none;color:#666;cursor:pointer;font-size:10px;font-weight:400;border-bottom:2px solid transparent;white-space:nowrap;transition:.1s;font-family:inherit }
    .tab.on { color:#c0dd97;font-weight:600;border-bottom-color:#c0dd97 }
    .inp { width:100%;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:6px;color:#e0e0e0;padding:6px 8px;font-size:11px;font-family:inherit;outline:none }
    .inp:focus { border-color:#444 }
    .ta { width:100%;background:#0f0f0f;border:1px solid #2a2a2a;border-radius:6px;color:#e0e0e0;padding:8px;font-size:11px;font-family:inherit;resize:vertical;outline:none }
    .btn { display:inline-flex;align-items:center;gap:5px;padding:6px 12px;font-size:11px;font-weight:500;border:1px solid #2a2a2a;border-radius:6px;cursor:pointer;background:#1a1a1a;color:#ccc;font-family:inherit;white-space:nowrap }
    .btn:hover { background:#252525 }
    .btn-go { background:#639922;color:#fff;border-color:#639922 }
    .btn-go:hover { background:#4a7a18 }
    .lbl { display:block;font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px }
    .fg { margin-bottom:10px }
    .sep { height:1px;background:#2a2a2a;margin:12px 0 }
    ::-webkit-scrollbar { width:5px;height:5px }
    ::-webkit-scrollbar-track { background:transparent }
    ::-webkit-scrollbar-thumb { background:#333;border-radius:99px }
    @keyframes spin { to { transform:rotate(360deg) } }
  </style>`
}

// ── NAV ───────────────────────────────────────────────────────────────────────
window.showView = function(view) {
  activeView = view
  document.querySelectorAll('.navbtn').forEach(b => b.classList.remove('active'))
  document.getElementById('nav-' + view)?.classList.add('active')
  const ea = document.getElementById('editorActions')
  if (view === 'editor') {
    if (ea) ea.style.display = 'flex'
    ;['btnApply','btnExport','btnSaveTemplate'].forEach(id => {
      const el = document.getElementById(id); if(el) el.style.display = ''
    })
  } else {
    ;['btnApply','btnExport','btnSaveTemplate'].forEach(id => {
      const el = document.getElementById(id); if(el) el.style.display = 'none'
    })
  }
  if (view === 'library') renderLibrary()
  else if (view === 'editor') renderEditor()
  else if (view === 'assets') renderAssets()
}

// ══════════════════════════════════════════════════════════════════════════════
// BIBLIOTECA
// ══════════════════════════════════════════════════════════════════════════════
async function loadCategories() {
  const { data } = await supabase.from('categories').select('*').order('name')
  categories = data ?? []
}

async function loadTemplates(catId) {
  let q = supabase.from('templates').select('*').order('name')
  if (catId) q = q.eq('category_id', catId)
  const { data } = await q
  templates = data ?? []
}

async function loadAssets(catId) {
  let q = supabase.from('assets').select('*').order('name')
  if (catId) q = q.eq('category_id', catId)
  const { data } = await q
  assets = data ?? []
}

function renderLibrary() {
  const mc = document.getElementById('mainContent')
  mc.innerHTML = `
  <div style="display:flex;width:100%;height:100%;overflow:hidden">

    <!-- SIDEBAR CATEGORÍAS -->
    <div style="width:200px;flex-shrink:0;background:#141414;border-right:1px solid #2a2a2a;display:flex;flex-direction:column">
      <div style="padding:12px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px">Categorías</span>
        <button onclick="addCategory()" style="margin-left:auto;border:none;background:none;color:#639922;cursor:pointer;font-size:18px;line-height:1" title="Nueva categoría">+</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:8px">
        <div onclick="filterCategory(null)" class="cat-item ${!activeCategory?'active':''}"
          style="padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:2px;font-size:11px;display:flex;align-items:center;gap:8px;${!activeCategory?'background:#1a2e0f;color:#c0dd97':'color:#888'}">
          <span>📚</span> Todas
        </div>
        ${categories.map(c => `
        <div onclick="filterCategory('${c.id}')" class="cat-item"
          style="padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:2px;font-size:11px;display:flex;align-items:center;gap:8px;${activeCategory===c.id?'background:#1a2e0f;color:#c0dd97':'color:#aaa'}"
          oncontextmenu="catContextMenu(event,'${c.id}')">
          <span>${c.icon}</span> ${c.name}
          <span style="margin-left:auto;font-size:9px;color:#555">${templates.filter(t=>t.category_id===c.id).length}</span>
        </div>`).join('')}
      </div>
    </div>

    <!-- MAIN BIBLIOTECA -->
    <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column">

      <!-- TOOLBAR -->
      <div style="padding:12px 16px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:10px;flex-shrink:0;background:#141414">
        <span style="font-size:13px;font-weight:600">${activeCategory ? categories.find(c=>c.id===activeCategory)?.name ?? 'Biblioteca' : 'Todas las plantillas'}</span>
        <span style="font-size:10px;color:#555">${templates.length} plantillas</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button onclick="uploadNewTemplate()" class="btn btn-go">+ Nueva plantilla</button>
        </div>
      </div>

      <!-- GRID PLANTILLAS -->
      <div style="padding:16px;flex:1">
        ${templates.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:#444">
          <div style="font-size:48px;margin-bottom:12px;opacity:.3">📭</div>
          <div style="font-size:13px;margin-bottom:8px">Sin plantillas todavía</div>
          <div style="font-size:11px;color:#333">Hacé clic en "Nueva plantilla" para subir tu primer HTML</div>
        </div>` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">
          ${templates.map(t => `
          <div class="tpl-card" onclick="openTemplate('${t.id}')">
            <div style="height:120px;background:#0a0a0a;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
              ${t.thumbnail_url
                ? `<img src="${t.thumbnail_url}" style="width:100%;height:100%;object-fit:cover">`
                : `<span style="font-size:36px;opacity:.2">🎉</span>`}
              <div style="position:absolute;top:6px;right:6px">
                <span style="background:rgba(0,0,0,.7);color:#888;font-size:9px;padding:2px 6px;border-radius:4px">${categories.find(c=>c.id===t.category_id)?.icon??'🎉'}</span>
              </div>
            </div>
            <div style="padding:10px 12px">
              <div style="font-size:12px;font-weight:600;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
              <div style="font-size:10px;color:#555;display:flex;align-items:center;justify-content:space-between">
                <span>${categories.find(c=>c.id===t.category_id)?.name??'Sin categoría'}</span>
                <span style="display:flex;gap:8px">
                  <button onclick="event.stopPropagation();editTemplate('${t.id}')" style="border:none;background:none;color:#639922;cursor:pointer;font-size:11px">✏️</button>
                  <button onclick="event.stopPropagation();deleteTemplate('${t.id}')" style="border:none;background:none;color:#e24b4a;cursor:pointer;font-size:11px">🗑️</button>
                </span>
              </div>
            </div>
          </div>`).join('')}
        </div>`}
      </div>
    </div>
  </div>`
}

window.filterCategory = async function(catId) {
  activeCategory = catId
  await loadTemplates(catId)
  renderLibrary()
}

window.addCategory = function() {
  const name = prompt('Nombre de la nueva categoría:')
  if (!name) return
  const icon = prompt('Emoji para el ícono (ej: 🎂):', '🎉') || '🎉'
  supabase.from('categories').insert({ name, icon }).then(async () => {
    await loadCategories()
    await loadTemplates()
    renderLibrary()
    toast('✓ Categoría creada')
  })
}

window.catContextMenu = function(e, catId) {
  e.preventDefault()
  if (confirm('¿Eliminar esta categoría?')) {
    supabase.from('categories').delete().eq('id', catId).then(async () => {
      activeCategory = null
      await loadCategories()
      await loadTemplates()
      renderLibrary()
      toast('✓ Categoría eliminada')
    })
  }
}

window.openTemplate = function(id) {
  const tpl = templates.find(t => t.id === id)
  if (!tpl) return
  loadHtmlIntoEditor(tpl.html_content, tpl.name)
  showView('editor')
  toast('✓ Plantilla cargada en el editor')
}

window.uploadNewTemplate = function() {
  const input = document.createElement('input')
  input.type = 'file'; input.accept = '.html,.htm'
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      loadHtmlIntoEditor(ev.target.result, file.name)
      showView('editor')
      toast('✓ HTML cargado — editá y guardá como plantilla')
    }
    reader.readAsText(file, 'utf-8')
  }
  input.click()
}

window.deleteTemplate = async function(id) {
  if (!confirm('¿Eliminar esta plantilla?')) return
  await supabase.from('templates').delete().eq('id', id)
  await loadTemplates(activeCategory)
  renderLibrary()
  toast('✓ Plantilla eliminada')
}

window.editTemplate = function(id) {
  openTemplate(id)
}

// ── Guardar plantilla ─────────────────────────────────────────────────────────
window.saveTemplate = async function() {
  if (!originalHtml) { toast('Cargá una plantilla primero', 'warn'); return }

  const name = prompt('Nombre de la plantilla:', parsed?.fields?.nombre ? 'Cumple de ' + parsed.fields.nombre : 'Nueva plantilla')
  if (!name) return

  // Elegir categoría
  const catOptions = categories.map((c, i) => `${i + 1}. ${c.icon} ${c.name}`).join('\n')
  const catIdx = parseInt(prompt('Elegí una categoría:\n' + catOptions + '\n\nIngresá el número:')) - 1
  const cat = categories[catIdx]

  const html = currentHtml ?? originalHtml
  const { error } = await supabase.from('templates').insert({
    name,
    category_id: cat?.id ?? null,
    html_content: html,
    description: '',
    tags: []
  })

  if (error) { toast('Error al guardar: ' + error.message, 'warn'); return }
  await loadTemplates()
  toast('✓ Plantilla guardada en la biblioteca')
}

// ══════════════════════════════════════════════════════════════════════════════
// ASSETS / IMÁGENES
// ══════════════════════════════════════════════════════════════════════════════
function renderAssets() {
  const mc = document.getElementById('mainContent')
  mc.innerHTML = `
  <div style="display:flex;width:100%;height:100%;overflow:hidden">

    <!-- SIDEBAR -->
    <div style="width:200px;flex-shrink:0;background:#141414;border-right:1px solid #2a2a2a;display:flex;flex-direction:column">
      <div style="padding:12px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:8px">
        <span style="font-size:11px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:.5px">Carpetas</span>
        <button onclick="addCategory()" style="margin-left:auto;border:none;background:none;color:#639922;cursor:pointer;font-size:18px" title="Nueva carpeta">+</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:8px">
        <div onclick="filterAssetsCategory(null)"
          style="padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:2px;font-size:11px;display:flex;align-items:center;gap:8px;${!activeCategory?'background:#1a2e0f;color:#c0dd97':'color:#888'}">
          <span>🗂️</span> Todos
        </div>
        ${categories.map(c => `
        <div onclick="filterAssetsCategory('${c.id}')"
          style="padding:8px 10px;border-radius:6px;cursor:pointer;margin-bottom:2px;font-size:11px;display:flex;align-items:center;gap:8px;${activeCategory===c.id?'background:#1a2e0f;color:#c0dd97':'color:#aaa'}">
          <span>${c.icon}</span> ${c.name}
        </div>`).join('')}
      </div>
    </div>

    <!-- MAIN ASSETS -->
    <div style="flex:1;overflow-y:auto;display:flex;flex-direction:column">
      <div style="padding:12px 16px;border-bottom:1px solid #2a2a2a;display:flex;align-items:center;gap:10px;flex-shrink:0;background:#141414">
        <span style="font-size:13px;font-weight:600">Imágenes y archivos</span>
        <span style="font-size:10px;color:#555">${assets.length} archivos</span>
        <div style="margin-left:auto;display:flex;gap:8px">
          <button onclick="uploadAsset()" class="btn btn-go">+ Subir imagen</button>
        </div>
      </div>

      <div style="padding:16px;flex:1">
        ${assets.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:#444">
          <div style="font-size:48px;margin-bottom:12px;opacity:.3">🖼️</div>
          <div style="font-size:13px;margin-bottom:8px">Sin imágenes todavía</div>
          <div style="font-size:11px;color:#333">Subí imágenes para organizarlas por categoría</div>
        </div>` : `
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">
          ${assets.map(a => `
          <div class="asset-card">
            <div style="height:100px;background:#0a0a0a;display:flex;align-items:center;justify-content:center;position:relative">
              ${a.type === 'image' || a.type === 'gif'
                ? `<img src="${a.url}" style="max-width:100%;max-height:100%;object-fit:contain">`
                : `<span style="font-size:32px">🎵</span>`}
            </div>
            <div style="padding:6px 8px">
              <div style="font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:4px">${a.name}</div>
              <div style="display:flex;gap:4px">
                <button onclick="copyAssetUrl('${a.url}')" class="btn" style="font-size:9px;padding:2px 7px;flex:1">Copiar URL</button>
                <button onclick="deleteAsset('${a.id}')" style="border:none;background:none;color:#e24b4a;cursor:pointer;font-size:12px">🗑️</button>
              </div>
            </div>
          </div>`).join('')}
        </div>`}
      </div>
    </div>
  </div>`
}

window.filterAssetsCategory = async function(catId) {
  activeCategory = catId
  await loadAssets(catId)
  renderAssets()
}

window.uploadAsset = async function() {
  const catOptions = ['Sin categoría', ...categories.map((c, i) => `${i + 1}. ${c.icon} ${c.name}`)].join('\n')
  const catIdx = parseInt(prompt('Carpeta:\n' + catOptions + '\n\n0 = Sin categoría, o número de categoría:'))
  const cat = catIdx > 0 ? categories[catIdx - 1] : null

  const input = document.createElement('input')
  input.type = 'file'; input.accept = 'image/*,audio/*,.gif'
  input.multiple = true
  input.onchange = async e => {
    const files = [...e.target.files]; if (!files.length) return
    toast('Subiendo ' + files.length + ' archivo(s)...')
    for (const file of files) {
      const path = (cat ? cat.name + '/' : '') + Date.now() + '_' + file.name.replace(/\s+/g, '_')
      const { data: storageData, error: storageErr } = await supabase.storage.from('assets').upload(path, file, { upsert: true })
      if (storageErr) { toast('Error: ' + storageErr.message, 'warn'); continue }
      const { data: urlData } = supabase.storage.from('assets').getPublicUrl(path)
      await supabase.from('assets').insert({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type.startsWith('audio') ? 'audio' : file.name.endsWith('.gif') ? 'gif' : 'image',
        size: file.size,
        category_id: cat?.id ?? null
      })
    }
    await loadAssets(activeCategory)
    renderAssets()
    toast('✓ ' + files.length + ' archivo(s) subidos')
  }
  input.click()
}

window.copyAssetUrl = function(url) {
  navigator.clipboard.writeText(url).then(() => toast('✓ URL copiada'))
}

window.deleteAsset = async function(id) {
  if (!confirm('¿Eliminar este archivo?')) return
  await supabase.from('assets').delete().eq('id', id)
  await loadAssets(activeCategory)
  renderAssets()
  toast('✓ Archivo eliminado')
}

// ══════════════════════════════════════════════════════════════════════════════
// EDITOR
// ══════════════════════════════════════════════════════════════════════════════
function renderEditor() {
  const mc = document.getElementById('mainContent')
  mc.innerHTML = `
  <div style="display:grid;grid-template-columns:320px 1fr;height:100%;overflow:hidden">

    <!-- PANEL IZQUIERDO -->
    <div style="background:#141414;border-right:1px solid #2a2a2a;display:flex;flex-direction:column;overflow:hidden">

      <!-- DROP ZONE -->
      <div style="padding:12px;border-bottom:1px solid #2a2a2a">
        <div id="dropZone" onclick="document.getElementById('fileInput').click()"
          style="border:2px dashed #2a2a2a;border-radius:8px;padding:12px;text-align:center;cursor:pointer;background:#0f0f0f;transition:.15s">
          <input type="file" id="fileInput" accept=".html,.htm" style="display:none">
          <div style="font-size:11px;color:#555">📄 Arrastrá tu HTML o hacé clic</div>
          <div id="loadStatus" style="font-size:10px;color:#639922;margin-top:4px;display:none"></div>
        </div>
      </div>

      <!-- TABS -->
      <div style="display:flex;border-bottom:1px solid #2a2a2a;background:#0f0f0f;overflow-x:auto;flex-shrink:0">
        ${['Evento','Colores','Efectos','Temática','Imágenes'].map((t,i)=>
          `<button class="tab ${i===0?'on':''}" data-tab="${i}" onclick="switchTab(${i})">${t}</button>`
        ).join('')}
      </div>

      <!-- TAB CONTENT -->
      <div id="tabContent" style="flex:1;overflow-y:auto;padding:12px"></div>
    </div>

    <!-- VISOR -->
    <div style="display:flex;flex-direction:column;background:#0a0a0a">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid #2a2a2a;background:#141414;flex-shrink:0">
        <button onclick="toggleLive()" id="btnLive" style="padding:4px 10px;border-radius:5px;border:none;background:#2a2a2a;color:#aaa;cursor:pointer;font-size:10px">▶ Activar visor</button>
        <button onclick="refreshLive()" style="padding:4px 8px;border-radius:5px;border:none;background:#2a2a2a;color:#aaa;cursor:pointer;font-size:10px">↺</button>
        <button onclick="openInvite()" style="padding:4px 10px;border-radius:5px;border:none;background:#2a2a2a;color:#aaa;cursor:pointer;font-size:10px">🎉 Abrir</button>
        <div style="margin-left:auto;display:flex;gap:6px">
          <button onclick="setScale('mobile')" style="padding:3px 8px;border-radius:5px;border:1px solid #333;background:none;color:#888;cursor:pointer;font-size:10px">📱 375px</button>
          <button onclick="setScale('desktop')" style="padding:3px 8px;border-radius:5px;border:1px solid #333;background:none;color:#888;cursor:pointer;font-size:10px">🖥️ Full</button>
        </div>
        <span id="liveDot" style="width:8px;height:8px;border-radius:50%;background:#e24b4a;flex-shrink:0"></span>
      </div>
      <div style="flex:1;overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:16px" id="iframeWrap">
        <div id="liveEmpty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#333;text-align:center;font-size:12px">
          <div style="font-size:48px;margin-bottom:12px;opacity:.2">👁️</div>
          <div>Cargá una plantilla para activar el visor</div>
        </div>
        <iframe id="liveFrame" style="display:none;border:none;border-radius:8px;box-shadow:0 4px 32px rgba(0,0,0,.5)" sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"></iframe>
      </div>
    </div>
  </div>`

  initDrop()
  renderTab(0)
  if (originalHtml) refreshLiveFrame()
}

let activeTab = 0
window.switchTab = function(i) {
  activeTab = i
  document.querySelectorAll('.tab').forEach((t, idx) => {
    t.classList.toggle('on', idx === i)
  })
  renderTab(i)
}

function renderTab(i) {
  const el = document.getElementById('tabContent')
  if (!el) return
  const f = parsed?.fields ?? {}

  if (i === 0) {
    el.innerHTML = !parsed
      ? `<div style="color:#444;text-align:center;padding:40px 0;font-size:11px">↑ Cargá un HTML para ver los campos</div>`
      : `
      ${fg('f-titulo','Título',f.titulo)}
      ${fg('f-nombre','Nombre / protagonistas',f.nombre)}
      <div style="display:flex;gap:8px">
        ${fg('f-dia','Día',f.dia,'70px')}
        ${fg('f-mes','Mes',f.mes)}
        ${fg('f-anio','Año',f.anio,'80px')}
      </div>
      <div style="display:flex;gap:8px">
        ${fg('f-hora','Hora',f.hora)}
      </div>
      <div class="sep"></div>
      ${fg('f-salon','Salón',f.salon)}
      ${fg('f-addr1','Dirección 1',f.addr1)}
      ${fg('f-addr2','Dirección 2',f.addr2)}
      ${fg('f-maps','Query mapas',f.mapsQuery)}
      <div class="sep"></div>
      ${fg('f-msgsi','Mensaje Sí',f.msgSi,null,true)}
      ${fg('f-footer','Footer',f.footerTxt,null,true)}
      <div class="sep"></div>
      ${fg('f-stars','Estrellitas',f.tStars)}
      ${fg('f-femojis','Footer emojis',f.footerEmojis)}
      ${fg('f-rain','Pool lluvia',f.rainPool)}`

  } else if (i === 1) {
    el.innerHTML = `
    <label class="lbl">Bloque :root CSS</label>
    <textarea id="f-cssroot" class="ta" rows="16" placeholder=":root { --red: #E60012; }">${parsed?.cssRoot??''}</textarea>
    <div id="cssChips" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px"></div>`
    updateCssChips(parsed?.cssRoot ?? '')
    document.getElementById('f-cssroot')?.addEventListener('input', e => {
      updateCssChips(e.target.value); scheduleLive()
    })

  } else if (i === 2) {
    el.innerHTML = `
    <label class="lbl">Efectos visuales</label>
    ${fg('f-rain','Pool emojis lluvia',parsed?.fields?.rainPool??'')}
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      ${['🦖,🌿,🥚','🦋,🌸,🌺','❄️,⛄,🌟','🎉,⭐,🎈','🍄,⭐,🪙'].map(p=>
        `<button onclick="document.getElementById('f-rain').value='${p}';scheduleLive()" class="btn" style="font-size:10px">${p.split(',')[0]}</button>`
      ).join('')}
    </div>
    <div class="sep"></div>
    <label class="lbl">CSS adicional</label>
    <textarea id="f-extracss" class="ta" rows="6" placeholder="/* CSS extra */"></textarea>
    <div class="sep"></div>
    <label class="lbl">Snippets</label>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${[['nieve','❄️ Nieve'],['confetti','🎊 Confetti'],['burbujas','🫧 Burbujas'],['luciernas','✨ Luciérnagas'],['petalos','🌸 Pétalos']].map(([n,l])=>
        `<button onclick="injectEffect('${n}')" class="btn" style="width:100%">${l}</button>`
      ).join('')}
    </div>`

  } else if (i === 3) {
    el.innerHTML = `
    <label class="lbl">Pegá el bloque de temática</label>
    <textarea id="f-temaraw" class="ta" rows="14" placeholder="Pegá el bloque completo aquí..."></textarea>
    <button onclick="parseTema()" class="btn btn-go" style="margin-top:8px;width:100%">Aplicar temática</button>
    <div id="temaStatus" style="font-size:10px;color:#639922;margin-top:6px"></div>
    <div id="temaList" style="margin-top:8px"></div>`
    renderTemaList()

  } else if (i === 4) {
    const imgs = originalHtml ? detectImages(originalHtml) : []
    el.innerHTML = `
    <div id="imgDrop" onclick="document.getElementById('imgInput').click()"
      style="border:2px dashed #2a2a2a;border-radius:8px;padding:16px;text-align:center;cursor:pointer;background:#0f0f0f;margin-bottom:10px">
      <input type="file" id="imgInput" accept="image/*" style="display:none">
      <div style="font-size:11px;color:#555">⬆️ Subir imagen local</div>
    </div>
    <div id="imgPreview" style="display:none;margin-bottom:12px">
      <div style="background:repeating-conic-gradient(#333 0% 25%,#222 0% 50%) 0 0/12px 12px;border-radius:8px;overflow:hidden;max-height:140px;display:flex;align-items:center;justify-content:center;margin-bottom:8px">
        <img id="imgThumb" style="max-width:100%;max-height:140px;object-fit:contain">
      </div>
      <div id="imgName" style="font-size:10px;color:#666;margin-bottom:8px"></div>
      ${imgs.length ? `
      <label class="lbl">Imágenes detectadas</label>
      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px">
        ${imgs.map(img=>`
        <button onclick="replaceDetectedImg('${img.src}')" class="btn" style="width:100%;justify-content:flex-start;gap:8px;overflow:hidden">
          <span>${img.icon}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left">${img.label}</span>
          <span style="font-size:9px;color:#555;flex-shrink:0">${img.src.slice(-16)}</span>
        </button>`).join('')}
      </div>` : ''}
      <label class="lbl">O aplicar como</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <button onclick="useImgAs('cover')" class="btn">Fondo portada</button>
        <button onclick="useImgAs('main')" class="btn">Fondo scroll</button>
        <button onclick="useImgAs('hero')" class="btn">Hero img</button>
        <button onclick="useImgAs('cover-img')" class="btn">Cover img</button>
        <button onclick="useImgAs('gifsi')" class="btn">GIF Sí</button>
        <button onclick="useImgAs('gifno')" class="btn">GIF No</button>
      </div>
    </div>
    <div class="sep"></div>
    <label class="lbl">Imágenes de la biblioteca</label>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:200px;overflow-y:auto">
      ${assets.filter(a=>a.type==='image'||a.type==='gif').map(a=>`
      <div onclick="useLibraryAsset('${a.url}')" style="cursor:pointer;border-radius:6px;overflow:hidden;border:1px solid #2a2a2a;aspect-ratio:1;background:#0a0a0a">
        <img src="${a.url}" style="width:100%;height:100%;object-fit:cover">
      </div>`).join('')}
    </div>`
    initImgLoader()
  }

  document.querySelectorAll('#tabContent input,#tabContent textarea,#tabContent select').forEach(el => {
    el.addEventListener('input', scheduleLive)
  })
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function fg(id, label, value='', width=null, textarea=false) {
  const style = `width:${width??'100%'};background:#0f0f0f;border:1px solid #2a2a2a;border-radius:6px;color:#e0e0e0;padding:6px 8px;font-size:11px;font-family:inherit;outline:none;`
  return `<div class="fg" style="${width?'flex:1;':''}">
    <label class="lbl">${label}</label>
    ${textarea
      ? `<textarea id="${id}" style="${style}resize:vertical;" rows="2">${value??''}</textarea>`
      : `<input id="${id}" value="${(value??'').replace(/"/g,'&quot;')}" style="${style}">`
    }
  </div>`
}

function cv(id) { return document.getElementById(id)?.value?.trim() ?? '' }

function updateCssChips(css) {
  const chips = document.getElementById('cssChips'); if (!chips) return
  const ms = [...css.matchAll(/--[\w-]+\s*:\s*(#[0-9a-fA-F]{3,8})/g)]
  chips.innerHTML = ms.map(m=>`<div title="${m[0].trim()}" style="width:18px;height:18px;border-radius:4px;background:${m[1]};border:1px solid #333;flex-shrink:0;cursor:help"></div>`).join('')
}

// ── Load HTML ─────────────────────────────────────────────────────────────────
function loadHtmlIntoEditor(html, filename) {
  if (!html || html.trim().length < 50) { alert('Archivo vacío'); return }
  try {
    originalHtml  = html
    currentHtml   = null
    parsed        = parseTemplate(html)
    window.parsed = parsed
    window.origHtml = html

    const s = document.getElementById('loadStatus')
    if (s) { s.style.display = 'block'; s.textContent = `✓ ${filename} · ${parsed.type}` }
    toast(`✓ ${Object.values(parsed.fields).filter(Boolean).length} campos detectados`)
    renderTab(activeTab)
    if (liveActive) updateLive()
  } catch(e) { console.error(e); alert('Error: ' + e.message) }
}

function initDrop() {
  const fi = document.getElementById('fileInput')
  if (!fi) return
  fi.addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return
    new FileReader().onload = ev => loadHtmlIntoEditor(ev.target.result, f.name)
    const r = new FileReader()
    r.onload = ev => loadHtmlIntoEditor(ev.target.result, f.name)
    r.readAsText(f, 'utf-8')
    e.target.value = ''
  })
  const dz = document.getElementById('dropZone')
  if (!dz) return
  ;['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.style.borderColor = '#639922' }))
  ;['dragleave','dragend'].forEach(ev => dz.addEventListener(ev, () => { dz.style.borderColor = '#2a2a2a' }))
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.style.borderColor = '#2a2a2a'
    const f = e.dataTransfer.files[0]; if (!f) return
    const r = new FileReader()
    r.onload = ev => loadHtmlIntoEditor(ev.target.result, f.name)
    r.readAsText(f, 'utf-8')
  })
}

// ── Parser ────────────────────────────────────────────────────────────────────
function parseTemplate(html) {
  try {
    if (!html || html.trim().length < 10) return { type:'generico', cssRoot:'', originals:{}, fields:{} }
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const hfind = rx => { try { return html.match(rx)?.[1]?.trim()??null } catch { return null } }
    const hfindAll = rx => { try { return [...html.matchAll(rx)] } catch { return [] } }
    const qtext = sel => { try { return doc.querySelector(sel)?.textContent?.trim()??null } catch { return null } }
    const qattr = (sel,attr) => { try { return doc.querySelector(sel)?.getAttribute(attr)?.trim()??null } catch { return null } }

    const type = html.includes('t-name')||html.includes('date-day') ? 'infantil'
      : html.includes('hero-names')||html.includes('ceremony-card') ? 'casamiento' : 'generico'

    const rootM = html.match(/:root\s*\{([^}]+)\}/s)
    const cssRoot = rootM ? `:root {\n${rootM[1]}\n}` : ''
    const MESES = ['','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

    let nombre = (qtext('.t-name')??qtext('.hero-names')??qtext('.couple-names')??qtext('h1')??'').replace(/<[^>]+>/g,'').trim()
    nombre = nombre ? nombre[0].toUpperCase()+nombre.slice(1).toLowerCase() : ''

    let dia='',mes='',anio='',hora=''
    const cdm = hfind(/new Date\(['"](\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
    if (cdm) {
      const [dp,tp] = cdm.split('T'), [y,mo,d] = dp.split('-')
      dia=String(parseInt(d)); mes=MESES[parseInt(mo)]??mo; anio=y; hora=tp?.slice(0,5)??''
    } else {
      dia=qtext('.date-day')??''; mes=qtext('.date-month')??''; anio=qtext('.date-year')??''
      hora=(qtext('.date-time-pill')??'').replace(/[^\d:]/g,'').trim()
    }

    let salon='',addr1='',addr2='',mapsQuery=''
    const pn = doc.querySelector('.place-name')
    if (pn) {
      salon = pn.textContent.replace(/\p{Emoji}/gu,'').trim()
      const pa = doc.querySelector('.place-addr')
      if (pa) { const pts=pa.innerHTML.split(/<br\s*\/?>/i); addr1=pts[0]?.replace(/<[^>]+>/g,'').trim()??''; addr2=pts[1]?.replace(/<[^>]+>/g,'').trim()??'' }
    }
    const ml = doc.querySelector('a[href*="maps.google.com"],a[href*="waze.com"]')
    if (ml) { const q=(ml.getAttribute('href')??'').match(/[?&]q=([^&"']+)/); mapsQuery=q?decodeURIComponent(q[1].replace(/\+/g,' ')):'' }

    const msgSi = qtext('.res-msg.res-yes,.res-yes')??qtext('.hero-phrase')??''
    let footerTxt = qtext('.footer-name')??qtext('.footer-txt')??qtext('footer p')??''
    const titulo = qtext('title')??''

    const gifs = hfindAll(/src="([^"]+\.gif)"/gi)
    const gifSi = gifs[0]?.[1]??'', gifNo = gifs[1]?.[1]??''

    let coverImg=''
    for (const sel of ['img.cover-img','.cover-img-wrap img','#cover-screen img']) {
      const s = qattr(sel,'src')??''; if(s&&!s.startsWith('data:')){ coverImg=s; break }
    }
    let heroImg=''
    for (const sel of ['img.mario-img','img.hero-img','.mario-wrap img']) {
      const s = qattr(sel,'src')??''; if(s&&!s.startsWith('data:')){ heroImg=s; break }
    }

    const footerEmojis = [...doc.querySelectorAll('.fe')].map(e=>e.textContent.trim()).join(',')
    const tStars = qtext('.t-stars')??''
    const poolRaw = hfind(/const pool = \[([^\]]+)\];/)
    const rainPool = poolRaw ? poolRaw.replace(/['"]/g,'').split(',').map(s=>s.trim()).join(',') : ''
    const audioSrc = hfind(/(?:src|data-src)="([^"]+\.(?:mp3|ogg|wav|m4a))"/)??''
    const cdDate = hfind(/new Date\(['"](\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)??''

    const originals = {
      titulo, tname: doc.querySelector('.t-name')?.innerHTML?.trim()??'',
      heroNames: qtext('.hero-names')??'',
      day: qtext('.date-day')??dia, month: qtext('.date-month')??mes,
      year: qtext('.date-year')??anio, timePill: qtext('.date-time-pill')??'',
      cdDate, venue: salon, addr1, addr2, mapsQ: mapsQuery,
      msgSi, footerTxt, coverImg, heroImg, gifSi, gifNo, tStars,
      icsSumm: hfind(/SUMMARY:([^\r\n]+)/)??'',
      icsLoc: hfind(/LOCATION:([^\r\n]+)/)??'',
      icsFile: hfind(/a\.download = ['"]([^'"]+\.ics)['"]/)??'',
    }

    return { type, cssRoot, originals, fields: { titulo, nombre, dia, mes, anio, hora, salon, addr1, addr2, mapsQuery, msgSi, footerTxt, coverImg, heroImg, gifSi, gifNo, footerEmojis, tStars, rainPool, audioSrc } }
  } catch(e) { console.error('parseTemplate error:',e); return { type:'generico', cssRoot:'', originals:{}, fields:{} } }
}

// ── Apply Changes ─────────────────────────────────────────────────────────────
function applyChangesToHtml(html, originals, newFields, extra={}) {
  try {
    let out = html
    const SC = '<'+'\/style>', BC = '<'+'\/body>'
    const MESES = ['','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
    const rep = (s,r) => { try { if(s&&r!==undefined&&r!==null&&s!==r) out=out.split(s).join(r) } catch(e){} }

    if (extra.cssRoot) { const orig=out.match(/:root\s*\{[^}]+\}/s); if(orig) out=out.replace(orig[0],extra.cssRoot); else out=out.replace(SC,extra.cssRoot+'\n'+SC) }
    if (extra.extraCss) {
      if (extra.extraCss.includes('<script')) out=out.replace(BC,extra.extraCss+'\n'+BC)
      else out=out.replace(SC,extra.extraCss+'\n'+SC)
    }

    if (originals.tname&&newFields.nombre) rep('<span class="t-name">'+originals.tname+'</span>','<span class="t-name">'+newFields.nombre.toUpperCase()+'</span>')
    if (originals.heroNames&&newFields.nombre) rep(originals.heroNames,newFields.nombre)
    rep(originals.titulo, newFields.titulo||originals.titulo)

    if (originals.day)      rep('<div class="date-day">'+originals.day+'</div>','<div class="date-day">'+newFields.dia+'</div>')
    if (originals.month)    rep('<div class="date-month">'+originals.month+'</div>','<div class="date-month">'+newFields.mes+'</div>')
    if (originals.year)     rep('<div class="date-year">'+originals.year+'</div>','<div class="date-year">'+newFields.anio+'</div>')
    if (originals.timePill) rep(originals.timePill,'⏰ '+newFields.hora+' HS')

    if (originals.cdDate&&newFields.dia&&newFields.mes&&newFields.anio) {
      const mn=String(MESES.indexOf((newFields.mes||'').toUpperCase())).padStart(2,'0')
      const d=(newFields.dia||'01').padStart(2,'0')
      rep(originals.cdDate, newFields.anio+'-'+mn+'-'+d+'T'+(newFields.hora||'18:00'))
    }

    rep(originals.venue,  newFields.salon)
    rep(originals.addr1,  newFields.addr1)
    rep(originals.addr2,  newFields.addr2)
    rep(originals.mapsQ,  newFields.mapsQuery)
    rep(originals.msgSi,  newFields.msgSi)
    rep(originals.footerTxt, newFields.footerTxt)

    if (originals.coverImg&&newFields.coverImg) out=out.split('src="'+originals.coverImg+'"').join('src="'+newFields.coverImg+'"')
    if (originals.heroImg&&newFields.heroImg)   out=out.split('src="'+originals.heroImg+'"').join('src="'+newFields.heroImg+'"')
    if (originals.gifSi&&newFields.gifSi)       out=out.split('src="'+originals.gifSi+'"').join('src="'+newFields.gifSi+'"')
    if (originals.gifNo&&newFields.gifNo)       out=out.split('src="'+originals.gifNo+'"').join('src="'+newFields.gifNo+'"')

    if (originals.tStars&&newFields.tStars) rep('<span class="t-stars">'+originals.tStars+'</span>','<span class="t-stars">'+newFields.tStars+'</span>')
    if (originals.icsSumm&&newFields.nombre) rep(originals.icsSumm, newFields.nombre)
    if (originals.icsLoc&&newFields.addr1)   rep(originals.icsLoc,  newFields.addr1)
    if (originals.icsFile) { const slug=(newFields.nombre||'invitacion').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-'); rep("a.download = '"+originals.icsFile+"'","a.download = 'invitacion-"+slug+".ics'") }

    if (extra.temaReps) for(const {s,r} of extra.temaReps) if(s&&r) rep(s,r)
    return out
  } catch(e) { console.error('applyChanges error:',e); return html }
}

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
    coverImg:     cv('f-cover')||parsed?.fields?.coverImg||'',
    heroImg:      cv('f-hero')||parsed?.fields?.heroImg||'',
    gifSi:        cv('f-gifsi')||parsed?.fields?.gifSi||'',
    gifNo:        cv('f-gifno')||parsed?.fields?.gifNo||'',
    tStars:       cv('f-stars'),
    footerEmojis: cv('f-femojis'),
    rainPool:     cv('f-rain'),
  }
}

function getExtra() {
  return { cssRoot: cv('f-cssroot'), extraCss: cv('f-extracss'), temaReps }
}

window.applyChanges = function() {
  if (!originalHtml) { toast('Cargá una plantilla primero','warn'); return }
  currentHtml = applyChangesToHtml(originalHtml, parsed.originals, getFields(), getExtra())
  toast('✓ Cambios aplicados')
  if (liveActive) updateLive()
}

window.exportHtml = function() {
  if (!originalHtml) { toast('Cargá una plantilla primero','warn'); return }
  const html = currentHtml ?? applyChangesToHtml(originalHtml, parsed.originals, getFields(), getExtra())
  const slug = (cv('f-nombre')||'invitacion').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
  a.download = `invitar-${slug}.html`; a.click(); URL.revokeObjectURL(a.href)
  toast('✓ HTML exportado')
}

// ── Live viewer ───────────────────────────────────────────────────────────────
const liveFrame = () => document.getElementById('liveFrame')

window.toggleLive = function() {
  if (!originalHtml) { toast('Cargá una plantilla primero','warn'); return }
  liveActive = !liveActive
  const btn = document.getElementById('btnLive')
  if (liveActive) { if(btn){btn.textContent='⏸ Pausar';btn.style.background='#1a2e0f';btn.style.color='#c0dd97'} updateLive() }
  else            { if(btn){btn.textContent='▶ Activar visor';btn.style.background='#2a2a2a';btn.style.color='#aaa'} }
}

window.refreshLive = function() { if(originalHtml){liveActive=true;iframeReady=false;updateLive()} }
window.setScale = function(s) { liveScale=s; resizeFrame() }

window.openInvite = function() {
  if (!liveActive||!iframeReady) { toast('Activá el visor primero','warn'); return }
  try {
    const fr = liveFrame(); if(!fr) return
    const d = fr.contentDocument??fr.contentWindow.document
    const btn = d.getElementById('btnOpen')??d.querySelector('.btn-open')
    if (btn) { btn.click(); toast('✓ Invitación abierta') }
    else {
      const cover = d.getElementById('cover-screen')??d.querySelector('[id*="cover"]')
      const main  = d.getElementById('main-invite')??d.querySelector('[id*="main-invite"]')
      if(cover){cover.style.display='none';cover.style.opacity='0'}
      if(main){main.classList.remove('hidden');main.style.display=''}
      toast(cover||main?'✓ Portada omitida':'No se encontró portada',cover||main?'ok':'warn')
    }
  } catch(e) { toast('Error: '+e.message,'warn') }
}

function resizeFrame() {
  const fr = liveFrame(); const wrap = document.getElementById('iframeWrap')
  if (!fr||!wrap) return
  if (liveScale==='mobile') {
    const W=375, scale=Math.min(1,(wrap.offsetWidth-32)/W)
    fr.style.width=W+'px'; fr.style.height='720px'
    fr.style.transform=scale<1?`scale(${scale.toFixed(3)})`:'none'
    fr.style.transformOrigin='top center'
  } else { fr.style.width='100%'; fr.style.height='720px'; fr.style.transform='none' }
}

function updateLive(keepScroll=false) {
  if (!originalHtml||!liveActive) return
  const fr = liveFrame(); if(!fr) return
  const html = applyChangesToHtml(originalHtml, parsed.originals, getFields(), getExtra())
  const dot = document.getElementById('liveDot')
  if(dot) dot.style.background='#ba7517'
  let scroll = 0
  if(keepScroll&&iframeReady){try{scroll=fr.contentWindow.scrollY??0}catch{}}
  const le = document.getElementById('liveEmpty')
  if(le) le.style.display='none'
  fr.style.display='block'; resizeFrame()
  if(liveBlobUrl){URL.revokeObjectURL(liveBlobUrl);liveBlobUrl=null}
  liveBlobUrl = URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}))
  iframeReady = false
  fr.onload = () => {
    iframeReady=true
    if(scroll) try{fr.contentWindow.scrollTo({top:scroll,behavior:'instant'})}catch{}
    if(dot) dot.style.background='#639922'
  }
  fr.src = liveBlobUrl
}

function refreshLiveFrame() { if(originalHtml&&liveActive) updateLive() }

function scheduleLive() {
  clearTimeout(liveTimer)
  if(!liveActive) return
  liveTimer = setTimeout(()=>updateLive(true), 700)
}

// ── Efectos ───────────────────────────────────────────────────────────────────
const EFFECTS = {
  nieve:`(function(){var c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);function sp(){var e=document.createElement('div');var s=6+Math.random()*10;e.style.cssText='position:absolute;top:-20px;left:'+Math.random()*100+'vw;width:'+s+'px;height:'+s+'px;background:rgba(255,255,255,0.85);border-radius:50%;animation:snowFall '+(4+Math.random()*6)+'s linear infinite;';c.appendChild(e);setTimeout(function(){e.remove()},(10+Math.random()*6)*1000);}if(!document.getElementById('snowKf')){var st=document.createElement('style');st.id='snowKf';st.textContent='@keyframes snowFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}';document.head.appendChild(st);}for(var i=0;i<30;i++)setTimeout(sp,i*200);setInterval(sp,600);})();`,
  confetti:`(function(){var cols=['#E60012','#009AC7','#F7C94B','#2ECC40','#FF8C00','#fff'];var c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);function sp(){var e=document.createElement('div');var col=cols[Math.floor(Math.random()*cols.length)];var w=6+Math.random()*8,h=w*0.4;e.style.cssText='position:absolute;top:-20px;left:'+Math.random()*100+'vw;width:'+w+'px;height:'+h+'px;background:'+col+';opacity:.85;animation:confFall '+(3+Math.random()*5)+'s linear infinite;';c.appendChild(e);setTimeout(function(){e.remove()},(8+Math.random()*5)*1000);}if(!document.getElementById('confKf')){var st=document.createElement('style');st.id='confKf';st.textContent='@keyframes confFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}';document.head.appendChild(st);}for(var i=0;i<40;i++)setTimeout(sp,i*150);setInterval(sp,400);})();`,
  burbujas:`(function(){var c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);function sp(){var e=document.createElement('div');var s=14+Math.random()*30;e.style.cssText='position:absolute;bottom:-40px;left:'+Math.random()*100+'vw;width:'+s+'px;height:'+s+'px;border:2px solid rgba(255,255,255,0.5);border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(255,255,255,0.35),transparent 70%);animation:bubbleUp '+(5+Math.random()*7)+'s ease-in infinite;';c.appendChild(e);setTimeout(function(){e.remove()},(12+Math.random()*7)*1000);}if(!document.getElementById('bubKf')){var st=document.createElement('style');st.id='bubKf';st.textContent='@keyframes bubbleUp{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-110vh) scale(0.5);opacity:0}}';document.head.appendChild(st);}for(var i=0;i<20;i++)setTimeout(sp,i*300);setInterval(sp,700);})();`,
  luciernas:`(function(){var c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000';document.body.appendChild(c);var cols=['#ffe066','#c0ff60','#60ffaa'];for(var i=0;i<22;i++){var e=document.createElement('div');var s=4+Math.random()*5;var col=cols[Math.floor(Math.random()*cols.length)];var dur=3+Math.random()*4;var dx=(Math.random()-0.5)*60,dy=(Math.random()-0.5)*60;e.style.cssText='position:absolute;left:'+Math.random()*95+'vw;top:'+(20+Math.random()*70)+'vh;width:'+s+'px;height:'+s+'px;background:'+col+';border-radius:50%;box-shadow:0 0 '+(s*3)+'px '+col+';animation:ff'+i+' '+dur+'s ease-in-out infinite alternate;';var st=document.createElement('style');st.textContent='@keyframes ff'+i+'{0%{transform:translate(0,0);opacity:0.2}50%{opacity:1}100%{transform:translate('+dx+'px,'+dy+'px);opacity:0.3}}';document.head.appendChild(st);c.appendChild(e);}})();`,
  petalos:`(function(){var c=document.createElement('div');c.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:9000;overflow:hidden';document.body.appendChild(c);var emojis=['🌸','🌺','🌹','🌷'];function sp(){var e=document.createElement('div');e.textContent=emojis[Math.floor(Math.random()*emojis.length)];var s=0.7+Math.random()*1.2;e.style.cssText='position:absolute;top:-40px;left:'+Math.random()*100+'vw;font-size:'+s+'rem;opacity:0.8;animation:petalFall '+(5+Math.random()*6)+'s linear infinite;';c.appendChild(e);setTimeout(function(){e.remove()},(11+Math.random()*6)*1000);}if(!document.getElementById('petKf')){var st=document.createElement('style');st.id='petKf';st.textContent='@keyframes petalFall{0%{transform:translateY(-40px) rotate(0)}100%{transform:translateY(110vh) rotate(360deg)}}';document.head.appendChild(st);}for(var i=0;i<18;i++)setTimeout(sp,i*250);setInterval(sp,600);})();`
}

window.injectEffect = function(name) {
  const code = EFFECTS[name]; if(!code) return
  const f = document.getElementById('f-extracss'); if(!f) return
  if(f.value.includes('/* efecto:'+name+' */')) { toast('Ese efecto ya está','warn'); return }
  f.value = (f.value?f.value+'\n\n':'')+'/* efecto:'+name+' */\n'+code
  scheduleLive(); toast('✓ Efecto '+name+' agregado')
}

// ── Temática ──────────────────────────────────────────────────────────────────
window.parseTema = function() {
  const raw = cv('f-temaraw'); if(!raw) return
  const log = []
  const rm = raw.match(/:root\s*\{([^}]+)\}/s)
  if(rm){ const f=document.getElementById('f-cssroot'); if(f) f.value=`:root {\n${rm[1]}\n}`; updateCssChips(f?.value??''); log.push('Paleta CSS') }
  const imports = raw.match(/@import\s+url\([^)]+\)[^;]*;/g)
  if(imports){ const f=document.getElementById('f-extracss'); if(f) f.value=imports.join('\n')+(f.value?'\n\n'+f.value:''); log.push('Tipografía') }
  temaReps = []
  raw.split('\n').forEach(line => {
    line=line.trim(); if(!line||line.startsWith('//')||line.startsWith(':root')) return
    for(const arrow of [' → ',' -> ',' => ']){
      if(line.includes(arrow)){
        const parts=line.split(arrow), s=parts[0].trim(), r=parts.slice(1).join(arrow).trim()
        if(s&&r&&s!==r&&s.length>3) temaReps.push({s,r,lbl:s.slice(0,35)})
        break
      }
    }
  })
  if(temaReps.length) log.push(temaReps.length+' reemplazos')
  const st=document.getElementById('temaStatus'); if(st) st.textContent=log.length?'✓ '+log.join(' · '):'Sin datos'
  renderTemaList(); scheduleLive(); toast('✓ Temática aplicada')
}

function renderTemaList() {
  const el=document.getElementById('temaList'); if(!el) return
  if(!temaReps.length){el.innerHTML='';return}
  el.innerHTML=`<div style="font-size:10px;color:#555;margin-bottom:4px">${temaReps.length} reemplazos</div>`+
    temaReps.map((r,i)=>`<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;background:#0f0f0f;border-radius:4px;margin-bottom:2px">
      <span style="flex:1;font-size:9px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.lbl}</span>
      <button onclick="delTema(${i})" style="border:none;background:none;color:#444;cursor:pointer;font-size:13px">×</button>
    </div>`).join('')
}
window.delTema = (i) => { temaReps.splice(i,1); renderTemaList(); scheduleLive() }

// ── Imágenes ──────────────────────────────────────────────────────────────────
function detectImages(html) {
  const results=[], seen=new Set()
  const iconMap={gif:'🎞️',jpg:'🖼️',jpeg:'🖼️',png:'🖼️',webp:'🖼️',svg:'🖼️'}
  const labelMap=src=>{
    if(src.includes('cover')) return 'Cover / portada'
    if(/mario|hero|personaje/i.test(src)) return 'Hero / personaje'
    if(/si|yes|sí/i.test(src)) return 'GIF — Sí voy'
    if(/no/i.test(src)) return 'GIF — No voy'
    if(/juego|game/i.test(src)) return 'Sprite juego'
    return src
  }
  const rx=/src="([^"]+\.(png|jpg|jpeg|gif|webp|svg))"/gi; let m
  while((m=rx.exec(html))!==null){
    const src=m[1]; if(src.startsWith('data:')||seen.has(src)) continue
    seen.add(src); const ext=src.split('.').pop().toLowerCase()
    results.push({src,icon:iconMap[ext]??'🖼️',label:labelMap(src)})
  }
  return results
}

function initImgLoader() {
  const input=document.getElementById('imgInput'), drop=document.getElementById('imgDrop')
  if(!input||!drop) return
  function loadImg(file){
    if(!file?.type.startsWith('image/')) return
    const r=new FileReader()
    r.onload=e=>{
      localImgUrl=e.target.result
      const thumb=document.getElementById('imgThumb'); if(thumb) thumb.src=localImgUrl
      const name=document.getElementById('imgName'); if(name) name.textContent=file.name+' · '+(file.size/1024).toFixed(0)+' KB'
      const prev=document.getElementById('imgPreview'); if(prev) prev.style.display='block'
    }
    r.readAsDataURL(file)
  }
  input.addEventListener('change',e=>{if(e.target.files[0])loadImg(e.target.files[0]);e.target.value=''})
  ;['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.style.borderColor='#639922'}))
  ;['dragleave','dragend'].forEach(ev=>drop.addEventListener(ev,()=>{drop.style.borderColor='#2a2a2a'}))
  drop.addEventListener('drop',e=>{e.preventDefault();drop.style.borderColor='#2a2a2a';loadImg(e.dataTransfer.files[0])})
}

window.replaceDetectedImg = function(originalSrc) {
  if(!localImgUrl){toast('Cargá una imagen primero','warn');return}
  if(!originalHtml) return
  originalHtml=originalHtml.split(`src="${originalSrc}"`).join(`src="${localImgUrl}"`)
  if(parsed){
    Object.keys(parsed.originals).forEach(k=>{if(parsed.originals[k]===originalSrc)parsed.originals[k]=localImgUrl})
    Object.keys(parsed.fields).forEach(k=>{if(parsed.fields[k]===originalSrc)parsed.fields[k]=localImgUrl})
  }
  scheduleLive(); toast(`✓ Imagen reemplazada`); renderTab(activeTab)
}

window.useImgAs = function(target) {
  if(!localImgUrl){toast('Cargá una imagen primero','warn');return}
  const map={cover:'f-cover','cover-img':'f-cover',hero:'f-hero',gifsi:'f-gifsi',gifno:'f-gifno'}
  if(map[target]){const f=document.getElementById(map[target]);if(f)f.value=localImgUrl}
  else if(target==='cover'||target==='main'){
    const f=document.getElementById('f-extracss')
    const sel=target==='cover'?'#cover-screen':'#main-invite'
    const css='\n'+sel+' { background-image: url("'+localImgUrl+'") !important; background-size: cover !important; background-position: center !important; }\n'
    if(f) f.value=(f.value+css)
  }
  scheduleLive(); toast('✓ Imagen aplicada')
}

window.useLibraryAsset = function(url) {
  if(!url) return
  localImgUrl=url
  const thumb=document.getElementById('imgThumb'); if(thumb) thumb.src=url
  const prev=document.getElementById('imgPreview'); if(prev) prev.style.display='block'
  toast('✓ Imagen de biblioteca seleccionada')
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(msg, type='ok') {
  const t=document.createElement('div')
  t.style.cssText=`position:fixed;bottom:20px;right:20px;background:${type==='warn'?'#2e1a0a':'#1a2e0f'};color:${type==='warn'?'#f0a060':'#c0dd97'};padding:10px 16px;border-radius:8px;font-size:11px;z-index:9999;max-width:300px;line-height:1.5;box-shadow:0 4px 20px rgba(0,0,0,.5);border:1px solid ${type==='warn'?'#4a2a0a':'#2d4a1e'}`
  t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),4000)
}
window.toast = toast

// ── START ─────────────────────────────────────────────────────────────────────
if (sessionStorage.getItem('invitar_auth') === '1') { init() }
else { showLogin() }
