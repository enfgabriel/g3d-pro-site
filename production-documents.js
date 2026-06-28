function productionDocumentDate(value = new Date()) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function productionDocumentSafe(value) {
  return escapeHtml(value || "");
}

function productionDocumentStage(row) {
  if (typeof productionStageLabel === "function") return productionStageLabel(row.status || row.etapa_atual || "fila");
  return row.status || row.etapa_atual || "Fila";
}

function productionDocumentStageKey(row) {
  if (typeof productionStageKey === "function") return productionStageKey(row.status || row.etapa_atual || "fila");
  return String(row.status || row.etapa_atual || "fila").toLowerCase();
}

function productionDocumentOrder(row) {
  if (!row?.pedido_id) return null;
  return (state.cache.pedidos || []).find(order => order.id === row.pedido_id) || null;
}

function productionDocumentBudget(row) {
  if (!row?.orcamento_id) return null;
  return (state.cache.orcamentos || []).find(budget => budget.id === row.orcamento_id) || null;
}

function productionDocumentClient(row, order, budget) {
  const clientId = row?.cliente_id || order?.cliente_id || budget?.cliente_id;
  if (!clientId) return null;
  return (state.cache.clientes || []).find(client => client.id === clientId) || null;
}

function productionDocumentStoreBlock(profile) {
  const contact = [profile.documento, profile.whatsapp, profile.email, profile.site].filter(Boolean).join(" | ");
  const address = [profile.endereco, profile.cidade, profile.estado].filter(Boolean).join(" - ");
  return `
    <section class="prod-header">
      <div>
        <h1>${productionDocumentSafe(profile.nome_loja || "G3D Pro")}</h1>
        <p>Ordem interna de produção</p>
        <p class="muted">${productionDocumentSafe(contact)}</p>
        <p class="muted">${productionDocumentSafe(address)}</p>
      </div>
      <div class="prod-logo">${profile.logo_url ? `<img src="${productionDocumentSafe(profile.logo_url)}" alt="Logo">` : "G3D"}</div>
    </section>`;
}

function productionDocumentGrid(items) {
  return items.map(([label, value]) => `<div><span>${productionDocumentSafe(label)}</span><strong>${productionDocumentSafe(value)}</strong></div>`).join("");
}

function productionDocumentChecklist(row) {
  const stage = productionDocumentStageKey(row);
  const done = key => {
    const order = ["fila", "imprimindo", "pos", "pronto", "entregue"];
    return order.indexOf(stage) >= order.indexOf(key) && order.indexOf(key) >= 0;
  };
  const items = [
    ["Arquivo conferido", true],
    ["Arquivo fatiado", stage !== "fila"],
    ["Material e cor separados", true],
    ["Mesa preparada", stage !== "fila"],
    ["Impressão iniciada", done("imprimindo")],
    ["Impressão finalizada", done("pos") || done("pronto") || done("entregue")],
    ["Pós-processamento", done("pos") || done("pronto") || done("entregue")],
    ["Conferência final", done("pronto") || done("entregue")],
    ["Estoque baixado", !!row.estoque_baixado],
    ["Peça entregue", done("entregue")]
  ];
  return items.map(([label, checked]) => `
    <div class="check-row">
      <span class="check-box">${checked ? "✓" : ""}</span>
      <strong>${productionDocumentSafe(label)}</strong>
    </div>`).join("");
}

