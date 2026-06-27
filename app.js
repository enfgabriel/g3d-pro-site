const SUPABASE_URL = "https://pbsxxgsgqstwscowxshq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InBic3h4Z3NncXN0d3Njb3d4c2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0OTg5OTIsImV4cCI6MjA5ODA3NDk5Mn0.J5C8tVDLKOa8Yo29QrcTCab7Z0GfMC6GCBEU-xudWzQ";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById("app");

const state = {
  session: null,
  page: "dashboard",
  cache: {
    clientes: [],
    estoque: [],
    orcamentos: [],
    pedidos: [],
    producoes: [],
    parametros: null,
    loja: null
  }
};

const navPages = [
  ["dashboard", "Dashboard"],
  ["loja", "Minha loja"],
  ["parametros", "Parâmetros"],
  ["clientes", "Clientes"],
  ["estoque", "Estoque"],
  ["orcamentos", "Orçamentos"],
  ["pedidos", "Pedidos"],
  ["producao", "Produção"]
];

const money = value => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapeHtml = value => String(value ?? "").replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;", "'": "&#39;" })[char]);

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4200);
}

function authMessage(error) {
  const text = String(error?.message || "").toLowerCase();
  if (text.includes("security purposes") || text.includes("only request this after")) return "Por segurança, aguarde cerca de 1 minuto antes de tentar novamente.";
  if (text.includes("invalid login credentials")) return "Email ou senha incorretos.";
  if (text.includes("already registered")) return "Este email já tem uma conta. Use Entrar.";
  if (text.includes("rate limit")) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos.";
  return error?.message || "Não foi possível concluir agora.";
}

async function init() {
  const { data } = await supabaseClient.auth.getSession();
  state.session = data.session;
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    if (session) startApp(); else renderAuth();
  });
  if (state.session) startApp(); else renderAuth();
}

function renderAuth(mode = "login") {
  app.innerHTML = `
    <main class="auth-shell">
      <section class="auth-brand">
        <div class="logo">G3D</div>
        <div>
          <h1>G3D Pro</h1>
          <p>Controle clientes, orçamentos, pedidos, estoque, parâmetros e produção em uma área segura para sua operação de impressão 3D.</p>
        </div>
      </section>
      <section class="auth-card">
        <form class="auth-box" id="authForm">
          <h2>${mode === "signup" ? "Criar conta" : "Entrar"}</h2>
          <p class="muted">${mode === "signup" ? "Use um email válido para criar seu acesso." : "Acesse sua área de gestão."}</p>
          <div class="field"><label>Email</label><input type="email" id="authEmail" required autocomplete="email" /></div>
          <div class="field"><label>Senha</label><input type="password" id="authPassword" required autocomplete="${mode === "signup" ? "new-password" : "current-password"}" /></div>
          <button class="btn primary full" type="submit" id="authSubmit">${mode === "signup" ? "Cadastrar" : "Entrar"}</button>
          <p><button class="btn link" type="button" id="toggleAuth">${mode === "signup" ? "Já tenho conta" : "Criar uma conta"}</button></p>
        </form>
      </section>
    </main>`;

  document.getElementById("toggleAuth").addEventListener("click", () => renderAuth(mode === "signup" ? "login" : "signup"));
  document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = document.getElementById("authSubmit");
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Aguarde...";
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const result = mode === "signup"
      ? await supabaseClient.auth.signUp({ email, password })
      : await supabaseClient.auth.signInWithPassword({ email, password });
    if (result.error) showToast(authMessage(result.error));
    else showToast(mode === "signup" ? "Cadastro criado." : "Bem-vindo.");
    button.disabled = false;
    button.textContent = label;
  });
}

async function startApp() {
  renderApp();
  await loadAll();
}

