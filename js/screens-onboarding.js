/* screens-onboarding.js — Bloque 1: Onboarding y acceso (pantallas 1-5) */

/* V1.24: mismas categorías de negocio que valida el backend — si se
   cambia una lista, hay que cambiar la otra. */
const BUSINESS_CATEGORY_OPTIONS = ['Alimentos', 'Salud', 'Belleza y estética', 'Agro y vivero', 'Servicios', 'Servicios públicos', 'Otros negocios'];

const SCREENS_ONBOARDING = [
  {
    id: 'splash',
    block: 'onboarding',
    label: '1. Splash',
    html: () => `
    <div class="phone__screen splash-screen">
      <span class="splash-shape splash-shape--sun" aria-hidden="true"></span>
      <span class="splash-shape splash-shape--tile" aria-hidden="true"></span>
      <span class="splash-shape splash-shape--arch" aria-hidden="true"></span>
      <span class="splash-shape splash-shape--dot" aria-hidden="true"></span>
      <div class="screen-body" style="position:relative; z-index:1;">
        <div class="screen-content screen-content--centered" style="flex:1; gap:var(--space-5);">
          <!-- V1.46: logo de inicio de la app (tienda con carrito y «HAY») -->
          <div class="auth-logo" data-testid="splash-logo"><img class="splash-logo-img" src="assets/hay-logo-inicio.png" alt="HAY — Lo tienes, publícalo, véndelo." decoding="async" fetchpriority="high" /></div>
          <p class="splash-tagline">Lo tienes, publícalo, véndelo.</p>
          <p class="splash-sub">Compra y vende con gente de tu zona, sin complicaciones.</p>
        </div>
      </div>
    </div>`,
    autoAdvance: { to: 'onboarding-slides', delayLabel: '↳ avanza automáticamente a Onboarding' },
  },

  {
    id: 'onboarding-slides',
    block: 'onboarding',
    label: '2. Onboarding (3 slides)',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" data-testid="onboarding-slides">
          <div class="flex-between">
            ${hayLogo(30)}
            <button class="btn btn--ghost btn--sm" data-nav="register" data-testid="btn-skip-onboarding">Saltar</button>
          </div>
          <div id="onboardingSlideWrap" style="flex:1; display:flex; flex-direction:column; justify-content:center; gap:var(--space-6);">
            ${heroIcon('boxOpen', 'cyan', { size: 230, halo: true, badge: 'camera' })}
            <div class="text-center stack-sm" id="onboardingText">
              <span class="screen-eyebrow">Paso 1 de 3</span>
              <h2 class="screen-title">Lo tienes</h2>
              <p class="screen-subtitle">Esa bici, esa silla, ese celular que ya no usas — seguro alguien cerca de ti lo está buscando ahora mismo.</p>
            </div>
          </div>
          <div class="stack" style="gap:var(--space-5);">
            <div class="dots" id="onboardingDots">
              <div class="dots__dot is-active" data-dot="0"></div>
              <div class="dots__dot" data-dot="1"></div>
              <div class="dots__dot" data-dot="2"></div>
            </div>
            <button class="btn btn--yellow" id="onboardingNextBtn" data-testid="btn-onboarding-next">Continuar</button>
          </div>
        </div>
      </div>
    </div>`,
  },

  {
    id: 'register',
    block: 'onboarding',
    label: '3. Registro',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" data-testid="screen-register">
          <div class="auth-hero">
            <div class="auth-top">
              <button class="icon-btn" data-nav="onboarding-slides" aria-label="Volver" data-testid="btn-back-register">${icon('back')}</button>
              ${hayLogo(30, { onYellow: true })}
            </div>
            <div class="stack-sm">
              <h2 class="screen-title">Crea tu cuenta</h2>
              <p class="auth-hero__sub">Es gratis.</p>
            </div>
          </div>
          <form class="stack" onsubmit="return false;">
            <div class="stack-sm">
              <span class="section-label">Tipo de cuenta</span>
              <div class="pill-row" data-testid="register-account-type">
                <span class="pill is-selected" data-account-type="persona">Persona</span>
                <span class="pill" data-account-type="negocio">Negocio</span>
              </div>
            </div>
            <label for="reg-email" class="sr-only">Email o teléfono</label>
            <div class="input-icon">
              ${icon('mail')}
              <input id="reg-email" type="text" placeholder="Correo o teléfono" data-testid="input-register-email" />
            </div>
            <label for="reg-pass" class="sr-only">Contraseña</label>
            <div class="input-icon">
              ${icon('lock')}
              <input id="reg-pass" type="password" placeholder="Contraseña (mínimo 8 caracteres)" data-testid="input-register-password" />
              <button type="button" class="input-icon__btn" data-toggle-password="reg-pass" aria-label="Mostrar contraseña">${icon('eye')}</button>
            </div>
            <div class="stack" id="registerBusinessFields" data-testid="register-business-fields" style="display:none;">
              <div class="field">
                <label for="reg-business-name">Nombre comercial</label>
                <input id="reg-business-name" type="text" placeholder="Ej. Carnicería El Buen Corte" data-testid="input-register-business-name" />
              </div>
              <div class="stack-sm">
                <span class="section-label">Categoría de negocio</span>
                <div class="chip-row" data-testid="register-business-category" style="flex-wrap:wrap; overflow:visible;">
                  ${BUSINESS_CATEGORY_OPTIONS.map((c, i) => `<span class="chip ${i === 0 ? 'chip--turquoise is-active' : ''}" data-cat="${c}">${c}</span>`).join('')}
                </div>
              </div>
            </div>
            <p class="text-xs" id="authErrorMsg" data-testid="register-error" style="display:none; color:var(--color-error); font-weight:600;"></p>
            <p class="text-xs text-muted" style="font-weight:600;" data-testid="register-terms">Al crear tu cuenta aceptas los <a class="link-cyan" href="terminos.html" target="_blank" rel="noopener">Términos de uso</a> y la <a class="link-cyan" href="privacidad.html" target="_blank" rel="noopener">Política de privacidad</a> de HAY.</p>
            <button class="btn btn--turquoise" id="btnRegisterSubmit" data-testid="btn-register-submit">Crear cuenta</button>
          </form>
          <div class="divider-text">o</div>
          <div class="stack-sm">
            <button class="social-btn" data-testid="btn-google-signup">${icon('google')} Continuar con Google</button>
          </div>
          <p class="text-center text-sm text-muted mt-auto" style="font-weight:700;">¿Ya tienes cuenta? <button class="btn--ghost link-cyan" style="display:inline;width:auto;min-height:auto;padding:0;font-size:inherit" data-nav="login" data-testid="link-go-login">Inicia sesión</button></p>
        </div>
      </div>
    </div>`,
  },

  {
    id: 'login',
    block: 'onboarding',
    label: '4. Login',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" data-testid="screen-login">
          <div class="auth-hero">
            <div class="auth-top">
              <button class="icon-btn" data-nav="register" aria-label="Volver" data-testid="btn-back-login">${icon('back')}</button>
              ${hayLogo(30, { onYellow: true })}
            </div>
            <div class="stack-sm">
              <h2 class="screen-title">Entrar</h2>
            </div>
          </div>
          <form class="stack" onsubmit="return false;">
            <label for="log-email" class="sr-only">Email o teléfono</label>
            <div class="input-icon">
              ${icon('mail')}
              <input id="log-email" type="text" placeholder="Correo o teléfono" data-testid="input-login-email" />
            </div>
            <label for="log-pass" class="sr-only">Contraseña</label>
            <div class="input-icon">
              ${icon('lock')}
              <input id="log-pass" type="password" placeholder="Contraseña" data-testid="input-login-password" />
              <button type="button" class="input-icon__btn" data-toggle-password="log-pass" aria-label="Mostrar contraseña">${icon('eye')}</button>
            </div>
            <button class="btn--ghost link-cyan" style="width:auto; align-self:flex-end; min-height:auto; font-size:var(--text-sm);" data-nav="forgot-password" data-testid="link-forgot-password">¿Olvidaste tu contraseña?</button>
            <p class="text-xs" id="authErrorMsg" data-testid="login-error" style="display:none; color:var(--color-error); font-weight:600;"></p>
            <button class="btn btn--turquoise" id="btnLoginSubmit" data-testid="btn-login-submit">Entrar</button>
          </form>
          <div class="divider-text">o</div>
          <div class="stack-sm">
            <button class="social-btn" data-testid="btn-google-login">${icon('google')} Continuar con Google</button>
          </div>
          <p class="text-center text-sm text-muted mt-auto" style="font-weight:700;">¿No tienes cuenta? <button class="btn--ghost link-cyan" style="display:inline;width:auto;min-height:auto;padding:0;font-size:inherit" data-nav="register" data-testid="link-go-register">Regístrate</button></p>
        </div>
      </div>
    </div>`,
  },

  {
    id: 'forgot-password',
    block: 'onboarding',
    label: '5. Recuperar contraseña',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" data-testid="screen-forgot-password">
          <button class="icon-btn icon-btn--ghost" data-nav="login" aria-label="Volver" data-testid="btn-back-forgot">${icon('back')}</button>
                    <div class="stack-sm text-center">
            <h2 class="screen-title" style="font-size:24px;">¿Olvidaste tu contraseña?</h2>
            <p class="screen-subtitle">Te enviamos un enlace a tu correo.</p>
          </div>
          <form class="stack" onsubmit="return false;">
            <label for="fp-email" class="sr-only">Email</label>
            <div class="input-icon">
              ${icon('mail')}
              <input id="fp-email" type="email" placeholder="Correo" data-testid="input-forgot-email" />
            </div>
            <p class="text-xs" id="authErrorMsg" data-testid="forgot-error" style="display:none; color:var(--color-error); font-weight:600;"></p>
            <button class="btn btn--turquoise" id="btnSendResetLink" data-testid="btn-send-reset-link">Enviar enlace</button>
          </form>
        </div>
      </div>
    </div>`,
  },

  {
    id: 'forgot-password-sent',
    block: 'onboarding',
    label: '5b. Enlace enviado',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" data-testid="screen-forgot-sent">
          <button class="icon-btn" data-nav="login" aria-label="Volver" data-testid="btn-back-forgot-sent">${icon('back')}</button>
          <div style="margin-top:var(--space-10);">${heroIcon('check', 'green', { size: 160 })}</div>
          <h2 class="screen-title text-center">¡Enlace generado!</h2>
          <p class="screen-subtitle text-center">Revisa tu correo.</p>
          ${PASSWORD_RESET_DEV_TOKEN ? `
          <div class="field card">
            <p class="text-xs text-muted" style="margin-bottom:var(--space-2);">Modo desarrollo (sin servidor de email conectado): el enlace real se imprimió en la consola del backend. Para poder probarlo ahora mismo, completa la nueva contraseña acá:</p>
            <label for="rp-password">Nueva contraseña</label>
            <input id="rp-password" type="password" placeholder="Mínimo 8 caracteres" data-testid="input-reset-new-password" />
          </div>
          <p class="text-xs" id="authErrorMsg" data-testid="reset-error" style="display:none; color:var(--color-error); font-weight:600;"></p>
          <button class="btn btn--turquoise" id="btnConfirmResetPassword" data-testid="btn-confirm-reset-password">Cambiar contraseña</button>
          ` : ''}
          <button class="btn btn--outline" data-nav="login" data-testid="btn-back-to-login">Volver</button>
        </div>
      </div>
    </div>`,
  },
];
