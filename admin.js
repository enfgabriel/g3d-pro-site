const BOOTSTRAP_ADMIN_EMAILS = ["cabritroll@gmail.com"];
state.cache.admins = [];
state.cache.adminReady = false;
state.cache.adminSetupMissing = false;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function currentUserEmail() {
  return normalizeEmail(state.session?.user?.email);
}

function isBootstrapAdmin(email = currentUserEmail()) {
  return BOOTSTRAP_ADMIN_EMAILS.includes(normalizeEmail(email));
}

function activeAdmins() {
  const seen = new Set();
  return (state.cache.admins || []).filter(admin => {
    const email = normalizeEmail(admin.email);
    if (!email || seen.has(email) || admin.ativo === false) return false;
    seen.add(email);
    return true;
  });
}

function currentAdminRecord() {
  const email = currentUserEmail();
  return activeAdmins().find(admin => normalizeEmail(admin.email) === email) || null;
}

function isCurrentUserAdmin() {
  return isBootstrapAdmin() || Boolean(currentAdminRecord());
}

function isCurrentUserOwner() {
  const record = currentAdminRecord();
  return isBootstrapAdmin() || normalizeEmail(record?.role) === "owner";
}

function ensureAdminPageInMenu() {
  const hasAdmin = navPages.some(([id]) => id === "admin");
  if (isCurrentUserAdmin() && !hasAdmin) navPages.push(["admin", "ADM"]);
  if (!isCurrentUserAdmin() && hasAdmin) {
    const index = navPages.findIndex(([id]) => id === "admin");
    if (index >= 0) navPages.splice(index, 1);
    if (state.page === "admin") state.page = "dashboard";
  }
}

async function loadAdmins() {
  if (!state.session) return;
  const { data, error } = await supabaseClient
    .from("app_admins")
    .select("*")
    .eq("ativo", true)
    .order("created_at", { ascending: false });

  if (error) {
    state.cache.admins = [];
    state.cache.adminReady = isBootstrapAdmin();
    state.cache.adminSetupMissing = true;
    return;
  }

  state.cache.admins = data || [];
  state.cache.adminReady = true;
  state.cache.adminSetupMissing = false;
}

const adminPreviousLoadAll = loadAll;
loadAll = async function loadAllWithAdmin() {
  await adminPreviousLoadAll();
  await loadAdmins();
  ensureAdminPageInMenu();
  renderApp();
  renderPage();
};

const adminPreviousRenderApp = renderApp;
renderApp = function renderAppWithAdmin() {
  ensureAdminPageInMenu();
  adminPreviousRenderApp();
};

const adminPreviousRenderPage = renderPage;
renderPage = function renderPageWithAdmin() {
  if (state.page === "admin") {
    const content = document.getElementById("content");
    if (!content) return;
    if (!isCurrentUserAdmin()) {
      state.page = "dashboard";
      renderApp();
      return;
    }
    renderAdminPage(content);
    return;
  }
  adminPreviousRenderPage();
};

