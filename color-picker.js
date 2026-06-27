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

function colorPickerHtml(current = "") {
  const normalized = String(current || "").trim().toLowerCase();
  const presetMatch = G3D_COLOR_PRESETS.some(item => item.value && item.value.toLowerCase() === normalized);
  const customValue = presetMatch ? "" : current;
  return `
    <div class="field span-2 color-picker-field">
      <label>Cor</label>
      <input type="hidden" name="cor" id="budgetColorValue" value="${escapeHtml(current || "")}" />
      <div class="color-grid" id="budgetColorGrid">
        ${G3D_COLOR_PRESETS.map(item => {
          const selected = item.custom ? !presetMatch && Boolean(current) : item.value.toLowerCase() === normalized;
          return `<button class="color-chip ${selected ? "active" : ""}" type="button" data-color-name="${escapeHtml(item.value)}" data-custom="${item.custom ? "true" : "false"}"><span class="color-swatch" style="${colorSwatchStyle(item.colors)}"></span><span>${escapeHtml(item.name)}</span></button>`;
        }).join("")}
      </div>
      <div class="custom-color-row" id="customColorRow" style="${customValue ? "" : "display:none"}">
        <input name="cor_custom_text" id="customColorText" value="${escapeHtml(customValue || "")}" placeholder="Ex: Azul petróleo, Silk cobre, Degradê verde/roxo" />
        <input type="color" id="customColorA" value="#24d982" title="Cor inicial" />
        <input type="color" id="customColorB" value="#38bdf8" title="Cor final" />
        <div class="custom-gradient-preview" id="customGradientPreview"></div>
      </div>
    </div>`;
}

function setupColorPicker(form) {
  const colorValue = form.querySelector("#budgetColorValue");
  const customRow = form.querySelector("#customColorRow");
  const customText = form.querySelector("#customColorText");
  const customA = form.querySelector("#customColorA");
  const customB = form.querySelector("#customColorB");
  const preview = form.querySelector("#customGradientPreview");
  const updatePreview = () => {
    if (preview) preview.style.background = `linear-gradient(135deg, ${customA?.value || "#24d982"}, ${customB?.value || "#38bdf8"})`;
  };
  const setCustomValue = () => {
    const label = customText?.value.trim() || "Cor personalizada";
    colorValue.value = label;
  };

  form.querySelectorAll(".color-chip").forEach(button => {
    button.addEventListener("click", () => {
      form.querySelectorAll(".color-chip").forEach(item => item.classList.remove("active"));
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

const colorPreviousOpenBudgetForm = openBudgetForm;
openBudgetForm = function openBudgetFormWithColors(row = {}) {
  colorPreviousOpenBudgetForm(row);
  const form = document.getElementById("budgetForm");
  if (!form) return;
  const oldColorField = [...form.querySelectorAll(".field")].find(field => field.querySelector('input[name="cor"]'));
  if (!oldColorField) return;
  oldColorField.outerHTML = colorPickerHtml(row.cor || form.cor?.value || "");
  setupColorPicker(form);
  form.addEventListener("g3d:color-change", () => {
    const payload = Object.fromEntries(new FormData(form).entries());
    const stock = findStockForBudget(payload);
    if (stock && form.querySelector("#budgetColorValue")) form.querySelector("#budgetColorValue").value = stock.cor || form.querySelector("#budgetColorValue").value;
  });
};
