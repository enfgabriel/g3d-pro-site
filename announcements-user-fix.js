(function () {
  function currentUserCanSeeAnnouncement(item = {}) {
    const now = Date.now();
    if (item.ativo === false) return false;
    const starts = item.starts_at ? new Date(item.starts_at).getTime() : null;
    const ends = item.ends_at ? new Date(item.ends_at).getTime() : null;
    if (starts && starts > now) return false;
    if (ends && ends < now) return false;
    const audience = String(item.audience || "todos").toLowerCase();
    const isAdmin = typeof isCurrentUserAdmin === "function" && isCurrentUserAdmin();
    if (["admins", "admin", "administradores"].includes(audience)) return isAdmin;
    return true;
  }

  visibleAnnouncements = function visibleAnnouncementsForUsers() {
    return (state.cache.announcements || []).filter(currentUserCanSeeAnnouncement);
  };

  loadAnnouncements = async function loadAnnouncementsForUsers() {
    if (!state.session) return;
    state.cache.announcementsError = "";
    const query = supabaseClient
      .from("app_announcements")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    const { data, error } = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(() => query) : await query;
    if (error) {
      state.cache.announcements = [];
      state.cache.announcementsError = error.message || "Não foi possível carregar os comunicados.";
      return;
    }
    state.cache.announcements = data || [];
  };

  function renderAnnouncementUnavailable() {
    const canManage = typeof isCurrentUserAdmin === "function" && isCurrentUserAdmin();
    return `
      <div class="card news-card">
        <h3>Central de notícias</h3>
        <p class="muted">Os comunicados ainda não estão liberados para leitura neste perfil.</p>
        ${canManage ? `<p class="muted small">Revise a política de leitura da tabela de comunicados no Supabase.</p>` : ""}
      </div>`;
  }

  const previousRenderNewsCard = typeof renderNewsCard === "function" ? renderNewsCard : null;
  renderNewsCard = function renderNewsCardWithAnnouncementErrors() {
    if (state.cache.announcementsError) return renderAnnouncementUnavailable();
    return previousRenderNewsCard ? previousRenderNewsCard() : "";
  };

  const previousRenderAnnouncementsPage = typeof renderAnnouncementsPage === "function" ? renderAnnouncementsPage : null;
  if (previousRenderAnnouncementsPage) {
    renderAnnouncementsPage = function renderAnnouncementsPageWithUserFix(el) {
      if (state.cache.announcementsError) {
        el.innerHTML = `
          <div class="page-head announcements-head">
            <div><h1>Comunicados</h1><p class="muted">Notícias, atualizações do G3D Pro, parceiros e avisos importantes.</p></div>
          </div>
          <section class="card announcement-empty-state">
            <h2>Comunicados indisponíveis</h2>
            <p class="muted">A leitura dos comunicados ainda precisa ser liberada para usuários comuns.</p>
          </section>`;
        return;
      }
      previousRenderAnnouncementsPage(el);
    };
  }

  const previousLoadAll = loadAll;
  loadAll = async function loadAllWithAnnouncementUserFix() {
    await previousLoadAll();
    await loadAnnouncements();
    renderPage();
  };

  setTimeout(async () => {
    if (!state?.session) return;
    await loadAnnouncements();
    if (state.page === "dashboard" || state.page === "comunicados") renderPage();
  }, 1400);

  window.G3D_ANNOUNCEMENTS_USER_FIX = true;
})();
