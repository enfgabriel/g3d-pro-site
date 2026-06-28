const G3D_DATE_FIELDS = new Set([
  "data_entrega",
  "data_prevista",
  "data_compra",
  "data_validade",
  "prazo_entrega",
  "estoque_baixado_em",
  "created_at",
  "updated_at",
  "deleted_at"
]);

const G3D_UUID_FIELDS = new Set([
  "id",
  "user_id",
  "cliente_id",
  "orcamento_id",
  "pedido_id",
  "producao_id",
  "estoque_id"
]);

function g3dIsEmptyString(value) {
  return typeof value === "string" && value.trim() === "";
}

function g3dNormalizePayload(payload = {}) {
  const normalized = { ...payload };
  Object.keys(normalized).forEach(key => {
    if (!g3dIsEmptyString(normalized[key])) return;
    if (G3D_DATE_FIELDS.has(key) || key.startsWith("data_") || key.endsWith("_em") || G3D_UUID_FIELDS.has(key)) {
      normalized[key] = null;
    }
  });
  return normalized;
}

function g3dNormalizeDateInputs(form) {
  if (!form) return;
  form.querySelectorAll('input[type="date"]').forEach(input => {
    if (!input.value) input.dataset.g3dEmptyDate = "true";
  });
}

const payloadNormalizerPreviousSaveRecord = saveRecord;
saveRecord = async function saveRecordWithNormalizedPayload(table, payload, id) {
  return payloadNormalizerPreviousSaveRecord(table, g3dNormalizePayload(payload), id);
};

const payloadNormalizerPreviousRenderSimpleForm = renderSimpleForm;
renderSimpleForm = function renderSimpleFormWithDateNormalization(el, title, subtitle, fields, row, onSave, type = "text") {
  return payloadNormalizerPreviousRenderSimpleForm(el, title, subtitle, fields, row, async payload => onSave(g3dNormalizePayload(payload)), type);
};

const payloadNormalizerPreviousOpenForm = openForm;
openForm = function openFormWithDateNormalization(module, row = {}) {
  payloadNormalizerPreviousOpenForm(module, row);
  g3dNormalizeDateInputs(document.getElementById("recordForm"));
};

const payloadNormalizerPreviousOpenBudgetForm = openBudgetForm;
openBudgetForm = function openBudgetFormWithDateNormalization(row = {}) {
  payloadNormalizerPreviousOpenBudgetForm(row);
  g3dNormalizeDateInputs(document.getElementById("budgetForm"));
};

if (typeof openStockForm === "function") {
  const payloadNormalizerPreviousOpenStockForm = openStockForm;
  openStockForm = function openStockFormWithDateNormalization(row = {}) {
    payloadNormalizerPreviousOpenStockForm(row);
    g3dNormalizeDateInputs(document.getElementById("stockForm"));
  };
}
