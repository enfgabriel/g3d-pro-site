function alertNormalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function alertDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function alertDaysUntil(value) {
  const date = alertDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function alertDateLabel(value) {
  const date = alertDate(value);
  return date ? date.toLocaleDateString("pt-BR") : "Sem data";
}

function alertStockStatus(row) {
  if (typeof stockStatus === "function") return stockStatus(row);
  const remaining = Number(row.peso_restante_g || row.quantidade || 0);
  const minimum = Number(row.quantidade_minima || 0);
  if (remaining <= 0) return { label: "Esgotado", className: "danger" };
  if (minimum > 0 && remaining <= minimum) return { label: "Baixo", className: "warn" };
  return { label: "Disponível", className: "good" };
}

function alertProductionKey(row) {
  return typeof productionStageKey === "function" ? productionStageKey(row.status || row.etapa_atual || "fila") : alertNormalize(row.status || row.etapa_atual || "fila");
}

function alertProductionLabel(row) {
  return typeof productionStageLabel === "function" ? productionStageLabel(row.status || row.etapa_atual || "fila") : (row.status || row.etapa_atual || "Fila");
}

function alertPaymentKey(row) {
  return typeof financeStatusKey === "function" ? financeStatusKey(row) : alertNormalize(row.status_pagamento || "pendente");
}

function alertClientName(clientId) {
  if (!clientId) return "";
  const client = (state.cache.clientes || []).find(item => item.id === clientId);
  return client ? (client.nome || client.empresa || "") : "";
}

function alertBudgetAgeDays(row) {
  const base = alertDate(row.updated_at || row.created_at);
  if (!base) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  base.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - base.getTime()) / 86400000));
}

function createAlert({ type, severity = "info", title, detail, page, date = "", action = "Abrir", ref = "" }) {
  return { type, severity, title, detail, page, date, action, ref };
}

function buildG3DAlerts() {
  const alerts = [];
  const estoque = state.cache.estoque || [];
  const pedidos = state.cache.pedidos || [];
  const producoes = state.cache.producoes || [];
  const orcamentos = state.cache.orcamentos || [];

  estoque.forEach(item => {
    const status = alertStockStatus(item);
    if (["Baixo", "Esgotado"].includes(status.label)) {
      const remaining = Number(item.peso_restante_g || item.quantidade || 0).toLocaleString("pt-BR");
      alerts.push(createAlert({
        type: "Estoque",
        severity: status.label === "Esgotado" ? "danger" : "warn",
        title: item.nome || [item.material, item.cor].filter(Boolean).join(" - ") || "Material",
        detail: `${status.label}: ${remaining} g/ml restantes.`,
        page: "estoque",
        action: "Ver estoque"
      }));
    }
  });

  pedidos.forEach(order => {
    const payment = alertPaymentKey(order);
    const remaining = typeof financeRemaining === "function" ? financeRemaining(order) : Math.max(0, Number(order.valor || 0) - Number(order.valor_pago || 0));
    if (payment === "atrasado") {
      alerts.push(createAlert({
        type: "Financeiro",
        severity: "danger",
        title: order.numero || order.titulo || "Pedido",
        detail: `Pagamento atrasado. Falta ${money(remaining)}${order.vencimento_pagamento ? ` desde ${alertDateLabel(order.vencimento_pagamento)}` : ""}.`,
        page: "pedidos",
        date: order.vencimento_pagamento || "",
        action: "Ver pedido"
      }));
    } else if (remaining > 0 && order.vencimento_pagamento) {
      const days = alertDaysUntil(order.vencimento_pagamento);
      if (days !== null && days <= 2) {
        alerts.push(createAlert({
          type: "Financeiro",
          severity: days < 0 ? "danger" : "warn",
          title: order.numero || order.titulo || "Pedido",
          detail: days === 0 ? `Pagamento vence hoje. Falta ${money(remaining)}.` : `Pagamento vence em ${days} dia(s). Falta ${money(remaining)}.`,
          page: "pedidos",
          date: order.vencimento_pagamento || "",
          action: "Ver financeiro"
        }));
      }
    }
  });

  producoes.forEach(prod => {
    const stage = alertProductionKey(prod);
    const days = alertDaysUntil(prod.data_prevista);
    if (stage === "falha") {
      alerts.push(createAlert({
        type: "Produção",
        severity: "danger",
        title: prod.numero || prod.titulo || "Produção",
        detail: prod.falha_motivo || "Falha registrada na produção.",
        page: "producao",
        date: prod.falha_em || prod.updated_at || "",
        action: "Ver falha"
      }));
    }
    if (days !== null && days <= 2 && !["pronto", "entregue", "cancelado"].includes(stage)) {
      alerts.push(createAlert({
        type: "Prazo",
        severity: days < 0 ? "danger" : "warn",
        title: prod.numero || prod.titulo || "Produção",
        detail: days < 0 ? `${Math.abs(days)} dia(s) atrasada. Etapa atual: ${alertProductionLabel(prod)}.` : days === 0 ? `Vence hoje. Etapa atual: ${alertProductionLabel(prod)}.` : `Vence em ${days} dia(s). Etapa atual: ${alertProductionLabel(prod)}.`,
        page: "producao",
        date: prod.data_prevista || "",
        action: "Ver produção"
      }));
    }
  });

  orcamentos.forEach(budget => {
    const status = alertNormalize(budget.status || "rascunho");
    const age = alertBudgetAgeDays(budget);
    if (!["aprovado", "recusado", "cancelado"].includes(status) && age !== null && age >= 7) {
      alerts.push(createAlert({
        type: "Comercial",
        severity: age >= 14 ? "danger" : "warn",
        title: budget.numero || budget.projeto || "Orçamento",
        detail: `Orçamento aberto há ${age} dia(s). Cliente: ${alertClientName(budget.cliente_id) || "não vinculado"}.`,
        page: "orcamentos",
        date: budget.updated_at || budget.created_at || "",
        action: "Ver orçamento"
      }));
    }
  });

  return alerts.sort((a, b) => {
    const weight = { danger: 0, warn: 1, info: 2, good: 3 };
    return (weight[a.severity] ?? 9) - (weight[b.severity] ?? 9);
  });
}

