state.cache.announcements = [];

function visibleAnnouncements() {
  const now = Date.now();
  return (state.cache.announcements || []).filter(item => {
    if (item.ativo === false) return false;
    const starts = item.starts_at ? new Date(item.starts_at).getTime() : null;
    const ends = item.ends_at ? new Date(item.ends_at).getTime() : null;
    return (!starts || starts <= now) && (!ends || ends >= now);
  });
}

async function loadAnnouncements() {
  if (!state.session) return;
  const { data, error } = await supabaseClient
    .from("app_announcements")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    state.cache.announcements = [];
    return;
  }
  state.cache.announcements = data || [];
}

const announcementsPreviousLoadAll = loadAll;
loadAll = async function loadAllWithAnnouncements() {
  await announcementsPreviousLoadAll();
  await loadAnnouncements();
  renderPage();
};

function renderNewsCard() {
  const items = visibleAnnouncements();
  if (!items.length) {
    return `<div class="card news-card"><h3>Central de notícias</h3><p class="muted">Novidades, atualizações e parceiros do G3D Pro aparecerão aqui.</p></div>`;
  }

  return `
    <div class="card news-card">
      <div class="card-head-row">
        <div>
          <h3>Central de notícias</h3>
          <p class="muted small">Comunicados e oportunidades selecionadas.</p>
        </div>
        <span class="badge blue">${items.length}</span>
      </div>
      <div class="news-list">
        ${items.map(item => `
          <article class="news-item">
            ${item.image_url ? `<a href="${escapeHtml(item.link_url || item.image_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title || "Notícia")}" /></a>` : ""}
            <div>
              <strong>${escapeHtml(item.title || "Comunicado")}</strong>
              <p>${escapeHtml(item.summary || "")}</p>
              ${item.link_url ? `<a class="news-link" href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener">${escapeHtml(item.link_label || "Abrir link")}</a>` : ""}
            </div>
          </article>
        `).join("")}
      </div>
    </div>`;
}

renderDashboard = function renderDashboardWithNews(el) {
  const receita = state.cache.pedidos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const critico = state.cache.estoque.filter(item => Number(item.quantidade || 0) <= Number(item.quantidade_minima || 0) && Number(item.quantidade_minima || 0) > 0);
  el.innerHTML = `
    <div class="page-head"><div><h1>Dashboard</h1><p class="muted">Visão geral do negócio</p></div></div>
    <div class="grid stats">
      <div class="stat"><span>Clientes</span><strong>${state.cache.clientes.length}</strong></div>
      <div class="stat"><span>Orçamentos</span><strong>${state.cache.orcamentos.length}</strong></div>
      <div class="stat"><span>Pedidos</span><strong>${state.cache.pedidos.length}</strong></div>
      <div class="stat"><span>Receita registrada</span><strong>${money(receita)}</strong></div>
    </div>
    <div class="grid dashboard-panels">
      ${renderNewsCard()}
      <div class="card"><h3>Estoque crítico</h3><p class="muted">${critico.length ? critico.map(item => escapeHtml(item.nome)).join(", ") : "Nenhum item crítico."}</p></div>
    </div>`;
};

const announcementsPreviousRenderAdminPage = renderAdminPage;
renderAdminPage = function renderAdminPageWithAnnouncements(el) {
  announcementsPreviousRenderAdminPage(el);
  const grid = el.querySelector(".admin-grid");
  if (!grid) return;
  grid.insertAdjacentHTML("beforeend", renderAnnouncementsAdminCard());
  document.getElementById("newAnnouncement")?.addEventListener("click", () => openAnnouncementForm());
  document.querySelectorAll("[data-edit-announcement]").forEach(button => {
    button.addEventListener("click", () => openAnnouncementForm((state.cache.announcements || []).find(item => item.id === button.dataset.editAnnouncement)));
  });
  document.querySelectorAll("[data-toggle-announcement]").forEach(button => {
    button.addEventListener("click", () => toggleAnnouncement(button.dataset.toggleAnnouncement));
  });
};

function canManageAnnouncements() {
  return isCurrentUserAdmin();
}

