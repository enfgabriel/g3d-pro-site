function selectedStockIdFromForm(form) {
  return form?.estoque_ref?.value || form?.estoque_id?.value || "";
}

function ensureBudgetStockTracking(form) {
  if (!form || form.querySelector('input[name="estoque_id"]') || !form.estoque_ref) return;
  const hidden = document.createElement("input");
  hidden.type = "hidden";
  hidden.name = "estoque_id";
  hidden.value = form.estoque_ref.value || "";
  form.appendChild(hidden);
  const sync = () => { hidden.value = form.estoque_ref.value || ""; };
  form.estoque_ref.addEventListener("input", sync);
  form.estoque_ref.addEventListener("change", sync);
}

const inventoryPreviousOpenBudgetForm = openBudgetForm;
openBudgetForm = function openBudgetFormWithStockTracking(row = {}) {
  inventoryPreviousOpenBudgetForm(row);
  const form = document.getElementById("budgetForm");
  ensureBudgetStockTracking(form);
};

const inventoryPreviousGenerateOrderFromBudget = generateOrderFromBudget;
generateOrderFromBudget = async function generateOrderFromBudgetWithStock(row) {
  if (!row?.id) return inventoryPreviousGenerateOrderFromBudget(row);
  const existing = budgetOrderFor(row);
  if (existing) return inventoryPreviousGenerateOrderFromBudget(row);

  const stockId = row.estoque_id || "";
  if (!stockId) return inventoryPreviousGenerateOrderFromBudget(row);

  const client = budgetOrderClient(row);
  const orderPayload = {
    orcamento_id: row.id,
    cliente_id: row.cliente_id || null,
    estoque_id: stockId,
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
  if (error) return inventoryPreviousGenerateOrderFromBudget(row);

  const update = await supabaseClient.from("orcamentos").update({ status: "aprovado", pedido_id: data?.id || null }).eq("id", row.id);
  showToast(update.error ? `Pedido ${data?.numero || ""} criado, mas o orçamento não foi marcado como aprovado.` : `Pedido ${data?.numero || ""} criado com sucesso.`);
  await Promise.all([loadTable("pedidos"), loadTable("orcamentos")]);
  renderPage();
};

const inventoryPreviousGenerateProductionFromOrder = generateProductionFromOrder;
generateProductionFromOrder = async function generateProductionFromOrderWithStock(order) {
  if (!order?.id) return inventoryPreviousGenerateProductionFromOrder(order);
  const existing = productionForOrder(order);
  if (existing) return inventoryPreviousGenerateProductionFromOrder(order);

  const stockId = order.estoque_id || "";
  if (!stockId) return inventoryPreviousGenerateProductionFromOrder(order);

  const client = orderClient(order);
  const pieces = Number(order.quantidade_pecas || 1);
  const weight = Number(order.peso_g || 0);
  const productionPayload = {
    pedido_id: order.id,
    cliente_id: order.cliente_id || null,
    orcamento_id: order.orcamento_id || null,
    estoque_id: stockId,
    numero: productionNumberFromOrder(order),
    titulo: order.titulo || `Produção do pedido ${order.numero || ""}`,
    status: "fila",
    prioridade: order.prioridade || "Normal",
    material: order.material || "",
    cor: order.cor || "",
    peso_g: weight,
    quantidade_pecas: pieces,
    consumo_material_g: weight * Math.max(1, pieces),
    estoque_baixado: false,
    tempo_horas: Number(order.tempo_horas || 0),
    data_prevista: order.data_entrega || null,
    observacao: [
      order.numero ? `Gerado a partir do pedido ${order.numero}.` : "Gerado a partir de pedido.",
      client ? `Cliente: ${client.nome || client.empresa || ""}.` : "",
      order.prazo_entrega ? `Prazo comercial: ${order.prazo_entrega}.` : "",
      order.observacao || ""
    ].filter(Boolean).join("\n")
  };

  const { data, error } = await supabaseClient.from("producoes").insert(productionPayload).select("id, titulo").single();
  if (error) return inventoryPreviousGenerateProductionFromOrder(order);

  const update = await supabaseClient.from("pedidos").update({ status: "em produção", producao_id: data?.id || null }).eq("id", order.id);
  showToast(update.error ? "Produção criada, mas o pedido não foi marcado como em produção." : "Pedido enviado para produção.");
  await Promise.all([loadTable("pedidos"), loadTable("producoes")]);
  renderPage();
};

function stockForProduction(row) {
  if (!row?.estoque_id) return null;
  return (state.cache.estoque || []).find(item => item.id === row.estoque_id) || null;
}

function productionConsumption(row) {
  const explicit = Number(row.consumo_material_g || 0);
  if (explicit > 0) return explicit;
  return Number(row.peso_g || 0) * Math.max(1, Number(row.quantidade_pecas || 1));
}

async function finishProductionAndConsumeStock(row) {
  if (!row?.id) return;
  if (row.estoque_baixado) {
    showToast("Estoque já foi baixado para esta produção.");
    return;
  }
  const stock = stockForProduction(row);
  if (!stock) {
    showToast("Produção sem material de estoque vinculado.");
    return;
  }
  const consumo = productionConsumption(row);
  if (consumo <= 0) {
    showToast("Informe o consumo de material antes de baixar o estoque.");
    return;
  }

  const remaining = Math.max(0, stockRemaining(stock) - consumo);
  const gramCost = stockGramCost(stock);
  const stockUpdate = {
    peso_restante_g: remaining,
    quantidade: remaining,
    valor_atual: remaining * gramCost,
    status: remaining <= 0 ? "esgotado" : stock.status || "disponivel"
  };
  const stockResult = await supabaseClient.from("estoque").update(stockUpdate).eq("id", stock.id);
  if (stockResult.error) return showToast(stockResult.error.message);

  const productionResult = await supabaseClient.from("producoes").update({
    status: "pronto",
    consumo_material_g: consumo,
    estoque_baixado: true,
    estoque_baixado_em: new Date().toISOString()
  }).eq("id", row.id);
  if (productionResult.error) return showToast(productionResult.error.message);

  if (row.pedido_id) await supabaseClient.from("pedidos").update({ status: "finalizado" }).eq("id", row.pedido_id);
  showToast(`Produção finalizada e ${consumo.toLocaleString("pt-BR")} g/ml baixados do estoque.`);
  await Promise.all([loadTable("estoque"), loadTable("pedidos"), loadTable("producoes")]);
  renderPage();
}

renderProducoesProfessional = function renderProducoesWithInventory(el) {
  const rows = state.cache.producoes || [];
  const active = rows.filter(row => !["pronto", "entregue", "finalizado", "cancelado"].includes(String(row.status || "").toLowerCase())).length;
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Produção</h1><p class="muted">Fila de impressão com baixa automática de material.</p></div>
      <button class="btn primary" id="newProductionRecord">Nova produção</button>
    </div>
    <div class="grid production-summary">
      <div class="stat"><span>Itens na fila</span><strong>${rows.length}</strong></div>
      <div class="stat"><span>Em andamento</span><strong>${active}</strong></div>
      <div class="stat"><span>Com estoque baixado</span><strong>${rows.filter(row => row.estoque_baixado).length}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produção</th><th>Status</th><th>Material</th><th>Consumo</th><th>Estoque</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => {
            const stock = stockForProduction(row);
            return `<tr>
              <td><strong>${escapeHtml(row.numero || row.titulo || "")}</strong><div class="muted small">${escapeHtml(row.titulo || "")}</div></td>
              <td><span class="badge ${productionStatusBadgeClass(row.status)}">${escapeHtml(row.status || "fila")}</span></td>
              <td>${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</td>
              <td>${productionConsumption(row).toLocaleString("pt-BR")} g/ml</td>
              <td>${row.estoque_baixado ? `<span class="badge good">Baixado</span>` : stock ? `<span class="badge blue">Vinculado</span>` : `<span class="badge warn">Sem vínculo</span>`}</td>
              <td><div class="actions">
                <button class="btn" data-edit-production="${row.id}">Editar</button>
                <button class="btn primary" data-finish-production="${row.id}" ${row.estoque_baixado ? "disabled" : ""}>${row.estoque_baixado ? "Finalizada" : "Finalizar e baixar"}</button>
                <button class="btn danger" data-del-production="${row.id}">Excluir</button>
              </div></td>
            </tr>`;
          }).join("") : `<tr><td colspan="6" class="empty">Nenhuma produção ainda.</td></tr>`}
        </tbody>
      </table>
    </div>`;

  document.getElementById("newProductionRecord").addEventListener("click", () => openForm(modules.producoes));
  document.querySelectorAll("[data-edit-production]").forEach(btn => btn.addEventListener("click", () => openForm(modules.producoes, rows.find(row => row.id === btn.dataset.editProduction))));
  document.querySelectorAll("[data-del-production]").forEach(btn => btn.addEventListener("click", () => softDelete("producoes", btn.dataset.delProduction)));
  document.querySelectorAll("[data-finish-production]").forEach(btn => btn.addEventListener("click", () => finishProductionAndConsumeStock(rows.find(row => row.id === btn.dataset.finishProduction))));
};
