/**
 * parseTemplate - lee CUALQUIER html de invitación y devuelve todos los campos
 */
export function parseTemplate(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')

  const hfind  = (rx) => { try { return html.match(rx)?.[1]?.trim() ?? null } catch { return null } }
  const hfindAll = (rx) => { try { return [...html.matchAll(rx)] } catch { return [] } }
  const qtext  = (sel) => { try { return doc.querySelector(sel)?.textContent?.trim() ?? null } catch { return null } }

  // Tipo
  const type = html.includes('t-name') || html.includes('date-day') ? 'infantil'
    : html.includes('hero-names') || html.includes('ceremony-card') ? 'casamiento'
    : 'generico'

  // CSS :root
  const rootM = html.match(/:root\s*\{([^}]+)\}/s)
  const cssRoot = rootM ? `:root {\n${rootM[1]}\n}` : ''

  // Nombre
  const MESES = ['','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
  let nombre = (qtext('.t-name') ?? qtext('.hero-names') ?? qtext('.couple-names') ?? qtext('h1') ?? '').replace(/<[^>]+>/g,'').trim()
  nombre = nombre ? nombre[0].toUpperCase() + nombre.slice(1).toLowerCase() : ''

  // Fecha — JS countdown primero (más preciso)
  let dia='', mes='', anio='', hora=''
  const cdm = hfind(/new Date\(['"](\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/)
  if (cdm) {
    const [dp, tp] = cdm.split('T')
    const [y, mo, d] = dp.split('-')
    dia = String(parseInt(d)); mes = MESES[parseInt(mo)] ?? mo; anio = y; hora = tp?.slice(0,5) ?? ''
  } else {
    dia   = qtext('.date-day') ?? ''
    mes   = qtext('.date-month') ?? ''
    anio  = qtext('.date-year') ?? ''
    hora  = (qtext('.date-time-pill') ?? '').replace(/[^\d:]/g,'').trim()
    // Casamiento: "14 · JUNIO · 2025"
    const hd = qtext('.hero-date,.event-date,.fecha')
    if (hd) {
      hd.split(/[·\-\/\s]+/).map(s=>s.trim()).filter(Boolean).forEach(p => {
        if (/^\d{4}$/.test(p)) anio=p
        else if (/^\d{1,2}$/.test(p) && +p<=31) dia=p
        else if (MESES.indexOf(p.toUpperCase())>0) mes=p.toUpperCase()
      })
    }
  }

  // Lugar
  let salon='', addr1='', addr2='', mapsQuery=''
  const pn = doc.querySelector('.place-name')
  if (pn) {
    salon = pn.textContent.replace(/\p{Emoji}/gu,'').trim()
    const pa = doc.querySelector('.place-addr')
    if (pa) {
      const pts = pa.innerHTML.split(/<br\s*\/?>/i)
      addr1 = pts[0]?.replace(/<[^>]+>/g,'').trim() ?? ''
      addr2 = pts[1]?.replace(/<[^>]+>/g,'').trim() ?? ''
    }
  } else {
    const card = doc.querySelector('.ceremony-card,.venue-card,.location-card')
    if (card) {
      salon = card.querySelector('h3,h4,strong')?.textContent?.trim() ?? ''
      const p = card.querySelector('p')
      if (p) {
        const lines = p.innerHTML.split(/<br\s*\/?>/i)
        addr1 = lines[0]?.replace(/<[^>]+>/g,'').trim() ?? ''
        addr2 = lines[1]?.replace(/<[^>]+>/g,'').trim() ?? ''
      }
    } else {
      for (const p of doc.querySelectorAll('p')) {
        if (/Iglesia|Salón|Hotel|Hacienda|Av\.|Calle/.test(p.textContent) && p.textContent.length < 200) {
          const lines = p.innerHTML.split(/<br\s*\/?>/i)
          addr1 = lines[0]?.replace(/<[^>]+>/g,'').trim() ?? ''
          addr2 = lines[1]?.replace(/<[^>]+>/g,'').trim() ?? ''
          break
        }
      }
    }
  }
  const ml = doc.querySelector('a[href*="maps.google.com"]')
  if (ml) { const q = (ml.getAttribute('href')??'').match(/[?&]q=([^&"']+)/); mapsQuery = q?.[1]??'' }

  // Mensajes
  const msgSi = qtext('.res-msg.res-yes,.res-yes') ?? qtext('.hero-phrase,.invite-phrase,.frase') ?? qtext('.quote-text,.cita') ?? ''

  // Footer
  let footerTxt = qtext('.footer-name') ?? qtext('.footer-txt') ?? qtext('footer p') ?? ''
  const footerDate = qtext('.footer-date')
  if (footerDate && footerTxt && !footerTxt.includes(footerDate)) footerTxt += ' · ' + footerDate

  // Título
  const titulo = qtext('title') ?? ''

  // Imágenes
  const gifs = hfindAll(/src="([^"]+\.gif)"/g)
  const gifSi = gifs[0]?.[1] ?? ''
  const gifNo = gifs[1]?.[1] ?? ''
  let coverImg = ''
  for (const sel of ['.cover-img img','#cover-screen img','.hero-bg img','.portada img']) {
    const el = doc.querySelector(sel); const s = el?.getAttribute('src')??''
    if (s && !s.startsWith('data:')) { coverImg = s; break }
  }
  let heroImg = ''
  for (const sel of ['.mario-img img','.hero-img img','.personaje img']) {
    const el = doc.querySelector(sel); const s = el?.getAttribute('src')??''
    if (s && !s.startsWith('data:')) { heroImg = s; break }
  }

  // Emojis / decoraciones
  const footerEmojis = [...doc.querySelectorAll('.fe')].map(e=>e.textContent.trim()).join(',')
  const tStars = qtext('.t-stars') ?? ''
  const poolRaw = hfind(/const pool = \[([^\]]+)\];/)
  const rainPool = poolRaw ? poolRaw.replace(/['"]/g,'').split(',').map(s=>s.trim()).join(',') : ''
  const audioSrc = hfind(/(?:src|data-src)="([^"]+\.(?:mp3|ogg|wav|m4a))"/) ?? ''

  // ICS
  const dtStart  = hfind(/DTSTART:(\d+T\d+)/) ?? ''
  const dtEnd    = hfind(/DTEND:(\d+T\d+)/) ?? ''
  const icsFile  = hfind(/a\.download = ['"]([^'"]+\.ics)['"]/) ?? ''
  const icsSumm  = hfind(/SUMMARY:([^\r\n]+)/) ?? ''
  const icsLoc   = hfind(/LOCATION:([^\r\n]+)/) ?? ''
  const icsAlarm = hfind(/DESCRIPTION:([^\r\n]+)/) ?? ''

  // Valores ORIGINALES para poder hacer replace exacto
  const originals = {
    titulo,
    tname:    qtext('.t-name') ?? '',
    heroNames:qtext('.hero-names') ?? '',
    day:   qtext('.date-day') ?? dia,
    month: qtext('.date-month') ?? mes,
    year:  qtext('.date-year') ?? anio,
    timePill: qtext('.date-time-pill') ?? '',
    cdDate:   cdm ?? '',
    venue:  salon, addr1, addr2, mapsQ: mapsQuery,
    msgSi, footerTxt, coverImg, heroImg, gifSi, gifNo, tStars,
    dtStart, dtEnd, icsFile, icsSumm, icsLoc, icsAlarm,
  }

  return {
    type, cssRoot, originals,
    fields: {
      titulo, nombre, dia, mes, anio, hora,
      salon, addr1, addr2, mapsQuery,
      msgSi, footerTxt,
      coverImg, heroImg, gifSi, gifNo,
      footerEmojis, tStars, rainPool, audioSrc,
    }
  }
}

/**
 * applyChanges - aplica los valores editados sobre el HTML original
 */
export function applyChanges(html, originals, newFields, extra = {}) {
  let out = html
  const SC = '<' + '/style>'
  const BC = '<' + '/body>'
  const MESES = ['','ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

  const rep = (s, r) => { if (s && r !== undefined && r !== null && s !== r) out = out.split(s).join(r) }

  // CSS :root
  if (extra.cssRoot) {
    const orig = out.match(/:root\s*\{[^}]+\}/s)
    if (orig) out = out.replace(orig[0], extra.cssRoot)
    else out = out.replace(SC, extra.cssRoot + '\n' + SC)
  }

  // Extra CSS
  if (extra.extraCss) out = out.replace(SC, extra.extraCss + '\n' + SC)

  // Nombre
  if (originals.tname && newFields.nombre)
    rep('<span class="t-name">' + originals.tname + '</span>',
        '<span class="t-name">' + newFields.nombre.toUpperCase() + '</span>')
  if (originals.heroNames && newFields.nombre)
    rep(originals.heroNames, newFields.nombre)

  // Título
  rep(originals.titulo, newFields.titulo || originals.titulo)

  // Fecha en DOM
  if (originals.day)   rep('<div class="date-day">'   + originals.day   + '</div>', '<div class="date-day">'   + newFields.dia   + '</div>')
  if (originals.month) rep('<div class="date-month">' + originals.month + '</div>', '<div class="date-month">' + newFields.mes   + '</div>')
  if (originals.year)  rep('<div class="date-year">'  + originals.year  + '</div>', '<div class="date-year">'  + newFields.anio  + '</div>')
  if (originals.timePill) rep(originals.timePill, '⏰ ' + newFields.hora + ' HS')

  // Countdown JS
  if (originals.cdDate && newFields.dia && newFields.mes && newFields.anio) {
    const mn = String(MESES.indexOf((newFields.mes||'').toUpperCase())).padStart(2,'0')
    const d  = (newFields.dia||'01').padStart(2,'0')
    const newDate = newFields.anio + '-' + mn + '-' + d + 'T' + (newFields.hora || '18:00')
    rep(originals.cdDate, newDate)
  }

  // Lugar
  rep(originals.venue,  newFields.salon)
  rep(originals.addr1,  newFields.addr1)
  rep(originals.addr2,  newFields.addr2)
  rep(originals.mapsQ,  newFields.mapsQuery)

  // Mensajes / footer
  rep(originals.msgSi,    newFields.msgSi)
  rep(originals.footerTxt, newFields.footerTxt)

  // Imágenes
  if (originals.coverImg) rep('src="' + originals.coverImg + '"', 'src="' + newFields.coverImg + '"')
  if (originals.heroImg)  rep('src="' + originals.heroImg  + '"', 'src="' + newFields.heroImg  + '"')
  if (originals.gifSi)    rep('src="' + originals.gifSi    + '"', 'src="' + newFields.gifSi    + '"')
  if (originals.gifNo)    rep('src="' + originals.gifNo    + '"', 'src="' + newFields.gifNo    + '"')

  // Decoraciones
  if (originals.tStars && newFields.tStars)
    rep('<span class="t-stars">' + originals.tStars + '</span>',
        '<span class="t-stars">' + newFields.tStars + '</span>')

  // ICS
  if (originals.icsSumm && newFields.nombre) rep(originals.icsSumm, 'SUMMARY: ' + newFields.nombre)
  if (originals.icsLoc  && newFields.addr1)  rep(originals.icsLoc,  'LOCATION:' + newFields.addr1)
  if (originals.icsFile) {
    const slug = (newFields.nombre||'invitacion').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-')
    rep("a.download = '" + originals.icsFile + "'", "a.download = 'invitacion-" + slug + ".ics'")
  }

  // Reemplazos manuales de temática
  if (extra.temaReps) {
    for (const { s, r } of extra.temaReps) { if (s && r) rep(s, r) }
  }

  return out
}