function renderAnnouncementsAdminCard() {
  const rows = state.cache.announcements || [];
  const canManage = canManageAnnouncements();
  return `
    <section class="card admin-card span-2 admin-announcements-card ${canManage ? "" : "admin-card-locked"}">
      <div class="card-head-row">
        <div>
          <h3>Notícias e anúncios</h3>
          <p class="muted small">Publique imagens, links e comunicados para todos os usuários.</p>
        </div>
        <button class="btn primary" type="button" id="newAnnouncement" ${canManage ? "" : "disabled"}>Novo anúncio</button>
      </div>
      <div class="admin-announcement-list">
        ${rows.length ? rows.map(renderAnnouncementAdminItem).join("") : `<p class="muted">Nenhum anúncio cadastrado ainda.</p>`}
      </div>
    </section>`;
}

function renderAnnouncementAdminItem(item) {
  const active = item.ativo !== false;
  return `
    <div class="admin-announcement-item">
      ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title || "Anúncio")}" />` : `<div class="announcement-thumb-empty">G3D</div>`}
      <div>
        <strong>${escapeHtml(item.title || "Sem título")}</strong>
        <p>${escapeHtml(item.summary || "")}</p>
        <span class="badge ${active ? "good" : "warn"}">${active ? "Ativo" : "Pausado"}</span>
      </div>
      <div class="actions">
        <button class="btn" type="button" data-edit-announcement="${escapeHtml(item.id)}">Editar</button>
        <button class="btn" type="button" data-toggle-announcement="${escapeHtml(item.id)}">${active ? "Pausar" : "Ativar"}</button>
      </div>
    </div>`;
}

function openAnnouncementForm(row = {}) {
  if (!canManageAnnouncements()) {
    showToast("Apenas ADMs podem publicar notícias.");
    return;
  }
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal" id="announcementForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} anúncio</strong><button class="btn" type="button" id="closeAnnouncement">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field span-2"><label>Título</label><input name="title" required value="${escapeHtml(row.title || "")}" placeholder="Atualização, parceiro ou aviso" /></div>
          <div class="field span-2"><label>Resumo</label><textarea name="summary" placeholder="Texto curto que aparecerá no Dashboard">${escapeHtml(row.summary || "")}</textarea></div>
          <div class="field span-2"><label>URL da imagem</label><input name="image_url" value="${escapeHtml(row.image_url || "")}" placeholder="https://..." /></div>
          <div class="field"><label>Link de destino</label><input name="link_url" value="${escapeHtml(row.link_url || "")}" placeholder="https://..." /></div>
          <div class="field"><label>Texto do botão</label><input name="link_label" value="${escapeHtml(row.link_label || "Saiba mais")}" /></div>
          <div class="field"><label>Ordem</label><input type="number" name="sort_order" value="${escapeHtml(row.sort_order ?? 10)}" /></div>
          <div class="field"><label>Status</label><select name="ativo"><option value="true" ${row.ativo !== false ? "selected" : ""}>Ativo</option><option value="false" ${row.ativo === false ? "selected" : ""}>Pausado</option></select></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelAnnouncement">Cancelar</button><button class="btn primary" type="submit">Salvar anúncio</button></div>
    </form>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closeAnnouncement").addEventListener("click", close);
  document.getElementById("cancelAnnouncement").addEventListener("click", close);
  document.getElementById("announcementForm").addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    payload.ativo = payload.ativo === "true";
    payload.sort_order = Number(payload.sort_order || 10);
    payload.updated_at = new Date().toISOString();
    if (!row.id) payload.created_by = state.session.user.id;
    const query = row.id ? supabaseClient.from("app_announcements").update(payload).eq("id", row.id) : supabaseClient.from("app_announcements").insert(payload);
    const { error } = await query;
    if (error) return showToast(announcementErrorMessage(error));
    showToast("Anúncio salvo.");
    close();
    await loadAnnouncements();
    renderPage();
  });
}

async function toggleAnnouncement(id) {
  const row = (state.cache.announcements || []).find(item => item.id === id);
  if (!row) return;
  const { error } = await supabaseClient
    .from("app_announcements")
    .update({ ativo: row.ativo === false, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return showToast(announcementErrorMessage(error));
  showToast(row.ativo === false ? "Anúncio ativado." : "Anúncio pausado.");
  await loadAnnouncements();
  renderPage();
}

function announcementErrorMessage(error) {
  const text = String(error?.message || "").toLowerCase();
  if (text.includes("permission denied")) return "Permissão da Central de notícias ainda não foi aplicada no Supabase.";
  if (text.includes("row-level security")) return "Apenas ADMs podem publicar notícias.";
  return error?.message || "Não foi possível salvar o anúncio.";
}
