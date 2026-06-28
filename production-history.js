async function loadProductionHistory() {
  state.cache.producao_historico = state.cache.producao_historico || [];
  const query = () => supabaseClient
    .from("producao_historico")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  const { data, error } = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(query) : await query();
  if (!error) state.cache.producao_historico = data || [];
}

function productionHistoryRows(productionId = "") {
  const rows = state.cache.producao_historico || [];
  return productionId ? rows.filter(row => row.producao_id === productionId) : rows;
}

function productionHistoryDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch (_error) {
    return value;
  }
}

function renderProductionHistoryPanel(rows = productionHistoryRows()) {
  const latest = rows.slice(0, 8);
  return `
    <div class="card production-history-panel">
      <div class="section-head">
        <div>
          <h2>Histórico de produção</h2>
          <p class="muted">Últimas baixas de estoque registradas automaticamente.</p>
        </div>
      </div>
      <div class="table-wrap compact-table">
        <table>
          <thead><tr><th>Data</th><th>Produção</th><th>Material</th><th>Consumo</th><th>Saldo</th></tr></thead>
          <tbody>
            ${latest.length ? latest.map(row => `<tr>
              <td>${escapeHtml(productionHistoryDate(row.created_at))}</td>
              <td>${escapeHtml(row.producao_numero || row.producao_titulo || "")}</td>
              <td>${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</td>
              <td>${Number(row.consumo_material_g || 0).toLocaleString("pt-BR")} g/ml</td>
              <td>${Number(row.saldo_anterior_g || 0).toLocaleString("pt-BR")} -> ${Number(row.saldo_novo_g || 0).toLocaleString("pt-BR")} g/ml</td>
            </tr>`).join("") : `<tr><td colspan="5" class="empty">Nenhuma baixa registrada ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

async function productionHistoryUserId() {
  if (typeof g3dEnsureFreshSession === "function") {
    const ready = await g3dEnsureFreshSession();
    return ready.session?.user?.id || null;
  }
  const { data } = await supabaseClient.auth.getSession();
  state.session = data?.session || state.session;
  return data?.session?.user?.id || state.session?.user?.id || null;
}

async function registerProductionHistory(row, stock, consumo, previousBalance, nextBalance) {
  const userId = await productionHistoryUserId();
  const payload = {
    producao_id: row.id,
    pedido_id: row.pedido_id || null,
    orcamento_id: row.orcamento_id || null,
    estoque_id: stock.id,
    tipo: "baixa_estoque",
    producao_numero: row.numero || "",
    producao_titulo: row.titulo || "",
    status_anterior: row.status || "fila",
    status_novo: "pronto",
    consumo_material_g: consumo,
    saldo_anterior_g: previousBalance,
    saldo_novo_g: nextBalance,
    material: row.material || stock.material || stock.nome || "",
    cor: row.cor || stock.cor || "",
    observacao: `Baixa automática da produção ${row.numero || row.titulo || ""}.`
  };
  if (userId) payload.user_id = userId;
  const cleanPayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
  const query = () => supabaseClient.from("producao_historico").insert(cleanPayload);
  return typeof g3dRunWithFreshSession === "function" ? g3dRunWithFreshSession(query) : query();
}

finishProductionAndConsumeStock = async function finishProductionAndConsumeStockWithHistory(row) {
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

  const previousBalance = stockRemaining(stock);
  const remaining = Math.max(0, previousBalance - consumo);
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

  const historyResult = await registerProductionHistory(row, stock, consumo, previousBalance, remaining);
  if (historyResult.error) {
    const text = String(historyResult.error.message || "");
    showToast(text ? `Histórico não registrado: ${text}` : "Produção finalizada, mas o histórico ainda precisa do ajuste do banco.");
  } else {
    showToast(`Produção finalizada: ${consumo.toLocaleString("pt-BR")} g/ml baixados e histórico registrado.`);
  }

  if (row.pedido_id) await supabaseClient.from("pedidos").update({ status: "finalizado" }).eq("id", row.pedido_id);
  await Promise.all([loadTable("estoque"), loadTable("pedidos"), loadTable("producoes"), loadProductionHistory()]);
  renderPage();
};

const historyPreviousRenderProducoesProfessional = renderProducoesProfessional;
renderProducoesProfessional = function renderProducoesWithHistory(el) {
  historyPreviousRenderProducoesProfessional(el);
  const historyWrapper = document.createElement("div");
  historyWrapper.innerHTML = renderProductionHistoryPanel();
  el.appendChild(historyWrapper.firstElementChild);
};

const historyPreviousLoadAll = loadAll;
loadAll = async function loadAllWithProductionHistory() {
  await historyPreviousLoadAll();
  await loadProductionHistory();
  renderPage();
};
