// Sección «Contenido» de la app de Vexelar (29-oct-2026, orden del Chairman): la máquina de contenido en el móvil.
// Revisar (aprobar, editar el copy a mano, elegir gancho, pedir cambios) · Cola · Números · Entrenar (referentes e
// ideas) · Cerebro (patrones medidos y aprendizajes). Habla con la API de vexelar-contenido.pages.dev con la clave
// que viaja cifrada dentro de los datos del panel. Sin dependencias.
(() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v) => (v == null ? "—" : Math.round(v).toLocaleString("es-ES", { useGrouping: "always" }));
  const pct = (v) => (v == null ? "—" : Math.round(v) + " %");
  const seg = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toLocaleString("es-ES") + " s");
  const cifra = (v) => (typeof v === "number" ? (Math.round(v * 10) / 10).toLocaleString("es-ES") : esc(v));
  const fecha = (s) => (s ? new Date(s).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }) : "");
  const hora = (s) => (s ? new Date(s).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "");
  const TAB_LS = "vx-contenido-tab";
  const ICON = {
    revisar: '<svg viewBox="0 0 24 24"><path d="M4 5h16v14H4z"/><path d="M10 9l5 3-5 3z"/></svg>',
    cola: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    numeros: '<svg viewBox="0 0 24 24"><path d="M5 19V11M12 19V5M19 19v-6"/></svg>',
    entrenar: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    cerebro: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><path d="M12 8v4l3 2"/></svg>',
  };
  const TABS = [["revisar", "Revisar"], ["cola", "Cola"], ["numeros", "Números"], ["entrenar", "Entrenar"], ["cerebro", "Cerebro"]];

  let cfg = null, raiz = null, D = null, tab = "revisar";
  try { tab = localStorage.getItem(TAB_LS) || "revisar"; } catch (e) {}

  async function api(ruta, cuerpo) {
    const r = await fetch(cfg.api + ruta, {
      method: cuerpo ? "POST" : "GET",
      headers: Object.assign({ "x-clave": cfg.clave }, cuerpo ? { "content-type": "application/json" } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      cache: "no-store",
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "Error " + r.status);
    return j;
  }
  const med = (u) => (u ? (/^https?:/.test(u) ? u : D.base + "/" + u) : "");

  // ---- estado de cada pieza (misma lógica que la web de revisión, más «aplicando» y «quitar») ----
  function estadoDe(p) {
    if (p.publicado) return "publicado";
    const h = (D.feedback[p.slug] || []).filter((x) => x.accion !== "nota");
    if (!h.length) return "pendiente";
    const ult = h[h.length - 1];
    if (ult.accion === "quitar") return p.rehecho && p.rehecho > ult.ts ? "pendiente" : "quitada";
    if (ult.accion === "aprobar") {
      if (p.aprobado && p.aprobado >= ult.ts) return "aprobado";
      if (p.rehecho && p.rehecho > ult.ts) return "pendiente";
      return ult.laminas ? "aplicando" : "aprobado";
    }
    return p.rehecho && p.rehecho > ult.ts ? "pendiente" : "rehacer";
  }
  const NOMBRE = { pendiente: "Por revisar", aprobado: "Aprobada", rehacer: "Rehaciéndose", aplicando: "Aplicando tus textos", publicado: "Publicada", quitada: "Fuera de la cola" };

  function resumenTexto() {
    const n = D.piezas.filter((p) => ["pendiente", "quitada"].includes(estadoDe(p))).length;
    const seg = D.estado.metricas && D.estado.metricas.cuenta ? D.estado.metricas.cuenta.seguidores : null;
    return (n ? `${n} por revisar` : "Nada por revisar") + (seg != null ? ` · ${num(seg)} seguidores` : "");
  }

  async function cargar() {
    D = await api("/api/estado");
    D.estado = D.estado || {};
    return D;
  }

  // ---- montaje ----
  async function montar(el, c) {
    cfg = c; raiz = el;
    if (!D) raiz.innerHTML = `<div class="wrap" style="padding:90px 16px;color:var(--muted-light)">Cargando la máquina…</div>`;
    try { await cargar(); } catch (e) {
      raiz.innerHTML = `<div class="wrap" style="padding:90px 16px"><p class="sub">No he podido hablar con la máquina: ${esc(e.message)}</p><p style="margin-top:16px"><a class="btn" href="#/">← Volver</a></p></div>`;
      return;
    }
    pintar();
  }
  async function precargar(c, cb) {
    cfg = c;
    try { await cargar(); cb(resumenTexto()); } catch (e) {}
  }

  function pintar() {
    const m = D.estado.metricas || {}, cu = m.cuenta || {};
    const pend = D.piezas.filter((p) => ["pendiente", "quitada"].includes(estadoDe(p)));
    const prox = (D.estado.proximas || [])[0];
    raiz.innerHTML = `
      <div class="cx-top"><div class="wrap">
        <a class="brand" href="#/"><b>VEXELAR</b><span class="mono">/ contenido</span></a>
        <div style="display:flex;gap:8px"><a class="btn" href="#/">←</a><button class="btn" id="cxR" title="Recargar">↻</button></div>
      </div></div>
      <div class="cx-hero"><div class="wrap">
        <div class="eyebrow mono">Máquina de contenido · @vexelar_ig</div>
        <div class="cx-big">${pend.length}<small>por revisar</small></div>
        <div class="cx-chips">
          <div class="cx-chip"><div class="k">Seguidores</div><div class="v">${num(cu.seguidores)}</div></div>
          <div class="cx-chip"><div class="k">Publicadas</div><div class="v">${num((D.estado.publicado || []).length)}</div></div>
          <div class="cx-chip"><div class="k">En cola</div><div class="v">${num((D.estado.cola || []).filter((c) => !c.publicado).length)}</div></div>
          <div class="cx-chip"><div class="k">Próxima</div><div class="v" style="font-size:18px;line-height:1.5">${prox ? esc(prox.cuando) : "—"}</div></div>
        </div>
      </div></div>
      <div class="wrap" id="cxV"></div>
      <nav class="cx-nav">${TABS.map(([k, t]) => `<button data-t="${k}" class="${k === tab ? "on" : ""}">${ICON[k]}${t}${k === "revisar" && pend.length ? `<span class="n">${pend.length}</span>` : ""}</button>`).join("")}</nav>`;
    raiz.querySelector("#cxR").onclick = () => montar(raiz, cfg);
    raiz.querySelectorAll(".cx-nav button").forEach((b) => (b.onclick = () => { tab = b.dataset.t; try { localStorage.setItem(TAB_LS, tab); } catch (e) {} pintar(); scrollTo(0, 0); }));
    const v = raiz.querySelector("#cxV");
    ({ revisar, cola, numeros, entrenar, cerebro })[tab](v);
  }

  // ---- Revisar ----
  function revisar(v) {
    const pend = D.piezas.filter((p) => ["pendiente", "quitada"].includes(estadoDe(p)));
    const enCurso = D.piezas.filter((p) => ["rehacer", "aplicando"].includes(estadoDe(p)));
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Por revisar</h2>
      <p class="cx-lead">Puedes cambiar el texto a mano. Si solo tocas el texto del post, se aprueba tal cual; si tocas las láminas, se vuelven a pintar solas y salen aprobadas; si tocas lo que dice la voz o eliges otro gancho, la pieza se rehace y vuelve aquí.</p>
      <div class="cx-grid" id="cxP">${pend.map(tarjeta).join("") || '<div class="cx-empty">Nada por revisar. La máquina avisa por Telegram cuando haya tanda.</div>'}</div>
      ${enCurso.length ? `<h2 class="cx-h" style="font-size:30px">En marcha</h2>${enCurso.map(fila).join("")}` : ""}
    </section>`;
    pend.forEach((p) => conectar(v.querySelector(`[data-slug="${p.slug}"]`), p));
    v.querySelectorAll(".cx-car").forEach((c) => {
      const cnt = c.parentElement.querySelector(".cx-cnt");
      c.addEventListener("scroll", () => { cnt.textContent = Math.round(c.scrollLeft / c.clientWidth) + 1 + " / " + c.children.length; }, { passive: true });
    });
  }

  function medio(p) {
    if (p.formato === "reel") return `<div class="cx-media"><video controls playsinline preload="none" poster="${esc(med(p.portada))}" src="${esc(med(p.video))}"></video></div>`;
    return `<div class="cx-media"><div class="cx-car">${(p.laminas || []).map((u) => `<img loading="lazy" src="${esc(med(u))}" alt="">`).join("")}</div><span class="cx-cnt">1 / ${(p.laminas || []).length}</span></div>`;
  }

  function tarjeta(p) {
    const e = estadoDe(p);
    const ganchos = (p.ganchos || []).filter((g) => g && g.texto);
    const lams = p.laminas_texto || [];
    return `<article class="cx-card" data-slug="${esc(p.slug)}">
      ${medio(p)}
      <div class="cx-body">
        <div class="cx-meta"><span class="cx-pill azul">${p.formato}</span>${p.intencion ? `<span class="cx-pill">${esc(p.intencion)}</span>` : ""}${p.version > 1 ? `<span class="cx-pill">v${p.version}</span>` : ""}${e === "quitada" ? '<span class="cx-pill warn">la sacaste de la cola</span>' : ""}${p.puntuacion != null ? `<span class="cx-pill ok">juez ${esc(p.puntuacion)}/10</span>` : ""}</div>
        <div class="cx-title">${esc(p.titulo)}</div>
        ${p.cambios && p.version > 1 ? `<details class="cx-box"><summary>Qué he cambiado</summary><div class="in cx-txt">${esc(p.cambios.split(/\n(?=#+ |v\d)/).slice(-1)[0])}</div></details>` : ""}
        ${ganchos.length ? `<details class="cx-box"><summary>Ganchos alternativos · ${ganchos.length}</summary><div class="in">
          <label class="cx-gancho"><input type="radio" name="g-${esc(p.slug)}" value="" checked><span>El que lleva ahora</span></label>
          ${ganchos.map((g, i) => `<label class="cx-gancho"><input type="radio" name="g-${esc(p.slug)}" value="${i}"><span>${esc(g.texto)}</span>${g.puntuacion != null ? `<span class="s">${esc(g.puntuacion)}/10</span>` : ""}</label>`).join("")}
        </div></details>` : ""}
        <details class="cx-box"><summary>Editar el texto</summary><div class="in">
          <label class="cx-lbl">Texto del post</label>
          <textarea class="cx-ta" data-f="post" rows="7">${esc(p.post)}</textarea>
          ${p.formato === "reel" && p.guion ? `<label class="cx-lbl">Lo que dice la voz · una frase por línea</label><textarea class="cx-ta" data-f="locucion" rows="10">${esc(p.guion)}</textarea>` : ""}
          ${lams.length ? `<label class="cx-lbl">Texto de las láminas · *entre asteriscos* va en azul</label>${lams.map((l) => `<div class="cx-lam" data-i="${l.i}"><b>LÁMINA ${l.i + 1}${l.tipo ? " · " + esc(l.tipo).toUpperCase() : ""}</b>
            ${l.titulo != null ? `<input class="cx-in" data-l="titulo" value="${esc(l.titulo)}" style="margin-top:6px">` : ""}
            ${l.texto != null ? `<textarea class="cx-ta" data-l="texto" rows="2" style="margin-top:6px">${esc(l.texto)}</textarea>` : ""}
            ${l.sigue != null ? `<input class="cx-in" data-l="sigue" value="${esc(l.sigue)}" style="margin-top:6px" placeholder="frase puente">` : ""}</div>`).join("")}` : ""}
        </div></details>
        ${p.fuentes ? `<details class="cx-box"><summary>Fuentes</summary><div class="in cx-txt">${esc(p.fuentes)}</div></details>` : ""}
        <details class="cx-box cx-com"><summary>Pedir cambios de imagen o voz</summary><div class="in">
          <textarea class="cx-ta" data-f="comentario" rows="3" placeholder="Qué cambiarías…"></textarea>
          <div class="cx-acts"><button class="cx-btn" data-a="rehacer">Rehacer con esto</button><button class="cx-btn" data-a="nota">Solo es una nota</button></div>
        </div></details>
        <div class="cx-acts"><button class="cx-btn pri" data-a="aprobar">Aprobar</button></div>
        <div class="cx-msg"></div>
      </div>
    </article>`;
  }

  function cambios(card, p) {
    const out = {};
    const post = card.querySelector('[data-f="post"]');
    if (post && post.value !== (p.post || "")) out.post = post.value;
    const loc = card.querySelector('[data-f="locucion"]');
    if (loc && loc.value.trim() !== (p.guion || "").trim()) out.locucion = loc.value;
    const lams = [];
    card.querySelectorAll(".cx-lam").forEach((el) => {
      const i = +el.dataset.i, orig = (p.laminas_texto || []).find((x) => x.i === i) || {};
      const c = { i };
      let hay = false;
      el.querySelectorAll("[data-l]").forEach((f) => { if (f.value !== (orig[f.dataset.l] ?? "")) { c[f.dataset.l] = f.value; hay = true; } });
      if (hay) lams.push(c);
    });
    if (lams.length) out.laminas = lams;
    const g = card.querySelector(`input[name="g-${p.slug}"]:checked`);
    if (g && g.value !== "") out.gancho = p.ganchos[+g.value].texto;
    return out;
  }

  function conectar(card, p) {
    if (!card) return;
    const pri = card.querySelector('[data-a="aprobar"]'), msg = card.querySelector(".cx-msg");
    const refrescar = () => {
      const c = cambios(card, p);
      card.querySelectorAll("[data-f],[data-l]").forEach((f) => {
        const orig = f.dataset.f === "post" ? p.post : f.dataset.f === "locucion" ? p.guion : f.dataset.l ? ((p.laminas_texto || []).find((x) => x.i === +f.closest(".cx-lam").dataset.i) || {})[f.dataset.l] : null;
        if (orig != null) f.classList.toggle("cambiado", f.value.trim() !== String(orig).trim());
      });
      const voz = c.locucion !== undefined || c.gancho !== undefined;
      pri.classList.toggle("warn", voz);
      pri.textContent = voz ? (p.formato === "reel" ? "Rehacer con este texto (voz nueva)" : "Rehacer con este gancho") : c.laminas ? "Aprobar con estos textos" : c.post !== undefined ? "Aprobar con mi texto" : "Aprobar";
    };
    card.addEventListener("input", refrescar);
    card.addEventListener("change", refrescar);
    const enviar = async (accion, extra) => {
      card.querySelectorAll("button").forEach((b) => (b.disabled = true));
      msg.className = "cx-msg"; msg.textContent = "Enviando…";
      try {
        await api("/api/feedback", Object.assign({ slug: p.slug, accion }, extra));
        msg.className = "cx-msg ok";
        msg.textContent = accion === "aprobar" ? (extra.laminas ? "Aprobada. Las láminas se repintan con tus textos y entra en la cola." : "Aprobada. Entra en la cola de publicación.") : accion === "nota" ? "Nota guardada: la máquina aprende de ella." : "Hecho. La máquina la rehace y vuelve aquí.";
        (D.feedback[p.slug] = D.feedback[p.slug] || []).push(Object.assign({ accion, ts: new Date().toISOString() }, extra));
        setTimeout(() => pintar(), 1400);
      } catch (e) {
        msg.className = "cx-msg err"; msg.textContent = "No se ha guardado: " + e.message;
        card.querySelectorAll("button").forEach((b) => (b.disabled = false));
      }
    };
    pri.onclick = () => {
      const c = cambios(card, p);
      const com = card.querySelector('[data-f="comentario"]').value.trim();
      if (c.locucion !== undefined || c.gancho !== undefined) return enviar("rehacer", Object.assign({ texto: com || "Rehacer con el texto que he escrito." }, c));
      enviar("aprobar", Object.assign({ texto: com }, c));
    };
    card.querySelectorAll('.cx-com [data-a]').forEach((b) => (b.onclick = () => {
      const com = card.querySelector('[data-f="comentario"]').value.trim();
      const c = cambios(card, p);
      if (!com && !Object.keys(c).length) { msg.className = "cx-msg err"; msg.textContent = "Escribe qué cambiarías."; return; }
      enviar(b.dataset.a, Object.assign({ texto: com }, b.dataset.a === "rehacer" ? c : {}));
    }));
    refrescar();
  }

  function fila(p, extra) {
    const e = estadoDe(p);
    const img = p.formato === "reel" ? p.portada : (p.laminas || [])[0];
    return `<div class="cx-row"><img decoding="async" src="${esc(med(img))}" alt=""><div style="min-width:0"><div class="t">${esc(p.titulo)}</div><div class="p">${p.formato} · ${NOMBRE[e]}${extra ? " · " + extra : ""}</div></div></div>`;
  }

  // ---- Cola ----
  function cola(v) {
    const porSlug = Object.fromEntries(D.piezas.map((p) => [p.slug, p]));
    const prox = D.estado.proximas || [];
    const enCola = (D.estado.cola || []).filter((c) => !c.publicado);
    const pub = (D.estado.publicado || []).slice().reverse().slice(0, 12);
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">La cola</h2>
      <p class="cx-lead">${esc(D.estado.ritmo || "")}</p>
      ${enCola.map((c) => {
        const p = porSlug[c.slug] || { slug: c.slug, titulo: c.slug, formato: c.formato };
        const cuando = (prox.find((x) => x.slug === c.slug) || {}).cuando;
        return `<div class="cx-row" data-slug="${esc(c.slug)}"><img decoding="async" src="${esc(med(p.formato === "reel" ? p.portada : (p.laminas || [])[0]))}" alt=""><div style="min-width:0"><div class="t">${esc(p.titulo)}</div><div class="p">${p.formato}${cuando ? " · sale " + esc(cuando) : ""}${c.espera ? " · espera: " + esc(c.espera) : ""}</div></div><div class="r"><button class="cx-btn peq" data-q="${esc(c.slug)}">Sacar</button></div></div>`;
      }).join("") || '<div class="cx-empty">No hay nada aprobado esperando. Aprueba piezas en Revisar.</div>'}
      <h2 class="cx-h" style="font-size:30px;margin-top:28px">Publicadas</h2>
      ${pub.map((x) => { const p = porSlug[x.slug] || { titulo: x.slug, formato: x.formato }; const mm = ((D.estado.metricas || {}).piezas || {})[x.slug] || {};
        return `<div class="cx-row"><img decoding="async" src="${esc(med(p.formato === "reel" ? p.portada : (p.laminas || [])[0]))}" alt=""><div style="min-width:0"><div class="t"><a href="${esc(x.permalink || "#")}" target="_blank" rel="noopener">${esc(p.titulo)}</a></div><div class="p">${fecha(x.fecha)} · ${esc(x.hora || "")}</div></div><div class="r"><b>${num(mm.views)}</b><span>vistas</span></div></div>`; }).join("") || '<div class="cx-empty">Aún no hay publicadas.</div>'}
    </section>`;
    v.querySelectorAll("[data-q]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿La saco de la cola? Volverá a Revisar.")) return;
      b.disabled = true;
      try { await api("/api/feedback", { slug: b.dataset.q, accion: "quitar", texto: "" }); (D.feedback[b.dataset.q] = D.feedback[b.dataset.q] || []).push({ accion: "quitar", ts: new Date().toISOString() }); b.textContent = "Fuera"; }
      catch (e) { b.disabled = false; alert(e.message); }
    }));
  }

  // ---- Números ----
  function numeros(v) {
    const m = D.estado.metricas || {}, ps = m.piezas || {}, porSlug = Object.fromEntries(D.piezas.map((p) => [p.slug, p]));
    const filas = (D.estado.publicado || []).map((x) => Object.assign({ slug: x.slug, fecha: x.fecha, permalink: x.permalink, formato: x.formato }, ps[x.slug] || {}));
    filas.sort((a, b) => (b.views || 0) - (a.views || 0));
    const max = Math.max(1, ...filas.map((f) => f.views || 0));
    const sem = m.semana || {};
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Números</h2>
      <p class="cx-lead">Lo que la máquina usa para aprender: el % del vídeo que se ve y cuántos lo envían por cada persona a la que llega. Se lee a las 24 h, 72 h y 7 días.${m.generado ? " Última lectura: " + fecha(m.generado) + " " + hora(m.generado) + "." : ""}</p>
      <div class="cx-chips" style="margin:0 0 18px">
        <div class="cx-chip"><div class="k">Vistas 7 días</div><div class="v">${num(sem.views)}</div></div>
        <div class="cx-chip"><div class="k">% visto medio</div><div class="v">${pct(sem.pct_visto)}</div></div>
        <div class="cx-chip"><div class="k">Envíos 7 días</div><div class="v">${num(sem.shares)}</div></div>
        <div class="cx-chip"><div class="k">Seguidores +7 d</div><div class="v">${num(sem.follows)}</div></div>
      </div>
      ${filas.map((f) => { const p = porSlug[f.slug] || { titulo: f.slug };
        return `<div class="cx-row" style="display:block"><div style="display:flex;gap:12px;align-items:center"><img decoding="async" src="${esc(med(f.formato === "reel" ? p.portada : (p.laminas || [])[0]))}" alt=""><div style="min-width:0"><div class="t"><a href="${esc(f.permalink || "#")}" target="_blank" rel="noopener">${esc(p.titulo)}</a></div><div class="p">${f.formato} · ${fecha(f.fecha)}</div><div class="cx-bar"><i style="width:${Math.max(2, (f.views || 0) / max * 100)}%"></i></div></div><div class="r"><b>${num(f.views)}</b><span>vistas</span></div></div>
          <div class="cx-stats"><div><b>${f.formato === "reel" ? pct(f.pct_visto) : num(f.reach)}</b><span>${f.formato === "reel" ? "visto" : "alcance"}</span></div><div><b>${f.formato === "reel" ? seg(f.avg_watch_s) : num(f.likes)}</b><span>${f.formato === "reel" ? "medio" : "likes"}</span></div><div><b>${num(f.shares)}</b><span>envíos</span></div><div><b>${num(f.saved)}</b><span>guardados</span></div></div></div>`; }).join("") || '<div class="cx-empty">Sin publicaciones todavía.</div>'}
    </section>`;
  }

  // ---- Entrenar: referentes e ideas ----
  function entrenar(v) {
    const R = D.estado.referentes || {}, est = Object.fromEntries((R.entradas || []).map((e) => [e.id, e]));
    const refs = (D.referentes || []).slice().reverse();
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Entrenar</h2>
      <p class="cx-lead">Pega un reel o una cuenta que haga vídeos como los que queremos. La máquina se baja ese vídeo y los de toda la cuenta, los transcribe, mide el gancho, el ritmo y los re-ganchos, y compara los que explotaron con los que no.</p>
      <form class="cx-form" id="cxRef">
        <input class="cx-in" name="url" placeholder="instagram.com/reel/… o @cuenta" autocomplete="off" inputmode="url">
        <input class="cx-in" name="nota" placeholder="Qué te gusta de él (opcional)">
        <button class="cx-btn pri">Añadir referente</button><div class="cx-msg"></div>
      </form>
      ${refs.map((r) => { const e = est[r.id] || {}; const st = e.estado || "pendiente";
        return `<div class="cx-row"><div style="min-width:0;flex:1"><div class="t" style="word-break:break-all"><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url.replace("https://www.instagram.com/", ""))}</a></div><div class="p">${r.tipo} · ${st === "analizado" ? "analizado" : st === "error" ? "no se pudo: " + esc(e.error || "") : "en cola de análisis"}${e.x_mediana != null ? " · " + (Math.round(e.x_mediana * 10) / 10).toLocaleString("es-ES") + "× su mediana" : ""}${r.nota ? " · «" + esc(r.nota) + "»" : ""}</div>${e.primeras_palabras ? `<div class="p" style="color:#dbe4f5">«${esc(e.primeras_palabras)}»</div>` : ""}</div><button class="cx-x" data-b="${esc(r.id)}" title="Quitar">×</button></div>`; }).join("")}
      <h2 class="cx-h" style="font-size:30px;margin-top:28px">Cuentas que estudia</h2>
      ${(R.cuentas || []).map((c) => `<div class="cx-row"><div style="min-width:0;flex:1"><div class="t">@${esc(c.usuario)}</div><div class="p">${num(c.seguidores)} seguidores · ${num(c.reels)} reels · ${num(c.analizados)} analizados · mediana ${num(c.mediana_vistas)} vistas</div>${c.mejor ? `<div class="p" style="color:#dbe4f5">Su mejor: «${esc(c.mejor.primeras_palabras || "")}» · ${num(c.mejor.vistas)}</div>` : ""}</div></div>`).join("") || '<div class="cx-empty">Todavía ninguna.</div>'}
      <h2 class="cx-h" style="font-size:30px;margin-top:28px">Ideas para la máquina</h2>
      <form class="cx-form" id="cxIdea"><textarea class="cx-ta" name="idea" rows="2" placeholder="Un tema, una curiosidad, algo que viste…"></textarea><button class="cx-btn pri">Dar la idea</button><div class="cx-msg"></div></form>
      ${(D.ideas || []).slice().reverse().map((i) => `<div class="cx-row"><div style="flex:1"><div class="t" style="font-weight:500">${esc(i.texto)}</div><div class="p">${fecha(i.ts)}${(D.estado.ideas_usadas || []).includes(i.id) ? " · ya está en el banco" : ""}</div></div><button class="cx-x" data-b="${esc(i.id)}">×</button></div>`).join("")}
    </section>`;
    const fr = v.querySelector("#cxRef");
    fr.onsubmit = async (ev) => {
      ev.preventDefault();
      const m = fr.querySelector(".cx-msg"), url = fr.url.value.trim();
      if (!url) return;
      m.className = "cx-msg"; m.textContent = "Guardando…";
      try { const r = await api("/api/referentes", { url, nota: fr.nota.value.trim() }); m.className = "cx-msg ok"; m.textContent = r.repetido ? "Ya lo tenía." : "Añadido. Se analiza en la próxima hora."; await cargar(); setTimeout(pintar, 900); }
      catch (e) { m.className = "cx-msg err"; m.textContent = e.message; }
    };
    const fi = v.querySelector("#cxIdea");
    fi.onsubmit = async (ev) => {
      ev.preventDefault();
      const m = fi.querySelector(".cx-msg"), idea = fi.idea.value.trim();
      if (!idea) return;
      try { await api("/api/referentes", { idea }); m.className = "cx-msg ok"; m.textContent = "Apuntada. Entra en el banco del domingo (o antes)."; await cargar(); setTimeout(pintar, 900); }
      catch (e) { m.className = "cx-msg err"; m.textContent = e.message; }
    };
    v.querySelectorAll("[data-b]").forEach((b) => (b.onclick = async () => {
      if (!confirm("¿Lo quito?")) return;
      try { await api("/api/referentes", { borrar: b.dataset.b }); await cargar(); pintar(); } catch (e) { alert(e.message); }
    }));
  }

  // ---- Cerebro ----
  function cerebro(v) {
    const R = D.estado.referentes || {};
    v.innerHTML = `<section class="cx-sec">
      <h2 class="cx-h">Cerebro</h2>
      <p class="cx-lead">Lo que ha aprendido. Los patrones salen de comparar los vídeos que explotaron (3 veces o más la mediana de su cuenta) con los flojos. Una regla dura solo la pones tú.</p>
      <h2 class="cx-h" style="font-size:28px">Patrones medidos</h2>
      ${(R.patrones || []).map((p) => `<div class="cx-pat"><div class="t">${esc(p.rasgo)}</div><div class="v"><span>Explotan: <b>${cifra(p.explosivos)}</b> (n=${esc(p.n_explosivos)})</span><span>Flojos: <b>${cifra(p.flojos)}</b> (n=${esc(p.n_flojos)})</span></div>${p.lectura ? `<p>${esc(p.lectura)}</p>` : ""}</div>`).join("") || '<div class="cx-empty">Aún sin muestra suficiente. Añade referentes en Entrenar.</div>'}
      ${(R.top || []).length ? `<h2 class="cx-h" style="font-size:28px;margin-top:24px">Los que más explotaron</h2>${R.top.map((t) => `<div class="cx-row"><div style="flex:1;min-width:0"><div class="t"><a href="${esc(t.permalink || "#")}" target="_blank" rel="noopener">«${esc(t.primeras_palabras)}»</a></div><div class="p">@${esc(t.cuenta)} · ${esc(t.gancho_tipo || "")} · ${seg(t.duracion_s)}</div></div><div class="r"><b>${(Math.round((t.x_mediana || 0) * 10) / 10).toLocaleString("es-ES")}×</b><span>${num(t.vistas)}</span></div></div>`).join("")}` : ""}
      <h2 class="cx-h" style="font-size:28px;margin-top:24px">Lo último que ha aprendido de ti</h2>
      ${(D.estado.aprendizajes || []).map((a) => `<div class="cx-ap"><b>${esc(a.fecha)}</b>${esc(a.texto)}</div>`).join("") || '<div class="cx-empty">—</div>'}
    </section>`;
  }

  window.Contenido = { montar, precargar };
})();
