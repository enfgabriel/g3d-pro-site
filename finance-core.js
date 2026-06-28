const G3D_PAYMENT_STATUS = {
  pendente: { label: "Pendente", className: "warn" },
  sinal: { label: "Sinal pago", className: "blue" },
  pago: { label: "Pago", className: "good" },
  atrasado: { label: "Atrasado", className: "danger" },
  cancelado: { label: "Cancelado", className: "danger" }
};

function financeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function financeOrderTotal(row) {
  return financeNumber(row.valor || row.total, 0);
}

function financePaid(row) {
  return financeNumber(row.valor_pago, 0);
}

function financeRemaining(row) {
  return Math.max(0, financeOrderTotal(row) - financePaid(row));
}

function financeDueDays(row) {
  if (!row.vencimento_pagamento) return null;
  const due = new Date(row.vencimento_pagamento);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function financeStatusKey(row) {
  const total = financeOrderTotal(row);
  const paid = financePaid(row);
  const raw = String(row.status_pagamento || "").toLowerCase();
  if (raw === "cancelado") return "cancelado";
  if (total > 0 && paid >= total) return "pago";
  const days = financeDueDays(row);
  if (days !== null && days < 0 && paid < total) return "atrasado";
  if (paid > 0 && paid < total) return "sinal";
  return raw && G3D_PAYMENT_STATUS[raw] ? raw : "pendente";
}

function financeStatusInfo(row) {
  return G3D_PAYMENT_STATUS[financeStatusKey(row)] || G3D_PAYMENT_STATUS.pendente;
}

function paymentStatusOptions(current = "pendente") {
  return Object.entries(G3D_PAYMENT_STATUS).map(([value, info]) => `<option value="${value}" ${value === current ? "selected" : ""}>${info.label}</option>`).join("");
}

function paymentMethodOptions(current = "") {
  const options = [["", "Não informado"], ["cartao", "Cartão"], ["pix", "Pix manual"], ["dinheiro", "Dinheiro"], ["transferencia", "Transferência"], ["boleto", "Boleto"], ["outro", "Outro"]];
  return options.map(([value, label]) => `<option value="${value}" ${value === (current || "") ? "selected" : ""}>${label}</option>`).join("");
}

function financeDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function financeDueLabel(row) {
  const days = financeDueDays(row);
  if (days === null) return "Sem vencimento";
  if (days < 0) return `${Math.abs(days)} dia(s) atrasado`;
  if (days === 0) return "Vence hoje";
  return `Vence em ${days} dia(s)`;
}

function renderFinanceSummary(rows) {
  const received = rows.reduce((sum, row) => sum + financePaid(row), 0);
  const total = rows.reduce((sum, row) => sum + financeOrderTotal(row), 0);
  const remaining = rows.reduce((sum, row) => sum + financeRemaining(row), 0);
  const overdue = rows.filter(row => financeStatusKey(row) === "atrasado").length;
  return `
    <div class="grid finance-summary">
      <div class="stat"><span>Total vendido</span><strong>${money(total)}</strong></div>
      <div class="stat"><span>Recebido</span><strong>${money(received)}</strong></div>
      <div class="stat"><span>A receber</span><strong>${money(remaining)}</strong></div>
      <div class="stat"><span>Atrasados</span><strong>${overdue}</strong></div>
    </div>`;
}

function openPaymentForm(row = {}) {
  const total = financeOrderTotal(row);
  const paid = financePaid(row);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal finance-modal" id="paymentForm">
      <div class="modal-head"><strong>Pagamento do pedido ${escapeHtml(row.numero || "")}</strong><button class="btn" type="button" id="closePayment">Fechar</button></div>
      <div class="modal-body">
        <div class="finance-payment-head">
          <div><span>Total</span><strong>${money(total)}</strong></div>
          <div><span>Pago</span><strong>${money(paid)}</strong></div>
          <div><span>Restante</span><strong>${money(financeRemaining(row))}</strong></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Status</label><select name="status_pagamento">${paymentStatusOptions(financeStatusKey(row))}</select></div>
          <div class="field"><label>Forma de pagamento</label><select name="forma_pagamento">${paymentMethodOptions(row.forma_pagamento || "")}</select></div>
          <div class="field"><label>Valor pago</label><input type="number" step="0.01" name="valor_pago" value="${escapeHtml(paid)}" /></div>
          <div class="field"><label>Vencimento</label><input type="date" name="vencimento_pagamento" value="${escapeHtml(financeDateInput(row.vencimento_pagamento))}" /></div>
          <div class="field"><label>Pago em</label><input type="date" name="pago_em" value="${escapeHtml(financeDateInput(row.pago_em))}" /></div>
          <div class="field"><label>Valor do pedido</label><input type="number" step="0.01" name="valor" value="${escapeHtml(total)}" /></div>
          <div class="field span-2"><label>Observação financeira</label><textarea name="observacao_financeira">${escapeHtml(row.observacao_financeira || "")}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelPayment">Cancelar</button><button class="btn primary" type="submit">Salvar pagamento</button></div>
    </form>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closePayment").addEventListener("click", close);
  document.getElementById("cancelPayment").addEventListener("click", close);
  document.getElementById("paymentForm").addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    payload.valor = financeNumber(payload.valor, total);
    payload.valor_pago = financeNumber(payload.valor_pago, 0);
    if (payload.status_pagamento === "pago" && !payload.pago_em) payload.pago_em = new Date().toISOString();
    if (!payload.vencimento_pagamento) payload.vencimento_pagamento = null;
    if (!payload.pago_em) payload.pago_em = null;
    const cleanPayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
    const result = typeof g3dRunWithFreshSession === "function"
      ? await g3dRunWithFreshSession(() => supabaseClient.from("pedidos").update(cleanPayload).eq("id", row.id))
      : await supabaseClient.from("pedidos").update(cleanPayload).eq("id", row.id);
    if (result.error) {
      const text = String(result.error.message || "").toLowerCase();
      if (text.includes("schema cache") || text.includes("status_pagamento") || text.includes("valor_pago")) {
        showToast("Falta atualizar o banco para controlar financeiro. Recarregue e tente novamente.");
        return;
      }
      showToast(result.error.message);
      return;
    }
    showToast("Pagamento salvo.");
    close();
    await loadTable("pedidos");
    renderPage();
  });
}

renderPedidosProfessional = function renderPedidosWithFinance(el) {
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
            return `<tr>
              <td>${escapeHtml(row.numero || "")}</td>
              <td><strong>${escapeHtml(row.titulo || "")}</strong><div class="muted small">${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</div></td>
              <td><span class="badge ${orderStatusBadgeClass(row.status)}">${escapeHtml(row.status || "novo")}</span></td>
              <td><span class="badge ${pay.className}">${escapeHtml(pay.label)}</span><div class="muted small">${escapeHtml(financeDueLabel(row))}</div></td>
              <td><strong>${money(financeOrderTotal(row))}</strong><div class="muted small">Pago ${money(financePaid(row))} · Falta ${money(financeRemaining(row))}</div></td>
              <td>${prod ? `<span class="badge ${productionStatusBadgeClass(prod.status)}">${escapeHtml(prod.status || "fila")}</span>` : `<span class="badge">Não enviada</span>`}</td>
              <td><div class="actions finance-actions">
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
};