function renderApp() {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="logo-row"><div class="logo">G3D</div><div class="brand"><strong>G3D Pro</strong><span>ERP Impressão 3D</span></div></div>
        <div class="nav-title">Principal</div>
        ${navPages.map(([id, label]) => `<button class="nav-btn ${state.page === id ? "active" : ""}" data-page="${id}">${label}</button>`).join("")}
      </aside>
      <main class="main">
        <header class="topbar"><div><strong>${escapeHtml(state.session?.user?.email || "")}</strong><div class="muted">Sessão protegida</div></div><button class="btn" id="logoutBtn">Sair</button></header>
        <section class="content" id="content"></section>
      </main>
    </div>`;
  document.querySelectorAll(".nav-btn").forEach(button => button.addEventListener("click", () => { state.page = button.dataset.page; renderApp(); renderPage(); }));
  document.getElementById("logoutBtn").addEventListener("click", () => supabaseClient.auth.signOut());
  renderPage();
}

async function loadAll() {
  await Promise.all([
    loadTable("clientes"), loadTable("estoque"), loadTable("orcamentos"), loadTable("pedidos"), loadTable("producoes"), loadSingle("parametros_precificacao", "parametros"), loadSingle("loja_perfis", "loja")
  ]);
  renderPage();
}

async function loadTable(table) {
  const { data, error } = await supabaseClient.from(table).select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (!error) state.cache[table] = data || [];
}

async function loadSingle(table, key) {
  const { data, error } = await supabaseClient.from(table).select("*").maybeSingle();
  if (!error) state.cache[key] = data || null;
}

function renderPage() {
  const el = document.getElementById("content");
  if (!el) return;
  if (state.page === "dashboard") return renderDashboard(el);
  if (state.page === "loja") return renderLoja(el);
  if (state.page === "parametros") return renderParametros(el);
  if (state.page === "clientes") return renderCrud(el, modules.clientes);
  if (state.page === "estoque") return renderCrud(el, modules.estoque);
  if (state.page === "orcamentos") return renderOrcamentos(el);
  if (state.page === "pedidos") return renderCrud(el, modules.pedidos);
  if (state.page === "producao") return renderCrud(el, modules.producoes);
}

function renderDashboard(el) {
  const receita = state.cache.pedidos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const critico = state.cache.estoque.filter(item => Number(item.quantidade || 0) <= Number(item.quantidade_minima || 0) && Number(item.quantidade_minima || 0) > 0);
  el.innerHTML = `
    <div class="page-head"><div><h1>Dashboard</h1><p class="muted">Visão geral do negócio</p></div></div>
    <div class="grid stats">
      <div class="stat"><span>Clientes</span><strong>${state.cache.clientes.length}</strong></div>
      <div class="stat"><span>Orçamentos</span><strong>${state.cache.orcamentos.length}</strong></div>
      <div class="stat"><span>Pedidos</span><strong>${state.cache.pedidos.length}</strong></div>
      <div class="stat"><span>Receita registrada</span><strong>${money(receita)}</strong></div>
    </div>
    <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); margin-top: 14px;">
      <div class="card"><h3>Central de notícias</h3><p class="muted">Área reservada para comunicados, atualizações e parceiros do G3D Pro.</p></div>
      <div class="card"><h3>Estoque crítico</h3><p class="muted">${critico.length ? critico.map(item => escapeHtml(item.nome)).join(", ") : "Nenhum item crítico."}</p></div>
    </div>`;
}

function renderLoja(el) {
  const row = state.cache.loja || {};
  const fields = ["nome_loja:Nome da loja", "responsavel:Responsável", "documento:CNPJ ou CPF", "whatsapp:WhatsApp", "email:Email", "site:Site ou Instagram", "cidade:Cidade", "estado:Estado", "endereco:Endereço", "observacao_padrao:Observação padrão"];
  renderSimpleForm(el, "Minha loja", "Personalização usada nos orçamentos e documentos.", fields, row, async payload => {
    payload.user_id = state.session.user.id;
    payload.updated_at = new Date().toISOString();
    const { error } = await supabaseClient.from("loja_perfis").upsert(payload, { onConflict: "user_id" });
    if (error) return showToast(error.message);
    showToast("Personalização salva.");
    await loadSingle("loja_perfis", "loja");
    renderPage();
  });
}

function renderParametros(el) {
  const row = state.cache.parametros || defaultParams();
  const fields = ["custo_kwh:Custo kWh", "consumo_kw_hora:Consumo kW/h", "custo_hora_maquina:Custo hora máquina", "custo_grama_padrao:Custo padrão por grama", "margem_percentual:Margem %", "taxa_minima:Taxa mínima", "pos_processamento_hora:Hora pós-processamento", "embalagem_padrao:Embalagem padrão"];
  renderSimpleForm(el, "Parâmetros", "Base de cálculo para orçamentos.", fields, row, async payload => {
    Object.keys(payload).forEach(key => payload[key] = Number(payload[key] || 0));
    payload.user_id = state.session.user.id;
    payload.updated_at = new Date().toISOString();
    const { error } = await supabaseClient.from("parametros_precificacao").upsert(payload, { onConflict: "user_id" });
    if (error) return showToast(error.message);
    showToast("Parâmetros salvos.");
    await loadSingle("parametros_precificacao", "parametros");
    renderPage();
  }, "number");
}

function renderSimpleForm(el, title, subtitle, fields, row, onSave, type = "text") {
  el.innerHTML = `<div class="page-head"><div><h1>${title}</h1><p class="muted">${subtitle}</p></div></div><form class="card" id="simpleForm"><div class="form-grid">${fields.map(item => {
    const [key, label] = item.split(":");
    const isLong = ["endereco", "observacao_padrao"].includes(key);
    return `<div class="field ${isLong ? "span-2" : ""}"><label>${label}</label>${isLong ? `<textarea name="${key}">${escapeHtml(row[key] || "")}</textarea>` : `<input type="${type}" step="0.01" name="${key}" value="${escapeHtml(row[key] ?? "")}" />`}</div>`;
  }).join("")}</div><div class="modal-foot"><button class="btn primary" type="submit">Salvar</button></div></form>`;
  document.getElementById("simpleForm").addEventListener("submit", event => {
    event.preventDefault();
    onSave(Object.fromEntries(new FormData(event.currentTarget).entries()));
  });
}

const modules = {
  clientes: { table: "clientes", title: "Clientes", singular: "cliente", columns: ["nome", "cpf_cnpj", "telefone", "email", "cidade"], fields: ["nome:Nome:required", "empresa:Empresa", "cpf_cnpj:CPF/CNPJ", "email:Email:email", "telefone:Telefone", "whatsapp:WhatsApp", "cidade:Cidade", "estado:Estado", "endereco:Endereço:textarea", "observacao:Observações:textarea"] },
  estoque: { table: "estoque", title: "Estoque", singular: "item", columns: ["nome", "material", "cor", "quantidade", "custo_grama"], fields: ["nome:Nome:required", "categoria:Categoria", "material:Material", "cor:Cor", "marca:Marca", "local:Local", "quantidade:Quantidade:number", "quantidade_minima:Quantidade mínima:number", "custo_grama:Custo por g/ml:number", "valor_atual:Valor atual:number"] },
  pedidos: { table: "pedidos", title: "Pedidos", singular: "pedido", columns: ["numero", "titulo", "status", "data_entrega", "valor"], fields: ["numero:Número", "titulo:Título:required", "status:Status", "prioridade:Prioridade", "valor:Valor:number", "data_entrega:Data de entrega:date", "observacao:Observações:textarea"] },
  producoes: { table: "producoes", title: "Produção", singular: "produção", columns: ["titulo", "status", "impressora", "material", "peso_g", "tempo_horas"], fields: ["titulo:Título:required", "status:Status", "impressora:Impressora", "material:Material", "cor:Cor", "peso_g:Peso g/ml:number", "tempo_horas:Tempo horas:number", "data_prevista:Data prevista:date", "observacao:Observações:textarea"] }
};

function renderCrud(el, module) {
  const rows = state.cache[module.table] || [];
  el.innerHTML = `<div class="page-head"><div><h1>${module.title}</h1><p class="muted">${rows.length} registros</p></div><button class="btn primary" id="newRecord">Novo</button></div><div class="table-wrap"><table><thead><tr>${module.columns.map(c => `<th>${labelize(c)}</th>`).join("")}<th></th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${module.columns.map(c => `<td>${formatCell(c, row[c])}</td>`).join("")}<td><div class="actions"><button class="btn" data-edit="${row.id}">Editar</button><button class="btn danger" data-del="${row.id}">Excluir</button></div></td></tr>`).join("") : `<tr><td colspan="${module.columns.length + 1}" class="empty">Nenhum registro ainda.</td></tr>`}</tbody></table></div>`;
  document.getElementById("newRecord").addEventListener("click", () => openForm(module));
  document.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => openForm(module, rows.find(row => row.id === btn.dataset.edit))));
  document.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", () => softDelete(module.table, btn.dataset.del)));
}