function renderAdminPage(el) {
  const rows = activeAdmins();
  const bootstrapOnly = state.cache.adminSetupMissing;
  const canManageAdmins = isCurrentUserOwner() && !bootstrapOnly;
  const bootstrapEmail = currentUserEmail();
  const rowsWithoutBootstrap = rows.filter(admin => !isBootstrapAdmin(admin.email));
  const activeCount = rowsWithoutBootstrap.length + (isBootstrapAdmin() ? 1 : 0);

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Área ADM</h1>
        <p class="muted">Controle administradores, permissões e recursos globais do G3D Pro.</p>
      </div>
    </div>

    ${bootstrapOnly ? `
      <section class="admin-alert">
        <strong>Configuração do banco pendente</strong>
        <p>Você está vendo a área ADM por ser o admin inicial. Para adicionar novos ADMs com segurança, crie a tabela <code>app_admins</code> e as políticas de acesso no Supabase.</p>
      </section>
    ` : ""}

    ${!canManageAdmins && !bootstrapOnly ? `
      <section class="admin-note">
        <strong>Acesso de visualização</strong>
        <p>Seu perfil pode abrir a Área ADM, mas somente um owner pode adicionar ou remover administradores.</p>
      </section>
    ` : ""}

    <div class="admin-grid">
      <section class="card admin-card">
        <div class="card-head-row">
          <div>
            <h3>Administradores</h3>
            <p class="muted small">Usuários com acesso à área ADM.</p>
          </div>
          <span class="badge good">${activeCount} ativos</span>
        </div>
        <div class="admin-list">
          ${isBootstrapAdmin() ? renderAdminItem({ email: bootstrapEmail, role: "owner", bootstrap: true }, canManageAdmins) : ""}
          ${rowsWithoutBootstrap.length ? rowsWithoutBootstrap.map(admin => renderAdminItem(admin, canManageAdmins)).join("") : `<p class="muted">Nenhum admin extra cadastrado ainda.</p>`}
        </div>
      </section>

      <section class="card admin-card ${canManageAdmins ? "" : "admin-card-locked"}">
        <h3>Adicionar ADM</h3>
        <p class="muted small">Cadastre o email do usuário que também poderá gerenciar a área administrativa.</p>
        <form id="adminForm" class="admin-form">
          <div class="field">
            <label>Email do novo ADM</label>
            <input type="email" name="email" required placeholder="admin@sualoja.com" ${canManageAdmins ? "" : "disabled"} />
          </div>
          <div class="field">
            <label>Nível</label>
            <select name="role" ${canManageAdmins ? "" : "disabled"}>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
              <option value="suporte">Suporte</option>
            </select>
          </div>
          <button class="btn primary full" type="submit" ${canManageAdmins ? "" : "disabled"}>Adicionar ADM</button>
          ${canManageAdmins ? "" : `<p class="muted small admin-form-note">Disponível apenas para owner.</p>`}
        </form>
      </section>

      <section class="card admin-card span-2 admin-next-card">
        <h3>Próximas funções globais</h3>
        <div class="admin-actions-grid">
          <div><strong>Notícias e anúncios</strong><span>Publicar comunicados para todos os usuários.</span></div>
          <div><strong>Planos e limites</strong><span>Definir limites de uso por conta no futuro.</span></div>
          <div><strong>Auditoria</strong><span>Registrar ações administrativas importantes.</span></div>
        </div>
      </section>
    </div>
  `;

  document.getElementById("adminForm")?.addEventListener("submit", addAdminUser);
  document.querySelectorAll("[data-remove-admin]").forEach(button => {
    button.addEventListener("click", () => removeAdminUser(button.dataset.removeAdmin));
  });
}

function renderAdminItem(admin, canManageAdmins) {
  const email = escapeHtml(admin.email || "");
  const role = escapeHtml(admin.role || admin.perfil || "admin");
  const bootstrap = Boolean(admin.bootstrap);
  const canRemove = canManageAdmins && !bootstrap && normalizeEmail(admin.email) !== currentUserEmail();
  return `
    <div class="admin-item">
      <div>
        <strong>${email}</strong>
        <span>${role}${bootstrap ? " · protegido" : ""}</span>
      </div>
      ${bootstrap ? `<span class="badge blue">Inicial</span>` : canRemove ? `<button class="btn danger" type="button" data-remove-admin="${email}">Remover</button>` : `<span class="badge">Protegido</span>`}
    </div>
  `;
}

function adminErrorMessage(error) {
  const text = String(error?.message || "").toLowerCase();
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
    showToast("Crie a tabela app_admins no Supabase antes de adicionar ADMs.");
    return;
  }

  const formData = new FormData(event.currentTarget);
  const email = normalizeEmail(formData.get("email"));
  const role = String(formData.get("role") || "admin");
  if (!email) return;

  const { error } = await supabaseClient.from("app_admins").upsert({
    email,
    role,
    ativo: true,
    created_by: state.session.user.id,
    updated_at: new Date().toISOString()
  }, { onConflict: "email" });

  if (error) {
    showToast(adminErrorMessage(error));
    return;
  }

  showToast("Novo ADM adicionado.");
  event.currentTarget.reset();
  await loadAdmins();
  renderApp();
  state.page = "admin";
  renderPage();
}

async function removeAdminUser(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  if (!isCurrentUserOwner()) {
    showToast("Apenas um owner pode remover ADMs.");
    return;
  }
  if (normalizedEmail === currentUserEmail() || isBootstrapAdmin(normalizedEmail)) {
    showToast("Este ADM é protegido e não pode ser removido por aqui.");
    return;
  }

  const { error } = await supabaseClient
    .from("app_admins")
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq("email", normalizedEmail);

  if (error) {
    showToast(adminErrorMessage(error));
    return;
  }

  showToast("ADM removido.");
  await loadAdmins();
  renderPage();
}
