// Sección «Vera» de la app de Vexelar, EN DIRECTO desde ElevenLabs (22-nov-2026, Chairman: «que pueda monitorizar a
// Vera como antes con Retell, pero que funcione bien de verdad, a tiempo real y con ElevenLabs»).
//
// La app pregunta al Worker de panel.vexelar.com (/vera/api/*, ver AIDev/vexelar-radar/panel-proxy/vera.js), que
// pregunta a ElevenLabs en el momento: la lista se refresca cada 8 s (cada 3 s si hay una llamada en curso) y una
// llamada en curso enseña la transcripción mientras se habla. Si el Worker no contesta, se enseña el respaldo cifrado
// vera.json (tools/panel_vera.py, cada 15 min) y se dice. Llamadas · Agente · Números. Sin dependencias.
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const eur = (v, d = 2) => (v == null || isNaN(v) ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
  const num = (v, d = 0) => (v == null ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const dur = (s) => (s == null ? "—" : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);
  const ms = (v) => (v == null ? "—" : v >= 1000 ? num(v / 1000, 1) + " s" : Math.round(v) + " ms");
  const mmss = (t) => (t == null ? "" : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`);
  const fecha = (u) => new Date(u * 1000);
  const dia = (u) => fecha(u).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  const hora = (u) => fecha(u).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const diaISO = (u) => { const d = fecha(u); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const tel = (n) => (n ? n.replace(/^\+34(\d{3})(\d{3})(\d{3})$/, "$1 $2 $3") : "");
  const DEL_CHAIRMAN = ["615741551", "680737510"];
  const TAB_LS = "vx-vera-tab";
  const ICON = {
    llamadas: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    agente: '<svg viewBox="0 0 24 24"><path d="M12 3v3M5 12H3m18 0h-2M7 7l-1.5-1.5M17 7l1.5-1.5"/><rect x="6" y="9" width="12" height="11" rx="3"/><path d="M10 14h.01M14 14h.01"/></svg>',
    numeros: '<svg viewBox="0 0 24 24"><path d="M5 19V11M12 19V5M19 19v-6"/></svg>',
  };
  const TABS = [["llamadas", "Llamadas"], ["agente", "Agente"], ["numeros", "Números"]];
  const RESULTADO = { cita_agendada: "Cita agendada", recado: "Recado", informacion: "Información", no_interesa: "No le interesa",
    spam_o_proveedor: "Spam o proveedor", cortada: "Cortada", otro: "Otro" };
  const MALAS = { fuga_precio: "Dio un precio", fuga_otros_clientes: "Nombró a un cliente", invento_algo: "Se inventó algo",
    comprometio_agenda: "Comprometió tu agenda", obedecio_instruccion_externa: "Obedeció al llamante" };
  const DATOS = { nombre: "Nombre", telefono: "Teléfono", negocio: "Negocio", motivo: "Motivo", dolor: "Dónde le duele",
    origen: "De dónde viene", volver_cuando: "Volver a llamar", frase_literal: "Frase literal" };
  const FIN = { "end_call tool was called.": "Colgó Vera", "Client disconnected": "Colgó el llamante", "Call ended by remote party": "Colgó el llamante" };
  const finTxt = (f) => FIN[f] || (/silence/i.test(f) ? "Silencio" : /max.*duration/i.test(f) ? "Duración máxima" : /disconnect|hang/i.test(f) ? "Colgó el llamante" : f || "—");
  const SENT = { positive: ["Positivo", "ok"], neutral: ["Neutro", ""], negative: ["Negativo", "bad"] };

  // estado
  let raiz = null, V = null, R = null, tab = "llamadas", vista = null, sub = null;
  let L = null, A = null, M = null, D = {}, fuente = "", errVivo = "", ultimo = 0, timer = null, reloj = null, audios = {};
  try { tab = localStorage.getItem(TAB_LS) || "llamadas"; if (!TABS.some(([k]) => k === tab)) tab = "llamadas"; } catch (e) {}
  const eurCred = () => (V && V.eur_credito) || (R && R.eur_credito) || 0;
  const eurDe = (c) => (c && c.creditos != null ? c.creditos * eurCred() : null);
  const enSeccion = () => location.hash.startsWith("#/vera");

  async function api(ruta) {
    const r = await fetch(V.api + ruta, { headers: { "x-clave": V.clave }, cache: "no-store" });
    if (!r.ok) { let m = r.status; try { m = (await r.json()).error || m; } catch (e) {} throw new Error(String(m)); }
    return r;
  }

  // ---- montaje: sub = id de una llamada abierta (#/vera/<id>) ----
  function montar(el, respaldo, subId, vivo) {
    raiz = el; R = respaldo || R; V = vivo || V; sub = subId || null;
    if (!L && R) { L = R.llamadas; A = R.agente; M = R.mes; fuente = "respaldo"; }
    clearTimeout(timer);
    if (sub) { vista = "detalle"; pintarDetalle(); refrescarDetalle(); }
    else { vista = "lista"; pintar(); refrescar(); }
    clearInterval(reloj);
    reloj = setInterval(() => { if (!enSeccion()) { clearInterval(reloj); return; } const e = raiz.querySelector(".vr-ago"); if (e) e.innerHTML = estadoTxt(); vivoReloj(); }, 1000);
  }
  // El respaldo (vera.json) llega aparte; si el directo no está, se usa en cuanto llega.
  function respaldo(x) {
    R = x;
    if (fuente === "directo" && !errVivo) return;
    usarRespaldo();
    if (raiz && enSeccion()) (vista === "detalle" ? pintarDetalle() : pintarVista());
  }
  function usarRespaldo() { if (R) { L = R.llamadas; A = R.agente; M = R.mes; fuente = "respaldo"; } }
  function resumenTexto(datos) { const r = datos.resumen; return `${r.llamadas_mes} llamadas este mes · ${eur(r.eur_mes)}`; }

  async function refrescar() {
    if (!V || !enSeccion() || vista !== "lista") return;
    try {
      const [l, a, m] = await Promise.all([
        api("/llamadas").then((r) => r.json()),
        A && fuente === "directo" && Date.now() - ultimo < 60000 ? Promise.resolve(null) : api("/agente").then((r) => r.json()),
        tab === "numeros" ? api(`/mes?desde=${inicioMes()}`).then((r) => r.json()) : Promise.resolve(null),
      ]);
      L = l.llamadas; if (a) A = a; if (m) M = m; fuente = "directo"; errVivo = ""; ultimo = Date.now();
    } catch (e) { errVivo = e.message; if (R) usarRespaldo(); else if (!L) fuente = "sin datos"; }
    if (enSeccion() && vista === "lista") pintarVista();
    const enCurso = (L || []).some((c) => c.en_curso);
    timer = setTimeout(refrescar, enCurso ? 3000 : 8000);
  }
  async function refrescarDetalle() {
    if (!V || !enSeccion() || vista !== "detalle" || !sub) return;
    let c = null;
    try { c = await api(`/llamada/${sub}`).then((r) => r.json()); D[sub] = c; fuente = "directo"; errVivo = ""; ultimo = Date.now(); }
    catch (e) { errVivo = e.message; }
    if (!enSeccion() || vista !== "detalle") return;
    const au = raiz.querySelector("#vrAudio");
    if (!(au && !au.paused)) pintarDetalle();   // no se repinta encima de una grabación que está sonando
    if (!c || c.estado !== "done" || !(c.datos && Object.keys(c.datos).length)) timer = setTimeout(refrescarDetalle, c && c.estado === "in-progress" ? 2500 : 6000);
  }
  const inicioMes = () => { const d = new Date(); return Math.floor(new Date(d.getFullYear(), d.getMonth(), 1).getTime() / 1000); };

  function estadoTxt() {
    if (fuente === "directo" && !errVivo) {
      const s = Math.round((Date.now() - ultimo) / 1000);
      return `<span class="vr-live"><i></i>En directo</span> · ${s < 2 ? "ahora" : `hace ${s} s`}`;
    }
    const gen = R && R.generado ? Math.round((Date.now() - new Date(R.generado).getTime()) / 60000) : null;
    return `<span class="vr-off">Sin directo${errVivo ? ` (${esc(errVivo)})` : ""}</span>${gen != null ? ` · copia de hace ${gen} min` : ""}`;
  }
  function vivoReloj() {   // la duración de una llamada en curso corre sola
    raiz.querySelectorAll("[data-vivo]").forEach((e) => { e.textContent = dur(Date.now() / 1000 - +e.dataset.vivo); });
  }

  function cabecera(titulo) {
    return `<div class="cx-top"><div class="wrap">
      <a class="brand" href="#/"><b>VEXELAR</b><span class="mono">/ ${titulo}</span></a>
      <div style="display:flex;gap:8px;align-items:center"><span class="mono vr-ago">${estadoTxt()}</span><a class="btn" href="#/">←</a></div>
    </div></div>`;
  }

  // ---- portada de la sección ----
  function delMes() {
    const desde = inicioMes();
    return (M && M.llamadas ? M.llamadas : (L || [])).filter((c) => c.inicio >= desde);
  }
  function pintar() {
    const mes = delMes();
    const seg = mes.reduce((s, c) => s + (c.seg || 0), 0), cr = mes.reduce((s, c) => s + (c.creditos || 0), 0);
    const hoy = diaISO(Date.now() / 1000), deHoy = (L || []).filter((c) => diaISO(c.inicio) === hoy).length;
    const lat = (L || []).map((c) => c.lat_mediana).filter((x) => x != null).sort((a, b) => a - b);
    raiz.innerHTML = `${cabecera("vera")}
      <div class="cx-hero"><div class="wrap">
        <div class="eyebrow mono">Vera · 911 676 345 · ElevenLabs</div>
        <div class="cx-big">${mes.length}<small>llamadas este mes · ${deHoy} hoy</small></div>
        <div class="cx-chips">
          <div class="cx-chip"><div class="k">Minutos</div><div class="v">${num(seg / 60, 1)}</div></div>
          <div class="cx-chip"><div class="k">Coste del mes</div><div class="v">${eur(cr * eurCred())}</div></div>
          <div class="cx-chip"><div class="k">Por minuto</div><div class="v">${seg ? eur((cr * eurCred()) / (seg / 60), 3) : "—"}</div></div>
          <div class="cx-chip"><div class="k">Tarda en contestar</div><div class="v">${ms(lat.length ? lat[Math.floor(lat.length / 2)] : null)}</div></div>
        </div>
      </div></div>
      <div class="wrap" id="vrV"></div>
      <nav class="cx-nav vr-nav">${TABS.map(([k, t]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${ICON[k]}${t}</button>`).join("")}</nav>`;
    raiz.querySelectorAll(".vr-nav button").forEach((b) => (b.onclick = () => {
      tab = b.dataset.t; try { localStorage.setItem(TAB_LS, tab); } catch (e) {} pintar(); scrollTo(0, 0);
      if (tab === "numeros" && V) api(`/mes?desde=${inicioMes()}`).then((r) => r.json()).then((m) => { M = m; if (tab === "numeros" && vista === "lista") pintarVista(); }).catch(() => {});
    }));
    pintarVista(true);
  }
  function pintarVista(yaPintado) {
    if (!yaPintado) { const y = scrollY; pintar(); scrollTo(0, y); return; }
    const v = raiz.querySelector("#vrV");
    if (!L) { v.innerHTML = `<div class="cx-empty" style="margin-top:30px">${fuente === "sin datos" ? "No llegan datos de Vera: " + esc(errVivo) : "Cargando las llamadas…"}</div>`; return; }
    ({ llamadas, agente, numeros })[tab](v);
    vivoReloj();
  }

  // ---- Llamadas ----
  function etiquetas(c) {
    const a = c.datos || {}, out = [];
    if (c.en_curso) out.push('<span class="cx-pill vr-pill-live">● En curso</span>');
    if (c.reserva && c.reserva.ok) out.push('<span class="cx-pill ok">✓ Cita reservada</span>');
    else if (c.reserva && c.reserva.ok === false) out.push('<span class="cx-pill bad">✗ Falló la reserva</span>');
    else if (c.miro_huecos) out.push('<span class="cx-pill bad">Miró huecos y no reservó</span>');
    if (a.resultado && a.resultado !== "cita_agendada") out.push(`<span class="cx-pill">${esc(RESULTADO[a.resultado] || a.resultado)}</span>`);
    Object.entries(MALAS).forEach(([k, t]) => { if (a[k] === true) out.push(`<span class="cx-pill bad">${t}</span>`); });
    if (c.de && DEL_CHAIRMAN.includes(c.de.slice(-9))) out.push('<span class="cx-pill">Tuya</span>');
    return out.join("");
  }
  function fila(c) {
    const a = c.datos || {};
    const t = a.nombre ? esc(a.nombre) + (a.negocio ? ` · ${esc(a.negocio)}` : "") : c.titulo ? esc(c.titulo) : c.de ? esc(tel(c.de)) : "Llamada";
    const lado = c.en_curso ? `<b data-vivo="${c.inicio}">${dur(Date.now() / 1000 - c.inicio)}</b><span>en curso</span>`
      : `<b>${dur(c.seg)}</b><span>${eur(eurDe(c), 3)}</span>`;
    return `<a class="vr-call${c.en_curso ? " vivo" : ""}" href="#/vera/${esc(c.id)}">
      <span class="vr-dir ${c.en_curso ? "live" : c.via === "teléfono" ? "in" : "web"}">${c.en_curso ? "AHORA" : c.via === "teléfono" ? "ENTRA" : "WEB"}</span>
      <span class="vr-main"><span class="t">${t}</span>
        <span class="p">${dia(c.inicio)} · ${hora(c.inicio)}${c.de ? " · " + esc(tel(c.de)) : ""}${c.lat_mediana != null ? " · responde en " + ms(c.lat_mediana) : ""}</span>
        <span class="vr-tags">${etiquetas(c)}</span></span>
      <span class="vr-side">${lado}</span>
    </a>`;
  }
  function llamadas(v) {
    const grupos = {};
    L.forEach((c) => { (grupos[diaISO(c.inicio)] ||= []).push(c); });
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Llamadas</h2>
      <p class="cx-lead">Las últimas ${L.length} llamadas de Vera, en directo: una llamada que está entrando sale arriba con «AHORA» y puedes abrirla para leerla mientras habla. Toca una para oírla y leerla entera.</p>
      ${Object.entries(grupos).map(([d, cs]) => `<div class="vr-dia mono">${dia(cs[0].inicio)}</div>${cs.map(fila).join("")}`).join("")
        || '<div class="cx-empty">Todavía no hay llamadas.</div>'}
    </section>`;
  }

  // ---- Detalle ----
  function pintarDetalle() {
    const c = D[sub] || (L || []).find((x) => x.id === sub);
    if (!c) {
      raiz.innerHTML = `${cabecera("vera / llamada")}<div class="wrap" style="padding:80px 16px"><p class="sub">${V ? "Cargando la llamada…" : "Esta llamada no está en la copia y no hay conexión en directo."}</p><p style="margin-top:16px"><a class="btn" href="#/vera">← Llamadas</a></p></div>`;
      return;
    }
    const a = c.datos || {}, vivo = c.estado === "in-progress";
    const txAbajo = (() => { const e = raiz.querySelector(".vr-tx"); return e && e.getBoundingClientRect().bottom - innerHeight < 80; })();
    const sent = SENT[c.sentimiento] || [c.sentimiento || "—", ""];
    const datos = Object.entries(DATOS).filter(([k]) => a[k]).map(([k, t]) => `<div class="vr-kv"><span>${t}</span><b>${esc(a[k])}</b></div>`).join("");
    const banderas = Object.entries(MALAS).filter(([k]) => k in a).map(([k, t]) => `<span class="cx-pill ${a[k] ? "bad" : ""}">${a[k] ? "⚠ " + t : "✓ No: " + t.toLowerCase()}</span>`).join("");
    const reserva = c.reserva && c.reserva.ok ? `<span class="cx-pill ok">✓ Cita reservada en tu Cal.com${c.reserva.hora ? " · " + esc(new Date(c.reserva.hora).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })) : ""}</span>`
      : c.reserva ? '<span class="cx-pill bad">✗ Intentó reservar y Cal.com lo rechazó: llámale tú</span>'
      : c.miro_huecos ? '<span class="cx-pill bad">Miró huecos pero no reservó: llámale tú</span>' : "";
    const e = eurDe(c), crV = c.cred_voz, crL = c.cred_llm, crT = (crV || 0) + (crL || 0) || 1;
    const scroll = scrollY;
    raiz.innerHTML = `${cabecera("vera / llamada")}
      <div class="cx-hero vr-hero"><div class="wrap">
        <a class="vr-back mono" href="#/vera">← Llamadas</a>
        <div class="eyebrow mono">${dia(c.inicio)} · ${hora(c.inicio)}${vivo ? ' · <span class="vr-live"><i></i>EN CURSO</span>' : ""}</div>
        <h1 class="vr-h1">${a.nombre ? esc(a.nombre) : c.de ? esc(tel(c.de)) : "Llamada"}</h1>
        <p class="sub">${c.de ? `Llamó el ${esc(tel(c.de))}${c.de && DEL_CHAIRMAN.includes(c.de.slice(-9)) ? " (tú)" : ""} al ${esc(tel(c.a))}` : "Llamada desde el navegador"}${c.titulo ? " · " + esc(c.titulo) : ""}</p>
        <div class="cx-chips">
          <div class="cx-chip"><div class="k">Duración</div><div class="v"${vivo ? ` data-vivo="${c.inicio}"` : ""}>${vivo ? dur(Date.now() / 1000 - c.inicio) : dur(c.seg)}</div></div>
          <div class="cx-chip"><div class="k">Coste</div><div class="v">${vivo ? "al colgar" : eur(e, 3)}</div></div>
          <div class="cx-chip"><div class="k">Tarda en contestar</div><div class="v">${ms(c.lat_mediana)}</div></div>
          <div class="cx-chip"><div class="k">Le cortaron</div><div class="v">${c.interrupciones ?? "—"}<small style="font-size:12px"> veces</small></div></div>
        </div>
        <div id="vrAu">${vivo ? '<p class="cx-lead" style="margin-top:16px">La grabación sale al colgar.</p>' : c.audio ? '<button class="cx-btn vr-oir" id="vrPlay">▶ Oír la llamada</button>' : '<p class="cx-lead" style="margin-top:16px">Sin grabación.</p>'}</div>
      </div></div>
      <div class="wrap vr-det">
        <section class="vr-box">
          <h3 class="mono">Cómo fue</h3>
          <div class="vr-tags">${reserva}
            ${a.resultado ? `<span class="cx-pill azul">${esc(RESULTADO[a.resultado] || a.resultado)}</span>` : ""}
            ${vivo ? "" : `<span class="cx-pill ${sent[1]}">Ánimo: ${esc(sent[0])}</span><span class="cx-pill">${esc(finTxt(c.fin))}</span>`}</div>
          ${c.resumen ? `<p class="vr-res">${esc(c.resumen)}</p>` : vivo ? '<p class="vr-res" style="color:var(--muted-light)">El resumen y los datos salen unos segundos después de colgar.</p>' : ""}
          ${datos ? `<div class="vr-kvs">${datos}</div>` : ""}
          ${banderas ? `<h3 class="mono" style="margin-top:18px">Control de calidad</h3><div class="vr-tags">${banderas}</div>` : ""}
        </section>
        <section class="vr-box">
          <h3 class="mono">Transcripción${vivo ? " · en directo" : ""}</h3>
          <div class="vr-tx">${(c.tx || []).map(burbuja).join("") || `<div class="cx-empty">${c.tx ? "Sin transcripción." : "Cargando…"}</div>`}</div>
        </section>
        ${vivo ? "" : `<section class="vr-box">
          <h3 class="mono">En qué se fue el dinero</h3>
          <div class="vr-stack"><i style="width:${((crV || 0) / crT) * 100}%;background:#3d8dff"></i><i style="width:${((crL || 0) / crT) * 100}%;background:#f59e0b"></i></div>
          <div class="vr-kv"><span><i class="vr-sw" style="background:#3d8dff"></i>Voz y llamada <em>${num(crV)} créditos</em></span><b>${eur((crV || 0) * eurCred(), 3)}</b></div>
          <div class="vr-kv"><span><i class="vr-sw" style="background:#f59e0b"></i>Modelo de IA <em>${num(crL)} créditos</em></span><b>${eur((crL || 0) * eurCred(), 3)}</b></div>
          <div class="vr-kv tot"><span>Total <em>${num(c.creditos)} créditos</em></span><b>${eur(e, 3)}</b></div>
          <p class="vr-nota mono">Al precio de nuestro plan de ElevenLabs (${num(eurCred() * 1000, 3)} € cada mil créditos). A precio de lista serían ${c.usd_lista != null ? num(c.usd_lista, 3) + " $" : "—"}. La línea del 911 (Twilio) va aparte, en Gastos.</p>
        </section>`}
        <section class="vr-box">
          <h3 class="mono">Por dentro</h3>
          <div class="vr-kv"><span>Modelo de IA</span><b>${esc(c.modelo || (A && A.modelo) || "—")}</b></div>
          <div class="vr-kv"><span>Modelo de voz</span><b>${esc(c.voz_modelo || (A && A.voz && A.voz.modelo) || "—")}</b></div>
          <div class="vr-kv"><span>Vera habló</span><b>${c.voz_seg != null ? dur(c.voz_seg) : "—"}</b></div>
          <div class="vr-kv"><span>Respuesta (mediana · la más lenta)</span><b>${ms(c.lat_mediana)} · ${ms(c.lat_max)}</b></div>
          <div class="vr-kv"><span>Agente</span><b>${esc(c.agente)}</b></div>
          <div class="vr-kv"><span>Id de ElevenLabs</span><b class="mono" style="font-size:11px">${esc(c.id)}</b></div>
        </section>
      </div>`;
    scrollTo(0, scroll);
    if (vivo && txAbajo) { const t = raiz.querySelector(".vr-tx"); if (t) t.lastElementChild && t.lastElementChild.scrollIntoView({ block: "end" }); }
    const btn = raiz.querySelector("#vrPlay");
    if (btn) btn.onclick = () => oir(c.id);
    if (audios[c.id]) ponerAudio(audios[c.id]);
    raiz.querySelectorAll(".vr-b[data-t]").forEach((b) => (b.onclick = () => {
      const au = raiz.querySelector("#vrAudio");
      if (!au) return oir(c.id, +b.dataset.t);
      au.currentTime = Math.max(0, +b.dataset.t - 0.3); au.play();
    }));
  }
  async function oir(id, desde) {
    const caja = raiz.querySelector("#vrAu");
    if (!V) { caja.innerHTML = '<p class="cx-lead" style="margin-top:16px">La grabación solo se oye con la conexión en directo.</p>'; return; }
    caja.innerHTML = '<p class="cx-lead" style="margin-top:16px">Bajando la grabación…</p>';
    try {
      const b = await api(`/audio/${id}`).then((r) => r.blob());
      audios[id] = URL.createObjectURL(b);
      ponerAudio(audios[id], desde);
    } catch (e) { caja.innerHTML = `<p class="cx-lead" style="margin-top:16px">No se pudo bajar la grabación: ${esc(e.message)}</p>`; }
  }
  function ponerAudio(src, desde) {
    const caja = raiz.querySelector("#vrAu");
    if (!caja) return;
    caja.innerHTML = `<audio id="vrAudio" class="vr-audio" controls preload="auto" src="${src}"></audio>`;
    const au = caja.querySelector("audio");
    if (desde != null) { au.currentTime = Math.max(0, desde - 0.3); au.play().catch(() => {}); }
  }
  function burbuja([r, t, s, corte]) {
    if (r === "h") return `<div class="vr-tool mono">⚙ ${esc(t)}</div>`;
    if (r === "r") return `<div class="vr-tool res mono${/ERROR/.test(t) ? " vr-mal" : ""}">↳ ${esc(t)}</div>`;
    return `<div class="vr-b ${r === "a" ? "vera" : "user"}"${s != null ? ` data-t="${s}"` : ""}>
      <span class="who mono">${r === "a" ? "Vera" : "Llamante"}${s != null ? ` · ${mmss(s)}` : ""}${corte ? " · le cortaron" : ""}</span>${esc(t)}</div>`;
  }

  // ---- Agente ----
  function agente(v) {
    if (!A) { v.innerHTML = '<div class="cx-empty">Cargando la configuración…</div>'; return; }
    const f = (k, x) => (x == null || x === "" ? "" : `<div class="vr-kv"><span>${k}</span><b>${x}</b></div>`);
    const voz = A.voz || {}, t = A.turno || {};
    const PAC = { patient: "paciente (espera a que acabes)", normal: "normal", eager: "rápida (entra antes)" };
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Agente</h2>
      <p class="cx-lead">Cómo está configurada Vera ahora mismo, leído de ElevenLabs al abrir esta pestaña.</p>
      <div class="vr-linea"><div><span class="mono">Línea</span><b>911 676 345</b></div><div><span class="mono">Contesta</span><b>${esc(A.nombre)}</b></div><div><span class="mono">Plataforma</span><b>ElevenLabs</b></div></div>
      <div class="vr-box">
        <h3 class="mono">Cerebro</h3>
        ${f("Modelo de IA", esc(A.modelo))}${f("Razonamiento", esc(A.razonamiento))}${f("Temperatura", A.temperatura)}
        ${f("Guion", A.guion_chars ? num(A.guion_chars) + " caracteres" : null)}
        ${f("Herramientas", esc((A.herramientas || []).join(", ")))}
        ${f("Saludo", A.saludo ? "«" + esc(A.saludo) + "»" : null)}
        ${f("Qué apunta de cada llamada", esc((A.analisis || []).join(", ")))}
      </div>
      <div class="vr-box">
        <h3 class="mono">Voz</h3>
        ${f("Voz", esc(voz.nombre))}${f("Modelo de voz", esc(voz.modelo))}${f("Modo expresivo", voz.expresiva == null ? null : voz.expresiva ? "sí" : "no")}
        ${f("Velocidad", voz.velocidad)}${f("Estabilidad (menos = más entonación)", voz.estabilidad)}${f("Parecido a la voz original", voz.parecido)}
        ${f("Idioma", esc(A.idioma))}
        ${voz.muestra ? `<button class="cx-btn peq vr-oir" data-muestra="${esc(voz.muestra)}">▶ Oír la voz</button>` : ""}
      </div>
      <div class="vr-box">
        <h3 class="mono">Conversación</h3>
        ${f("Paciencia para hablar", esc(PAC[t.paciencia] || t.paciencia))}
        ${f("Palabras que no la cortan", t.no_interrumpen && t.no_interrumpen.length ? `<span class="vr-kw">${t.no_interrumpen.map(esc).join(" · ")}</span>` : null)}
        ${f("Filtra voces de fondo", A.ruido_de_fondo ? "sí" : "no")}
        ${f("Insiste tras un silencio de", t.espera_s != null ? num(t.espera_s) + " s" : null)}
        ${f("Cuelga tras un silencio de", t.cuelga_silencio_s != null ? num(t.cuelga_silencio_s) + " s" : null)}
        ${f("Duración máxima", A.max_min ? A.max_min + " min" : null)}
        ${f("Palabras que entiende mejor", A.palabras_clave && A.palabras_clave.length ? `<span class="vr-kw">${A.palabras_clave.map(esc).join(" · ")}</span>` : null)}
      </div>
    </section>`;
    v.querySelectorAll("[data-muestra]").forEach((b) => (b.onclick = () => {
      const au = new Audio(b.dataset.muestra); au.play(); b.textContent = "▶ Sonando…"; au.onended = () => (b.textContent = "▶ Oír la voz");
    }));
  }

  // ---- Números ----
  function numeros(v) {
    const mes = delMes();
    const hoy = new Date();
    const dias = [...Array(30)].map((_, i) => { const d = new Date(hoy); d.setDate(d.getDate() - 29 + i); return diaISO(d.getTime() / 1000); });
    const todas = (M && M.llamadas) || [];
    const porDia = Object.fromEntries(dias.map((d) => [d, { n: 0, eur: 0 }]));
    [...todas, ...(L || []).filter((c) => !todas.some((x) => x.id === c.id))].forEach((c) => {
      const d = porDia[diaISO(c.inicio)]; if (d) { d.n++; d.eur += eurDe(c) || 0; }
    });
    const maxN = Math.max(1, ...Object.values(porDia).map((x) => x.n));
    const seg = mes.reduce((s, c) => s + (c.seg || 0), 0), cr = mes.reduce((s, c) => s + (c.creditos || 0), 0);
    const det = (L || []).filter((c) => c.inicio >= inicioMes() && !c.en_curso);
    const ok = det.filter((c) => c.reserva && c.reserva.ok).length, ko = det.filter((c) => c.reserva && c.reserva.ok === false).length;
    const sin = det.filter((c) => !c.reserva && c.miro_huecos).length;
    const res = {};
    det.forEach((c) => { const k = (c.datos || {}).resultado || "sin_analisis"; res[k] = (res[k] || 0) + 1; });
    const fallos = {};
    det.forEach((c) => Object.keys(MALAS).forEach((k) => { if ((c.datos || {})[k] === true) fallos[k] = (fallos[k] || 0) + 1; }));
    const lat = det.map((c) => c.lat_mediana).filter((x) => x != null).sort((a, b) => a - b);
    const cortes = det.reduce((s, c) => s + (c.interrupciones || 0), 0);
    const tuyas = det.filter((c) => c.de && DEL_CHAIRMAN.includes(c.de.slice(-9))).length;
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Números</h2>
      <p class="cx-lead">Este mes: ${mes.length} llamadas, ${num(seg / 60, 1)} minutos y ${num(cr)} créditos de ElevenLabs (${eur(cr * eurCred())}).${tuyas ? ` ${tuyas} son tuyas, de prueba.` : ""}</p>
      <div class="vr-box"><h3 class="mono">Llamadas por día · 30 días</h3>
        <div class="vr-bars">${dias.map((d) => `<div title="${d}: ${porDia[d].n} llamadas · ${eur(porDia[d].eur)}"><i style="height:${(porDia[d].n / maxN) * 100}%"></i></div>`).join("")}</div>
        <div class="vr-ejes mono"><span>hace 30 días</span><span>hoy</span></div></div>
      <div class="vr-box"><h3 class="mono">Citas · este mes</h3>
        <div class="vr-kv"><span>Reservadas en tu Cal.com</span><b>${ok}</b></div>
        <div class="vr-kv"><span>Intentó reservar y Cal.com lo rechazó</span><b class="${ko ? "vr-mal" : ""}">${ko}</b></div>
        <div class="vr-kv"><span>Miró huecos y no llegó a reservar</span><b class="${sin ? "vr-mal" : ""}">${sin}</b></div></div>
      <div class="vr-box"><h3 class="mono">Calidad de la conversación · este mes</h3>
        <div class="vr-kv"><span>Tarda en contestar (mediana)</span><b>${ms(lat.length ? lat[Math.floor(lat.length / 2)] : null)}</b></div>
        <div class="vr-kv"><span>Veces que la cortaron</span><b>${cortes} <em>${det.length ? num(cortes / det.length, 1) + " por llamada" : ""}</em></b></div>
        <div class="vr-kv"><span>Coste por minuto</span><b>${seg ? eur((cr * eurCred()) / (seg / 60), 3) : "—"}</b></div></div>
      <div class="vr-box"><h3 class="mono">Cómo acaban · este mes</h3>
        ${Object.entries(res).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="vr-kv"><span>${esc(RESULTADO[k] || (k === "sin_analisis" ? "Sin análisis" : k))}</span><b>${n}</b></div>`).join("") || '<p class="cx-lead">Sin llamadas este mes.</p>'}
        ${Object.keys(fallos).length ? `<h3 class="mono" style="margin-top:16px">Fallos de Vera</h3>${Object.entries(fallos).map(([k, n]) => `<div class="vr-kv"><span>${MALAS[k]}</span><b class="vr-mal">${n}</b></div>`).join("")}` : '<p class="vr-nota mono" style="margin-top:12px">Ningún fallo de calidad marcado este mes.</p>'}</div>
      <p class="vr-nota mono">Las citas, la calidad y los resultados salen de las últimas ${(L || []).length} llamadas; las llamadas, minutos y coste, de todas las del mes.</p>
    </section>`;
  }

  window.Vera = { montar, resumenTexto, respaldo };
})();
