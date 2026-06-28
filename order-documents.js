function orderDocumentDate(value = new Date()) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR");
}

function orderDocumentSafe(value) {
  return escapeHtml(value || "");
}

function orderDocumentPaymentMethod(value) {
  const methods = {
    cartao: "Cartão",
    pix: "Pix manual",
    dinheiro: "Dinheiro",
    transferencia: "Transferência",
    boleto: "Boleto",
    outro: "Outro"
  };
  return methods[String(value || "").toLowerCase()] || "Não informado";
}

function orderDocumentClient(order) {
  if (typeof orderClient === "function") return orderClient(order);
  if (!order?.cliente_id) return null;
  return (state.cache.clientes || []).find(client => client.id === order.cliente_id) || null;
}

function orderDocumentProduction(order) {
  if (typeof productionForOrder === "function") return productionForOrder(order);
  if (!order?.id) return null;
  return (state.cache.producoes || []).find(item => item.pedido_id === order.id || item.id === order.producao_id) || null;
}

function orderDocumentBudget(order) {
  if (!order?.orcamento_id) return null;
  return (state.cache.orcamentos || []).find(item => item.id === order.orcamento_id) || null;
}

function orderDocumentStatus(row) {
  if (typeof financeStatusInfo === "function") return financeStatusInfo(row);
  return { label: row.status_pagamento || "Pendente", className: "warn" };
}

function orderDocumentTotal(row) {
  return typeof financeOrderTotal === "function" ? financeOrderTotal(row) : Number(row.valor || row.total || 0);
}

function orderDocumentPaid(row) {
  return typeof financePaid === "function" ? financePaid(row) : Number(row.valor_pago || 0);
}

function orderDocumentRemaining(row) {
  return typeof financeRemaining === "function" ? financeRemaining(row) : Math.max(0, orderDocumentTotal(row) - orderDocumentPaid(row));
}

function orderDocumentGrid(items) {
  return items.map(([label, value]) => `<div><span>${orderDocumentSafe(label)}</span><strong>${orderDocumentSafe(value)}</strong></div>`).join("");
}

function orderDocumentMoneyRow(label, value, strong = false) {
  return `<div class="doc-money-row ${strong ? "strong" : ""}"><span>${orderDocumentSafe(label)}</span><strong>${money(value)}</strong></div>`;
}

function orderDocumentClientBlock(client) {
  if (!client) return `<section class="doc-box"><h3>Cliente</h3><p class="muted">Cliente não vinculado.</p></section>`;
  return `
    <section class="doc-box">
      <h3>Cliente</h3>
      <p><strong>${orderDocumentSafe(client.nome || client.empresa || "")}</strong></p>
      <p class="muted">${orderDocumentSafe([client.cpf_cnpj, client.email, client.telefone, client.whatsapp].filter(Boolean).join(" | "))}</p>
      <p class="muted">${orderDocumentSafe([client.endereco, client.cidade, client.estado].filter(Boolean).join(" - "))}</p>
    </section>`;
}

function orderDocumentStoreBlock(profile) {
  const contact = [profile.documento, profile.whatsapp, profile.email, profile.site].filter(Boolean).join(" | ");
  const address = [profile.endereco, profile.cidade, profile.estado].filter(Boolean).join(" - ");
  return `
    <section class="doc-header">
      <div>
        <h1>${orderDocumentSafe(profile.nome_loja || "G3D Pro")}</h1>
        <p>${orderDocumentSafe(profile.responsavel || "Gestão de impressão 3D")}</p>
        <p class="muted">${orderDocumentSafe(contact)}</p>
        <p class="muted">${orderDocumentSafe(address)}</p>
      </div>
      <div class="doc-logo">${profile.logo_url ? `<img src="${orderDocumentSafe(profile.logo_url)}" alt="Logo">` : "G3D"}</div>
    </section>`;
}

