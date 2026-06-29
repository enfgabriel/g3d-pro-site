function adminErrorMessage(error) {
  const text = String(error?.message || "").toLowerCase();
  if (text.includes("permission denied") && text.includes("app_admins")) return "Permissão do Supabase ajustada. Recarregue a página e tente novamente.";
  if (text.includes("row-level security") || text.includes("violates row-level security")) return "Apenas um owner pode alterar administradores.";
  if (text.includes("duplicate") || text.includes("unique")) return "Este email já está cadastrado como ADM.";
  return error?.message || "Não foi possível concluir esta ação.";
}

async function addAdminUser(event) {
  event.preventDefault();
  if (!isCurrentUserOwner()) {
    showToast("Apenas um owner pode adicionar ADMs.");
    return;
  }
  if (state.cache.adminSetupMissing) {
    showToast("A configuração ADM no Supabase ainda não foi carregada. Recarregue a página e tente novamente.");
    return;
  }

  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button?.textContent || "Adicionar ADM";
  const formData = new FormData(form);
  const email = normalizeEmail(formData.get("email"));
  const role = String(formData.get("role") || "admin");
  if (!email) return;

  if (button) {
    button.disabled = true;
    button.textContent = "Adicionando...";
  }

  const { error } = await supabaseClient.from("app_admins").insert({
    email,
    role,
    ativo: true,
    created_by: state.session.user.id
  });

  if (button) {
    button.disabled = false;
    button.textContent = originalLabel;
  }

  if (error) {
    showToast(adminErrorMessage(error));
    return;
  }

  showToast("Novo ADM adicionado.");
  form.reset();
  await loadAdmins();
  ensureAdminPageInMenu();
  state.page = "admin";
  renderApp();
  renderPage();
}