function openForm(module, row = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<form class="modal" id="recordForm"><div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} ${module.singular}</strong><button class="btn" type="button" id="closeModal">Fechar</button></div><div class="modal-body"><div class="form-grid">${module.fields.map(fieldHtml(row)).join("")}</div></div><div class="modal-foot"><button class="btn" type="button" id="cancelModal">Cancelar</button><button class="btn primary" type="submit">Salvar</button></div></form>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  document.getElementById("closeModal").addEventListener("click", close);
  document.getElementById("cancelModal").addEventListener("click", close);
  document.getElementById("recordForm").addEventListener("submit", async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
    module.fields.forEach(spec => { const [key,, kind] = spec.split(":"); if (kind === "number") payload[key] = Number(payload[key] || 0); });
    await saveRecord(module.table, payload, row.id);
    close();
  });
}

function fieldHtml(row) {
  return spec => {
    const [key, label, kind] = spec.split(":");
    const type = ["number", "date", "email"].includes(kind) ? kind : "text";
    const required = kind === "required" ? "required" : "";
    const value = escapeHtml(row[key] ?? "");
    if (kind === "textarea") return `<div class="field span-2"><label>${label}</label><textarea name="${key}">${value}</textarea></div>`;
    return `<div class="field"><label>${label}</label><input type="${type}" step="0.01" name="${key}" value="${value}" ${required} /></div>`;
  };
}

