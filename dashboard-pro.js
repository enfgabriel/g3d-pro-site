function dashboardDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dashboardDaysUntil(value) {
  const date = dashboardDateValue(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function dashboardStockStatus(row) {
  if (typeof stockStatus === "function") return stockStatus(row);
  const remaining = Number(row.quantidade || row.peso_restante_g || 0);
  const minimum = Number(row.quantidade_minima || 0);
  if (remaining <= 0) return { label: "Esgotado", className: "danger" };
  if (minimum > 0 && remaining <= minimum) return { label: "Baixo", className: "warn" };
  return { label: "Disponível", className: "good" };
}

function dashboardProductionKey(row) {
  return typeof productionStageKey === "function" ? productionStageKey(row.status) : String(row.status || "fila").toLowerCase();
}

function dashboardPageButton(page, label, className = "btn") {
  return `<button class="${className}" data-dashboard-page="${page}">${escapeHtml(label)}</button>`;
}

function dashboardList(items, empty, renderer) {
  return items.length ? items.map(renderer).join("") : `<div class="dashboard-empty">${escapeHtml(empty)}</div>`;
}

function renderDashboardPro(el) {
  const clientes = state.cache.clientes || [];
  const estoque = state.cache.estoque || [];
  const orcamentos = state.cache.orcamentos || [];
  const pedidos = state.cache.pedidos || [];
  const producoes = state.cache.producoes || [];

  const receita = pedidos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const stockAlerts = estoque.filter(item => ["Baixo", "Esgotado"].includes(dashboardStockStatus(item).label));
  const openBudgets = orcamentos.filter(item => !["aprovado", "recusado", "cancelado"].includes(String(item.status || "").toLowerCase()));
  const activeOrders = pedidos.filter(item => !["finalizado", "entregue", "cancelado"].includes(String(item.status || "").toLowerCase()));
  const activeProductions = producoes.filter(item => !["pronto", "entregue", "cancelado"].includes(dashboardProductionKey(item)));
  const failures = producoes.filter(item => dashboardProductionKey(item) === "falha");
  const dueSoon = producoes
    .map(item => ({ ...item, dias: dashboardDaysUntil(item.data_prevista) }))
    .filter(item => item.dias !== null && item.dias <= 3 && !["entregue", "cancelado"].includes(dashboardProductionKey(item)))
    .sort((a, b) => a.dias - b.dias);

  el.innerHTML = `
    <div class="page-head dashboard-head">
      <div>
        <h1>Dashboard</h1>
        <p class="muted">Painel de operação para acompanhar vendas, estoque e produção.</p>
      </div>
      <div class="actions">
        ${dashboardPageButton("orcamentos", "Novo orçamento", "btn primary")}
        ${dashboardPageButton("estoque", "Estoque")}
      </div>
    </div>

    <div class="grid stats dashboard-stats">
      <div class="stat"><span>Clientes</span><strong>${clientes.length}</strong></div>
      <div class="stat"><span>Orçamentos abertos</span><strong>${openBudgets.length}</strong></div>
      <div class="stat"><span>Pedidos ativos</span><strong>${activeOrders.length}</strong></div>
      <div class="stat"><span>Receita registrada</span><strong>${money(receita)}</strong></div>
    </div>

    <div class="dashboard-alert-strip">
      <button class="dashboard-alert ${stockAlerts.length ? "warn" : "good"}" data-dashboard-page="estoque">
        <span>Estoque em alerta</span><strong>${stockAlerts.length}</strong>
      </button>
      <button class="dashboard-alert ${failures.length ? "danger" : "good"}" data-dashboard-page="producao">
        <span>Falhas</span><strong>${failures.length}</strong>
      </button>
      <button class="dashboard-alert ${dueSoon.length ? "warn" : "good"}" data-dashboard-page="producao">
        <span>Prazos próximos</span><strong>${dueSoon.length}</strong>
      </button>
      <button class="dashboard-alert blue" data-dashboard-page="producao">
        <span>Produções ativas</span><strong>${activeProductions.length}</strong>
      </button>
    </div>

    <div class="dashboard-grid">
      <section class="card dashboard-panel">
        <div class="section-head"><div><h2>Atenção imediata</h2><p class="muted">Itens que merecem ação primeiro.</p></div></div>
        <div class="dashboard-list">
          ${dashboardList([
            ...stockAlerts.slice(0, 4).map(item => ({ type: "Estoque", title: item.nome || item.material || "Material", detail: `${dashboardStockStatus(item).label} · ${Number(item.peso_restante_g || item.quantidade || 0).toLocaleString("pt-BR")} g/ml`, page: "estoque", badge: dashboardStockStatus(item).className })),
            ...failures.slice(0, 3).map(item => ({ type: "Produção", title: item.numero || item.titulo || "Produção", detail: item.falha_motivo || "Falha registrada", page: "producao", badge: "danger" })),
            ...dueSoon.slice(0, 3).map(item => ({ type: "Prazo", title: item.numero || item.titulo || "Produção", detail: item.dias < 0 ? `${Math.abs(item.dias)} dia(s) atrasado` : item.dias === 0 ? "Vence hoje" : `Vence em ${item.dias} dia(s)`, page: "producao", badge: item.dias < 0 ? "danger" : "warn" }))
          ].slice(0, 8), "Nada crítico no momento.", item => `
            <button class="dashboard-row" data-dashboard-page="${item.page}">
              <span class="badge ${item.badge}">${escapeHtml(item.type)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.detail)}</small>
            </button>`)}
        </div>
      </section>

      <section class="card dashboard-panel">
        <div class="section-head"><div><h2>Produção</h2><p class="muted">Distribuição atual da fila.</p></div>${dashboardPageButton("producao", "Abrir")}</div>
        <div class="dashboard-stage-list">
          ${["fila", "imprimindo", "pos", "pronto", "entregue", "falha"].map(stage => {
            const count = producoes.filter(item => dashboardProductionKey(item) === stage).length;
            const label = typeof productionStageLabel === "function" ? productionStageLabel(stage) : stage;
            return `<div class="dashboard-stage"><span>${escapeHtml(label)}</span><strong>${count}</strong></div>`;
          }).join("")}
        </div>
      </section>

      <section class="card dashboard-panel">
        <div class="section-head"><div><h2>Orçamentos recentes</h2><p class="muted">Propostas que ainda podem virar pedido.</p></div>${dashboardPageButton("orcamentos", "Abrir")}</div>
        <div class="dashboard-list">
          ${dashboardList(openBudgets.slice(0, 6), "Nenhum orçamento aberto.", item => `
            <button class="dashboard-row" data-dashboard-page="orcamentos">
              <span class="badge blue">${escapeHtml(item.status || "rascunho")}</span>
              <strong>${escapeHtml(item.numero || item.projeto || "Orçamento")}</strong>
              <small>${escapeHtml(item.projeto || "")} · ${money(item.total)}</small>
            </button>`)}
        </div>
      </section>

      <section class="card dashboard-panel">
        <div class="section-head"><div><h2>Pedidos ativos</h2><p class="muted">Pedidos ainda não encerrados.</p></div>${dashboardPageButton("pedidos", "Abrir")}</div>
        <div class="dashboard-list">
          ${dashboardList(activeOrders.slice(0, 6), "Nenhum pedido ativo.", item => `
            <button class="dashboard-row" data-dashboard-page="pedidos">
              <span class="badge ${String(item.status || "").toLowerCase().includes("produção") ? "warn" : "blue"}">${escapeHtml(item.status || "novo")}</span>
              <strong>${escapeHtml(item.numero || item.titulo || "Pedido")}</strong>
              <small>${escapeHtml(item.titulo || "")} · ${money(item.valor)}</small>
            </button>`)}
        </div>
      </section>
    </div>`;

  document.querySelectorAll("[data-dashboard-page]").forEach(button => {
    button.addEventListener("click", () => {
      state.page = button.dataset.dashboardPage;
      renderApp();
      renderPage();
    });
  });
}

const dashboardPreviousRenderPage = renderPage;
renderPage = function renderPageWithDashboardPro() {
  const el = document.getElementById("content");
  if (state.page === "dashboard" && el) return renderDashboardPro(el);
  return dashboardPreviousRenderPage();
};
