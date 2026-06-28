function pdfDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function pdfSafe(value) {
  return escapeHtml(value || "");
}

function pdfClientBlock(client) {
  if (!client) return `<div class="pdf-box"><h3>Cliente</h3><p class="muted">Cliente não vinculado.</p></div>`;
  return `
    <div class="pdf-box">
      <h3>Cliente</h3>
      <p><strong>${pdfSafe(client.nome || client.empresa || "")}</strong></p>
      <p class="muted">${pdfSafe([client.cpf_cnpj, client.email, client.telefone, client.whatsapp].filter(Boolean).join(" | "))}</p>
      <p class="muted">${pdfSafe([client.endereco, client.cidade, client.estado].filter(Boolean).join(" - "))}</p>
    </div>`;
}

function pdfStoreBlock(profile) {
  const contact = [profile.documento, profile.whatsapp, profile.email, profile.site].filter(Boolean).join(" | ");
  const address = [profile.endereco, profile.cidade, profile.estado].filter(Boolean).join(" - ");
  return `
    <section class="pdf-header">
      <div>
        <h1>${pdfSafe(profile.nome_loja || "G3D Pro")}</h1>
        <p>${pdfSafe(profile.responsavel || "ERP para impressão 3D")}</p>
        <p class="muted">${pdfSafe(contact)}</p>
        <p class="muted">${pdfSafe(address)}</p>
      </div>
      <div class="pdf-logo">${profile.logo_url ? `<img src="${pdfSafe(profile.logo_url)}" alt="Logo">` : "G3D"}</div>
    </section>`;
}

function pdfCommercialRows(row, breakdown) {
  const rows = [
    ["Projeto", row.projeto || ""],
    ["Quantidade", `${row.quantidade_pecas || 1} peça(s)`],
    ["Material", [row.material, row.cor].filter(Boolean).join(" - ")],
    ["Peso por peça", `${row.peso_g || 0} g/ml`],
    ["Tempo por peça", `${row.horas || 0} h`],
    ["Pós-processamento", `${row.pos_horas || 0} h`],
    ["Complexidade", row.complexidade || "normal"],
    ["Entrega/retirada", row.retirada_entrega || "A combinar"],
    ["Prazo", row.prazo_entrega || "A combinar"]
  ];
  return rows.map(([label, value]) => `<div><span>${pdfSafe(label)}</span><strong>${pdfSafe(value)}</strong></div>`).join("");
}

function pdfMoneyRow(label, value, strong = false) {
  return `<div class="pdf-money-row ${strong ? "strong" : ""}"><span>${pdfSafe(label)}</span><strong>${money(value)}</strong></div>`;
}

function pdfTechnicalSummary(row, breakdown) {
  const qty = Math.max(1, Number(row.quantidade_pecas || 1));
  const calc = breakdown?.calcPayload || buildBudgetCalcPayload(row);
  return `
    <div class="pdf-box">
      <h3>Resumo técnico</h3>
      <div class="pdf-grid compact">
        <div><span>Peso total estimado</span><strong>${Number(calc.peso_g || 0).toLocaleString("pt-BR")} g/ml</strong></div>
        <div><span>Tempo total estimado</span><strong>${Number(calc.horas || 0).toLocaleString("pt-BR")} h</strong></div>
        <div><span>Quantidade</span><strong>${qty} peça(s)</strong></div>
        <div><span>Revisão</span><strong>${pdfSafe(row.revisao_arquivo || "Análise visual e fatiamento padrão")}</strong></div>
      </div>
    </div>`;
}

function pdfTerms(profile, row) {
  const terms = [
    row.revisao_arquivo || "Arquivos serão revisados antes da produção.",
    row.prazo_entrega ? `Prazo estimado: ${row.prazo_entrega}.` : "Prazo final confirmado após aprovação do orçamento.",
    profile.condicoes_comerciais || "Pagamento combinado diretamente com a loja. Produção iniciada conforme aprovação comercial.",
    profile.observacao_padrao || "Alterações no arquivo, material, cor ou prazo podem alterar o valor final."
  ].filter(Boolean);
  return `<ul>${terms.map(term => `<li>${pdfSafe(term)}</li>`).join("")}</ul>`;
}

function pdfProjectImages(images = []) {
  if (!images.length) return "";
  return `
    <section class="pdf-box pdf-images-box">
      <h3>Imagens do projeto</h3>
      <div class="pdf-image-grid">
        ${images.map(item => `<figure><img src="${pdfSafe(item.url)}" alt="${pdfSafe(item.name || "Imagem do projeto")}"><figcaption>${pdfSafe(item.name || "Imagem")}</figcaption></figure>`).join("")}
      </div>
    </section>`;
}

