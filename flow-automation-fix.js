function g3dFlowNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function g3dFlowSameText(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

function g3dFindBudgetForOrder(order = {}) {
  if (!order) return null;
  const budgets = state.cache.orcamentos || [];
  return budgets.find(item => item.id === order.orcamento_id || item.pedido_id === order.id) || null;
}

function g3dFindStockForMaterial(source = {}) {
  const stockItems = state.cache.estoque || [];
  if (source.estoque_id) {
    const direct = stockItems.find(item => item.id === source.estoque_id);
    if (direct) return direct;
  }
  if (source.estoque_ref) {
    const direct = stockItems.find(item => item.id === source.estoque_ref);
    if (direct) return direct;
  }
  if (typeof findStockForBudget === "function") {
    const matched = findStockForBudget(source);
    if (matched) return matched;
  }
  const material = source.material || "";
  const color = source.cor || "";
  return stockItems.find(item => {
    const materialMatches = material && (g3dFlowSameText(item.material, material) || g3dFlowSameText(item.nome, material));
    const colorMatches = !color || g3dFlowSameText(item.cor, color);
    return materialMatches && colorMatches;
  }) || null;
}

function g3dBudgetTotalWeight(row = {}) {
  return g3dFlowNumber(row.peso_g, 0) * Math.max(1, g3dFlowNumber(row.quantidade_pecas, 1));
}

function g3dBudgetTotalHours(row = {}) {
  return g3dFlowNumber(row.horas, 0) * Math.max(1, g3dFlowNumber(row.quantidade_pecas, 1));
}

function g3dOrderFromBudgetPayload(row = {}) {
  const client = typeof budgetOrderClient === "function" ? budgetOrderClient(row) : null;
  const stock = g3dFindStockForMaterial(row);
  const pieces = Math.max(1, g3dFlowNumber(row.quantidade_pecas, 1));
  const payload = {
    orcamento_id: row.id,
    cliente_id: row.cliente_id || null,
    estoque_id: stock?.id || row.estoque_id || row.estoque_ref || null,
    numero: typeof orderNumberFromBudget === "function" ? orderNumberFromBudget(row) : nextNumber("PED", state.cache.pedidos.length),
    titulo: row.projeto || `Pedido do orçamento ${row.numero || ""}`,
    status: "novo",
    prioridade: g3dFlowNumber(row.urgencia_percentual, 0) > 0 ? "Alta" : "Normal",
    valor: g3dFlowNumber(row.total, 0),
    material: row.material || stock?.material || "",
    cor: row.cor || stock?.cor || "",
    peso_g: g3dFlowNumber(row.peso_g, 0),
    quantidade_pecas: pieces,
    tempo_horas: g3dBudgetTotalHours(row),
    prazo_entrega: row.prazo_entrega || "A combinar",
    observacao: [
      row.numero ? `Gerado automaticamente a partir do orçamento ${row.numero}.` : "Gerado automaticamente a partir de orçamento.",
      client ? `Cliente: ${client.nome || client.empresa || ""}.` : "",
      stock ? `Estoque vinculado: ${stock.nome || stock.material || "material"}.` : "",
      row.retirada_entrega ? `Entrega/retirada: ${row.retirada_entrega}.` : "",
      row.observacao || ""
    ].filter(Boolean).join("\n")
  };
  return typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
}

async function g3dInsertOrderWithFallback(payload) {
  const full = await supabaseClient.from("pedidos").insert(payload).select("id, numero").single();
  if (!full.error) return full;

  const text = String(full.error.message || "").toLowerCase();
  const shouldFallback = ["schema cache", "column", "estoque_id", "tempo_horas", "quantidade_pecas", "peso_g", "cliente_id", "orcamento_id"].some(key => text.includes(key));
  if (!shouldFallback) return full;

  const fallback = {
    orcamento_id: payload.orcamento_id || null,
    cliente_id: payload.cliente_id || null,
    numero: payload.numero,
    titulo: payload.titulo,
    status: payload.status,
    prioridade: payload.prioridade,
    valor: payload.valor,
    material: payload.material,
    cor: payload.cor,
    peso_g: payload.peso_g,
    quantidade_pecas: payload.quantidade_pecas,
    prazo_entrega: payload.prazo_entrega,
    observacao: payload.observacao
  };
  const cleanFallback = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(fallback) : fallback;
  return supabaseClient.from("pedidos").insert(cleanFallback).select("id, numero").single();
}

const g3dPreviousGenerateOrderFromBudget = typeof generateOrderFromBudget === "function" ? generateOrderFromBudget : null;
generateOrderFromBudget = async function generateOrderFromBudgetFixed(row) {
  if (!row?.id) return;
  const existing = typeof budgetOrderFor === "function" ? budgetOrderFor(row) : null;
  if (existing) {
    showToast(`Este orçamento já gerou o pedido ${existing.numero || ""}.`);
    return;
  }

  const payload = g3dOrderFromBudgetPayload(row);
  const { data, error } = await g3dInsertOrderWithFallback(payload);
  if (error) {
    if (g3dPreviousGenerateOrderFromBudget) return g3dPreviousGenerateOrderFromBudget(row);
    showToast(error.message);
    return;
  }

  const updatePayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload({ status: "aprovado", pedido_id: data?.id || null }) : { status: "aprovado", pedido_id: data?.id || null };
  const update = await supabaseClient.from("orcamentos").update(updatePayload).eq("id", row.id);
  showToast(update.error ? `Pedido ${data?.numero || ""} criado, mas o orçamento não foi marcado como aprovado.` : `Pedido ${data?.numero || ""} criado com cliente, material e estoque vinculados.`);
  await Promise.all([loadTable("pedidos"), loadTable("orcamentos")]);
  renderPage();
};

function g3dProductionFromOrderPayload(order = {}) {
  const budget = g3dFindBudgetForOrder(order) || {};
  const merged = { ...budget, ...order };
  const stock = g3dFindStockForMaterial(merged);
  const pieces = Math.max(1, g3dFlowNumber(merged.quantidade_pecas, 1));
  const perPieceWeight = g3dFlowNumber(merged.peso_g || budget.peso_g, 0);
  const totalWeight = perPieceWeight * pieces;
  const totalHours = g3dFlowNumber(order.tempo_horas, 0) || g3dBudgetTotalHours(budget) || g3dFlowNumber(order.horas, 0);
  const client = typeof orderClient === "function" ? orderClient(merged) : null;
  const payload = {
    pedido_id: order.id,
    cliente_id: merged.cliente_id || null,
    orcamento_id: merged.orcamento_id || budget.id || null,
    estoque_id: stock?.id || merged.estoque_id || null,
    numero: typeof productionNumberFromOrder === "function" ? productionNumberFromOrder(order) : nextNumber("PROD", state.cache.producoes.length),
    titulo: order.titulo || budget.projeto || `Produção do pedido ${order.numero || ""}`,
    status: "fila",
    etapa_atual: "fila",
    prioridade: order.prioridade || "Normal",
    material: merged.material || stock?.material || "",
    cor: merged.cor || stock?.cor || "",
    peso_g: perPieceWeight,
    quantidade_pecas: pieces,
    consumo_material_g: totalWeight,
    estoque_baixado: false,
    tempo_horas: totalHours,
    data_prevista: order.data_entrega || null,
    observacao: [
      order.numero ? `Gerado automaticamente a partir do pedido ${order.numero}.` : "Gerado automaticamente a partir de pedido.",
      budget.numero ? `Origem comercial: ${budget.numero}.` : "",
      client ? `Cliente: ${client.nome || client.empresa || ""}.` : "",
      stock ? `Estoque vinculado: ${stock.nome || stock.material || "material"}.` : "",
      order.prazo_entrega ? `Prazo comercial: ${order.prazo_entrega}.` : "",
      order.observacao || ""
    ].filter(Boolean).join("\n")
  };
  return typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
}

async function g3dInsertProductionWithFallback(payload) {
  const full = await supabaseClient.from("producoes").insert(payload).select("id, titulo").single();
  if (!full.error) return full;

  const text = String(full.error.message || "").toLowerCase();
  const shouldFallback = ["schema cache", "column", "estoque_id", "consumo_material_g", "estoque_baixado", "etapa_atual", "cliente_id", "orcamento_id"].some(key => text.includes(key));
  if (!shouldFallback) return full;

  const fallback = {
    pedido_id: payload.pedido_id || null,
    cliente_id: payload.cliente_id || null,
    orcamento_id: payload.orcamento_id || null,
    numero: payload.numero,
    titulo: payload.titulo,
    status: payload.status,
    prioridade: payload.prioridade,
    material: payload.material,
    cor: payload.cor,
    peso_g: payload.peso_g,
    quantidade_pecas: payload.quantidade_pecas,
    tempo_horas: payload.tempo_horas,
    data_prevista: payload.data_prevista,
    observacao: payload.observacao
  };
  const cleanFallback = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(fallback) : fallback;
  return supabaseClient.from("producoes").insert(cleanFallback).select("id, titulo").single();
}

const g3dPreviousGenerateProductionFromOrder = typeof generateProductionFromOrder === "function" ? generateProductionFromOrder : null;
generateProductionFromOrder = async function generateProductionFromOrderFixed(order) {
  if (!order?.id) return;
  const existing = typeof productionForOrder === "function" ? productionForOrder(order) : null;
  if (existing) {
    showToast(`Este pedido já está na produção: ${existing.titulo || ""}.`);
    return;
  }

  const payload = g3dProductionFromOrderPayload(order);
  const { data, error } = await g3dInsertProductionWithFallback(payload);
  if (error) {
    if (g3dPreviousGenerateProductionFromOrder) return g3dPreviousGenerateProductionFromOrder(order);
    showToast(error.message);
    return;
  }

  const updatePayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload({ status: "em produção", producao_id: data?.id || null }) : { status: "em produção", producao_id: data?.id || null };
  const update = await supabaseClient.from("pedidos").update(updatePayload).eq("id", order.id);
  showToast(update.error ? "Produção criada, mas o pedido não foi marcado como em produção." : "Pedido enviado para produção com consumo e estoque vinculados.");
  await Promise.all([loadTable("pedidos"), loadTable("producoes")]);
  renderPage();
};

function g3dBudgetPdfHtml(row, profile, client, projectImages, logoUrl) {
  const issueDate = new Date();
  const validDays = Number(row.validade_dias || profile.validade_dias || 7);
  const validDate = new Date(issueDate.getTime() + validDays * 86400000);
  const breakdown = typeof commercialBudgetBreakdown === "function" ? commercialBudgetBreakdown(row) : null;
  const subtotal = breakdown ? breakdown.commercialSubtotal : Number(row.total || 0);
  const discounts = breakdown ? breakdown.discountPercent + breakdown.discountValue : Number(row.desconto_valor || 0);
  const total = Number(row.total || breakdown?.total || calculatePrice(row));
  const pdfProfile = { ...profile, logo_url: logoUrl || profile.logo_url || "" };
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${pdfSafe(row.numero || "Orçamento")}</title>
<style>*{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.pdf-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.pdf-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.pdf-page{width:min(960px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.pdf-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.pdf-header h1{margin:0 0 7px;font-size:32px}.pdf-header p{margin:0 0 5px}.pdf-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.pdf-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.pdf-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.pdf-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.pdf-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.pdf-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.pdf-grid.compact{grid-template-columns:repeat(4,1fr)}.pdf-grid div{padding:13px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.pdf-grid div:nth-child(3n){border-right:0}.pdf-grid.compact div:nth-child(3n){border-right:1px solid #d8dee8}.pdf-grid.compact div:nth-child(4n){border-right:0}.pdf-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.pdf-grid strong{font-size:14px}.pdf-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.pdf-box h3{margin:0 0 10px;font-size:17px}.pdf-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.pdf-money-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #e7ebf0}.pdf-money-row.strong{margin-top:8px;padding:14px 0 0;border-bottom:0;font-size:20px}.pdf-total{margin-top:20px;padding:18px 20px;border-radius:12px;background:#101820;color:white}.pdf-total .pdf-money-row{border:0;padding:0}.pdf-total span{color:#d4dde7}.pdf-total strong{color:#24d982;font-size:32px}.pdf-image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pdf-image-grid figure{margin:0;border:1px solid #d8dee8;border-radius:10px;overflow:hidden;background:#f8fafc}.pdf-image-grid img{width:100%;height:230px;display:block;object-fit:contain;background:white}.pdf-image-grid figcaption{padding:8px 10px;color:#667085;font-size:12px}ul{margin:8px 0 0;padding-left:20px;color:#44515f;line-height:1.55}.pdf-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}@media print{body{background:white}.pdf-actions{display:none}.pdf-page{width:auto;min-height:0;padding:26px}.pdf-box,.pdf-images-box figure{break-inside:avoid}.pdf-image-grid img{height:190px}}@media(max-width:760px){.pdf-header,.pdf-title,.pdf-two{display:block}.pdf-logo{margin-top:14px}.pdf-grid,.pdf-grid.compact,.pdf-image-grid{grid-template-columns:1fr}.pdf-grid div,.pdf-grid.compact div{border-right:0!important}}</style>
</head><body><div class="pdf-actions"><button onclick="window.print()">Salvar como PDF</button></div><main class="pdf-page">
${pdfStoreBlock(pdfProfile)}
<section class="pdf-title"><div><h2>Orçamento ${pdfSafe(row.numero || "")}</h2><p class="muted">Emitido em ${pdfDate(issueDate)} · Válido até ${pdfDate(validDate)}</p></div><span class="pdf-status">${pdfSafe(row.status || "rascunho")}</span></section>
${pdfClientBlock(client)}
<section class="pdf-box"><h3>Resumo do projeto</h3><div class="pdf-grid">${pdfCommercialRows(row, breakdown)}</div></section>
${pdfProjectImages(projectImages)}
${pdfTechnicalSummary(row, breakdown)}
<section class="pdf-two"><div class="pdf-box"><h3>Composição comercial</h3>${pdfMoneyRow("Subtotal técnico/comercial", subtotal)}${pdfMoneyRow("Urgência", breakdown?.urgency || 0)}${pdfMoneyRow("Frete/entrega", breakdown?.freight || Number(row.frete_valor || 0))}${pdfMoneyRow("Descontos", discounts)}</div><div class="pdf-box"><h3>Condições</h3>${pdfTerms(profile, row)}</div></section>
${row.observacao ? `<section class="pdf-box"><h3>Observações do orçamento</h3><p class="muted">${pdfSafe(row.observacao)}</p></section>` : ""}
<section class="pdf-total">${pdfMoneyRow("Total do orçamento", total, true)}</section>
<section class="pdf-footer"><span>${pdfSafe(profile.nome_loja || "G3D Pro")}</span><span>Documento gerado pelo G3D Pro</span></section>
</main></body></html>`;
}

openBudgetPdf = async function openBudgetPdfBlob(row) {
  if (!row) return;
  try {
    const profile = budgetProfileDefaults(state.cache.loja || {});
    const logoSource = profile.logo_path || profile.logo_url || state.cache.loja?.logo_path || state.cache.loja?.logo_url || "";
    const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profile.logo_url;
    const projectImages = typeof g3dBudgetImageUrls === "function" ? await g3dBudgetImageUrls(row) : [];
    const client = (state.cache.clientes || []).find(item => item.id === row.cliente_id);
    const html = g3dBudgetPdfHtml(row, profile, client, projectImages, logoUrl);
    const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
    const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      URL.revokeObjectURL(blobUrl);
      return showToast("Permita pop-ups para abrir o orçamento.");
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (error) {
    showToast(`Não foi possível abrir o PDF: ${error.message || error}`);
  }
};

window.G3D_FLOW_AUTOMATION_FIX = true;
