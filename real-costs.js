function realCostNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function realCostPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function realCostSafe(value) {
  return escapeHtml(value || "");
}

function realCostParams() {
  return state.cache.parametros || (typeof defaultParams === "function" ? defaultParams() : {});
}

function realCostProduction(order) {
  if (typeof productionForOrder === "function") return productionForOrder(order);
  return (state.cache.producoes || []).find(item => item.pedido_id === order.id) || null;
}

function realCostBudget(order, production) {
  const budgetId = order?.orcamento_id || production?.orcamento_id || "";
  if (!budgetId) return null;
  return (state.cache.orcamentos || []).find(item => item.id === budgetId) || null;
}

function realCostStock(order, production, budget) {
  const stockId = production?.estoque_id || order?.estoque_id || budget?.estoque_id || "";
  if (!stockId) return null;
  return (state.cache.estoque || []).find(item => item.id === stockId) || null;
}

function realCostGramCost(stock, params) {
  if (stock && typeof stockGramCost === "function") return realCostNumber(stockGramCost(stock), 0);
  return realCostNumber(stock?.custo_grama || stock?.preco_grama || params.custo_grama_padrao, 0);
}

function realCostConsumption(order, production, budget) {
  if (production && typeof productionConsumption === "function") return realCostNumber(productionConsumption(production), 0);
  const explicit = realCostNumber(production?.consumo_material_g || order?.consumo_material_g || 0, 0);
  if (explicit > 0) return explicit;
  const weight = realCostNumber(production?.peso_g || order?.peso_g || budget?.peso_g || 0, 0);
  const pieces = Math.max(1, realCostNumber(production?.quantidade_pecas || order?.quantidade_pecas || budget?.quantidade_pecas || 1, 1));
  return weight * pieces;
}

function realCostHours(order, production, budget) {
  return realCostNumber(production?.tempo_horas || order?.tempo_horas || budget?.horas || 0, 0);
}

function realCostPostHours(order, production, budget) {
  return realCostNumber(production?.pos_horas || order?.pos_horas || budget?.pos_horas || 0, 0);
}

function realCostBreakdown(order) {
  const production = realCostProduction(order);
  const budget = realCostBudget(order, production);
  const stock = realCostStock(order, production, budget);
  const params = realCostParams();
  const sale = typeof financeOrderTotal === "function" ? financeOrderTotal(order) : realCostNumber(order.valor || order.total, 0);
  const budgetTotal = realCostNumber(budget?.total || 0, 0);
  const consumption = realCostConsumption(order, production, budget);
  const hours = realCostHours(order, production, budget);
  const postHours = realCostPostHours(order, production, budget);
  const gramCost = realCostGramCost(stock, params);
  const materialCost = consumption * gramCost;
  const energyCost = hours * realCostNumber(params.consumo_kw_hora, 0) * realCostNumber(params.custo_kwh, 0);
  const machineCost = hours * realCostNumber(params.custo_hora_maquina, 0);
  const postCost = postHours * realCostNumber(params.pos_processamento_hora, 0);
  const packagingCost = realCostNumber(params.embalagem_padrao, 0);
  const realCost = materialCost + energyCost + machineCost + postCost + packagingCost;
  const margin = sale - realCost;
  const marginPct = sale > 0 ? (margin / sale) * 100 : 0;
  const expectedMargin = budgetTotal > 0 ? sale - budgetTotal : 0;
  const stage = production ? (typeof productionStageLabel === "function" ? productionStageLabel(production.status || production.etapa_atual || "fila") : production.status || "Fila") : "Sem produção";

  return {
    order,
    production,
    budget,
    stock,
    params,
    sale,
    budgetTotal,
    consumption,
    hours,
    postHours,
    gramCost,
    materialCost,
    energyCost,
    machineCost,
    postCost,
    packagingCost,
    realCost,
    margin,
    marginPct,
    expectedMargin,
    stage
  };
}

function realCostBadgeClass(cost) {
  if (cost.marginPct >= 35) return "good";
  if (cost.marginPct >= 15) return "blue";
  if (cost.marginPct >= 0) return "warn";
  return "danger";
}

function realCostSummary(rows) {
  const costs = rows.map(realCostBreakdown);
  const revenue = costs.reduce((sum, item) => sum + item.sale, 0);
  const cost = costs.reduce((sum, item) => sum + item.realCost, 0);
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  const negative = costs.filter(item => item.margin < 0).length;
  const withoutProduction = costs.filter(item => !item.production).length;
  return { costs, revenue, cost, margin, marginPct, negative, withoutProduction };
}

function realCostSummaryHtml(rows) {
  const summary = realCostSummary(rows);
  return `
    <section class="card real-cost-panel" id="realCostPanel">
      <div class="section-head">
        <div><h2>Margem real dos pedidos</h2><p class="muted">Comparação automática entre valor vendido e custo operacional estimado pela produção.</p></div>
      </div>
      <div class="grid real-cost-summary">
        <div class="stat"><span>Receita analisada</span><strong>${money(summary.revenue)}</strong></div>
        <div class="stat"><span>Custo real estimado</span><strong>${money(summary.cost)}</strong></div>
        <div class="stat"><span>Margem final</span><strong>${money(summary.margin)}</strong></div>
        <div class="stat"><span>Margem média</span><strong>${realCostPercent(summary.marginPct)}</strong></div>
      </div>
      <div class="real-cost-alerts">
        <span class="badge ${summary.negative ? "danger" : "good"}">${summary.negative} pedido(s) com margem negativa</span>
        <span class="badge ${summary.withoutProduction ? "warn" : "good"}">${summary.withoutProduction} pedido(s) sem produção vinculada</span>
      </div>
    </section>`;
}

