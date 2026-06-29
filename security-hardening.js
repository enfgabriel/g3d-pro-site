(function () {
  const status = {
    version: "20260629-2",
    loaded: false,
    error: "",
    userScopedTables: []
  };
  window.G3D_SECURITY_HARDENING = status;

  try {
    const userScopedTables = new Set([
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

    const singleUserTables = {
      parametros_precificacao: "parametros",
      loja_perfis: "loja"
    };

    function currentUserId() {
      return state.session?.user?.id || null;
    }

    function isUserScopedTable(table) {
      return userScopedTables.has(String(table || ""));
    }

    function securePayload(table, payload = {}, id = null) {
      const normalized = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : { ...payload };
      if (!isUserScopedTable(table)) return normalized;
      const userId = currentUserId();
      if (!userId) return normalized;
      if (!id) normalized.user_id = userId;
      if (id && Object.prototype.hasOwnProperty.call(normalized, "user_id")) delete normalized.user_id;
      return normalized;
    }

    function secureSelect(table) {
      let query = supabaseClient.from(table).select("*");
      const userId = currentUserId();
      if (userId && isUserScopedTable(table)) query = query.eq("user_id", userId);
      return query;
    }

    function secureMutation(table, payload, id = null) {
      const secured = securePayload(table, payload, id);
      let query = id ? supabaseClient.from(table).update(secured).eq("id", id) : supabaseClient.from(table).insert(secured);
      const userId = currentUserId();
      if (id && userId && isUserScopedTable(table)) query = query.eq("user_id", userId);
      return query;
    }

    loadTable = async function loadTableWithUserScope(table) {
      let query = secureSelect(table);
      if (!singleUserTables[table]) query = query.is("deleted_at", null).order("created_at", { ascending: false });
      const { data, error } = await query;
      if (!error) state.cache[table] = data || [];
      return { data, error };
    };

    loadSingle = async function loadSingleWithUserScope(table, key) {
      const { data, error } = await secureSelect(table).maybeSingle();
      if (!error) state.cache[key] = data || null;
      return { data, error };
    };

    saveRecord = async function saveRecordWithUserScope(table, payload, id) {
      if (!state.session) {
        showToast("Faça login novamente para salvar com segurança.");
        return;
      }
      if (table === "orcamentos" && typeof payload.imagens === "string" && typeof g3dImageList === "function") payload.imagens = g3dImageList(payload.imagens);
      const { error } = await secureMutation(table, payload, id);
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
      const userId = currentUserId();
      if (userId && isUserScopedTable(table)) query = query.eq("user_id", userId);
      const { error } = await query;
      if (error) return showToast(error.message);
      showToast("Registro removido.");
      await loadTable(table);
      renderPage();
    };

    if (typeof g3dAssetUrl === "function") {
      const previousAssetUrl = g3dAssetUrl;
      g3dAssetUrl = async function g3dAssetUrlWithTrustedSources(pathOrUrl) {
        if (!pathOrUrl) return "";
        const value = String(pathOrUrl);
        if (/^https?:\/\//i.test(value)) {
          const trustedProject = "https://pbsxxgsgqstwscowxshq.supabase.co/";
          return value.startsWith(trustedProject) ? value : "";
        }
        const userId = currentUserId();
        if (userId && !value.startsWith(`${userId}/`)) return "";
        return previousAssetUrl(value);
      };
    }

    status.loaded = true;
    status.userScopedTables = Array.from(userScopedTables);
    status.hasSession = () => Boolean(state.session);
    status.currentUserId = currentUserId;
  } catch (error) {
    status.loaded = false;
    status.error = error?.message || "Falha ao ativar camada de segurança.";
  }
})();
