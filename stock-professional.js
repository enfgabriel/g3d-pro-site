const G3D_MATERIAL_OPTIONS = ["PLA", "PLA+", "PETG", "ABS", "ASA", "TPU", "Nylon", "PC", "Resina", "Outro"];

function materialOptionsHtml(current = "") {
  const normalized = String(current || "").trim();
  const hasPreset = G3D_MATERIAL_OPTIONS.includes(normalized);
  return G3D_MATERIAL_OPTIONS.map(item => `<option value="${escapeHtml(item)}" ${item === (hasPreset ? normalized : "Outro") ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function stockNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stockGramCost(item) {
  const manual = stockNumber(item.custo_grama, 0);
  if (manual > 0) return manual;
  const value = stockNumber(item.valor_compra || item.valor_atual, 0);
  const weight = stockNumber(item.peso_inicial_g || item.quantidade, 0);
  return value > 0 && weight > 0 ? value / weight : 0;
}

function stockRemaining(item) {
  return stockNumber(item.peso_restante_g || item.quantidade, 0);
}

function stockInitial(item) {
  return stockNumber(item.peso_inicial_g || item.quantidade, 0);
}

function stockStatus(item) {
  const remaining = stockRemaining(item);
  const minimum = stockNumber(item.quantidade_minima, 0);
  const initial = stockInitial(item);
  const percent = initial > 0 ? Math.max(0, Math.min(100, remaining / initial * 100)) : 0;
  if (remaining <= 0) return { label: "Esgotado", className: "danger", percent };
  if (minimum > 0 && remaining <= minimum) return { label: "Baixo", className: "warn", percent };
  return { label: "Disponível", className: "good", percent };
}

function stockMaterialLabel(row) {
  return [row.material, row.cor].filter(Boolean).join(" - ") || row.nome || "Material";
}

function renderStockProfessional(el) {
  const rows = state.cache.estoque || [];
  const critical = rows.filter(row => ["Baixo", "Esgotado"].includes(stockStatus(row).label)).length;
  const totalValue = rows.reduce((sum, row) => sum + stockRemaining(row) * stockGramCost(row), 0);
  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Estoque</h1>
        <p class="muted">Filamentos, resinas e insumos com custo por grama vinculado aos orçamentos.</p>
      </div>
      <button class="btn primary" id="newStockRecord">Novo material</button>
    </div>
    <div class="grid stock-summary">
      <div class="stat"><span>Materiais cadastrados</span><strong>${rows.length}</strong></div>
      <div class="stat"><span>Itens em alerta</span><strong>${critical}</strong></div>
      <div class="stat"><span>Valor estimado em estoque</span><strong>${money(totalValue)}</strong></div>
    </div>
    <div class="stock-list">
      ${rows.length ? rows.map(row => stockCardHtml(row)).join("") : `<div class="card empty">Nenhum material cadastrado ainda.</div>`}
    </div>`;

  document.getElementById("newStockRecord").addEventListener("click", () => openStockForm());
  document.querySelectorAll("[data-edit-stock]").forEach(btn => btn.addEventListener("click", () => openStockForm(rows.find(row => row.id === btn.dataset.editStock))));
  document.querySelectorAll("[data-del-stock]").forEach(btn => btn.addEventListener("click", () => softDelete("estoque", btn.dataset.delStock)));
}

function stockCardHtml(row) {
  const status = stockStatus(row);
  const gramCost = stockGramCost(row);
  const remaining = stockRemaining(row);
  const initial = stockInitial(row);
  const swatch = row.cor_hex ? `style="background:${escapeHtml(row.cor_hex)}"` : "";
  return `
    <article class="card stock-card">
      <div class="stock-main">
        <div class="stock-color-dot" ${swatch}></div>
        <div>
          <strong>${escapeHtml(row.nome || stockMaterialLabel(row))}</strong>
          <span>${escapeHtml(stockMaterialLabel(row))}</span>
        </div>
      </div>
      <div class="stock-metrics">
        <div><span>Restante</span><strong>${remaining.toLocaleString("pt-BR")} g/ml</strong></div>
        <div><span>Custo</span><strong>${money(gramCost)}/g</strong></div>
        <div><span>Fornecedor</span><strong>${escapeHtml(row.fornecedor || "-")}</strong></div>
      </div>
      <div class="stock-progress" aria-label="Uso do estoque"><span style="width:${status.percent}%"></span></div>
      <div class="stock-footer">
        <span class="badge ${status.className}">${status.label}</span>
        <span class="muted">Inicial: ${initial.toLocaleString("pt-BR")} g/ml · Mínimo: ${stockNumber(row.quantidade_minima, 0).toLocaleString("pt-BR")} g/ml</span>
        <div class="actions"><button class="btn" data-edit-stock="${row.id}">Editar</button><button class="btn danger" data-del-stock="${row.id}">Excluir</button></div>
      </div>
    </article>`;
}

function openStockForm(row = {}) {
  const gramCost = stockGramCost(row);
  const customMaterial = row.material && !G3D_MATERIAL_OPTIONS.includes(row.material) ? row.material : "";
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal stock-modal" id="stockForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} material</strong><button class="btn" type="button" id="closeStock">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field span-2"><label>Nome do item</label><input name="nome" value="${escapeHtml(row.nome || "")}" placeholder="Ex: PLA Preto 1kg - 3D Lab" required /></div>
          <div class="field"><label>Categoria</label><select name="categoria"><option value="Filamento" ${row.categoria === "Filamento" ? "selected" : ""}>Filamento</option><option value="Resina" ${row.categoria === "Resina" ? "selected" : ""}>Resina</option><option value="Insumo" ${row.categoria === "Insumo" ? "selected" : ""}>Insumo</option></select></div>
          <div class="field"><label>Material</label><select name="material_select" id="stockMaterialSelect">${materialOptionsHtml(row.material)}</select></div>
          <div class="field span-2" id="stockOtherMaterialField" style="${customMaterial ? "" : "display:none"}"><label>Outro material</label><input name="material_outro" value="${escapeHtml(customMaterial)}" placeholder="Informe o material" /></div>
          <div class="field"><label>Marca</label><input name="marca" value="${escapeHtml(row.marca || "")}" /></div>
          <div class="field"><label>Fornecedor</label><input name="fornecedor" value="${escapeHtml(row.fornecedor || "")}" /></div>
          <div class="field"><label>Lote</label><input name="lote" value="${escapeHtml(row.lote || "")}" /></div>
          <div class="field"><label>Local</label><input name="local" value="${escapeHtml(row.local || "")}" placeholder="Prateleira, caixa, armário" /></div>
          <div class="field"><label>Peso inicial g/ml</label><input type="number" step="0.01" name="peso_inicial_g" value="${escapeHtml(stockInitial(row) || 1000)}" /></div>
          <div class="field"><label>Peso restante g/ml</label><input type="number" step="0.01" name="peso_restante_g" value="${escapeHtml(stockRemaining(row) || stockInitial(row) || 1000)}" /></div>
          <div class="field"><label>Estoque mínimo g/ml</label><input type="number" step="0.01" name="quantidade_minima" value="${escapeHtml(row.quantidade_minima || 150)}" /></div>
          <div class="field"><label>Valor pago</label><input type="number" step="0.01" name="valor_compra" value="${escapeHtml(row.valor_compra || row.valor_atual || 0)}" /></div>
          <div class="field"><label>Custo por g/ml</label><input type="number" step="0.0001" name="custo_grama" value="${escapeHtml(gramCost ? gramCost.toFixed(4) : "")}" /></div>
          <div class="field"><label>Diâmetro mm</label><input type="number" step="0.01" name="diametro_mm" value="${escapeHtml(row.diametro_mm || 1.75)}" /></div>
          <div class="field"><label>Data da compra</label><input type="date" name="data_compra" value="${escapeHtml(row.data_compra || "")}" /></div>
          <div class="field"><label>Validade</label><input type="date" name="data_validade" value="${escapeHtml(row.data_validade || "")}" /></div>
          <div class="field"><label>Status</label><select name="status"><option value="disponivel" ${row.status === "disponivel" ? "selected" : ""}>Disponível</option><option value="reservado" ${row.status === "reservado" ? "selected" : ""}>Reservado</option><option value="esgotado" ${row.status === "esgotado" ? "selected" : ""}>Esgotado</option></select></div>
          <div class="field span-2"><label>Observações</label><textarea name="observacao">${escapeHtml(row.observacao || "")}</textarea></div>
          <div class="calc-box span-2" id="stockCalcBox">Informe valor pago e peso inicial para calcular o custo por grama.</div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelStock">Cancelar</button><button class="btn primary" type="submit">Salvar material</button></div>
    </form>`;
  document.body.appendChild(backdrop);

  const form = document.getElementById("stockForm");
  const close = () => backdrop.remove();
  replaceStockColorPicker(form, row);
  setupStockCalculator(form);
  document.getElementById("closeStock").addEventListener("click", close);
  document.getElementById("cancelStock").addEventListener("click", close);
  form.material_select.addEventListener("change", () => {
    document.getElementById("stockOtherMaterialField").style.display = form.material_select.value === "Outro" ? "block" : "none";
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.material = payload.material_select === "Outro" ? payload.material_outro : payload.material_select;
    delete payload.material_select;
    delete payload.material_outro;
    delete payload.cor_custom_text;
    ["peso_inicial_g", "peso_restante_g", "quantidade_minima", "valor_compra", "custo_grama", "diametro_mm"].forEach(key => payload[key] = stockNumber(payload[key], 0));
    payload.quantidade = payload.peso_restante_g;
    payload.valor_atual = payload.peso_restante_g * payload.custo_grama;
    await saveRecord("estoque", payload, row.id);
    close();
  });
}

function replaceStockColorPicker(form, row) {
  const materialField = form.querySelector('#stockOtherMaterialField');
  if (!materialField || typeof colorPickerHtml !== "function" || typeof setupColorPicker !== "function") return;
  materialField.insertAdjacentHTML("afterend", colorPickerHtml(row.cor || "", "stockPro"));
  setupColorPicker(form, "stockPro");
}

function setupStockCalculator(form) {
  const recalc = () => {
    const value = stockNumber(form.valor_compra?.value, 0);
    const initial = stockNumber(form.peso_inicial_g?.value, 0);
    const remaining = stockNumber(form.peso_restante_g?.value, 0);
    const currentCost = stockNumber(form.custo_grama?.value, 0);
    const calculated = value > 0 && initial > 0 ? value / initial : currentCost;
    if (calculated > 0) form.custo_grama.value = calculated.toFixed(4);
    const estimated = remaining * stockNumber(form.custo_grama?.value, 0);
    const percent = initial > 0 ? Math.max(0, Math.min(100, remaining / initial * 100)) : 0;
    document.getElementById("stockCalcBox").textContent = `Custo calculado: ${money(stockNumber(form.custo_grama?.value, 0))}/g | Valor restante estimado: ${money(estimated)} | Estoque restante: ${percent.toFixed(1)}%`;
  };
  ["valor_compra", "peso_inicial_g", "peso_restante_g", "custo_grama"].forEach(name => form[name]?.addEventListener("input", recalc));
  recalc();
}

const stockPreviousRenderPage = renderPage;
renderPage = function renderPageWithProfessionalStock() {
  const el = document.getElementById("content");
  if (state.page === "estoque" && el) return renderStockProfessional(el);
  return stockPreviousRenderPage();
};
