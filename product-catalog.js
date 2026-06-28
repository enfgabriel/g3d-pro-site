const G3D_CATALOG_TABLE = "catalogo_produtos";

function catalogSafe(value) {
  return escapeHtml(value || "");
}

function catalogNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ensureCatalogState() {
  state.cache.catalogo_produtos = state.cache.catalogo_produtos || [];
  state.catalogReady = state.catalogReady || { loaded: false, missingTable: false, error: "" };
}

function ensureCatalogNav() {
  if (!navPages.some(([id]) => id === "catalogo")) {
    const stockIndex = navPages.findIndex(([id]) => id === "estoque");
    navPages.splice(stockIndex >= 0 ? stockIndex + 1 : navPages.length, 0, ["catalogo", "Catálogo"]);
  }
}

async function loadCatalogProducts() {
  ensureCatalogState();
  const query = () => supabaseClient
    .from(G3D_CATALOG_TABLE)
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  const { data, error } = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(query) : await query();
  if (error) {
    const text = String(error.message || "").toLowerCase();
    state.catalogReady = { loaded: false, missingTable: text.includes("schema cache") || text.includes("does not exist") || text.includes("not found"), error: error.message || "" };
    state.cache.catalogo_produtos = [];
    return;
  }
  state.catalogReady = { loaded: true, missingTable: false, error: "" };
  state.cache.catalogo_produtos = data || [];
}

function catalogStockOptions(current = "") {
  const rows = state.cache.estoque || [];
  return `<option value="">Sem vínculo</option>${rows.map(item => `<option value="${catalogSafe(item.id)}" ${item.id === current ? "selected" : ""}>${catalogSafe([item.nome, item.material, item.cor].filter(Boolean).join(" · "))}</option>`).join("")}`;
}

function catalogStock(row) {
  if (!row?.estoque_id) return null;
  return (state.cache.estoque || []).find(item => item.id === row.estoque_id) || null;
}

function catalogPrice(row) {
  const base = catalogNumber(row.preco_base, 0);
  if (base > 0) return base;
  const payload = {
    peso_g: catalogNumber(row.peso_g, 0) * Math.max(1, catalogNumber(row.quantidade_pecas, 1)),
    horas: catalogNumber(row.tempo_horas, 0),
    pos_horas: catalogNumber(row.pos_horas, 0)
  };
  return typeof calculatePrice === "function" ? calculatePrice(payload) : 0;
}

function catalogActiveRows() {
  return (state.cache.catalogo_produtos || []).filter(item => item.ativo !== false);
}

function catalogStatsHtml(rows) {
  const active = rows.filter(item => item.ativo !== false).length;
  const services = rows.filter(item => String(item.tipo || "produto") === "servico").length;
  const products = rows.length - services;
  const avg = rows.length ? rows.reduce((sum, item) => sum + catalogPrice(item), 0) / rows.length : 0;
  return `
    <div class="grid catalog-summary">
      <div class="stat"><span>Itens cadastrados</span><strong>${rows.length}</strong></div>
      <div class="stat"><span>Ativos</span><strong>${active}</strong></div>
      <div class="stat"><span>Produtos/serviços</span><strong>${products}/${services}</strong></div>
      <div class="stat"><span>Preço médio</span><strong>${money(avg)}</strong></div>
    </div>`;
}

async function hydrateCatalogImages(root = document) {
  const nodes = Array.from(root.querySelectorAll("[data-catalog-image]"));
  await Promise.all(nodes.map(async node => {
    const source = node.dataset.catalogImage || "";
    const url = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(source) : source;
    if (url) node.innerHTML = `<img src="${catalogSafe(url)}" alt="Imagem do catálogo">`;
  }));
}

function catalogMissingTableHtml() {
  return `
    <div class="page-head"><div><h1>Catálogo</h1><p class="muted">Produtos e serviços recorrentes para orçamentos rápidos.</p></div></div>
    <section class="card catalog-empty-state">
      <h2>Falta ativar a tabela do catálogo</h2>
      <p class="muted">A tela já está pronta. Agora precisamos rodar o SQL do Passo 25 no Supabase para salvar os produtos por usuário com segurança.</p>
      <p class="muted small">Arquivo criado no repositório privado: <strong>supabase/20260628_catalogo_produtos.sql</strong></p>
    </section>`;
}

