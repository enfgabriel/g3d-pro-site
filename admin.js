const BOOTSTRAP_ADMIN_EMAILS = ["cabritroll@gmail.com"];
state.cache.admins = [];
state.cache.adminReady = false;
state.cache.adminSetupMissing = false;

function currentUserEmail() {
  return String(state.session?.user?.email || "").trim().toLowerCase();
}

function isBootstrapAdmin() {
  return BOOTSTRAP_ADMIN_EMAILS.includes(currentUserEmail());
}

function isCurrentUserAdmin() {
  const email = currentUserEmail();
  return isBootstrapAdmin() || (state.cache.admins || []).some(admin => String(admin.email || "").toLowerCase() === email && admin.ativo !== false);
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
  const rows = state.cache.admins || [];
  const bootstrapOnly = state.cache.adminSetupMissing;
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

    <div class="admin-grid">
      <section class="card admin-card">
        <div class="card-head-row">
          <div>
            <h3>Administradores</h3>
            <p class="muted small">Usuários com acesso à área ADM.</p>
          </div>
          <span class="badge good">${rows.length + (isBootstrapAdmin() ? 1 : 0)} ativos</span>
        </div>
        <div class="admin-list">
          ${isBootstrapAdmin() ? renderAdminItem({ email: currentUserEmail(), role: "admin inicial", bootstrap: true }) : ""}
          ${rows.length ? rows.map(renderAdminItem).join("") : `<p class="muted">Nenhum admin cadastrado na tabela ainda.</p>`}
        </div>
      </section>

      <section class="card admin-card">
        <h3>Adicionar ADM</h3>
        <p class="muted small">Cadastre o email do usuário que também poderá gerenciar a área administrativa.</p>
        <form id="adminForm" class="admin-form">
          <div class="field">
            <label>Email do novo ADM</label>
            <input type="email" name="email" required placeholder="admin@sualoja.com" ${bootstrapOnly ? "disabled" : ""} />
          </div>
          <div class="field">
            <label>Nível</label>
            <select name="role" ${bootstrapOnly ? "disabled" : ""}>
              <option value="admin">Admin</option>
              <option value="owner">Owner</option>
              <option value="suporte">Suporte</option>
            </select>
          </div>
          <button class="btn primary full" type="submit" ${bootstrapOnly ? "disabled" : ""}>Adicionar ADM</button>
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

function renderAdminItem(admin) {
  const email = escapeHtml(admin.email || "");
  const role = escapeHtml(admin.role || admin.perfil || "admin");
  const bootstrap = Boolean(admin.bootstrap);
  return `
    <div class="admin-item">
      <div>
        <strong>${email}</strong>
        <span>${role}${bootstrap ? " · protegido" : ""}</span>
      </div>
      ${bootstrap ? `<span class="badge blue">Inicial</span>` : `<button class="btn danger" type="button" data-remove-admin="${email}">Remover</button>`}
    </div>
  `;
}

async function addAdminUser(event) {
  event.preventDefault();
  if (state.cache.adminSetupMissing) {
    showToast("Crie a tabela app_admins no Supabase antes de adicionar ADMs.");
    return;
  }

  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "admin");
  if (!email) return;

  const { error } = await supabaseClient.from("app_admins").insert({
    email,
    role,
    ativo: true,
    created_by: state.session.user.id
  });

  if (error) {
    showToast(error.message);
    return;
  }

  showToast("Novo ADM adicionado.");
  await loadAdmins();
  renderApp();
  state.page = "admin";
  renderPage();
}

async function removeAdminUser(email) {
  if (!email) return;
  const { error } = await supabaseClient
    .from("app_admins")
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq("email", email.toLowerCase());

  if (error) {
    showToast(error.message);
    return;
  }

  showToast("ADM removido.");
  await loadAdmins();
  renderPage();
}