function renderOrcamentos(el) {
  const rows = state.cache.orcamentos || [];
  el.innerHTML = `<div class="page-head"><div><h1>Orçamentos</h1><p class="muted">Orçamentos com cálculo por peso, tempo e parâmetros.</p></div><button class="btn primary" id="newBudget">Novo orçamento</button></div><div class="table-wrap"><table><thead><tr><th>Número</th><th>Projeto</th><th>Status</th><th>Total</th><th></th></tr></thead><tbody>${rows.length ? rows.map(row => `<tr><td>${escapeHtml(row.numero || "")}</td><td>${escapeHtml(row.projeto || "")}</td><td><span class="badge blue">${escapeHtml(row.status || "rascunho")}</span></td><td>${money(row.total)}</td><td><div class="actions"><button class="btn" data-edit-budget="${row.id}">Editar</button><button class="btn" data-pdf-budget="${row.id}">PDF</button><button class="btn danger" data-del-budget="${row.id}">Excluir</button></div></td></tr>`).join("") : `<tr><td colspan="5" class="empty">Nenhum orçamento ainda.</td></tr>`}</tbody></table></div>`;
  document.getElementById("newBudget").addEventListener("click", () => openBudgetForm());
  document.querySelectorAll("[data-edit-budget]").forEach(btn => btn.addEventListener("click", () => openBudgetForm(rows.find(row => row.id === btn.dataset.editBudget))));
  document.querySelectorAll("[data-del-budget]").forEach(btn => btn.addEventListener("click", () => softDelete("orcamentos", btn.dataset.delBudget)));
  document.querySelectorAll("[data-pdf-budget]").forEach(btn => btn.addEventListener("click", () => openBudgetPdf(rows.find(row => row.id === btn.dataset.pdfBudget))));
}