async function openOrderReceiptPdf(order) {
  if (!order) return;
  const win = window.open("", "_blank");
  if (!win) return showToast("Permita pop-ups para abrir o recibo.");
  win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando recibo</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:Arial;background:#101820;color:white}.box{padding:24px;text-align:center}.box strong{display:block;margin-bottom:8px;color:#24d982}</style></head><body><div class="box"><strong>G3D Pro</strong><span>Preparando pedido/recibo...</span></div></body></html>`);
  win.document.close();

  const profileBase = typeof budgetProfileDefaults === "function" ? budgetProfileDefaults(state.cache.loja || {}) : (state.cache.loja || {});
  const logoSource = profileBase.logo_path || profileBase.logo_url || state.cache.loja?.logo_path || state.cache.loja?.logo_url || "";
  const logoUrl = typeof g3dAssetUrl === "function" ? await g3dAssetUrl(logoSource) : profileBase.logo_url;
  const profile = { ...profileBase, logo_url: logoUrl || profileBase.logo_url || "" };
  const client = orderDocumentClient(order);
  const production = orderDocumentProduction(order);
  const budget = orderDocumentBudget(order);
  const pay = orderDocumentStatus(order);
  const total = orderDocumentTotal(order);
  const paid = orderDocumentPaid(order);
  const remaining = orderDocumentRemaining(order);
  const now = new Date();

  win.document.open();
  win.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${orderDocumentSafe(order.numero || "Pedido")}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#d8e0ea;color:#17202a;font-family:Arial,Helvetica,sans-serif}.doc-actions{position:sticky;top:0;z-index:5;background:#101820;padding:10px;text-align:center}.doc-actions button{border:0;border-radius:8px;padding:10px 16px;font-weight:700;background:#24d982;color:#07120d;cursor:pointer}.doc-page{width:min(960px,100%);margin:0 auto;background:white;min-height:100vh;padding:38px}.doc-header{display:flex;justify-content:space-between;gap:24px;padding-bottom:22px;border-bottom:4px solid #101820}.doc-header h1{margin:0 0 7px;font-size:32px}.doc-header p{margin:0 0 5px}.doc-logo{width:132px;height:92px;display:grid;place-items:center;flex:0 0 auto;border:1px solid #d8dee8;border-radius:10px;color:#07120d;background:#24d982;font-weight:900;font-size:28px;overflow:hidden}.doc-logo img{width:100%;height:100%;object-fit:contain;padding:8px;background:white}.doc-title{display:flex;justify-content:space-between;gap:20px;margin:26px 0}.doc-title h2{margin:0;font-size:28px}.muted{color:#667085;line-height:1.45}.doc-status{display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:999px;background:#e8f3ff;color:#0f5c92;font-size:12px;font-weight:700;text-transform:uppercase}.doc-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #d8dee8;border-radius:10px;overflow:hidden}.doc-grid div{padding:13px;border-right:1px solid #d8dee8;border-bottom:1px solid #d8dee8}.doc-grid div:nth-child(3n){border-right:0}.doc-grid span{display:block;margin-bottom:5px;color:#667085;font-size:12px}.doc-grid strong{font-size:14px}.doc-box{margin-top:16px;padding:16px;border:1px solid #d8dee8;border-radius:10px}.doc-box h3{margin:0 0 10px;font-size:17px}.doc-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.doc-money-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid #e7ebf0}.doc-money-row.strong{margin-top:8px;padding:14px 0 0;border-bottom:0;font-size:20px}.doc-total{margin-top:20px;padding:18px 20px;border-radius:12px;background:#101820;color:white}.doc-total .doc-money-row{border:0;padding:0}.doc-total span{color:#d4dde7}.doc-total strong{color:#24d982;font-size:32px}.doc-signatures{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:34px}.doc-signature{padding-top:38px;border-top:1px solid #101820;text-align:center;color:#667085;font-size:12px}.doc-footer{display:flex;justify-content:space-between;gap:20px;margin-top:24px;padding-top:16px;border-top:1px solid #d8dee8;color:#667085;font-size:12px}@media print{body{background:white}.doc-actions{display:none}.doc-page{width:auto;min-height:0;padding:26px}.doc-box{break-inside:avoid}}@media(max-width:760px){.doc-header,.doc-title,.doc-two{display:block}.doc-logo{margin-top:14px}.doc-grid,.doc-signatures{grid-template-columns:1fr}.doc-grid div{border-right:0!important}}
  </style>
</head>
<body>
  <div class="doc-actions"><button onclick="window.print()">Salvar como PDF</button></div>
  <main class="doc-page">
    ${orderDocumentStoreBlock(profile)}
    <section class="doc-title">
      <div>
        <h2>Pedido / Recibo ${orderDocumentSafe(order.numero || "")}</h2>
        <p class="muted">Emitido em ${orderDocumentDate(now)}${order.pago_em ? ` · Pago em ${orderDocumentDate(order.pago_em)}` : ""}</p>
      </div>
      <span class="doc-status">${orderDocumentSafe(pay.label)}</span>
    </section>

    ${orderDocumentClientBlock(client)}

    <section class="doc-box">
      <h3>Resumo do pedido</h3>
      <div class="doc-grid">
        ${orderDocumentGrid([
          ["Pedido", order.titulo || ""],
          ["Status", order.status || "novo"],
          ["Origem", budget?.numero ? `Orçamento ${budget.numero}` : order.orcamento_id ? "Orçamento vinculado" : "Pedido direto"],
          ["Material", [order.material, order.cor].filter(Boolean).join(" - ") || "Não informado"],
          ["Quantidade", `${order.quantidade_pecas || 1} peça(s)`],
          ["Prazo", order.prazo_entrega || order.data_entrega || "A combinar"],
          ["Produção", production ? (production.numero || production.titulo || "Vinculada") : "Não enviada"],
          ["Etapa", production?.etapa_atual || production?.status || "Aguardando"],
          ["Pagamento", pay.label]
        ])}
      </div>
    </section>

    <section class="doc-two">
      <div class="doc-box">
        <h3>Financeiro</h3>
        ${orderDocumentMoneyRow("Valor do pedido", total)}
        ${orderDocumentMoneyRow("Valor pago", paid)}
        ${orderDocumentMoneyRow("Saldo restante", remaining, true)}
      </div>
      <div class="doc-box">
        <h3>Pagamento</h3>
        <p><strong>Forma:</strong> ${orderDocumentSafe(orderDocumentPaymentMethod(order.forma_pagamento))}</p>
        <p><strong>Vencimento:</strong> ${orderDocumentSafe(orderDocumentDate(order.vencimento_pagamento) || "Não informado")}</p>
        <p><strong>Situação:</strong> ${orderDocumentSafe(pay.label)}</p>
        <p class="muted">${orderDocumentSafe(order.observacao_financeira || "Pagamento confirmado conforme registros internos da loja.")}</p>
      </div>
    </section>

    ${(order.observacao || budget?.observacao) ? `<section class="doc-box"><h3>Observações</h3><p class="muted">${orderDocumentSafe(order.observacao || budget?.observacao)}</p></section>` : ""}

    <section class="doc-total">
      ${orderDocumentMoneyRow(remaining > 0 ? "Total pago até o momento" : "Total quitado", paid || total, true)}
    </section>

    <section class="doc-signatures">
      <div class="doc-signature">Assinatura do cliente / retirada</div>
      <div class="doc-signature">Responsável pela loja</div>
    </section>

    <section class="doc-footer">
      <span>${orderDocumentSafe(profile.nome_loja || "G3D Pro")}</span>
      <span>Documento gerado pelo G3D Pro. Não substitui nota fiscal quando aplicável.</span>
    </section>
  </main>
</body>
</html>`);
  win.document.close();
}

function attachOrderDocumentButtons(el) {
  if (!el) return;
  const rows = state.cache.pedidos || [];
  el.querySelectorAll("[data-edit-order]").forEach(button => {
    const orderId = button.dataset.editOrder;
    const actions = button.closest(".actions");
    if (!actions || actions.querySelector(`[data-pdf-order="${orderId}"]`)) return;
    const pdfButton = document.createElement("button");
    pdfButton.className = "btn";
    pdfButton.type = "button";
    pdfButton.dataset.pdfOrder = orderId;
    pdfButton.textContent = "Recibo/PDF";
    pdfButton.addEventListener("click", () => openOrderReceiptPdf(rows.find(row => row.id === orderId)));
    button.insertAdjacentElement("afterend", pdfButton);
  });
}

if (typeof renderPedidosProfessional === "function") {
  const orderDocumentsPreviousRenderPedidosProfessional = renderPedidosProfessional;
  renderPedidosProfessional = function renderPedidosProfessionalWithDocuments(el) {
    orderDocumentsPreviousRenderPedidosProfessional(el);
    attachOrderDocumentButtons(el);
  };
}
