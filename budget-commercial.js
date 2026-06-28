function budgetNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function budgetClientOptions(current = "") {
  const clients = state.cache.clientes || [];
  return `<option value="">Cliente não vinculado</option>${clients.map(client => `<option value="${escapeHtml(client.id)}" ${client.id === current ? "selected" : ""}>${escapeHtml([client.nome, client.empresa].filter(Boolean).join(" - "))}</option>`).join("")}`;
}

function budgetStatusOptions(current = "rascunho") {
  const statuses = [
    ["rascunho", "Rascunho"],
    ["enviado", "Enviado"],
    ["aprovado", "Aprovado"],
    ["recusado", "Recusado"],
    ["cancelado", "Cancelado"]
  ];
  return statuses.map(([value, label]) => `<option value="${value}" ${value === (current || "rascunho") ? "selected" : ""}>${label}</option>`).join("");
}

function budgetComplexityOptions(current = "normal") {
  const options = [["simples", "Simples"], ["normal", "Normal"], ["complexo", "Complexo"], ["prototipo", "Protótipo/teste"]];
  return options.map(([value, label]) => `<option value="${value}" ${value === (current || "normal") ? "selected" : ""}>${label}</option>`).join("");
}

function budgetDeliveryOptions(current = "retirada") {
  const options = [["retirada", "Retirada"], ["entrega", "Entrega local"], ["envio", "Envio/transportadora"], ["combinar", "A combinar"]];
  return options.map(([value, label]) => `<option value="${value}" ${value === (current || "retirada") ? "selected" : ""}>${label}</option>`).join("");
}

function buildBudgetCalcPayload(payload) {
  const qty = Math.max(1, budgetNumber(payload.quantidade_pecas, 1));
  return {
    ...payload,
    peso_g: budgetNumber(payload.peso_g, 0) * qty,
    horas: budgetNumber(payload.horas, 0) * qty,
    pos_horas: budgetNumber(payload.pos_horas, 0) * qty
  };
}

function commercialBudgetBreakdown(payload) {
  const calcPayload = buildBudgetCalcPayload(payload);
  const b = budgetBreakdown(calcPayload);
  const urgency = b.total * budgetNumber(payload.urgencia_percentual, 0) / 100;
  const discountPercent = b.total * budgetNumber(payload.desconto_percentual, 0) / 100;
  const discountValue = budgetNumber(payload.desconto_valor, 0);
  const freight = budgetNumber(payload.frete_valor, 0);
  const subtotal = b.total + urgency + freight;
  const total = Math.max(0, subtotal - discountPercent - discountValue);
  return { ...b, calcPayload, urgency, discountPercent, discountValue, freight, commercialSubtotal: subtotal, total };
}

