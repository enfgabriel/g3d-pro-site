(function () {
  const STORE_FIELDS = [
    ["nome_loja", "Nome da loja"],
    ["responsavel", "Responsavel"],
    ["documento", "CNPJ ou CPF"],
    ["whatsapp", "WhatsApp"],
    ["email", "Email"],
    ["site", "Site ou Instagram"],
    ["cidade", "Cidade"],
    ["estado", "Estado"],
    ["endereco", "Endereco", "textarea"],
    ["observacao_padrao", "Observacao padrao", "textarea"]
  ];

  function storeSafe(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value || "") : String(value || "");
  }

  async function loadCurrentStoreProfile() {
    if (!state.session?.user?.id) return null;
    const query = supabaseClient
      .from("loja_perfis")
      .select("*")
      .eq("user_id", state.session.user.id)
      .order("updated_at", { ascending: false })
      .limit(1);
    const { data, error } = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(() => query) : await query;
    if (error) {
      showToast(error.message || "Nao foi possivel carregar os dados da loja.");
      return state.cache.loja || null;
    }
    state.cache.loja = data?.[0] || null;
    return state.cache.loja;
  }

  function storeFieldHtml(row, key, label, kind) {
    const value = storeSafe(row?.[key] ?? "");
    if (kind === "textarea") {
      return `<div class="field span-2"><label>${label}</label><textarea name="${key}">${value}</textarea></div>`;
    }
    return `<div class="field"><label>${label}</label><input name="${key}" value="${value}" /></div>`;
  }

  function renderLogoPanel(row = {}) {
    return `
      <section class="image-upload-panel span-2">
        <div class="image-upload-head">
          <div>
            <h3>Logo da loja</h3>
            <p>Use PNG, JPG ou WEBP ate 5 MB. A logo sera usada nos PDFs comerciais.</p>
          </div>
          <div class="logo-preview-box" id="storeLogoPreview">G3D</div>
        </div>
        <div class="image-upload-row">
          <input type="file" id="storeLogoFile" accept="image/png,image/jpeg,image/webp">
          <button class="btn" type="button" id="storeLogoUploadBtn">Enviar logo</button>
        </div>
        <p class="muted small" id="storeLogoStatus">Depois de enviar, clique em Salvar loja.</p>
      </section>`;
  }

  async function hydrateStoreLogo(form) {
    const preview = document.getElementById("storeLogoPreview");
    if (!preview) return;
    const logoPath = form.logo_path?.value || "";
    const logoUrl = form.logo_url?.value || "";
    const url = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoPath || logoUrl) : logoUrl;
    preview.innerHTML = url ? `<img src="${storeSafe(url)}" alt="Logo da loja">` : "G3D";
  }

  function storePayloadFromForm(form, current = {}) {
    const payload = Object.fromEntries(new FormData(form).entries());
    const id = payload.id || current.id || null;
    delete payload.id;
    payload.user_id = state.session.user.id;
    payload.updated_at = new Date().toISOString();
    return { id, payload: typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload };
  }

  async function saveStoreProfile(form, current = {}) {
    if (!state.session?.user?.id) return showToast("Faca login novamente para salvar a loja.");
    const button = form.querySelector('[type="submit"]');
    const oldLabel = button?.textContent || "Salvar loja";
    if (button) { button.disabled = true; button.textContent = "Salvando..."; }
    try {
      const { id, payload } = storePayloadFromForm(form, current);
      const query = id
        ? supabaseClient.from("loja_perfis").update(payload).eq("id", id).eq("user_id", state.session.user.id).select("*").single()
        : supabaseClient.from("loja_perfis").insert(payload).select("*").single();
      const { data, error } = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(() => query) : await query;
      if (error) throw error;
      state.cache.loja = data || payload;
      showToast("Dados da loja salvos.");
      renderPage();
    } catch (error) {
      showToast(error.message || "Nao foi possivel salvar os dados da loja.");
    } finally {
      if (button) { button.disabled = false; button.textContent = oldLabel; }
    }
  }

  async function uploadStoreLogo(form) {
    const file = document.getElementById("storeLogoFile")?.files?.[0];
    const status = document.getElementById("storeLogoStatus");
    try {
      if (status) status.textContent = "Enviando logo...";
      if (typeof g3dUploadImage !== "function") throw new Error("Modulo de imagens ainda nao carregou. Recarregue a pagina.");
      const uploaded = await g3dUploadImage(file, "logos", "logo");
      form.logo_path.value = uploaded.path;
      form.logo_url.value = "";
      await hydrateStoreLogo(form);
      if (status) status.textContent = "Logo enviada. Clique em Salvar loja para gravar.";
      showToast("Logo enviada.");
    } catch (error) {
      const message = error.message || "Nao foi possivel enviar a logo.";
      if (status) status.textContent = message;
      showToast(message);
    }
  }

  renderLoja = function renderLojaFixed(el) {
    const row = state.cache.loja || {};
    el.innerHTML = `
      <div class="page-head"><div><h1>Minha loja</h1><p class="muted">Personalizacao usada nos orcamentos, documentos e atendimento.</p></div></div>
      <form class="card" id="storeForm">
        <input type="hidden" name="id" value="${storeSafe(row.id || "")}">
        <input type="hidden" name="logo_path" value="${storeSafe(row.logo_path || "")}">
        <input type="hidden" name="logo_url" value="${storeSafe(row.logo_url || "")}">
        <div class="form-grid">
          ${STORE_FIELDS.map(([key, label, kind]) => storeFieldHtml(row, key, label, kind)).join("")}
          ${renderLogoPanel(row)}
        </div>
        <div class="modal-foot"><button class="btn primary" type="submit">Salvar loja</button></div>
      </form>`;
    const form = document.getElementById("storeForm");
    hydrateStoreLogo(form);
    document.getElementById("storeLogoUploadBtn")?.addEventListener("click", () => uploadStoreLogo(form));
    form.addEventListener("submit", event => {
      event.preventDefault();
      saveStoreProfile(form, row);
    });
  };

  const previousLoadSingle = loadSingle;
  loadSingle = async function loadSingleWithStoreFix(table, key) {
    if (table === "loja_perfis" || key === "loja") return loadCurrentStoreProfile();
    return previousLoadSingle(table, key);
  };

  if (typeof openBudgetPdf === "function") {
    const previousOpenBudgetPdf = openBudgetPdf;
    openBudgetPdf = async function openBudgetPdfWithSignedLogo(row) {
      const profile = state.cache.loja || {};
      if (profile.logo_path && typeof g3dAssetUrl === "function") {
        const signedLogo = await g3dAssetUrl(profile.logo_path);
        state.cache.loja = { ...profile, logo_url: signedLogo || profile.logo_url || "" };
      }
      return previousOpenBudgetPdf(row);
    };
  }

  window.G3D_STORE_PROFILE_FIX = true;
})();
