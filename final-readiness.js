const READINESS_MANUAL_KEY = "g3d_readiness_manual_v1";

function readinessManualState() {
  try {
    return JSON.parse(localStorage.getItem(READINESS_MANUAL_KEY) || "{}");
  } catch (_error) {
    return {};
  }
}

function saveReadinessManualState(values) {
  localStorage.setItem(READINESS_MANUAL_KEY, JSON.stringify(values));
}

function ensureReadinessPageInMenu() {
  if (typeof navPages === "undefined") return;
  const canSee = typeof isCurrentUserAdmin === "function" ? isCurrentUserAdmin() : true;
  const exists = navPages.some(([id]) => id === "readiness");
  if (canSee && !exists) navPages.push(["readiness", "Pronto para migrar"]);
  if (!canSee && exists) {
    const index = navPages.findIndex(([id]) => id === "readiness");
    if (index >= 0) navPages.splice(index, 1);
    if (state.page === "readiness") state.page = "dashboard";
  }
}

function buildReadinessChecks() {
  const loja = state.cache.loja || {};
  const params = state.cache.parametros || {};
  const clientes = state.cache.clientes || [];
  const estoque = state.cache.estoque || [];
  const orcamentos = state.cache.orcamentos || [];
  const pedidos = state.cache.pedidos || [];
  const producoes = state.cache.producoes || [];
  const admins = typeof activeAdmins === "function" ? activeAdmins() : (state.cache.admins || []);
  const manual = readinessManualState();

  const hasLojaCore = Boolean(loja.nome_loja && loja.whatsapp && (loja.email || loja.documento));
  const hasLogo = Boolean(loja.logo_url || loja.logo_path || loja.logo_base64);
  const hasParams = ["custo_kwh", "consumo_kw_hora", "custo_hora_maquina", "custo_grama_padrao", "margem_percentual", "taxa_minima"].every(key => Number(params[key] || 0) > 0);
  const hasStockCosts = estoque.length > 0 && estoque.some(item => Number(item.custo_grama || item.valor_atual || 0) > 0);
  const hasClient = clientes.length > 0;
  const hasBudget = orcamentos.length > 0;
  const hasOrder = pedidos.length > 0;
  const hasProduction = producoes.length > 0;
  const hasAdmin = admins.length > 0 || (typeof isBootstrapAdmin === "function" && isBootstrapAdmin());
  const hasHttps = location.protocol === "https:";
  const hasNoServiceKey = !String(window.G3D_SERVICE_ROLE || "").trim();

  return [
    {
      group: "Base comercial",
      items: [
        autoCheck("loja", "Perfil da loja completo", "Nome, contato e documento aparecem nos documentos comerciais.", hasLojaCore, "Complete Minha loja antes de vender para terceiros."),
        autoCheck("logo", "Logo pronta para PDF", "A marca da loja valoriza orçamento, pedido e ordem de produção.", hasLogo, "Suba a logo em Minha loja ou no módulo de imagens."),
        autoCheck("clientes", "Cliente de teste cadastrado", "Existe pelo menos um cliente para validar histórico, WhatsApp e documentos.", hasClient, "Crie um cliente de teste e confira o histórico."),
        autoCheck("parametros", "Parâmetros de custo revisados", "Energia, máquina, grama, margem e taxa mínima têm valores válidos.", hasParams, "Revise Parâmetros com números reais da operação.")
      ]
    },
    {
      group: "Fluxo operacional",
      items: [
        autoCheck("estoque", "Estoque com custo real", "Há materiais com custo informado para alimentar o orçamento.", hasStockCosts, "Cadastre pelo menos um filamento com material, cor e custo."),
        autoCheck("orcamento", "Orçamento validado", "Existe orçamento para conferir cálculo, PDF, imagem e logo.", hasBudget, "Crie um orçamento completo e gere o PDF."),
        autoCheck("pedido", "Pedido validado", "Existe pedido para testar financeiro, documentos e acompanhamento.", hasOrder, "Transforme um orçamento em pedido."),
        autoCheck("producao", "Produção validada", "Existe produção para testar fases, notificações, histórico e baixa de estoque.", hasProduction, "Envie um pedido para produção e finalize uma fase de teste.")
      ]
    },
    {
      group: "Segurança e administração",
      items: [
        autoCheck("admins", "Administrador configurado", "A área ADM tem pelo menos um responsável ativo.", hasAdmin, "Confirme owner/admin na Área ADM."),
        autoCheck("https", "Acesso seguro por HTTPS", "O app publicado está abrindo com conexão segura.", hasHttps, "Use apenas domínio com HTTPS ativo."),
        autoCheck("service", "Nenhuma chave privada no navegador", "A página não expõe service role no frontend.", hasNoServiceKey, "Remova qualquer chave privada do site público."),
        manualCheck("rls", "Permissões do banco conferidas", "Confirme no Supabase que cada usuário só acessa os próprios dados.", manual)
      ]
    },
    {
      group: "Pronto para migrar",
      items: [
        manualCheck("backup", "Backup/exportação revisado", "Tenha cópia do banco e dos arquivos importantes antes da troca de domínio.", manual),
        manualCheck("privacy", "Termos e privacidade preparados", "Inclua textos básicos para uso comercial por outras lojas.", manual),
        manualCheck("domain", "Domínio definitivo planejado", "Defina domínio, e-mail de envio e endereço final antes de divulgar.", manual),
        manualCheck("flow", "Fluxo completo testado sem erro", "Cliente > orçamento > PDF > pedido > produção > estoque > financeiro > histórico.", manual)
      ]
    }
  ];
}

