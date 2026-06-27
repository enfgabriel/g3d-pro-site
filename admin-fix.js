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
