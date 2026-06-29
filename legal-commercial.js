(function () {
  const LEGAL_UPDATED_AT = "29/06/2026";

  function lcSetPage(page) {
    state.page = page;
    renderApp();
    renderPage();
  }

  function ensureLegalPagesInMenu() {
    if (typeof navPages === "undefined") return;
    const hasCommercial = navPages.some(([id]) => id === "commercial");
    const hasLegal = navPages.some(([id]) => id === "legal");
    if (state.session && !hasCommercial) navPages.push(["commercial", "Apresentação"]);
    if (state.session && !hasLegal) navPages.push(["legal", "Termos e LGPD"]);
  }

  function presentationSectionsHtml() {
    return `
      <section class="public-section" id="features">
        <div class="public-section-inner">
          <div class="public-section-head">
            <div><h2>Feito para quem vende impressão 3D</h2><p>Uma base simples para sair da planilha solta e trabalhar com processo: preço, cliente, pedido, produção e entrega.</p></div>
          </div>
          <div class="public-grid">
            <article class="public-card"><h3>Orçamentos profissionais</h3><p>Geração de proposta com cálculo técnico, condições comerciais, logo da loja e imagens do projeto.</p></article>
            <article class="public-card"><h3>Produção organizada</h3><p>Controle de fases, baixa de estoque, notificações, histórico e ordem interna de produção.</p></article>
            <article class="public-card"><h3>Financeiro operacional</h3><p>Pedidos pagos, pendentes, atrasados, relatório por período e visão rápida do caixa comercial.</p></article>
            <article class="public-card"><h3>Estoque por material e cor</h3><p>Materiais com custo por grama, saldo, alerta e vínculo com orçamento e produção.</p></article>
            <article class="public-card"><h3>CRM e WhatsApp</h3><p>Contato rápido com cliente, histórico, ficha completa e acompanhamento de retornos.</p></article>
            <article class="public-card"><h3>Área ADM</h3><p>Central para anúncios, administradores, revisão pré-migração e governança do sistema.</p></article>
          </div>
        </div>
      </section>

      <section class="public-section" id="plans">
        <div class="public-section-inner">
          <div class="public-section-head"><div><h2>Planos futuros</h2><p>O projeto ainda está em desenvolvimento, mas já nasceu preparado para evoluir com uso real.</p></div></div>
          <div class="public-plan-grid">
            <article class="public-plan"><strong>Desenvolvimento</strong><p class="muted">Uso em GitHub Pages para validar fluxo, telas, cálculo e documentos.</p></article>
            <article class="public-plan featured"><strong>Produção comercial</strong><p class="muted">Domínio próprio, termos revisados, backups, suporte, monitoramento e ambiente mais robusto.</p></article>
            <article class="public-plan"><strong>Escala</strong><p class="muted">Planos, limites por conta, integrações, relatórios avançados e melhorias por feedback.</p></article>
          </div>
        </div>
      </section>

      <section class="public-section">
        <div class="public-section-inner">
          <div class="public-section-head"><div><h2>Contato e suporte</h2><p>Para venda a terceiros, o G3D Pro precisa ter canal oficial de suporte, política de atendimento, responsável por dados e rotina de backup.</p></div></div>
          <div class="public-grid">
            <article class="public-card"><h3>Suporte inicial</h3><p>Na fase de testes, o suporte é feito diretamente com o administrador do projeto.</p></article>
            <article class="public-card"><h3>Segurança</h3><p>O sistema usa autenticação, permissões no banco e separação por usuário. Chaves privadas não devem ser publicadas no navegador.</p></article>
            <article class="public-card"><h3>LGPD</h3><p>Os dados cadastrados devem ser usados apenas para operação da loja: clientes, pedidos, orçamentos, produção, documentos e suporte.</p></article>
          </div>
        </div>
      </section>`;
  }

  function renderPublicPresentation() {
    app.innerHTML = `
      <main class="public-shell">
        <header class="public-topbar">
          <div class="public-brand"><div class="logo">G3D</div><div><strong>G3D Pro</strong><span>ERP para impressão 3D</span></div></div>
          <nav class="public-nav">
            <button class="btn" type="button" data-public-section="features">Recursos</button>
            <button class="btn" type="button" data-public-section="plans">Planos futuros</button>
            <button class="btn" type="button" data-open-legal-public>Termos e LGPD</button>
            <button class="btn primary" type="button" data-open-login>Entrar</button>
          </nav>
        </header>
        <section class="public-hero">
          <div class="public-hero-inner">
            <div>
              <p class="public-kicker">Gestão para negócios de impressão 3D</p>
              <h1>Orçamento, produção, estoque e financeiro em uma operação só.</h1>
              <p>O G3D Pro ajuda lojas e makers profissionais a organizar clientes, calcular preços por material e tempo, gerar documentos, acompanhar pedidos e manter a produção sob controle.</p>
              <div class="public-actions"><button class="btn primary" type="button" data-open-login>Entrar no sistema</button><button class="btn" type="button" data-open-legal-public>Ver política e termos</button></div>
            </div>
            <aside class="public-product-panel">
              <h2>Fluxo central do G3D Pro</h2>
              <div class="public-flow">
                <div><span>1</span><p><strong>Cliente e orçamento</strong><small>Cálculo por peso, tempo, material, margem, urgência e entrega.</small></p></div>
                <div><span>2</span><p><strong>Pedido e documentos</strong><small>Recibo, proposta comercial, imagens do projeto e comunicação por WhatsApp.</small></p></div>
                <div><span>3</span><p><strong>Produção e estoque</strong><small>Fases, alertas, baixa de material e histórico operacional.</small></p></div>
                <div><span>4</span><p><strong>Financeiro</strong><small>Valores recebidos, a receber, atrasos, relatórios e visão do negócio.</small></p></div>
              </div>
            </aside>
          </div>
        </section>
        ${presentationSectionsHtml()}
      </main>`;
    document.querySelectorAll("[data-open-login]").forEach(button => button.addEventListener("click", () => renderAuth("login")));
    document.querySelectorAll("[data-open-legal-public]").forEach(button => button.addEventListener("click", renderPublicLegalPage));
    document.querySelectorAll("[data-public-section]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.publicSection)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  function renderCommercialPage(el) {
    el.innerHTML = `
      <div class="page-head">
        <div><h1>Apresentação do G3D Pro</h1><p class="muted">Visão comercial do produto para demonstrar a proposta, público, recursos, próximos passos, contato e suporte.</p></div>
        <div class="actions"><button class="btn" type="button" id="openPublicPresentation">Ver como página pública</button><button class="btn primary" type="button" id="openCommercialTerms">Termos e LGPD</button></div>
      </div>
      <section class="public-hero" style="min-height:520px;border-radius:8px;overflow:hidden;margin-bottom:18px">
        <div class="public-hero-inner">
          <div><p class="public-kicker">Gestão para negócios de impressão 3D</p><h1>G3D Pro</h1><p>ERP leve para orçamento, estoque, produção, documentos, financeiro e relacionamento com clientes em lojas de impressão 3D.</p></div>
          <aside class="public-product-panel"><h2>Mensagem comercial</h2><div class="public-flow"><div><span>✓</span><p><strong>Para lojas e makers profissionais</strong><small>Organiza a operação do atendimento à entrega.</small></p></div><div><span>✓</span><p><strong>Venda com documentos melhores</strong><small>Propostas, recibos, ordens e relatórios com identidade da loja.</small></p></div><div><span>✓</span><p><strong>Menos controle manual</strong><small>Material, cor, custo, estoque e produção conectados.</small></p></div></div></aside>
        </div>
      </section>
      ${presentationSectionsHtml()}`;
    document.getElementById("openPublicPresentation")?.addEventListener("click", renderPublicPresentation);
    document.getElementById("openCommercialTerms")?.addEventListener("click", () => lcSetPage("legal"));
  }

  function renderPublicLegalPage() {
    app.innerHTML = `<main class="public-shell"><header class="public-topbar"><div class="public-brand"><div class="logo">G3D</div><div><strong>G3D Pro</strong><span>Termos, privacidade e LGPD</span></div></div><nav class="public-nav"><button class="btn" type="button" data-open-public>Apresentação</button><button class="btn primary" type="button" data-open-login>Entrar</button></nav></header><section class="public-section"><div class="public-section-inner">${legalContentHtml(true)}</div></section></main>`;
    document.querySelector("[data-open-public]")?.addEventListener("click", renderPublicPresentation);
    document.querySelector("[data-open-login]")?.addEventListener("click", () => renderAuth("login"));
  }

  function legalContentHtml(publicMode = false) {
    return `<div class="legal-shell"><div class="page-head"><div><h1>Termos, privacidade e LGPD</h1><p class="muted">Aviso simples para uso do G3D Pro durante desenvolvimento, testes e preparação comercial.</p><p class="legal-version">Última atualização: ${LEGAL_UPDATED_AT}</p></div>${publicMode ? "" : `<button class="btn" type="button" id="legalBackDashboard">Voltar ao painel</button>`}</div><div class="legal-alert">Este texto é uma base operacional e informativa. Antes de vender o sistema para outras lojas, recomenda-se revisão jurídica profissional para adequar termos, responsabilidades, suporte, cobrança e tratamento de dados.</div><div class="legal-layout"><aside class="card legal-nav-card"><h3>Documentos</h3><button class="btn" type="button" data-legal-anchor="terms">Termos de uso</button><button class="btn" type="button" data-legal-anchor="privacy">Privacidade</button><button class="btn" type="button" data-legal-anchor="lgpd">LGPD e dados</button><button class="btn" type="button" data-legal-anchor="security">Segurança</button><button class="btn" type="button" data-legal-anchor="contact">Contato</button></aside><article class="legal-doc"><section id="terms"><h2>Termos de uso</h2><p>O G3D Pro é uma ferramenta de gestão para operações de impressão 3D, incluindo clientes, estoque, orçamentos, pedidos, produção, financeiro, documentos e comunicações operacionais.</p><ul><li>O usuário é responsável pela veracidade dos dados cadastrados.</li><li>Os valores calculados pelo sistema são estimativas operacionais e devem ser revisados pela loja antes de envio ao cliente.</li><li>Documentos gerados pelo sistema não substituem nota fiscal, contrato formal ou orientação contábil quando aplicável.</li><li>O uso em fase de testes pode passar por ajustes, correções e mudanças de funcionalidade.</li></ul></section><section id="privacy"><h2>Política de privacidade</h2><p>O sistema pode armazenar dados informados pelo usuário para permitir a operação da loja, como clientes, contatos, endereços, orçamentos, pedidos, imagens de orçamento, dados financeiros e histórico de produção.</p><ul><li>Os dados são usados para executar funcionalidades do próprio sistema.</li><li>O administrador da loja deve cadastrar apenas dados necessários para atendimento, produção, cobrança e suporte.</li><li>O sistema não deve ser usado para armazenar dados sensíveis sem necessidade operacional clara.</li><li>Dados podem ser exportados, corrigidos ou removidos conforme as permissões do usuário e políticas do banco.</li></ul></section><section id="lgpd"><h2>Aviso LGPD</h2><p>Para fins da Lei Geral de Proteção de Dados, cada loja usuária deve tratar dados pessoais com finalidade legítima, necessidade, transparência e segurança.</p><ul><li>Finalidade: gestão de relacionamento, orçamento, pedido, produção, entrega, cobrança e suporte.</li><li>Base operacional: execução de solicitação, contrato, legítimo interesse comercial e cumprimento de obrigações aplicáveis.</li><li>Direitos do titular: confirmação, acesso, correção, exclusão, portabilidade e informações sobre uso dos dados, quando aplicável.</li><li>Retenção: os dados devem permanecer somente pelo tempo necessário para a operação e obrigações legais/comerciais da loja.</li></ul></section><section id="security"><h2>Segurança e responsabilidades</h2><p>O G3D Pro usa login e políticas de acesso para proteger os dados. Ainda assim, a segurança depende também do uso correto por administradores e usuários.</p><ul><li>Não compartilhe senha ou acesso administrativo.</li><li>Não publique chaves privadas, tokens internos ou credenciais em páginas públicas.</li><li>Revise permissões do banco antes de disponibilizar o sistema para terceiros.</li><li>Mantenha rotina de backup e controle de administradores ativos.</li></ul></section><section id="contact"><h2>Contato, suporte e solicitações</h2><p>Durante a fase de desenvolvimento, dúvidas, suporte, solicitações de exclusão ou correção de dados devem ser direcionadas ao administrador responsável pelo ambiente.</p><p>Antes do lançamento comercial, recomenda-se definir canal oficial de suporte, prazo de atendimento, política de disponibilidade e responsável por dados.</p></section></article></div></div>`;
  }

  function renderLegalPage(el) {
    el.innerHTML = legalContentHtml(false);
    document.getElementById("legalBackDashboard")?.addEventListener("click", () => lcSetPage("dashboard"));
    document.querySelectorAll("[data-legal-anchor]").forEach(button => button.addEventListener("click", () => document.getElementById(button.dataset.legalAnchor)?.scrollIntoView({ behavior: "smooth", block: "start" })));
  }

  const previousRenderAuth = renderAuth;
  renderAuth = function renderAuthWithCommercial(mode = "login") {
    previousRenderAuth(mode);
    const shell = document.querySelector(".auth-shell");
    const box = document.querySelector(".auth-box");
    if (shell && !shell.querySelector(".auth-public-actions")) {
      const actions = document.createElement("div");
      actions.className = "auth-public-actions";
      actions.innerHTML = `<button class="btn" type="button" data-open-public>Conhecer o G3D Pro</button><button class="btn link" type="button" data-open-legal-public>Termos e LGPD</button>`;
      box?.appendChild(actions);
      actions.querySelector("[data-open-public]")?.addEventListener("click", renderPublicPresentation);
      actions.querySelector("[data-open-legal-public]")?.addEventListener("click", renderPublicLegalPage);
    }
  };

  const previousRenderApp = renderApp;
  renderApp = function renderAppWithLegalPages() {
    ensureLegalPagesInMenu();
    previousRenderApp();
  };

  const previousRenderPage = renderPage;
  renderPage = function renderPageWithLegalPages() {
    const content = document.getElementById("content");
    if (state.page === "commercial" && content) return renderCommercialPage(content);
    if (state.page === "legal" && content) return renderLegalPage(content);
    previousRenderPage();
  };

  function bootLegalPages() {
    if (state?.session) {
      ensureLegalPagesInMenu();
      const hasCommercial = Boolean(document.querySelector('[data-page="commercial"]'));
      const hasLegal = Boolean(document.querySelector('[data-page="legal"]'));
      if (!hasCommercial || !hasLegal) renderApp();
    } else if (location.hash === "#apresentacao") {
      renderPublicPresentation();
    } else if (location.hash === "#termos") {
      renderPublicLegalPage();
    }
  }

  setTimeout(bootLegalPages, 600);
  setTimeout(bootLegalPages, 1800);
  window.G3D_LEGAL_COMMERCIAL = true;
})();
