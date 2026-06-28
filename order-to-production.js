function productionForOrder(order) {
  if (!order?.id) return null;
  return (state.cache.producoes || []).find(item => item.pedido_id === order.id || item.id === order.producao_id) || null;
}

function orderClient(order) {
  if (!order?.cliente_id) return null;
  return (state.cache.clientes || []).find(client => client.id === order.cliente_id) || null;
}

function orderStatusBadgeClass(status) {
  const normalized = String(status || "novo").toLowerCase();
  if (["novo", "em aberto"].includes(normalized)) return "blue";
  if (["em produção", "producao", "produção"].includes(normalized)) return "warn";
  if (["finalizado", "entregue", "concluido", "concluído"].includes(normalized)) return "good";
  if (["cancelado"].includes(normalized)) return "danger";
  return "blue";
}

function productionStatusBadgeClass(status) {
  const normalized = String(status || "fila").toLowerCase();
  if (["fila", "aguardando"].includes(normalized)) return "blue";
  if (["imprimindo", "em produção", "pos", "pós-processamento"].includes(normalized)) return "warn";
  if (["pronto", "entregue", "finalizado"].includes(normalized)) return "good";
  if (["pausado", "falha", "cancelado"].includes(normalized)) return "danger";
  return "blue";
}

function renderPedidosProfessional(el) {
  const rows = state.cache.pedidos || [];
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Pedidos</h1><p class="muted">Pedidos aprovados com envio direto para a fila de produção.</p></div>
      <button class="btn primary" id="newOrderRecord">Novo pedido</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Número</th><th>Pedido</th><th>Status</th><th>Valor</th><th>Produção</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => {
            const prod = productionForOrder(row);
            return `<tr>
              <td>${escapeHtml(row.numero || "")}</td>
              <td><strong>${escapeHtml(row.titulo || "")}</strong><div class="muted small">${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</div></td>
              <td><span class="badge ${orderStatusBadgeClass(row.status)}">${escapeHtml(row.status || "novo")}</span></td>
              <td>${money(row.valor)}</td>
              <td>${prod ? `<span class="badge ${productionStatusBadgeClass(prod.status)}">${escapeHtml(prod.status || "fila")}</span>` : `<span class="badge">Não enviada</span>`}</td>
              <td><div class="actions">
                <button class="btn" data-edit-order="${row.id}">Editar</button>
                <button class="btn primary" data-production-order="${row.id}" ${prod ? "disabled" : ""}>${prod ? "Na produção" : "Enviar produção"}</button>
                <button class="btn danger" data-del-order="${row.id}">Excluir</button>
              </div></td>
            </tr>`;
          }).join("") : `<tr><td colspan="6" class="empty">Nenhum pedido ainda.</td></tr>`}
        </tbody>
      </table>
    </div>`;

  document.getElementById("newOrderRecord").addEventListener("click", () => openForm(modules.pedidos));
  document.querySelectorAll("[data-edit-order]").forEach(btn => btn.addEventListener("click", () => openForm(modules.pedidos, rows.find(row => row.id === btn.dataset.editOrder))));
  document.querySelectorAll("[data-del-order]").forEach(btn => btn.addEventListener("click", () => softDelete("pedidos", btn.dataset.delOrder)));
  document.querySelectorAll("[data-production-order]").forEach(btn => btn.addEventListener("click", () => generateProductionFromOrder(rows.find(row => row.id === btn.dataset.productionOrder))));
}

function productionNumberFromOrder(order) {
  const base = String(order.numero || nextNumber("PED", state.cache.pedidos.length)).replace(/^PED/i, "PROD");
  return base.startsWith("PROD") ? base : nextNumber("PROD", state.cache.producoes.length);
}

async function generateProductionFromOrder(order) {
  if (!order?.id) return;
  const existing = productionForOrder(order);
  if (existing) {
    showToast(`Este pedido já está na produção: ${existing.titulo || ""}.`);
    return;
  }

  const client = orderClient(order);
  const productionPayload = {
    pedido_id: order.id,
    cliente_id: order.cliente_id || null,
    orcamento_id: order.orcamento_id || null,
    numero: productionNumberFromOrder(order),
    titulo: order.titulo || `Produção do pedido ${order.numero || ""}`,
    status: "fila",
    prioridade: order.prioridade || "Normal",
    material: order.material || "",
    cor: order.cor || "",
    peso_g: Number(order.peso_g || 0),
    quantidade_pecas: Number(order.quantidade_pecas || 1),
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
  if (error) {
    const text = String(error.message || "").toLowerCase();
    if (text.includes("schema cache") || text.includes("pedido_id") || text.includes("cliente_id") || text.includes("orcamento_id")) {
      showToast("Falta atualizar o banco para vincular pedido e produção. Recarregue e tente novamente.");
      return;
    }
    showToast(error.message);
    return;
  }

  const updatePayload = { status: "em produção", producao_id: data?.id || null };
  const update = await supabaseClient.from("pedidos").update(updatePayload).eq("id", order.id);
  if (update.error) {
    showToast("Produção criada, mas o pedido não foi marcado como em produção.");
  } else {
    showToast("Pedido enviado para produção.");
  }

  await Promise.all([loadTable("pedidos"), loadTable("producoes")]);
  renderPage();
}

function renderProducoesProfessional(el) {
  const rows = state.cache.producoes || [];
  const active = rows.filter(row => !["pronto", "entregue", "finalizado", "cancelado"].includes(String(row.status || "").toLowerCase())).length;
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Produção</h1><p class="muted">Fila de impressão, pós-processamento e entrega.</p></div>
      <button class="btn primary" id="newProductionRecord">Nova produção</button>
    </div>
    <div class="grid production-summary">
      <div class="stat"><span>Itens na fila</span><strong>${rows.length}</strong></div>
      <div class="stat"><span>Em andamento</span><strong>${active}</strong></div>
      <div class="stat"><span>Prontos/entregues</span><strong>${rows.length - active}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produção</th><th>Status</th><th>Material</th><th>Qtd.</th><th>Previsão</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => `<tr>
            <td><strong>${escapeHtml(row.numero || row.titulo || "")}</strong><div class="muted small">${escapeHtml(row.titulo || "")}</div></td>
            <td><span class="badge ${productionStatusBadgeClass(row.status)}">${escapeHtml(row.status || "fila")}</span></td>
            <td>${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</td>
            <td>${escapeHtml(row.quantidade_pecas || 1)}</td>
            <td>${escapeHtml(row.data_prevista || "A combinar")}</td>
            <td><div class="actions"><button class="btn" data-edit-production="${row.id}">Editar</button><button class="btn danger" data-del-production="${row.id}">Excluir</button></div></td>
          </tr>`).join("") : `<tr><td colspan="6" class="empty">Nenhuma produção ainda.</td></tr>`}
        </tbody>
      </table>
    </div>`;

  document.getElementById("newProductionRecord").addEventListener("click", () => openForm(modules.producoes));
  document.querySelectorAll("[data-edit-production]").forEach(btn => btn.addEventListener("click", () => openForm(modules.producoes, rows.find(row => row.id === btn.dataset.editProduction))));
  document.querySelectorAll("[data-del-production]").forEach(btn => btn.addEventListener("click", () => softDelete("producoes", btn.dataset.delProduction)));
}

const productionPreviousRenderPage = renderPage;
renderPage = function renderPageWithProductionWorkflow() {
  const el = document.getElementById("content");
  if (state.page === "pedidos" && el) return renderPedidosProfessional(el);
  if (state.page === "producao" && el) return renderProducoesProfessional(el);
  return productionPreviousRenderPage();
};
