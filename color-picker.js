const G3D_COLOR_PRESETS = [
  { name: "Preto", value: "Preto", colors: ["#111827"] },
  { name: "Branco", value: "Branco", colors: ["#f8fafc"] },
  { name: "Cinza", value: "Cinza", colors: ["#9ca3af"] },
  { name: "Prata", value: "Prata", colors: ["#cbd5e1", "#64748b"] },
  { name: "Vermelho", value: "Vermelho", colors: ["#ef4444"] },
  { name: "Laranja", value: "Laranja", colors: ["#f97316"] },
  { name: "Amarelo", value: "Amarelo", colors: ["#facc15"] },
  { name: "Verde", value: "Verde", colors: ["#22c55e"] },
  { name: "Azul", value: "Azul", colors: ["#2563eb"] },
  { name: "Roxo", value: "Roxo", colors: ["#7c3aed"] },
  { name: "Rosa", value: "Rosa", colors: ["#ec4899"] },
  { name: "Transparente", value: "Transparente", colors: ["#e0f2fe", "#ffffff"] },
  { name: "Madeira", value: "Madeira", colors: ["#8b5a2b", "#d6a66a"] },
  { name: "Arco-íris", value: "Arco-íris", colors: ["#ef4444", "#facc15", "#22c55e", "#2563eb", "#7c3aed"] },
  { name: "Personalizado", value: "", colors: ["#24d982", "#38bdf8"], custom: true }
];

function colorSwatchStyle(colors) {
  const safe = colors.map(color => escapeHtml(color)).join(", ");
  return colors.length > 1 ? `background: linear-gradient(135deg, ${safe});` : `background: ${safe};`;
}

function colorPickerHtml(current = "", prefix = "budget") {
  const normalized = String(current || "").trim().toLowerCase();
  const presetMatch = G3D_COLOR_PRESETS.some(item => item.value && item.value.toLowerCase() === normalized);
  const customValue = presetMatch ? "" : current;
  return `
    <div class="field span-2 color-picker-field" data-color-picker="${escapeHtml(prefix)}">
      <label>Cor</label>
      <input type="hidden" name="cor" id="${prefix}ColorValue" value="${escapeHtml(current || "")}" />
      <div class="color-grid" id="${prefix}ColorGrid">
        ${G3D_COLOR_PRESETS.map(item => {
          const selected = item.custom ? !presetMatch && Boolean(current) : item.value.toLowerCase() === normalized;
          return `<button class="color-chip ${selected ? "active" : ""}" type="button" data-color-name="${escapeHtml(item.value)}" data-custom="${item.custom ? "true" : "false"}"><span class="color-swatch" style="${colorSwatchStyle(item.colors)}"></span><span>${escapeHtml(item.name)}</span></button>`;
        }).join("")}
      </div>
      <div class="custom-color-row" id="${prefix}CustomColorRow" style="${customValue ? "" : "display:none"}">
        <input name="cor_custom_text" id="${prefix}CustomColorText" value="${escapeHtml(customValue || "")}" placeholder="Ex: Azul petróleo, Silk cobre, Degradê verde/roxo" />
        <input type="color" id="${prefix}CustomColorA" value="#24d982" title="Cor inicial" />
        <input type="color" id="${prefix}CustomColorB" value="#38bdf8" title="Cor final" />
        <div class="custom-gradient-preview" id="${prefix}CustomGradientPreview"></div>
      </div>
    </div>`;
}

function setupColorPicker(form, prefix = "budget") {
  const root = form.querySelector(`[data-color-picker="${prefix}"]`);
  if (!root) return;
  const colorValue = root.querySelector(`#${prefix}ColorValue`);
  const customRow = root.querySelector(`#${prefix}CustomColorRow`);
  const customText = root.querySelector(`#${prefix}CustomColorText`);
  const customA = root.querySelector(`#${prefix}CustomColorA`);
  const customB = root.querySelector(`#${prefix}CustomColorB`);
  const preview = root.querySelector(`#${prefix}CustomGradientPreview`);
  const updatePreview = () => {
    if (preview) preview.style.background = `linear-gradient(135deg, ${customA?.value || "#24d982"}, ${customB?.value || "#38bdf8"})`;
  };
  const setCustomValue = () => {
    const label = customText?.value.trim() || "Cor personalizada";
    colorValue.value = label;
  };

  root.querySelectorAll(".color-chip").forEach(button => {
    button.addEventListener("click", () => {
      root.querySelectorAll(".color-chip").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      const isCustom = button.dataset.custom === "true";
      customRow.style.display = isCustom ? "grid" : "none";
      if (isCustom) setCustomValue();
      else colorValue.value = button.dataset.colorName || "";
      form.dispatchEvent(new Event("g3d:color-change"));
    });
  });

  [customText, customA, customB].forEach(input => input?.addEventListener("input", () => {
    updatePreview();
    setCustomValue();
    form.dispatchEvent(new Event("g3d:color-change"));
  }));
  updatePreview();
}

function replaceColorInputWithPicker(form, prefix, current) {
  const oldColorField = [...form.querySelectorAll(".field")].find(field => field.querySelector('input[name="cor"]'));
  if (!oldColorField) return false;
  oldColorField.outerHTML = colorPickerHtml(current || oldColorField.querySelector('input[name="cor"]')?.value || "", prefix);
  setupColorPicker(form, prefix);
  return true;
}

const colorPreviousOpenBudgetForm = openBudgetForm;
openBudgetForm = function openBudgetFormWithColors(row = {}) {
  colorPreviousOpenBudgetForm(row);
  const form = document.getElementById("budgetForm");
  if (!form) return;
  replaceColorInputWithPicker(form, "budget", row.cor || form.cor?.value || "");
  form.addEventListener("g3d:color-change", () => {
    const payload = Object.fromEntries(new FormData(form).entries());
    const stock = findStockForBudget(payload);
    const colorValue = form.querySelector("#budgetColorValue");
    if (stock && colorValue && !colorValue.value) colorValue.value = stock.cor || "";
  });
};

const colorPreviousOpenForm = openForm;
openForm = function openFormWithStockColors(module, row = {}) {
  colorPreviousOpenForm(module, row);
  if (module?.table !== "estoque") return;
  const form = document.getElementById("recordForm");
  if (!form) return;
  replaceColorInputWithPicker(form, "stock", row.cor || form.cor?.value || "");
};
