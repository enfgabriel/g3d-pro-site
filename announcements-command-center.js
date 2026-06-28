function announcementScheduleState(item) {
  if (item.ativo === false) return { label: "Pausado", className: "warn", group: "paused" };
  const now = Date.now();
  const starts = item.starts_at ? new Date(item.starts_at).getTime() : null;
  const ends = item.ends_at ? new Date(item.ends_at).getTime() : null;
  if (starts && starts > now) return { label: "Agendado", className: "blue", group: "scheduled" };
  if (ends && ends < now) return { label: "Expirado", className: "danger", group: "expired" };
  return { label: "Publicado", className: "good", group: "live" };
}

function announcementDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function announcementDateTimeLabel(value) {
  if (!value) return "Sem data";
  try {
    return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch (_error) {
    return "Sem data";
  }
}

function announcementCommandStats(rows) {
  return rows.reduce((acc, item) => {
    const stateInfo = announcementScheduleState(item);
    acc.total += 1;
    acc[stateInfo.group] = (acc[stateInfo.group] || 0) + 1;
    if (item.featured) acc.featured += 1;
    return acc;
  }, { total: 0, live: 0, scheduled: 0, paused: 0, expired: 0, featured: 0 });
}

function renderAnnouncementCommandCenter() {
  const rows = state.cache.announcements || [];
  const stats = announcementCommandStats(rows);
  const canManage = canManageAnnouncements();
  return `
    <section class="card admin-card span-2 announcement-command-center ${canManage ? "" : "admin-card-locked"}">
      <div class="card-head-row">
        <div>
          <h3>Central de comando de comunicados</h3>
          <p class="muted small">Planeje anúncios, parceiros, campanhas e avisos com datas de publicação e encerramento.</p>
        </div>
        <button class="btn primary" type="button" id="newAnnouncement" ${canManage ? "" : "disabled"}>Novo comunicado</button>
      </div>

      <div class="announcement-command-stats">
        <div><span>Total</span><strong>${stats.total}</strong></div>
        <div><span>Publicados</span><strong>${stats.live || 0}</strong></div>
        <div><span>Agendados</span><strong>${stats.scheduled || 0}</strong></div>
        <div><span>Expirados</span><strong>${stats.expired || 0}</strong></div>
        <div><span>Destaques</span><strong>${stats.featured}</strong></div>
      </div>

      <div class="announcement-command-list">
        ${rows.length ? rows.map(renderAnnouncementCommandItem).join("") : `<div class="dashboard-empty">Nenhum comunicado cadastrado ainda.</div>`}
      </div>
    </section>`;
}

function renderAnnouncementCommandItem(item) {
  const stateInfo = announcementScheduleState(item);
  return `
    <article class="announcement-command-item">
      ${item.image_url ? `<img src="${escapeHtml(item.image_url)}" alt="${escapeHtml(item.title || "Comunicado")}" />` : `<div class="announcement-thumb-empty">G3D</div>`}
      <div class="announcement-command-body">
        <div class="announcement-meta">
          <span class="badge ${stateInfo.className}">${escapeHtml(stateInfo.label)}</span>
          <span class="badge blue">${escapeHtml(item.category || "Comunicado")}</span>
          ${item.featured ? `<span class="badge good">Destaque</span>` : ""}
        </div>
        <strong>${escapeHtml(item.title || "Sem título")}</strong>
        <p>${escapeHtml(item.summary || "")}</p>
        <small>Entra: ${escapeHtml(announcementDateTimeLabel(item.starts_at))} · Sai: ${escapeHtml(announcementDateTimeLabel(item.ends_at))}</small>
      </div>
      <div class="actions announcement-command-actions">
        <button class="btn" type="button" data-edit-announcement="${escapeHtml(item.id)}">Editar</button>
        <button class="btn" type="button" data-preview-announcement="${escapeHtml(item.id)}">Prévia</button>
        <button class="btn" type="button" data-toggle-announcement="${escapeHtml(item.id)}">${item.ativo === false ? "Ativar" : "Pausar"}</button>
      </div>
    </article>`;
}

function renderAnnouncementPreview(row = {}) {
  const item = {
    title: row.title || "Título do comunicado",
    summary: row.summary || "Resumo do comunicado para orientar o usuário antes de abrir o link.",
    image_url: row.image_url || "",
    link_url: row.link_url || "",
    link_label: row.link_label || "Abrir link",
    category: row.category || "Comunicado",
    starts_at: row.starts_at || null,
    created_at: row.created_at || new Date().toISOString()
  };
  return `<div class="announcement-preview-box">${announcementCard(item)}</div>`;
}

function openAnnouncementPreview(row = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal announcement-preview-modal">
      <div class="modal-head"><strong>Prévia do comunicado</strong><button class="btn" type="button" id="closeAnnouncementPreview">Fechar</button></div>
      <div class="modal-body">${renderAnnouncementPreview(row)}</div>
    </div>`;
  document.body.appendChild(backdrop);
  document.getElementById("closeAnnouncementPreview").addEventListener("click", () => backdrop.remove());
}

openAnnouncementForm = function openAnnouncementCommandForm(row = {}) {
  if (!canManageAnnouncements()) {
    showToast("Apenas ADMs podem publicar comunicados.");
    return;
  }
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal announcement-command-modal" id="announcementForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} comunicado</strong><button class="btn" type="button" id="closeAnnouncement">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field"><label>Título</label><input name="title" required value="${escapeHtml(row.title || "")}" placeholder="Ex: Parceria, atualização ou aviso" /></div>
          <div class="field"><label>Categoria</label><select name="category"><option value="Comunicado" ${!row.category || row.category === "Comunicado" ? "selected" : ""}>Comunicado</option><option value="Atualização" ${row.category === "Atualização" ? "selected" : ""}>Atualização</option><option value="Parceiro" ${row.category === "Parceiro" ? "selected" : ""}>Parceiro</option><option value="Promoção" ${row.category === "Promoção" ? "selected" : ""}>Promoção</option><option value="Aviso" ${row.category === "Aviso" ? "selected" : ""}>Aviso</option></select></div>
          <div class="field span-2"><label>Resumo</label><textarea name="summary" placeholder="Texto curto que aparecerá para os usuários">${escapeHtml(row.summary || "")}</textarea></div>
          <div class="field span-2"><label>URL da imagem</label><input name="image_url" value="${escapeHtml(row.image_url || "")}" placeholder="https://..." /></div>
          <div class="field"><label>Link de destino</label><input name="link_url" value="${escapeHtml(row.link_url || "")}" placeholder="https://..." /></div>
          <div class="field"><label>Texto do botão</label><input name="link_label" value="${escapeHtml(row.link_label || "Saiba mais")}" /></div>
          <div class="field"><label>Publicar em</label><input type="datetime-local" name="starts_at" value="${escapeHtml(announcementDateInput(row.starts_at))}" /></div>
          <div class="field"><label>Remover em</label><input type="datetime-local" name="ends_at" value="${escapeHtml(announcementDateInput(row.ends_at))}" /></div>
          <div class="field"><label>Ordem</label><input type="number" name="sort_order" value="${escapeHtml(row.sort_order ?? 10)}" /></div>
          <div class="field"><label>Status</label><select name="ativo"><option value="true" ${row.ativo !== false ? "selected" : ""}>Ativo</option><option value="false" ${row.ativo === false ? "selected" : ""}>Pausado</option></select></div>
          <div class="field"><label>Destaque</label><select name="featured"><option value="false" ${row.featured ? "" : "selected"}>Normal</option><option value="true" ${row.featured ? "selected" : ""}>Destaque</option></select></div>
          <div class="field"><label>Público</label><select name="audience"><option value="todos" ${!row.audience || row.audience === "todos" ? "selected" : ""}>Todos os usuários</option><option value="admins" ${row.audience === "admins" ? "selected" : ""}>Somente ADMs</option></select></div>
          <div class="field span-2"><label>Nota interna</label><textarea name="internal_note" placeholder="Observação interna para ADMs">${escapeHtml(row.internal_note || "")}</textarea></div>
          <div class="span-2" id="announcementLivePreview">${renderAnnouncementPreview(row)}</div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="previewAnnouncement">Prévia</button><button class="btn" type="button" id="cancelAnnouncement">Cancelar</button><button class="btn primary" type="submit">Salvar comunicado</button></div>
    </form>`;
  document.body.appendChild(backdrop);
  const form = document.getElementById("announcementForm");
  const close = () => backdrop.remove();
  const currentPayload = () => Object.fromEntries(new FormData(form).entries());
  const updatePreview = () => {
    document.getElementById("announcementLivePreview").innerHTML = renderAnnouncementPreview(currentPayload());
  };
  ["title", "summary", "image_url", "link_url", "link_label", "category", "starts_at"].forEach(name => form[name]?.addEventListener("input", updatePreview));
  ["category", "starts_at"].forEach(name => form[name]?.addEventListener("change", updatePreview));
  document.getElementById("closeAnnouncement").addEventListener("click", close);
  document.getElementById("cancelAnnouncement").addEventListener("click", close);
  document.getElementById("previewAnnouncement").addEventListener("click", () => openAnnouncementPreview(currentPayload()));
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = currentPayload();
    payload.ativo = payload.ativo === "true";
    payload.featured = payload.featured === "true";
    payload.sort_order = Number(payload.sort_order || 10);
    payload.updated_at = new Date().toISOString();
    if (!payload.starts_at) payload.starts_at = null;
    if (!payload.ends_at) payload.ends_at = null;
    if (!row.id) payload.created_by = state.session.user.id;
    const cleanPayload = typeof g3dNormalizePayload === "function" ? g3dNormalizePayload(payload) : payload;
    const query = row.id ? supabaseClient.from("app_announcements").update(cleanPayload).eq("id", row.id) : supabaseClient.from("app_announcements").insert(cleanPayload);
    const result = typeof g3dRunWithFreshSession === "function" ? await g3dRunWithFreshSession(() => query) : await query;
    if (result.error) return showToast(announcementErrorMessage(result.error));
    showToast("Comunicado salvo.");
    close();
    await loadAnnouncements();
    renderPage();
  });
};

renderAnnouncementsAdminCard = renderAnnouncementCommandCenter;

const announcementCommandPreviousRenderAdminPage = renderAdminPage;
renderAdminPage = function renderAdminPageWithCommandCenter(el) {
  announcementCommandPreviousRenderAdminPage(el);
  document.querySelectorAll("[data-preview-announcement]").forEach(button => {
    button.addEventListener("click", () => openAnnouncementPreview((state.cache.announcements || []).find(item => item.id === button.dataset.previewAnnouncement)));
  });
};
