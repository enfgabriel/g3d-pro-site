function renderDashboardPro(el) {
  const clientes = state.cache.clientes || [];
  const estoque = state.cache.estoque || [];
  const orcamentos = state.cache.orcamentos || [];
  const pedidos = state.cache.pedidos || [];
  const producoes = state.cache.producoes || [];

  const receita = pedidos.reduce((sum, item) => sum + financeOrderTotal(item), 0);
  const recebido = pedidos.reduce((sum, item) => sum + financePaid(item), 0);
  const aReceber = pedidos.reduce((sum, item) => sum + financeRemaining(item), 0);
  const atrasados = pedidos.filter(item => financeStatusKey(item) === "atrasado");
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
        <p class="muted">Central de comando para vendas, financeiro, estoque e produção.</p>
      </div>
      <div class="actions">
        ${dashboardPageButton("orcamentos", "Novo orçamento", "btn primary")}
        ${dashboardPageButton("pedidos", "Financeiro")}
      </div>
    </div>

    <div class="grid stats dashboard-stats finance-dashboard-stats">
      <div class="stat"><span>Receita registrada</span><strong>${money(receita)}</strong></div>
      <div class="stat"><span>Recebido</span><strong>${money(recebido)}</strong></div>
      <div class="stat"><span>A receber</span><strong>${money(aReceber)}</strong></div>
      <div class="stat"><span>Atrasados</span><strong>${atrasados.length}</strong></div>
    </div>

    <div class="dashboard-alert-strip finance-alert-strip">
      <button class="dashboard-alert ${atrasados.length ? "danger" : "good"}" data-dashboard-page="pedidos">
        <span>Pagamentos atrasados</span><strong>${atrasados.length}</strong>
      </button>
      <button class="dashboard-alert ${aReceber > 0 ? "warn" : "good"}" data-dashboard-page="pedidos">
        <span>Total a receber</span><strong>${money(aReceber)}</strong>
      </button>
      <button class="dashboard-alert ${stockAlerts.length ? "warn" : "good"}" data-dashboard-page="estoque">
        <span>Estoque em alerta</span><strong>${stockAlerts.length}</strong>
      </button>
      <button class="dashboard-alert ${failures.length ? "danger" : "good"}" data-dashboard-page="producao">
        <span>Falhas</span><strong>${failures.length}</strong>
      </button>
    </div>

    <div class="dashboard-grid">
      <section class="card dashboard-panel">
        <div class="section-head"><div><h2>Atenção imediata</h2><p class="muted">Financeiro, prazos e operação.</p></div></div>
        <div class="dashboard-list">
          ${dashboardList([
            ...atrasados.slice(0, 4).map(item => ({ type: "Financeiro", title: item.numero || item.titulo || "Pedido", detail: `${financeDueLabel(item)} · falta ${money(financeRemaining(item))}`, page: "pedidos", badge: "danger" })),
            ...stockAlerts.slice(0, 3).map(item => ({ type: "Estoque", title: item.nome || item.material || "Material", detail: `${dashboardStockStatus(item).label} · ${Number(item.peso_restante_g || item.quantidade || 0).toLocaleString("pt-BR")} g/ml`, page: "estoque", badge: dashboardStockStatus(item).className })),
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
        <div class="section-head"><div><h2>Financeiro</h2><p class="muted">Pedidos por situação de pagamento.</p></div>${dashboardPageButton("pedidos", "Abrir")}</div>
        <div class="dashboard-stage-list">
          ${["pendente", "sinal", "pago", "atrasado"].map(status => {
            const count = pedidos.filter(item => financeStatusKey(item) === status).length;
            return `<div class="dashboard-stage"><span>${escapeHtml(G3D_PAYMENT_STATUS[status].label)}</span><strong>${count}</strong></div>`;
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
          ${dashboardList(activeOrders.slice(0, 6), "Nenhum pedido ativo.", item => {
            const pay = financeStatusInfo(item);
            return `<button class="dashboard-row" data-dashboard-page="pedidos">
              <span class="badge ${pay.className}">${escapeHtml(pay.label)}</span>
              <strong>${escapeHtml(item.numero || item.titulo || "Pedido")}</strong>
              <small>${money(financePaid(item))} recebido · ${money(financeRemaining(item))} a receber</small>
            </button>`;
          })}
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
