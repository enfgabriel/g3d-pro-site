const G3D_IMAGE_BUCKET = "g3d-images";
const G3D_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const G3D_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function g3dImageList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch (_error) {
      return [];
    }
  }
  return [];
}

function g3dImageExt(file) {
  const byType = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  return byType[file.type] || "jpg";
}

function g3dCleanFileName(name = "imagem") {
  return String(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "imagem";
}

function g3dAssertImage(file) {
  if (!file) throw new Error("Selecione uma imagem.");
  if (!G3D_IMAGE_TYPES.has(file.type)) throw new Error("Use apenas imagens PNG, JPG, JPEG ou WEBP.");
  if (file.size > G3D_IMAGE_MAX_BYTES) throw new Error("A imagem deve ter no máximo 5 MB.");
}

async function g3dUploadImage(file, folder, stableName = "") {
  g3dAssertImage(file);
  const userId = state.session?.user?.id;
  if (!userId) throw new Error("Faça login novamente para enviar imagens.");
  const clean = stableName ? g3dCleanFileName(stableName) : `${Date.now()}-${g3dCleanFileName(file.name)}`;
  const path = `${userId}/${folder}/${clean}.${g3dImageExt(file)}`;
  const { error } = await supabaseClient.storage.from(G3D_IMAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: true
  });
  if (error) throw error;
  return { path, name: file.name, type: file.type, size: file.size, uploaded_at: new Date().toISOString() };
}

async function g3dAssetUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabaseClient.storage.from(G3D_IMAGE_BUCKET).createSignedUrl(pathOrUrl, 60 * 60);
  if (error) return "";
  return data?.signedUrl || "";
}

async function g3dBudgetImageUrls(row) {
  const items = g3dImageList(row?.imagens);
  const urls = await Promise.all(items.map(async item => ({ ...item, url: await g3dAssetUrl(item.path || item.url) })));
  return urls.filter(item => item.url);
}

function g3dRenderImagePreview(container, items, onRemove) {
  if (!container) return;
  if (!items.length) {
    container.innerHTML = `<p class="muted small">Nenhuma imagem enviada ainda.</p>`;
    return;
  }
  container.innerHTML = items.map((item, index) => `
    <div class="image-preview-item">
      <img src="${escapeHtml(item.preview_url || item.url || "")}" alt="${escapeHtml(item.name || "Imagem do orçamento")}">
      <span>${escapeHtml(item.name || "Imagem")}</span>
      <button type="button" data-remove-image="${index}">Remover</button>
    </div>`).join("");
  container.querySelectorAll("[data-remove-image]").forEach(button => {
    button.addEventListener("click", () => onRemove(Number(button.dataset.removeImage)));
  });
}

async function g3dHydrateImageUrls(items) {
  return Promise.all(items.map(async item => ({ ...item, preview_url: await g3dAssetUrl(item.path || item.url) })));
}

function g3dAttachLogoUploader() {
  const form = document.getElementById("storeForm") || document.getElementById("simpleForm");
  if (!form || form.dataset.g3dLogoUpload === "true") return;
  form.dataset.g3dLogoUpload = "true";
  const profile = state.cache.loja || {};
  if (!form.querySelector('[name="logo_path"]')) form.insertAdjacentHTML("beforeend", `<input type="hidden" name="logo_path" value="${escapeHtml(profile.logo_path || "")}">`);
  if (!form.querySelector('[name="logo_url"]')) form.insertAdjacentHTML("beforeend", `<input type="hidden" name="logo_url" value="${escapeHtml(profile.logo_url || "")}">`);
  const panelHtml = `
    <section class="image-upload-panel span-2">
      <div class="image-upload-head">
        <div>
          <h3>Logo da loja</h3>
          <p>Use PNG, JPG ou WEBP até 5 MB. A logo aparecerá nos PDFs comerciais.</p>
        </div>
        <div class="logo-preview-box" id="logoPreviewBox">G3D</div>
      </div>
      <div class="image-upload-row">
        <input type="file" id="logoFile" accept="image/png,image/jpeg,image/webp">
        <button class="btn" type="button" id="uploadLogoBtn">Enviar logo</button>
      </div>
      <p class="muted small" id="logoUploadStatus">Depois de enviar, clique em Salvar loja.</p>
    </section>`;
  const grid = form.querySelector(".form-grid");
  if (grid) grid.insertAdjacentHTML("beforeend", panelHtml);
  else form.insertAdjacentHTML("beforeend", panelHtml);

  const preview = document.getElementById("logoPreviewBox");
  const status = document.getElementById("logoUploadStatus");
  const logoPathInput = form.querySelector('[name="logo_path"]');
  const logoUrlInput = form.querySelector('[name="logo_url"]');
  const renderLogo = async () => {
    const url = await g3dAssetUrl(logoPathInput.value || logoUrlInput.value);
    preview.innerHTML = url ? `<img src="${escapeHtml(url)}" alt="Logo da loja">` : "G3D";
  };
  renderLogo();

  document.getElementById("uploadLogoBtn").addEventListener("click", async () => {
    const file = document.getElementById("logoFile").files[0];
    try {
      status.textContent = "Enviando logo...";
      const uploaded = await g3dUploadImage(file, "logos", "logo");
      logoPathInput.value = uploaded.path;
      logoUrlInput.value = "";
      await renderLogo();
      status.textContent = "Logo enviada. Clique em Salvar loja para gravar.";
      showToast("Logo enviada.");
    } catch (error) {
      status.textContent = error.message || "Não foi possível enviar a logo.";
      showToast(status.textContent);
    }
  });
}

