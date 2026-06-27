function stockBudgetOptions() {
  return (state.cache.estoque || []).filter(item => {
    const text = `${item.nome || ""} ${item.categoria || ""} ${item.material || ""}`.toLowerCase();
    return !item.deleted_at && (text.includes("filamento") || text.includes("resina") || item.custo_grama || item.material);
  });
}

function findStockForBudget(payload) {
  const stockId = payload.estoque_ref;
  if (!stockId) return null;
  return (state.cache.estoque || []).find(item => item.id === stockId) || null;
}

function budgetMaterialCost(payload) {
  const stock = findStockForBudget(payload);
  const params = state.cache.parametros || defaultParams();
  const gramCost = Number(stock?.custo_grama || payload.custo_grama || params.custo_grama_padrao || 0);
  return {
    stock,
    gramCost,
    materialName: stock?.material || payload.material || "PLA",
    colorName: stock?.cor || payload.cor || "",
    materialTotal: Number(payload.peso_g || 0) * gramCost
  };
}

calculatePrice = function calculatePriceSmart(item) {
  const p = state.cache.parametros || defaultParams();
  const material = budgetMaterialCost(item).materialTotal;
  const energia = Number(item.horas || 0) * Number(p.consumo_kw_hora || 0) * Number(p.custo_kwh || 0);
  const maquina = Number(item.horas || 0) * Number(p.custo_hora_maquina || 0);
  const pos = Number(item.pos_horas || 0) * Number(p.pos_processamento_hora || 0);
  const embalagem = Number(p.embalagem_padrao || 0);
  const base = material + energia + maquina + pos + embalagem;
  const total = base * (1 + Number(p.margem_percentual || 0) / 100);
  return Math.max(Number(p.taxa_minima || 0), total);
};

function budgetBreakdown(payload) {
  const p = state.cache.parametros || defaultParams();
  const materialInfo = budgetMaterialCost(payload);
  const energia = Number(payload.horas || 0) * Number(p.consumo_kw_hora || 0) * Number(p.custo_kwh || 0);
  const maquina = Number(payload.horas || 0) * Number(p.custo_hora_maquina || 0);
  const pos = Number(payload.pos_horas || 0) * Number(p.pos_processamento_hora || 0);
  const embalagem = Number(p.embalagem_padrao || 0);
  const base = materialInfo.materialTotal + energia + maquina + pos + embalagem;
  const margem = base * Number(p.margem_percentual || 0) / 100;
  const total = Math.max(Number(p.taxa_minima || 0), base + margem);
  return { materialInfo, energia, maquina, pos, embalagem, base, margem, total };
}

openBudgetForm = function openBudgetFormSmart(row = {}) {
  const stockItems = stockBudgetOptions();
  const currentStock = stockItems.find(item => item.material === row.material && item.cor === row.cor) || null;
  const value = Number(row.total || calculatePrice(row)).toFixed(2);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal" id="budgetForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} orçamento</strong><button class="btn" type="button" id="closeBudget">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Número</label><input name="numero" value="${escapeHtml(row.numero || nextNumber("ORC", state.cache.orcamentos.length))}" /></div>
          <div class="field"><label>Status</label><input name="status" value="${escapeHtml(row.status || "rascunho")}" /></div>
          <div class="field span-2"><label>Projeto</label><input name="projeto" value="${escapeHtml(row.projeto || "")}" required /></div>

          <div class="field span-2"><label>Filamento/resina do estoque</label><select name="estoque_ref" id="budgetStock"><option value="">Usar custo padrão dos parâmetros</option>${stockItems.map(item => `<option value="${escapeHtml(item.id)}" ${currentStock?.id === item.id ? "selected" : ""}>${escapeHtml([item.nome, item.material, item.cor].filter(Boolean).join(" - "))} (${money(item.custo_grama || 0)}/g)</option>`).join("")}</select></div>
          <div class="field"><label>Material</label><input name="material" value="${escapeHtml(row.material || currentStock?.material || "PLA")}" /></div>
          <div class="field"><label>Cor</label><input name="cor" value="${escapeHtml(row.cor || currentStock?.cor || "")}" placeholder="Em breve: seletor visual" /></div>
          <div class="field"><label>Peso g/ml</label><input type="number" step="0.01" name="peso_g" value="${escapeHtml(row.peso_g || 0)}" /></div>
          <div class="field"><label>Tempo h</label><input type="number" step="0.01" name="horas" value="${escapeHtml(row.horas || 0)}" /></div>
          <div class="field"><label>Pós-processamento h</label><input type="number" step="0.01" name="pos_horas" value="${escapeHtml(row.pos_horas || 0)}" /></div>
          <div class="field"><label>Total</label><input type="number" step="0.01" name="total" value="${escapeHtml(value)}" /></div>
          <div class="calc-box span-2 budget-breakdown" id="calcBox">Preencha peso e tempo para calcular automaticamente.</div>
          <div class="field span-2"><label>Observações</label><textarea name="observacao">${escapeHtml(row.observacao || "")}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelBudget">Cancelar</button><button class="btn primary" type="submit">Salvar orçamento</button></div>
    </form>`;
  document.body.appendChild(backdrop);

  const form = document.getElementById("budgetForm");
  const close = () => backdrop.remove();
  const syncStock = () => {
    const stock = findStockForBudget(Object.fromEntries(new FormData(form).entries()));
    if (!stock) return;
    form.material.value = stock.material || stock.nome || form.material.value;
    form.cor.value = stock.cor || form.cor.value;
  };
  const recalc = () => {
    const payload = Object.fromEntries(new FormData(form).entries());
    const b = budgetBreakdown(payload);
    form.total.value = b.total.toFixed(2);
    document.getElementById("calcBox").innerHTML = `
      <strong>Valor sugerido: ${money(b.total)}</strong>
      <span>Material: ${money(b.materialInfo.materialTotal)} (${money(b.materialInfo.gramCost)}/g) | Máquina: ${money(b.maquina)} | Energia: ${money(b.energia)} | Pós: ${money(b.pos)} | Embalagem: ${money(b.embalagem)} | Margem: ${money(b.margem)}</span>
    `;
  };

  ["estoque_ref", "peso_g", "horas", "pos_horas", "material", "cor"].forEach(name => {
    form[name]?.addEventListener("input", () => { if (name === "estoque_ref") syncStock(); recalc(); });
    form[name]?.addEventListener("change", () => { if (name === "estoque_ref") syncStock(); recalc(); });
  });
  document.getElementById("closeBudget").addEventListener("click", close);
  document.getElementById("cancelBudget").addEventListener("click", close);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    delete payload.estoque_ref;
    ["peso_g", "horas", "pos_horas", "total"].forEach(k => payload[k] = Number(payload[k] || 0));
    await saveRecord("orcamentos", payload, row.id);
    close();
  });
  syncStock();
  recalc();
};