async function openProductionOrderPdf(row) {
  if (!row) return;
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir a ordem de produção.");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando ordem</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Arial;background:#101820;color:white}.box{padding:24px;text-align:center}.box strong{display:block;margin-bottom:8px;color:#24d982}</style></head><body><div class="box"><strong>G3D Pro</strong><span>Preparando ordem de produção...</span></div></body></html>`);
  win.document.close();

  const profileBase = typeof budgetProfileDefaults === "function" ? budgetProfileDefaults(state.cache.loja || {}) : (state.cache.loja || {});
  const logoSource = profileBase.logo_path || profileBase.logo_url || state.cache.loja?.logo_path || state.cache.loja?.logo_url || "";
  const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profileBase.logo_url;
  const profile = { ...profileBase, logo_url: logoUrl || profileBase.logo_url || "" };
  const order = productionDocumentOrder(row);
  const budget = productionDocumentBudget(row);
  const client = productionDocumentClient(row, order, budget);
  const issueDate = new Date();
  const stageLabel = productionDocumentStage(row);
  const estimatedTime = Number(row.tempo_horas || order?.tempo_horas || budget?.horas || 0);
  const weight = Number(row.peso_g || order?.peso_g || budget?.peso_g || 0);
  const quantity = Number(row.quantidade_pecas || order?.quantidade_pecas || budget?.quantidade_pecas || 1);
  const totalWeight = weight * Math.max(1, quantity);

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${productionDocumentSafe(row.numero || "Ordem de produção")}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.prod-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.prod-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.prod-page{width:min(980px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.prod-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.prod-header h1{margin:0 0 7px;font-size:32px}.prod-header p{margin:0 0 5px}.prod-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.prod-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.prod-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.prod-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.prod-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.prod-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.prod-grid div{padding:13px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.prod-grid div:nth-child(4n){border-right:0}.prod-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.prod-grid strong{font-size:14px}.prod-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.prod-box h3{margin:0 0 10px;font-size:17px}.prod-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.check-list{display:grid;grid-template-columns:1fr 1fr;gap:8px}.check-row{display:flex;align-items:center;gap:10px;min-height:34px;padding:8px;border:1px solid #e7ebf0;border-radius:8px}.check-box{width:22px;height:22px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #101820;border-radius:5px;color:#067647;font-weight:900}.note-lines{display:grid;gap:14px;margin-top:12px}.note-line{height:34px;border-bottom:1px solid #b8c1cc}.prod-alert{margin-top:16px;padding:14px;border-radius:10px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa}.prod-signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:34px}.prod-signature{padding-top:38px;border-top:1px solid #101820;text-align:center;color:#667085;font-size:12px}.prod-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}@media print{body{background:white}.prod-actions{display:none}.prod-page{width:auto;min-height:0;padding:26px}.prod-box{break-inside:avoid}}@media(max-width:760px){.prod-header,.prod-title,.prod-two{display:block}.prod-logo{margin-top:14px}.prod-grid,.check-list,.prod-signatures{grid-template-columns:1fr}.prod-grid div{border-right:0!important}}
  </style>
</head>
<body>
  <div class="prod-actions"><button onclick="window.print()">Salvar como PDF</button></div>
  <main class="prod-page">
    ${productionDocumentStoreBlock(profile)}
    <section class="prod-title">
      <div>
        <h2>Ordem de Produção ${productionDocumentSafe(row.numero || "")}</h2>
        <p class="muted">Emitida em ${productionDocumentDate(issueDate)} · Uso interno da operação</p>
      </div>
      <span class="prod-status">${productionDocumentSafe(stageLabel)}</span>
    </section>

    <section class="prod-box">
      <h3>Identificação</h3>
      <div class="prod-grid">
        ${productionDocumentGrid([
          ["Produção", row.titulo || row.numero || ""],
          ["Pedido", order?.numero || "Não vinculado"],
          ["Cliente", client ? (client.nome || client.empresa || "") : "Não vinculado"],
          ["Prazo", row.data_prevista || order?.data_entrega || order?.prazo_entrega || budget?.prazo_entrega || "A combinar"],
          ["Material", [row.material || order?.material || budget?.material, row.cor || order?.cor || budget?.cor].filter(Boolean).join(" - ")],
          ["Quantidade", `${quantity || 1} peça(s)`],
          ["Peso total", `${totalWeight.toLocaleString("pt-BR")} g/ml`],
          ["Tempo estimado", estimatedTime ? `${estimatedTime.toLocaleString("pt-BR")} h` : "Não informado"]
        ])}
      </div>
    </section>

    <section class="prod-two">
      <div class="prod-box">
        <h3>Checklist operacional</h3>
        <div class="check-list">${productionDocumentChecklist(row)}</div>
      </div>
      <div class="prod-box">
        <h3>Dados técnicos</h3>
        <p><strong>Etapa atual:</strong> ${productionDocumentSafe(stageLabel)}</p>
        <p><strong>Baixa de estoque:</strong> ${row.estoque_baixado ? "Realizada" : "Pendente"}</p>
        <p><strong>Consumo previsto:</strong> ${totalWeight.toLocaleString("pt-BR")} g/ml</p>
        <p><strong>Origem:</strong> ${productionDocumentSafe(order?.numero || budget?.numero || "Cadastro manual")}</p>
        ${row.falha_motivo ? `<p class="prod-alert"><strong>Falha registrada:</strong> ${productionDocumentSafe(row.falha_motivo)}</p>` : ""}
      </div>
    </section>

    <section class="prod-box">
      <h3>Anotações técnicas</h3>
      <p class="muted">Use este espaço para registrar ajustes de fatiamento, temperatura, suporte, retrabalho, troca de material ou observações de acabamento.</p>
      <div class="note-lines"><div class="note-line"></div><div class="note-line"></div><div class="note-line"></div><div class="note-line"></div></div>
    </section>

    ${row.observacao || order?.observacao || budget?.observacao ? `<section class="prod-box"><h3>Observações do pedido</h3><p class="muted">${productionDocumentSafe(row.observacao || order?.observacao || budget?.observacao)}</p></section>` : ""}

    <section class="prod-alert">Ao finalizar a produção, confirme a conferência final e faça a baixa de estoque quando aplicável.</section>

    <section class="prod-signatures">
      <div class="prod-signature">Operador / responsável</div>
      <div class="prod-signature">Conferência final</div>
    </section>

    <section class="prod-footer">
      <span>${productionDocumentSafe(profile.nome_loja || "G3D Pro")}</span>
      <span>Documento interno gerado pelo G3D Pro</span>
    </section>
  </main>
</body>
</html>`);
  win.document.close();
}

function attachProductionDocumentButtons(el) {
  if (!el) return;
  const rows = state.cache.producoes || [];
  el.querySelectorAll("[data-edit-production]").forEach(button => {
    const productionId = button.dataset.editProduction;
    const actions = button.closest(".actions");
    if (!actions || actions.querySelector(`[data-pdf-production="${productionId}"]`)) return;
    const pdfButton = document.createElement("button");
    pdfButton.className = "btn";
    pdfButton.type = "button";
    pdfButton.dataset.pdfProduction = productionId;
    pdfButton.textContent = "Ordem/PDF";
    pdfButton.addEventListener("click", () => openProductionOrderPdf(rows.find(row => row.id === productionId)));
    button.insertAdjacentElement("afterend", pdfButton);
  });
}

if (typeof renderProducoesProfessional === "function") {
  const productionDocumentsPreviousRenderProducoesProfessional = renderProducoesProfessional;
  renderProducoesProfessional = function renderProducoesProfessionalWithDocuments(el) {
    productionDocumentsPreviousRenderProducoesProfessional(el);
    attachProductionDocumentButtons(el);
  };
}
