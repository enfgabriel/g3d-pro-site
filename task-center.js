const G3D_TASK_KEY = "g3d.tasks.v1";
const G3D_TASK_STATUS = {
  aberta: { label: "Aberta", className: "blue" },
  andamento: { label: "Em andamento", className: "warn" },
  concluida: { label: "Concluída", className: "good" }
};
const G3D_TASK_PRIORITIES = {
  alta: { label: "Alta", className: "danger", weight: 0 },
  media: { label: "Média", className: "warn", weight: 1 },
  baixa: { label: "Baixa", className: "blue", weight: 2 }
};
const G3D_TASK_CATEGORIES = ["Operação", "Cliente", "Compra", "Financeiro", "Produção", "Marketing", "Sistema", "Outro"];

function taskStorageKey() {
  return `${G3D_TASK_KEY}.${state.session?.user?.id || "anon"}`;
}

function taskLoadAll() {
  try {
    const rows = JSON.parse(localStorage.getItem(taskStorageKey()) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch (_error) {
    return [];
  }
}

function taskSaveAll(rows) {
  localStorage.setItem(taskStorageKey(), JSON.stringify(rows));
}

function taskId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function taskDateInput(value) {
  const date = agendaDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function taskCategoryOptions(current = "") {
  const normalized = String(current || "Operação");
  return G3D_TASK_CATEGORIES.map(item => `<option value="${escapeHtml(item)}" ${item === normalized ? "selected" : ""}>${escapeHtml(item)}</option>`).join("");
}

function taskPriorityInfo(value = "media") {
  return G3D_TASK_PRIORITIES[value] || G3D_TASK_PRIORITIES.media;
}

function taskStatusInfo(value = "aberta") {
  return G3D_TASK_STATUS[value] || G3D_TASK_STATUS.aberta;
}

function taskDueInfo(row) {
  const date = agendaDate(row.prazo);
  const days = agendaDaysUntil(date);
  return { date, days, status: agendaStatus(days) };
}

function taskOpenRows() {
  return taskLoadAll().filter(row => row.status !== "concluida");
}

function taskStats(rows) {
  const open = rows.filter(row => row.status === "aberta").length;
  const running = rows.filter(row => row.status === "andamento").length;
  const done = rows.filter(row => row.status === "concluida").length;
  const late = rows.filter(row => row.status !== "concluida" && taskDueInfo(row).days < 0).length;
  return { total: rows.length, open, running, done, late };
}

function taskSummaryHtml(rows) {
  const stats = taskStats(rows);
  return `
    <section class="grid task-summary">
      <div class="stat"><span>Total</span><strong>${stats.total}</strong></div>
      <div class="stat"><span>Abertas</span><strong>${stats.open}</strong></div>
      <div class="stat"><span>Em andamento</span><strong>${stats.running}</strong></div>
      <div class="stat"><span>Atrasadas</span><strong>${stats.late}</strong></div>
    </section>`;
}

function taskCardHtml(row) {
  const due = taskDueInfo(row);
  const status = taskStatusInfo(row.status);
  const priority = taskPriorityInfo(row.prioridade);
  return `
    <article class="task-card ${due.status.className}">
      <div class="task-card-head">
        <span class="badge ${status.className}">${escapeHtml(status.label)}</span>
        <span class="badge ${priority.className}">${escapeHtml(priority.label)}</span>
      </div>
      <h3>${escapeHtml(row.titulo || "Tarefa")}</h3>
      <p class="muted small">${escapeHtml(row.observacao || "Sem observação.")}</p>
      <div class="task-meta">
        <span>${escapeHtml(row.categoria || "Operação")}</span>
        <span>${escapeHtml(due.date ? agendaDateLabel(due.date) : "Sem prazo")}</span>
        <span>${escapeHtml(due.status.label)}</span>
      </div>
      <div class="actions task-actions">
        ${row.status !== "concluida" ? `<button class="btn primary" data-task-done="${row.id}">Concluir</button>` : `<button class="btn" data-task-reopen="${row.id}">Reabrir</button>`}
        <button class="btn" data-task-edit="${row.id}">Editar</button>
        <button class="btn danger" data-task-delete="${row.id}">Excluir</button>
      </div>
    </article>`;
}

function renderTasks(el) {
  const rows = taskLoadAll().sort((a, b) => {
    const aDue = taskDueInfo(a).date?.getTime() || Number.MAX_SAFE_INTEGER;
    const bDue = taskDueInfo(b).date?.getTime() || Number.MAX_SAFE_INTEGER;
    return (a.status === "concluida") - (b.status === "concluida") || aDue - bDue || taskPriorityInfo(a.prioridade).weight - taskPriorityInfo(b.prioridade).weight;
  });
  const groups = ["aberta", "andamento", "concluida"];
  el.innerHTML = `
    <div class="page-head task-head">
      <div><h1>Tarefas</h1><p class="muted">Lembretes manuais para rotina, clientes, compras, financeiro e produção.</p></div>
      <button class="btn primary" id="newTask">Nova tarefa</button>
    </div>
    ${taskSummaryHtml(rows)}
    <section class="task-board">
      ${groups.map(status => {
        const groupRows = rows.filter(row => (row.status || "aberta") === status);
        return `<div class="card task-column">
          <div class="section-head"><div><h2>${escapeHtml(taskStatusInfo(status).label)}</h2><p class="muted">${groupRows.length} tarefa(s)</p></div></div>
          <div class="task-list">${groupRows.length ? groupRows.map(taskCardHtml).join("") : `<div class="dashboard-empty">Nada por aqui.</div>`}</div>
        </div>`;
      }).join("")}
    </section>`;

  document.getElementById("newTask")?.addEventListener("click", () => openTaskForm());
  document.querySelectorAll("[data-task-edit]").forEach(button => button.addEventListener("click", () => openTaskForm(rows.find(row => row.id === button.dataset.taskEdit))));
  document.querySelectorAll("[data-task-delete]").forEach(button => button.addEventListener("click", () => deleteTask(button.dataset.taskDelete)));
  document.querySelectorAll("[data-task-done]").forEach(button => button.addEventListener("click", () => updateTaskStatus(button.dataset.taskDone, "concluida")));
  document.querySelectorAll("[data-task-reopen]").forEach(button => button.addEventListener("click", () => updateTaskStatus(button.dataset.taskReopen, "aberta")));
}

function openTaskForm(row = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal task-modal" id="taskForm">
      <div class="modal-head"><strong>${row.id ? "Editar" : "Nova"} tarefa</strong><button class="btn" type="button" id="closeTask">Fechar</button></div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field span-2"><label>Título</label><input name="titulo" value="${escapeHtml(row.titulo || "")}" required placeholder="Ex.: Comprar PLA preto, ligar para cliente, revisar orçamento" /></div>
          <div class="field"><label>Status</label><select name="status">${Object.entries(G3D_TASK_STATUS).map(([value, info]) => `<option value="${value}" ${value === (row.status || "aberta") ? "selected" : ""}>${escapeHtml(info.label)}</option>`).join("")}</select></div>
          <div class="field"><label>Prioridade</label><select name="prioridade">${Object.entries(G3D_TASK_PRIORITIES).map(([value, info]) => `<option value="${value}" ${value === (row.prioridade || "media") ? "selected" : ""}>${escapeHtml(info.label)}</option>`).join("")}</select></div>
          <div class="field"><label>Categoria</label><select name="categoria">${taskCategoryOptions(row.categoria || "Operação")}</select></div>
          <div class="field"><label>Prazo</label><input type="date" name="prazo" value="${escapeHtml(taskDateInput(row.prazo))}" /></div>
          <div class="field span-2"><label>Observação</label><textarea name="observacao">${escapeHtml(row.observacao || "")}</textarea></div>
        </div>
      </div>
      <div class="modal-foot"><button class="btn" type="button" id="cancelTask">Cancelar</button><button class="btn primary" type="submit">Salvar tarefa</button></div>
    </form>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closeTask").addEventListener("click", close);
  document.getElementById("cancelTask").addEventListener("click", close);
  document.getElementById("taskForm").addEventListener("submit", event => {
    event.preventDefault();
    saveTask(Object.fromEntries(new FormData(event.currentTarget).entries()), row.id);
    close();
  });
}

function saveTask(payload, id = "") {
  const rows = taskLoadAll();
  const now = new Date().toISOString();
  const clean = {
    id: id || taskId(),
    titulo: payload.titulo || "Tarefa",
    status: payload.status || "aberta",
    prioridade: payload.prioridade || "media",
    categoria: payload.categoria || "Operação",
    prazo: payload.prazo || "",
    observacao: payload.observacao || "",
    created_at: rows.find(row => row.id === id)?.created_at || now,
    updated_at: now,
    done_at: payload.status === "concluida" ? (rows.find(row => row.id === id)?.done_at || now) : ""
  };
  const next = id ? rows.map(row => row.id === id ? clean : row) : [clean, ...rows];
  taskSaveAll(next);
  showToast("Tarefa salva.");
  renderPage();
}

function updateTaskStatus(id, status) {
  const rows = taskLoadAll();
  const now = new Date().toISOString();
  taskSaveAll(rows.map(row => row.id === id ? { ...row, status, updated_at: now, done_at: status === "concluida" ? now : "" } : row));
  showToast(status === "concluida" ? "Tarefa concluída." : "Tarefa reaberta.");
  renderPage();
}

function deleteTask(id) {
  taskSaveAll(taskLoadAll().filter(row => row.id !== id));
  showToast("Tarefa removida.");
  renderPage();
}

function ensureTaskNav() {
  if (!navPages.some(([id]) => id === "tarefas")) {
    const agendaIndex = navPages.findIndex(([id]) => id === "agenda");
    navPages.splice(agendaIndex >= 0 ? agendaIndex + 1 : 1, 0, ["tarefas", "Tarefas"]);
  }
}

function taskDashboardPanelHtml() {
  const rows = taskOpenRows().sort((a, b) => (taskDueInfo(a).date?.getTime() || Number.MAX_SAFE_INTEGER) - (taskDueInfo(b).date?.getTime() || Number.MAX_SAFE_INTEGER)).slice(0, 4);
  const stats = taskStats(taskLoadAll());
  return `
    <section class="card task-dashboard-panel" id="taskDashboardPanel">
      <div class="section-head">
        <div><h2>Tarefas rápidas</h2><p class="muted">${stats.open + stats.running ? `${stats.open + stats.running} tarefa(s) abertas.` : "Nada pendente no momento."}</p></div>
        <button class="btn" data-task-page="tarefas">Abrir</button>
      </div>
      <div class="task-mini-stats">
        <span class="badge ${stats.late ? "danger" : "good"}">${stats.late} atrasada(s)</span>
        <span class="badge blue">${stats.open} abertas</span>
        <span class="badge warn">${stats.running} em andamento</span>
      </div>
      <div class="task-list compact">${rows.length ? rows.map(taskCardHtml).join("") : `<div class="dashboard-empty">Nenhuma tarefa manual pendente.</div>`}</div>
    </section>`;
}

function attachTaskNavigation(root = document) {
  root.querySelectorAll("[data-task-page]").forEach(button => button.addEventListener("click", () => {
    state.page = button.dataset.taskPage;
    renderApp();
    renderPage();
  }));
}

ensureTaskNav();
if (Array.isArray(G3D_AGENDA_FILTERS) && !G3D_AGENDA_FILTERS.some(([id]) => id === "tarefa")) G3D_AGENDA_FILTERS.push(["tarefa", "Tarefas"]);

const taskPreviousAgendaTypeLabel = agendaTypeLabel;
agendaTypeLabel = function agendaTypeLabelWithTasks(type) {
  if (type === "tarefa") return "Tarefa";
  return taskPreviousAgendaTypeLabel(type);
};

const taskPreviousAgendaTypeBadge = agendaTypeBadge;
agendaTypeBadge = function agendaTypeBadgeWithTasks(type) {
  if (type === "tarefa") return "blue";
  return taskPreviousAgendaTypeBadge(type);
};

const taskPreviousBuildAgendaItems = buildAgendaItems;
buildAgendaItems = function buildAgendaItemsWithTasks() {
  const items = taskPreviousBuildAgendaItems();
  taskOpenRows().forEach(row => {
    const date = agendaDate(row.prazo);
    if (!date) return;
    items.push(agendaItem({
      id: `tarefa-${row.id}`,
      type: "tarefa",
      date,
      title: row.titulo || "Tarefa",
      detail: `${row.categoria || "Operação"} · Prioridade ${taskPriorityInfo(row.prioridade).label}`,
      page: "tarefas",
      source: row,
      priority: taskPriorityInfo(row.prioridade).weight,
      action: "Ver tarefa"
    }));
  });
  return items.sort((a, b) => a.date - b.date || a.priority - b.priority || String(a.title).localeCompare(String(b.title)));
};

const taskPreviousRenderApp = renderApp;
renderApp = function renderAppWithTasks() {
  ensureTaskNav();
  taskPreviousRenderApp();
};

const taskPreviousRenderPage = renderPage;
renderPage = function renderPageWithTasks() {
  if (state.page === "tarefas") {
    const el = document.getElementById("content");
    if (!el) return;
    return renderTasks(el);
  }
  return taskPreviousRenderPage();
};

if (typeof renderDashboardPro === "function") {
  const taskPreviousRenderDashboardPro = renderDashboardPro;
  renderDashboardPro = function renderDashboardProWithTasks(el) {
    taskPreviousRenderDashboardPro(el);
    if (!el.querySelector("#taskDashboardPanel")) {
      const anchor = el.querySelector("#agendaDashboardPanel") || el.querySelector("#alertsDashboardPanel") || el.querySelector(".dashboard-grid") || el.firstElementChild;
      const wrapper = document.createElement("div");
      wrapper.innerHTML = taskDashboardPanelHtml();
      if (anchor) anchor.insertAdjacentElement("afterend", wrapper.firstElementChild);
      else el.prepend(wrapper.firstElementChild);
      attachTaskNavigation(el);
    }
  };
}
