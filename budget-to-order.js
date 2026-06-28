function budgetOrderFor(row) {
  if (!row?.id) return null;
  return (state.cache.pedidos || []).find(order => order.orcamento_id === row.id || order.id === row.pedido_id) || null;
}

function budgetOrderClient(row) {
  if (!row?.cliente_id) return null;
  return (state.cache.clientes || []).find(client => client.id === row.cliente_id) || null;
}

function orderNumberFromBudget(row) {
  const base = String(row.numero || nextNumber("ORC", state.cache.orcamentos.length)).replace(/^ORC/i, "PED");
  return base.startsWith("PED") ? base : nextNumber("PED", state.cache.pedidos.length);
}

function budgetStatusBadgeClass(status) {
  const normalized = String(status || "rascunho").toLowerCase();
  if (normalized === "aprovado") return "good";
  if (normalized === "enviado") return "blue";
  if (normalized === "recusado" || normalized === "cancelado") return "danger";
  return "warn";
}

renderOrcamentos = function renderOrcamentosWithOrder(el) {
  const rows = state.cache.orcamentos || [];
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Orçamentos</h1><p class="muted">Propostas comerciais que podem virar pedidos automaticamente.</p></div>
      <button class="btn primary" id="newBudget">Novo orçamento</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Número</th><th>Projeto</th><th>Status</th><th>Total</th><th>Pedido</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => {
            const order = budgetOrderFor(row);
            return `<tr>
              <td>${escapeHtml(row.numero || "")}</td>
              <td>${escapeHtml(row.projeto || "")}</td>
              <td><span class="badge ${budgetStatusBadgeClass(row.status)}">${escapeHtml(row.status || "rascunho")}</span></td>
              <td>${money(row.total)}</td>
              <td>${order ? `<span class="badge good">${escapeHtml(order.numero || "Gerado")}</span>` : `<span class="badge">Pendente</span>`}</td>
              <td><div class="actions">
                <button class="btn" data-edit-budget="${row.id}">Editar</button>
                <button class="btn" data-pdf-budget="${row.id}">PDF</button>
                <button class="btn primary" data-order-budget="${row.id}" ${order ? "disabled" : ""}>${order ? "Pedido gerado" : "Gerar pedido"}</button>
                <button class="btn danger" data-del-budget="${row.id}">Excluir</button>
              </div></td>
            </tr>`;
          }).join("") : `<tr><td colspan="6" class="empty">Nenhum orçamento ainda.</td></tr>`}
        </tbody>
      </table>
    </div>`;

  document.getElementById("newBudget").addEventListener("click", () => openBudgetForm());
  document.querySelectorAll("[data-edit-budget]").forEach(btn => btn.addEventListener("click", () => openBudgetForm(rows.find(row => row.id === btn.dataset.editBudget))));
  document.querySelectorAll("[data-del-budget]").forEach(btn => btn.addEventListener("click", () => softDelete("orcamentos", btn.dataset.delBudget)));
  document.querySelectorAll("[data-pdf-budget]").forEach(btn => btn.addEventListener("click", () => openBudgetPdf(rows.find(row => row.id === btn.dataset.pdfBudget))));
  document.querySelectorAll("[data-order-budget]").forEach(btn => btn.addEventListener("click", () => generateOrderFromBudget(rows.find(row => row.id === btn.dataset.orderBudget))));
};

async function generateOrderFromBudget(row) {
  if (!row?.id) return;
  const existing = budgetOrderFor(row);
  if (existing) {
    showToast(`Este orçamento já gerou o pedido ${existing.numero || ""}.`);
    return;
  }

  const client = budgetOrderClient(row);
  const orderPayload = {
    orcamento_id: row.id,
    cliente_id: row.cliente_id || null,
    numero: orderNumberFromBudget(row),
    titulo: row.projeto || `Pedido do orçamento ${row.numero || ""}`,
    status: "novo",
    prioridade: Number(row.urgencia_percentual || 0) > 0 ? "Alta" : "Normal",
    valor: Number(row.total || 0),
    material: row.material || "",
    cor: row.cor || "",
    peso_g: Number(row.peso_g || 0),
    quantidade_pecas: Number(row.quantidade_pecas || 1),
    prazo_entrega: row.prazo_entrega || "A combinar",
    observacao: [
      row.numero ? `Gerado a partir do orçamento ${row.numero}.` : "Gerado a partir de orçamento.",
      client ? `Cliente: ${client.nome || client.empresa || ""}.` : "",
      row.retirada_entrega ? `Entrega/retirada: ${row.retirada_entrega}.` : "",
      row.observacao || ""
    ].filter(Boolean).join("\n")
  };

  const { data, error } = await supabaseClient.from("pedidos").insert(orderPayload).select("id, numero").single();
  if (error) {
    const text = String(error.message || "").toLowerCase();
    if (text.includes("schema cache") || text.includes("orcamento_id") || text.includes("cliente_id")) {
      showToast("Falta atualizar o banco para vincular orçamento e pedido. Recarregue e tente novamente.");
      return;
    }
    showToast(error.message);
    return;
  }

  const updatePayload = { status: "aprovado", pedido_id: data?.id || null };
  const update = await supabaseClient.from("orcamentos").update(updatePayload).eq("id", row.id);
  if (update.error) {
    showToast(`Pedido ${data?.numero || ""} criado, mas o orçamento não foi marcado como aprovado.`);
  } else {
    showToast(`Pedido ${data?.numero || ""} criado com sucesso.`);
  }

  await Promise.all([loadTable("pedidos"), loadTable("orcamentos")]);
  renderPage();
}
