// Sección «Vera» de la app de Vexelar (30-oct-2026, orden del Chairman): cada llamada con su duración, coste,
// grabación y transcripción entera, y la configuración viva de cada agente (modelo, voz, parámetros).
// Llamadas · Agentes · Números. Los datos llegan cifrados en vera.json (tools/panel_vera.py); la app los descifra
// con la misma clave del panel y se los pasa a montar(). Sin dependencias.
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const eur = (v, d = 2) => (v == null ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }) + " €");
  const num = (v, d = 0) => (v == null ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d }));
  const dur = (s) => (s == null ? "—" : s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
  const ms = (v) => (v == null ? "—" : v >= 1000 ? num(v / 1000, 2) + " s" : Math.round(v) + " ms");
  const mmss = (t) => (t == null ? "" : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`);
  const dia = (s) => new Date(s).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  const hora = (s) => new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const tel = (n) => (n ? n.replace(/^\+34(\d{3})(\d{3})(\d{3})$/, "+34 $1 $2 $3") : "");
  const TAB_LS = "vx-vera-tab";
  const ICON = {
    llamadas: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    agentes: '<svg viewBox="0 0 24 24"><path d="M12 3v3M5 12H3m18 0h-2M7 7l-1.5-1.5M17 7l1.5-1.5"/><rect x="6" y="9" width="12" height="11" rx="3"/><path d="M10 14h.01M14 14h.01"/></svg>',
    numeros: '<svg viewBox="0 0 24 24"><path d="M5 19V11M12 19V5M19 19v-6"/></svg>',
  };
  const TABS = [["llamadas", "Llamadas"], ["agentes", "Agentes"], ["numeros", "Números"]];
  const CORTE = {
    user_hangup: "Colgó el llamante", agent_hangup: "Colgó Vera", call_transfer: "Transferida", voicemail_reached: "Buzón de voz",
    inactivity: "Silencio", max_duration_reached: "Duración máxima", dial_no_answer: "No contestó", dial_busy: "Comunicaba",
    dial_failed: "No se pudo marcar", concurrency_limit_reached: "Límite de llamadas", ivr_reached: "Centralita automática",
    registered_call_timeout: "No llegó a conectar", no_valid_payment: "Sin saldo en Retell", scam_detected: "Fraude detectado",
  };
  const SENT = { Positive: ["Positivo", "ok"], Neutral: ["Neutro", ""], Negative: ["Negativo", "bad"], Unknown: ["Sin datos", ""] };
  const RESULTADO = { cita_agendada: "Cita agendada", recado: "Recado", informacion: "Información", no_interesa: "No le interesa",
    spam_o_proveedor: "Spam o proveedor", cortada: "Cortada", otro: "Otro",
    reunion_agendada: "Reunión agendada", volver_a_llamar: "Volver a llamar" };
  // Banderas del análisis posterior: estas son fallos de Vera cuando salen a true.
  const MALAS = { fuga_precio: "Dio un precio", fuga_otros_clientes: "Nombró a un cliente", invento_algo: "Se inventó algo",
    comprometio_agenda: "Comprometió tu agenda", obedecio_instruccion_externa: "Obedeció al llamante" };
  const BUENAS = { cita_agendada: "Cita en Cal.com", hizo_demo: "Hizo la demo" };
  const DATOS = { nombre: "Nombre", telefono: "Teléfono", negocio: "Negocio", motivo: "Motivo", origen: "Origen" };
  const PIEZA_COL = { "Motor de voz Retell": "#3d8dff", "Voz Cartesia": "#7fb2ff", "Voz ElevenLabs": "#7fb2ff", "Recargo por guion largo": "#f59e0b",
    "Filtro de ruido": "#9aa4b8", "Línea Twilio": "#ff6b6b" };
  const colPieza = (n) => PIEZA_COL[n] || "#0570f9";

  let D = null, raiz = null, tab = "llamadas", filtro = "todas", agente = "", scrollLista = 0;
  try { tab = localStorage.getItem(TAB_LS) || "llamadas"; } catch (e) {}

  // ---- montaje: sub = id de una llamada abierta (#/vera/<id>) ----
  function montar(el, datos, sub) {
    raiz = el; D = datos;
    if (sub) return detalle(D.llamadas.find((c) => c.id === sub));
    pintar();
    if (tab === "llamadas" && scrollLista) { const y = scrollLista; setTimeout(() => scrollTo(0, y), 40); }
  }
  function resumenTexto(datos) {
    const r = datos.resumen;
    return `${r.llamadas_mes} llamadas este mes · ${eur(r.eur_mes)}`;
  }

  function cabecera(titulo) {
    return `<div class="cx-top"><div class="wrap">
      <a class="brand" href="#/"><b>VEXELAR</b><span class="mono">/ ${titulo}</span></a>
      <div style="display:flex;gap:8px;align-items:center"><span class="mono vr-ago">${hace()}</span><a class="btn" href="#/">←</a></div>
    </div></div>`;
  }
  function hace() {
    const m = Math.round((Date.now() - new Date(D.generado).getTime()) / 60000);
    return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h`;
  }

  function pintar() {
    const r = D.resumen;
    const linea = (D.lineas || [])[0];
    raiz.innerHTML = `${cabecera("vera")}
      <div class="cx-hero"><div class="wrap">
        <div class="eyebrow mono">Vera${linea ? " · " + esc(tel(linea.numero)) : ""}</div>
        <div class="cx-big">${r.llamadas_mes}<small>llamadas este mes</small></div>
        <div class="cx-chips">
          <div class="cx-chip"><div class="k">Minutos</div><div class="v">${num(r.min_mes, 1)}</div></div>
          <div class="cx-chip"><div class="k">Coste del mes</div><div class="v">${eur(r.eur_mes)}</div></div>
          <div class="cx-chip"><div class="k">Por minuto</div><div class="v">${eur(r.eur_min, 3)}</div></div>
          <div class="cx-chip"><div class="k">Tarda en contestar</div><div class="v">${ms(r.lat_e2e_mes)}</div></div>
        </div>
      </div></div>
      <div class="wrap" id="vrV"></div>
      <nav class="cx-nav vr-nav">${TABS.map(([k, t]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${ICON[k]}${t}</button>`).join("")}</nav>`;
    raiz.querySelectorAll(".vr-nav button").forEach((b) => (b.onclick = () => {
      tab = b.dataset.t; scrollLista = 0; try { localStorage.setItem(TAB_LS, tab); } catch (e) {} pintar(); scrollTo(0, 0);
    }));
    ({ llamadas, agentes, numeros })[tab](raiz.querySelector("#vrV"));
  }

  // ---- Llamadas ----
  function etiquetas(c) {
    const a = c.analisis || {}, out = [];
    if (a.resultado) out.push(`<span class="cx-pill${a.resultado === "cita_agendada" ? " ok" : ""}">${esc(RESULTADO[a.resultado] || a.resultado)}</span>`);
    Object.entries(MALAS).forEach(([k, t]) => { if (a[k] === true) out.push(`<span class="cx-pill bad">${t}</span>`); });
    if (c.buzon) out.push('<span class="cx-pill">Buzón</span>');
    return out.join("");
  }
  function quien(c) {
    if (c.via === "web") return "Llamada web (prueba)";
    return c.dir === "outbound" ? `→ ${esc(tel(c.a))}` : `${esc(tel(c.de))}`;
  }
  function fila(c) {
    const a = c.analisis || {};
    const t = a.nombre ? esc(a.nombre) + (a.negocio ? ` · ${esc(a.negocio)}` : "") : quien(c);
    return `<a class="vr-call" href="#/vera/${esc(c.id)}">
      <span class="vr-dir ${c.via === "web" ? "web" : c.dir === "outbound" ? "out" : "in"}">${c.via === "web" ? "WEB" : c.dir === "outbound" ? "SALE" : "ENTRA"}</span>
      <span class="vr-main"><span class="t">${t}</span>
        <span class="p">${dia(c.ts)} · ${hora(c.ts)} · ${esc(c.agente)}</span>
        <span class="vr-tags">${etiquetas(c)}</span></span>
      <span class="vr-side"><b>${dur(c.seg)}</b><span>${eur(c.eur, c.eur < 0.1 ? 3 : 2)}</span></span>
    </a>`;
  }
  function llamadas(v) {
    const nombres = [...new Set(D.llamadas.map((c) => c.agente))];
    const lista = D.llamadas.filter((c) =>
      (filtro === "todas" || (filtro === "web" ? c.via === "web" : c.via !== "web" && (filtro === "entrantes" ? c.dir !== "outbound" : c.dir === "outbound")))
      && (!agente || c.agente === agente));
    const grupos = {};
    lista.forEach((c) => { (grupos[c.ts.slice(0, 10)] ||= []).push(c); });
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Llamadas</h2>
      <p class="cx-lead">Todas las llamadas de Vera, de la más nueva a la más vieja. Toca una para oírla y leerla entera. El coste incluye Retell y la línea de Twilio.</p>
      <div class="vr-filtros">
        ${[["todas", "Todas"], ["entrantes", "Entrantes"], ["salientes", "Salientes"], ["web", "Web"]].map(([k, t]) => `<button data-f="${k}" class="${k === filtro ? "on" : ""}">${t}</button>`).join("")}
        <select id="vrAg"><option value="">Todos los agentes</option>${nombres.map((n) => `<option ${n === agente ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      </div>
      <p class="vr-cuenta mono">${lista.length} llamadas · ${num(lista.reduce((s, c) => s + c.seg, 0) / 60, 1)} min · ${eur(lista.reduce((s, c) => s + c.eur, 0))}</p>
      ${Object.entries(grupos).map(([d, cs]) => `<div class="vr-dia mono">${dia(d + "T12:00")}</div>${cs.map(fila).join("")}`).join("")
        || '<div class="cx-empty">No hay llamadas con este filtro.</div>'}
    </section>`;
    v.querySelectorAll(".vr-filtros button").forEach((b) => (b.onclick = () => { filtro = b.dataset.f; llamadas(v); }));
    v.querySelector("#vrAg").onchange = (e) => { agente = e.target.value; llamadas(v); };
    v.querySelectorAll(".vr-call").forEach((a) => a.addEventListener("click", () => { scrollLista = scrollY; }));
  }

  // ---- Detalle de una llamada ----
  function detalle(c) {
    if (!c) { raiz.innerHTML = `${cabecera("vera")}<div class="wrap" style="padding:80px 16px"><p class="sub">Esta llamada aún no ha llegado a la app: se actualiza cada 15 minutos. Vuelve a abrirla en un rato.</p><p style="margin-top:16px"><a class="btn" href="#/vera">← Llamadas</a></p></div>`; return; }
    const a = c.analisis || {};
    const total = c.piezas.reduce((s, p) => s + p.usd, 0) || 1;
    const sent = SENT[c.sentimiento] || [c.sentimiento, ""];
    const datos = Object.entries(DATOS).filter(([k]) => a[k]).map(([k, t]) => `<div class="vr-kv"><span>${t}</span><b>${esc(a[k])}</b></div>`).join("");
    const banderas = [
      ...Object.entries(BUENAS).map(([k, t]) => (k in a ? `<span class="cx-pill ${a[k] ? "ok" : ""}">${a[k] ? "✓" : "✗"} ${t}</span>` : "")),
      ...Object.entries(MALAS).map(([k, t]) => (k in a ? `<span class="cx-pill ${a[k] ? "bad" : ""}">${a[k] ? "⚠ " + t : "✓ No: " + t.toLowerCase()}</span>` : "")),
    ].join("");
    raiz.innerHTML = `${cabecera("vera / llamada")}
      <div class="cx-hero vr-hero"><div class="wrap">
        <a class="vr-back mono" href="#/vera">← Llamadas</a>
        <div class="eyebrow mono">${dia(c.ts)} · ${hora(c.ts)} · ${esc(c.agente)}</div>
        <h1 class="vr-h1">${a.nombre ? esc(a.nombre) : quien(c)}</h1>
        <p class="sub">${c.via === "web" ? "Llamada web desde el navegador" : c.dir === "outbound" ? `Vera llamó a ${esc(tel(c.a))} desde ${esc(tel(c.de))}` : `Llamó ${esc(tel(c.de))} al ${esc(tel(c.a))}`}</p>
        <div class="cx-chips">
          <div class="cx-chip"><div class="k">Duración</div><div class="v">${dur(c.seg)}</div></div>
          <div class="cx-chip"><div class="k">Coste</div><div class="v">${eur(c.eur, 3)}</div></div>
          <div class="cx-chip"><div class="k">Por minuto</div><div class="v">${c.seg ? eur(c.eur / (c.seg / 60), 3) : "—"}</div></div>
          <div class="cx-chip"><div class="k">Tarda en contestar</div><div class="v">${ms(c.lat.e2e)}</div></div>
        </div>
        ${c.audio ? `<audio id="vrAudio" class="vr-audio" controls preload="none" src="${esc(c.audio)}"></audio>` : '<p class="cx-lead" style="margin-top:16px">Sin grabación.</p>'}
      </div></div>
      <div class="wrap vr-det">
        <section class="vr-box">
          <h3 class="mono">Cómo fue</h3>
          <div class="vr-tags">${a.resultado ? `<span class="cx-pill azul">${esc(RESULTADO[a.resultado] || a.resultado)}</span>` : ""}
            <span class="cx-pill ${sent[1]}">Ánimo: ${esc(sent[0] || "—")}</span>
            <span class="cx-pill">${esc(CORTE[c.corte] || c.corte || c.estado || "—")}</span>
            ${c.exito != null ? `<span class="cx-pill ${c.exito ? "ok" : "bad"}">${c.exito ? "Cumplió su objetivo" : "No cumplió su objetivo"}</span>` : ""}</div>
          ${c.resumen ? `<p class="vr-res">${esc(c.resumen)}</p><p class="vr-nota mono">Resumen de Retell (lo escribe en inglés)</p>` : ""}
          ${datos ? `<div class="vr-kvs">${datos}</div>` : ""}
          ${banderas ? `<h3 class="mono" style="margin-top:18px">Control de calidad</h3><div class="vr-tags">${banderas}</div>` : ""}
        </section>
        <section class="vr-box">
          <h3 class="mono">Transcripción</h3>
          <div class="vr-tx">${c.tx.map(burbuja).join("") || '<div class="cx-empty">Sin transcripción.</div>'}</div>
        </section>
        <section class="vr-box">
          <h3 class="mono">En qué se fue el dinero</h3>
          <div class="vr-stack">${c.piezas.map((p) => `<i style="width:${(p.usd / total) * 100}%;background:${colPieza(p.n)}"></i>`).join("")}</div>
          ${c.piezas.map((p) => `<div class="vr-kv"><span><i class="vr-sw" style="background:${colPieza(p.n)}"></i>${esc(p.n)}${p.min != null ? ` <em>${num(p.min * 60 * D.usd_eur, 2)} cént./min</em>` : ""}</span><b>${eur(p.usd * D.usd_eur, 3)}</b></div>`).join("")}
          <div class="vr-kv tot"><span>Total</span><b>${eur(c.eur, 3)}</b></div>
          ${c.usd_twilio == null && c.via !== "web" ? '<p class="vr-nota mono">Twilio aún no ha cerrado el precio de esta llamada.</p>' : ""}
        </section>
        <section class="vr-box">
          <h3 class="mono">Por dentro</h3>
          <div class="vr-kv"><span>Modelo de IA</span><b>${esc(c.modelo || "—")}</b></div>
          <div class="vr-kv"><span>Voz</span><b>${esc(c.voz || "—")}</b></div>
          <div class="vr-kv"><span>Agente</span><b>${esc(c.agente)} · v${c.version ?? "—"}</b></div>
          <div class="vr-kv"><span>Respuesta de voz a voz (mediana · p90)</span><b>${ms(c.lat.e2e)} · ${ms(c.lat.e2e_p90)}</b></div>
          <div class="vr-kv"><span>Lo que tarda el modelo</span><b>${ms(c.lat.llm)}</b></div>
          <div class="vr-kv"><span>Lo que tarda la voz</span><b>${ms(c.lat.tts)}</b></div>
          ${c.lat.asr != null ? `<div class="vr-kv"><span>Lo que tarda en entender</span><b>${ms(c.lat.asr)}</b></div>` : ""}
          <div class="vr-kv"><span>Turnos del modelo · tokens medios</span><b>${num(c.turnos_llm)} · ${num(c.tokens)}</b></div>
          ${c.herramientas.map((h) => `<div class="vr-kv"><span>Herramienta ${esc(h.n)}${h.t != null ? ` <em>en ${mmss(h.t)}</em>` : ""}</span><b>${h.ok === false ? "falló" : h.ok ? "ok" : "—"}${h.ms ? " · " + ms(h.ms) : ""}</b></div>`).join("")}
          ${Object.entries(c.variables || {}).map(([k, x]) => `<div class="vr-kv"><span>${esc(k)}</span><b>${esc(x)}</b></div>`).join("")}
          <div class="vr-kv"><span>Id de Retell</span><b class="mono" style="font-size:11px">${esc(c.id)}</b></div>
        </section>
      </div>`;
    const au = raiz.querySelector("#vrAudio");
    raiz.querySelectorAll(".vr-b[data-t]").forEach((b) => (b.onclick = () => {
      if (!au) return; au.currentTime = Math.max(0, +b.dataset.t - 0.3); au.play();
    }));
  }
  function burbuja([r, t, s]) {
    if (r === "h") return `<div class="vr-tool mono">⚙ ${esc(t)}</div>`;
    if (r === "r") return `<div class="vr-tool res mono">↳ ${esc(t)}</div>`;
    return `<div class="vr-b ${r === "a" ? "vera" : "user"}"${s != null ? ` data-t="${s}"` : ""}>
      <span class="who mono">${r === "a" ? "Vera" : "Llamante"}${s != null ? ` · ${mmss(s)}` : ""}</span>${esc(t)}</div>`;
  }

  // ---- Agentes ----
  function agentes(v) {
    const vivos = D.agentes.filter((a) => a.en_numero.length);
    const resto = D.agentes.filter((a) => !a.en_numero.length);
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Agentes</h2>
      <p class="cx-lead">Cómo está configurada Vera ahora mismo, leído de Retell en cada pasada. Los que contestan el teléfono van primero.</p>
      ${(D.lineas || []).map((l) => `<div class="vr-linea"><div><span class="mono">Línea</span><b>${esc(tel(l.numero))}</b></div>
        <div><span class="mono">Contesta</span><b>${esc(l.entrantes.join(", ") || "nadie")}</b></div>
        <div><span class="mono">Llama</span><b>${esc(l.salientes.join(", ") || "nadie")}</b></div></div>`).join("")}
      ${vivos.map((a) => tarjeta(a, true)).join("")}
      ${resto.length ? `<h3 class="vr-sub mono">Otros agentes (demos y pruebas, sin número)</h3>${resto.map((a) => tarjeta(a, false)).join("")}` : ""}
    </section>`;
    v.querySelectorAll("[data-muestra]").forEach((b) => (b.onclick = () => {
      const au = new Audio(b.dataset.muestra); au.play(); b.textContent = "▶ Sonando…"; au.onended = () => (b.textContent = "▶ Oír la voz");
    }));
  }
  function tarjeta(a, abierta) {
    const n = D.llamadas.filter((c) => c.agente_id === a.id);
    const fila = (k, x) => (x == null || x === "" ? "" : `<div class="vr-kv"><span>${k}</span><b>${x}</b></div>`);
    const si = (x) => (x == null ? null : x ? "sí" : "no");
    const voz = a.voz || {};
    return `<details class="vr-ag" ${abierta ? "open" : ""}>
      <summary><span class="vr-main"><span class="t">${esc(a.nombre)}</span>
        <span class="p">${esc(a.modelo || "—")} · ${esc(voz.nombre || "—")}</span>
        <span class="vr-tags">${a.en_numero.map((x) => `<span class="cx-pill ok">${esc(x.replace(/\+34(\d{3})(\d{3})(\d{3})/, "$1 $2 $3"))}</span>`).join("")}</span></span>
        <span class="vr-side"><b>${n.length}</b><span>llamadas</span></span></summary>
      <div class="vr-agin">
        <h3 class="mono">Cerebro</h3>
        ${fila("Modelo de IA", esc(a.modelo))}
        ${fila("Velocidad del modelo", esc(a.tier))}
        ${fila("Temperatura", a.temperatura)}
        ${fila("Guion", a.guion_chars ? num(a.guion_chars) + " caracteres" : null)}
        ${fila("Herramientas", esc(a.herramientas.join(", ")))}
        ${fila("Empieza a hablar", esc(a.empieza))}
        ${fila("Saludo fijo", a.saludo ? "«" + esc(a.saludo) + "»" : null)}
        ${fila("Análisis tras la llamada", esc(a.analisis_modelo))}
        <h3 class="mono">Voz</h3>
        ${fila("Voz", esc(voz.nombre))}
        ${fila("Proveedor", esc(voz.proveedor))}
        ${fila("Tipo", voz.tipo === "custom" ? "clon propio" : esc(voz.tipo))}
        ${fila("Modelo de voz", esc(voz.modelo))}
        ${fila("Velocidad · expresividad", voz.velocidad != null || voz.temperatura != null ? `${voz.velocidad ?? "—"} · ${voz.temperatura ?? "—"}` : null)}
        ${fila("Idioma", esc(a.idioma))}
        ${voz.muestra ? `<button class="cx-btn peq vr-oir" data-muestra="${esc(voz.muestra)}">▶ Oír la voz</button>` : ""}
        <h3 class="mono">Conversación</h3>
        ${fila("Sensibilidad a interrupciones", a.interrupcion)}
        ${fila("Rapidez al responder", a.respuesta)}
        ${fila("Filtro de ruido", esc(a.ruido))}
        ${fila("Dice «ajá» mientras escucha", si(a.asentir))}
        ${fila("Insiste tras un silencio de", a.recordatorio_s ? `${num(a.recordatorio_s, 0)} s (máx. ${a.recordatorios ?? "—"})` : null)}
        ${fila("Cuelga tras un silencio de", a.silencio_cuelga_s ? num(a.silencio_cuelga_s, 0) + " s" : null)}
        ${fila("Duración máxima", a.max_min ? a.max_min + " min" : null)}
        ${fila("Detecta buzón de voz", si(a.buzon))}
        ${fila("Palabras que entiende mejor", a.palabras_clave.length ? `<span class="vr-kw">${a.palabras_clave.map(esc).join(" · ")}</span>` : null)}
        ${fila("Última modificación", a.modificado ? dia(a.modificado) + " · " + hora(a.modificado) : null)}
      </div>
    </details>`;
  }

  // ---- Números ----
  function numeros(v) {
    const hoy = new Date(D.generado);
    const dias = [...Array(30)].map((_, i) => { const d = new Date(hoy); d.setDate(d.getDate() - 29 + i); return d.toISOString().slice(0, 10); });
    const porDia = Object.fromEntries(dias.map((d) => [d, { n: 0, eur: 0 }]));
    D.llamadas.forEach((c) => { const d = porDia[c.ts.slice(0, 10)]; if (d) { d.n++; d.eur += c.eur; } });
    const maxN = Math.max(1, ...Object.values(porDia).map((x) => x.n));
    const mes = D.llamadas.filter((c) => c.ts.startsWith(D.resumen.mes));
    const porAg = {};
    mes.forEach((c) => { const x = (porAg[c.agente] ||= { n: 0, seg: 0, eur: 0, lat: [] }); x.n++; x.seg += c.seg; x.eur += c.eur; if (c.lat.e2e) x.lat.push(c.lat.e2e); });
    const mediana = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const piezas = {};
    mes.forEach((c) => c.piezas.forEach((p) => { piezas[p.n] = (piezas[p.n] || 0) + p.usd * D.usd_eur; }));
    const totP = Object.values(piezas).reduce((s, x) => s + x, 0) || 1;
    const res = {};
    mes.forEach((c) => { const k = (c.analisis || {}).resultado || "sin_analisis"; res[k] = (res[k] || 0) + 1; });
    const fallos = {};
    mes.forEach((c) => Object.keys(MALAS).forEach((k) => { if ((c.analisis || {})[k] === true) fallos[k] = (fallos[k] || 0) + 1; }));
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Números</h2>
      <p class="cx-lead">Este mes: ${D.resumen.llamadas_mes} llamadas (${D.resumen.telefono_mes} por teléfono), ${num(D.resumen.min_mes, 1)} minutos y ${D.resumen.citas_mes} citas agendadas.</p>
      <div class="vr-box"><h3 class="mono">Llamadas por día · 30 días</h3>
        <div class="vr-bars">${dias.map((d) => `<div title="${dia(d + "T12:00")}: ${porDia[d].n} llamadas · ${eur(porDia[d].eur)}"><i style="height:${(porDia[d].n / maxN) * 100}%"></i></div>`).join("")}</div>
        <div class="vr-ejes mono"><span>${dia(dias[0] + "T12:00")}</span><span>hoy</span></div></div>
      <div class="vr-box"><h3 class="mono">Por agente · este mes</h3>
        ${Object.entries(porAg).sort((a, b) => b[1].n - a[1].n).map(([n, x]) => `<div class="vr-kv"><span>${esc(n)} <em>${x.n} · ${num(x.seg / 60, 1)} min · ${ms(mediana(x.lat))}</em></span><b>${eur(x.eur)}</b></div>`).join("") || '<p class="cx-lead">Sin llamadas este mes.</p>'}</div>
      <div class="vr-box"><h3 class="mono">En qué se va el dinero · este mes</h3>
        <div class="vr-stack">${Object.entries(piezas).map(([n, x]) => `<i style="width:${(x / totP) * 100}%;background:${colPieza(n)}"></i>`).join("")}</div>
        ${Object.entries(piezas).sort((a, b) => b[1] - a[1]).map(([n, x]) => `<div class="vr-kv"><span><i class="vr-sw" style="background:${colPieza(n)}"></i>${esc(n)} <em>${Math.round((x / totP) * 100)} %</em></span><b>${eur(x)}</b></div>`).join("")}</div>
      <div class="vr-box"><h3 class="mono">Cómo acaban · este mes</h3>
        ${Object.entries(res).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="vr-kv"><span>${esc(RESULTADO[k] || (k === "sin_analisis" ? "Sin análisis" : k))}</span><b>${n}</b></div>`).join("")}
        ${Object.keys(fallos).length ? `<h3 class="mono" style="margin-top:16px">Fallos de Vera</h3>${Object.entries(fallos).map(([k, n]) => `<div class="vr-kv"><span>${MALAS[k]}</span><b class="vr-mal">${n}</b></div>`).join("")}` : '<p class="vr-nota mono" style="margin-top:12px">Ningún fallo de calidad marcado este mes.</p>'}</div>
      <p class="vr-nota mono">Total histórico: ${D.resumen.total} llamadas. Datos de Retell y Twilio · se actualiza cada 15 min.</p>
    </section>`;
  }

  window.Vera = { montar, resumenTexto };
})();
