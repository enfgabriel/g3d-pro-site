const G3D_HCAPTCHA_SITEKEY = window.G3D_HCAPTCHA_SITEKEY || "fda0a012-15e8-4f4e-92b0-1408d594c3d4";
let g3dAuthCaptchaWidget = null;
let g3dAuthCaptchaTimer = null;

function renderAuth(mode = "login") {
  const isSignup = mode === "signup";
  app.innerHTML = `
    <main class="auth-shell auth-shell-pro">
      <section class="auth-brand auth-brand-pro">
        <div class="auth-brand-top">
          <div class="logo auth-logo">G3D</div>
          <div>
            <strong>G3D Pro</strong>
            <span>ERP para impressão 3D</span>
          </div>
        </div>
        <div class="auth-hero-copy">
          <p class="eyebrow-auth">Gestão de ponta a ponta</p>
          <h1>Transforme orçamentos em produção com controle real de custos.</h1>
          <p>Clientes, estoque, parâmetros, pedidos, produção e PDFs comerciais em um ambiente seguro para cada usuário.</p>
        </div>
        <div class="auth-highlights">
          <span>Orçamento automático</span>
          <span>Estoque por material</span>
          <span>PDF com logo</span>
        </div>
      </section>
      <section class="auth-card auth-card-pro">
        <form class="auth-box auth-box-pro" id="authForm">
          <div class="auth-form-head">
            <span class="auth-kicker">${isSignup ? "Novo acesso" : "Acesso seguro"}</span>
            <h2>${isSignup ? "Crie sua conta" : "Entre no G3D Pro"}</h2>
            <p class="muted">${isSignup ? "Comece configurando sua loja, parâmetros e primeiro orçamento." : "Acesse seu ambiente para continuar seus orçamentos e produção."}</p>
          </div>

          <div class="auth-tabs" role="tablist" aria-label="Modo de acesso">
            <button class="auth-tab ${!isSignup ? "active" : ""}" type="button" data-auth-mode="login">Entrar</button>
            <button class="auth-tab ${isSignup ? "active" : ""}" type="button" data-auth-mode="signup">Criar conta</button>
          </div>

          <div class="field">
            <label for="authEmail">Email</label>
            <input type="email" id="authEmail" required autocomplete="email" placeholder="voce@sualoja.com" />
          </div>
          <div class="field password-field">
            <label for="authPassword">Senha</label>
            <div class="password-wrap">
              <input type="password" id="authPassword" required autocomplete="${isSignup ? "new-password" : "current-password"}" placeholder="Digite sua senha" />
              <button class="password-toggle" type="button" id="togglePassword">Mostrar</button>
            </div>
            <small>${isSignup ? "Use pelo menos 6 caracteres." : "Nunca compartilhe sua senha com terceiros."}</small>
          </div>

          <div class="field auth-captcha-field">
            <label>Verificação de segurança</label>
            <div id="authCaptcha" class="auth-captcha-box" aria-live="polite">
              <span class="muted">Carregando verificação...</span>
            </div>
            <small>Proteção contra robôs antes de entrar ou criar conta.</small>
          </div>

          <button class="btn primary full auth-submit" type="submit" id="authSubmit">${isSignup ? "Criar minha conta" : "Entrar no sistema"}</button>

          <div class="auth-secondary-row">
            <button class="btn link" type="button" id="forgotPassword">Esqueci minha senha</button>
          </div>

          <p class="auth-security-note">Cada conta acessa somente seus próprios clientes, estoque, orçamentos e pedidos.</p>
        </form>
      </section>
    </main>`;

  g3dAuthCaptchaWidget = null;
  clearTimeout(g3dAuthCaptchaTimer);
  mountAuthCaptcha();

  document.querySelectorAll("[data-auth-mode]").forEach(button => {
    button.addEventListener("click", () => renderAuth(button.dataset.authMode));
  });

  document.getElementById("togglePassword").addEventListener("click", () => {
    const input = document.getElementById("authPassword");
    const isHidden = input.type === "password";
    input.type = isHidden ? "text" : "password";
    document.getElementById("togglePassword").textContent = isHidden ? "Ocultar" : "Mostrar";
  });

  document.getElementById("forgotPassword").addEventListener("click", openPasswordReset);

  document.getElementById("authForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = document.getElementById("authSubmit");
    const label = button.textContent;
    button.disabled = true;
    button.textContent = "Verificando...";

    const captchaToken = getAuthCaptchaToken();
    if (!captchaToken) {
      showToast(window.hcaptcha ? "Confirme a verificação de segurança para continuar." : "A verificação de segurança ainda está carregando. Aguarde alguns segundos.");
      button.disabled = false;
      button.textContent = label;
      return;
    }

    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    const credentials = { email, password, options: { captchaToken } };
    const result = isSignup
      ? await supabaseClient.auth.signUp(credentials)
      : await supabaseClient.auth.signInWithPassword(credentials);

    if (result.error) {
      resetAuthCaptcha();
      showToast(authCaptchaMessage(result.error));
    } else {
      showToast(isSignup ? "Conta criada. Se o sistema pedir confirmação, verifique seu email." : "Bem-vindo ao G3D Pro.");
    }

    button.disabled = false;
    button.textContent = label;
  });
}

