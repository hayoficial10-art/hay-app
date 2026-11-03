/* screens-account.js — Bloque 5: Gestión de cuenta (pantallas 22-26) */

function listingRow(p) {
  const statusBadge =
    p.status === 'paused' ? { cls: 'paused', text: 'Pausada' } :
    p.status === 'sold' ? { cls: 'sold', text: 'Vendida' } :
    { cls: 'active', text: 'Activa' };
  return `
  <div class="product-row" data-testid="listing-row-${p.id}">
    ${listingArt(p)}
    <div class="product-row__body">
      <p class="product-row__title">${p.title}</p>
      <span class="product-row__price">$${p.price}</span>
      <span class="badge badge--${statusBadge.cls}" style="align-self:flex-start; margin-top:2px;">${statusBadge.text}</span>
    </div>
    <div class="product-row__actions">
      ${p.status !== 'sold' ? `<button class="icon-btn icon-btn--ghost" aria-label="Editar" data-listing-id="${p.id}" data-testid="btn-edit-listing-${p.id}">${icon('edit')}</button>` : ''}
      ${p.status !== 'sold' ? `<button class="icon-btn icon-btn--ghost" aria-label="${p.status === 'paused' ? 'Reanudar' : 'Pausar'}" data-listing-id="${p.id}" data-next-status="${p.status === 'paused' ? 'active' : 'paused'}" data-testid="btn-pause-listing-${p.id}">${icon('pause')}</button>` : ''}
      ${p.status !== 'sold' ? `<button class="icon-btn icon-btn--ghost" aria-label="Marcar como vendida" data-listing-id="${p.id}" data-next-status="sold" data-testid="btn-sold-listing-${p.id}">${icon('check')}</button>` : ''}
      <button class="icon-btn icon-btn--ghost" aria-label="Eliminar" data-listing-id="${p.id}" data-testid="btn-delete-listing-${p.id}">${icon('trash')}</button>
    </div>
  </div>`;
}

let MY_LISTINGS_TAB = 'active';

