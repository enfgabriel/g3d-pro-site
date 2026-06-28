function onboardingCounts() {
  return {
    loja: state.cache.loja || null,
    parametros: state.cache.parametros || null,
    estoque: state.cache.estoque || [],
    catalogo: state.cache.catalogo_produtos || [],
    orcamentos: state.cache.orcamentos || [],
    pedidos: state.cache.pedidos || [],
    producoes: state.cache.producoes || []
  };
}

function onboardingStoreReady(profile) {
  return !!(profile?.nome_loja && (profile?.whatsapp || profile?.email || profile?.documento));
}

function onboardingParamsReady(params) {
  if (!params) return false;
  return ["custo_kwh", "custo_hora_maquina", "custo_grama_padrao", "margem_percentual", "taxa_minima"].some(key => Number(params[key] || 0) > 0);
}

function onboardingSteps() {
  const data = onboardingCounts();
  return [
    {
      id: "loja",
      page: "loja",
      title: "Personalizar loja",
      detail: "Nome, contato, logo e dados comerciais para PDFs.",
      done: onboardingStoreReady(data.loja),
      action: "Abrir loja"
    },
    {
      id: "parametros",
      page: "parametros",
      title: "Definir parâmetros",
      detail: "Custos de energia, máquina, grama, margem e taxa mínima.",
      done: onboardingParamsReady(data.parametros),
      action: "Configurar"
    },
    {
      id: "estoque",
      page: "estoque",
      title: "Cadastrar estoque",
      detail: "Materiais, cores, custo por grama e saldo disponível.",
      done: data.estoque.length > 0,
      action: "Abrir estoque"
    },
    {
      id: "catalogo",
      page: "catalogo",
      title: "Montar catálogo",
      detail: "Produtos e serviços recorrentes para orçamento rápido.",
      done: data.catalogo.length > 0,
      action: "Abrir catálogo"
    },
    {
      id: "orcamentos",
      page: "orcamentos",
      title: "Criar primeiro orçamento",
      detail: "Teste o fluxo comercial até pedido e produção.",
      done: data.orcamentos.length > 0,
      action: "Novo orçamento"
    }
  ];
}

function onboardingProgress(steps = onboardingSteps()) {
  const done = steps.filter(step => step.done).length;
  return { done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}

function onboardingNextStep(steps = onboardingSteps()) {
  return steps.find(step => !step.done) || steps[steps.length - 1];
}

function goToOnboardingPage(page) {
  state.page = page;
  renderApp();
  renderPage();
}

function onboardingPanelHtml() {
  const steps = onboardingSteps();
  const progress = onboardingProgress(steps);
  const next = onboardingNextStep(steps);
  return `
    <section class="card onboarding-panel">
      <div class="onboarding-main">
        <div>
          <span class="onboarding-kicker">Configuração inicial</span>
          <h2>${progress.percent === 100 ? "Ambiente pronto para operar" : "Prepare sua operação em poucos passos"}</h2>
          <p class="muted">Configure a base uma vez e o G3D Pro passa a calcular, documentar e acompanhar seus pedidos com mais precisão.</p>
        </div>
        <div class="onboarding-score">
          <strong>${progress.percent}%</strong>
          <span>${progress.done}/${progress.total} concluído(s)</span>
        </div>
      </div>
      <div class="onboarding-bar"><span style="width:${progress.percent}%"></span></div>
      <div class="onboarding-steps">
        ${steps.map(step => `
          <button class="onboarding-step ${step.done ? "done" : ""}" data-onboarding-page="${step.page}">
            <span class="onboarding-check">${step.done ? "✓" : ""}</span>
            <span><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.detail)}</small></span>
            <em>${escapeHtml(step.done ? "OK" : step.action)}</em>
          </button>`).join("")}
      </div>
      <div class="onboarding-actions">
        <button class="btn primary" data-onboarding-page="${next.page}">${progress.percent === 100 ? "Revisar configuração" : `Continuar: ${escapeHtml(next.title)}`}</button>
        <button class="btn" type="button" id="openOnboardingGuide">Ver guia rápido</button>
      </div>
    </section>`;
}

function openOnboardingGuide() {
  const steps = onboardingSteps();
  const progress = onboardingProgress(steps);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal onboarding-modal">
      <div class="modal-head"><strong>Guia rápido do G3D Pro</strong><button class="btn" type="button" id="closeOnboardingGuide">Fechar</button></div>
      <div class="modal-body">
        <div class="onboarding-guide-head">
          <div><span>Progresso</span><strong>${progress.percent}%</strong></div>
          <p class="muted">Siga esta ordem para deixar o sistema pronto para orçamento, produção e documentos comerciais.</p>
        </div>
        <div class="onboarding-guide-list">
          ${steps.map((step, index) => `
            <button class="onboarding-guide-row" data-guide-page="${step.page}">
              <span>${index + 1}</span>
              <div><strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.detail)}</small></div>
              <em>${step.done ? "Concluído" : "Pendente"}</em>
            </button>`).join("")}
        </div>
      </div>
      <div class="modal-foot"><button class="btn primary" id="closeOnboardingOk">Entendi</button></div>
    </div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closeOnboardingGuide").addEventListener("click", close);
  document.getElementById("closeOnboardingOk").addEventListener("click", close);
  document.querySelectorAll("[data-guide-page]").forEach(button => {
    button.addEventListener("click", () => {
      const page = button.dataset.guidePage;
      close();
      goToOnboardingPage(page);
    });
  });
}

function attachOnboardingHandlers(root = document) {
  root.querySelectorAll("[data-onboarding-page]").forEach(button => {
    button.addEventListener("click", () => goToOnboardingPage(button.dataset.onboardingPage));
  });
  root.querySelector("#openOnboardingGuide")?.addEventListener("click", openOnboardingGuide);
}

if (typeof renderDashboardPro === "function") {
  const onboardingPreviousRenderDashboardPro = renderDashboardPro;
  renderDashboardPro = function renderDashboardProWithOnboarding(el) {
    onboardingPreviousRenderDashboardPro(el);
    const head = el.querySelector(".dashboard-stats") || el.firstElementChild;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = onboardingPanelHtml();
    if (head) head.insertAdjacentElement("beforebegin", wrapper.firstElementChild);
    else el.prepend(wrapper.firstElementChild);
    attachOnboardingHandlers(el);
  };
}
