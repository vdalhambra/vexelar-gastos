// Sección «Facturas» de la app de Vexelar (31-oct-2026, orden del Chairman): facturas por enviar, esperando pago y
// cobradas · las que vienen · propuestas enviadas · gastos deducibles · IVA del trimestre e IRPF estimado.
// Los datos llegan cifrados en facturas.json (tools/panel_facturas.py, que solo lee las fichas de finanzas/); la app
// los descifra con la clave del panel y se los pasa a montar(). Solo lectura. Sin dependencias.
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const eur = (v, d = 2) => (v == null ? "—" : v.toLocaleString("es-ES", { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: "always" }) + " €");
  const eur0 = (v) => eur(v, 0);
  const dia = (s) => (s ? new Date(s + "T12:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "—");
  const diaLargo = (s) => (s ? new Date(s + "T12:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "—");
  const dias = (s) => Math.round((new Date(s + "T12:00") - new Date(D.hoy + "T12:00")) / 864e5);
  const enDias = (s) => { const n = dias(s); return n === 0 ? "hoy" : n === 1 ? "mañana" : n === -1 ? "ayer" : n > 0 ? `en ${n} días` : `hace ${-n} días`; };
  const trim = (q) => (q ? `${q.slice(-1)}.º trimestre ${q.slice(0, 4)}` : "");
  const TAB_LS = "vx-facturas-tab";
  const ICON = {
    facturas: '<svg viewBox="0 0 24 24"><path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
    proximas: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    propuestas: '<svg viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-7z"/></svg>',
    gastos: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 9h6M9 13h4"/></svg>',
    impuestos: '<svg viewBox="0 0 24 24"><path d="M5 19L19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
  };
  const TABS = [["facturas", "Facturas"], ["proximas", "Próximas"], ["propuestas", "Propuestas"], ["gastos", "Gastos"], ["impuestos", "Impuestos"]];
  const ESTADO = {
    por_enviar: ["Por enviar", "warn"], esperando: ["Esperando pago", "azul"], vencida: ["Vencida", "bad"],
    cobrada: ["Cobrada", "ok"], sustituida: ["Sustituida", ""],
  };
  const PROP = {
    enviada: ["Enviada, sin respuesta", "azul"], aceptada: ["Aceptada", "ok"], borrador: ["Borrador", ""], lista: ["Lista para enviar", "warn"],
    sustituida: ["Sustituida", ""], rechazada: ["Rechazada", "bad"], otra: ["—", ""],
  };

  let D = null, raiz = null, tab = "facturas", filtro = "vivas", abierta = null, verViejas = false;
  try { tab = localStorage.getItem(TAB_LS) || "facturas"; } catch (e) {}

  function montar(el, datos) { raiz = el; D = datos; pintar(); }
  function resumenTexto(datos) {
    const r = datos.resumen;
    const partes = [];
    if (r.n_por_enviar) partes.push(`${r.n_por_enviar} por enviar`);
    partes.push(r.n_pendiente ? `${eur0(r.pendiente_cobro)} por cobrar` : "Nada por cobrar");
    return partes.join(" · ");
  }
  function hace() {
    const m = Math.round((Date.now() - new Date(D.generado).getTime()) / 60000);
    return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : `hace ${Math.floor(m / 60)} h`;
  }

  function pintar() {
    const r = D.resumen;
    raiz.innerHTML = `<div class="cx-top"><div class="wrap">
        <a class="brand" href="#/"><b>VEXELAR</b><span class="mono">/ facturas</span></a>
        <div style="display:flex;gap:8px;align-items:center"><span class="mono fa-ago">${hace()}</span><a class="btn" href="#/">←</a></div>
      </div></div>
      <div class="cx-hero"><div class="wrap">
        <div class="eyebrow mono">Por cobrar${r.n_vencidas ? ` · ${r.n_vencidas} vencida${r.n_vencidas > 1 ? "s" : ""}` : ""}</div>
        <div class="cx-big">${eur0(r.pendiente_cobro)}</div>
        <div class="cx-chips">
          <div class="cx-chip"><div class="k">Por enviar</div><div class="v">${eur0(r.por_enviar)}</div></div>
          <div class="cx-chip"><div class="k">Facturado ${D.hoy.slice(0, 4)}</div><div class="v">${eur0(r.facturado_anio)}</div></div>
          <div class="cx-chip"><div class="k">IVA ${r.trimestre.slice(-1)}T hasta hoy</div><div class="v">${eur0(r.iva_trimestre)}</div></div>
          <div class="cx-chip"><div class="k">Renta (estimada)</div><div class="v ${r.irpf_a_pagar < 0 ? "fa-dev" : ""}">${r.irpf_a_pagar < 0 ? "+" + eur0(-r.irpf_a_pagar) : eur0(r.irpf_a_pagar)}</div></div>
        </div>
      </div></div>
      <div class="wrap" id="faV"></div>
      <nav class="cx-nav">${TABS.map(([k, t]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${ICON[k]}${t}${k === "facturas" && r.n_por_enviar ? `<span class="n">${r.n_por_enviar}</span>` : ""}</button>`).join("")}</nav>`;
    raiz.querySelectorAll(".cx-nav button").forEach((b) => (b.onclick = () => {
      tab = b.dataset.t; try { localStorage.setItem(TAB_LS, tab); } catch (e) {} pintar(); scrollTo(0, 0);
    }));
    ({ facturas, proximas, propuestas, gastos, impuestos })[tab](raiz.querySelector("#faV"));
  }

  // ---- Facturas ----
  function pill(est, mapa) { const [t, c] = mapa[est] || [est, ""]; return `<span class="cx-pill ${c}">${esc(t)}</span>`; }
  function cuando(f) {
    if (f.estado === "cobrada") return `Cobrada el ${dia(f.cobro)}`;
    if (f.estado === "por_enviar") return `Hecha el ${dia(f.fecha)} · sin enviar`;
    if (f.estado === "vencida") return `Venció ${enDias(f.vence)}`;
    if (f.estado === "esperando") return `Vence ${enDias(f.vence)} (${dia(f.vence)})`;
    return dia(f.fecha);
  }
  function fila(f) {
    const ab = abierta === f.id;
    return `<div class="fa-row ${ab ? "on" : ""}" data-id="${esc(f.id)}">
      <div class="fa-l"><span class="fa-n mono">${esc(f.id)}</span><b>${esc(f.nombre)}</b><span class="fa-p">${cuando(f)}</span></div>
      <div class="fa-r"><b>${eur(f.total)}</b>${pill(f.estado, ESTADO)}</div>
      ${ab ? `<div class="fa-det">
        <p>${esc(f.concepto)}</p>
        <dl>
          <dt>Base</dt><dd>${eur(f.base)}</dd>
          <dt>IVA ${f.iva_pct ? f.iva_pct + " %" : "(exenta)"}</dt><dd>${eur(f.iva)}</dd>
          <dt>Retención IRPF</dt><dd>−${eur(f.irpf)}</dd>
          <dt>Total</dt><dd><b>${eur(f.total)}</b></dd>
          <dt>Fecha</dt><dd>${diaLargo(f.fecha)}</dd>
          <dt>Enviada</dt><dd>${f.envio ? diaLargo(f.envio) : "—"}</dd>
          <dt>Vence</dt><dd>${diaLargo(f.vence)}</dd>
          <dt>Cobrada</dt><dd>${f.cobro ? diaLargo(f.cobro) : "—"}</dd>
          <dt>IVA va al</dt><dd>${esc(trim(f.trimestre))}</dd>
        </dl>
        <p class="fa-ruta mono">${esc(f.ruta)}</p>
      </div>` : ""}
    </div>`;
  }
  function facturas(v) {
    const F = D.facturas;
    const grupos = {
      vivas: F.filter((f) => ["por_enviar", "esperando", "vencida"].includes(f.estado)),
      cobradas: F.filter((f) => f.estado === "cobrada"),
      todas: F,
    };
    const lista = grupos[filtro];
    const orden = { por_enviar: 0, vencida: 1, esperando: 2 };
    if (filtro === "vivas") lista.sort((a, b) => (orden[a.estado] - orden[b.estado]) || (a.vence || "").localeCompare(b.vence || ""));
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Facturas</h2>
      <p class="cx-lead">Una factura cuenta como enviada cuando me dices «enviada». Toca una para ver el detalle.</p>
      <div class="fa-filtros">${[["vivas", `Pendientes · ${grupos.vivas.length}`], ["cobradas", `Cobradas · ${grupos.cobradas.length}`], ["todas", "Todas"]]
        .map(([k, t]) => `<button data-f="${k}" class="${k === filtro ? "on" : ""}">${t}</button>`).join("")}</div>
      ${lista.map(fila).join("") || '<div class="cx-empty">Nada pendiente: todo lo enviado está cobrado.</div>'}
      ${filtro === "cobradas" ? `<p class="fa-tot mono">${grupos.cobradas.length} facturas · ${eur(grupos.cobradas.reduce((s, f) => s + f.total, 0))} cobrados</p>` : ""}
    </section>`;
    v.querySelectorAll(".fa-filtros button").forEach((b) => (b.onclick = () => { filtro = b.dataset.f; abierta = null; facturas(v); }));
    v.querySelectorAll(".fa-row").forEach((r) => (r.onclick = () => { abierta = abierta === r.dataset.id ? null : r.dataset.id; facturas(v); }));
  }

  // ---- Próximas ----
  function proximas(v) {
    const P = D.proximas;
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Próximas</h2>
      <p class="cx-lead">Lo que toca facturar y cuándo. Si ya hay una factura de ese cliente cerca de la fecha, salta al mes siguiente.</p>
      ${P.map((p) => `<div class="fa-row fa-prox ${p.atrasada ? "atr" : ""}">
        <div class="fa-cal">${p.fecha ? `<b>${new Date(p.fecha + "T12:00").getDate()}</b><span class="mono">${new Date(p.fecha + "T12:00").toLocaleDateString("es-ES", { month: "short" })}</span>` : '<span class="mono">espera</span>'}</div>
        <div class="fa-l"><b>${esc(p.nombre)}</b><span class="fa-p">${esc(p.concepto)}</span>
          ${p.gatillo ? `<span class="fa-p fa-g">${esc(p.gatillo)}</span>` : p.fecha ? `<span class="fa-p">${p.atrasada ? "Atrasada: " : ""}${enDias(p.fecha)}</span>` : ""}
          ${p.nota ? `<span class="fa-p">${esc(p.nota)}</span>` : ""}</div>
        <div class="fa-r"><b>${p.total != null ? eur(p.total) : "Variable"}</b>${p.base != null ? `<span class="fa-p">${eur(p.base)} base</span>` : ""}</div>
      </div>`).join("") || '<div class="cx-empty">No hay facturas previstas.</div>'}
    </section>`;
  }

  // ---- Propuestas ----
  function propuestas(v) {
    const vivas = D.propuestas.filter((p) => !["sustituida", "rechazada"].includes(p.estado));
    const viejas = D.propuestas.filter((p) => ["sustituida", "rechazada"].includes(p.estado));
    const tarjeta = (p) => `<div class="fa-prop">
      <div class="fa-prop-top"><span class="mono">${esc(p.numero)} · ${dia(p.fecha)}</span>${pill(p.estado, PROP)}</div>
      <b>${esc(p.cliente)}</b>
      <p>${esc(p.concepto)}</p>
      <div class="fa-imp">${esc(p.importe)}</div>
      ${p.estado_txt ? `<p class="fa-p">${esc(p.estado_txt)}</p>` : ""}
    </div>`;
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Propuestas</h2>
      <p class="cx-lead">Presupuestos y propuestas del registro, la más nueva arriba. Importes con IVA salvo que diga otra cosa.</p>
      ${vivas.map(tarjeta).join("") || '<div class="cx-empty">No hay propuestas abiertas.</div>'}
      ${viejas.length ? `<button class="cx-btn fa-mas">${verViejas ? "Ocultar" : "Ver"} las sustituidas (${viejas.length})</button>${verViejas ? viejas.map(tarjeta).join("") : ""}` : ""}
    </section>`;
    const b = v.querySelector(".fa-mas");
    if (b) b.onclick = () => { verViejas = !verViejas; propuestas(v); };
  }

  // ---- Gastos ----
  function gastos(v) {
    const G = D.gastos;
    const porQ = {};
    G.forEach((g) => { (porQ[g.trimestre] ||= []).push(g); });
    const total = D.irpf.gastos + D.irpf.amortizacion;  // los equipos entran por su amortización del año, no enteros
    const ivaDed = G.reduce((s, g) => s + g.iva_deducible, 0);
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Gastos</h2>
      <p class="cx-lead">Los gastos deducibles registrados en ${D.hoy.slice(0, 4)}. El ordenador y el móvil se amortizan: en la Renta entra solo la parte del año.</p>
      <div class="fa-kpis">
        <div><span class="mono">Gasto para la Renta</span><b>${eur0(total)}</b></div>
        <div><span class="mono">IVA que restas</span><b>${eur0(ivaDed)}</b></div>
        <div><span class="mono">Apuntes</span><b>${G.length}</b></div>
      </div>
      ${Object.entries(porQ).sort((a, b) => b[0].localeCompare(a[0])).map(([q, gs]) => `
        <div class="fa-q mono">${esc(trim(q))} · ${eur(gs.reduce((s, g) => s + g.gasto_irpf, 0))}</div>
        ${gs.map((g) => `<div class="fa-row fa-gasto">
          <div class="fa-l"><span class="fa-n mono">${esc(g.id)} · ${dia(g.fecha)}</span><b>${esc(g.proveedor)}</b><span class="fa-p">${esc(g.concepto)}</span>
            <span class="fa-tags">${g.amortizacion ? '<span class="cx-pill">Se amortiza</span>' : ""}${g.iva_deducible ? `<span class="cx-pill ok">IVA ${eur(g.iva_deducible)}</span>` : ""}${g.confirmado ? "" : '<span class="cx-pill warn">Sin confirmar</span>'}</span></div>
          <div class="fa-r"><b>${eur(g.eur)}</b>${g.usd ? `<span class="fa-p">${g.usd.toLocaleString("es-ES")} $</span>` : ""}</div>
        </div>`).join("")}`).join("") || '<div class="cx-empty">No hay gastos registrados este año.</div>'}
    </section>`;
  }

  // ---- Impuestos ----
  function impuestos(v) {
    const I = D.irpf;
    const qs = [...D.iva].reverse();
    const linea = (k, val, cls = "") => `<div class="fa-li ${cls}"><span>${k}</span><b>${val}</b></div>`;
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">IVA</h2>
      <p class="cx-lead">Modelo 303, cada trimestre: el IVA que cobras en tus facturas menos el que pagas en gastos con factura a tu nombre.</p>
      ${qs.map((q) => `<div class="fa-box ${q.actual ? "act" : ""}">
        <div class="fa-box-top"><b>${esc(trim(q.trimestre))}</b>${q.presentado ? `<span class="cx-pill ok">Presentado ${dia(q.presentado.fecha)}</span>` : `<span class="cx-pill ${q.actual ? "azul" : "warn"}">Plazo hasta el ${dia(q.plazo)}</span>`}</div>
        ${linea("IVA de tus facturas", eur(q.repercutido))}
        ${q.repercutido_por_enviar ? linea("· de ellas, por enviar", eur(q.repercutido_por_enviar), "menor") : ""}
        ${linea("IVA de tus gastos", "−" + eur(q.soportado))}
        ${linea(q.presentado ? "Pagado" : q.actual ? "A pagar hasta hoy" : "A pagar", eur(q.presentado ? q.presentado.resultado : q.resultado), "tot")}
        ${q.base_exenta ? `<p class="fa-p">${eur(q.base_exenta)} de formación exenta: no va en el 303, va al resumen anual (390).</p>` : ""}
        ${q.actual ? `<p class="fa-p">Sigue subiendo con cada factura del trimestre. Si el bote de IVA tiene al menos esta cifra, vas bien.</p>` : ""}
      </div>`).join("")}

      <h2 class="cx-h">IRPF</h2>
      <p class="cx-lead">No pagas el IRPF cada trimestre (modelo 130): tus clientes te retienen el 7 % y lo ajustas todo en la Renta de ${I.anio}, en primavera de ${I.anio + 1}.</p>
      <div class="fa-box act">
        <div class="fa-box-top"><b>Renta ${I.anio} · estimación</b><span class="cx-pill warn">Orientativa</span></div>
        ${linea("Lo que has facturado (base)", eur(I.ingresos))}
        ${linea("Gastos deducibles", "−" + eur(I.gastos))}
        ${linea("Amortización de equipos", "−" + eur(I.amortizacion))}
        ${linea("Gastos de difícil justificación (5 %)", "−" + eur(I.dificil_justificacion))}
        ${linea("Reducción por inicio de actividad (20 %)", "−" + eur(I.reduccion_inicio))}
        ${linea("Base sobre la que se paga", eur(I.base), "tot")}
        ${linea("Impuesto estimado", eur(I.cuota))}
        ${linea("Ya retenido por tus clientes", "−" + eur(I.retenciones))}
        ${linea(I.a_pagar < 0 ? "Te devolverían" : "Te tocaría pagar", eur(Math.abs(I.a_pagar)), "tot " + (I.a_pagar < 0 ? "dev" : ""))}
        <p class="fa-p">Tipo efectivo: ${I.tipo_efectivo.toLocaleString("es-ES")} % de lo facturado. El bote de IRPF (12 %) iría por ${eur0(I.provision_12)}.</p>
        <p class="fa-p">${esc(I.nota)}</p>
      </div>
    </section>`;
  }

  window.Facturas = { montar, resumenTexto };
})();