function openBudgetForm(row = {}) {
  const value = Number(row.total || calculatePrice(row)).toFixed(2);
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<form class="modal" id="budgetForm"><div class="modal-head"><strong>${row.id ? "Editar" : "Novo"} orçamento</strong><button class="btn" type="button" id="closeBudget">Fechar</button></div><div class="modal-body"><div class="form-grid">
    <div class="field"><label>Número</label><input name="numero" value="${escapeHtml(row.numero || nextNumber("ORC", state.cache.orcamentos.length))}" /></div>
    <div class="field"><label>Status</label><input name="status" value="${escapeHtml(row.status || "rascunho")}" /></div>
    <div class="field span-2"><label>Projeto</label><input name="projeto" value="${escapeHtml(row.projeto || "")}" required /></div>
    <div class="field"><label>Material</label><input name="material" value="${escapeHtml(row.material || "PLA")}" /></div>
    <div class="field"><label>Cor</label><input name="cor" value="${escapeHtml(row.cor || "Preto")}" /></div>
    <div class="field"><label>Peso g/ml</label><input type="number" step="0.01" name="peso_g" value="${escapeHtml(row.peso_g || 0)}" /></div>
    <div class="field"><label>Tempo h</label><input type="number" step="0.01" name="horas" value="${escapeHtml(row.horas || 0)}" /></div>
    <div class="field"><label>Pós-processamento h</label><input type="number" step="0.01" name="pos_horas" value="${escapeHtml(row.pos_horas || 0)}" /></div>
    <div class="field"><label>Total</label><input type="number" step="0.01" name="total" value="${escapeHtml(value)}" /></div>
    <div class="calc-box span-2" id="calcBox">Preencha peso e tempo para calcular automaticamente.</div>
    <div class="field span-2"><label>Observações</label><textarea name="observacao">${escapeHtml(row.observacao || "")}</textarea></div>
  </div></div><div class="modal-foot"><button class="btn" type="button" id="cancelBudget">Cancelar</button><button class="btn primary" type="submit">Salvar orçamento</button></div></form>`;
  document.body.appendChild(backdrop);
  const form = document.getElementById("budgetForm");
  const close = () => backdrop.remove();
  const recalc = () => { const payload = Object.fromEntries(new FormData(form).entries()); const price = calculatePrice(payload); form.total.value = price.toFixed(2); document.getElementById("calcBox").textContent = `Valor sugerido: ${money(price)} com base nos parâmetros salvos.`; };
  ["peso_g", "horas", "pos_horas"].forEach(name => form[name].addEventListener("input", recalc));
  document.getElementById("closeBudget").addEventListener("click", close);
  document.getElementById("cancelBudget").addEventListener("click", close);
  form.addEventListener("submit", async event => { event.preventDefault(); const payload = Object.fromEntries(new FormData(form).entries()); ["peso_g", "horas", "pos_horas", "total"].forEach(k => payload[k] = Number(payload[k] || 0)); await saveRecord("orcamentos", payload, row.id); close(); });
  recalc();
}

function defaultParams() { return { custo_kwh: .95, consumo_kw_hora: .12, custo_hora_maquina: 8, custo_grama_padrao: .12, margem_percentual: 40, taxa_minima: 20, pos_processamento_hora: 25, embalagem_padrao: 3 }; }
function calculatePrice(item) { const p = state.cache.parametros || defaultParams(); const material = Number(item.peso_g || 0) * Number(p.custo_grama_padrao || 0); const energia = Number(item.horas || 0) * Number(p.consumo_kw_hora || 0) * Number(p.custo_kwh || 0); const maquina = Number(item.horas || 0) * Number(p.custo_hora_maquina || 0); const pos = Number(item.pos_horas || 0) * Number(p.pos_processamento_hora || 0); const base = material + energia + maquina + pos + Number(p.embalagem_padrao || 0); const total = base * (1 + Number(p.margem_percentual || 0) / 100); return Math.max(Number(p.taxa_minima || 0), total); }
function nextNumber(prefix, count) { return `${prefix}-${String(count + 1).padStart(4, "0")}`; }
function labelize(key) { return key.replace(/_/g, " "); }
function formatCell(key, value) { return key.includes("valor") || key.includes("custo") ? money(value) : escapeHtml(value ?? ""); }

async function saveRecord(table, payload, id) {
  const query = id ? supabaseClient.from(table).update(payload).eq("id", id) : supabaseClient.from(table).insert(payload);
  const { error } = await query;
  if (error) return showToast(error.message);
  showToast("Registro salvo.");
  await loadTable(table);
  if (table === "orcamentos") state.page = "orcamentos";
  renderPage();
}

async function softDelete(table, id) {
  const { error } = await supabaseClient.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return showToast(error.message);
  showToast("Registro removido.");
  await loadTable(table);
  renderPage();
}

function openBudgetPdf(row) {
  if (!row) return;
  const profile = state.cache.loja || {};
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir o orçamento.");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(row.numero || "Orçamento")}</title><style>body{font-family:Arial;margin:0;background:#e8edf3;color:#17202a}.page{max-width:820px;margin:0 auto;background:white;min-height:100vh;padding:42px}.top{border-bottom:3px solid #111827;padding-bottom:18px;margin-bottom:24px}h1,h2,p{margin:0 0 8px}.muted{color:#667085}.total{font-size:24px;font-weight:700;text-align:right;margin-top:28px}.actions{position:sticky;top:0;background:#111827;padding:10px;text-align:center}.actions button{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer}.primary{background:#24d982}@media print{.actions{display:none}.page{max-width:none}}</style></head><body><div class="actions"><button class="primary" onclick="window.print()">Salvar como PDF</button></div><main class="page"><section class="top"><h1>${escapeHtml(profile.nome_loja || "G3D Pro")}</h1><p class="muted">${escapeHtml([profile.documento, profile.whatsapp, profile.email].filter(Boolean).join(" | "))}</p></section><h2>Orçamento ${escapeHtml(row.numero || "")}</h2><p><strong>Projeto:</strong> ${escapeHtml(row.projeto || "")}</p><p><strong>Material:</strong> ${escapeHtml([row.material, row.cor].filter(Boolean).join(" - "))}</p><p><strong>Peso:</strong> ${escapeHtml(row.peso_g || 0)} g/ml</p><p><strong>Tempo:</strong> ${escapeHtml(row.horas || 0)} h</p><p class="muted">${escapeHtml(row.observacao || "")}</p><div class="total">Total: ${money(row.total)}</div><p class="muted">Pagamento combinado diretamente no PDV da máquina de cartão ou no meio escolhido com o cliente.</p></main></body></html>`);
  win.document.close();
}

init();