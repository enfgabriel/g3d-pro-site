(function () {
  function finalPdfPlaceholder() {
    const win = window.open("", "_blank");
    if (!win) {
      if (typeof showToast === "function") showToast("Permita pop-ups para abrir o documento.");
      return null;
    }
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando PDF</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Arial;background:#101820;color:white}.box{padding:24px;text-align:center}.box strong{display:block;margin-bottom:8px;color:#24d982}</style></head><body><div class="box"><strong>G3D Pro</strong><span>Preparando orçamento...</span></div></body></html>`);
    win.document.close();
    return win;
  }

  function finalPdfOpen(html, filename, win = null) {
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return win;
    }
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const newWin = window.open(url, "_blank", "noopener,noreferrer");
    if (!newWin) {
      URL.revokeObjectURL(url);
      if (typeof showToast === "function") showToast("Permita pop-ups para abrir o documento.");
      return null;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return newWin;
  }

  function finalPdfError(win, message) {
    if (!win) return;
    win.document.open();
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Erro no PDF</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Arial;background:#101820;color:white}.box{max-width:520px;padding:24px;text-align:center}.box strong{display:block;margin-bottom:8px;color:#ffb4a8}</style></head><body><div class="box"><strong>Não foi possível gerar o PDF</strong><span>${finalPdfSafe(message)}</span></div></body></html>`);
    win.document.close();
  }

  function finalPdfSafe(value) {
    if (typeof pdfSafe === "function") return pdfSafe(value);
    if (typeof escapeHtml === "function") return escapeHtml(value || "");
    return String(value || "").replace(/[&<>'"]/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    }[char]));
  }

  function finalPdfMoney(value) {
    if (typeof money === "function") return money(value);
    return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function finalPdfDate(value = new Date()) {
    if (typeof pdfDate === "function") return pdfDate(value);
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR");
  }

  function finalPdfMoneyRow(label, value, strong = false) {
    if (typeof pdfMoneyRow === "function") return pdfMoneyRow(label, value, strong);
    return `<div class="pdf-money-row ${strong ? "strong" : ""}"><span>${finalPdfSafe(label)}</span><strong>${finalPdfMoney(value)}</strong></div>`;
  }

  function finalPdfStyles() {
    return `
      *{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.pdf-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.pdf-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.pdf-page{width:min(960px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.pdf-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.pdf-header h1{margin:0 0 7px;font-size:32px}.pdf-header p{margin:0 0 5px}.pdf-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.pdf-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.pdf-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.pdf-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.pdf-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.pdf-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.pdf-grid.compact{grid-template-columns:repeat(4,1fr)}.pdf-grid div{padding:13px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.pdf-grid div:nth-child(3n){border-right:0}.pdf-grid.compact div:nth-child(3n){border-right:1px solid #d8dee8}.pdf-grid.compact div:nth-child(4n){border-right:0}.pdf-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.pdf-grid strong{font-size:14px}.pdf-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.pdf-box h3{margin:0 0 10px;font-size:17px}.pdf-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.pdf-money-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #e7ebf0}.pdf-money-row.strong{margin-top:8px;padding:14px 0 0;border-bottom:0;font-size:20px}.pdf-total{margin-top:20px;padding:18px 20px;border-radius:12px;background:#101820;color:white}.pdf-total .pdf-money-row{border:0;padding:0}.pdf-total span{color:#d4dde7}.pdf-total strong{color:#24d982;font-size:32px}.pdf-image-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pdf-image-grid figure{margin:0;border:1px solid #d8dee8;border-radius:10px;overflow:hidden;background:#f8fafc}.pdf-image-grid img{width:100%;height:230px;display:block;object-fit:contain;background:white}.pdf-image-grid figcaption{padding:8px 10px;color:#667085;font-size:12px}ul{margin:8px 0 0;padding-left:20px;color:#44515f;line-height:1.55}.pdf-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}@media print{body{background:white}.pdf-actions{display:none}.pdf-page{width:auto;min-height:0;padding:26px}.pdf-box,.pdf-images-box figure{break-inside:avoid}.pdf-image-grid img{height:190px}}@media(max-width:760px){.pdf-header,.pdf-title,.pdf-two{display:block}.pdf-logo{margin-top:14px}.pdf-grid,.pdf-grid.compact,.pdf-image-grid{grid-template-columns:1fr}.pdf-grid div,.pdf-grid.compact div{border-right:0!important}}
    `;
  }

  function finalPdfBuild(row, context) {
    const { profile, client, issueDate, validDate, breakdown, subtotal, discounts, total, projectImages } = context;
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${finalPdfSafe(row.numero || "Orcamento")}</title>
  <style>${finalPdfStyles()}</style>
</head>
<body>
  <div class="pdf-actions"><button onclick="window.print()">Salvar como PDF</button></div>
  <main class="pdf-page">
    ${typeof pdfStoreBlock === "function" ? pdfStoreBlock(profile) : ""}
    <section class="pdf-title">
      <div>
        <h2>Orçamento ${finalPdfSafe(row.numero || "")}</h2>
        <p class="muted">Emitido em ${finalPdfDate(issueDate)} · Válido até ${finalPdfDate(validDate)}</p>
      </div>
      <span class="pdf-status">${finalPdfSafe(row.status || "rascunho")}</span>
    </section>

    ${typeof pdfClientBlock === "function" ? pdfClientBlock(client) : ""}

    <section class="pdf-box">
      <h3>Resumo do projeto</h3>
      <div class="pdf-grid">${typeof pdfCommercialRows === "function" ? pdfCommercialRows(row, breakdown) : ""}</div>
    </section>

    ${typeof pdfProjectImages === "function" ? pdfProjectImages(projectImages) : ""}

    ${typeof pdfTechnicalSummary === "function" ? pdfTechnicalSummary(row, breakdown) : ""}

    <section class="pdf-two">
      <div class="pdf-box">
        <h3>Composição comercial</h3>
        ${finalPdfMoneyRow("Subtotal técnico/comercial", subtotal)}
        ${finalPdfMoneyRow("Urgência", breakdown?.urgency || 0)}
        ${finalPdfMoneyRow("Frete/entrega", breakdown?.freight || Number(row.frete_valor || 0))}
        ${finalPdfMoneyRow("Descontos", discounts)}
      </div>
      <div class="pdf-box">
        <h3>Condições</h3>
        ${typeof pdfTerms === "function" ? pdfTerms(profile, row) : ""}
      </div>
    </section>

    ${row.observacao ? `<section class="pdf-box"><h3>Observações do orçamento</h3><p class="muted">${finalPdfSafe(row.observacao)}</p></section>` : ""}

    <section class="pdf-total">
      ${finalPdfMoneyRow("Total do orçamento", total, true)}
    </section>

    <section class="pdf-footer">
      <span>${finalPdfSafe(profile.nome_loja || "G3D Pro")}</span>
      <span>Documento gerado pelo G3D Pro</span>
    </section>
  </main>
</body>
</html>`;
  }

  openBudgetPdf = async function openBudgetPdfFinal(row) {
    if (!row) return;
    const win = finalPdfPlaceholder();
    if (!win) return;
    try {
      const profileBase = typeof budgetProfileDefaults === "function" ? budgetProfileDefaults(state.cache.loja || {}) : (state.cache.loja || {});
      const logoSource = profileBase.logo_path || profileBase.logo_url || state.cache.loja?.logo_path || state.cache.loja?.logo_url || "";
      const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profileBase.logo_url;
      const profile = { ...profileBase, logo_url: logoUrl || profileBase.logo_url || "" };
      const projectImages = typeof g3dBudgetImageUrls === "function" ? await g3dBudgetImageUrls(row) : [];
      const client = (state.cache.clientes || []).find(item => item.id === row.cliente_id);
      const issueDate = new Date();
      const validDays = Number(row.validade_dias || profile.validade_dias || 7);
      const validDate = new Date(issueDate.getTime() + validDays * 86400000);
      const breakdown = typeof commercialBudgetBreakdown === "function" ? commercialBudgetBreakdown(row) : null;
      const subtotal = breakdown ? breakdown.commercialSubtotal : Number(row.total || 0);
      const discounts = breakdown ? breakdown.discountPercent + breakdown.discountValue : Number(row.desconto_valor || 0);
      const total = Number(breakdown?.total ?? row.total ?? (typeof calculatePrice === "function" ? calculatePrice(row) : 0));
      const pdfRow = { ...row, total: Number(total.toFixed(2)) };
      const html = finalPdfBuild(pdfRow, { profile, client, issueDate, validDate, breakdown, subtotal, discounts, total, projectImages });
      finalPdfOpen(html, row.numero || "orcamento", win);
    } catch (error) {
      console.error(error);
      finalPdfError(win, error.message || "Erro inesperado ao montar o documento.");
      if (typeof showToast === "function") showToast("Não foi possível gerar o PDF do orçamento.");
    }
  };

  window.G3D_PDF_DOCS_FINAL = true;
})();
