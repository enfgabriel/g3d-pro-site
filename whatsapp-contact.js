function g3dWhatsAppDigits(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function g3dClientName(client = {}) {
  return typeof clientDisplayName === "function" ? clientDisplayName(client) : (client.nome || client.empresa || "Cliente");
}

function g3dClientForRow(row = {}) {
  if (!row?.cliente_id) return null;
  return (state.cache.clientes || []).find(client => client.id === row.cliente_id) || null;
}

function g3dShopName() {
  return state.cache.loja?.nome_loja || "G3D Pro";
}

function g3dWhatsAppUrl(client = {}, message = "") {
  const number = g3dWhatsAppDigits(client.whatsapp || client.telefone || "");
  if (!number) return "";
  const text = encodeURIComponent(message || `Olá, ${g3dClientName(client)}! Tudo bem?`);
  return `https://wa.me/${number}?text=${text}`;
}

function g3dWhatsAppButton(client = {}, className = "btn whatsapp-btn", message = "", label = "WhatsApp") {
  const url = g3dWhatsAppUrl(client, message);
  if (!url) return `<button class="${className}" type="button" disabled>${escapeHtml(label)}</button>`;
  return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function g3dBudgetMessage(client = {}, budget = {}) {
  return [
    `Olá, ${g3dClientName(client)}! Tudo bem?`,
    `Aqui é da ${g3dShopName()}.`,
    `Estou enviando o orçamento ${budget.numero || ""} referente ao projeto ${budget.projeto || "de impressão 3D"}.`,
    `Valor total: ${money(budget.total || 0)}.`,
    budget.prazo_entrega ? `Prazo estimado: ${budget.prazo_entrega}.` : "",
    "Qualquer ajuste que quiser fazer, é só me chamar por aqui."
  ].filter(Boolean).join("\n");
}

function g3dOrderMessage(client = {}, order = {}) {
  return [
    `Olá, ${g3dClientName(client)}! Tudo bem?`,
    `Aqui é da ${g3dShopName()}.`,
    `Passando para atualizar sobre o pedido ${order.numero || ""} - ${order.titulo || "impressão 3D"}.`,
    order.status ? `Status atual: ${order.status}.` : "",
    order.data_entrega ? `Previsão/entrega: ${new Date(order.data_entrega).toLocaleDateString("pt-BR")}.` : "",
    "Se precisar de alguma informação, fico à disposição."
  ].filter(Boolean).join("\n");
}

function g3dPaymentMessage(client = {}, order = {}) {
  const remaining = typeof financeRemaining === "function" ? financeRemaining(order) : Math.max(0, Number(order.valor || order.total || 0) - Number(order.valor_pago || 0));
  return [
    `Olá, ${g3dClientName(client)}! Tudo bem?`,
    `Aqui é da ${g3dShopName()}.`,
    `Estou passando sobre o pagamento do pedido ${order.numero || ""} - ${order.titulo || ""}.`,
    `Valor em aberto: ${money(remaining)}.`,
    order.vencimento_pagamento ? `Vencimento: ${new Date(order.vencimento_pagamento).toLocaleDateString("pt-BR")}.` : "",
    "Quando puder, me chama por aqui para combinarmos a melhor forma de pagamento."
  ].filter(Boolean).join("\n");
}

function renderClientesWithWhatsApp(el) {
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
              <strong>${escapeHtml(g3dClientName(client))}</strong>
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
            ${g3dWhatsAppButton(client, "btn whatsapp-btn")}
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

function renderOrcamentosWithWhatsApp(el) {
  const rows = state.cache.orcamentos || [];
  el.innerHTML = `<div class="page-head"><div><h1>Orçamentos</h1><p class="muted">Orçamentos com cálculo por peso, tempo e parâmetros.</p></div><button class="btn primary" id="newBudget">Novo orçamento</button></div><div class="table-wrap"><table><thead><tr><th>Número</th><th>Projeto</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>${rows.length ? rows.map(row => {
    const client = g3dClientForRow(row);
    return `<tr><td>${escapeHtml(row.numero || "")}</td><td>${escapeHtml(row.projeto || "")}<div class="muted small">${escapeHtml(client ? g3dClientName(client) : "Cliente não vinculado")}</div></td><td><span class="badge blue">${escapeHtml(row.status || "rascunho")}</span></td><td>${money(row.total)}</td><td><div class="actions">${client ? g3dWhatsAppButton(client, "btn whatsapp-btn", g3dBudgetMessage(client, row), "Enviar WhatsApp") : `<button class="btn whatsapp-btn" disabled>WhatsApp</button>`}<button class="btn" data-edit-budget="${row.id}">Editar</button><button class="btn" data-pdf-budget="${row.id}">PDF</button><button class="btn danger" data-del-budget="${row.id}">Excluir</button></div></td></tr>`;
  }).join("") : `<tr><td colspan="5" class="empty">Nenhum orçamento ainda.</td></tr>`}</tbody></table></div>`;
  document.getElementById("newBudget").addEventListener("click", () => openBudgetForm());
  document.querySelectorAll("[data-edit-budget]").forEach(btn => btn.addEventListener("click", () => openBudgetForm(rows.find(row => row.id === btn.dataset.editBudget))));
  document.querySelectorAll("[data-del-budget]").forEach(btn => btn.addEventListener("click", () => softDelete("orcamentos", btn.dataset.delBudget)));
  document.querySelectorAll("[data-pdf-budget]").forEach(btn => btn.addEventListener("click", () => openBudgetPdf(rows.find(row => row.id === btn.dataset.pdfBudget))));
}

function renderPedidosWithWhatsApp(el) {
  const rows = state.cache.pedidos || [];
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Pedidos</h1><p class="muted">Pedidos, produção e controle financeiro básico.</p></div>
      <button class="btn primary" id="newOrderRecord">Novo pedido</button>
    </div>
    ${renderFinanceSummary(rows)}
    <div class="table-wrap">
      <table>
        <thead><tr><th>Número</th><th>Pedido</th><th>Status</th><th>Pagamento</th><th>Valores</th><th>Produção</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => {
            const prod = productionForOrder(row);
            const pay = financeStatusInfo(row);
            const client = g3dClientForRow(row);
            const remaining = typeof financeRemaining === "function" ? financeRemaining(row) : 0;
            return `<tr>
              <td>${escapeHtml(row.numero || "")}</td>
              <td><strong>${escapeHtml(row.titulo || "")}</strong><div class="muted small">${escapeHtml(client ? g3dClientName(client) : [row.material, row.cor].filter(Boolean).join(" - "))}</div></td>
              <td><span class="badge ${orderStatusBadgeClass(row.status)}">${escapeHtml(row.status || "novo")}</span></td>
              <td><span class="badge ${pay.className}">${escapeHtml(pay.label)}</span><div class="muted small">${escapeHtml(financeDueLabel(row))}</div></td>
              <td><strong>${money(financeOrderTotal(row))}</strong><div class="muted small">Pago ${money(financePaid(row))} · Falta ${money(remaining)}</div></td>
              <td>${prod ? `<span class="badge ${productionStatusBadgeClass(prod.status)}">${escapeHtml(prod.status || "fila")}</span>` : `<span class="badge">Não enviada</span>`}</td>
              <td><div class="actions finance-actions">
                ${client ? g3dWhatsAppButton(client, "btn whatsapp-btn", g3dOrderMessage(client, row), "WhatsApp") : `<button class="btn whatsapp-btn" disabled>WhatsApp</button>`}
                ${client && remaining > 0 ? g3dWhatsAppButton(client, "btn whatsapp-btn alt", g3dPaymentMessage(client, row), "Cobrar") : ""}
                <button class="btn" data-edit-order="${row.id}">Editar</button>
                <button class="btn" data-payment-order="${row.id}">Pagamento</button>
                <button class="btn primary" data-production-order="${row.id}" ${prod ? "disabled" : ""}>${prod ? "Na produção" : "Enviar produção"}</button>
                <button class="btn danger" data-del-order="${row.id}">Excluir</button>
              </div></td>
            </tr>`;
          }).join("") : `<tr><td colspan="7" class="empty">Nenhum pedido ainda.</td></tr>`}
        </tbody>
      </table>
    </div>`;

  document.getElementById("newOrderRecord").addEventListener("click", () => openForm(modules.pedidos));
  document.querySelectorAll("[data-edit-order]").forEach(btn => btn.addEventListener("click", () => openForm(modules.pedidos, rows.find(row => row.id === btn.dataset.editOrder))));
  document.querySelectorAll("[data-payment-order]").forEach(btn => btn.addEventListener("click", () => openPaymentForm(rows.find(row => row.id === btn.dataset.paymentOrder))));
  document.querySelectorAll("[data-del-order]").forEach(btn => btn.addEventListener("click", () => softDelete("pedidos", btn.dataset.delOrder)));
  document.querySelectorAll("[data-production-order]").forEach(btn => btn.addEventListener("click", () => generateProductionFromOrder(rows.find(row => row.id === btn.dataset.productionOrder))));
}

if (typeof renderClientesProfessional === "function") renderClientesProfessional = renderClientesWithWhatsApp;
if (typeof renderOrcamentos === "function") renderOrcamentos = renderOrcamentosWithWhatsApp;
if (typeof renderPedidosProfessional === "function") renderPedidosProfessional = renderPedidosWithWhatsApp;

if (typeof openClientProfile === "function") {
  const g3dPreviousOpenClientProfile = openClientProfile;
  openClientProfile = function openClientProfileWithWhatsApp(client = {}) {
    g3dPreviousOpenClientProfile(client);
    const headerActions = document.querySelector(".client-profile-head .actions");
    if (!headerActions || headerActions.querySelector(".whatsapp-btn")) return;
    headerActions.insertAdjacentHTML("afterbegin", g3dWhatsAppButton(client, "btn whatsapp-btn"));
  };
}
