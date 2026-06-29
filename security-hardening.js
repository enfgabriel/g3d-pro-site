const G3D_USER_SCOPED_TABLES = new Set([
  "clientes",
  "estoque",
  "orcamentos",
  "pedidos",
  "producoes",
  "parametros_precificacao",
  "loja_perfis",
  "catalogo_produtos",
  "financeiro_lancamentos",
  "producao_historico"
]);

const G3D_SINGLE_USER_TABLES = {
  parametros_precificacao: "parametros",
  loja_perfis: "loja"
};

function g3dCurrentUserId() {
  return state.session?.user?.id || null;
}

function g3dIsUserScopedTable(table) {
  return G3D_USER_SCOPED_TABLES.has(String(table || ""));
}

function g3dSecurePayload(table, payload = {}, id = null) {
  const normalized = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : { ...payload };
  if (!g3dIsUserScopedTable(table)) return normalized;
  const userId = g3dCurrentUserId();
  if (!userId) return normalized;
  if (!id) normalized.user_id = userId;
  if (id && Object.prototype.hasOwnProperty.call(normalized, "user_id")) delete normalized.user_id;
  return normalized;
}

function g3dSecureSelect(table) {
  let query = supabaseClient.from(table).select("*");
  const userId = g3dCurrentUserId();
  if (userId && g3dIsUserScopedTable(table)) query = query.eq("user_id", userId);
  return query;
}

function g3dSecureMutation(table, payload, id = null) {
  const secured = g3dSecurePayload(table, payload, id);
  let query = id ? supabaseClient.from(table).update(secured).eq("id", id) : supabaseClient.from(table).insert(secured);
  const userId = g3dCurrentUserId();
  if (id && userId && g3dIsUserScopedTable(table)) query = query.eq("user_id", userId);
  return query;
}

loadTable = async function loadTableWithUserScope(table) {
  let query = g3dSecureSelect(table);
  if (!G3D_SINGLE_USER_TABLES[table]) query = query.is("deleted_at", null).order("created_at", { ascending: false });
  const { data, error } = await query;
  if (!error) state.cache[table] = data || [];
  return { data, error };
};

loadSingle = async function loadSingleWithUserScope(table, key) {
  let query = g3dSecureSelect(table).maybeSingle();
  const { data, error } = await query;
  if (!error) state.cache[key] = data || null;
  return { data, error };
};

saveRecord = async function saveRecordWithUserScope(table, payload, id) {
  if (!state.session) {
    showToast("Faça login novamente para salvar com segurança.");
    return;
  }
  if (table === "orcamentos" && typeof payload.imagens === "string" && typeof g3dImageList === "function") payload.imagens = g3dImageList(payload.imagens);
  const { error } = await g3dSecureMutation(table, payload, id);
  if (error) return showToast(error.message);
  showToast("Registro salvo.");
  await loadTable(table);
  if (table === "orcamentos") state.page = "orcamentos";
  renderPage();
};

softDelete = async function softDeleteWithUserScope(table, id) {
  if (!state.session) {
    showToast("Faça login novamente para remover com segurança.");
    return;
  }
  let query = supabaseClient.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  const userId = g3dCurrentUserId();
  if (userId && g3dIsUserScopedTable(table)) query = query.eq("user_id", userId);
  const { error } = await query;
  if (error) return showToast(error.message);
  showToast("Registro removido.");
  await loadTable(table);
  renderPage();
};

if (typeof g3dAssetUrl === "function") {
  const g3dPreviousAssetUrl = g3dAssetUrl;
  g3dAssetUrl = async function g3dAssetUrlWithTrustedSources(pathOrUrl) {
    if (!pathOrUrl) return "";
    const value = String(pathOrUrl);
    if (/^https?:\/\//i.test(value)) {
      const trustedProject = "https://pbsxxgsgqstwscowxshq.supabase.co/";
      return value.startsWith(trustedProject) ? value : "";
    }
    const userId = g3dCurrentUserId();
    if (userId && !value.startsWith(`${userId}/`)) return "";
    return g3dPreviousAssetUrl(value);
  };
}

window.G3D_SECURITY_HARDENING = {
  version: "20260629-1",
  userScopedTables: Array.from(G3D_USER_SCOPED_TABLES),
  hasSession: () => Boolean(state.session),
  currentUserId: g3dCurrentUserId
};
