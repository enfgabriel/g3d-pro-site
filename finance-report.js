function financeReportDate(value = new Date()) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function financeReportDateInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function financeReportSafe(value) {
  return escapeHtml(value || "");
}

function financeReportOrderDate(row) {
  return row.pago_em || row.created_at || row.data_entrega || row.vencimento_pagamento || row.updated_at || null;
}

function financeReportOrderDateObj(row) {
  const raw = financeReportOrderDate(row);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function financeReportClient(row) {
  if (!row?.cliente_id) return null;
  return (state.cache.clientes || []).find(client => client.id === row.cliente_id) || null;
}

function financeReportPaymentMethod(value) {
  if (typeof orderDocumentPaymentMethod === "function") return orderDocumentPaymentMethod(value);
  const methods = { cartao: "Cartão", pix: "Pix manual", dinheiro: "Dinheiro", transferencia: "Transferência", boleto: "Boleto", outro: "Outro" };
  return methods[String(value || "").toLowerCase()] || "Não informado";
}

function financeReportDefaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: financeReportDateInput(start), end: financeReportDateInput(end) };
}

function financeReportRows(startValue, endValue) {
  const start = startValue ? new Date(`${startValue}T00:00:00`) : null;
  const end = endValue ? new Date(`${endValue}T23:59:59`) : null;
  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(0, 0, 0, 0);
  return (state.cache.pedidos || []).filter(row => {
    const date = financeReportOrderDateObj(row);
    if (!date) return true;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
}

function financeReportSummary(rows) {
  return {
    sold: rows.reduce((sum, row) => sum + financeOrderTotal(row), 0),
    paid: rows.reduce((sum, row) => sum + financePaid(row), 0),
    remaining: rows.reduce((sum, row) => sum + financeRemaining(row), 0),
    overdue: rows.filter(row => financeStatusKey(row) === "atrasado").length,
    paidOrders: rows.filter(row => financeStatusKey(row) === "pago").length,
    openOrders: rows.filter(row => !["pago", "cancelado"].includes(financeStatusKey(row))).length
  };
}

function financeReportStoreBlock(profile) {
  const contact = [profile.documento, profile.whatsapp, profile.email, profile.site].filter(Boolean).join(" | ");
  const address = [profile.endereco, profile.cidade, profile.estado].filter(Boolean).join(" - ");
  return `
    <section class="report-header">
      <div>
        <h1>${financeReportSafe(profile.nome_loja || "G3D Pro")}</h1>
        <p>Relatório financeiro</p>
        <p class="muted">${financeReportSafe(contact)}</p>
        <p class="muted">${financeReportSafe(address)}</p>
      </div>
      <div class="report-logo">${profile.logo_url ? `<img src="${financeReportSafe(profile.logo_url)}" alt="Logo">` : "G3D"}</div>
    </section>`;
}

function financeReportMetric(label, value) {
  return `<div><span>${financeReportSafe(label)}</span><strong>${typeof value === "number" ? money(value) : financeReportSafe(value)}</strong></div>`;
}

function financeReportRowsHtml(rows) {
  if (!rows.length) return `<tr><td colspan="7" class="empty">Nenhum pedido no período.</td></tr>`;
  return rows.map(row => {
    const client = financeReportClient(row);
    const pay = financeStatusInfo(row);
    return `<tr>
      <td>${financeReportSafe(financeReportDate(financeReportOrderDate(row)) || "-")}</td>
      <td><strong>${financeReportSafe(row.numero || "")}</strong><br><span>${financeReportSafe(row.titulo || "")}</span></td>
      <td>${financeReportSafe(client ? (client.nome || client.empresa || "") : "Não vinculado")}</td>
      <td>${financeReportSafe(pay.label)}</td>
      <td>${financeReportSafe(financeReportPaymentMethod(row.forma_pagamento))}</td>
      <td>${money(financeOrderTotal(row))}<br><span>Pago ${money(financePaid(row))}</span></td>
      <td>${money(financeRemaining(row))}</td>
    </tr>`;
  }).join("");
}

async function openFinanceReportPdf(startValue, endValue) {
  const rows = financeReportRows(startValue, endValue);
  const summary = financeReportSummary(rows);
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir o relatório financeiro.");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando relatório</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Arial;background:#101820;color:white}.box{padding:24px;text-align:center}.box strong{display:block;margin-bottom:8px;color:#24d982}</style></head><body><div class="box"><strong>G3D Pro</strong><span>Preparando relatório financeiro...</span></div></body></html>`);
  win.document.close();

  const profileBase = typeof budgetProfileDefaults === "function" ? budgetProfileDefaults(state.cache.loja || {}) : (state.cache.loja || {});
  const logoSource = profileBase.logo_path || profileBase.logo_url || state.cache.loja?.logo_path || state.cache.loja?.logo_url || "";
  const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profileBase.logo_url;
  const profile = { ...profileBase, logo_url: logoUrl || profileBase.logo_url || "" };
  const period = `${startValue ? financeReportDate(startValue) : "Início"} a ${endValue ? financeReportDate(endValue) : "Hoje"}`;

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório financeiro</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.report-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.report-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.report-page{width:min(1080px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.report-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.report-header h1{margin:0 0 7px;font-size:32px}.report-header p{margin:0 0 5px}.report-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.report-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.report-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.report-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.report-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.report-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.report-grid div{padding:14px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.report-grid div:nth-child(4n){border-right:0}.report-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.report-grid strong{font-size:18px}.report-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.report-box h3{margin:0 0 10px;font-size:17px}.report-table{width:100%;border-collapse:collapse;margin-top:10px}.report-table th,.report-table td{padding:10px;border-bottom:1px solid #e7ebf0;text-align:left;vertical-align:top}.report-table th{color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc}.report-table td{font-size:13px}.report-table span{color:#667085;font-size:12px}.empty{text-align:center;color:#667085;padding:24px!important}.report-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}@media print{body{background:white}.report-actions{display:none}.report-page{width:auto;min-height:0;padding:22px}.report-box{break-inside:avoid}.report-table th,.report-table td{padding:7px;font-size:11px}}@media(max-width:760px){.report-header,.report-title{display:block}.report-logo{margin-top:14px}.report-grid{grid-template-columns:1fr}.report-grid div{border-right:0!important}.report-table{font-size:12px}}
  </style>
</head>
<body>
  <div class="report-actions"><button onclick="window.print()">Salvar como PDF</button></div>
  <main class="report-page">
    ${financeReportStoreBlock(profile)}
    <section class="report-title">
      <div>
        <h2>Relatório Financeiro</h2>
        <p class="muted">Período: ${financeReportSafe(period)} · Emitido em ${financeReportDate(new Date())}</p>
      </div>
      <span class="report-status">${rows.length} pedido(s)</span>
    </section>

    <section class="report-grid">
      ${financeReportMetric("Total vendido", summary.sold)}
      ${financeReportMetric("Recebido", summary.paid)}
      ${financeReportMetric("A receber", summary.remaining)}
      ${financeReportMetric("Atrasados", String(summary.overdue))}
      ${financeReportMetric("Pedidos pagos", String(summary.paidOrders))}
      ${financeReportMetric("Pedidos em aberto", String(summary.openOrders))}
      ${financeReportMetric("Ticket médio", rows.length ? summary.sold / rows.length : 0)}
      ${financeReportMetric("Pedidos no período", String(rows.length))}
    </section>

    <section class="report-box">
      <h3>Pedidos do período</h3>
      <table class="report-table">
        <thead><tr><th>Data</th><th>Pedido</th><th>Cliente</th><th>Status</th><th>Forma</th><th>Valores</th><th>A receber</th></tr></thead>
        <tbody>${financeReportRowsHtml(rows)}</tbody>
      </table>
    </section>

    <section class="report-box">
      <h3>Leitura rápida</h3>
      <p class="muted">O relatório considera os pedidos carregados no G3D Pro e usa a melhor data disponível do pedido: pagamento, criação, entrega, vencimento ou atualização.</p>
      <p class="muted">Valores sem pagamento registrado entram como pendentes ou a receber. Pedidos vencidos sem quitação aparecem como atrasados.</p>
    </section>

    <section class="report-footer">
      <span>${financeReportSafe(profile.nome_loja || "G3D Pro")}</span>
      <span>Documento gerado pelo G3D Pro para acompanhamento interno.</span>
    </section>
  </main>
</body>
</html>`);
  win.document.close();
}

function attachFinanceReportPanel(el) {
  if (!el || el.querySelector("#financeReportPanel")) return;
  const range = financeReportDefaultRange();
  const summary = el.querySelector(".finance-summary");
  const panel = document.createElement("section");
  panel.className = "card finance-report-panel";
  panel.id = "financeReportPanel";
  panel.innerHTML = `
    <div class="section-head">
      <div><h2>Relatório financeiro</h2><p class="muted">Gere um PDF por período com vendidos, recebidos, a receber e atrasados.</p></div>
      <button class="btn primary" type="button" id="openFinanceReportPdf">Relatório/PDF</button>
    </div>
    <div class="form-grid">
      <div class="field"><label>Data inicial</label><input type="date" id="financeReportStart" value="${financeReportSafe(range.start)}"></div>
      <div class="field"><label>Data final</label><input type="date" id="financeReportEnd" value="${financeReportSafe(range.end)}"></div>
    </div>`;
  if (summary) summary.insertAdjacentElement("afterend", panel);
  else el.prepend(panel);
  document.getElementById("openFinanceReportPdf").addEventListener("click", () => {
    openFinanceReportPdf(document.getElementById("financeReportStart").value, document.getElementById("financeReportEnd").value);
  });
}

if (typeof renderPedidosProfessional === "function") {
  const financeReportPreviousRenderPedidosProfessional = renderPedidosProfessional;
  renderPedidosProfessional = function renderPedidosProfessionalWithReport(el) {
    financeReportPreviousRenderPedidosProfessional(el);
    attachFinanceReportPanel(el);
  };
}