function renderCatalogo(el) {
  ensureCatalogState();
  if (state.catalogReady?.missingTable) {
    el.innerHTML = catalogMissingTableHtml();
    return;
  }

  const rows = state.cache.catalogo_produtos || [];
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Catálogo</h1><p class="muted">Produtos e serviços recorrentes para criar orçamentos sem começar do zero.</p></div>
      <button class="btn primary" id="newCatalogItem">Novo item</button>
    </div>
    ${catalogStatsHtml(rows)}
    <div class="catalog-grid">
      ${rows.length ? rows.map(row => {
        const stock = catalogStock(row);
        const price = catalogPrice(row);
        const imageSource = row.imagem_path || row.imagem_url || "";
        return `<article class="card catalog-card">
          <div class="catalog-image" ${imageSource ? `data-catalog-image="${catalogSafe(imageSource)}"` : ""}>${imageSource ? "" : "G3D"}</div>
          <div class="catalog-card-body">
            <div class="catalog-card-head">
              <span class="badge ${row.ativo === false ? "warn" : "good"}">${row.ativo === false ? "Inativo" : "Ativo"}</span>
              <span class="badge blue">${catalogSafe(row.tipo === "servico" ? "Serviço" : "Produto")}</span>
            </div>
            <h2>${catalogSafe(row.nome || "Item do catálogo")}</h2>
            <p class="muted small">${catalogSafe(row.descricao || row.observacao || "Sem descrição.")}</p>
            <div class="catalog-meta">
              <span>${catalogSafe([row.material, row.cor].filter(Boolean).join(" - ") || "Material livre")}</span>
              <span>${catalogNumber(row.peso_g, 0).toLocaleString("pt-BR")} g/ml · ${catalogNumber(row.tempo_horas, 0).toLocaleString("pt-BR")} h</span>
              <span>${stock ? `Estoque: ${catalogSafe(stock.nome || stock.material || "vinculado")}` : "Sem estoque vinculado"}</span>
            </div>
            <div class="catalog-price"><span>Preço sugerido</span><strong>${money(price)}</strong></div>
            <div class="actions catalog-actions">
              <button class="btn" data-edit-catalog="${row.id}">Editar</button>
              <button class="btn primary" data-budget-catalog="${row.id}">Orçar</button>
              <button class="btn danger" data-del-catalog="${row.id}">Excluir</button>
            </div>
          </div>
        </article>`;
      }).join("") : `<section class="card catalog-empty-state"><h2>Nenhum item no catálogo ainda.</h2><p class="muted">Cadastre peças recorrentes, serviços de impressão, acabamento ou pacotes para acelerar os orçamentos.</p></section>`}
    </div>`;

  document.getElementById("newCatalogItem")?.addEventListener("click", () => openCatalogForm());
  document.querySelectorAll("[data-edit-catalog]").forEach(button => button.addEventListener("click", () => openCatalogForm(rows.find(item => item.id === button.dataset.editCatalog))));
  document.querySelectorAll("[data-del-catalog]").forEach(button => button.addEventListener("click", () => deleteCatalogItem(button.dataset.delCatalog)));
  document.querySelectorAll("[data-budget-catalog]").forEach(button => button.addEventListener("click", () => createBudgetFromCatalog(rows.find(item => item.id === button.dataset.budgetCatalog))));
  hydrateCatalogImages(el);
}

function openCatalogForm(row = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal catalog-modal" id="catalogForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} item do catálogo</strong><button class="btn" type="button" id="closeCatalog">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Tipo</label><select name="tipo"><option value="produto" ${row.tipo !== "servico" ? "selected" : ""}>Produto</option><option value="servico" ${row.tipo === "servico" ? "selected" : ""}>Serviço</option></select></div>
          <div class="field"><label>Status</label><select name="ativo"><option value="true" ${row.ativo !== false ? "selected" : ""}>Ativo</option><option value="false" ${row.ativo === false ? "selected" : ""}>Inativo</option></select></div>
          <div class="field"><label>Nome</label><input name="nome" value="${catalogSafe(row.nome || "")}" required></div>
          <div class="field"><label>SKU ou código interno</label><input name="sku" value="${catalogSafe(row.sku || "")}"></div>
          <div class="field"><label>Categoria</label><input name="categoria" value="${catalogSafe(row.categoria || "")}" placeholder="Ex.: miniatura, manutenção, protótipo"></div>
          <div class="field"><label>Estoque vinculado</label><select name="estoque_id" id="catalogStockSelect">${catalogStockOptions(row.estoque_id || "")}</select></div>
          <div class="field"><label>Material</label><input name="material" value="${catalogSafe(row.material || "PLA")}"></div>
          <div class="field"><label>Cor</label><input name="cor" value="${catalogSafe(row.cor || "")}"></div>
          <div class="field"><label>Peso por unidade g/ml</label><input type="number" step="0.01" name="peso_g" value="${catalogSafe(row.peso_g || 0)}"></div>
          <div class="field"><label>Quantidade padrão</label><input type="number" step="1" name="quantidade_pecas" value="${catalogSafe(row.quantidade_pecas || 1)}"></div>
          <div class="field"><label>Tempo de impressão h</label><input type="number" step="0.01" name="tempo_horas" value="${catalogSafe(row.tempo_horas || 0)}"></div>
          <div class="field"><label>Pós-processamento h</label><input type="number" step="0.01" name="pos_horas" value="${catalogSafe(row.pos_horas || 0)}"></div>
          <div class="field"><label>Preço base manual</label><input type="number" step="0.01" name="preco_base" value="${catalogSafe(row.preco_base || 0)}"></div>
          <div class="field"><label>Margem específica %</label><input type="number" step="0.01" name="margem_percentual" value="${catalogSafe(row.margem_percentual || "")}" placeholder="Opcional"></div>
          <div class="field span-2"><label>Descrição comercial</label><textarea name="descricao">${catalogSafe(row.descricao || "")}</textarea></div>
          <div class="field span-2"><label>Observações internas</label><textarea name="observacao">${catalogSafe(row.observacao || "")}</textarea></div>
          <input type="hidden" name="imagem_path" value="${catalogSafe(row.imagem_path || "")}">
          <input type="hidden" name="imagem_url" value="${catalogSafe(row.imagem_url || "")}">
          <section class="catalog-image-panel span-2">
            <div class="catalog-image-preview" id="catalogImagePreview">G3D</div>
            <div>
              <h3>Imagem do item</h3>
              <p class="muted small">Use PNG, JPG ou WEBP até 5 MB. A imagem ajuda a compor o catálogo e pode ir para o orçamento depois.</p>
              <div class="catalog-upload-row"><input type="file" id="catalogImageFile" accept="image/png,image/jpeg,image/webp"><button class="btn" type="button" id="uploadCatalogImage">Enviar imagem</button></div>
              <p class="muted small" id="catalogImageStatus">Depois de enviar, clique em Salvar.</p>
            </div>
          </section>
          <div class="calc-box span-2" id="catalogCalcBox">Preço sugerido: ${money(catalogPrice(row))}</div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelCatalog">Cancelar</button><button class="btn primary" type="submit">Salvar item</button></div>
    </form>`;
  document.body.appendChild(backdrop);
  const form = document.getElementById("catalogForm");
  const close = () => backdrop.remove();
  document.getElementById("closeCatalog").addEventListener("click", close);
  document.getElementById("cancelCatalog").addEventListener("click", close);
  setupCatalogFormInteractions(form, row);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    await saveCatalogItem(Object.fromEntries(new FormData(form).entries()), row.id);
    close();
  });
}

