(function () {
  function removeAuxiliaryColorNames(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[name="cor_custom_text"]').forEach((input) => {
      input.removeAttribute('name');
      input.setAttribute('autocomplete', 'off');
    });
  }

  function protectColorForms() {
    removeAuxiliaryColorNames(document);
  }

  document.addEventListener('submit', (event) => {
    removeAuxiliaryColorNames(event.target);
  }, true);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => removeAuxiliaryColorNames(node));
    });
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    protectColorForms();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      observer.observe(document.body, { childList: true, subtree: true });
      protectColorForms();
    }, { once: true });
  }
})();