openBudgetPdf = async function openBudgetPdfProfessional(row) {
  if (!row) return;
  const profile = budgetProfileDefaults(state.cache.loja || {});
  const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(profile.logo_path || profile.logo_url) : profile.logo_url;
  const pdfProfile = { ...profile, logo_url: logoUrl || profile.logo_url || "" };
  const projectImages = typeof g3dBudgetImageUrls === "function" ? await g3dBudgetImageUrls(row) : [];
  const client = (state.cache.clientes || []).find(item => item.id === row.cliente_id);
  const issueDate = new Date();
  const validDays = Number(row.validade_dias || profile.validade_dias || 7);
  const validDate = new Date(issueDate.getTime() + validDays * 86400000);
  const breakdown = typeof commercialBudgetBreakdown === "function" ? commercialBudgetBreakdown(row) : null;
  const subtotal = breakdown ? breakdown.commercialSubtotal : Number(row.total || 0);
  const discounts = breakdown ? breakdown.discountPercent + breakdown.discountValue : Number(row.desconto_valor || 0);
  const total = Number(row.total || breakdown?.total || calculatePrice(row));
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir o orçamento.");

  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${pdfSafe(row.numero || "Orçamento")}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.pdf-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.pdf-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.pdf-page{width:min(960px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.pdf-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.pdf-header h1{margin:0 0 7px;font-size:32px}.pdf-header p{margin:0 0 5px}.pdf-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.pdf-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.pdf-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.pdf-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.pdf-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.pdf-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.pdf-grid.compact{grid-template-columns:repeat(4,1fr)}.pdf-grid div{padding:13px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.pdf-grid div:nth-child(3n){border-right:0}.pdf-grid.compact div:nth-child(3n){border-right:1px solid #d8dee8}.pdf-grid.compact div:nth-child(4n){border-right:0}.pdf-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.pdf-grid strong{font-size:14px}.pdf-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.pdf-box h3{margin:0 0 10px;font-size:17px}.pdf-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.pdf-money-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #e7ebf0}.pdf-money-row.strong{margin-top:8px;padding:14px 0 0;border-bottom:0;font-size:20px}.pdf-total{margin-top:20px;padding:18px 20px;border-radius:12px;background:#101820;color:white}.pdf-total .pdf-money-row{border:0;padding:0}.pdf-total span{color:#d4dde7}.pdf-total strong{color:#24d982;font-size:32px}.pdf-image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pdf-image-grid figure{margin:0;border:1px solid #d8dee8;border-radius:10px;overflow:hidden;background:#f8fafc}.pdf-image-grid img{width:100%;height:230px;display:block;object-fit:contain;background:white}.pdf-image-grid figcaption{padding:8px 10px;color:#667085;font-size:12px}ul{margin:8px 0 0;padding-left:20px;color:#44515f;line-height:1.55}.pdf-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}@media print{body{background:white}.pdf-actions{display:none}.pdf-page{width:auto;min-height:0;padding:26px}.pdf-box,.pdf-images-box figure{break-inside:avoid}.pdf-image-grid img{height:190px}}@media(max-width:760px){.pdf-header,.pdf-title,.pdf-two{display:block}.pdf-logo{margin-top:14px}.pdf-grid,.pdf-grid.compact,.pdf-image-grid{grid-template-columns:1fr}.pdf-grid div,.pdf-grid.compact div{border-right:0!important}}
  </style>
</head>
<body>
  <div class="pdf-actions"><button onclick="window.print()">Salvar como PDF</button></div>
  <main class="pdf-page">
    ${pdfStoreBlock(pdfProfile)}
    <section class="pdf-title">
      <div>
        <h2>Orçamento ${pdfSafe(row.numero || "")}</h2>
        <p class="muted">Emitido em ${pdfDate(issueDate)} · Válido até ${pdfDate(validDate)}</p>
      </div>
      <span class="pdf-status">${pdfSafe(row.status || "rascunho")}</span>
    </section>

    ${pdfClientBlock(client)}

    <section class="pdf-box">
      <h3>Resumo do projeto</h3>
      <div class="pdf-grid">${pdfCommercialRows(row, breakdown)}</div>
    </section>

    ${pdfProjectImages(projectImages)}

    ${pdfTechnicalSummary(row, breakdown)}

    <section class="pdf-two">
      <div class="pdf-box">
        <h3>Composição comercial</h3>
        ${pdfMoneyRow("Subtotal técnico/comercial", subtotal)}
        ${pdfMoneyRow("Urgência", breakdown?.urgency || 0)}
        ${pdfMoneyRow("Frete/entrega", breakdown?.freight || Number(row.frete_valor || 0))}
        ${pdfMoneyRow("Descontos", discounts)}
      </div>
      <div class="pdf-box">
        <h3>Condições</h3>
        ${pdfTerms(profile, row)}
      </div>
    </section>

    ${row.observacao ? `<section class="pdf-box"><h3>Observações do orçamento</h3><p class="muted">${pdfSafe(row.observacao)}</p></section>` : ""}

    <section class="pdf-total">
      ${pdfMoneyRow("Total do orçamento", total, true)}
    </section>

    <section class="pdf-footer">
      <span>${pdfSafe(profile.nome_loja || "G3D Pro")}</span>
      <span>Documento gerado pelo G3D Pro</span>
    </section>
  </main>
</body>
</html>`);
  win.document.close();
};