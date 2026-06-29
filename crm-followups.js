const G3D_CRM_KEY = "g3d.crm.v1";
const G3D_CRM_TYPES = {
  whatsapp: { label: "WhatsApp", className: "good" },
  ligacao: { label: "Ligação", className: "blue" },
  email: { label: "Email", className: "blue" },
  reuniao: { label: "Reunião", className: "warn" },
  visita: { label: "Visita", className: "warn" },
  outro: { label: "Outro", className: "blue" }
};
const G3D_CRM_RESULTS = {
  aguardando: { label: "Aguardando retorno", className: "warn" },
  interessado: { label: "Interessado", className: "good" },
  fechado: { label: "Fechado", className: "good" },
  sem_interesse: { label: "Sem interesse", className: "danger" },
  reagendar: { label: "Reagendar", className: "blue" }
};

function crmStorageKey() {
  return `${G3D_CRM_KEY}.${state.session?.user?.id || "anon"}`;
}

function crmLoadAll() {
  try {
    const rows = JSON.parse(localStorage.getItem(crmStorageKey()) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
}

function crmSaveAll(rows) {
  localStorage.setItem(crmStorageKey(), JSON.stringify(rows));
}

function crmId() {
  return `crm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function crmClient(clientId) {
  return (state.cache.clientes || []).find(client => client.id === clientId) || null;
}

function crmClientName(clientId) {
  const client = crmClient(clientId);
  return client ? (typeof g3dClientName === "function" ? g3dClientName(client) : client.nome || client.empresa || "Cliente") : "Cliente não vinculado";
}

function crmTypeInfo(value = "whatsapp") {
  return G3D_CRM_TYPES[value] || G3D_CRM_TYPES.outro;
}

function crmResultInfo(value = "aguardando") {
  return G3D_CRM_RESULTS[value] || G3D_CRM_RESULTS.aguardando;
}

function crmDateInput(value) {
  const date = typeof agendaDate === "function" ? agendaDate(value) : value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "";
}

function crmContactDate(row) {
  return new Date(row.created_at || row.data_contato || Date.now()).toLocaleDateString("pt-BR");
}

function crmFollowDate(row) {
  return typeof agendaDate === "function" ? agendaDate(row.proximo_retorno) : row.proximo_retorno ? new Date(row.proximo_retorno) : null;
}

function crmDueInfo(row) {
  const date = crmFollowDate(row);
  if (!date || typeof agendaDaysUntil !== "function" || typeof agendaStatus !== "function") return { date, days: null, status: { label: "Sem retorno", className: "blue" } };
  const days = agendaDaysUntil(date);
  return { date, days, status: agendaStatus(days) };
}

function crmOpenRows() {
  return crmLoadAll().filter(row => !row.concluido && row.proximo_retorno);
}

function crmStats(rows) {
  const open = rows.filter(row => !row.concluido).length;
  const withReturn = rows.filter(row => !row.concluido && row.proximo_retorno).length;
  const late = rows.filter(row => !row.concluido && crmDueInfo(row).days < 0).length;
  const done = rows.filter(row => row.concluido).length;
  return { total: rows.length, open, withReturn, late, done };
}

function crmClientOptions(current = "") {
  const clients = state.cache.clientes || [];
  return `<option value="">Cliente não vinculado</option>${clients.map(client => `<option value="${escapeHtml(client.id)}" ${client.id === current ? "selected" : ""}>${escapeHtml(client.nome || client.empresa || "Cliente")}</option>`).join("")}`;
}

function crmSummaryHtml(rows) {
  const stats = crmStats(rows);
  return `
    <section class="grid crm-summary">
      <div class="stat"><span>Registros</span><strong>${stats.total}</strong></div>
      <div class="stat"><span>Em aberto</span><strong>${stats.open}</strong></div>
      <div class="stat"><span>Com retorno</span><strong>${stats.withReturn}</strong></div>
      <div class="stat"><span>Atrasados</span><strong>${stats.late}</strong></div>
    </section>`;
}

function crmRowHtml(row) {
  const type = crmTypeInfo(row.tipo);
  const result = crmResultInfo(row.resultado);
  const due = crmDueInfo(row);
  return `
    <article class="crm-row ${row.concluido ? "done" : due.status.className}">
      <div class="crm-row-head">
        <span class="badge ${type.className}">${escapeHtml(type.label)}</span>
        <span class="badge ${result.className}">${escapeHtml(result.label)}</span>
        ${row.concluido ? `<span class="badge good">Concluído</span>` : ""}
      </div>
      <div class="crm-row-main">
        <strong>${escapeHtml(crmClientName(row.cliente_id))}</strong>
        <span>${escapeHtml(row.assunto || "Atendimento")}</span>
        <small>${escapeHtml(row.observacao || "Sem observação.")}</small>
      </div>
      <div class="crm-row-foot">
        <span>Contato: ${escapeHtml(crmContactDate(row))}</span>
        <span>Retorno: ${escapeHtml(due.date ? agendaDateLabel(due.date) : "Sem data")}</span>
        <div class="actions crm-actions">
          ${!row.concluido ? `<button class="btn primary" data-crm-done="${row.id}">Concluir</button>` : `<button class="btn" data-crm-reopen="${row.id}">Reabrir</button>`}
          <button class="btn" data-crm-edit="${row.id}">Editar</button>
          <button class="btn danger" data-crm-delete="${row.id}">Excluir</button>
        </div>
      </div>
    </article>`;
}

function renderCRM(el) {
  const rows = crmLoadAll().sort((a, b) => {
    const aDue = crmDueInfo(a).date?.getTime() || Number.MAX_SAFE_INTEGER;
    const bDue = crmDueInfo(b).date?.getTime() || Number.MAX_SAFE_INTEGER;
    return Number(a.concluido) - Number(b.concluido) || aDue - bDue || String(b.created_at || "").localeCompare(String(a.created_at || ""));
  });
  el.innerHTML = `
    <div class="page-head crm-head">
      <div><h1>Atendimentos</h1><p class="muted">Histórico comercial, retornos combinados e próximos contatos com clientes.</p></div>
      <button class="btn primary" id="newCrmRecord">Registrar contato</button>
    </div>
    ${crmSummaryHtml(rows)}
    <section class="card crm-panel">
      <div class="section-head"><div><h2>Histórico e retornos</h2><p class="muted">Use para não perder follow-up comercial.</p></div></div>
      <div class="crm-list">${rows.length ? rows.map(crmRowHtml).join("") : `<div class="dashboard-empty">Nenhum atendimento registrado ainda.</div>`}</div>
    </section>`;

  document.getElementById("newCrmRecord")?.addEventListener("click", () => openCRMForm());
  document.querySelectorAll("[data-crm-edit]").forEach(button => button.addEventListener("click", () => openCRMForm(rows.find(row => row.id === button.dataset.crmEdit))));
  document.querySelectorAll("[data-crm-delete]").forEach(button => button.addEventListener("click", () => deleteCRM(button.dataset.crmDelete)));
  document.querySelectorAll("[data-crm-done]").forEach(button => button.addEventListener("click", () => updateCRMStatus(button.dataset.crmDone, true)));
  document.querySelectorAll("[data-crm-reopen]").forEach(button => button.addEventListener("click", () => updateCRMStatus(button.dataset.crmReopen, false)));
}

function openCRMForm(row = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal crm-modal" id="crmForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Registrar"} atendimento</strong><button class="btn" type="button" id="closeCrm">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field span-2"><label>Cliente</label><select name="cliente_id">${crmClientOptions(row.cliente_id || "")}</select></div>
          <div class="field"><label>Tipo de contato</label><select name="tipo">${Object.entries(G3D_CRM_TYPES).map(([value, info]) => `<option value="${value}" ${value === (row.tipo || "whatsapp") ? "selected" : ""}>${escapeHtml(info.label)}</option>`).join("")}</select></div>
          <div class="field"><label>Resultado</label><select name="resultado">${Object.entries(G3D_CRM_RESULTS).map(([value, info]) => `<option value="${value}" ${value === (row.resultado || "aguardando") ? "selected" : ""}>${escapeHtml(info.label)}</option>`).join("")}</select></div>
          <div class="field span-2"><label>Assunto</label><input name="assunto" value="${escapeHtml(row.assunto || "")}" placeholder="Ex.: Retorno sobre orçamento, alinhamento de prazo, pós-venda" required /></div>
          <div class="field"><label>Próximo retorno</label><input type="date" name="proximo_retorno" value="${escapeHtml(crmDateInput(row.proximo_retorno))}" /></div>
          <div class="field"><label>Status</label><select name="concluido"><option value="false" ${!row.concluido ? "selected" : ""}>Em aberto</option><option value="true" ${row.concluido ? "selected" : ""}>Concluído</option></select></div>
          <div class="field span-2"><label>Observação</label><textarea name="observacao">${escapeHtml(row.observacao || "")}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelCrm">Cancelar</button><button class="btn primary" type="submit">Salvar atendimento</button></div>
    </form>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closeCrm").addEventListener("click", close);
  document.getElementById("cancelCrm").addEventListener("click", close);
  document.getElementById("crmForm").addEventListener("submit", event => {
    event.preventDefault();
    saveCRM(Object.fromEntries(new FormData(event.currentTarget).entries()), row.id);
    close();
  });
}

function saveCRM(payload, id = "") {
  const rows = crmLoadAll();
  const now = new Date().toISOString();
  const previous = rows.find(row => row.id === id) || {};
  const clean = {
    id: id || crmId(),
    cliente_id: payload.cliente_id || "",
    tipo: payload.tipo || "whatsapp",
    resultado: payload.resultado || "aguardando",
    assunto: payload.assunto || "Atendimento",
    proximo_retorno: payload.proximo_retorno || "",
    observacao: payload.observacao || "",
    concluido: payload.concluido === "true",
    created_at: previous.created_at || now,
    updated_at: now,
    done_at: payload.concluido === "true" ? (previous.done_at || now) : ""
  };
  const next = id ? rows.map(row => row.id === id ? clean : row) : [clean, ...rows];
  crmSaveAll(next);
  showToast("Atendimento salvo.");
  renderPage();
}

function updateCRMStatus(id, done) {
  const rows = crmLoadAll();
  const now = new Date().toISOString();
  crmSaveAll(rows.map(row => row.id === id ? { ...row, concluido: done, updated_at: now, done_at: done ? now : "" } : row));
  showToast(done ? "Atendimento concluído." : "Atendimento reaberto.");
  renderPage();
}

function deleteCRM(id) {
  crmSaveAll(crmLoadAll().filter(row => row.id !== id));
  showToast("Atendimento removido.");
  renderPage();
}

function ensureCRMNav() {
  if (!navPages.some(([id]) => id === "atendimentos")) {
    const clientsIndex = navPages.findIndex(([id]) => id === "clientes");
    navPages.splice(clientsIndex >= 0 ? clientsIndex + 1 : 1, 0, ["atendimentos", "Atendimentos"]);
  }
}

function crmClientPanelHtml(client = {}) {
  const rows = crmLoadAll().filter(row => row.cliente_id === client.id).slice(0, 5);
  return `
    <section class="client-profile-section crm-client-panel" id="crmClientPanel">
      <div class="section-head"><div><h3>Atendimentos</h3><p class="muted">Últimos contatos e retornos combinados.</p></div><button class="btn" type="button" id="newCrmFromClient">Registrar contato</button></div>
      <div class="crm-list compact">${rows.length ? rows.map(crmRowHtml).join("") : `<div class="dashboard-empty">Nenhum contato registrado para este cliente.</div>`}</div>
    </section>`;
}

function crmDashboardPanelHtml() {
  const rows = crmOpenRows().sort((a, b) => (crmDueInfo(a).date?.getTime() || Number.MAX_SAFE_INTEGER) - (crmDueInfo(b).date?.getTime() || Number.MAX_SAFE_INTEGER)).slice(0, 4);
  const stats = crmStats(crmLoadAll());
  return `
    <section class="card crm-dashboard-panel" id="crmDashboardPanel">
      <div class="section-head">
        <div><h2>Retornos de clientes</h2><p class="muted">${stats.withReturn ? `${stats.withReturn} retorno(s) no radar.` : "Nenhum retorno pendente."}</p></div>
        <button class="btn" data-crm-page="atendimentos">Abrir</button>
      </div>
      <div class="crm-mini-stats"><span class="badge ${stats.late ? "danger" : "good"}">${stats.late} atrasado(s)</span><span class="badge blue">${stats.open} abertos</span></div>
      <div class="crm-list compact">${rows.length ? rows.map(crmRowHtml).join("") : `<div class="dashboard-empty">Nenhum retorno pendente.</div>`}</div>
    </section>`;
}

function attachCRMNavigation(root = document) {
  root.querySelectorAll("[data-crm-page]").forEach(button => button.addEventListener("click", () => {
    state.page = button.dataset.crmPage;
    renderApp();
    renderPage();
  }));
}

ensureCRMNav();
if (Array.isArray(G3D_AGENDA_FILTERS) && !G3D_AGENDA_FILTERS.some(([id]) => id === "atendimento")) G3D_AGENDA_FILTERS.push(["atendimento", "Atendimentos"]);

const crmPreviousAgendaTypeLabel = agendaTypeLabel;
agendaTypeLabel = function agendaTypeLabelWithCRM(type) {
  if (type === "atendimento") return "Atendimento";
  return crmPreviousAgendaTypeLabel(type);
};

const crmPreviousAgendaTypeBadge = agendaTypeBadge;
agendaTypeBadge = function agendaTypeBadgeWithCRM(type) {
  if (type === "atendimento") return "good";
  return crmPreviousAgendaTypeBadge(type);
};

const crmPreviousBuildAgendaItems = buildAgendaItems;
buildAgendaItems = function buildAgendaItemsWithCRM() {
  const items = crmPreviousBuildAgendaItems();
  crmOpenRows().forEach(row => {
    const date = crmFollowDate(row);
    if (!date) return;
    items.push(agendaItem({
      id: `atendimento-${row.id}`,
      type: "atendimento",
      date,
      title: row.assunto || "Retorno de atendimento",
      detail: `${crmClientName(row.cliente_id)} · ${crmResultInfo(row.resultado).label}`,
      page: "atendimentos",
      source: row,
      priority: crmDueInfo(row).days < 0 ? 0 : 1,
      action: "Ver atendimento"
    }));
  });
  return items.sort((a, b) => a.date - b.date || a.priority - b.priority || String(a.title).localeCompare(String(b.title)));
};

const crmPreviousRenderApp = renderApp;
renderApp = function renderAppWithCRM() {
  ensureCRMNav();
  crmPreviousRenderApp();
};

const crmPreviousRenderPage = renderPage;
renderPage = function renderPageWithCRM() {
  if (state.page === "atendimentos") {
    const el = document.getElementById("content");
    if (!el) return;
    return renderCRM(el);
  }
  return crmPreviousRenderPage();
};

if (typeof openClientProfile === "function") {
  const crmPreviousOpenClientProfile = openClientProfile;
  openClientProfile = function openClientProfileWithCRM(client = {}) {
    crmPreviousOpenClientProfile(client);
    const body = document.querySelector(".client-profile-modal .modal-body");
    if (!body || body.querySelector("#crmClientPanel")) return;
    body.insertAdjacentHTML("beforeend", crmClientPanelHtml(client));
    document.getElementById("newCrmFromClient")?.addEventListener("click", () => openCRMForm({ cliente_id: client.id, assunto: "Retorno comercial" }));
  };
}

if (typeof renderDashboardPro === "function") {
  const crmPreviousRenderDashboardPro = renderDashboardPro;
  renderDashboardPro = function renderDashboardProWithCRM(el) {
    crmPreviousRenderDashboardPro(el);
    if (!el.querySelector("#crmDashboardPanel")) {
      const anchor = el.querySelector("#taskDashboardPanel") || el.querySelector("#agendaDashboardPanel") || el.querySelector(".dashboard-grid") || el.firstElementChild;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = crmDashboardPanelHtml();
      if (anchor) anchor.insertAdjacentElement("afterend", wrapper.firstElementChild);
      else el.prepend(wrapper.firstElementChild);
      attachCRMNavigation(el);
    }
  };
}