function alertSummary(alerts = buildG3DAlerts()) {
  return {
    total: alerts.length,
    danger: alerts.filter(item => item.severity === "danger").length,
    warn: alerts.filter(item => item.severity === "warn").length,
    finance: alerts.filter(item => item.type === "Financeiro").length,
    production: alerts.filter(item => ["Produção", "Prazo"].includes(item.type)).length,
    stock: alerts.filter(item => item.type === "Estoque").length
  };
}

function alertRowHtml(alert, index) {
  return `
    <button class="alert-row ${alert.severity}" data-alert-page="${alert.page}" data-alert-index="${index}">
      <span class="badge ${alert.severity === "danger" ? "danger" : alert.severity === "warn" ? "warn" : "blue"}">${escapeHtml(alert.type)}</span>
      <span class="alert-row-main"><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.detail)}</small></span>
      <em>${escapeHtml(alert.action)}</em>
    </button>`;
}

function renderAlertas(el) {
  const alerts = buildG3DAlerts();
  const summary = alertSummary(alerts);
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Alertas</h1><p class="muted">Central de ações para estoque, financeiro, produção e comercial.</p></div>
      <button class="btn" id="refreshAlerts">Atualizar</button>
    </div>
    <section class="grid alert-summary">
      <div class="stat"><span>Total</span><strong>${summary.total}</strong></div>
      <div class="stat"><span>Críticos</span><strong>${summary.danger}</strong></div>
      <div class="stat"><span>Atenção</span><strong>${summary.warn}</strong></div>
      <div class="stat"><span>Financeiro</span><strong>${summary.finance}</strong></div>
    </section>
    <section class="card alert-center-panel">
      <div class="section-head"><div><h2>Itens que precisam de ação</h2><p class="muted">Clique em um alerta para abrir a área correspondente.</p></div></div>
      <div class="alert-list">
        ${alerts.length ? alerts.map(alertRowHtml).join("") : `<div class="dashboard-empty">Nenhum alerta crítico no momento.</div>`}
      </div>
    </section>`;
  document.getElementById("refreshAlerts")?.addEventListener("click", renderPage);
  attachAlertNavigation(el);
}

function attachAlertNavigation(root = document) {
  root.querySelectorAll("[data-alert-page]").forEach(button => {
    button.addEventListener("click", () => {
      state.page = button.dataset.alertPage;
      renderApp();
      renderPage();
    });
  });
}

function ensureAlertsNav() {
  if (!navPages.some(([id]) => id === "alertas")) {
    const dashboardIndex = navPages.findIndex(([id]) => id === "dashboard");
    navPages.splice(dashboardIndex >= 0 ? dashboardIndex + 1 : 1, 0, ["alertas", "Alertas"]);
  }
}

function alertsDashboardPanelHtml() {
  const alerts = buildG3DAlerts();
  const summary = alertSummary(alerts);
  const top = alerts.slice(0, 4);
  return `
    <section class="card alerts-dashboard-panel" id="alertsDashboardPanel">
      <div class="section-head">
        <div><h2>Central de alertas</h2><p class="muted">${summary.total ? `${summary.total} ponto(s) pedem atenção.` : "Nenhum ponto crítico no momento."}</p></div>
        <button class="btn" data-dashboard-page="alertas">Abrir</button>
      </div>
      <div class="alerts-mini-grid">
        <span class="badge ${summary.danger ? "danger" : "good"}">${summary.danger} crítico(s)</span>
        <span class="badge ${summary.warn ? "warn" : "good"}">${summary.warn} atenção</span>
        <span class="badge blue">${summary.stock} estoque</span>
        <span class="badge blue">${summary.production} produção</span>
      </div>
      <div class="alert-list compact">
        ${top.length ? top.map(alertRowHtml).join("") : `<div class="dashboard-empty">Tudo certo por enquanto.</div>`}
      </div>
    </section>`;
}

ensureAlertsNav();

const alertsPreviousRenderApp = renderApp;
renderApp = function renderAppWithAlerts() {
  ensureAlertsNav();
  alertsPreviousRenderApp();
};

const alertsPreviousRenderPage = renderPage;
renderPage = function renderPageWithAlerts() {
  if (state.page === "alertas") {
    const el = document.getElementById("content");
    if (!el) return;
    return renderAlertas(el);
  }
  return alertsPreviousRenderPage();
};

if (typeof renderDashboardPro === "function") {
  const alertsPreviousRenderDashboardPro = renderDashboardPro;
  renderDashboardPro = function renderDashboardProWithAlerts(el) {
    alertsPreviousRenderDashboardPro(el);
    if (!el.querySelector("#alertsDashboardPanel")) {
      const anchor = el.querySelector(".dashboard-alert-strip") || el.querySelector(".dashboard-grid") || el.firstElementChild;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = alertsDashboardPanelHtml();
      if (anchor) anchor.insertAdjacentElement("afterend", wrapper.firstElementChild);
      else el.prepend(wrapper.firstElementChild);
      attachAlertNavigation(el);
    }
  };
}