const SCREENS_ACCOUNT = [
  {
    id: 'my-listings',
    block: 'account',
    label: '22. Mis publicaciones',
    html: () => {
      const active = MY_LISTINGS.filter((l) => !l.status || l.status === 'active');
      const paused = MY_LISTINGS.filter((l) => l.status === 'paused');
      const sold = MY_LISTINGS.filter((l) => l.status === 'sold');
      const byTab = { active, paused, sold };
      const emptyMsg = {
        active: 'No tienes publicaciones activas.',
        paused: 'No tienes publicaciones pausadas.',
        sold: 'Todavía no marcaste ninguna publicación como vendida.',
      };
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'profile', title: 'Mis publicaciones', testid: 'my-listings', stacked: true })}
      ${CURRENT_USER && !MY_LISTINGS_LOADING ? `
      <div style="padding:0 var(--space-5) var(--space-3)">
        <div class="segmented" data-testid="my-listings-tabs">
          <span class="segmented__item ${MY_LISTINGS_TAB === 'active' ? 'is-active' : ''}" data-my-listings-tab="active" data-testid="tab-active-listings">Activas (${active.length})</span>
          <span class="segmented__item ${MY_LISTINGS_TAB === 'paused' ? 'is-active' : ''}" data-my-listings-tab="paused" data-testid="tab-paused-listings">Pausadas (${paused.length})</span>
          <span class="segmented__item ${MY_LISTINGS_TAB === 'sold' ? 'is-active' : ''}" data-my-listings-tab="sold" data-testid="tab-sold-listings">Vendidas (${sold.length})</span>
        </div>
      </div>` : ''}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-3)" data-testid="screen-my-listings">
          ${!CURRENT_USER ? `
            <p class="empty-msg">Inicia sesión para ver tus publicaciones reales.</p>
          ` : MY_LISTINGS_LOADING ? `
            <p class="empty-msg">Cargando tus publicaciones...</p>
          ` : MY_LISTINGS.length === 0 ? `
            <p class="empty-msg">Todavía no publicaste nada con esta cuenta.<br/>Toca el botón + de abajo para crear tu primera publicación.</p>
          ` : byTab[MY_LISTINGS_TAB].length === 0 ? `
            <p class="empty-msg">${emptyMsg[MY_LISTINGS_TAB]}</p>
          ` : byTab[MY_LISTINGS_TAB].map((p) => listingRow(p)).join('')}
        </div>
      </div>
      ${tabBar('profile')}
    </div>`;
    },
  },

  {
    id: 'favorites',
    block: 'account',
    label: '23. Favoritos',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'profile', title: 'Tus favoritos', testid: 'favorites', stacked: true })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-3)" data-testid="screen-favorites">
          ${(() => {
            // V1.32: favoritos reales guardados en este teléfono
            const favs = loadFavs();
            if (!favs.length) return `<div class="empty-state">${heroIcon('heart', 'pink', { size: 130 })}<p class="empty-msg" style="margin-top:0;">Todavía no guardas nada.<br/>Toca el corazón de un producto para tenerlo aquí.</p><button class="btn btn--turquoise" style="width:auto; padding-left:28px; padding-right:28px;" data-nav="home" data-testid="btn-favorites-explore">Explorar productos</button></div>`;
            return `
          <span class="text-sm text-muted" data-testid="favorites-count">${favs.length === 1 ? '1 producto guardado' : `${favs.length} productos guardados`}</span>
          <div class="stack" data-testid="favorites-list">
            ${favs.map((p) => productCard(p, { fav: true, variant: 'row' })).join('')}
          </div>`;
          })()}
        </div>
      </div>
      ${tabBar('profile')}
    </div>`,
  },

  {
    id: 'notifications',
    block: 'account',
    label: '24. Notificaciones',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'home', title: 'Notificaciones', testid: 'notifications', stacked: true })}
      <div class="screen-body" data-testid="screen-notifications">
        <div class="notif-list">
        ${HAY_APP_MODE ? `<div class="empty-state">${heroIcon('bell', 'yellow', { size: 130 })}<p class="empty-msg" style="margin-top:0;">No tienes notificaciones por ahora. Los mensajes y ofertas nuevas los ves en la pestaña Mensajes.</p></div>` : [
          { icon: 'chat', bg: 'cyan', text: '<strong>Carlos M.</strong> te envió un mensaje sobre "Bicicleta montaña rodado 26"', time: 'Hace 10 min' },
          { icon: 'gift', bg: 'green', text: '<strong>Jonathan P.</strong> hizo una oferta de $80 por "Silla de oficina ergonómica"', time: 'Hace 1 h' },
          { icon: 'tag', bg: 'yellow', text: 'Bajó el precio de "Mesa de centro madera" en tus favoritos, ahora $60', time: 'Hace 3 h' },
          { icon: 'check', bg: 'cyan', text: 'Tu publicación "iPhone 12 128GB" fue vista 24 veces hoy', time: 'Ayer' },
          { icon: 'star', bg: 'yellow', text: '<strong>Marta R.</strong> te calificó con 5 estrellas', time: 'Ayer' },
          { icon: 'bell', bg: 'navy', text: 'Recuerda: publicaciones sin actividad se pausan a los 30 días', time: 'Hace 2 días' },
        ]
          .map(
            (n) => `
        <div class="notif-row">
          <span class="notif-row__icon tone-${n.bg}">${icon(n.icon)}</span>
          <div class="notif-row__body">
            <p class="notif-row__text">${n.text}</p>
            <p class="notif-row__time">${n.time}</p>
          </div>
          ${icon('chevronRight', 'list-row__chevron')}
        </div>`
          )
          .join('')}
        </div>
      </div>
    </div>`,
  },

  {
    id: 'edit-profile',
    block: 'account',
    label: '25. Editar perfil',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({
        back: 'profile',
        title: 'Editar perfil',
        right: `<button class="btn btn--turquoise btn--sm" data-nav="profile" data-testid="btn-save-profile">Guardar</button>`,
        testid: 'edit-profile',
      })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-edit-profile">
          <div class="stack text-center" style="align-items:center;">
            <div style="position:relative;">
              ${userAvatar('lg', 'fucsia', 'edit-profile-avatar')}
              <label class="icon-btn icon-btn--filled avatar-cam" aria-label="Tomar foto de perfil" data-testid="btn-change-avatar">
                ${icon('camera')}
                <input type="file" accept="image/*" capture="user" data-avatar-input data-testid="input-avatar-camera" style="display:none;" />
              </label>
            </div>
            ${HAY_APP_MODE && CURRENT_USER ? `
            <div class="photo-actions" style="width:100%;">
              <label class="btn btn--turquoise btn--sm" style="cursor:pointer;" data-testid="btn-avatar-camera">
                ${icon('camera')} Tomar foto
                <input type="file" accept="image/*" capture="user" data-avatar-input style="display:none;" />
              </label>
              <label class="btn btn--outline btn--sm" style="cursor:pointer;" data-testid="btn-avatar-gallery">
                ${icon('gallery')} Galería
                <input type="file" accept="image/*" data-avatar-input data-testid="input-avatar-file" style="display:none;" />
              </label>
            </div>
            ${CURRENT_USER.avatarUrl ? `<button class="text-xs link-cyan" data-avatar-remove data-testid="btn-avatar-remove">Quitar foto</button>` : ''}
            <p class="text-xs" id="avatarMsg" data-testid="avatar-msg" style="display:none; font-weight:700;"></p>` : ''}
          </div>
          ${HAY_APP_MODE ? `
          <div class="card stack-sm text-center" data-testid="edit-profile-soon">
            <p class="section-label" style="word-break:break-word;">${CURRENT_USER ? CURRENT_USER.email : 'Sin sesión'}</p>
            <p class="screen-subtitle">${CURRENT_USER ? 'Toca «Tomar foto» o «Galería» para poner tu foto de perfil. Muy pronto vas a poder cambiar también tu nombre y zona.' : 'Inicia sesión para cambiar tu foto de perfil.'}</p>
          </div>` : `
          <div class="field">
            <label for="ep-name">Nombre completo</label>
            <input id="ep-name" type="text" value="María Jiménez" data-testid="input-edit-name" />
          </div>
          <div class="field">
            <label for="ep-location">Ubicación</label>
            <input id="ep-location" type="text" value="Miami, FL" data-testid="input-edit-location" />
          </div>
          <div class="field">
            <label for="ep-bio">Biografía corta</label>
            <textarea id="ep-bio" data-testid="input-edit-bio">Vendo cositas que ya no uso. Respondo rápido y siempre en puntos públicos y seguros de Miami.</textarea>
          </div>`}
        </div>
      </div>
    </div>`,
  },

  {
    id: 'settings',
    block: 'account',
    label: '26. Configuración',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'profile', title: 'Configuración', testid: 'settings', stacked: true })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-6)" data-testid="screen-settings">
          <div class="stack-sm">
            <span class="settings-section-title">Cuenta</span>
            <div class="card" style="padding:0;">
              <button class="list-row" style="width:100%; background:none; border:none; padding-left:var(--space-4); padding-right:var(--space-4);" data-nav="edit-profile" data-testid="btn-settings-edit-profile">
                <span class="list-row__icon tone-cyan">${icon('user')}</span>
                <div class="list-row__body"><p class="list-row__title">Editar perfil</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </button>
              ${HAY_APP_MODE ? '' : `<button class="list-row" style="width:100%; background:none; border:none; padding-left:var(--space-4); padding-right:var(--space-4);" data-testid="btn-settings-payment">
                <span class="list-row__icon tone-yellow">${icon('tag')}</span>
                <div class="list-row__body"><p class="list-row__title">Métodos de pago</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </button>`}
            </div>
          </div>

          ${HAY_APP_MODE ? '' : `
          <div class="stack-sm">
            <span class="settings-section-title">Privacidad</span>
            <div class="card stack">
              <div class="toggle-row">
                <span class="list-row__icon tone-cyan" style="width:38px;height:38px;">${icon('pin')}</span><div class="toggle-row__text grow"><strong>Mostrar mi ubicación exacta</strong><span>Si lo desactivas, solo se verá tu zona general</span></div>
                <button class="toggle" role="switch" aria-checked="false" aria-label="Mostrar ubicación exacta" data-testid="toggle-show-location"></button>
              </div>
              <div class="toggle-row">
                <span class="list-row__icon tone-green" style="width:38px;height:38px;">${icon('lock')}</span><div class="toggle-row__text grow"><strong>Perfil visible en buscadores</strong><span>Permite que te encuentren fuera de HAY</span></div>
                <button class="toggle is-on" role="switch" aria-checked="true" aria-label="Perfil visible" data-testid="toggle-profile-visible"></button>
              </div>
            </div>
          </div>

          <div class="stack-sm">
            <span class="settings-section-title">Notificaciones</span>
            <div class="card stack">
              <div class="toggle-row">
                <span class="list-row__icon tone-cyan" style="width:38px;height:38px;">${icon('chat')}</span><div class="toggle-row__text grow"><strong>Mensajes nuevos</strong></div>
                <button class="toggle is-on" role="switch" aria-checked="true" aria-label="Notificar mensajes nuevos" data-testid="toggle-notif-messages"></button>
              </div>
              <div class="toggle-row">
                <span class="list-row__icon tone-green" style="width:38px;height:38px;">${icon('gift')}</span><div class="toggle-row__text grow"><strong>Ofertas recibidas</strong></div>
                <button class="toggle is-on" role="switch" aria-checked="true" aria-label="Notificar ofertas" data-testid="toggle-notif-offers"></button>
              </div>
              <div class="toggle-row">
                <span class="list-row__icon tone-yellow" style="width:38px;height:38px;">${icon('tag')}</span><div class="toggle-row__text grow"><strong>Bajadas de precio en favoritos</strong></div>
                <button class="toggle" role="switch" aria-checked="false" aria-label="Notificar bajadas de precio" data-testid="toggle-notif-price-drop"></button>
              </div>
            </div>
          </div>

          `}
          <div class="stack-sm">
            <span class="settings-section-title">Ayuda</span>
            <div class="card" style="padding:0;">
              <button class="list-row" style="width:100%; background:none; border:none; padding-left:var(--space-4); padding-right:var(--space-4);" data-nav="safety" data-testid="btn-settings-safety">
                <span class="list-row__icon tone-purple">${icon('shield')}</span>
                <div class="list-row__body"><p class="list-row__title">Seguridad</p><p class="list-row__sub">Números de emergencia y consejos</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </button>
              <a class="list-row" style="width:100%; padding-left:var(--space-4); padding-right:var(--space-4);" href="terminos.html" target="_blank" rel="noopener" data-testid="link-terms">
                <span class="list-row__icon tone-navy">${icon('book')}</span>
                <div class="list-row__body"><p class="list-row__title">Términos de uso</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </a>
              <a class="list-row" style="width:100%; padding-left:var(--space-4); padding-right:var(--space-4);" href="privacidad.html" target="_blank" rel="noopener" data-testid="link-privacy">
                <span class="list-row__icon tone-purple">${icon('lock')}</span>
                <div class="list-row__body"><p class="list-row__title">Política de privacidad</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </a>
              ${HAY_APP_MODE ? '' : `<button class="list-row" style="width:100%; background:none; border:none; padding-left:var(--space-4); padding-right:var(--space-4);" data-testid="btn-settings-help-center">
                <span class="list-row__icon tone-cyan">${icon('help')}</span>
                <div class="list-row__body"><p class="list-row__title">Centro de ayuda</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </button>`}
              <button class="list-row" style="width:100%; background:none; border:none; padding-left:var(--space-4); padding-right:var(--space-4);" data-nav="report" data-testid="btn-settings-report-problem">
                <span class="list-row__icon tone-pink">${icon('shield')}</span>
                <div class="list-row__body"><p class="list-row__title">Reportar un problema</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </button>
              ${
                CURRENT_USER && CURRENT_USER.isAdmin
                  ? `<button class="list-row" style="width:100%; background:none; border:none; padding-left:var(--space-4); padding-right:var(--space-4);" data-nav="moderation-panel" data-testid="btn-settings-moderation-panel">
                <span class="list-row__icon tone-navy">${icon('shield')}</span>
                <div class="list-row__body"><p class="list-row__title">Panel de moderador</p><p class="list-row__sub">Revisar reportes</p></div>
                ${icon('chevronRight', 'list-row__chevron')}
              </button>`
                  : ''
              }
            </div>
          </div>

          ${CURRENT_USER ? `<button class="btn--ghost" style="color:var(--color-error); align-self:center; min-height:auto; font-size:var(--text-sm);" data-nav="delete-account" data-testid="btn-go-delete-account">Eliminar mi cuenta</button>` : ''}
          <button class="btn btn--outline" style="color:var(--color-error); border-color:var(--color-error);" data-nav="login" data-testid="btn-logout">
            ${icon('logout')} Cerrar sesión
          </button>
        </div>
      </div>
    </div>`,
  },

  {
    // V1.25: pantalla de Seguridad — visible para cualquiera (con o sin
    // cuenta más adelante, cuando exista navegación de invitado). Números
    // de emergencia reales (911 nacional + los que cargue el admin) y
    // consejos de seguridad para negociar con otra persona.
    id: 'safety',
    block: 'account',
    label: '26c. Seguridad',
    html: () => {
      const numbers = EMERGENCY_NUMBERS_LOADING ? null : EMERGENCY_NUMBERS;
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'settings', title: 'Seguridad', testid: 'safety', stacked: true })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-safety">
          ${heroIcon('shield', 'pink', { size: 130 })}
          <div class="card" style="gap:var(--space-3); display:flex; flex-direction:column; text-align:center;">
            <span class="section-label">¿Es una emergencia ahora mismo?</span>
            <a href="tel:911" class="btn btn--pink" data-testid="btn-call-911" style="text-decoration:none;">${icon('phone')} Llamar al 911</a>
          </div>

          <div class="stack-sm">
            <span class="settings-section-title">Números de emergencia</span>
            ${
              numbers === null
                ? `<p class="text-xs text-muted">Cargando...</p>`
                : `<div class="card stack-sm" data-testid="emergency-numbers-list">
              ${numbers
                .map(
                  (n) => `
              <div class="flex-between" data-testid="emergency-number-${n.id}">
                <div class="stack-sm" style="gap:2px;">
                  <strong style="font-size:var(--text-sm);">${n.label}</strong>
                  <span class="text-xs text-muted">${n.phone}</span>
                </div>
                <a href="${n.type === 'whatsapp' ? `https://wa.me/${n.phone.replace(/[^0-9]/g, '')}` : `tel:${n.phone.replace(/[^0-9]/g, '')}`}" class="btn ${n.type === 'whatsapp' ? 'btn--green' : 'btn--turquoise'} btn--sm" style="text-decoration:none; box-shadow:none;" data-testid="btn-contact-${n.id}">${n.type === 'whatsapp' ? 'WhatsApp' : 'Llamar'}</a>
              </div>`
                )
                .join('<div style="height:1px;background:var(--color-border, #eee);"></div>')}
            </div>`
            }
            ${CURRENT_USER && CURRENT_USER.isAdmin ? `<button class="btn btn--outline" data-nav="safety-admin" data-testid="btn-manage-emergency-numbers">${icon('edit')} Administrar números</button>` : ''}
          </div>

          <div class="stack-sm">
            <span class="settings-section-title">Consejos de seguridad</span>
            <div class="card stack-sm">
              <p class="text-sm">Verifica que la otra persona tenga su identidad verificada en HAY antes de acordar algo.</p>
              <p class="text-sm">Guarda evidencia de la negociación (capturas del chat, del acuerdo) antes de entregar dinero o el producto.</p>
              <p class="text-sm">No compartas tus datos personales (teléfono, dirección, cédula) salvo que la otra parte también comparta los suyos.</p>
              <p class="text-sm">Prefiere reunirte en un lugar público y en horario de luz de día para la entrega.</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;
    },
  },

  {
    // V1.25: administración de números de emergencia — solo para el
    // moderador/admin. Agregar, editar y borrar, con etiqueta libre
    // (ej. "Policía Municipal Sucre") + número + tipo (llamada/WhatsApp).
    id: 'safety-admin',
    block: 'account',
    label: '26d. Administrar números de emergencia',
    html: () => {
      const numbers = EMERGENCY_NUMBERS_LOADING ? null : EMERGENCY_NUMBERS;
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'safety', title: 'Administrar números', testid: 'safety-admin', stacked: true })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-safety-admin">
          <div class="stack-sm">
            <span class="settings-section-title">Agregar número</span>
            <div class="card stack-sm">
              <div class="field">
                <label for="new-emergency-label">Etiqueta</label>
                <input id="new-emergency-label" type="text" placeholder="Ej. Policía Municipal Sucre" data-testid="input-new-emergency-label" />
              </div>
              <div class="field">
                <label for="new-emergency-phone">Número</label>
                <input id="new-emergency-phone" type="text" placeholder="Ej. 0212-242-2111" data-testid="input-new-emergency-phone" />
              </div>
              <div class="stack-sm">
                <span class="section-label">Tipo</span>
                <div class="pill-row" data-testid="new-emergency-type">
                  <span class="pill is-selected" data-emergency-type="call">Llamada</span>
                  <span class="pill" data-emergency-type="whatsapp">WhatsApp</span>
                </div>
              </div>
              <p class="text-xs" id="emergencyAdminErrorMsg" data-testid="safety-admin-error" style="display:none; color:var(--color-error); font-weight:600;"></p>
              <button class="btn btn--turquoise" id="btnAddEmergencyNumber" data-testid="btn-add-emergency-number">Agregar</button>
            </div>
          </div>

          <div class="stack-sm">
            <span class="settings-section-title">Números actuales</span>
            ${
              numbers === null
                ? `<p class="text-xs text-muted">Cargando...</p>`
                : numbers.length === 0
                ? `<p class="text-xs text-muted">Todavía no hay números cargados.</p>`
                : `<div class="card stack-sm" data-testid="emergency-numbers-admin-list">
              ${numbers
                .map(
                  (n) => `
              <div class="flex-between" data-testid="emergency-admin-row-${n.id}">
                <div class="stack-sm" style="gap:2px;">
                  <strong style="font-size:var(--text-sm);">${n.label}</strong>
                  <span class="text-xs text-muted">${n.phone} · ${n.type === 'whatsapp' ? 'WhatsApp' : 'Llamada'}</span>
                </div>
                <button class="icon-btn icon-btn--ghost" aria-label="Borrar" data-testid="btn-delete-emergency-${n.id}" data-delete-emergency-id="${n.id}">${icon('trash')}</button>
              </div>`
                )
                .join('<div style="height:1px;background:var(--color-border, #eee);"></div>')}
            </div>`
            }
          </div>
        </div>
      </div>
    </div>`;
    },
  },

  {
    id: 'moderation-panel',
    block: 'account',
    label: '26b. Panel de moderador',
    html: () => {
      // V1.21: los reportes se guardan desde V1.18 (POST /api/reports)
      // pero hasta ahora nadie los veía — quedaban con status:"open"
      // para siempre. Esta pantalla es la primera forma real de
      // revisarlos, solo visible para CURRENT_USER.isAdmin.
      if (!CURRENT_USER || !CURRENT_USER.isAdmin) {
        return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'settings', title: 'Panel de moderador', testid: 'moderation', stacked: true })}
      <div class="screen-body">
        <div class="screen-content screen-content--centered" data-testid="screen-moderation-panel">
          <p class="text-sm text-muted" style="text-align:center;">No tienes permiso de moderador para ver esta pantalla.</p>
        </div>
      </div>
    </div>`;
      }
      const STATUS_BADGE = {
        open: '<span class="badge badge--paused">Pendiente</span>',
        reviewed: '<span class="badge badge--active">Revisado</span>',
        dismissed: '<span class="badge badge--sold">Descartado</span>',
      };
      const reportsHtml = REPORTS_LOADING
        ? `<p class="text-sm text-muted" style="text-align:center; margin-top:var(--space-6);">Cargando reportes...</p>`
        : !REPORTS.length
        ? `<p class="text-sm text-muted" style="text-align:center; margin-top:var(--space-6);">No hay reportes todavía.</p>`
        : REPORTS.map(
            (r) => `
          <div class="card stack-sm" data-testid="report-row" data-report-id="${r.id}">
            <div class="flex-between">
              <span class="text-xs" style="font-weight:800; color:var(--hay-navy); text-transform:uppercase;">${r.type === 'user' ? 'Reporte a vendedor' : 'Problema de la app'}</span>
              ${STATUS_BADGE[r.status] || STATUS_BADGE.open}
            </div>
            <p class="text-sm" style="font-weight:700;">${r.reason}</p>
            ${r.details ? `<p class="text-xs text-muted">${r.details}</p>` : ''}
            <p class="text-xs text-faint">
              De: ${r.fromUserEmail || r.fromUserId}${r.targetUserEmail ? ` · Sobre: ${r.targetUserEmail}` : ''}<br/>
              ${new Date(r.createdAt).toLocaleString('es-US')}
            </p>
            ${r.status !== 'open' && r.moderatorNote ? `<p class="text-xs" style="font-style:italic; color:var(--color-text-muted);">Nota: ${r.moderatorNote}</p>` : ''}
            ${
              r.status === 'open'
                ? `<div class="btn--block-row">
              <button class="btn btn--outline btn--sm" style="flex:1" data-action="dismiss-report" data-testid="btn-dismiss-report">Descartar</button>
              <button class="btn btn--turquoise btn--sm" style="flex:1" data-action="review-report" data-testid="btn-review-report">Marcar revisado</button>
            </div>`
                : ''
            }
          </div>`
          ).join('');
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'settings', title: 'Panel de moderador', testid: 'moderation', stacked: true })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-3)" data-testid="screen-moderation-panel">
          <p class="text-xs" id="moderationErrorMsg" data-testid="moderation-error-msg" style="display:none; color:var(--color-error);"></p>
          <span class="settings-section-title">Verificaciones de identidad (${IDENTITIES_LOADING ? '…' : IDENTITIES.length})</span>
          ${IDENTITIES_LOADING ? '' : IDENTITIES.length === 0 ? `<p class="text-xs text-muted">Nadie envió verificación todavía.</p>` : IDENTITIES.map((it) => `
          <div class="card stack-sm" data-testid="identity-row">
            <div class="flex-between">
              <span class="text-sm fw-800" style="word-break:break-all;">${it.email}</span>
              <span class="badge badge--paused">Enviada</span>
            </div>
            <span class="text-xs text-faint">${new Date(it.submittedAt).toLocaleString('es-VE')}</span>
            <button class="btn btn--outline btn--sm" data-view-identity="${it.userId}" data-testid="btn-view-identity">Ver fotos</button>
            <div data-identity-photos="${it.userId}" style="display:none; gap:4%;"></div>
          </div>`).join('')}
          <span class="settings-section-title">Reportes</span>
          ${reportsHtml}
        </div>
      </div>
    </div>`;
    },
  },

  {
    // V1.28: verificación de identidad (foto de cédula + selfie). Estilo
    // de la referencia "6. Verificación facial". Por ahora solo se
    // capturan y guardan (cifradas y privadas); no hay aprobación
    // automática todavía — la revisa un moderador si hace falta.
    id: 'verify-identity',
    block: 'account',
    label: '27. Verificar identidad',
    html: () => {
      const done = CURRENT_USER && CURRENT_USER.identityStatus && CURRENT_USER.identityStatus !== 'none';
      const slot = (kind, title, hint, capture, iconName) => {
        const img = IDENTITY_DRAFT[kind];
        return `
          <label class="card flex-row" style="cursor:pointer; padding:var(--space-3); gap:var(--space-3);" data-testid="identity-slot-${kind}">
            ${img
              ? `<img src="${img}" alt="${title}" style="width:64px; height:64px; object-fit:cover; border-radius:12px; flex-shrink:0;" />`
              : `<span class="list-row__icon tone-cyan" style="width:64px; height:64px; border-radius:12px;">${icon(iconName)}</span>`}
            <span class="grow">
              <span class="list-row__title" style="display:block;">${title}</span>
              <span class="list-row__sub" style="white-space:normal;">${img ? 'Lista ✓ · toca para cambiarla' : hint}</span>
            </span>
            ${img ? `<span class="badge badge--active">✓</span>` : icon('camera', 'list-row__chevron')}
            <input type="file" accept="image/*" capture="${capture}" data-identity-input="${kind}" data-testid="input-identity-${kind}" style="display:none;" />
          </label>`;
      };
      return `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4); padding-top:0;" data-testid="screen-verify-identity">
          <button class="icon-btn" data-nav="${CURRENT_USER ? 'profile' : 'home'}" aria-label="Volver" data-testid="btn-back-verify-identity">${icon('back')}</button>
          <div class="hero hero--cyan" style="width:150px;height:150px;">
            <svg class="hero__rays" viewBox="0 0 100 100" fill="none" stroke="var(--hay-navy)" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M14 30V18a4 4 0 0 1 4-4h12M70 14h12a4 4 0 0 1 4 4v12M86 70v12a4 4 0 0 1-4 4H70M30 86H18a4 4 0 0 1-4-4V70"/></svg>
            <div class="hero__circle">${icon('user')}</div>
          </div>
          <div class="text-center stack-sm">
            <h2 class="screen-title" style="font-size:24px;">Verifica tu identidad</h2>
            <p class="screen-subtitle">${done ? 'Ya enviaste tu verificación. ¡Gracias! Si quieres, puedes reemplazar las fotos.' : 'Para publicar en HAY necesitamos una foto de tu cédula y una selfie. Así la comunidad es más segura.'}</p>
          </div>
          ${done ? `<span class="badge badge--active" style="align-self:center; padding:6px 14px;" data-testid="identity-status-done">✓ Verificación enviada</span>` : ''}
          ${slot('cedula', '1. Foto de tu cédula', 'Del lado de la foto, que se lea bien', 'environment', 'shield')}
          ${slot('selfie', '2. Selfie', 'Tu cara de frente, con buena luz', 'user', 'user')}
          <p class="text-xs text-muted" style="font-weight:600; display:flex; gap:8px; align-items:flex-start;">${icon('lock', 'icon-16')} <span>Tus fotos se guardan cifradas y en privado. Nunca se muestran en tus publicaciones; solo el equipo de moderación puede verlas si hace falta revisar un caso.</span></p>
          <p class="text-xs" id="identityErrorMsg" data-testid="identity-error-msg" style="display:none; color:var(--color-error); font-weight:700;"></p>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--turquoise" id="btnSubmitIdentity" data-testid="btn-submit-identity" ${IDENTITY_DRAFT.cedula && IDENTITY_DRAFT.selfie ? '' : 'disabled'}>Enviar verificación</button>
      </div>
    </div>`;
    },
  },

  {
    // V1.30: eliminar la cuenta — Google Play exige que se pueda hacer
    // desde la app. Pide escribir ELIMINAR (y la contraseña si la cuenta
    // tiene una) para evitar borrados por accidente.
    id: 'delete-account',
    block: 'account',
    label: '28. Eliminar cuenta',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'settings', title: 'Eliminar mi cuenta', testid: 'delete-account', stacked: true })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-delete-account">
          ${heroIcon('trash', 'pink', { size: 120 })}
          <div class="card stack-sm">
            <p class="section-label">Esto no se puede deshacer</p>
            <p class="text-sm text-muted" style="font-weight:600;">Se borran para siempre: tu cuenta, todas tus publicaciones y sus fotos, y tus fotos de verificación de identidad. Los mensajes que ya recibieron otras personas quedarán como "Usuario eliminado".</p>
          </div>
          ${CURRENT_USER && CURRENT_USER.hasPassword !== false ? `
          <div class="field">
            <label for="del-pass">Tu contraseña</label>
            <input id="del-pass" type="password" placeholder="Contraseña" data-testid="input-delete-password" />
            <span class="field--help">Si entraste con Google y no tienes contraseña, déjalo vacío.</span>
          </div>` : ''}
          <div class="field">
            <label for="del-confirm">Escribe ELIMINAR para confirmar</label>
            <input id="del-confirm" type="text" autocomplete="off" placeholder="ELIMINAR" data-testid="input-delete-confirm" />
          </div>
          <p class="text-xs" id="deleteErrorMsg" data-testid="delete-error-msg" style="display:none; color:var(--color-error); font-weight:700;"></p>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--outline" data-nav="settings" data-testid="btn-cancel-delete">Cancelar</button>
        <button class="btn btn--danger" id="btnConfirmDeleteAccount" data-testid="btn-confirm-delete-account">Eliminar</button>
      </div>
    </div>`,
  },
];
