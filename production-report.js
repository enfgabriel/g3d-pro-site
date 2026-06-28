function productionReportParseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`);
  return new Date(value);
}

function productionReportDate(value = new Date()) {
  const date = productionReportParseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function productionReportDateTime(value) {
  const date = productionReportParseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function productionReportDateInput(value) {
  const date = productionReportParseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function productionReportSafe(value) {
  return escapeHtml(value || "");
}

function productionReportStageKey(row) {
  if (typeof productionStageKey === "function") return productionStageKey(row.status || row.etapa_atual || "fila");
  return String(row.status || row.etapa_atual || "fila").toLowerCase().trim();
}

function productionReportStageLabel(row) {
  if (typeof productionStageLabel === "function") return productionStageLabel(row.status || row.etapa_atual || "fila");
  return row.status || row.etapa_atual || "Fila";
}

function productionReportOrder(row) {
  if (!row?.pedido_id) return null;
  return (state.cache.pedidos || []).find(order => order.id === row.pedido_id) || null;
}

function productionReportBudget(row) {
  if (!row?.orcamento_id) return null;
  return (state.cache.orcamentos || []).find(budget => budget.id === row.orcamento_id) || null;
}

function productionReportClient(row, order, budget) {
  const clientId = row?.cliente_id || order?.cliente_id || budget?.cliente_id;
  if (!clientId) return null;
  return (state.cache.clientes || []).find(client => client.id === clientId) || null;
}

function productionReportMainDate(row) {
  const stage = productionReportStageKey(row);
  if (stage === "entregue") return row.entregue_em || row.pronto_em || row.estoque_baixado_em || row.updated_at || row.created_at;
  if (stage === "pronto") return row.pronto_em || row.estoque_baixado_em || row.updated_at || row.created_at;
  if (stage === "falha") return row.falha_em || row.updated_at || row.created_at;
  if (stage === "pos") return row.pos_iniciado_em || row.updated_at || row.created_at;
  if (stage === "imprimindo") return row.impressao_iniciada_em || row.iniciado_em || row.updated_at || row.created_at;
  return row.created_at || row.data_prevista || row.updated_at || null;
}

function productionReportMainDateObj(row) {
  const date = productionReportParseDate(productionReportMainDate(row));
  if (!date || Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function productionReportConsumption(row) {
  if (typeof productionConsumption === "function") return Number(productionConsumption(row) || 0);
  const explicit = Number(row.consumo_material_g || 0);
  if (explicit > 0) return explicit;
  return Number(row.peso_g || 0) * Math.max(1, Number(row.quantidade_pecas || 1));
}

function productionReportTime(row) {
  return Number(row.tempo_horas || row.horas || 0);
}

function productionReportDefaultRange() {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), 1);
  return { start: productionReportDateInput(start), end: productionReportDateInput(end) };
}

function productionReportRows(startValue, endValue, statusValue) {
  const start = startValue ? productionReportParseDate(startValue) : null;
  const end = endValue ? productionReportParseDate(endValue) : null;
  if (start) start.setHours(0, 0, 0, 0);
  if (end) end.setHours(23, 59, 59, 999);
  const status = String(statusValue || "todos");
  return (state.cache.producoes || []).filter(row => {
    const stage = productionReportStageKey(row);
    if (status !== "todos" && stage !== status) return false;
    const date = productionReportMainDateObj(row);
    if (!date) return true;
    if (start && date < start) return false;
    if (end && date > end) return false;
    return true;
  });
}

function productionReportSummary(rows) {
  const finished = rows.filter(row => ["pronto", "entregue"].includes(productionReportStageKey(row))).length;
  const active = rows.filter(row => ["fila", "imprimindo", "pos"].includes(productionReportStageKey(row))).length;
  const failures = rows.filter(row => productionReportStageKey(row) === "falha").length;
  const stockDone = rows.filter(row => row.estoque_baixado).length;
  const consumption = rows.reduce((sum, row) => sum + productionReportConsumption(row), 0);
  const hours = rows.reduce((sum, row) => sum + productionReportTime(row), 0);
  return { total: rows.length, active, finished, failures, stockDone, consumption, hours };
}

function productionReportStoreBlock(profile) {
  const contact = [profile.documento, profile.whatsapp, profile.email, profile.site].filter(Boolean).join(" | ");
  const address = [profile.endereco, profile.cidade, profile.estado].filter(Boolean).join(" - ");
  return `
    <section class="prod-report-header">
      <div>
        <h1>${productionReportSafe(profile.nome_loja || "G3D Pro")}</h1>
        <p>Relatório de produção</p>
        <p class="muted">${productionReportSafe(contact)}</p>
        <p class="muted">${productionReportSafe(address)}</p>
      </div>
      <div class="prod-report-logo">${profile.logo_url ? `<img src="${productionReportSafe(profile.logo_url)}" alt="Logo">` : "G3D"}</div>
    </section>`;
}

function productionReportMetric(label, value, suffix = "") {
  const display = typeof value === "number" ? value.toLocaleString("pt-BR") : productionReportSafe(value);
  return `<div><span>${productionReportSafe(label)}</span><strong>${display}${suffix}</strong></div>`;
}

function productionReportRowsHtml(rows) {
  if (!rows.length) return `<tr><td colspan="8" class="empty">Nenhuma produção no período.</td></tr>`;
  return rows.map(row => {
    const order = productionReportOrder(row);
    const budget = productionReportBudget(row);
    const client = productionReportClient(row, order, budget);
    const material = [row.material || order?.material || budget?.material, row.cor || order?.cor || budget?.cor].filter(Boolean).join(" - ");
    return `<tr>
      <td>${productionReportSafe(productionReportDate(productionReportMainDate(row)) || "-")}</td>
      <td><strong>${productionReportSafe(row.numero || "")}</strong><br><span>${productionReportSafe(row.titulo || "")}</span></td>
      <td>${productionReportSafe(order?.numero || budget?.numero || "Manual")}</td>
      <td>${productionReportSafe(client ? (client.nome || client.empresa || "") : "Não vinculado")}</td>
      <td>${productionReportSafe(productionReportStageLabel(row))}</td>
      <td>${productionReportSafe(material || "Não informado")}</td>
      <td>${productionReportConsumption(row).toLocaleString("pt-BR")} g/ml<br><span>${productionReportTime(row).toLocaleString("pt-BR")} h</span></td>
      <td>${row.estoque_baixado ? "Baixado" : "Pendente"}${row.falha_motivo ? `<br><span>Falha: ${productionReportSafe(row.falha_motivo)}</span>` : ""}</td>
    </tr>`;
  }).join("");
}

function productionReportHistoryHtml(rows) {
  const productionIds = new Set(rows.map(row => row.id));
  const history = (state.cache.producao_historico || [])
    .filter(item => !productionIds.size || productionIds.has(item.producao_id))
    .slice(0, 12);
  if (!history.length) return `<tr><td colspan="5" class="empty">Nenhum histórico encontrado para o filtro atual.</td></tr>`;
  return history.map(item => `<tr>
    <td>${productionReportSafe(productionReportDateTime(item.created_at) || "-")}</td>
    <td>${productionReportSafe(item.producao_numero || item.producao_titulo || "")}</td>
    <td>${productionReportSafe(item.tipo || "")}</td>
    <td>${productionReportSafe([item.material, item.cor].filter(Boolean).join(" - "))}</td>
    <td>${Number(item.consumo_material_g || 0).toLocaleString("pt-BR")} g/ml</td>
  </tr>`).join("");
}

async function openProductionReportPdf(startValue, endValue, statusValue) {
  const rows = productionReportRows(startValue, endValue, statusValue);
  const summary = productionReportSummary(rows);
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir o relatório de produção.");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando relatório</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Arial;background:#101820;color:white}.box{padding:24px;text-align:center}.box strong{display:block;margin-bottom:8px;color:#24d982}</style></head><body><div class="box"><strong>G3D Pro</strong><span>Preparando relatório de produção...</span></div></body></html>`);
  win.document.close();

  const profileBase = typeof budgetProfileDefaults === "function" ? budgetProfileDefaults(state.cache.loja || {}) : (state.cache.loja || {});
  const logoSource = profileBase.logo_path || profileBase.logo_url || state.cache.loja?.logo_path || state.cache.loja?.logo_url || "";
  const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profileBase.logo_url;
  const profile = { ...profileBase, logo_url: logoUrl || profileBase.logo_url || "" };
  const period = `${startValue ? productionReportDate(startValue) : "Início"} a ${endValue ? productionReportDate(endValue) : "Hoje"}`;
  const statusLabel = statusValue && statusValue !== "todos" ? productionReportStageLabel({ status: statusValue }) : "Todos";

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Relatório de produção</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.prod-report-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.prod-report-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.prod-report-page{width:min(1120px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.prod-report-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.prod-report-header h1{margin:0 0 7px;font-size:32px}.prod-report-header p{margin:0 0 5px}.prod-report-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.prod-report-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.prod-report-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.prod-report-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.prod-report-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.prod-report-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.prod-report-grid div{padding:14px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.prod-report-grid div:nth-child(4n){border-right:0}.prod-report-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.prod-report-grid strong{font-size:18px}.prod-report-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.prod-report-box h3{margin:0 0 10px;font-size:17px}.prod-report-table{width:100%;border-collapse:collapse;margin-top:10px}.prod-report-table th,.prod-report-table td{padding:10px;border-bottom:1px solid #e7ebf0;text-align:left;vertical-align:top}.prod-report-table th{color:#667085;font-size:11px;text-transform:uppercase;letter-spacing:.05em;background:#f8fafc}.prod-report-table td{font-size:13px}.prod-report-table span{color:#667085;font-size:12px}.empty{text-align:center;color:#667085;padding:24px!important}.prod-report-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}@media print{body{background:white}.prod-report-actions{display:none}.prod-report-page{width:auto;min-height:0;padding:22px}.prod-report-box{break-inside:avoid}.prod-report-table th,.prod-report-table td{padding:7px;font-size:11px}}@media(max-width:760px){.prod-report-header,.prod-report-title{display:block}.prod-report-logo{margin-top:14px}.prod-report-grid{grid-template-columns:1fr}.prod-report-grid div{border-right:0!important}.prod-report-table{font-size:12px}}
  </style>
</head>
<body>
  <div class="prod-report-actions"><button onclick="window.print()">Salvar como PDF</button></div>
  <main class="prod-report-page">
    ${productionReportStoreBlock(profile)}
    <section class="prod-report-title">
      <div>
        <h2>Relatório de Produção</h2>
        <p class="muted">Período: ${productionReportSafe(period)} · Status: ${productionReportSafe(statusLabel)} · Emitido em ${productionReportDate(new Date())}</p>
      </div>
      <span class="prod-report-status">${rows.length} produção(ões)</span>
    </section>

    <section class="prod-report-grid">
      ${productionReportMetric("Total no filtro", summary.total)}
      ${productionReportMetric("Em andamento", summary.active)}
      ${productionReportMetric("Prontas/entregues", summary.finished)}
      ${productionReportMetric("Falhas", summary.failures)}
      ${productionReportMetric("Estoque baixado", summary.stockDone)}
      ${productionReportMetric("Consumo total", summary.consumption, " g/ml")}
      ${productionReportMetric("Tempo estimado", summary.hours, " h")}
      ${productionReportMetric("Média consumo", rows.length ? summary.consumption / rows.length : 0, " g/ml")}
    </section>

    <section class="prod-report-box">
      <h3>Produções do período</h3>
      <table class="prod-report-table">
        <thead><tr><th>Data</th><th>Produção</th><th>Origem</th><th>Cliente</th><th>Etapa</th><th>Material</th><th>Consumo/tempo</th><th>Estoque</th></tr></thead>
        <tbody>${productionReportRowsHtml(rows)}</tbody>
      </table>
    </section>

    <section class="prod-report-box">
      <h3>Últimos movimentos do histórico</h3>
      <table class="prod-report-table">
        <thead><tr><th>Data</th><th>Produção</th><th>Tipo</th><th>Material</th><th>Consumo</th></tr></thead>
        <tbody>${productionReportHistoryHtml(rows)}</tbody>
      </table>
    </section>

    <section class="prod-report-box">
      <h3>Leitura rápida</h3>
      <p class="muted">O relatório considera a melhor data operacional disponível: entrega, pronto, baixa de estoque, falha, início de etapa, criação ou atualização.</p>
      <p class="muted">Use este documento para acompanhar capacidade, consumo de material, gargalos de produção e peças que ainda precisam de conferência.</p>
    </section>

    <section class="prod-report-footer">
      <span>${productionReportSafe(profile.nome_loja || "G3D Pro")}</span>
      <span>Documento interno gerado pelo G3D Pro.</span>
    </section>
  </main>
</body>
</html>`);
  win.document.close();
}

function attachProductionReportPanel(el) {
  if (!el || el.querySelector("#productionReportPanel")) return;
  const range = productionReportDefaultRange();
  const summary = el.querySelector(".production-summary");
  const panel = document.createElement("section");
  panel.className = "card production-report-panel";
  panel.id = "productionReportPanel";
  panel.innerHTML = `
    <div class="section-head">
      <div><h2>Relatório de produção</h2><p class="muted">Gere um PDF por período e etapa com consumo, tempo, falhas e histórico.</p></div>
      <button class="btn primary" type="button" id="openProductionReportPdf">Relatório/PDF</button>
    </div>
    <div class="form-grid">
      <div class="field"><label>Data inicial</label><input type="date" id="productionReportStart" value="${productionReportSafe(range.start)}"></div>
      <div class="field"><label>Data final</label><input type="date" id="productionReportEnd" value="${productionReportSafe(range.end)}"></div>
      <div class="field"><label>Status</label><select id="productionReportStatus">
        <option value="todos">Todos</option>
        <option value="fila">Fila</option>
        <option value="imprimindo">Imprimindo</option>
        <option value="pos">Pós-processamento</option>
        <option value="pronto">Pronto</option>
        <option value="entregue">Entregue</option>
        <option value="falha">Falha</option>
        <option value="cancelado">Cancelado</option>
      </select></div>
    </div>`;
  if (summary) summary.insertAdjacentElement("afterend", panel);
  else el.prepend(panel);
  const reportButton = document.getElementById("openProductionReportPdf");
  if (reportButton) {
    reportButton.addEventListener("click", () => {
      openProductionReportPdf(
        document.getElementById("productionReportStart").value,
        document.getElementById("productionReportEnd").value,
        document.getElementById("productionReportStatus").value
      );
    });
  }
}

window.openProductionReportPdf = openProductionReportPdf;
window.attachProductionReportPanel = attachProductionReportPanel;

if (typeof renderProducoesProfessional === "function") {
  const productionReportPreviousRenderProducoesProfessional = renderProducoesProfessional;
  renderProducoesProfessional = function renderProducoesProfessionalWithReport(el) {
    productionReportPreviousRenderProducoesProfessional(el);
    attachProductionReportPanel(el);
  };
}
