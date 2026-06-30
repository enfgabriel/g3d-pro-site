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

  function storeProfileValue(row, key) {
    return escapeHtml(row?.[key] ?? "");
  }

  function storeProfileFormHtml(row = {}) {
    return `
      <div class="page-head">
        <div>
          <h1>Minha loja</h1>
          <p class="muted">Personalização usada nos orçamentos, documentos e atendimento.</p>
        </div>
      </div>
      <form class="card" id="storeForm">
        <input type="hidden" name="id" value="${storeProfileValue(row, "id")}">
        <input type="hidden" name="logo_path" value="${storeProfileValue(row, "logo_path")}">
        <input type="hidden" name="logo_url" value="${storeProfileValue(row, "logo_url")}">
        <div class="form-grid">
          ${STORE_FIELDS.map(([key, label, kind]) => {
            const long = kind === "textarea";
            return `<div class="field ${long ? "span-2" : ""}"><label>${label}</label>${long ? `<textarea name="${key}">${storeProfileValue(row, key)}</textarea>` : `<input name="${key}" value="${storeProfileValue(row, key)}