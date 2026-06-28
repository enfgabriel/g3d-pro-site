function clientDisplayName(client = {}) {
  return client.nome || client.empresa || "Cliente";
}

function clientBudgets(clientId) {
  return (state.cache.orcamentos || []).filter(item => item.cliente_id === clientId);
}

function clientOrders(clientId) {
  return (state.cache.pedidos || []).filter(item => item.cliente_id === clientId);
}

function clientProductions(clientId) {
  return (state.cache.producoes || []).filter(item => item.cliente_id === clientId);
}

function clientStats(client = {}) {
  const budgets = clientBudgets(client.id);
  const orders = clientOrders(client.id);
  const productions = clientProductions(client.id);
  return {
    budgets,
    orders,
    productions,
    totalSold: orders.reduce((sum, row) => sum + (typeof financeOrderTotal === "function" ? financeOrderTotal(row) : Number(row.valor || 0)), 0),
    paid: orders.reduce((sum, row) => sum + (typeof financePaid === "function" ? financePaid(row) : Number(row.valor_pago || 0)), 0),
    pending: orders.reduce((sum, row) => sum + (typeof financeRemaining === "function" ? financeRemaining(row) : Math.max(0, Number(row.valor || 0) - Number(row.valor_pago || 0))), 0)
  };
}

function clientContactLine(client = {}) {
  return [client.email, client.telefone, client.whatsapp, [client.cidade, client.estado].filter(Boolean).join("/")].filter(Boolean).join(" · ");
}

function renderClientHistoryTable(rows, empty, columns, rowRenderer) {
  return `
    <div class="table-wrap compact-table client-history-table">
      <table>
        <thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
        <tbody>${rows.length ? rows.map(rowRenderer).join("") : `<tr><td colspan="${columns.length}" class="empty">${escapeHtml(empty)}</td></tr>`}</tbody>
      </table>
    </div>`;
}

function openClientProfile(client = {}) {
  const stats = clientStats(client);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal client-profile-modal">
      <div class="modal-head"><strong>Ficha do cliente</strong><button class="btn" type="button" id="closeClientProfile">Fechar</button></div>
      <div class="modal-body">
        <section class="client-profile-head">
          <div>
            <h2>${escapeHtml(clientDisplayName(client))}</h2>
            <p class="muted">${escapeHtml(clientContactLine(client) || "Sem contato cadastrado")}</p>
            ${client.cpf_cnpj ? `<p class="muted small">Documento: ${escapeHtml(client.cpf_cnpj)}</p>` : ""}
          </div>
          <div class="actions">
            <button class="btn" type="button" id="editClientFromProfile">Editar cliente</button>
            <button class="btn primary" type="button" id="newBudgetFromClient">Novo orçamento</button>
          </div>
        </section>

        <div class="grid client-profile-stats">
          <div class="stat"><span>Orçamentos</span><strong>${stats.budgets.length}</strong></div>
          <div class="stat"><span>Pedidos</span><strong>${stats.orders.length}</strong></div>
          <div class="stat"><span>Total vendido</span><strong>${money(stats.totalSold)}</strong></div>
          <div class="stat"><span>A receber</span><strong>${money(stats.pending)}</strong></div>
        </div>

        <section class="client-profile-section">
          <h3>Pedidos</h3>
          ${renderClientHistoryTable(stats.orders.slice(0, 8), "Nenhum pedido vinculado.", ["Número", "Pedido", "Pagamento", "Total", "A receber"], order => {
            const pay = typeof financeStatusInfo === "function" ? financeStatusInfo(order) : { label: order.status_pagamento || "Pendente", className: "warn" };
            const total = typeof financeOrderTotal === "function" ? financeOrderTotal(order) : Number(order.valor || 0);
            const remaining = typeof financeRemaining === "function" ? financeRemaining(order) : 0;
            return `<tr><td>${escapeHtml(order.numero || "")}</td><td>${escapeHtml(order.titulo || "")}</td><td><span class="badge ${pay.className}">${escapeHtml(pay.label)}</span></td><td>${money(total)}</td><td>${money(remaining)}</td></tr>`;
          })}
        </section>

        <section class="client-profile-section">
          <h3>Orçamentos</h3>
          ${renderClientHistoryTable(stats.budgets.slice(0, 8), "Nenhum orçamento vinculado.", ["Número", "Projeto", "Status", "Total"], budget => `<tr><td>${escapeHtml(budget.numero || "")}</td><td>${escapeHtml(budget.projeto || "")}</td><td><span class="badge blue">${escapeHtml(budget.status || "rascunho")}</span></td><td>${money(budget.total)}</td></tr>`)}
        </section>

        <section class="client-profile-section">
          <h3>Produção</h3>
          ${renderClientHistoryTable(stats.productions.slice(0, 8), "Nenhuma produção vinculada.", ["Produção", "Etapa", "Material", "Consumo"], production => {
            const label = typeof productionStageLabel === "function" ? productionStageLabel(production.status) : production.status || "fila";
            const badge = typeof productionStageBadgeClass === "function" ? productionStageBadgeClass(production.status) : "blue";
            const consumption = typeof productionConsumption === "function" ? productionConsumption(production) : Number(production.peso_g || 0);
            return `<tr><td>${escapeHtml(production.numero || production.titulo || "")}</td><td><span class="badge ${badge}">${escapeHtml(label)}</span></td><td>${escapeHtml([production.material, production.cor].filter(Boolean).join(" - "))}</td><td>${consumption.toLocaleString("pt-BR")} g/ml</td></tr>`;
          })}
        </section>

        ${client.observacao ? `<section class="client-profile-section"><h3>Observações</h3><p class="muted">${escapeHtml(client.observacao)}</p></section>` : ""}
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closeClientProfile").addEventListener("click", close);
  document.getElementById("editClientFromProfile").addEventListener("click", () => { close(); openForm(modules.clientes, client); });
  document.getElementById("newBudgetFromClient").addEventListener("click", () => {
    close();
    state.page = "orcamentos";
    renderApp();
    renderPage();
    setTimeout(() => openBudgetForm({ cliente_id: client.id }), 0);
  });
}

