const G3D_PRICING_SECTIONS = [
  {
    title: "Material e perdas",
    description: "Custos ligados ao filamento, resina, suporte, teste e refugo.",
    fields: [
      ["custo_grama_padrao", "Custo padrão por g/ml", "Usado quando o orçamento não usa item do estoque."],
      ["perda_material_percentual", "Perda de material %", "Margem técnica para purge, brim, saia, sobra e limpeza."],
      ["suportes_percentual", "Suportes e estrutura %", "Reserva quando o peso informado não inclui suportes."],
      ["falha_impressao_percentual", "Risco de falha %", "Cobre testes, peças perdidas e reimpressões ocasionais."],
      ["outros_insumos", "Outros insumos", "Cola, álcool, lixa, primer, luvas, bicos, fita e pequenos consumíveis."],
      ["embalagem_padrao", "Embalagem padrão", "Caixa, saco, etiqueta e proteção por orçamento."]
    ]
  },
  {
    title: "Máquina e energia",
    description: "Custos de uso real da impressora durante a produção.",
    fields: [
      ["custo_kwh", "Custo kWh", "Valor pago na energia elétrica."],
      ["consumo_kw_hora", "Consumo kW/h", "Consumo médio da impressora ligada."],
      ["custo_hora_maquina", "Custo hora máquina", "Valor base pelo uso da impressora."],
      ["manutencao_hora", "Manutenção por hora", "Bicos, correias, lubrificação, PEI, tela, FEP e desgaste geral."],
      ["depreciacao_hora", "Depreciação por hora", "Reserva para troca futura da impressora e upgrades."],
      ["setup_minutos", "Setup por orçamento (min)", "Tempo de preparar arquivo, fatiar, nivelar, trocar material e iniciar."],
      ["mao_obra_hora", "Hora operacional", "Valor da sua hora para preparação e ajustes."],
      ["taxa_minima", "Taxa mínima", "Preço mínimo para qualquer orçamento valer a pena."]
    ]
  },
  {
    title: "Serviço e comercial",
    description: "Custos que aparecem depois da impressão, venda e pagamento.",
    fields: [
      ["pos_processamento_hora", "Hora pós-processamento", "Remoção de suporte, acabamento, pintura, montagem e conferência."],
      ["atendimento_hora", "Hora atendimento/projeto", "Briefing, mensagens, medição, revisão e suporte ao cliente."],
      ["atendimento_minutos", "Atendimento padrão (min)", "Tempo médio comercial incluído em cada orçamento."],
      ["taxa_pagamento_percentual", "Taxa pagamento %", "Cartão, link de pagamento ou taxa operacional do recebimento."],
      ["imposto_percentual", "Impostos %", "Percentual reservado para impostos e formalização."],
      ["custo_fixo_percentual", "Custos fixos %", "Aluguel, internet, software, manutenção do negócio e despesas gerais."],
      ["margem_percentual", "Margem de lucro %", "Lucro aplicado depois dos custos reais."],
      ["desconto_maximo_percentual", "Desconto máximo %", "Referência interna para negociação sem perder controle."]
    ]
  }
];

const G3D_PRICING_LEGACY_FIELDS = [
  "custo_kwh",
  "consumo_kw_hora",
  "custo_hora_maquina",
  "custo_grama_padrao",
  "margem_percentual",
  "taxa_minima",
  "pos_processamento_hora",
  "embalagem_padrao"
];

function defaultParams() {
  return {
    custo_kwh: 0.95,
    consumo_kw_hora: 0.12,
    custo_hora_maquina: 8,
    custo_grama_padrao: 0.12,
    perda_material_percentual: 8,
    suportes_percentual: 5,
    falha_impressao_percentual: 4,
    outros_insumos: 2,
    embalagem_padrao: 3,
    manutencao_hora: 1.5,
    depreciacao_hora: 2,
    setup_minutos: 15,
    mao_obra_hora: 30,
    taxa_minima: 20,
    pos_processamento_hora: 25,
    atendimento_hora: 30,
    atendimento_minutos: 10,
    taxa_pagamento_percentual: 4,
    imposto_percentual: 6,
    custo_fixo_percentual: 8,
    margem_percentual: 40,
    desconto_maximo_percentual: 10
  };
}

