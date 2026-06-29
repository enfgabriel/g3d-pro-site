(function () {
  const status = {
    version: "20260629-3",
    loaded: false,
    error: "",
    userScopedTables: []
  };
  window.G3D_SECURITY_HARDENING = status;

  try {
    const userScopedTables = new Set([
      "clientes",
      "estoque",
      "orcamentos",
      "pedidos",
      "producoes",
      "parametros_precificacao",
      "loja_perfis",
      "catalogo_produtos",
      "financeiro_lancamentos",
      "producao_historico"
    ]);

    const singleUserTables = {
      parametros_precificacao: "parametros",
      loja_perfis: "loja"
    };

    function currentUserId() {
      return state.session?.user?.id || null;
    }

    function isUserScopedTable(table) {
      return userScopedTables.has(String(table || ""));
    }

    function securePayload(table, payload = {}, id = null) {
      const normalized = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : { ...payload };
      if (!isUserScopedTable(table)) return normalized;
      const userId = currentUserId();
      if (!userId) return normalized;
      if (!id) normalized.user_id = userId;
      if (id && Object.prototype.hasOwnProperty.call(normalized, "user_id")) delete normalized.user_id;
      return normalized;
    }

    function secureSelect(table) {
      let query = supabaseClient.from(table).select("*");
      const userId = currentUserId();
      if (userId && isUserScopedTable(table)) query = query.eq("user_id", userId);
      return query;
    }

    function secureMutation(table, payload, id = null) {
      const secured = securePayload(table, payload, id);
      let query = id ? supabaseClient.from(table).update(secured).eq("id", id) : supabaseClient.from(table).insert(secured);
      const userId = currentUserId();
      if (id && userId && isUserScopedTable(table)) query = query.eq("user_id", userId);
      return query;
    }

    loadTable = async function loadTableWithUserScope(table) {
      let query = secureSelect(table);
      if (!singleUserTables[table]) query = query.is("deleted_at", null).order("created_at", { ascending: false });
      const { data, error } = await query;
      if (!error) state.cache[table] = data || [];
      return { data, error };
    };

    loadSingle = async function loadSingleWithUserScope(table, key) {
      const { data, error } = await secureSelect(table).maybeSingle();
      if (!error) state.cache[key] = data || null;
      return { data, error };
    };

    saveRecord = async function saveRecordWithUserScope(table, payload, id) {
      if (!state.session) {
        showToast("Faça login novamente para salvar com segurança.");
        return;
      }
      if (table === "orcamentos" && typeof payload.imagens === "string" && typeof g3dImageList === "function") payload.imagens = g3dImageList(payload.imagens);
      const { error } = await secureMutation(table, payload, id);
      if (error) return showToast(error.message);
      showToast("Registro salvo.");
      await loadTable(table);
      if (table === "orcamentos") state.page = "orcamentos";
      renderPage();
    };

    softDelete = async function softDeleteWithUserScope(table, id) {
      if (!state.session) {
        showToast("Faça login novamente para remover com segurança.");
        return;
      }
      let query = supabaseClient.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
      const userId = currentUserId();
      if (userId && isUserScopedTable(table)) query = query.eq("user_id", userId);
      const { error } = await query;
      if (error) return showToast(error.message);
      showToast("Registro removido.");
      await loadTable(table);
      renderPage();
    };

    if (typeof g3dAssetUrl === "function") {
      const previousAssetUrl = g3dAssetUrl;
      g3dAssetUrl = async function g3dAssetUrlWithTrustedSources(pathOrUrl) {
        if (!pathOrUrl) return "";
        const value = String(pathOrUrl);
        if (/^https?:\/\//i.test(value)) {
          const trustedProject = "https://pbsxxgsgqstwscowxshq.supabase.co/";
          return value.startsWith(trustedProject) ? value : "";
        }
        const userId = currentUserId();
        if (userId && !value.startsWith(`${userId}/`)) return "";
        return previousAssetUrl(value);
      };
    }

    status.loaded = true;
    status.userScopedTables = Array.from(userScopedTables);
    status.hasSession = () => Boolean(state.session);
    status.currentUserId = currentUserId;
  } catch (error) {
    status.loaded = false;
    status.error = error?.message || "Falha ao ativar camada de segurança.";
  }
})();

