renderParametros = function renderParametrosWithFreshSession(el) {
  const row = pricingParams();
  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Parâmetros</h1>
        <p class="muted">Padrões financeiros usados automaticamente nos orçamentos.</p>
      </div>
    </div>
    <form class="pricing-form" id="pricingForm">
      ${G3D_PRICING_SECTIONS.map(section => `
        <section class="card pricing-section">
          <div class="pricing-section-head">
            <div>
              <h3>${escapeHtml(section.title)}</h3>
              <p>${escapeHtml(section.description)}</p>
            </div>
          </div>
          <div class="form-grid">
            ${section.fields.map(([key, label, hint]) => `
              <div class="field">
                <label>${escapeHtml(label)}</label>
                <input type="number" step="0.01" name="${key}" value="${escapeHtml(row[key] ?? 0)}" />
                <small>${escapeHtml(hint)}</small>
              </div>
            `).join("")}
          </div>
        </section>
      `).join("")}
      <section class="card pricing-preview">
        <h3>Como o cálculo usa esses dados</h3>
        <p class="muted">O orçamento soma material, perdas, energia, uso da máquina, manutenção, depreciação, preparação, pós-processamento, atendimento, embalagem, custos fixos, taxas e impostos. Depois aplica a margem e respeita a taxa mínima.</p>
        <div class="modal-foot"><button class="btn primary" type="submit">Salvar parâmetros</button></div>
      </section>
    </form>`;

  document.getElementById("pricingForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.target?.closest?.("form") || document.getElementById("pricingForm");
    if (!form || !(form instanceof HTMLFormElement)) {
      showToast("Não foi possível ler o formulário de parâmetros. Recarregue a página e tente novamente.");
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    const original = button?.textContent || "Salvar parâmetros";
    if (button) {
      button.disabled = true;
      button.textContent = "Salvando...";
    }

    const ready = await g3dEnsureFreshSession();
    if (ready.error || !ready.session) {
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
      showToast("Sua sessão expirou. Entre novamente para salvar com segurança.");
      await supabaseClient.auth.signOut();
      return renderAuth();
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    Object.keys(payload).forEach(key => payload[key] = Number(payload[key] || 0));
    payload.user_id = ready.session.user.id;
    payload.updated_at = new Date().toISOString();

    const result = await g3dRunWithFreshSession(() => supabaseClient.from("parametros_precificacao").upsert(payload, { onConflict: "user_id" }));
    if (result.error) {
      const text = String(result.error.message || "").toLowerCase();
      if (text.includes("schema cache") || text.includes("column") || text.includes("coluna")) {
        const fallback = Object.fromEntries(Object.entries(payload).filter(([key]) => G3D_PRICING_LEGACY_FIELDS.includes(key) || key === "user_id" || key === "updated_at"));
        const retry = await g3dRunWithFreshSession(() => supabaseClient.from("parametros_precificacao").upsert(fallback, { onConflict: "user_id" }));
        if (!retry.error) {
          showToast("Parâmetros básicos salvos. Falta atualizar o banco para guardar todos os custos profissionais.");
          await loadSingle("parametros_precificacao", "parametros");
          return renderPage();
        }
      }
      if (!g3dAuthErrorMessage(result.error)) showToast(result.error.message);
      if (button) {
        button.disabled = false;
        button.textContent = original;
      }
      return;
    }

    showToast("Parâmetros profissionais salvos.");
    await loadSingle("parametros_precificacao", "parametros");
    renderPage();
  });
};