function pricingParams() {
  return { ...defaultParams(), ...(state.cache.parametros || {}) };
}

function numberParam(params, key) {
  return Number(params?.[key] || 0);
}

function renderParametros(el) {
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
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    Object.keys(payload).forEach(key => payload[key] = Number(payload[key] || 0));
    payload.user_id = state.session.user.id;
    payload.updated_at = new Date().toISOString();

    const { error } = await supabaseClient.from("parametros_precificacao").upsert(payload, { onConflict: "user_id" });
    if (error) {
      const text = String(error.message || "").toLowerCase();
      if (text.includes("schema cache") || text.includes("column") || text.includes("coluna")) {
        const fallback = Object.fromEntries(Object.entries(payload).filter(([key]) => G3D_PRICING_LEGACY_FIELDS.includes(key) || key === "user_id" || key === "updated_at"));
        const retry = await supabaseClient.from("parametros_precificacao").upsert(fallback, { onConflict: "user_id" });
        if (!retry.error) {
          showToast("Parâmetros básicos salvos. Falta atualizar o banco para guardar todos os custos profissionais.");
          await loadSingle("parametros_precificacao", "parametros");
          return renderPage();
        }
      }
      return showToast(error.message);
    }

    showToast("Parâmetros profissionais salvos.");
    await loadSingle("parametros_precificacao", "parametros");
    renderPage();
  });
}

function calculatePrice(item) {
  return budgetBreakdown(item).total;
}

function budgetBreakdown(payload) {
  const p = pricingParams();
  const materialInfo = budgetMaterialCost(payload);
  const horas = Number(payload.horas || 0);
  const peso = Number(payload.peso_g || 0);
  const posHoras = Number(payload.pos_horas || 0);

  const materialBase = peso * Number(materialInfo.gramCost || 0);
  const perdaPercent = numberParam(p, "perda_material_percentual") + numberParam(p, "suportes_percentual") + numberParam(p, "falha_impressao_percentual");
  const perdaMaterial = materialBase * perdaPercent / 100;
  const materialTotal = materialBase + perdaMaterial;
  const energia = horas * numberParam(p, "consumo_kw_hora") * numberParam(p, "custo_kwh");
  const maquina = horas * numberParam(p, "custo_hora_maquina");
  const manutencao = horas * numberParam(p, "manutencao_hora");
  const depreciacao = horas * numberParam(p, "depreciacao_hora");
  const setup = (numberParam(p, "setup_minutos") / 60) * numberParam(p, "mao_obra_hora");
  const pos = posHoras * numberParam(p, "pos_processamento_hora");
  const atendimento = (numberParam(p, "atendimento_minutos") / 60) * numberParam(p, "atendimento_hora");
  const embalagem = numberParam(p, "embalagem_padrao");
  const outros = numberParam(p, "outros_insumos");
  const custoDireto = materialTotal + energia + maquina + manutencao + depreciacao + setup + pos + atendimento + embalagem + outros;
  const custosFixos = custoDireto * numberParam(p, "custo_fixo_percentual") / 100;
  const base = custoDireto + custosFixos;
  const margem = base * numberParam(p, "margem_percentual") / 100;
  const subtotal = base + margem;
  const taxas = subtotal * (numberParam(p, "taxa_pagamento_percentual") + numberParam(p, "imposto_percentual")) / 100;
  const total = Math.max(numberParam(p, "taxa_minima"), subtotal + taxas);

  materialInfo.materialBase = materialBase;
  materialInfo.perdaMaterial = perdaMaterial;
  materialInfo.materialTotal = materialTotal;

  return { materialInfo, energia, maquina, manutencao, depreciacao, setup, pos, atendimento, embalagem, outros, custosFixos, base, margem, taxas, total };
}