function g3dAttachBudgetImages(row = {}) {
  const form = document.getElementById("budgetForm");
  if (!form || form.dataset.g3dImageUpload === "true") return;
  form.dataset.g3dImageUpload = "true";
  let images = g3dImageList(row.imagens);
  const afterCalc = document.getElementById("calcBox");
  const html = `
    <section class="image-upload-panel span-2" id="budgetImagePanel">
      <div class="image-upload-head">
        <div>
          <h3>Imagens do orçamento</h3>
          <p>Fotos ou renders para compor o PDF. Arquivos 3MF/STL ficam fora deste envio.</p>
        </div>
      </div>
      <input type="hidden" name="imagens" id="budgetImagesValue" value="${escapeHtml(JSON.stringify(images))}">
      <div class="image-upload-row">
        <input type="file" id="budgetImageFiles" accept="image/png,image/jpeg,image/webp" multiple>
        <button class="btn" type="button" id="uploadBudgetImagesBtn">Enviar imagens</button>
      </div>
      <div class="image-preview-grid" id="budgetImagesPreview"></div>
      <p class="muted small" id="budgetImagesStatus">Envie as imagens antes de salvar o orçamento.</p>
    </section>`;
  if (afterCalc) afterCalc.insertAdjacentHTML("afterend", html);
  else form.querySelector(".form-grid")?.insertAdjacentHTML("beforeend", html);

  const hidden = document.getElementById("budgetImagesValue");
  const preview = document.getElementById("budgetImagesPreview");
  const status = document.getElementById("budgetImagesStatus");
  const sync = async () => {
    hidden.value = JSON.stringify(images.map(({ preview_url, url, ...item }) => item));
    g3dRenderImagePreview(preview, await g3dHydrateImageUrls(images), index => {
      images = images.filter((_item, itemIndex) => itemIndex !== index);
      sync();
    });
  };
  sync();

  document.getElementById("uploadBudgetImagesBtn").addEventListener("click", async () => {
    const files = Array.from(document.getElementById("budgetImageFiles").files || []);
    if (!files.length) return showToast("Selecione ao menos uma imagem.");
    try {
      status.textContent = "Enviando imagens...";
      for (const file of files) images.push(await g3dUploadImage(file, "orcamentos", ""));
      await sync();
      document.getElementById("budgetImageFiles").value = "";
      status.textContent = "Imagens enviadas. Agora salve o orçamento.";
      showToast("Imagens enviadas.");
    } catch (error) {
      status.textContent = error.message || "Não foi possível enviar as imagens.";
      showToast(status.textContent);
    }
  });
}

const imageUploadPreviousRenderLoja = renderLoja;
renderLoja = function renderLojaWithUpload(el) {
  imageUploadPreviousRenderLoja(el);
  g3dAttachLogoUploader();
};

const imageUploadPreviousOpenBudgetForm = openBudgetForm;
openBudgetForm = function openBudgetFormWithImages(row = {}) {
  imageUploadPreviousOpenBudgetForm(row);
  g3dAttachBudgetImages(row);
};

const imageUploadPreviousSaveRecord = saveRecord;
saveRecord = async function saveRecordWithImages(table, payload, id) {
  if (table === "orcamentos" && typeof payload.imagens === "string") payload.imagens = g3dImageList(payload.imagens);
  return imageUploadPreviousSaveRecord(table, payload, id);
};