function renderClientesProfessional(el) {
  const rows = state.cache.clientes || [];
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Clientes</h1><p class="muted">Cadastro com histórico comercial, financeiro e produção.</p></div>
      <button class="btn primary" id="newClientRecord">Novo cliente</button>
    </div>
    <div class="client-list">
      ${rows.length ? rows.map(client => {
        const stats = clientStats(client);
        return `<article class="card client-card">
          <div class="client-card-main">
            <div>
              <strong>${escapeHtml(clientDisplayName(client))}</strong>
              <span>${escapeHtml(clientContactLine(client) || "Sem contato")}</span>
            </div>
            <span class="badge blue">${stats.orders.length} pedido(s)</span>
          </div>
          <div class="client-card-metrics">
            <div><span>Orçamentos</span><strong>${stats.budgets.length}</strong></div>
            <div><span>Total vendido</span><strong>${money(stats.totalSold)}</strong></div>
            <div><span>A receber</span><strong>${money(stats.pending)}</strong></div>
          </div>
          <div class="actions">
            <button class="btn primary" data-client-profile="${client.id}">Ficha</button>
            <button class="btn" data-edit-client="${client.id}">Editar</button>
            <button class="btn danger" data-del-client="${client.id}">Excluir</button>
          </div>
        </article>`;
      }).join("") : `<div class="card empty">Nenhum cliente cadastrado ainda.</div>`}
    </div>`;

  document.getElementById("newClientRecord").addEventListener("click", () => openForm(modules.clientes));
  document.querySelectorAll("[data-client-profile]").forEach(btn => btn.addEventListener("click", () => openClientProfile(rows.find(row => row.id === btn.dataset.clientProfile))));
  document.querySelectorAll("[data-edit-client]").forEach(btn => btn.addEventListener("click", () => openForm(modules.clientes, rows.find(row => row.id === btn.dataset.editClient))));
  document.querySelectorAll("[data-del-client]").forEach(btn => btn.addEventListener("click", () => softDelete("clientes", btn.dataset.delClient)));
}

const clientHistoryPreviousRenderPage = renderPage;
renderPage = function renderPageWithClientHistory() {
  const el = document.getElementById("content");
  if (state.page === "clientes" && el) return renderClientesProfessional(el);
  return clientHistoryPreviousRenderPage();
};