openBudgetForm = function openBudgetFormCommercial(row = {}) {
  const stockItems = stockBudgetOptions();
  const currentStock = stockItems.find(item => item.material === row.material && item.cor === row.cor) || null;
  const profile = budgetProfileDefaults(state.cache.loja || {});
  const initialPayload = { ...row, estoque_ref: currentStock?.id || "" };
  const value = Number(row.total || commercialBudgetBreakdown(initialPayload).total).toFixed(2);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal budget-commercial-modal" id="budgetForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} orçamento</strong><button class="btn" type="button" id="closeBudget">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Número</label><input name="numero" value="${escapeHtml(row.numero || nextNumber("ORC", state.cache.orcamentos.length))}" /></div>
          <div class="field"><label>Status comercial</label><select name="status">${budgetStatusOptions(row.status)}</select></div>
          <div class="field span-2"><label>Cliente</label><select name="cliente_id">${budgetClientOptions(row.cliente_id || "")}</select></div>
          <div class="field span-2"><label>Projeto</label><input name="projeto" value="${escapeHtml(row.projeto || "")}" required /></div>

          <div class="field span-2"><label>Filamento/resina do estoque</label><select name="estoque_ref" id="budgetStock"><option value="">Usar custo padrão dos parâmetros</option>${stockItems.map(item => `<option value="${escapeHtml(item.id)}" ${currentStock?.id === item.id ? "selected" : ""}>${escapeHtml([item.nome, item.material, item.cor].filter(Boolean).join(" - "))} (${money(item.custo_grama || 0)}/g)</option>`).join("")}</select></div>
          <div class="field"><label>Material</label><input name="material" value="${escapeHtml(row.material || currentStock?.material || "PLA")}" /></div>
          <div class="field" id="budgetColorAnchor"></div>

          <div class="field"><label>Quantidade de peças</label><input type="number" step="1" min="1" name="quantidade_pecas" value="${escapeHtml(row.quantidade_pecas || 1)}" /></div>
          <div class="field"><label>Peso por peça g/ml</label><input type="number" step="0.01" name="peso_g" value="${escapeHtml(row.peso_g || 0)}" /></div>
          <div class="field"><label>Tempo por peça h</label><input type="number" step="0.01" name="horas" value="${escapeHtml(row.horas || 0)}" /></div>
          <div class="field"><label>Pós-processamento por peça h</label><input type="number" step="0.01" name="pos_horas" value="${escapeHtml(row.pos_horas || 0)}" /></div>

          <div class="field"><label>Complexidade</label><select name="complexidade">${budgetComplexityOptions(row.complexidade)}</select></div>
          <div class="field"><label>Urgência %</label><input type="number" step="0.01" name="urgencia_percentual" value="${escapeHtml(row.urgencia_percentual || 0)}" /></div>
          <div class="field"><label>Desconto %</label><input type="number" step="0.01" name="desconto_percentual" value="${escapeHtml(row.desconto_percentual || 0)}" /></div>
          <div class="field"><label>Desconto R$</label><input type="number" step="0.01" name="desconto_valor" value="${escapeHtml(row.desconto_valor || 0)}" /></div>
          <div class="field"><label>Entrega/retirada</label><select name="retirada_entrega">${budgetDeliveryOptions(row.retirada_entrega)}</select></div>
          <div class="field"><label>Frete/entrega R$</label><input type="number" step="0.01" name="frete_valor" value="${escapeHtml(row.frete_valor || 0)}" /></div>
          <div class="field"><label>Prazo estimado</label><input name="prazo_entrega" value="${escapeHtml(row.prazo_entrega || profile.prazo_padrao || "A combinar")}" /></div>
          <div class="field"><label>Validade em dias</label><input type="number" step="1" name="validade_dias" value="${escapeHtml(row.validade_dias || profile.validade_dias || 7)}" /></div>
          <div class="field"><label>Revisão de arquivo</label><input name="revisao_arquivo" value="${escapeHtml(row.revisao_arquivo || "Análise visual e fatiamento padrão inclusos")}" /></div>
          <div class="field"><label>Total</label><input type="number" step="0.01" name="total" value="${escapeHtml(value)}" /></div>

          <div class="calc-box span-2 budget-breakdown" id="calcBox">Preencha peso, tempo e quantidade para calcular automaticamente.</div>
          <div class="field span-2"><label>Observações</label><textarea name="observacao">${escapeHtml(row.observacao || "")}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelBudget">Cancelar</button><button class="btn primary" type="submit">Salvar orçamento</button></div>
    </form>`;
  document.body.appendChild(backdrop);

  const form = document.getElementById("budgetForm");
  const colorAnchor = document.getElementById("budgetColorAnchor");
  colorAnchor.outerHTML = typeof colorPickerHtml === "function" ? colorPickerHtml(row.cor || currentStock?.cor || "", "budgetCommercial") : `<div class="field"><label>Cor</label><input name="cor" value="${escapeHtml(row.cor || currentStock?.cor || "")}" /></div>`;
  if (typeof setupColorPicker === "function") setupColorPicker(form, "budgetCommercial");

  const close = () => backdrop.remove();
  const syncStock = () => {
    const stock = findStockForBudget(Object.fromEntries(new FormData(form).entries()));
    if (!stock) return;
    form.material.value = stock.material || stock.nome || form.material.value;
    const colorValue = form.querySelector("#budgetCommercialColorValue") || form.cor;
    if (colorValue) colorValue.value = stock.cor || colorValue.value;
  };
  const recalc = () => {
    const payload = Object.fromEntries(new FormData(form).entries());
    const b = commercialBudgetBreakdown(payload);
    form.total.value = b.total.toFixed(2);
    document.getElementById("calcBox").innerHTML = `
      <strong>Valor final sugerido: ${money(b.total)}</strong>
      <span>Quantidade: ${escapeHtml(payload.quantidade_pecas || 1)} peça(s) | Peso total: ${budgetNumber(b.calcPayload.peso_g, 0).toLocaleString("pt-BR")} g/ml | Tempo total: ${budgetNumber(b.calcPayload.horas, 0).toLocaleString("pt-BR")} h</span>
      <span>Base técnica: ${money(b.base + b.margem + b.taxas)} | Urgência: ${money(b.urgency)} | Frete: ${money(b.freight)} | Descontos: ${money(b.discountPercent + b.discountValue)}</span>
      <span>Material: ${money(b.materialInfo.materialTotal)} | Máquina: ${money(b.maquina)} | Energia: ${money(b.energia)} | Pós: ${money(b.pos)} | Custos fixos/margem/taxas inclusos</span>
    `;
  };

  ["estoque_ref", "quantidade_pecas", "peso_g", "horas", "pos_horas", "urgencia_percentual", "desconto_percentual", "desconto_valor", "frete_valor", "material", "cor"].forEach(name => {
    form[name]?.addEventListener("input", () => { if (name === "estoque_ref") syncStock(); recalc(); });
    form[name]?.addEventListener("change", () => { if (name === "estoque_ref") syncStock(); recalc(); });
  });
  form.addEventListener("g3d:color-change", recalc);
  document.getElementById("closeBudget").addEventListener("click", close);
  document.getElementById("cancelBudget").addEventListener("click", close);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    const b = commercialBudgetBreakdown(payload);
    delete payload.estoque_ref;
    delete payload.cor_custom_text;
    if (!payload.cliente_id) payload.cliente_id = null;
    ["peso_g", "horas", "pos_horas", "total", "quantidade_pecas", "urgencia_percentual", "desconto_percentual", "desconto_valor", "frete_valor", "validade_dias"].forEach(k => payload[k] = budgetNumber(payload[k], 0));
    payload.total = Number(b.total.toFixed(2));
    await saveRecord("orcamentos", payload, row.id);
    close();
  });
  syncStock();
  recalc();
};

const commercialPreviousOpenBudgetPdf = openBudgetPdf;
openBudgetPdf = function openBudgetPdfCommercial(row) {
  if (!row) return;
  const profile = budgetProfileDefaults(state.cache.loja || {});
  const client = (state.cache.clientes || []).find(item => item.id === row.cliente_id);
  const issueDate = new Date();
  const validDays = Number(row.validade_dias || profile.validade_dias || 7);
  const validDate = new Date(issueDate.getTime() + validDays * 86400000);
  const total = Number(row.total || calculatePrice(row));
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir o orçamento.");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(row.numero || "Orçamento")}</title><style>body{margin:0;background:#dbe3ed;color:#16202a;font-family:Arial,Helvetica,sans-serif}.actions{position:sticky;top:0;background:#101820;padding:10px;text-align:center}.actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d}.page{max-width:920px;margin:0 auto;background:#fff;min-height:100vh;padding:42px}.header{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #101820;padding-bottom:22px}.logoBox{width:132px;height:86px;border:1px solid #d8dee8;border-radius:8px;display:grid;place-items:center;overflow:hidden;font-weight:900}.logoBox img{width:100%;height:100%;object-fit:contain;padding:8px}h1,h2,h3,p{margin-top:0}.muted{color:#667085;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden;margin:18px 0}.grid div{padding:13px;border-right:1px solid #d8dee8}.grid div:last-child{border-right:0}.grid span{display:block;color:#667085;font-size:12px;margin-bottom:5px}.box{border:1px solid #d8dee8;border-radius:10px;padding:16px;margin-top:16px}.total{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding:18px 20px;border-radius:10px;background:#101820;color:white}.total strong{font-size:30px;color:#24d982}@media print{.actions{display:none}.page{max-width:none}}@media(max-width:720px){.header{display:block}.grid{grid-template-columns:1fr 1fr}}</style></head><body><div class="actions"><button onclick="window.print()">Salvar como PDF</button></div><main class="page"><section class="header"><div><h1>${escapeHtml(profile.nome_loja || "G3D Pro")}</h1><p class="muted">${escapeHtml([profile.documento, profile.whatsapp, profile.email].filter(Boolean).join(" | "))}</p></div><div class="logoBox">${profile.logo_url ? `<img src="${escapeHtml(profile.logo_url)}" alt="Logo">` : "G3D"}</div></section><h2>Orçamento ${escapeHtml(row.numero || "")}</h2><p class="muted">Emitido em ${issueDate.toLocaleDateString("pt-BR")} | Válido até ${validDate.toLocaleDateString("pt-BR")}</p>${client ? `<div class="box"><h3>Cliente</h3><p>${escapeHtml(client.nome || client.empresa || "")}</p><p class="muted">${escapeHtml([client.email, client.telefone, client.whatsapp].filter(Boolean).join(" | "))}</p></div>` : ""}<div class="grid"><div><span>Projeto</span><strong>${escapeHtml(row.projeto || "")}</strong></div><div><span>Qtd.</span><strong>${escapeHtml(row.quantidade_pecas || 1)}</strong></div><div><span>Material</span><strong>${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</strong></div><div><span>Prazo</span><strong>${escapeHtml(row.prazo_entrega || profile.prazo_padrao || "A combinar")}</strong></div></div><div class="grid"><div><span>Peso por peça</span><strong>${escapeHtml(row.peso_g || 0)} g/ml</strong></div><div><span>Tempo por peça</span><strong>${escapeHtml(row.horas || 0)} h</strong></div><div><span>Entrega</span><strong>${escapeHtml(row.retirada_entrega || "retirada")}</strong></div><div><span>Status</span><strong>${escapeHtml(row.status || "rascunho")}</strong></div></div><div class="box"><h3>Condições e observações</h3><p class="muted">${escapeHtml(row.revisao_arquivo || "Análise visual e fatiamento padrão inclusos")}</p><p class="muted">${escapeHtml(row.observacao || profile.observacao_padrao || "")}</p><p class="muted">${escapeHtml(profile.condicoes_comerciais || "")}</p></div><section class="total"><span>Total do orçamento</span><strong>${money(total)}</strong></section></main></body></html>`);
  win.document.close();
};