function mountAuthCaptcha() {
  const box = document.getElementById("authCaptcha");
  if (!box) return;
  if (!G3D_HCAPTCHA_SITEKEY) {
    box.innerHTML = `<span class="muted">Verificação indisponível.</span>`;
    return;
  }
  if (!window.hcaptcha?.render) {
    g3dAuthCaptchaTimer = setTimeout(mountAuthCaptcha, 350);
    return;
  }
  try {
    box.innerHTML = "";
    g3dAuthCaptchaWidget = window.hcaptcha.render(box, {
      sitekey: G3D_HCAPTCHA_SITEKEY,
      theme: "light",
      size: "normal"
    });
  } catch (_error) {
    box.innerHTML = `<span class="muted">Recarregue a página para carregar a verificação.</span>`;
  }
}

function getAuthCaptchaToken() {
  if (!window.hcaptcha || g3dAuthCaptchaWidget === null) return "";
  try {
    return window.hcaptcha.getResponse(g3dAuthCaptchaWidget) || "";
  } catch (_error) {
    return "";
  }
}

function resetAuthCaptcha() {
  if (!window.hcaptcha || g3dAuthCaptchaWidget === null) return;
  try {
    window.hcaptcha.reset(g3dAuthCaptchaWidget);
  } catch (_error) {}
}

function authCaptchaMessage(error) {
  const text = String(error?.message || "").toLowerCase();
  if (text.includes("captcha") || text.includes("challenge")) return "A verificação de segurança expirou ou falhou. Confirme o CAPTCHA novamente.";
  return authMessage(error);
}

function openPasswordReset() {
  const email = document.getElementById("authEmail")?.value.trim() || "";
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <form class="modal reset-modal" id="resetForm">
      <div class="modal-head">
        <strong>Recuperar senha</strong>
        <button class="btn" type="button" id="closeReset">Fechar</button>
      </div>
      <div class="modal-body">
        <p class="muted">Informe o email da conta para receber o link de recuperação.</p>
        <div class="field">
          <label>Email</label>
          <input type="email" name="email" required value="${escapeHtml(email)}" placeholder="voce@sualoja.com" />
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn" type="button" id="cancelReset">Cancelar</button>
        <button class="btn primary" type="submit" id="sendReset">Enviar link</button>
      </div>
    </form>`;
  document.body.appendChild(backdrop);

  const close = () => backdrop.remove();
  document.getElementById("closeReset").addEventListener("click", close);
  document.getElementById("cancelReset").addEventListener("click", close);
  document.getElementById("resetForm").addEventListener("submit", async event => {
    event.preventDefault();
    const button = document.getElementById("sendReset");
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "Enviando...";
    const resetEmail = new FormData(event.currentTarget).get("email");
    const { error } = await supabaseClient.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) showToast(authMessage(error));
    else {
      showToast("Link de recuperação enviado, se o email estiver cadastrado.");
      close();
    }
    button.disabled = false;
    button.textContent = original;
  });
}

if (!state.session) renderAuth();