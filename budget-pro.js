function budgetProfileDefaults(profile = {}) {
  return {
    nome_loja: profile.nome_loja || "G3D Pro",
    responsavel: profile.responsavel || "",
    documento: profile.documento || "",
    whatsapp: profile.whatsapp || "",
    email: profile.email || "",
    site: profile.site || "",
    cidade: profile.cidade || "",
    estado: profile.estado || "",
    endereco: profile.endereco || "",
    logo_url: profile.logo_url || "",
    validade_dias: Number(profile.validade_dias || 7),
    prazo_padrao: profile.prazo_padrao || "A combinar conforme fila de produção.",
    condicoes_comerciais: profile.condicoes_comerciais || "Pagamento combinado diretamente no PDV da máquina de cartão ou no meio escolhido com o cliente.",
    observacao_padrao: profile.observacao_padrao || ""
  };
}

renderLoja = function renderLojaPro(el) {
  const profile = budgetProfileDefaults(state.cache.loja || {});
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Minha loja</h1><p class="muted">Dados usados nos orçamentos e documentos enviados ao cliente.</p></div>
    </div>
    <form class="card store-form" id="storeForm">
      <div class="form-grid">
        <div class="field"><label>Nome da loja</label><input name="nome_loja" value="${escapeHtml(profile.nome_loja)}" /></div>
        <div class="field"><label>Responsável</label><input name="responsavel" value="${escapeHtml(profile.responsavel)}" /></div>
        <div class="field"><label>CNPJ ou CPF</label><input name="documento" value="${escapeHtml(profile.documento)}" /></div>
        <div class="field"><label>WhatsApp</label><input name="whatsapp" value="${escapeHtml(profile.whatsapp)}" /></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(profile.email)}" /></div>
        <div class="field"><label>Site ou Instagram</label><input name="site" value="${escapeHtml(profile.site)}" /></div>
        <div class="field"><label>Cidade</label><input name="cidade" value="${escapeHtml(profile.cidade)}" /></div>
        <div class="field"><label>Estado</label><input name="estado" value="${escapeHtml(profile.estado)}" /></div>
        <div class="field span-2"><label>Endereço</label><textarea name="endereco">${escapeHtml(profile.endereco)}</textarea></div>
        <div class="field span-2"><label>URL do logo para PDF</label><input name="logo_url" value="${escapeHtml(profile.logo_url)}" placeholder="https://..." /></div>
        <div class="field"><label>Validade padrão do orçamento em dias</label><input type="number" name="validade_dias" value="${escapeHtml(profile.validade_dias)}" /></div>
        <div class="field"><label>Prazo padrão</label><input name="prazo_padrao" value="${escapeHtml(profile.prazo_padrao)}" /></div>
        <div class="field span-2"><label>Condições comerciais padrão</label><textarea name="condicoes_comerciais">${escapeHtml(profile.condicoes_comerciais)}</textarea></div>
        <div class="field span-2"><label>Observação padrão</label><textarea name="observacao_padrao">${escapeHtml(profile.observacao_padrao)}</textarea></div>
      </div>
      <div class="modal-foot"><button class="btn primary" type="submit">Salvar loja</button></div>
    </form>`;

  document.getElementById("storeForm").addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    payload.validade_dias = Number(payload.validade_dias || 7);
    payload.user_id = state.session.user.id;
    payload.updated_at = new Date().toISOString();
    const { error } = await supabaseClient.from("loja_perfis").upsert(payload, { onConflict: "user_id" });
    if (error) return showToast(storeErrorMessage(error));
    showToast("Personalização salva.");
    await loadSingle("loja_perfis", "loja");
    renderPage();
  });
};

function storeErrorMessage(error) {
  const text = String(error?.message || "").toLowerCase();
  if (text.includes("logo_url") || text.includes("validade_dias") || text.includes("condicoes_comerciais")) return "Campos comerciais ainda não foram aplicados no Supabase. Recarregue e tente novamente.";
  return error?.message || "Não foi possível salvar a loja.";
}

openBudgetPdf = function openBudgetPdfPro(row) {
  if (!row) return;
  const profile = budgetProfileDefaults(state.cache.loja || {});
  const issueDate = new Date();
  const validDate = new Date(issueDate.getTime() + Number(profile.validade_dias || 7) * 86400000);
  const dateFmt = date => date.toLocaleDateString("pt-BR");
  const contact = [profile.documento, profile.whatsapp, profile.email, profile.site].filter(Boolean).join(" | ");
  const location = [profile.cidade, profile.estado].filter(Boolean).join(" - ");
  const total = Number(row.total || calculatePrice(row));
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir o orçamento.");

  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(row.numero || "Orçamento")}</title>
  <style>
    *{box-sizing:border-box} body{margin:0;background:#dbe3ed;color:#16202a;font-family:Arial,Helvetica,sans-serif}.actions{position:sticky;top:0;z-index:2;background:#101820;padding:10px;text-align:center}.actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;cursor:pointer}.primary{background:#24d982;color:#07120d}.page{max-width:920px;margin:0 auto;background:#fff;min-height:100vh;padding:42px}.header{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:start;border-bottom:4px solid #101820;padding-bottom:22px}.logoBox{width:132px;height:86px;border:1px solid #d8dee8;border-radius:8px;display:grid;place-items:center;overflow:hidden;color:#101820;font-weight:900}.logoBox img{width:100%;height:100%;object-fit:contain;padding:8px}.shop h1{margin:0 0 6px;font-size:30px}.muted{color:#667085}.shop p,.meta p,.terms p{margin:3px 0;line-height:1.45}.doc-title{display:grid;grid-template-columns:1fr auto;gap:20px;margin:30px 0 22px}.doc-title h2{margin:0;font-size:28px}.status{display:inline-flex;align-items:center;min-height:30px;padding:0 10px;border-radius:999px;background:#e8f8ef;color:#067647;font-weight:700;font-size:13px}.section{margin-top:20px}.section h3{margin:0 0 10px;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:#344054}.details{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.details div{padding:14px;border-right:1px solid #d8dee8}.details div:last-child{border-right:0}.details span{display:block;color:#667085;font-size:12px;margin-bottom:5px}.details strong{font-size:15px}.summary{border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.row{display:grid;grid-template-columns:1.4fr .7fr .7fr .7fr;gap:0;border-bottom:1px solid #d8dee8}.row:last-child{border-bottom:0}.row div{padding:13px}.head{background:#f3f6f9;color:#475467;font-size:12px;font-weight:700;text-transform:uppercase}.total{display:flex;justify-content:space-between;align-items:center;margin-top:24px;padding:18px 20px;border-radius:10px;background:#101820;color:#fff}.total span{color:#b7c4cf}.total strong{font-size:30px;color:#24d982}.terms{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}.terms article{padding:16px;border:1px solid #d8dee8;border-radius:10px}.footer{margin-top:34px;padding-top:16px;border-top:1px solid #d8dee8;font-size:12px;color:#667085}@media print{body{background:#fff}.actions{display:none}.page{max-width:none;padding:28px}.total strong{color:#fff}}@media(max-width:720px){.header,.doc-title,.terms{grid-template-columns:1fr}.details{grid-template-columns:1fr 1fr}.row{grid-template-columns:1fr}.head{display:none}}
  </style>
</head>
<body>
  <div class="actions"><button class="primary" onclick="window.print()">Salvar como PDF</button></div>
  <main class="page">
    <section class="header">
      <div class="shop">
        <h1>${escapeHtml(profile.nome_loja)}</h1>
        <p class="muted">${escapeHtml(contact || "Dados comerciais não informados")}</p>
        <p class="muted">${escapeHtml([profile.endereco, location].filter(Boolean).join(" | "))}</p>
      </div>
      <div class="logoBox">${profile.logo_url ? `<img src="${escapeHtml(profile.logo_url)}" alt="Logo">` : "G3D"}</div>
    </section>

    <section class="doc-title">
      <div><h2>Orçamento ${escapeHtml(row.numero || "")}</h2><p class="muted">Emitido em ${dateFmt(issueDate)} | Válido até ${dateFmt(validDate)}</p></div>
      <span class="status">${escapeHtml(row.status || "Rascunho")}</span>
    </section>

    <section class="section">
      <h3>Projeto</h3>
      <div class="details">
        <div><span>Nome</span><strong>${escapeHtml(row.projeto || "Projeto de impressão 3D")}</strong></div>
        <div><span>Material</span><strong>${escapeHtml(row.material || "Não informado")}</strong></div>
        <div><span>Cor</span><strong>${escapeHtml(row.cor || "Não informada")}</strong></div>
        <div><span>Prazo</span><strong>${escapeHtml(profile.prazo_padrao)}</strong></div>
      </div>
    </section>

    <section class="section">
      <h3>Resumo técnico</h3>
      <div class="summary">
        <div class="row head"><div>Item</div><div>Peso</div><div>Tempo</div><div>Valor</div></div>
        <div class="row"><div>${escapeHtml(row.projeto || "Peça impressa")}</div><div>${escapeHtml(row.peso_g || 0)} g/ml</div><div>${escapeHtml(row.horas || 0)} h</div><div>${money(total)}</div></div>
      </div>
    </section>

    ${row.observacao || profile.observacao_padrao ? `<section class="section"><h3>Observações</h3><p class="muted">${escapeHtml(row.observacao || profile.observacao_padrao)}</p></section>` : ""}

    <section class="total"><span>Total do orçamento</span><strong>${money(total)}</strong></section>

    <section class="terms">
      <article><h3>Condições comerciais</h3><p class="muted">${escapeHtml(profile.condicoes_comerciais)}</p></article>
      <article><h3>Validade</h3><p class="muted">Este orçamento é válido por ${escapeHtml(profile.validade_dias)} dias a partir da emissão, salvo alteração de material, prazo ou escopo.</p></article>
    </section>

    <p class="footer">Documento gerado pelo G3D Pro. Valores sujeitos à confirmação após análise final do arquivo/modelo.</p>
  </main>
</body>
</html>`);
  win.document.close();
};
