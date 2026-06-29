const G3D_AGENDA_FILTERS = [
  ["todos", "Todos"],
  ["producao", "Produção"],
  ["pedido", "Pedidos"],
  ["financeiro", "Financeiro"],
  ["comercial", "Comercial"]
];

function agendaNormalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function agendaDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function agendaToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function agendaAddDays(date, days) {
  const copy = new Date(date.getTime());
  copy.setDate(copy.getDate() + days);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function agendaDaysUntil(date) {
  if (!date) return null;
  return Math.round((date.getTime() - agendaToday().getTime()) / 86400000);
}

function agendaDateKey(date) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function agendaDateLabel(date) {
  return date ? date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }) : "Sem data";
}

function agendaLongDateLabel(date) {
  return date ? date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "Sem data";
}

function agendaStatus(days) {
  if (days === null) return { label: "Sem data", className: "blue" };
  if (days < 0) return { label: `${Math.abs(days)} dia(s) atrasado`, className: "danger" };
  if (days === 0) return { label: "Hoje", className: "warn" };
  if (days === 1) return { label: "Amanhã", className: "warn" };
  if (days <= 3) return { label: `Em ${days} dias`, className: "warn" };
  return { label: `Em ${days} dias`, className: "blue" };
}

function agendaProductionKey(row) {
  return typeof productionStageKey === "function" ? productionStageKey(row.status || row.etapa_atual || "fila") : agendaNormalize(row.status || row.etapa_atual || "fila");
}

function agendaProductionLabel(row) {
  return typeof productionStageLabel === "function" ? productionStageLabel(row.status || row.etapa_atual || "fila") : (row.status || row.etapa_atual || "Fila");
}

function agendaOrderStatus(row) {
  return agendaNormalize(row.status || "novo");
}

function agendaBudgetStatus(row) {
  return agendaNormalize(row.status || "rascunho");
}

function agendaClientName(clientId) {
  if (!clientId) return "Cliente não vinculado";
  const client = (state.cache.clientes || []).find(item => item.id === clientId);
  return client ? (client.nome || client.empresa || "Cliente") : "Cliente não vinculado";
}

function agendaItem({ id, type, date, title, detail, page, source = {}, priority = 2, action = "Abrir" }) {
  const days = agendaDaysUntil(date);
  const status = agendaStatus(days);
  return { id, type, date, days, title, detail, page, source, priority, action, status };
}

function buildAgendaItems() {
  const items = [];
  const pedidos = state.cache.pedidos || [];
  const producoes = state.cache.producoes || [];
  const orcamentos = state.cache.orcamentos || [];

  pedidos.forEach(order => {
    const orderStatus = agendaOrderStatus(order);
    if (order.data_entrega && !["entregue", "finalizado", "cancelado"].includes(orderStatus)) {
      items.push(agendaItem({
        id: `pedido-entrega-${order.id}`,
        type: "pedido",
        date: agendaDate(order.data_entrega),
        title: order.numero || order.titulo || "Entrega de pedido",
        detail: `${order.titulo || "Pedido"} · ${money(order.valor || order.total || 0)}`,
        page: "pedidos",
        source: order,
        priority: 1,
        action: "Ver pedido"
      }));
    }

    const remaining = typeof financeRemaining === "function" ? financeRemaining(order) : Math.max(0, Number(order.valor || order.total || 0) - Number(order.valor_pago || 0));
    const paymentKey = typeof financeStatusKey === "function" ? financeStatusKey(order) : agendaNormalize(order.status_pagamento || "pendente");
    if (order.vencimento_pagamento && remaining > 0 && !["pago", "cancelado"].includes(paymentKey)) {
      items.push(agendaItem({
        id: `financeiro-${order.id}`,
        type: "financeiro",
        date: agendaDate(order.vencimento_pagamento),
        title: order.numero || order.titulo || "Pagamento pendente",
        detail: `A receber ${money(remaining)}`,
        page: "pedidos",
        source: order,
        priority: 0,
        action: "Ver financeiro"
      }));
    }
  });

  producoes.forEach(prod => {
    const stage = agendaProductionKey(prod);
    if (prod.data_prevista && !["pronto", "entregue", "cancelado"].includes(stage)) {
      items.push(agendaItem({
        id: `producao-${prod.id}`,
        type: "producao",
        date: agendaDate(prod.data_prevista),
        title: prod.numero || prod.titulo || "Produção prevista",
        detail: `Etapa: ${agendaProductionLabel(prod)}${prod.material || prod.cor ? ` · ${[prod.material, prod.cor].filter(Boolean).join(" - ")}` : ""}`,
        page: "producao",
        source: prod,
        priority: stage === "falha" ? 0 : 1,
        action: "Ver produção"
      }));
    }
  });

  orcamentos.forEach(budget => {
    const status = agendaBudgetStatus(budget);
    if (["aprovado", "recusado", "cancelado"].includes(status)) return;
    const base = agendaDate(budget.updated_at || budget.created_at);
    if (!base) return;
    const followDate = agendaAddDays(base, 3);
    const age = Math.max(0, Math.round((agendaToday().getTime() - base.getTime()) / 86400000));
    if (age >= 3) {
      items.push(agendaItem({
        id: `comercial-${budget.id}`,
        type: "comercial",
        date: followDate,
        title: budget.numero || budget.projeto || "Follow-up de orçamento",
        detail: `${budget.projeto || "Orçamento aberto"} · ${agendaClientName(budget.cliente_id)} · ${money(budget.total || 0)}`,
        page: "orcamentos",
        source: budget,
        priority: age >= 10 ? 0 : 2,
        action: "Ver orçamento"
      }));
    }
  });

  return items
    .filter(item => item.date)
    .sort((a, b) => a.date - b.date || a.priority - b.priority || String(a.title).localeCompare(String(b.title)));
}

