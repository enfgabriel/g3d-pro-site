(function () {
  const PAGE_KEY = "g3d:last-page";
  const DEFAULT_PAGE = "dashboard";
  let restoring = false;

  function canUseStorage() {
    try {
      window.localStorage.setItem("g3d:storage-test", "1");
      window.localStorage.removeItem("g3d:storage-test");
      return true;
    } catch (_error) {
      return false;
    }
  }

  const storageReady = canUseStorage();

  function pageExists(page) {
    return Boolean(page && Array.isArray(navPages) && navPages.some(([id]) => id === page));
  }

  function saveCurrentPage() {
    if (!storageReady || restoring || !state?.session || !pageExists(state.page)) return;
    localStorage.setItem(PAGE_KEY, state.page || DEFAULT_PAGE);
  }

  function readSavedPage() {
    if (!storageReady) return DEFAULT_PAGE;
    const saved = localStorage.getItem(PAGE_KEY);
    return pageExists(saved) ? saved : DEFAULT_PAGE;
  }

  function restoreLastPage() {
    if (!state?.session) return;
    const saved = readSavedPage();
    if (!pageExists(saved) || state.page === saved) return;
    restoring = true;
    state.page = saved;
    renderApp();
    renderPage();
    restoring = false;
  }

  if (typeof renderPage === "function") {
    const previousRenderPage = renderPage;
    renderPage = function renderPageWithMemory() {
      const result = previousRenderPage.apply(this, arguments);
      saveCurrentPage();
      return result;
    };
  }

  if (typeof renderApp === "function") {
    const previousRenderApp = renderApp;
    renderApp = function renderAppWithMemory() {
      const result = previousRenderApp.apply(this, arguments);
      saveCurrentPage();
      return result;
    };
  }

  window.g3dRememberPage = saveCurrentPage;
  window.g3dRestoreLastPage = restoreLastPage;

  setTimeout(restoreLastPage, 120);
  setTimeout(restoreLastPage, 900);
})();
