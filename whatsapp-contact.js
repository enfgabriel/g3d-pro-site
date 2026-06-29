function g3dWhatsAppDigits(value = "") {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function g3dWhatsAppUrl(client = {}, message = "") {
  const number = g3dWhatsAppDigits(client.whatsapp || client.telefone || "");
  if (!number) return "";
  const text = encodeURIComponent(message || `Olá, ${clientDisplayName(client)}! Tudo bem?`);
  return `https://wa.me/${number}?text=${text}`;
}

function g3dWhatsAppButton(client = {}, className = "btn whatsapp-btn") {
  const url = g3dWhatsAppUrl(client);
  if (!url) return `<button class="${className}" type="button" disabled>WhatsApp</button>`;
  return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener">WhatsApp</a>`;
}

function renderClientesWithWhatsApp(el) {
  const rows = state.cache.clientes || [];
  el.innerHTML = `
    <div class="page-head">
      <div><h1>Clientes</h1><p class="muted">Cadastro com histórico comercial, financeiro e produção.</p></div>
      <button class="btn primary" id="newClientRecord">Novo cliente</button>
    </div>
    <div class="client-list">
      ${rows.length ? rows.map(client => {
        const stats = clientStats(client);
        return `<article class="card client-card">
          <div class="client-card-main">
            <div>
              <strong>${escapeHtml(clientDisplayName(client))}</strong>
              <span>${escapeHtml(clientContactLine(client) || "Sem contato")}</span>
            </div>
            <span class="badge blue">${stats.orders.length} pedido(s)</span>
          </div>
          <div class="client-card-metrics">
            <div><span>Orçamentos</span><strong>${stats.budgets.length}</strong></div>
            <div><span>Total vendido</span><strong>${money(stats.totalSold)}</strong></div>
            <div><span>A receber</span><strong>${money(stats.pending)}</strong></div>
          </div>
          <div class="actions">
            ${g3dWhatsAppButton(client, "btn whatsapp-btn")}
            <button class="btn primary" data-client-profile="${client.id}">Ficha</button>
            <button class="btn" data-edit-client="${client.id}">Editar</button>
            <button class="btn danger" data-del-client="${client.id}">Excluir</button>
          </div>
        </article>`;
      }).join("") : `<div class="card empty">Nenhum cliente cadastrado ainda.</div>`}
    </div>`;

  document.getElementById("newClientRecord").addEventListener("click", () => openForm(modules.clientes));
  document.querySelectorAll("[data-client-profile]").forEach(btn => btn.addEventListener("click", () => openClientProfile(rows.find(row => row.id === btn.dataset.clientProfile))));
  document.querySelectorAll("[data-edit-client]").forEach(btn => btn.addEventListener("click", () => openForm(modules.clientes, rows.find(row => row.id === btn.dataset.editClient))));
  document.querySelectorAll("[data-del-client]").forEach(btn => btn.addEventListener("click", () => softDelete("clientes", btn.dataset.delClient)));
}

if (typeof renderClientesProfessional === "function") {
  renderClientesProfessional = renderClientesWithWhatsApp;
}

if (typeof openClientProfile === "function") {
  const g3dPreviousOpenClientProfile = openClientProfile;
  openClientProfile = function openClientProfileWithWhatsApp(client = {}) {
    g3dPreviousOpenClientProfile(client);
    const headerActions = document.querySelector(".client-profile-head .actions");
    if (!headerActions || headerActions.querySelector(".whatsapp-btn")) return;
    headerActions.insertAdjacentHTML("afterbegin", g3dWhatsAppButton(client, "btn whatsapp-btn"));
  };
}