function setupCatalogFormInteractions(form, row) {
  const preview = document.getElementById("catalogImagePreview");
  const imagePath = form.querySelector('[name="imagem_path"]');
  const imageUrl = form.querySelector('[name="imagem_url"]');
  const renderImage = async () => {
    const url = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(imagePath.value || imageUrl.value) : imageUrl.value;
    preview.innerHTML = url ? `<img src="${catalogSafe(url)}" alt="Imagem do catálogo">` : "G3D";
  };
  renderImage();

  const syncPrice = () => {
    const data = Object.fromEntries(new FormData(form).entries());
    document.getElementById("catalogCalcBox").textContent = `Preço sugerido: ${money(catalogPrice(data))}`;
  };
  ["peso_g", "quantidade_pecas", "tempo_horas", "pos_horas", "preco_base"].forEach(name => form[name]?.addEventListener("input", syncPrice));

  document.getElementById("catalogStockSelect").addEventListener("change", event => {
    const stock = (state.cache.estoque || []).find(item => item.id === event.target.value);
    if (!stock) return;
    form.material.value = stock.material || stock.nome || form.material.value;
    form.cor.value = stock.cor || form.cor.value;
    syncPrice();
  });

  document.getElementById("uploadCatalogImage").addEventListener("click", async () => {
    const status = document.getElementById("catalogImageStatus");
    const file = document.getElementById("catalogImageFile").files[0];
    try {
      if (typeof g3dUploadImage !== "function") throw new Error("Upload de imagens ainda não carregou. Recarregue a página.");
      status.textContent = "Enviando imagem...";
      const uploaded = await g3dUploadImage(file, "catalogo", "");
      imagePath.value = uploaded.path;
      imageUrl.value = "";
      await renderImage();
      status.textContent = "Imagem enviada. Agora salve o item.";
      showToast("Imagem do catálogo enviada.");
    } catch (error) {
      status.textContent = error.message || "Não foi possível enviar a imagem.";
      showToast(status.textContent);
    }
  });
}

