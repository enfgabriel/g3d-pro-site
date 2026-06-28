function g3dAuthErrorMessage(error) {
  const text = String(error?.message || error || "").toLowerCase();
  return text.includes("jwt expired") || text.includes("invalid jwt") || text.includes("session") || text.includes("refresh_token") || text.includes("not authenticated");
}

async function g3dEnsureFreshSession() {
  const current = await supabaseClient.auth.getSession();
  if (current.error) return { session: null, error: current.error };

  let session = current.data?.session || null;
  const expiresAt = Number(session?.expires_at || 0);
  const now = Math.floor(Date.now() / 1000);

  if (!session || expiresAt <= now + 90) {
    const refreshed = await supabaseClient.auth.refreshSession();
    if (refreshed.error || !refreshed.data?.session) return { session: null, error: refreshed.error || new Error("Sessão expirada") };
    session = refreshed.data.session;
  }

  state.session = session;
  return { session, error: null };
}

async function g3dRunWithFreshSession(action) {
  const ready = await g3dEnsureFreshSession();
  if (ready.error || !ready.session) {
    showToast("Sua sessão expirou. Entre novamente para salvar com segurança.");
    await supabaseClient.auth.signOut();
    renderAuth();
    return { data: null, error: ready.error || new Error("Sessão expirada") };
  }

  let result = await action();
  if (result?.error && g3dAuthErrorMessage(result.error)) {
    const refreshed = await supabaseClient.auth.refreshSession();
    if (!refreshed.error && refreshed.data?.session) {
      state.session = refreshed.data.session;
      result = await action();
    }
  }

  if (result?.error && g3dAuthErrorMessage(result.error)) {
    showToast("Sua sessão expirou. Entre novamente para salvar com segurança.");
    await supabaseClient.auth.signOut();
    renderAuth();
  }

  return result;
}

const sessionGuardPreviousSaveRecord = saveRecord;
saveRecord = async function saveRecordWithFreshSession(table, payload, id) {
  const result = await g3dRunWithFreshSession(() => {
    const query = id ? supabaseClient.from(table).update(payload).eq("id", id) : supabaseClient.from(table).insert(payload);
    return query;
  });
  if (result.error) {
    if (!g3dAuthErrorMessage(result.error)) showToast(result.error.message);
    return;
  }
  showToast("Registro salvo.");
  await loadTable(table);
  if (table === "orcamentos") state.page = "orcamentos";
  renderPage();
};

const sessionGuardPreviousSoftDelete = softDelete;
softDelete = async function softDeleteWithFreshSession(table, id) {
  const result = await g3dRunWithFreshSession(() => supabaseClient.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id));
  if (result.error) {
    if (!g3dAuthErrorMessage(result.error)) showToast(result.error.message);
    return;
  }
  showToast("Registro removido.");
  await loadTable(table);
  renderPage();
};

const sessionGuardPreviousRenderLoja = renderLoja;
renderLoja = function renderLojaWithFreshSession(el) {
  renderSimpleForm(el, "Minha loja", "Personalização usada nos orçamentos e documentos.", ["nome_loja:Nome da loja", "responsavel:Responsável", "documento:CNPJ ou CPF", "whatsapp:WhatsApp", "email:Email", "site:Site ou Instagram", "cidade:Cidade", "estado:Estado", "endereco:Endereço", "observacao_padrao:Observação padrão"], state.cache.loja || {}, async payload => {
    const ready = await g3dEnsureFreshSession();
    if (ready.error || !ready.session) return showToast("Sua sessão expirou. Entre novamente para salvar com segurança.");
    payload.user_id = ready.session.user.id;
    payload.updated_at = new Date().toISOString();
    const result = await g3dRunWithFreshSession(() => supabaseClient.from("loja_perfis").upsert(payload, { onConflict: "user_id" }));
    if (result.error) {
      if (!g3dAuthErrorMessage(result.error)) showToast(result.error.message);
      return;
    }
    showToast("Personalização salva.");
    await loadSingle("loja_perfis", "loja");
    renderPage();
  });
};