function autoCheck(id, title, detail, ok, warning) {
  return {
    id,
    title,
    detail: ok ? detail : warning,
    done: Boolean(ok),
    manual: false,
    status: ok ? "ok" : "warn"
  };
}

function manualCheck(id, title, detail, manual) {
  const done = Boolean(manual[id]);
  return {
    id,
    title,
    detail,
    done,
    manual: true,
    status: done ? "ok" : "manual"
  };
}

function readinessTotals(groups) {
  const items = groups.flatMap(group => group.items);
  const done = items.filter(item => item.done).length;
  const autoPending = items.filter(item => !item.done && !item.manual).length;
  const manualPending = items.filter(item => !item.done && item.manual).length;
  const score = items.length ? Math.round((done / items.length) * 100) : 0;
  return { items, done, autoPending, manualPending, score };
}

function renderReadinessPage(el) {
  const groups = buildReadinessChecks();
  const totals = readinessTotals(groups);
  const readyText = totals.score >= 90 ? "Quase pronto para migrar" : totals.score >= 70 ? "Boa base, faltam conferências" : "Ainda em preparação";

  el.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Pronto para migrar</h1>
        <p class="muted">Checklist final para transformar o G3D Pro em um produto profissional antes do domínio definitivo.</p>
      </div>
      <div class="actions">
        <button class="btn" id="readinessRefresh">Atualizar revisão</button>
        <button class="btn primary" id="readinessExport">Baixar resumo</button>
      </div>
    </div>

    <section class="readiness-hero">
      <div class="card readiness-card">
        <span class="readiness-kicker">Revisão final</span>
        <h2>${readyText}</h2>
        <p class="muted">Use esta tela como central de comando antes da migração: ela junta dados automáticos do app com conferências manuais que só o responsável consegue validar.</p>
        <div class="readiness-bar"><span style="width:${totals.score}%"></span></div>
        <div class="readiness-note">Quando todos os itens estiverem concluídos, o próximo passo natural é domínio próprio, política de privacidade, ambiente de produção e rotina de backup.</div>
      </div>
      <div class="card readiness-score">
        <strong>${totals.score}%</strong>
        <span>${totals.done} de ${totals.items.length} itens concluídos</span>
      </div>
    </section>

    <div class="grid stats readiness-summary">
      <div class="stat"><span>Concluídos</span><strong>${totals.done}</strong></div>
      <div class="stat"><span>Ajustes no app</span><strong>${totals.autoPending}</strong></div>
      <div class="stat"><span>Conferência manual</span><strong>${totals.manualPending}</strong></div>
      <div class="stat"><span>Progresso</span><strong>${totals.score}%</strong></div>
    </div>

    <section class="readiness-board">
      ${groups.map(group => `
        <article class="card readiness-section">
          <h3>${escapeHtml(group.group)}</h3>
          <div class="readiness-list">
            ${group.items.map(item => readinessItemHtml(item)).join("")}
          </div>
        </article>
      `).join("")}
    </section>

    <section class="card readiness-next">
      <h3>Ordem recomendada agora</h3>
      <ol>
        <li>Entrar no sistema e concluir os itens automáticos em amarelo.</li>
        <li>Testar o fluxo completo com um cliente e pedido de exemplo.</li>
        <li>Marcar as conferências manuais depois de validar banco, backup e termos.</li>
        <li>Baixar o resumo e guardar como registro da revisão pré-migração.</li>
      </ol>
    </section>
  `;

  document.getElementById("readinessRefresh")?.addEventListener("click", () => renderReadinessPage(el));
  document.getElementById("readinessExport")?.addEventListener("click", exportReadinessSummary);
  document.querySelectorAll("[data-readiness-manual]").forEach(button => {
    button.addEventListener("click", () => {
      const values = readinessManualState();
      const id = button.dataset.readinessManual;
      values[id] = !values[id];
      saveReadinessManualState(values);
      renderReadinessPage(el);
    });
  });
}

function readinessItemHtml(item) {
  const symbol = item.done ? "✓" : item.manual ? "•" : "!";
  const action = item.manual ? `<button class="btn" type="button" data-readiness-manual="${escapeHtml(item.id)}">${item.done ? "Desmarcar" : "Marcar"}</button>` : `<span class="badge ${item.done ? "good" : "warn"}">${item.done ? "OK" : "Ajustar"}</span>`;
  return `
    <div class="readiness-item ${item.status}">
      <span class="readiness-check">${symbol}</span>
      <div class="readiness-main">
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </div>
      ${action}
    </div>
  `;
}

function exportReadinessSummary() {
  const groups = buildReadinessChecks();
  const totals = readinessTotals(groups);
  const lines = [
    "G3D Pro - Revisão pré-migração",
    `Data: ${new Date().toLocaleString("pt-BR")}`,
    `Progresso: ${totals.score}% (${totals.done}/${totals.items.length})`,
    "",
    ...groups.flatMap(group => [
      group.group,
      ...group.items.map(item => `- [${item.done ? "OK" : "PENDENTE"}] ${item.title}: ${item.detail}`),
      ""
    ])
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `g3d-pro-revisao-migracao-${new Date().toISOString().slice(0,10)}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Resumo da revisão baixado.");
}

const readinessPreviousRenderApp = renderApp;
renderApp = function renderAppWithReadiness() {
  ensureReadinessPageInMenu();
  readinessPreviousRenderApp();
};

const readinessPreviousRenderPage = renderPage;
renderPage = function renderPageWithReadiness() {
  if (state.page === "readiness") {
    const content = document.getElementById("content");
    if (!content) return;
    if (typeof isCurrentUserAdmin === "function" && !isCurrentUserAdmin()) {
      state.page = "dashboard";
      renderApp();
      return;
    }
    renderReadinessPage(content);
    return;
  }
  readinessPreviousRenderPage();
};

function bootReadinessMenu() {
  if (!state?.session) return;
  const before = navPages.length;
  ensureReadinessPageInMenu();
  const menuHasPage = Boolean(document.querySelector('[data-page="readiness"]'));
  if (navPages.length !== before || !menuHasPage) renderApp();
}

setTimeout(bootReadinessMenu, 700);
setTimeout(bootReadinessMenu, 1800);
