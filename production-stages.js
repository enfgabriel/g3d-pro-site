const G3D_PRODUCTION_STAGE_LABELS = {
  fila: "Fila",
  imprimindo: "Imprimindo",
  pos: "Pós-processamento",
  pronto: "Pronto",
  entregue: "Entregue",
  falha: "Falha",
  cancelado: "Cancelado"
};

const G3D_PRODUCTION_STAGE_ORDER = ["fila", "imprimindo", "pos", "pronto", "entregue"];

function productionStageKey(status = "fila") {
  const normalized = String(status || "fila").toLowerCase().trim();
  if (["em produção", "producao", "produção", "impressao", "impressão"].includes(normalized)) return "imprimindo";
  if (["pós-processamento", "pos-processamento", "pos processamento", "pós", "pos"].includes(normalized)) return "pos";
  if (["finalizado", "concluido", "concluído"].includes(normalized)) return "entregue";
  if (["pausado", "erro"].includes(normalized)) return "falha";
  return G3D_PRODUCTION_STAGE_LABELS[normalized] ? normalized : "fila";
}

function productionStageLabel(status = "fila") {
  return G3D_PRODUCTION_STAGE_LABELS[productionStageKey(status)] || "Fila";
}

function productionStageNext(row) {
  const stage = productionStageKey(row.status);
  if (stage === "fila") return { status: "imprimindo", label: "Iniciar" };
  if (stage === "imprimindo") return { status: "pos", label: "Pós" };
  if (stage === "pos") return { status: "pronto", label: row.estoque_baixado ? "Marcar pronto" : "Finalizar e baixar" };
  if (stage === "pronto") return { status: "entregue", label: "Entregar" };
  if (stage === "falha") return { status: "fila", label: "Reimprimir" };
  return null;
}

function productionStageBadgeClass(status) {
  const stage = productionStageKey(status);
  if (["fila"].includes(stage)) return "blue";
  if (["imprimindo", "pos"].includes(stage)) return "warn";
  if (["pronto", "entregue"].includes(stage)) return "good";
  if (["falha", "cancelado"].includes(stage)) return "danger";
  return "blue";
}

function productionStageTimestamp(status) {
  const stage = productionStageKey(status);
  if (stage === "imprimindo") return { etapa_atual: stage, iniciado_em: new Date().toISOString(), impressao_iniciada_em: new Date().toISOString() };
  if (stage === "pos") return { etapa_atual: stage, pos_iniciado_em: new Date().toISOString() };
  if (stage === "pronto") return { etapa_atual: stage, pronto_em: new Date().toISOString() };
  if (stage === "entregue") return { etapa_atual: stage, entregue_em: new Date().toISOString() };
  if (stage === "falha") return { etapa_atual: stage, falha_em: new Date().toISOString() };
  return { etapa_atual: stage };
}

async function registerProductionStageHistory(row, nextStatus, note = "") {
  if (typeof registerProductionHistory !== "function") return { error: null };
  const userId = typeof productionHistoryUserId === "function" ? await productionHistoryUserId() : state.session?.user?.id || null;
  const payload = {
    producao_id: row.id,
    pedido_id: row.pedido_id || null,
    orcamento_id: row.orcamento_id || null,
    estoque_id: row.estoque_id || null,
    tipo: "status_producao",
    producao_numero: row.numero || "",
    producao_titulo: row.titulo || "",
    status_anterior: row.status || "fila",
    status_novo: nextStatus,
    consumo_material_g: 0,
    saldo_anterior_g: 0,
    saldo_novo_g: 0,
    material: row.material || "",
    cor: row.cor || "",
    observacao: note || `Etapa alterada para ${productionStageLabel(nextStatus)}.`
  };
  if (userId) payload.user_id = userId;
  const cleanPayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
  const query = () => supabaseClient.from("producao_historico").insert(cleanPayload);
  return typeof g3dRunWithFreshSession === "function" ? g3dRunWithFreshSession(query) : query();
}

async function updateProductionStage(row, nextStatus, extra = {}) {
  if (!row?.id) return;
  const stage = productionStageKey(nextStatus);

  if (stage === "pronto" && !row.estoque_baixado && stockForProduction(row)) {
    await registerProductionStageHistory(row, "pronto", "Produção finalizada e enviada para baixa de estoque.");
    return finishProductionAndConsumeStock(row);
  }

  const payload = {
    status: stage,
    ...productionStageTimestamp(stage),
    ...extra
  };
  const cleanPayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
  const result = typeof g3dRunWithFreshSession === "function"
    ? await g3dRunWithFreshSession(() => supabaseClient.from("producoes").update(cleanPayload).eq("id", row.id))
    : await supabaseClient.from("producoes").update(cleanPayload).eq("id", row.id);

  if (result.error) {
    const text = String(result.error.message || "").toLowerCase();
    if (text.includes("schema cache") || text.includes("etapa_atual") || text.includes("iniciado_em")) {
      showToast("Falta atualizar o banco para controlar etapas da produção. Recarregue e tente novamente.");
      return;
    }
    showToast(result.error.message);
    return;
  }

  await registerProductionStageHistory(row, stage, extra.falha_motivo ? `Falha registrada: ${extra.falha_motivo}` : "");
  if (stage === "entregue" && row.pedido_id) await supabaseClient.from("pedidos").update({ status: "entregue" }).eq("id", row.pedido_id);
  if (stage === "imprimindo" && row.pedido_id) await supabaseClient.from("pedidos").update({ status: "em produção" }).eq("id", row.pedido_id);
  showToast(`Produção atualizada para ${productionStageLabel(stage)}.`);
  await Promise.all([loadTable("pedidos"), loadTable("producoes"), loadProductionHistory()]);
  renderPage();
}

