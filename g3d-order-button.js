(function () {
  try {
    const previousRenderOrcamentos = typeof renderOrcamentos === "function" ? renderOrcamentos : null;
    if (!previousRenderOrcamentos) return;

    renderOrcamentos = function renderOrcamentosWithOrderButton(el) {
      previousRenderOrcamentos(el);
      const rows = state.cache.orcamentos || [];
      document.querySelectorAll("[data-edit-budget]").forEach(editButton => {
        const row = rows.find(item => item.id === editButton.dataset.editBudget);
        if (!row) return;
        const actions = editButton.closest(".actions") || editButton.parentElement;
        if (!actions || actions.querySelector(`[data-order-budget="${row.id}"]`)) return;
        const existing = typeof budgetOrderFor === "function" ? budgetOrderFor(row) : (state.cache.pedidos || []).find(order => order.orcamento_id === row.id || order.id === row.pedido_id);
        const button = document.createElement("button");
        button.type = "button";
        button.className = existing ? "btn" : "btn primary";
        button.dataset.orderBudget = row.id;
        button.textContent = existing ? "Pedido gerado" : "Gerar pedido";
        button.disabled = Boolean(existing);
        button.addEventListener("click", () => generateOrderFromBudget(row));
        const deleteButton = actions.querySelector("[data-del-budget]");
        if (deleteButton) actions.insertBefore(button, deleteButton);
        else actions.appendChild(button);
      });
    };

    if (state?.page === "orcamentos") renderPage();
    window.G3D_ORDER_BUTTON = true;
  } catch (error) {
    window.G3D_ORDER_BUTTON = false;
    console.error("G3D order button", error);
  }
})();