openBudgetForm = function openBudgetFormProfessional(row = {}) {
  const stockItems = stockBudgetOptions();
  const currentStock = stockItems.find(item => item.material === row.material && item.cor === row.cor) || null;
  const value = Number(row.total || calculatePrice(row)).toFixed(2);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal" id="budgetForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} orçamento</strong><button class="btn" type="button" id="closeBudget">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Número</label><input name="numero" value="${escapeHtml(row.numero || nextNumber("ORC", state.cache.orcamentos.length))}" /></div>
          <div class="field"><label>Status</label><input name="status" value="${escapeHtml(row.status || "rascunho")}" /></div>
          <div class="field span-2"><label>Projeto</label><input name="projeto" value="${escapeHtml(row.projeto || "")}" required /></div>
          <div class="field span-2"><label>Filamento/resina do estoque</label><select name="estoque_ref" id="budgetStock"><option value="">Usar custo padrão dos parâmetros</option>${stockItems.map(item => `<option value="${escapeHtml(item.id)}" ${currentStock?.id === item.id ? "selected" : ""}>${escapeHtml([item.nome, item.material, item.cor].filter(Boolean).join(" - "))} (${money(item.custo_grama || 0)}/g)</option>`).join("")}</select></div>
          <div class="field"><label>Material</label><input name="material" value="${escapeHtml(row.material || currentStock?.material || "PLA")}" /></div>
          <div class="field"><label>Cor</label><input name="cor" value="${escapeHtml(row.cor || currentStock?.cor || "")}" /></div>
          <div class="field"><label>Peso g/ml</label><input type="number" step="0.01" name="peso_g" value="${escapeHtml(row.peso_g || 0)}" /></div>
          <div class="field"><label>Tempo h</label><input type="number" step="0.01" name="horas" value="${escapeHtml(row.horas || 0)}" /></div>
          <div class="field"><label>Pós-processamento h</label><input type="number" step="0.01" name="pos_horas" value="${escapeHtml(row.pos_horas || 0)}" /></div>
          <div class="field"><label>Total</label><input type="number" step="0.01" name="total" value="${escapeHtml(value)}" /></div>
          <div class="calc-box span-2 budget-breakdown" id="calcBox">Preencha peso e tempo para calcular automaticamente.</div>
          <div class="field span-2"><label>Observações</label><textarea name="observacao">${escapeHtml(row.observacao || "")}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelBudget">Cancelar</button><button class="btn primary" type="submit">Salvar orçamento</button></div>
    </form>`;
  document.body.appendChild(backdrop);

  const form = document.getElementById("budgetForm");
  const close = () => backdrop.remove();
  const syncStock = () => {
    const stock = findStockForBudget(Object.fromEntries(new FormData(form).entries()));
    if (!stock) return;
    form.material.value = stock.material || stock.nome || form.material.value;
    form.cor.value = stock.cor || form.cor.value;
  };
  const recalc = () => {
    const payload = Object.fromEntries(new FormData(form).entries());
    const b = budgetBreakdown(payload);
    form.total.value = b.total.toFixed(2);
    document.getElementById("calcBox").innerHTML = `
      <strong>Valor sugerido: ${money(b.total)}</strong>
      <span>Material: ${money(b.materialInfo.materialTotal)} | Máquina: ${money(b.maquina)} | Energia: ${money(b.energia)} | Manutenção: ${money(b.manutencao)} | Depreciação: ${money(b.depreciacao)}</span>
      <span>Setup: ${money(b.setup)} | Pós: ${money(b.pos)} | Atendimento: ${money(b.atendimento)} | Embalagem/insumos: ${money(b.embalagem + b.outros)}</span>
      <span>Custos fixos: ${money(b.custosFixos)} | Margem: ${money(b.margem)} | Taxas/impostos: ${money(b.taxas)}</span>
    `;
  };

  ["estoque_ref", "peso_g", "horas", "pos_horas", "material", "cor"].forEach(name => {
    form[name]?.addEventListener("input", () => { if (name === "estoque_ref") syncStock(); recalc(); });
    form[name]?.addEventListener("change", () => { if (name === "estoque_ref") syncStock(); recalc(); });
  });
  document.getElementById("closeBudget").addEventListener("click", close);
  document.getElementById("cancelBudget").addEventListener("click", close);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    delete payload.estoque_ref;
    ["peso_g", "horas", "pos_horas", "total"].forEach(k => payload[k] = Number(payload[k] || 0));
    await saveRecord("orcamentos", payload, row.id);
    close();
  });
  syncStock();
  recalc();
};