async function saveCatalogItem(payload, id = "") {
  ensureCatalogState();
  ["peso_g", "tempo_horas", "pos_horas", "quantidade_pecas", "preco_base", "margem_percentual"].forEach(key => {
    if (payload[key] === "") payload[key] = null;
    else payload[key] = Number(payload[key] || 0);
  });
  payload.ativo = payload.ativo === "true";
  if (!payload.estoque_id) payload.estoque_id = null;
  payload.user_id = state.session.user.id;
  payload.updated_at = new Date().toISOString();
  const cleanPayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
  const query = id
    ? () => supabaseClient.from(G3D_CATALOG_TABLE).update(cleanPayload).eq("id", id)
    : () => supabaseClient.from(G3D_CATALOG_TABLE).insert(cleanPayload);
  const result = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(query) : await query();
  if (result.error) {
    const text = String(result.error.message || "").toLowerCase();
    if (text.includes("schema cache") || text.includes("does not exist") || text.includes("not found")) {
      state.catalogReady.missingTable = true;
      showToast("Falta rodar o SQL do catálogo no Supabase.");
      renderPage();
      return;
    }
    showToast(result.error.message);
    return;
  }
  showToast("Item do catálogo salvo.");
  await loadCatalogProducts();
  renderPage();
}

async function deleteCatalogItem(id) {
  const result = await supabaseClient.from(G3D_CATALOG_TABLE).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (result.error) return showToast(result.error.message);
  showToast("Item removido do catálogo.");
  await loadCatalogProducts();
  renderPage();
}

function catalogBudgetPayload(item) {
  const price = catalogPrice(item);
  const images = item.imagem_path || item.imagem_url ? [{ path: item.imagem_path || "", url: item.imagem_url || "", name: item.nome || "Imagem do catálogo" }] : [];
  return {
    numero: typeof nextNumber === "function" ? nextNumber("ORC", state.cache.orcamentos.length) : "ORC",
    projeto: item.nome || "Item do catálogo",
    status: "rascunho",
    material: item.material || "",
    cor: item.cor || "",
    peso_g: catalogNumber(item.peso_g, 0) * Math.max(1, catalogNumber(item.quantidade_pecas, 1)),
    horas: catalogNumber(item.tempo_horas, 0),
    pos_horas: catalogNumber(item.pos_horas, 0),
    quantidade_pecas: Math.max(1, catalogNumber(item.quantidade_pecas, 1)),
    total: price,
    estoque_id: item.estoque_id || null,
    imagens: images,
    observacao: [
      item.descricao || "",
      item.sku ? `SKU: ${item.sku}` : "",
      item.observacao ? `Observação interna do catálogo: ${item.observacao}` : ""
    ].filter(Boolean).join("\n")
  };
}

async function createBudgetFromCatalog(item) {
  if (!item) return;
  const payload = catalogBudgetPayload(item);
  const cleanPayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
  const result = await supabaseClient.from("orcamentos").insert(cleanPayload).select("id, numero").single();
  if (result.error) return showToast(result.error.message);
  showToast(`Orçamento ${result.data?.numero || ""} criado a partir do catálogo.`);
  await loadTable("orcamentos");
  state.page = "orcamentos";
  renderApp();
  renderPage();
}

ensureCatalogNav();

const catalogPreviousRenderApp = renderApp;
renderApp = function renderAppWithCatalog() {
  ensureCatalogNav();
  catalogPreviousRenderApp();
};

const catalogPreviousRenderPage = renderPage;
renderPage = function renderPageWithCatalog() {
  if (state.page === "catalogo") {
    const el = document.getElementById("content");
    if (!el) return;
    return renderCatalogo(el);
  }
  return catalogPreviousRenderPage();
};

const catalogPreviousLoadAll = loadAll;
loadAll = async function loadAllWithCatalog() {
  await catalogPreviousLoadAll();
  await loadCatalogProducts();
  renderPage();
};
