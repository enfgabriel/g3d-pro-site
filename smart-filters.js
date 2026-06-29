const G3D_FILTER_PAGES = {
  clientes: { label: "clientes", target: "table", placeholder: "Buscar por nome, empresa, CPF, telefone, cidade...", status: false, material: false },
  estoque: { label: "materiais", target: ".stock-card", placeholder: "Buscar material, cor, marca, fornecedor, lote...", status: true, material: true },
  catalogo: { label: "itens", target: ".catalog-card", placeholder: "Buscar produto, serviço, SKU, categoria, material...", status: true, material: true },
  orcamentos: { label: "orçamentos", target: "table", placeholder: "Buscar número, projeto, cliente, material...", status: true, material: true },
  pedidos: { label: "pedidos", target: "table", placeholder: "Buscar pedido, cliente, pagamento, material...", status: true, material: true },
  producao: { label: "produções", target: "table", placeholder: "Buscar produção, etapa, material, falha...", status: true, material: true }
};

function smartFilterNormalize(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function smartFilterOptionText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function smartFilterPageState(page) {
  state.smartFilters = state.smartFilters || {};
  state.smartFilters[page] = state.smartFilters[page] || { search: "", status: "", material: "" };
  return state.smartFilters[page];
}

function smartFilterRoots(el, config) {
  if (config.target === "table") {
    return Array.from(el.querySelectorAll("tbody tr")).filter(row => !row.querySelector(".empty"));
  }
  return Array.from(el.querySelectorAll(config.target));
}

function smartFilterStatusText(root) {
  return Array.from(root.querySelectorAll(".badge")).map(node => smartFilterOptionText(node.textContent)).filter(Boolean).join(" ");
}

function smartFilterMaterialText(root) {
  const text = smartFilterOptionText(root.textContent);
  const known = ["pla", "pla+", "petg", "abs", "asa", "tpu", "nylon", "pc", "resina"];
  const normalized = smartFilterNormalize(text);
  return known.filter(item => normalized.includes(item)).join(" ");
}

function smartFilterUniqueOptions(values) {
  const seen = new Set();
  return values
    .map(smartFilterOptionText)
    .filter(Boolean)
    .filter(value => {
      const key = smartFilterNormalize(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function smartFilterStatusOptions(roots) {
  return smartFilterUniqueOptions(roots.flatMap(root => Array.from(root.querySelectorAll(".badge")).map(node => node.textContent)));
}

function smartFilterMaterialOptions(roots) {
  const base = ["PLA", "PLA+", "PETG", "ABS", "ASA", "TPU", "Nylon", "PC", "Resina"];
  const used = roots.map(root => smartFilterMaterialText(root)).join(" ");
  const normalized = smartFilterNormalize(used);
  return base.filter(item => normalized.includes(smartFilterNormalize(item)));
}

function smartFilterSelectHtml(id, label, options, current) {
  return `
    <div class="field">
      <label>${escapeHtml(label)}</label>
      <select id="${id}">
        <option value="">Todos</option>
        ${options.map(option => `<option value="${escapeHtml(option)}" ${option === current ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </div>`;
}

function smartFilterPanelHtml(page, config, roots) {
  const values = smartFilterPageState(page);
  const statusOptions = config.status ? smartFilterStatusOptions(roots) : [];
  const materialOptions = config.material ? smartFilterMaterialOptions(roots) : [];
  return `
    <section class="card smart-filter-panel" id="smartFilterPanel">
      <div class="smart-filter-head">
        <div>
          <h2>Busca e filtros</h2>
          <p class="muted">Encontre ${escapeHtml(config.label)} por texto, status e material.</p>
        </div>
        <strong id="smartFilterCount">${roots.length}/${roots.length}</strong>
      </div>
      <div class="smart-filter-grid">
        <div class="field smart-filter-search">
          <label>Busca</label>
          <input id="smartFilterSearch" value="${escapeHtml(values.search)}" placeholder="${escapeHtml(config.placeholder)}">
        </div>
        ${config.status ? smartFilterSelectHtml("smartFilterStatus", "Status", statusOptions, values.status) : ""}
        ${config.material ? smartFilterSelectHtml("smartFilterMaterial", "Material", materialOptions, values.material) : ""}
        <div class="smart-filter-actions"><button class="btn" type="button" id="smartFilterClear">Limpar</button></div>
      </div>
    </section>`;
}

function smartFilterApply(el, page, config) {
  const values = smartFilterPageState(page);
  const roots = smartFilterRoots(el, config);
  const search = smartFilterNormalize(values.search);
  const status = smartFilterNormalize(values.status);
  const material = smartFilterNormalize(values.material);
  let visible = 0;

  roots.forEach(root => {
    const text = smartFilterNormalize(root.textContent);
    const statusText = smartFilterNormalize(smartFilterStatusText(root));
    const materialText = smartFilterNormalize(`${smartFilterMaterialText(root)} ${root.textContent}`);
    const matchSearch = !search || text.includes(search);
    const matchStatus = !status || statusText.includes(status) || text.includes(status);
    const matchMaterial = !material || materialText.includes(material);
    const show = matchSearch && matchStatus && matchMaterial;
    root.classList.toggle("smart-filter-hidden", !show);
    if (show) visible += 1;
  });

  const count = el.querySelector("#smartFilterCount");
  if (count) count.textContent = `${visible}/${roots.length}`;

  const empty = el.querySelector("#smartFilterEmpty");
  if (empty) empty.remove();
  if (!visible && roots.length) {
    const target = el.querySelector(".table-wrap, .stock-list, .catalog-grid") || el;
    target.insertAdjacentHTML("afterend", `<div class="card smart-filter-empty" id="smartFilterEmpty">Nenhum resultado encontrado com os filtros atuais.</div>`);
  }
}

function smartFilterAttach(el) {
  const page = state.page;
  const config = G3D_FILTER_PAGES[page];
  if (!el || !config || el.querySelector("#smartFilterPanel")) return;
  const roots = smartFilterRoots(el, config);
  if (!roots.length) return;
  const anchor = el.querySelector(".table-wrap, .stock-list, .catalog-grid") || el.querySelector(".grid") || el.firstElementChild;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = smartFilterPanelHtml(page, config, roots);
  if (anchor) anchor.insertAdjacentElement("beforebegin", wrapper.firstElementChild);
  else el.prepend(wrapper.firstElementChild);

  const values = smartFilterPageState(page);
  const search = el.querySelector("#smartFilterSearch");
  const status = el.querySelector("#smartFilterStatus");
  const material = el.querySelector("#smartFilterMaterial");
  const clear = el.querySelector("#smartFilterClear");
  const update = () => {
    values.search = search?.value || "";
    values.status = status?.value || "";
    values.material = material?.value || "";
    smartFilterApply(el, page, config);
  };

  search?.addEventListener("input", update);
  status?.addEventListener("change", update);
  material?.addEventListener("change", update);
  clear?.addEventListener("click", () => {
    values.search = "";
    values.status = "";
    values.material = "";
    if (search) search.value = "";
    if (status) status.value = "";
    if (material) material.value = "";
    smartFilterApply(el, page, config);
  });
  smartFilterApply(el, page, config);
}

const smartFiltersPreviousRenderPage = renderPage;
renderPage = function renderPageWithSmartFilters() {
  const result = smartFiltersPreviousRenderPage();
  const el = document.getElementById("content");
  if (el) smartFilterAttach(el);
  return result;
};

if (typeof renderCatalogo === "function") {
  const smartFiltersPreviousRenderCatalogo = renderCatalogo;
  renderCatalogo = function renderCatalogoWithSmartFilters(el) {
    smartFiltersPreviousRenderCatalogo(el);
    smartFilterAttach(el);
  };
}