function attachRealCostSummaryPanel(el) {
  if (!el || el.querySelector("#realCostPanel")) return;
  const summary = el.querySelector(".finance-summary");
  const panelWrapper = document.createElement("div");
  panelWrapper.innerHTML = realCostSummaryHtml(state.cache.pedidos || []);
  if (summary) summary.insertAdjacentElement("afterend", panelWrapper.firstElementChild);
  else el.prepend(panelWrapper.firstElementChild);
}

function realCostDetailsHtml(cost) {
  const source = cost.stock ? `${cost.stock.nome || cost.stock.material || "Estoque"} · ${[cost.stock.material, cost.stock.cor].filter(Boolean).join(" - ")}` : "Parâmetro padrão";
  return `
    <div class="real-cost-head">
      <div><span>Valor vendido</span><strong>${money(cost.sale)}</strong></div>
      <div><span>Custo real estimado</span><strong>${money(cost.realCost)}</strong></div>
      <div><span>Margem final</span><strong class="${cost.margin < 0 ? "danger-text" : "good-text"}">${money(cost.margin)} · ${realCostPercent(cost.marginPct)}</strong></div>
    </div>
    <div class="real-cost-detail-grid">
      <div><span>Material consumido</span><strong>${cost.consumption.toLocaleString("pt-BR")} g/ml</strong><small>${money(cost.materialCost)} · ${money(cost.gramCost)} por g/ml</small></div>
      <div><span>Tempo de máquina</span><strong>${cost.hours.toLocaleString("pt-BR")} h</strong><small>${money(cost.machineCost)} de máquina + ${money(cost.energyCost)} energia</small></div>
      <div><span>Pós-processamento</span><strong>${cost.postHours.toLocaleString("pt-BR")} h</strong><small>${money(cost.postCost)}</small></div>
      <div><span>Embalagem/padrão</span><strong>${money(cost.packagingCost)}</strong><small>Parâmetros do usuário</small></div>
      <div><span>Produção</span><strong>${realCostSafe(cost.production?.numero || cost.production?.titulo || "Não vinculada")}</strong><small>${realCostSafe(cost.stage)}</small></div>
      <div><span>Base do material</span><strong>${realCostSafe(source)}</strong><small>${cost.stock ? "Custo vindo do estoque" : "Usando custo padrão por grama"}</small></div>
    </div>
    <div class="real-cost-formula">
      <strong>Fórmula usada</strong>
      <p class="muted">Material + energia + hora de máquina + pós-processamento + embalagem. A margem é calculada sobre o valor vendido do pedido.</p>
    </div>`;
}

function openRealCostModal(order) {
  if (!order) return;
  const cost = realCostBreakdown(order);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal real-cost-modal">
      <div class="modal-head"><strong>Custo real do pedido ${realCostSafe(order.numero || "")}</strong><button class="btn" type="button" id="closeRealCost">Fechar</button></div>
      <div class="modal-body">
        <p class="muted">${realCostSafe(order.titulo || "Pedido")}</p>
        ${realCostDetailsHtml(cost)}
      </div>
      <div class="modal-foot"><button class="btn primary" type="button" id="okRealCost">Entendi</button></div>
    </div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closeRealCost").addEventListener("click", close);
  document.getElementById("okRealCost").addEventListener("click", close);
}

function attachRealCostButtons(el) {
  if (!el) return;
  const rows = state.cache.pedidos || [];
  el.querySelectorAll("[data-payment-order]").forEach(button => {
    const orderId = button.dataset.paymentOrder;
    const actions = button.closest(".actions");
    if (!actions || actions.querySelector(`[data-real-cost-order="${orderId}"]`)) return;
    const order = rows.find(row => row.id === orderId);
    const cost = order ? realCostBreakdown(order) : null;
    const costButton = document.createElement("button");
    costButton.className = `btn ${cost ? realCostBadgeClass(cost) : ""}`.trim();
    costButton.type = "button";
    costButton.dataset.realCostOrder = orderId;
    costButton.textContent = "Custo real";
    costButton.addEventListener("click", () => openRealCostModal(rows.find(row => row.id === orderId)));
    button.insertAdjacentElement("afterend", costButton);
  });
}

window.openRealCostModal = openRealCostModal;
window.realCostBreakdown = realCostBreakdown;

if (typeof renderPedidosProfessional === "function") {
  const realCostPreviousRenderPedidosProfessional = renderPedidosProfessional;
  renderPedidosProfessional = function renderPedidosProfessionalWithRealCosts(el) {
    realCostPreviousRenderPedidosProfessional(el);
    attachRealCostSummaryPanel(el);
    attachRealCostButtons(el);
  };
}
