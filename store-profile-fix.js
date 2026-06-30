(function () {
  const STORE_FIELDS = [
    ["nome_loja", "Nome da loja"],
    ["responsavel", "Responsável"],
    ["documento", "CNPJ ou CPF"],
    ["whatsapp", "WhatsApp"],
    ["email", "Email"],
    ["site", "Site ou Instagram"],
    ["cidade", "Cidade"],
    ["estado", "Estado"],
    ["endereco", "Endereço", "textarea"],
    ["observacao_padrao", "Observação padrão", "textarea"]
  ];

  function storeSafe(value) {
    return typeof escapeHtml === "function" ? escapeHtml(value || "") : String(value || "");
  }

  function storeInput(form, name) {
    return form?.querySelector(`[name="${name}"]`) || null;
  }

  function storeInputValue(form, name) {
    return storeInput(form, name)?.value || "";
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
      showToast(error.message || "Não foi possível carregar os dados da loja.");
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

  function renderLogoPanel() {
    return `
      <section class="image-upload-panel span-2">
        <div class="image-upload-head">
          <div>
            <h3>Logo da loja</h3>
            <p>Use PNG, JPG ou WEBP até 5 MB. Ao selecionar o arquivo, o envio começa automaticamente.</p>
          </div>
          <div class="logo-preview-box" id="storeLogoPreview">G3D</div>
        </div>
        <div class="image-upload-row">
          <input type="file" id="storeLogoFile" accept="image/png,image/jpeg,image/webp">
          <button class="btn" type="button" id="storeLogoUploadBtn">Enviar e salvar logo</button>
        </div>
        <p class="muted small" id="storeLogoStatus">Selecione uma imagem para enviar e salvar no perfil da loja.</p>
      </section>`;
  }

  async function hydrateStoreLogo(form) {
    const preview = document.getElementById("storeLogoPreview");
    if (!preview) return;
    const logoPath = storeInputValue(form, "logo_path");
    const logoUrl = storeInputValue(form, "logo_url");
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

  async function persistStoreProfile(form, current = {}) {
    const { id, payload } = storePayloadFromForm(form, current);
    const query = id
      ? supabaseClient.from("loja_perfis").update(payload).eq("id", id).eq("user_id", state.session.user.id).select("*").single()
      : supabaseClient.from("loja_perfis").insert(payload).select("*").single();
    const { data, error } = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(() => query) : await query;
    if (error) throw error;
    state.cache.loja = data || payload;
    const idInput = storeInput(form, "id");
    if (data?.id && idInput) idInput.value = data.id;
    return state.cache.loja;
  }

  async function saveStoreProfile(form, current = {}) {
    if (!state.session?.user?.id) return showToast("Faça login novamente para salvar a loja.");
    const button = form.querySelector('[type="submit"]');
    const oldLabel = button?.textContent || "Salvar loja";
    if (button) { button.disabled = true; button.textContent = "Salvando..."; }
    try {
      await persistStoreProfile(form, current);
      showToast("Dados da loja salvos.");
      renderPage();
    } catch (error) {
      showToast(error.message || "Não foi possível salvar os dados da loja.");
    } finally {
      if (button) { button.disabled = false; button.textContent = oldLabel; }
    }
  }

  async function uploadStoreLogo(form) {
    const fileInput = document.getElementById("storeLogoFile");
    const file = fileInput?.files?.[0];
    const status = document.getElementById("storeLogoStatus");
    const uploadButton = document.getElementById("storeLogoUploadBtn");
    const logoPathInput = storeInput(form, "logo_path");
    const logoUrlInput = storeInput(form, "logo_url");
    const oldLabel = uploadButton?.textContent || "Enviar e salvar logo";
    try {
      if (!logoPathInput || !logoUrlInput) throw new Error("Campos da logo não carregaram. Recarregue a página.");
      if (!file) throw new Error("Selecione uma imagem para enviar.");
      if (status) status.textContent = `Enviando ${file.name}...`;
      if (uploadButton) { uploadButton.disabled = true; uploadButton.textContent = "Enviando..."; }
      if (typeof g3dUploadImage !== "function") throw new Error("Módulo de imagens ainda não carregou. Recarregue a página.");
      const uploaded = await g3dUploadImage(file, "logos", "logo");
      logoPathInput.value = uploaded.path;
      logoUrlInput.value = "";
      if (status) status.textContent = "Logo enviada. Salvando no perfil da loja...";
      await persistStoreProfile(form, state.cache.loja || {});
      await hydrateStoreLogo(form);
      if (fileInput) fileInput.value = "";
      if (status) status.textContent = "Logo enviada e salva no perfil da loja.";
      showToast("Logo enviada e salva.");
    } catch (error) {
      const message = error.message || "Não foi possível enviar a logo.";
      if (status) status.textContent = message;
      showToast(message);
    } finally {
      if (uploadButton) { uploadButton.disabled = false; uploadButton.textContent = oldLabel; }
    }
  }

  renderLoja = function renderLojaFixed(el) {
    const row = state.cache.loja || {};
    el.innerHTML = `
      <div class="page-head"><div><h1>Minha loja</h1><p class="muted">Personalização usada nos orçamentos, documentos e atendimento.</p></div></div>
      <form class="card" id="storeForm">
        <input type="hidden" name="id" value="${storeSafe(row.id || "")}">
        <input type="hidden" name="logo_path" value="${storeSafe(row.logo_path || "")}">
        <input type="hidden" name="logo_url" value="${storeSafe(row.logo_url || "")}">
        <div class="form-grid">
          ${STORE_FIELDS.map(([key, label, kind]) => storeFieldHtml(row, key, label, kind)).join("")}
          ${renderLogoPanel()}
        </div>
        <div class="modal-foot"><button class="btn primary" type="submit">Salvar loja</button></div>
      </form>`;
    const form = document.getElementById("storeForm");
    hydrateStoreLogo(form);
    document.getElementById("storeLogoUploadBtn")?.addEventListener("click", () => uploadStoreLogo(form));
    document.getElementById("storeLogoFile")?.addEventListener("change", event => {
      const file = event.target.files?.[0];
      const status = document.getElementById("storeLogoStatus");
      if (status && file) status.textContent = `${file.name} selecionado. Iniciando envio...`;
      if (file) uploadStoreLogo(form);
    });
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

  window.G3D_STORE_PROFILE_FIX = true;
})();
