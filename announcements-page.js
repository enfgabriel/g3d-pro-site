function ensureAnnouncementsPageInMenu() {
  if (!navPages.some(([id]) => id === "comunicados")) {
    const dashboardIndex = navPages.findIndex(([id]) => id === "dashboard");
    navPages.splice(dashboardIndex + 1, 0, ["comunicados", "Comunicados"]);
  }
}

function announcementDateLabel(item) {
  const value = item.starts_at || item.created_at;
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString("pt-BR");
  } catch (_error) {
    return "";
  }
}

function announcementCard(item) {
  const href = item.link_url || item.image_url || "";
  const media = item.image_url
    ? `<div class="announcement-media"><img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title || "Comunicado")}" /></div>`
    : `<div class="announcement-media announcement-media-empty">G3D</div>`;
  return `
    <article class="announcement-card">
      ${href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${media}</a>` : media}
      <div class="announcement-body">
        <div class="announcement-meta">
          <span class="badge blue">${escapeHtml(item.category || "Comunicado")}</span>
          <span class="muted small">${escapeHtml(announcementDateLabel(item))}</span>
        </div>
        <h2>${escapeHtml(item.title || "Comunicado")}</h2>
        <p>${escapeHtml(item.summary || "")}</p>
        ${item.link_url ? `<a class="btn" href="${escapeHtml(item.link_url)}" target="_blank" rel="noopener">${escapeHtml(item.link_label || "Abrir link")}</a>` : ""}
      </div>
    </article>`;
}

function renderAnnouncementsPage(el) {
  const items = visibleAnnouncements();
  const featured = items[0] || null;
  const remaining = featured ? items.slice(1) : items;
  const canManage = typeof isCurrentUserAdmin === "function" && isCurrentUserAdmin();

  el.innerHTML = `
    <div class="page-head announcements-head">
      <div>
        <h1>Comunicados</h1>
        <p class="muted">Notícias, atualizações do G3D Pro, parceiros e avisos importantes.</p>
      </div>
      <div class="actions">
        ${canManage ? `<button class="btn primary" type="button" id="openAdminAnnouncements">Gerenciar anúncios</button>` : ""}
      </div>
    </div>

    ${featured ? `
      <section class="announcement-featured">
        ${announcementCard(featured)}
      </section>
    ` : `
      <section class="card announcement-empty-state">
        <h2>Nenhum comunicado publicado ainda</h2>
        <p class="muted">Quando houver novidades, anúncios ou links de parceiros, eles aparecerão aqui.</p>
      </section>
    `}

    ${remaining.length ? `
      <section class="announcements-grid">
        ${remaining.map(announcementCard).join("")}
      </section>
    ` : ""}`;

  document.getElementById("openAdminAnnouncements")?.addEventListener("click", () => {
    state.page = "admin";
    renderApp();
    renderPage();
  });
}

const announcementsPagePreviousRenderApp = renderApp;
renderApp = function renderAppWithAnnouncementsPage() {
  ensureAnnouncementsPageInMenu();
  announcementsPagePreviousRenderApp();
};

const announcementsPagePreviousRenderPage = renderPage;
renderPage = function renderPageWithAnnouncementsPage() {
  ensureAnnouncementsPageInMenu();
  const el = document.getElementById("content");
  if (state.page === "comunicados" && el) return renderAnnouncementsPage(el);
  return announcementsPagePreviousRenderPage();
};
