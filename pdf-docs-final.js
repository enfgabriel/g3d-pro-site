(function () {
  function pdfFinalSafe(value) {
    if (typeof pdfSafe === "function") return pdfSafe(value);
    if (typeof escapeHtml === "function") return escapeHtml(value || "");
    return String(value || "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function pdfFinalMoney(value) {
    if (typeof money === "function") return money(value);
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function pdfFinalDate(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
  }

  function pdfFinalRow(label, value, strong = false) {
    return `<div class="pdf-money-row ${strong ? "strong" : ""}"><span>${pdfFinalSafe(label)}</span><strong>${pdfFinalMoney(value)}</strong></div>`;
  }

  function pdfFinalStyles() {
    return `*{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.pdf-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.pdf-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.pdf-page{width:min(960px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.pdf-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.pdf-header h1{margin:0 0 7px;font-size:32px}.pdf-header p{margin:0 0 5px}.pdf-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.pdf-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.pdf-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.pdf-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.pdf-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.pdf-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.pdf-grid div{padding:13px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.pdf-grid div:nth-child(3n){border-right:0}.pdf-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.pdf-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.pdf-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.pdf-money-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #e7ebf0}.pdf-money-row.strong{margin-top:8px;padding:14px 0 0;border-bottom:0;font-size:20px}.pdf-total{margin-top:20px;padding:18px 20px;border-radius:12px;background:#101820;color:white}.pdf-total .pdf-money-row{border:0;padding:0}.pdf-total span{color:#d4dde7}.pdf-total strong{color:#24d982;font-size:32px}.pdf-image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pdf-image-grid figure{margin:0;border:1px solid #d8dee8;border-radius:10px;overflow:hidden;background:#f8fafc}.pdf-image-grid img{width:100%;height:230px;display:block;object-fit:contain;background:white}.pdf-image-grid figcaption{padding:8px 10px;color:#667085;font-size:12px}.pdf-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}ul{margin:8px 0 0;padding-left:20px;color:#44515f;line-height:1.55}@media print{body{background:white}.pdf-actions{display:none}.pdf-page{width:auto;min-height:0;padding:26px}.pdf-box,.pdf-images-box figure{break-inside:avoid}}@media(max-width:760px){.pdf-header,.pdf-title,.pdf-two{display:block}.pdf-logo{margin-top:14px}.pdf-grid,.pdf-image-grid{grid-template-columns:1fr}.pdf-grid div{border-right:0!important}}`;
  }

  function pdfFinalStoreBlock(profile) {
    if (typeof pdfStoreBlock === "function") return pdfStoreBlock(profile);
    const contact = [profile.documento, profile.whatsapp, profile.email, profile.site].filter(Boolean).join(" | ");
    const address = [profile.endereco, profile.cidade, profile.estado].filter(Boolean).join(" - ");
    return `<section class="pdf-header"><div><h1>${pdfFinalSafe(profile.nome_loja || "G3D Pro")}</h1><p>${pdfFinalSafe(profile.responsavel || "ERP para impressão 3D")}</p><p class="muted">${pdfFinalSafe(contact)}</p><p class="muted">${pdfFinalSafe(address)}</p></div><div class="pdf-logo">${profile.logo_url ? `<img src="${pdfFinalSafe(profile.logo_url)}" alt="Logo">` : "G3D"}</div></section>`;
  }

  function pdfFinalClientBlock(client) {
    if (typeof pdfClientBlock === "function") return pdfClientBlock(client);
    if (!client) return `<section class="pdf-box"><h3>Cliente</h3><p class="muted">Cliente não vinculado.</p></section>`;
    return `<section class="pdf-box"><h3>Cliente</h3><p><strong>${pdfFinalSafe(client.nome || client.empresa || "")}</strong></p><p class="muted">${pdfFinalSafe([client.cpf_cnpj, client.email, client.telefone, client.whatsapp].filter(Boolean).join(" | "))}</p></section>`;
  }

  function pdfFinalRows(row, breakdown) {
    if (typeof pdfCommercialRows === "function") return pdfCommercialRows(row, breakdown);
    const rows = [["Projeto", row.projeto || ""], ["Quantidade", `${row.quantidade_pecas || 1} peça(s)`], ["Material", [row.material, row.cor].filter(Boolean).join(" - ")], ["Peso por peça", `${row.peso_g || 0} g/ml`], ["Tempo por peça", `${row.horas || 0} h`], ["Prazo", row.prazo_entrega || "A combinar"]];
    return rows.map(([label, value]) => `<div><span>${pdfFinalSafe(label)}</span><strong>${pdfFinalSafe(value)}</strong></div>`).join("");
  }

  function pdfFinalImages(images) {
    if (typeof pdfProjectImages === "function") return pdfProjectImages(images);
    return "";
  }

  function pdfFinalTerms(profile, row) {
    if (typeof pdfTerms === "function") return pdfTerms(profile, row);
    return `<ul><li>Pagamento combinado diretamente com a loja.</li><li>Produção iniciada conforme aprovação comercial.</li></ul>`;
  }

  function pdfFinalBuild(row, context) {
    const { profile, client, issueDate, validDate, breakdown, subtotal, discounts, total, projectImages } = context;
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${pdfFinalSafe(row.numero || "Orçamento")}</title><style>${pdfFinalStyles()}</style></head><body><div class="pdf-actions"><button onclick="window.print()">Salvar como PDF</button></div><main class="pdf-page">${pdfFinalStoreBlock(profile)}<section class="pdf-title"><div><h2>Orçamento ${pdfFinalSafe(row.numero || "")}</h2><p class="muted">Emitido em ${pdfFinalDate(issueDate)} · Válido até ${pdfFinalDate(validDate)}</p></div><span class="pdf-status">${pdfFinalSafe(row.status || "rascunho")}</span></section>${pdfFinalClientBlock(client)}<section class="pdf-box"><h3>Resumo do projeto</h3><div class="pdf-grid">${pdfFinalRows(row, breakdown)}</div></section>${pdfFinalImages(projectImages)}${typeof pdfTechnicalSummary === "function" ? pdfTechnicalSummary(row, breakdown) : ""}<section class="pdf-two"><div class="pdf-box"><h3>Composição comercial</h3>${pdfFinalRow("Subtotal técnico/comercial", subtotal)}${pdfFinalRow("Urgência", breakdown?.urgency || 0)}${pdfFinalRow("Frete/entrega", breakdown?.freight || Number(row.frete_valor || 0))}${pdfFinalRow("Descontos", discounts)}</div><div class="pdf-box"><h3>Condições</h3>${pdfFinalTerms(profile, row)}</div></section>${row.observacao ? `<section class="pdf-box"><h3>Observações do orçamento</h3><p class="muted">${pdfFinalSafe(row.observacao)}</p></section>` : ""}<section class="pdf-total">${pdfFinalRow("Total do orçamento", total, true)}</section><section class="pdf-footer"><span>${pdfFinalSafe(profile.nome_loja || "G3D Pro")}</span><span>Documento gerado pelo G3D Pro</span></section></main></body></html>`;
  }

  function pdfFinalNavigate(win, html) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    win.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  openBudgetPdf = async function openBudgetPdfFinal(row) {
    if (!row) return;
    const win = window.open("", "_blank");
    if (!win) return showToast("Permita pop-ups para abrir o orçamento.");
    try {
      win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando PDF</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Arial;background:#101820;color:white}.box{padding:24px;text-align:center}.box strong{display:block;margin-bottom:8px;color:#24d982}</style></head><body><div class="box"><strong>G3D Pro</strong><span>Preparando orçamento...</span></div></body></html>`);
      win.document.close();
    } catch (_error) {}

    const profileBase = typeof budgetProfileDefaults === "function" ? budgetProfileDefaults(state.cache.loja || {}) : (state.cache.loja || {});
    let profile = { ...profileBase };
    let projectImages = [];
    try {
      const logoSource = profileBase.logo_path || profileBase.logo_url || state.cache.loja?.logo_path || state.cache.loja?.logo_url || "";
      const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profileBase.logo_url;
      profile = { ...profileBase, logo_url: logoUrl || profileBase.logo_url || "" };
    } catch (error) {
      console.warn("Logo indisponível no PDF", error);
    }
    try {
      projectImages = typeof g3dBudgetImageUrls === "function" ? await g3dBudgetImageUrls(row) : [];
    } catch (error) {
      console.warn("Imagens indisponíveis no PDF", error);
    }

    try {
      const client = (state.cache.clientes || []).find(item => item.id === row.cliente_id);
      const issueDate = new Date();
      const validDays = Number(row.validade_dias || profile.validade_dias || 7);
      const validDate = new Date(issueDate.getTime() + validDays * 86400000);
      const breakdown = typeof commercialBudgetBreakdown === "function" ? commercialBudgetBreakdown(row) : null;
      const subtotal = breakdown ? breakdown.commercialSubtotal : Number(row.total || 0);
      const discounts = breakdown ? breakdown.discountPercent + breakdown.discountValue : Number(row.desconto_valor || 0);
      const total = Number(breakdown?.total ?? row.total ?? (typeof calculatePrice === "function" ? calculatePrice(row) : 0));
      const html = pdfFinalBuild({ ...row, total: Number(total.toFixed(2)) }, { profile, client, issueDate, validDate, breakdown, subtotal, discounts, total, projectImages });
      pdfFinalNavigate(win, html);
    } catch (error) {
      console.error(error);
      const fallbackTotal = Number(row.total ?? 0);
      const html = pdfFinalBuild({ ...row, total: fallbackTotal }, { profile, client: null, issueDate: new Date(), validDate: new Date(Date.now() + 7 * 86400000), breakdown: null, subtotal: fallbackTotal, discounts: 0, total: fallbackTotal, projectImages: [] });
      pdfFinalNavigate(win, html);
      if (typeof showToast === "function") showToast("PDF gerado em modo básico.");
    }
  };

  window.G3D_PDF_DOCS_FINAL = true;
})();
