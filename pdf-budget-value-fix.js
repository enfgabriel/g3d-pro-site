(function () {
  function fixedPdfNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function fixedPdfCanonicalBreakdown(row = {}) {
    if (typeof commercialBudgetBreakdown === "function") return commercialBudgetBreakdown(row);
    return null;
  }

  function fixedPdfCanonicalTotal(row = {}, breakdown = null) {
    if (breakdown && Number.isFinite(Number(breakdown.total))) return Number(breakdown.total);
    if (typeof calculatePrice === "function") return Number(calculatePrice(row) || 0);
    return fixedPdfNumber(row.total, 0);
  }

  function fixedPdfOpen(html) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      URL.revokeObjectURL(url);
      if (typeof showToast === "function") showToast("Permita pop-ups para abrir o orçamento.");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function fixedPdfLogoProfile() {
    const profileBase = typeof budgetProfileDefaults === "function" ? budgetProfileDefaults(state.cache.loja || {}) : (state.cache.loja || {});
    const logoSource = profileBase.logo_path || profileBase.logo_url || "";
    const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profileBase.logo_url;
    return { ...profileBase, logo_url: logoUrl || profileBase.logo_url || "" };
  }

  openBudgetPdf = async function openBudgetPdfWithFixedValue(row) {
    if (!row) return;
    try {
      const profile = await fixedPdfLogoProfile();
      const projectImages = typeof g3dBudgetImageUrls === "function" ? await g3dBudgetImageUrls(row) : [];
      const client = (state.cache.clientes || []).find(item => item.id === row.cliente_id);
      const issueDate = new Date();
      const validDays = fixedPdfNumber(row.validade_dias || profile.validade_dias || 7, 7);
      const validDate = new Date(issueDate.getTime() + validDays * 86400000);
      const breakdown = fixedPdfCanonicalBreakdown(row);
      const subtotal = breakdown ? fixedPdfNumber(breakdown.commercialSubtotal, 0) : fixedPdfNumber(row.total, 0);
      const discounts = breakdown ? fixedPdfNumber(breakdown.discountPercent, 0) + fixedPdfNumber(breakdown.discountValue, 0) : fixedPdfNumber(row.desconto_valor, 0);
      const total = fixedPdfCanonicalTotal(row, breakdown);
      const pdfRow = { ...row, total: Number(total.toFixed(2)) };

      if (typeof finalPdfBuild === "function") {
        fixedPdfOpen(finalPdfBuild(pdfRow, { profile, client, issueDate, validDate, breakdown, subtotal, discounts, total, projectImages }));
      } else if (typeof showToast === "function") {
        showToast("PDF final ainda não carregou. Recarregue a página.");
      }
    } catch (error) {
      console.error(error);
      if (typeof showToast === "function") showToast("Não foi possível gerar o PDF do orçamento.");
    }
  };

  window.G3D_PDF_BUDGET_VALUE_FIX = true;
})();
