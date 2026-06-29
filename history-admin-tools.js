(function () {
  const TEST_MARKERS = [
    "teste",
    "correcao fluxo automatico",
    "correção fluxo automático",
    "suporte articulado para headset",
    "cliente teste g3d final",
    "pla preto fosco 1kg"
  ];

  const HISTORY_TABLES = ["clientes", "orcamentos", "pedidos", "producoes", "estoque", "producao_historico"];

  function safeText(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value || "") : String(value || "");
  }

  function dateText(value) {
    if (!value) return "Sem data";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Sem data";
    return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function rowSearchText(row = {}) {
    return normalizeText([
      row.nome,
      row.empresa,
      row.numero,
      row.titulo,
      row.projeto,
      row.material,
      row.cor,
      row.observacao,
      row.producao_numero,
      row.producao_titulo,
      row.email
    ].filter(Boolean).join(" "));
  }

  function isTestRow(row = {}) {
    const text = rowSearchText(row);
    return TEST_MARKERS.some(marker => text.includes(normalizeText(marker)));
  }

  function tableRows(table) {
    return state.cache?.[table] || [];
  }

  function collectTestRows() {
    const result = {};
    HISTORY_TABLES.forEach(table => {
      result[table] = tableRows(table).filter(isTestRow);
    });
    return result;
  }

  function countCollected(collected) {
    return Object.values(collected).reduce((sum, rows) => sum + rows.length, 0);
  }

  function labelForTable(table) {
    return {
      clientes: "Clientes",
      orcamentos: "Orçamentos",
      pedidos: "Pedidos",
      producoes: "Produções",
      estoque: "Estoque",
      producao_historico: "Histórico"
    }[table] || table;
  }

  function clientTimeline(client = {}) {
    const clientId = client.id;
    const rows = [];
    (state.cache.orcamentos || []).filter(item => item.cliente_id === clientId).forEach(item => rows.push({
      type: "Orçamento",
      title: item.numero || item.projeto || "Orçamento",
      detail: `${item.projeto || ""} · ${money(Number(item.total || 0))}`,
      status: item.status || "rascunho",
      date: item.created_at || item.updated_at
    }));
    (state.cache.pedidos || []).filter(item => item.cliente_id === clientId).forEach(item => rows.push({
      type: "Pedido",
      title: item.numero || item.titulo || "Pedido",
      detail: `${item.titulo || ""} · ${money(Number(item.valor || item.total || 0))}`,
      status: item.status || "novo",
      date: item.created_at || item.updated_at || item.data_entrega
    }));
    (state.cache.producoes || []).filter(item => item.cliente_id === clientId).forEach(item => rows.push({
      type: "Produção",
      title: item.numero || item.titulo || "Produção",
      detail: [item.material, item.cor].filter(Boolean).join(" - ") || item.titulo || "",
      status: item.etapa_atual || item.status || "fila",
      date: item.estoque_baixado_em || item.updated_at || item.created_at || item.data_prevista
    }));
    return rows.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }

  function renderClientTimeline(client = {}) {
    const rows = clientTimeline(client).slice(0, 12);
    return `
      <section class="client-profile-section client-timeline-section">
        <h3>Linha do tempo</h3>
        <div class="client-timeline-list">
          ${rows.length ? rows.map(row => `
            <div class="client-timeline-item">
              <div><strong>${safeText(row.type)}</strong><span>${safeText(dateText(row.date))}</span></div>
              <div><b>${safeText(row.title)}</b><p class="muted small">${safeText(row.detail)}</p></div>
              <span class="badge blue">${safeText(row.status)}</span>
            </div>
          `).join("") : `<p class="muted">Nenhum movimento registrado para este cliente ainda.</p>`}
        </div>
      </section>`;
  }

  function injectClientTimeline(client = {}) {
    const body = document.querySelector(".client-profile-modal .modal-body");
    if (!body || body.querySelector(".client-timeline-section")) return;
    const stats = body.querySelector(".client-profile-stats");
    if (stats) stats.insertAdjacentHTML("afterend", renderClientTimeline(client));
  }

  if (typeof openClientProfile === "function") {
    const previousOpenClientProfile = openClientProfile;
    openClientProfile = function openClientProfileWithTimeline(client = {}) {
      previousOpenClientProfile(client);
      injectClientTimeline(client);
    };
  }

  async function refreshHistoryData() {
    if (typeof loadProductionHistory === "function") await loadProductionHistory();
  }

  function renderCleanupCard() {
    const collected = collectTestRows();
    const total = countCollected(collected);
    return `
      <section class="card admin-card span-2" id="testCleanupCard">
        <div class="card-head-row">
          <div>
            <h3>Limpeza de dados de teste</h3>
            <p class="muted small">Remove somente registros com marcadores de teste criados durante a validação do sistema.</p>
          </div>
          <span class="badge ${total ? "warn" : "good"}">${total} encontrado(s)</span>
        </div>
        <div class="admin-actions-grid">
          ${HISTORY_TABLES.map(table => `<div><strong>${labelForTable(table)}</strong><span>${(collected[table] || []).length} registro(s)</span></div>`).join("")}
        </div>
        <div class="modal-foot">
          <button class="btn danger" type="button" id="cleanupTestData" ${total ? "" : "disabled"}>Limpar dados de teste</button>
          <button class="btn" type="button" id="refreshTestData">Atualizar contagem</button>
        </div>
      </section>`;
  }

  function injectCleanupCard(el) {
    if (!el || !isCurrentUserAdmin?.() || el.querySelector("#testCleanupCard")) return;
    const grid = el.querySelector(".admin-grid");
    if (!grid) return;
    grid.insertAdjacentHTML("beforeend", renderCleanupCard());
    el.querySelector("#cleanupTestData")?.addEventListener("click", cleanupTestData);
    el.querySelector("#refreshTestData")?.addEventListener("click", async () => {
      await refreshHistoryData();
      state.page = "admin";
      renderPage();
    });
  }

  async function softDeleteTableRows(table, rows = []) {
    const ids = rows.map(row => row.id).filter(Boolean);
    if (!ids.length) return { error: null, count: 0 };
    const query = () => supabaseClient.from(table).update({ deleted_at: new Date().toISOString() }).in("id", ids);
    const result = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(query) : await query();
    return { error: result.error, count: ids.length };
  }

  async function cleanupTestData() {
    if (!isCurrentUserAdmin?.()) return showToast("Apenas ADM pode limpar dados de teste.");
    await refreshHistoryData();
    const collected = collectTestRows();
    const total = countCollected(collected);
    if (!total) return showToast("Nenhum dado de teste encontrado.");
    const confirmed = window.confirm(`Limpar ${total} registro(s) de teste? Esta ação remove apenas itens marcados como teste.`);
    if (!confirmed) return;

    const button = document.getElementById("cleanupTestData");
    if (button) {
      button.disabled = true;
      button.textContent = "Limpando...";
    }

    let removed = 0;
    for (const table of ["producao_historico", "producoes", "pedidos", "orcamentos", "estoque", "clientes"]) {
      const result = await softDeleteTableRows(table, collected[table] || []);
      if (result.error) {
        showToast(`Erro ao limpar ${labelForTable(table)}: ${result.error.message}`);
        if (button) {
          button.disabled = false;
          button.textContent = "Limpar dados de teste";
        }
        return;
      }
      removed += result.count;
    }

    await Promise.all([
      loadTable("clientes"),
      loadTable("estoque"),
      loadTable("orcamentos"),
      loadTable("pedidos"),
      loadTable("producoes")
    ]);
    await refreshHistoryData();
    showToast(`${removed} registro(s) de teste removido(s).`);
    state.page = "admin";
    renderPage();
  }

  if (typeof renderAdminPage === "function") {
    const previousRenderAdminPage = renderAdminPage;
    renderAdminPage = function renderAdminPageWithCleanup(el) {
      previousRenderAdminPage(el);
      injectCleanupCard(el);
    };
  }

  window.G3D_HISTORY_ADMIN_TOOLS = true;
})();