(function () {
  if (window.G3D_HISTORY_ADMIN_TOOLS) return;

  const TEST_MARKERS = ["teste", "correcao fluxo automatico", "correção fluxo automático", "suporte articulado para headset", "cliente teste g3d final", "pla preto fosco 1kg"];
  const CLEANUP_TABLES = ["clientes", "orcamentos", "pedidos", "producoes", "estoque", "producao_historico"];

  function cleanupSafe(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value || "") : String(value || "");
  }

  function cleanupNormalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function cleanupText(row = {}) {
    return cleanupNormalize([row.nome, row.empresa, row.email, row.numero, row.titulo, row.projeto, row.material, row.cor, row.observacao, row.producao_numero, row.producao_titulo].filter(Boolean).join(" "));
  }

  function cleanupIsTest(row = {}) {
    const text = cleanupText(row);
    return TEST_MARKERS.some(marker => text.includes(cleanupNormalize(marker)));
  }

  function cleanupRows() {
    const result = {};
    CLEANUP_TABLES.forEach(table => {
      result[table] = (state.cache?.[table] || []).filter(cleanupIsTest);
    });
    return result;
  }

  function cleanupCount(rowsByTable) {
    return Object.values(rowsByTable).reduce((sum, rows) => sum + rows.length, 0);
  }

  function cleanupTableLabel(table) {
    return { clientes: "Clientes", orcamentos: "Orçamentos", pedidos: "Pedidos", producoes: "Produções", estoque: "Estoque", producao_historico: "Histórico" }[table] || table;
  }

  function cleanupDate(value) {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "Sem data" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function clientTimelineRows(client = {}) {
    const clientId = client.id;
    const rows = [];
    (state.cache.orcamentos || []).filter(item => item.cliente_id === clientId).forEach(item => rows.push({ tipo: "Orçamento", titulo: item.numero || item.projeto || "Orçamento", detalhe: `${item.projeto || ""} · ${money(Number(item.total || 0))}`, status: item.status || "rascunho", data: item.created_at || item.updated_at }));
    (state.cache.pedidos || []).filter(item => item.cliente_id === clientId).forEach(item => rows.push({ tipo: "Pedido", titulo: item.numero || item.titulo || "Pedido", detalhe: `${item.titulo || ""} · ${money(Number(item.valor || item.total || 0))}`, status: item.status || "novo", data: item.created_at || item.updated_at || item.data_entrega }));
    (state.cache.producoes || []).filter(item => item.cliente_id === clientId).forEach(item => rows.push({ tipo: "Produção", titulo: item.numero || item.titulo || "Produção", detalhe: [item.material, item.cor].filter(Boolean).join(" - ") || item.titulo || "", status: item.etapa_atual || item.status || "fila", data: item.estoque_baixado_em || item.updated_at || item.created_at || item.data_prevista }));
    return rows.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));
  }

  function injectClientTimeline(client = {}) {
    const body = document.querySelector(".client-profile-modal .modal-body");
    if (!body || body.querySelector(".client-timeline-section")) return;
    const rows = clientTimelineRows(client).slice(0, 12);
    const html = `<section class="client-profile-section client-timeline-section"><h3>Linha do tempo</h3><div class="client-timeline-list">${rows.length ? rows.map(row => `<div class="client-timeline-item"><div><strong>${cleanupSafe(row.tipo)}</strong><span>${cleanupSafe(cleanupDate(row.data))}</span></div><div><b>${cleanupSafe(row.titulo)}</b><p class="muted small">${cleanupSafe(row.detalhe)}</p></div><span class="badge blue">${cleanupSafe(row.status)}</span></div>`).join("") : `<p class="muted">Nenhum movimento registrado para este cliente ainda.</p>`}</div></section>`;
    const stats = body.querySelector(".client-profile-stats");
    if (stats) stats.insertAdjacentHTML("afterend", html);
  }

  function setupClientTimelineWrapper() {
    if (typeof openClientProfile !== "function" || openClientProfile.g3dTimelineWrapped) return;
    const previousOpenClientProfile = openClientProfile;
    openClientProfile = function openClientProfileWithTimeline(client = {}) {
      previousOpenClientProfile(client);
      injectClientTimeline(client);
    };
    openClientProfile.g3dTimelineWrapped = true;
  }

  async function cleanupRefreshHistory() {
    if (typeof loadProductionHistory === "function") await loadProductionHistory();
  }

  function cleanupCardHtml() {
    const rowsByTable = cleanupRows();
    const total = cleanupCount(rowsByTable);
    return `<section class="card admin-card span-2" id="testCleanupCard"><div class="card-head-row"><div><h3>Limpeza de dados de teste</h3><p class="muted small">Remove somente registros com marcadores de teste criados durante a validação.</p></div><span class="badge ${total ? "warn" : "good"}">${total} encontrado(s)</span></div><div class="admin-actions-grid">${CLEANUP_TABLES.map(table => `<div><strong>${cleanupTableLabel(table)}</strong><span>${(rowsByTable[table] || []).length} registro(s)</span></div>`).join("")}</div><div class="modal-foot"><button class="btn danger" type="button" id="cleanupTestData" ${total ? "" : "disabled"}>Limpar dados de teste</button><button class="btn" type="button" id="refreshTestData">Atualizar contagem</button></div></section>`;
  }

  function injectCleanupCard(el) {
    if (!el || !window.isCurrentUserAdmin?.() || el.querySelector("#testCleanupCard")) return;
    const grid = el.querySelector(".admin-grid");
    if (!grid) return;
    grid.insertAdjacentHTML("beforeend", cleanupCardHtml());
    el.querySelector("#cleanupTestData")?.addEventListener("click", cleanupTestData);
    el.querySelector("#refreshTestData")?.addEventListener("click", async () => { await cleanupRefreshHistory(); state.page = "admin"; renderPage(); });
  }

  async function cleanupSoftDelete(table, rows = []) {
    const ids = rows.map(row => row.id).filter(Boolean);
    if (!ids.length) return { count: 0, error: null };
    const query = () => supabaseClient.from(table).update({ deleted_at: new Date().toISOString() }).in("id", ids);
    const result = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(query) : await query();
    return { count: ids.length, error: result.error };
  }

  async function cleanupTestData() {
    if (!window.isCurrentUserAdmin?.()) return showToast("Apenas ADM pode limpar dados de teste.");
    await cleanupRefreshHistory();
    const rowsByTable = cleanupRows();
    const total = cleanupCount(rowsByTable);
    if (!total) return showToast("Nenhum dado de teste encontrado.");
    if (!window.confirm(`Limpar ${total} registro(s) de teste? Esta ação remove apenas itens marcados como teste.`)) return;
    const button = document.getElementById("cleanupTestData");
    if (button) { button.disabled = true; button.textContent = "Limpando..."; }
    let removed = 0;
    for (const table of ["producao_historico", "producoes", "pedidos", "orcamentos", "estoque", "clientes"]) {
      const result = await cleanupSoftDelete(table, rowsByTable[table] || []);
      if (result.error) {
        showToast(`Erro ao limpar ${cleanupTableLabel(table)}: ${result.error.message}`);
        if (button) { button.disabled = false; button.textContent = "Limpar dados de teste"; }
        return;
      }
      removed += result.count;
    }
    await Promise.all([loadTable("clientes"), loadTable("estoque"), loadTable("orcamentos"), loadTable("pedidos"), loadTable("producoes")]);
    await cleanupRefreshHistory();
    showToast(`${removed} registro(s) de teste removido(s).`);
    state.page = "admin";
    renderPage();
  }

  function setupAdminCleanupWrapper() {
    if (typeof renderAdminPage !== "function" || renderAdminPage.g3dCleanupWrapped) return;
    const previousRenderAdminPage = renderAdminPage;
    renderAdminPage = function renderAdminPageWithCleanup(el) {
      previousRenderAdminPage(el);
      injectCleanupCard(el);
    };
    renderAdminPage.g3dCleanupWrapped = true;
  }

  function setupHistoryAdminTools() {
    setupClientTimelineWrapper();
    setupAdminCleanupWrapper();
  }

  setupHistoryAdminTools();
  window.addEventListener("load", setupHistoryAdminTools);
  setTimeout(setupHistoryAdminTools, 1200);
  setTimeout(setupHistoryAdminTools, 3000);
  window.G3D_HISTORY_ADMIN_TOOLS = true;
})();