function agendaFilteredItems(filter = "todos", days = 14) {
  const today = agendaToday();
  const end = agendaAddDays(today, Number(days || 14));
  return buildAgendaItems().filter(item => {
    const typeMatch = filter === "todos" || item.type === filter;
    const dateMatch = item.date <= end || item.days < 0;
    return typeMatch && dateMatch;
  });
}

function agendaSummary(items) {
  return {
    total: items.length,
    late: items.filter(item => item.days < 0).length,
    today: items.filter(item => item.days === 0).length,
    week: items.filter(item => item.days !== null && item.days >= 0 && item.days <= 7).length
  };
}

function agendaTypeLabel(type) {
  return ({ producao: "Produção", pedido: "Pedido", financeiro: "Financeiro", comercial: "Comercial" })[type] || "Agenda";
}

function agendaTypeBadge(type) {
  return ({ producao: "warn", pedido: "blue", financeiro: "danger", comercial: "good" })[type] || "blue";
}

function agendaRowHtml(item) {
  return `
    <button class="agenda-row ${item.status.className}" data-agenda-page="${item.page}">
      <div class="agenda-date-box"><strong>${escapeHtml(agendaDateLabel(item.date))}</strong><span>${escapeHtml(item.status.label)}</span></div>
      <div class="agenda-row-main">
        <span class="badge ${agendaTypeBadge(item.type)}">${escapeHtml(agendaTypeLabel(item.type))}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </div>
      <em>${escapeHtml(item.action)}</em>
    </button>`;
}

function agendaDayHtml(date, items) {
  const dayItems = items.filter(item => agendaDateKey(item.date) === agendaDateKey(date));
  const isToday = agendaDateKey(date) === agendaDateKey(agendaToday());
  return `
    <div class="agenda-day ${isToday ? "today" : ""}">
      <div class="agenda-day-head"><strong>${escapeHtml(agendaDateLabel(date))}</strong><span>${dayItems.length}</span></div>
      <div class="agenda-day-items">
        ${dayItems.length ? dayItems.slice(0, 4).map(item => `<button class="agenda-pill ${item.status.className}" data-agenda-page="${item.page}">${escapeHtml(item.title)}</button>`).join("") : `<span class="agenda-empty-day">Livre</span>`}
      </div>
    </div>`;
}

