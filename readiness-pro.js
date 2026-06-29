(function () {
  function readinessProNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function readinessProText(row = {}) {
    return Object.values(row || {})
      .filter(value => value != null && typeof value !== "object")
      .join(" ")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function readinessProHasTestData() {
    const markers = ["teste", "correcao fluxo automatico", "suporte articulado para headset", "cliente teste g3d final", "pla preto fosco"];
    const tables = ["clientes", "estoque", "orcamentos", "pedidos", "producoes", "producao_historico"];
    return tables.some(table => (state.cache?.[table] || []).some(row => markers.some(marker => readinessProText(row).includes(marker))));
  }

  function readinessProHasImages() {
    const loja = state.cache.loja || {};
    const hasLogo = Boolean(loja.logo_url || loja.logo_path || loja.logo_base64);
    const budgets = state.cache.orcamentos || [];
    const hasBudgetImage = budgets.some(row => row.imagem_url || row.imagem_path || row.image_url || row.image_path || row.arquivos?.length);
    return { hasLogo, hasBudgetImage };
  }

  function readinessProDocsReady() {
    return Boolean(
      typeof openBudgetPdf === "function" &&
      typeof openOrderReceiptPdf === "function" &&
      typeof openProductionOrderPdf === "function" &&
      typeof openFinanceReportPdf === "function"
    );
  }

  function readinessProHasCosts() {
    const params = state.cache.parametros || {};
    const required = ["custo_kwh", "consumo_kw_hora", "custo_hora_maquina", "custo_grama_padrao", "margem_percentual", "taxa_minima"];
    const paramsOk = required.every(key => readinessProNumber(params[key]) > 0);
    const stockOk = (state.cache.estoque || []).some(item => readinessProNumber(item.custo_grama) > 0 || readinessProNumber(item.valor_atual) > 0);
    return paramsOk && stockOk;
  }

  function readinessProAdminOk() {
    const admins = typeof activeAdmins === "function" ? activeAdmins() : (state.cache.admins || []);
    return admins.length > 0 || (typeof isBootstrapAdmin === "function" && isBootstrapAdmin());
  }

  function readinessProAuto(id, title, detail, ok, warning) {
    if (typeof autoCheck === "function") return autoCheck(id, title, detail, ok, warning);
    return { id, title, detail: ok ? detail : warning, done: Boolean(ok), manual: false, status: ok ? "ok" : "warn" };
  }

  function readinessProManual(id, title, detail, manual) {
    if (typeof manualCheck === "function") return manualCheck(id, title, detail, manual);
    const done = Boolean(manual[id]);
    return { id, title, detail, done, manual: true, status: done ? "ok" : "manual" };
  }

  buildReadinessChecks = function buildReadinessChecksProfessional() {
    const loja = state.cache.loja || {};
    const clientes = state.cache.clientes || [];
    const estoque = state.cache.estoque || [];
    const orcamentos = state.cache.orcamentos || [];
    const pedidos = state.cache.pedidos || [];
    const producoes = state.cache.producoes || [];
    const manual = typeof readinessManualState === "function" ? readinessManualState() : {};
    const images = readinessProHasImages();
    const hasLojaCore = Boolean(loja.nome_loja && loja.whatsapp && (loja.email || loja.documento));
    const hasNoTestData = !readinessProHasTestData();
    const hasDocs = readinessProDocsReady();
    const hasFlow = clientes.length > 0 && estoque.length > 0 && orcamentos.length > 0 && pedidos.length > 0 && producoes.length > 0;

    return [
      {
        group: "Base comercial",
        items: [
          readinessProAuto("loja", "Perfil da loja completo", "Nome, contato e documento aparecem nos documentos comerciais.", hasLojaCore, "Complete Minha loja com nome, WhatsApp e documento ou e-mail."),
          readinessProAuto("logo", "Logo pronta para documentos", "A marca da loja será usada em orçamento, recibo, ordem de produção e relatório.", images.hasLogo, "Suba a logo da loja antes de enviar PDFs para clientes."),
          readinessProAuto("clientes", "Carteira de clientes iniciada", "Há clientes cadastrados para validar histórico, WhatsApp e documentos.", clientes.length > 0, "Cadastre pelo menos um cliente real ou exemplo controlado."),
          readinessProAuto("custos", "Custos e estoque coerentes", "Parâmetros e materiais têm custos suficientes para cálculo automático.", readinessProHasCosts(), "Revise parâmetros e cadastre pelo menos um material com custo por grama.")
        ]
      },
      {
        group: "Fluxo operacional",
        items: [
          readinessProAuto("orcamento", "Orçamento validado", "Existe orçamento para conferir cálculo, PDF, imagem e logo.", orcamentos.length > 0, "Crie um orçamento completo com material, cor, peso e tempo."),
          readinessProAuto("pedido", "Pedido validado", "Existe pedido para testar financeiro, recibo e acompanhamento.", pedidos.length > 0, "Transforme um orçamento em pedido ou crie um pedido real."),
          readinessProAuto("producao", "Produção validada", "Existe produção para testar fases, notificações, histórico e baixa de estoque.", producoes.length > 0, "Envie um pedido para produção e valide as etapas."),
          readinessProAuto("fluxo", "Fluxo completo registrado", "Cliente, estoque, orçamento, pedido e produção existem na mesma operação.", hasFlow, "Complete o ciclo comercial e operacional uma vez antes de migrar.")
        ]
      },
      {
        group: "Documentos e histórico",
        items: [
          readinessProAuto("docs", "PDFs profissionais carregados", "Orçamento, recibo, ordem de produção e relatório financeiro estão disponíveis.", hasDocs, "Recarregue a página e confira os botões de PDF nos módulos."),
          readinessProAuto("images", "Imagens de orçamento prontas", "O sistema suporta imagens de projeto para compor propostas comerciais.", typeof g3dBudgetImageUrls === "function" || images.hasBudgetImage, "Envie imagens nos orçamentos quando quiser vender melhor o projeto."),
          readinessProAuto("history", "Histórico e linha do tempo ativos", "Ficha do cliente e produção mostram movimentos importantes da operação.", typeof openClientProfile === "function" && typeof loadProductionHistory === "function", "Recarregue a página para ativar histórico e linha do tempo."),
          readinessProAuto("clean", "Dados de teste removidos", "A base carregada não contém registros de teste da validação.", hasNoTestData, "Use a limpeza ADM ou remova manualmente registros marcados como teste.")
        ]
      },
      {
        group: "Segurança e migração",
        items: [
          readinessProAuto("admins", "Administrador configurado", "A área ADM tem pelo menos um responsável ativo.", readinessProAdminOk(), "Confirme owner/admin na Área ADM."),
          readinessProAuto("https", "Acesso seguro por HTTPS", "O app publicado está abrindo com conexão segura.", location.protocol === "https:", "Use apenas domínio com HTTPS ativo."),
          readinessProAuto("service", "Nenhuma chave privada no navegador", "A página não expõe service role no frontend.", !String(window.G3D_SERVICE_ROLE || "").trim(), "Chave service_role nunca pode ficar no site público."),
          readinessProManual("rls", "Permissões do banco conferidas", "Confirme no Supabase que cada usuário só acessa os próprios dados.", manual),
          readinessProManual("backup", "Backup/exportação revisado", "Tenha cópia do banco e dos arquivos importantes antes da troca de domínio.", manual),
          readinessProManual("privacy", "Termos e privacidade preparados", "Inclua textos básicos para uso comercial por outras lojas.", manual),
          readinessProManual("domain", "Domínio definitivo planejado", "Defina domínio, e-mail de envio e endereço final antes de divulgar.", manual)
        ]
      }
    ];
  };

  window.G3D_READINESS_PRO = true;
})();
