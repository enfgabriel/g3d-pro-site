function exportSafeFileName(value = "g3d-pro") {
  return String(value || "g3d-pro")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "g3d-pro";
}

function exportDateStamp() {
  const date = new Date();
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

function exportCell(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value) || typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function exportCsvValue(value) {
  const text = exportCell(value).replace(/\r?\n/g, " ");
  return /[";,\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportRowsToCsv(rows, columns) {
  const header = columns.map(col => exportCsvValue(col.label)).join(";");
  const body = rows.map(row => columns.map(col => exportCsvValue(typeof col.value === "function" ? col.value(row) : row[col.key])).join(";")).join("\n");
  return `\ufeff${header}${body ? `\n${body}` : ""}`;
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportMoneyNumber(value) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function exportProductionStage(row) {
  if (typeof productionStageLabel === "function") return productionStageLabel(row.status || row.etapa_atual || "fila");
  return row.status || row.etapa_atual || "fila";
}

function exportPaymentStatus(row) {
  if (typeof financeStatusInfo === "function") return financeStatusInfo(row).label;
  return row.status_pagamento || "pendente";
}

function exportClientName(clientId) {
  if (!clientId) return "";
  const client = (state.cache.clientes || []).find(item => item.id === clientId);
  return client ? (client.nome || client.empresa || "") : "";
}

function exportStockName(stockId) {
  if (!stockId) return "";
  const stock = (state.cache.estoque || []).find(item => item.id === stockId);
  return stock ? [stock.nome, stock.material, stock.cor].filter(Boolean).join(" - ") : "";
}

const EXPORT_CONFIGS = {
  clientes: {
    title: "Clientes",
    file: "clientes",
    rows: () => state.cache.clientes || [],
    columns: [
      { key: "nome", label: "Nome" },
      { key: "empresa", label: "Empresa" },
      { key: "cpf_cnpj", label: "CPF/CNPJ" },
      { key: "email", label: "Email" },
      { key: "telefone", label: "Telefone" },
      { key: "whatsapp", label: "WhatsApp" },
      { key: "cidade", label: "Cidade" },
      { key: "estado", label: "Estado" },
      { key: "endereco", label: "Endereco" },
      { key: "observacao", label: "Observacao" },
      { key: "created_at", label: "Criado em" }
    ]
  },
  estoque: {
    title: "Estoque",
    file: "estoque",
    rows: () => state.cache.estoque || [],
    columns: [
      { key: "nome", label: "Nome" },
      { key: "categoria", label: "Categoria" },
      { key: "material", label: "Material" },
      { key: "cor", label: "Cor" },
      { key: "marca", label: "Marca" },
      { key: "local", label: "Local" },
      { key: "quantidade", label: "Quantidade" },
      { key: "peso_restante_g", label: "Peso restante g/ml" },
      { key: "quantidade_minima", label: "Quantidade minima" },
      { key: "custo_grama", label: "Custo por g/ml", value: row => exportMoneyNumber(row.custo_grama) },
      { key: "valor_atual", label: "Valor atual", value: row => exportMoneyNumber(row.valor_atual) },
      { key: "status", label: "Status" }
    ]
  },
  catalogo: {
    title: "Catálogo",
    file: "catalogo",
    rows: () => state.cache.catalogo_produtos || [],
    columns: [
      { key: "nome", label: "Nome" },
      { key: "sku", label: "SKU" },
      { key: "tipo", label: "Tipo" },
      { key: "categoria", label: "Categoria" },
      { key: "descricao", label: "Descricao" },
      { key: "material", label: "Material" },
      { key: "cor", label: "Cor" },
      { key: "estoque_id", label: "Estoque", value: row => exportStockName(row.estoque_id) },
      { key: "peso_g", label: "Peso g/ml" },
      { key: "tempo_horas", label: "Tempo h" },
      { key: "pos_horas", label: "Pos h" },
      { key: "quantidade_pecas", label: "Quantidade" },
      { key: "preco_base", label: "Preco base", value: row => exportMoneyNumber(row.preco_base) },
      { key: "ativo", label: "Ativo", value: row => row.ativo === false ? "Nao" : "Sim" }
    ]
  },
  orcamentos: {
    title: "Orçamentos",
    file: "orcamentos",
    rows: () => state.cache.orcamentos || [],
    columns: [
      { key: "numero", label: "Numero" },
      { key: "projeto", label: "Projeto" },
      { key: "status", label: "Status" },
      { key: "cliente_id", label: "Cliente", value: row => exportClientName(row.cliente_id) },
      { key: "material", label: "Material" },
      { key: "cor", label: "Cor" },
      { key: "peso_g", label: "Peso g/ml" },
      { key: "horas", label: "Horas" },
      { key: "pos_horas", label: "Pos h" },
      { key: "quantidade_pecas", label: "Quantidade" },
      { key: "total", label: "Total", value: row => exportMoneyNumber(row.total) },
      { key: "estoque_id", label: "Estoque", value: row => exportStockName(row.estoque_id) },
      { key: "observacao", label: "Observacao" },
      { key: "created_at", label: "Criado em" }
    ]
  },
  pedidos: {
    title: "Pedidos e financeiro",
    file: "pedidos-financeiro",
    rows: () => state.cache.pedidos || [],
    columns: [
      { key: "numero", label: "Numero" },
      { key: "titulo", label: "Pedido" },
      { key: "status", label: "Status" },
      { key: "cliente_id", label: "Cliente", value: row => exportClientName(row.cliente_id) },
      { key: "valor", label: "Valor", value: row => exportMoneyNumber(typeof financeOrderTotal === "function" ? financeOrderTotal(row) : row.valor) },
      { key: "valor_pago", label: "Valor pago", value: row => exportMoneyNumber(row.valor_pago) },
      { key: "saldo", label: "A receber", value: row => exportMoneyNumber(typeof financeRemaining === "function" ? financeRemaining(row) : Number(row.valor || 0) - Number(row.valor_pago || 0)) },
      { key: "status_pagamento", label: "Pagamento", value: exportPaymentStatus },
      { key: "forma_pagamento", label: "Forma" },
      { key: "vencimento_pagamento", label: "Vencimento" },
      { key: "pago_em", label: "Pago em" },
      { key: "data_entrega", label: "Entrega" },
      { key: "material", label: "Material" },
      { key: "cor", label: "Cor" },
      { key: "observacao", label: "Observacao" }
    ]
  },
  producoes: {
    title: "Produção",
    file: "producao",
    rows: () => state.cache.producoes || [],
    columns: [
      { key: "numero", label: "Numero" },
      { key: "titulo", label: "Titulo" },
      { key: "status", label: "Etapa", value: exportProductionStage },
      { key: "cliente_id", label: "Cliente", value: row => exportClientName(row.cliente_id) },
      { key: "material", label: "Material" },
      { key: "cor", label: "Cor" },
      { key: "peso_g", label: "Peso g/ml" },
      { key: "quantidade_pecas", label: "Quantidade" },
      { key: "consumo_material_g", label: "Consumo g/ml", value: row => typeof productionConsumption === "function" ? productionConsumption(row) : row.consumo_material_g },
      { key: "tempo_horas", label: "Tempo h" },
      { key: "estoque_id", label: "Estoque", value: row => exportStockName(row.estoque_id) },
      { key: "estoque_baixado", label: "Estoque baixado", value: row => row.estoque_baixado ? "Sim" : "Nao" },
      { key: "data_prevista", label: "Data prevista" },
      { key: "falha_motivo", label: "Falha" }
    ]
  },
  historico: {
    title: "Histórico de produção",
    file: "historico-producao",
    rows: () => state.cache.producao_historico || [],
    columns: [
      { key: "created_at", label: "Data" },
      { key: "tipo", label: "Tipo" },
      { key: "producao_numero", label: "Producao" },
      { key: "producao_titulo", label: "Titulo" },
      { key: "status_anterior", label: "Status anterior" },
      { key: "status_novo", label: "Status novo" },
      { key: "material", label: "Material" },
      { key: "cor", label: "Cor" },
      { key: "consumo_material_g", label: "Consumo g/ml" },
      { key: "saldo_anterior_g", label: "Saldo anterior" },
      { key: "saldo_novo_g", label: "Saldo novo" },
      { key: "observacao", label: "Observacao" }
    ]
  }
};

function exportDataset(key) {
  const config = EXPORT_CONFIGS[key];
  if (!config) return;
  const rows = config.rows();
  const csv = exportRowsToCsv(rows, config.columns);
  const filename = `g3d-pro-${config.file}-${exportDateStamp()}.csv`;
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
  showToast(`${config.title}: ${rows.length} registro(s) exportado(s).`);
}

function exportBackupJson() {
  const payload = {
    app: "G3D Pro",
    exported_at: new Date().toISOString(),
    user_email: state.session?.user?.email || "",
    loja: state.cache.loja || null,
    parametros: state.cache.parametros || null,
    clientes: state.cache.clientes || [],
    estoque: state.cache.estoque || [],
    catalogo_produtos: state.cache.catalogo_produtos || [],
    orcamentos: state.cache.orcamentos || [],
    pedidos: state.cache.pedidos || [],
    producoes: state.cache.producoes || [],
    producao_historico: state.cache.producao_historico || []
  };
  downloadTextFile(`g3d-pro-backup-${exportDateStamp()}.json`, JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
  showToast("Backup geral exportado em JSON.");
}

function exportCardHtml(key, config) {
  const rows = config.rows();
  return `
    <article class="card export-card">
      <div>
        <span class="badge blue">CSV</span>
        <h2>${escapeHtml(config.title)}</h2>
        <p class="muted">${rows.length} registro(s) disponíveis para baixar.</p>
      </div>
      <button class="btn primary" data-export-dataset="${key}">Baixar CSV</button>
    </article>`;
}

function renderExportacoes(el) {
  const configs = Object.entries(EXPORT_CONFIGS);
  const totalRows = configs.reduce((sum, [, config]) => sum + config.rows().length, 0);
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Exportações</h1><p class="muted">Baixe seus dados para conferência, backup ou migração.</p></div>
      <button class="btn primary" id="exportBackupJson">Backup geral JSON</button>
    </div>
    <section class="card export-hero">
      <div>
        <span class="export-kicker">Dados do usuário atual</span>
        <h2>Exportação segura dos seus próprios registros</h2>
        <p class="muted">Os arquivos são gerados direto no navegador usando os dados já carregados na sua sessão. Nenhum dado de outro usuário é incluído.</p>
      </div>
      <div class="export-score"><strong>${totalRows}</strong><span>registro(s)</span></div>
    </section>
    <div class="export-grid">
      ${configs.map(([key, config]) => exportCardHtml(key, config)).join("")}
    </div>
    <section class="card export-note">
      <h2>Como usar</h2>
      <p class="muted">Use CSV para abrir em Excel, Google Sheets ou sistemas financeiros. Use o JSON como backup técnico completo do ambiente atual.</p>
    </section>`;

  document.querySelectorAll("[data-export-dataset]").forEach(button => {
    button.addEventListener("click", () => exportDataset(button.dataset.exportDataset));
  });
  document.getElementById("exportBackupJson")?.addEventListener("click", exportBackupJson);
}

function ensureExportsNav() {
  if (!navPages.some(([id]) => id === "exportacoes")) {
    const productionIndex = navPages.findIndex(([id]) => id === "producao");
    navPages.splice(productionIndex >= 0 ? productionIndex + 1 : navPages.length, 0, ["exportacoes", "Exportações"]);
  }
}

ensureExportsNav();

const exportsPreviousRenderApp = renderApp;
renderApp = function renderAppWithExports() {
  ensureExportsNav();
  exportsPreviousRenderApp();
};

const exportsPreviousRenderPage = renderPage;
renderPage = function renderPageWithExports() {
  if (state.page === "exportacoes") {
    const el = document.getElementById("content");
    if (!el) return;
    return renderExportacoes(el);
  }
  return exportsPreviousRenderPage();
};