async function markProductionFailure(row) {
  const reason = window.prompt("Motivo da falha ou reimpressão", row.falha_motivo || "");
  if (reason === null) return;
  await updateProductionStage(row, "falha", { falha_motivo: reason || "Falha sem detalhe informado" });
}

function productionStageProgress(row) {
  const current = productionStageKey(row.status);
  return G3D_PRODUCTION_STAGE_ORDER.map(stage => {
    const done = G3D_PRODUCTION_STAGE_ORDER.indexOf(stage) <= G3D_PRODUCTION_STAGE_ORDER.indexOf(current);
    return `<span class="stage-dot ${done ? "done" : ""}">${G3D_PRODUCTION_STAGE_LABELS[stage]}</span>`;
  }).join("");
}

renderProducoesProfessional = function renderProducoesWithStages(el) {
  const rows = state.cache.producoes || [];
  const active = rows.filter(row => !["pronto", "entregue", "cancelado"].includes(productionStageKey(row.status))).length;
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Produção</h1><p class="muted">Controle de etapas, falhas, reimpressão e baixa de estoque.</p></div>
      <button class="btn primary" id="newProductionRecord">Nova produção</button>
    </div>
    <div class="grid production-summary">
      <div class="stat"><span>Total</span><strong>${rows.length}</strong></div>
      <div class="stat"><span>Em andamento</span><strong>${active}</strong></div>
      <div class="stat"><span>Prontas/entregues</span><strong>${rows.filter(row => ["pronto", "entregue"].includes(productionStageKey(row.status))).length}</strong></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Produção</th><th>Etapa</th><th>Fluxo</th><th>Material</th><th>Consumo</th><th>Estoque</th><th></th></tr></thead>
        <tbody>
          ${rows.length ? rows.map(row => {
            const stock = stockForProduction(row);
            const next = productionStageNext(row);
            const stage = productionStageKey(row.status);
            return `<tr>
              <td><strong>${escapeHtml(row.numero || row.titulo || "")}</strong><div class="muted small">${escapeHtml(row.titulo || "")}</div>${row.falha_motivo ? `<div class="muted small">Falha: ${escapeHtml(row.falha_motivo)}</div>` : ""}</td>
              <td><span class="badge ${productionStageBadgeClass(row.status)}">${escapeHtml(productionStageLabel(row.status))}</span></td>
              <td><div class="stage-progress">${productionStageProgress(row)}</div></td>
              <td>${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</td>
              <td>${productionConsumption(row).toLocaleString("pt-BR")} g/ml</td>
              <td>${row.estoque_baixado ? `<span class="badge good">Baixado</span>` : stock ? `<span class="badge blue">Vinculado</span>` : `<span class="badge warn">Sem vínculo</span>`}</td>
              <td><div class="actions production-actions">
                <button class="btn" data-edit-production="${row.id}">Editar</button>
                ${next ? `<button class="btn primary" data-next-stage="${row.id}">${escapeHtml(next.label)}</button>` : ""}
                ${!["falha", "entregue", "cancelado"].includes(stage) ? `<button class="btn danger" data-fail-production="${row.id}">Falha</button>` : ""}
                <button class="btn danger" data-del-production="${row.id}">Excluir</button>
              </div></td>
            </tr>`;
          }).join("") : `<tr><td colspan="7" class="empty">Nenhuma produção ainda.</td></tr>`}
        </tbody>
      </table>
    </div>
    ${typeof renderProductionHistoryPanel === "function" ? renderProductionHistoryPanel() : ""}`;

  document.getElementById("newProductionRecord").addEventListener("click", () => openForm(modules.producoes));
  document.querySelectorAll("[data-edit-production]").forEach(btn => btn.addEventListener("click", () => openForm(modules.producoes, rows.find(row => row.id === btn.dataset.editProduction))));
  document.querySelectorAll("[data-del-production]").forEach(btn => btn.addEventListener("click", () => softDelete("producoes", btn.dataset.delProduction)));
  document.querySelectorAll("[data-next-stage]").forEach(btn => btn.addEventListener("click", () => {
    const row = rows.find(item => item.id === btn.dataset.nextStage);
    const next = productionStageNext(row);
    if (next) updateProductionStage(row, next.status);
  }));
  document.querySelectorAll("[data-fail-production]").forEach(btn => btn.addEventListener("click", () => markProductionFailure(rows.find(row => row.id === btn.dataset.failProduction))));
};