(function () {
  window.G3D_FLOW_FINAL = false;
  try {
    const n = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };
    const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
    const stockFor = source => {
      const items = state.cache.estoque || [];
      if (source?.estoque_id) {
        const direct = items.find(item => item.id === source.estoque_id);
        if (direct) return direct;
      }
      if (source?.estoque_ref) {
        const direct = items.find(item => item.id === source.estoque_ref);
        if (direct) return direct;
      }
      if (typeof findStockForBudget === "function") {
        const found = findStockForBudget(source || {});
        if (found) return found;
      }
      return items.find(item => {
        const materialOk = source?.material && (same(item.material, source.material) || String(item.nome || "").toLowerCase().includes(String(source.material).toLowerCase()));
        const colorOk = !source?.cor || same(item.cor, source.cor);
        return materialOk && colorOk;
      }) || null;
    };
    const budgetForOrder = order => (state.cache.orcamentos || []).find(item => item.id === order?.orcamento_id || item.pedido_id === order?.id) || null;
    const budgetHours = row => n(row?.horas, 0) * Math.max(1, n(row?.quantidade_pecas, 1));

    const previousOrder = typeof generateOrderFromBudget === "function" ? generateOrderFromBudget : null;
    generateOrderFromBudget = async function generateOrderFromBudgetSecureFlow(row) {
      if (!row?.id) return;
      const existing = typeof budgetOrderFor === "function" ? budgetOrderFor(row) : null;
      if (existing) return showToast(`Este orçamento já gerou o pedido ${existing.numero || ""}.`);
      const client = typeof budgetOrderClient === "function" ? budgetOrderClient(row) : null;
      const stock = stockFor(row);
      const qty = Math.max(1, n(row.quantidade_pecas, 1));
      let payload = {
        orcamento_id: row.id,
        cliente_id: row.cliente_id || null,
        estoque_id: stock?.id || row.estoque_id || null,
        numero: typeof orderNumberFromBudget === "function" ? orderNumberFromBudget(row) : nextNumber("PED", state.cache.pedidos.length),
        titulo: row.projeto || `Pedido do orçamento ${row.numero || ""}`,
        status: "novo",
        prioridade: n(row.urgencia_percentual, 0) > 0 ? "Alta" : "Normal",
        valor: n(row.total, 0),
        material: row.material || stock?.material || "",
        cor: row.cor || stock?.cor || "",
        peso_g: n(row.peso_g, 0),
        quantidade_pecas: qty,
        tempo_horas: budgetHours(row),
        prazo_entrega: row.prazo_entrega || "A combinar",
        observacao: [row.numero ? `Gerado automaticamente a partir do orçamento ${row.numero}.` : "Gerado automaticamente a partir de orçamento.", client ? `Cliente: ${client.nome || client.empresa || ""}.` : "", stock ? `Estoque vinculado: ${stock.nome || stock.material || "material"}.` : "", row.observacao || ""].filter(Boolean).join("\n")
      };
      payload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
      const result = await supabaseClient.from("pedidos").insert(payload).select("id, numero").single();
      if (result.error) return previousOrder ? previousOrder(row) : showToast(result.error.message);
      const updatePayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload({ status: "aprovado", pedido_id: result.data?.id || null }) : { status: "aprovado", pedido_id: result.data?.id || null };
      const update = await supabaseClient.from("orcamentos").update(updatePayload).eq("id", row.id);
      showToast(update.error ? `Pedido ${result.data?.numero || ""} criado, mas o orçamento não foi marcado como aprovado.` : `Pedido ${result.data?.numero || ""} criado com cliente, material e estoque vinculados.`);
      await Promise.all([loadTable("pedidos"), loadTable("orcamentos")]);
      renderPage();
    };

    const previousProduction = typeof generateProductionFromOrder === "function" ? generateProductionFromOrder : null;
    generateProductionFromOrder = async function generateProductionFromOrderSecureFlow(order) {
      if (!order?.id) return;
      const existing = typeof productionForOrder === "function" ? productionForOrder(order) : null;
      if (existing) return showToast(`Este pedido já está na produção: ${existing.titulo || ""}.`);
      const budget = budgetForOrder(order) || {};
      const merged = { ...budget, ...order };
      const stock = stockFor(merged);
      const qty = Math.max(1, n(merged.quantidade_pecas, 1));
      const weight = n(merged.peso_g || budget.peso_g, 0);
      const client = typeof orderClient === "function" ? orderClient(merged) : null;
      let payload = {
        pedido_id: order.id,
        cliente_id: merged.cliente_id || null,
        orcamento_id: merged.orcamento_id || budget.id || null,
        estoque_id: stock?.id || merged.estoque_id || null,
        numero: typeof productionNumberFromOrder === "function" ? productionNumberFromOrder(order) : nextNumber("PROD", state.cache.producoes.length),
        titulo: order.titulo || budget.projeto || `Produção do pedido ${order.numero || ""}`,
        status: "fila",
        etapa_atual: "fila",
        prioridade: order.prioridade || "Normal",
        material: merged.material || stock?.material || "",
        cor: merged.cor || stock?.cor || "",
        peso_g: weight,
        quantidade_pecas: qty,
        consumo_material_g: weight * qty,
        estoque_baixado: false,
        tempo_horas: n(order.tempo_horas, 0) || budgetHours(budget),
        data_prevista: order.data_entrega || null,
        observacao: [order.numero ? `Gerado automaticamente a partir do pedido ${order.numero}.` : "Gerado automaticamente a partir de pedido.", budget.numero ? `Origem comercial: ${budget.numero}.` : "", client ? `Cliente: ${client.nome || client.empresa || ""}.` : "", stock ? `Estoque vinculado: ${stock.nome || stock.material || "material"}.` : "", order.observacao || ""].filter(Boolean).join("\n")
      };
      payload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
      const result = await supabaseClient.from("producoes").insert(payload).select("id, titulo").single();
      if (result.error) return previousProduction ? previousProduction(order) : showToast(result.error.message);
      const updatePayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload({ status: "em produção", producao_id: result.data?.id || null }) : { status: "em produção", producao_id: result.data?.id || null };
      const update = await supabaseClient.from("pedidos").update(updatePayload).eq("id", order.id);
      showToast(update.error ? "Produção criada, mas o pedido não foi marcado como em produção." : "Pedido enviado para produção com consumo e estoque vinculados.");
      await Promise.all([loadTable("pedidos"), loadTable("producoes")]);
      renderPage();
    };

    openBudgetPdf = async function openBudgetPdfSecureBlob(row) {
      if (!row) return;
      try {
        const profile = budgetProfileDefaults(state.cache.loja || {});
        const client = (state.cache.clientes || []).find(item => item.id === row.cliente_id);
        const issue = new Date();
        const total = Number(row.total || calculatePrice(row));
        const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(row.numero || "Orçamento")}</title><style>body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.actions{position:sticky;top:0;background:#101820;padding:10px;text-align:center}.actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d}.page{max-width:920px;margin:0 auto;background:#fff;min-height:100vh;padding:42px}.head{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #101820;padding-bottom:20px}.muted{color:#667085;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden;margin-top:18px}.grid div{padding:13px;border-right:1px solid #d8dee8}.grid div:last-child{border-right:0}.grid span{display:block;font-size:12px;color:#667085;margin-bottom:5px}.box{border:1px solid #d8dee8;border-radius:10px;padding:16px;margin-top:16px}.total{display:flex;justify-content:space-between;margin-top:24px;padding:20px;border-radius:12px;background:#101820;color:white}.total strong{font-size:30px;color:#24d982}@media print{.actions{display:none}.page{max-width:none}}@media(max-width:720px){.head{display:block}.grid{grid-template-columns:1fr 1fr}}</style></head><body><div class="actions"><button onclick="window.print()">Salvar como PDF</button></div><main class="page"><section class="head"><div><h1>${escapeHtml(profile.nome_loja || "G3D Pro")}</h1><p class="muted">${escapeHtml([profile.documento, profile.whatsapp, profile.email].filter(Boolean).join(" | "))}</p></div><strong>G3D</strong></section><h2>Orçamento ${escapeHtml(row.numero || "")}</h2><p class="muted">Emitido em ${issue.toLocaleDateString("pt-BR")}</p>${client ? `<div class="box"><h3>Cliente</h3><p>${escapeHtml(client.nome || client.empresa || "")}</p><p class="muted">${escapeHtml([client.email, client.telefone, client.whatsapp].filter(Boolean).join(" | "))}</p></div>` : ""}<div class="grid"><div><span>Projeto</span><strong>${escapeHtml(row.projeto || "")}</strong></div><div><span>Qtd.</span><strong>${escapeHtml(row.quantidade_pecas || 1)}</strong></div><div><span>Material</span><strong>${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</strong></div><div><span>Prazo</span><strong>${escapeHtml(row.prazo_entrega || "A combinar")}</strong></div></div><div class="grid"><div><span>Peso por peça</span><strong>${escapeHtml(row.peso_g || 0)} g/ml</strong></div><div><span>Tempo por peça</span><strong>${escapeHtml(row.horas || 0)} h</strong></div><div><span>Entrega</span><strong>${escapeHtml(row.retirada_entrega || "retirada")}</strong></div><div><span>Status</span><strong>${escapeHtml(row.status || "rascunho")}</strong></div></div><div class="box"><h3>Condições e observações</h3><p class="muted">${escapeHtml(row.revisao_arquivo || "Análise visual e fatiamento padrão inclusos")}</p><p class="muted">${escapeHtml(row.observacao || profile.observacao_padrao || "")}</p></div><section class="total"><span>Total do orçamento</span><strong>${money(total)}</strong></section></main></body></html>`;
        const blobUrl = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
        const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (!win) {
          URL.revokeObjectURL(blobUrl);
          return showToast("Permita pop-ups para abrir o orçamento.");
        }
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      } catch (error) {
        showToast(`Não foi possível abrir o PDF: ${error.message || error}`);
      }
    };

    window.G3D_FLOW_FINAL = true;
  } catch (error) {
    window.G3D_FLOW_FINAL = false;
    console.error("G3D flow final", error);
  }
})();