function renderAgenda(el) {
  const filter = state.agendaFilter || "todos";
  const period = Number(state.agendaPeriod || 14);
  const items = agendaFilteredItems(filter, period);
  const summary = agendaSummary(items);
  const today = agendaToday();
  const days = Array.from({ length: Math.min(period, 14) }, (_, index) => agendaAddDays(today, index));

  el.innerHTML = `
    <div class="page-head agenda-head">
      <div><h1>Agenda</h1><p class="muted">Prazos de produção, entregas, cobranças e follow-ups em um só lugar.</p></div>
      <div class="actions">
        <button class="btn" id="agendaRefresh">Atualizar</button>
      </div>
    </div>

    <section class="grid agenda-summary">
      <div class="stat"><span>Total no período</span><strong>${summary.total}</strong></div>
      <div class="stat"><span>Atrasados</span><strong>${summary.late}</strong></div>
      <div class="stat"><span>Hoje</span><strong>${summary.today}</strong></div>
      <div class="stat"><span>Próximos 7 dias</span><strong>${summary.week}</strong></div>
    </section>

    <section class="card agenda-controls">
      <div class="agenda-filter-row">
        ${G3D_AGENDA_FILTERS.map(([id, label]) => `<button class="btn ${filter === id ? "primary" : ""}" data-agenda-filter="${id}">${escapeHtml(label)}</button>`).join("")}
      </div>
      <div class="agenda-filter-row compact">
        ${[7, 14, 30].map(value => `<button class="btn ${period === value ? "primary" : ""}" data-agenda-period="${value}">${value} dias</button>`).join("")}
      </div>
    </section>

    <section class="agenda-layout">
      <div class="card agenda-calendar-panel">
        <div class="section-head"><div><h2>Calendário rápido</h2><p class="muted">Visão dos próximos ${Math.min(period, 14)} dias.</p></div></div>
        <div class="agenda-days">${days.map(date => agendaDayHtml(date, items)).join("")}</div>
      </div>

      <div class="card agenda-list-panel">
        <div class="section-head"><div><h2>Próximas ações</h2><p class="muted">Ordenado por atraso, data e prioridade.</p></div></div>
        <div class="agenda-list">
          ${items.length ? items.map(agendaRowHtml).join("") : `<div class="dashboard-empty">Nenhum compromisso nesse filtro.</div>`}
        </div>
      </div>
    </section>`;

  document.getElementById("agendaRefresh")?.addEventListener("click", renderPage);
  document.querySelectorAll("[data-agenda-filter]").forEach(button => button.addEventListener("click", () => {
    state.agendaFilter = button.dataset.agendaFilter;
    renderPage();
  }));
  document.querySelectorAll("[data-agenda-period]").forEach(button => button.addEventListener("click", () => {
    state.agendaPeriod = Number(button.dataset.agendaPeriod || 14);
    renderPage();
  }));
  attachAgendaNavigation(el);
}

function attachAgendaNavigation(root = document) {
  root.querySelectorAll("[data-agenda-page]").forEach(button => button.addEventListener("click", () => {
    state.page = button.dataset.agendaPage;
    renderApp();
    renderPage();
  }));
}

function ensureAgendaNav() {
  if (!navPages.some(([id]) => id === "agenda")) {
    const alertsIndex = navPages.findIndex(([id]) => id === "alertas");
    const dashboardIndex = navPages.findIndex(([id]) => id === "dashboard");
    const index = alertsIndex >= 0 ? alertsIndex + 1 : dashboardIndex >= 0 ? dashboardIndex + 1 : 1;
    navPages.splice(index, 0, ["agenda", "Agenda"]);
  }
}

function agendaDashboardPanelHtml() {
  const items = agendaFilteredItems("todos", 7);
  const summary = agendaSummary(items);
  const top = items.slice(0, 5);
  return `
    <section class="card agenda-dashboard-panel" id="agendaDashboardPanel">
      <div class="section-head">
        <div><h2>Agenda da semana</h2><p class="muted">${summary.total ? `${summary.total} ação(ões) nos próximos 7 dias.` : "Nenhuma ação crítica na semana."}</p></div>
        <button class="btn" data-agenda-page="agenda">Abrir</button>
      </div>
      <div class="agenda-mini-stats">
        <span class="badge ${summary.late ? "danger" : "good"}">${summary.late} atrasado(s)</span>
        <span class="badge ${summary.today ? "warn" : "good"}">${summary.today} hoje</span>
        <span class="badge blue">${summary.week} semana</span>
      </div>
      <div class="agenda-list compact">
        ${top.length ? top.map(agendaRowHtml).join("") : `<div class="dashboard-empty">Semana sem pendências no radar.</div>`}
      </div>
    </section>`;
}

ensureAgendaNav();

const agendaPreviousRenderApp = renderApp;
renderApp = function renderAppWithAgenda() {
  ensureAgendaNav();
  agendaPreviousRenderApp();
};

const agendaPreviousRenderPage = renderPage;
renderPage = function renderPageWithAgenda() {
  if (state.page === "agenda") {
    const el = document.getElementById("content");
    if (!el) return;
    return renderAgenda(el);
  }
  return agendaPreviousRenderPage();
};

if (typeof renderDashboardPro === "function") {
  const agendaPreviousRenderDashboardPro = renderDashboardPro;
  renderDashboardPro = function renderDashboardProWithAgenda(el) {
    agendaPreviousRenderDashboardPro(el);
    if (!el.querySelector("#agendaDashboardPanel")) {
      const anchor = el.querySelector("#alertsDashboardPanel") || el.querySelector(".dashboard-alert-strip") || el.querySelector(".dashboard-grid") || el.firstElementChild;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = agendaDashboardPanelHtml();
      if (anchor) anchor.insertAdjacentElement("afterend", wrapper.firstElementChild);
      else el.prepend(wrapper.firstElementChild);
      attachAgendaNavigation(el);
    }
  };
}
