/* screens-transaction.js — Bloque 4: Detalle y transacción (pantallas 16-21) */

const SCREENS_TRANSACTION = [
  {
    id: 'product-detail',
    block: 'transaction',
    label: '16. Detalle de producto',
    html: () => {
      // V1.7: mostrar la publicación real que se tocó (CURRENT_PRODUCT_ID),
      // en vez de esta bicicleta de muestra fija. Si no se encuentra (por
      // ejemplo, se entró a esta pantalla sin haber tocado una tarjeta
      // antes), se cae de vuelta al contenido de muestra original, para
      // que el prototipo nunca se rompa ni quede en blanco.
      const listing = findListingById(CURRENT_PRODUCT_ID);
      const title = listing ? listing.title : 'Bicicleta montaña rodado 26';
      const price = listing ? listing.price : 180;
      const condition = listing ? listing.condition : 'Usado';
      const description = listing ? (listing.description || 'El vendedor no escribió una descripción.') : 'Bicicleta rodado 26 en buen estado, frenos y cambios recién ajustados. Ideal para uso diario o senderos ligeros. Se entrega con casco de regalo.';
      const zone = listing ? listing.zone : 'Wynwood, Miami, FL';
      const productIcon = listing ? listing.icon : 'bike';
      const artClass = listing ? listing.art : 1;
      const hasRealSeller = Boolean(listing && listing.sellerId);
      const sellerLabel = hasRealSeller ? listing.sellerEmail : 'Carlos M. (vendedor de muestra)';
      const sellerInitials = hasRealSeller ? listing.sellerEmail.slice(0, 2).toUpperCase() : 'CM';
      const isOwnListing = Boolean(hasRealSeller && CURRENT_USER && CURRENT_USER.id === listing.sellerId);
      // V1.17: promedio real de calificaciones del vendedor (antes era
      // "5.0 (18)" fijo sin importar quién vendiera). Se pinta a partir
      // de la caché que llena navigateTo() con un fetch async.
      const sellerRatingInfo = hasRealSeller ? RATINGS_CACHE.get(listing.sellerId) : null;
      const sellerRatingHtml = !hasRealSeller
        ? `<div class="flex-row" style="gap:4px;">${stars(5)}<span class="text-xs text-muted">5.0 (18)</span></div>`
        : !sellerRatingInfo
        ? `<span class="text-xs text-faint">Cargando reputación...</span>`
        : sellerRatingInfo.count === 0
        ? `<span class="text-xs text-faint">Todavía sin calificaciones</span>`
        : `<div class="flex-row" style="gap:4px;">${stars(sellerRatingInfo.average)}<span class="text-xs text-muted">${sellerRatingInfo.average.toFixed(1)} (${sellerRatingInfo.count} calificaci${sellerRatingInfo.count === 1 ? 'ón' : 'ones'})</span></div>`;
      // V1.32: foto a todo lo ancho arriba (protagonista), hoja blanca con
      // precio, estado, vendedor y descripción, y dos botones abajo:
      // "Hacer oferta" (contorno) y "Escribir" (acción principal).
      return `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="product-hero">
          ${listingArt(listing || { art: artClass, icon: productIcon, title }, 'product-hero__art', '', '', { full: true, eager: true })}
          <div class="product-hero__bar">
            <button class="icon-btn" data-nav="home" aria-label="Volver" data-testid="btn-back-product-detail">${icon('back')}</button>
            <div class="flex-row" style="gap:var(--space-2);">
              <button class="icon-btn" aria-label="Compartir" data-testid="btn-share-product">
                <svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.7l7.6-4.4M8.2 13.3l7.6 4.4"/></svg>
              </button>
              ${listing ? `<button class="icon-btn icon-btn--pink ${isFav(listing.id) ? 'is-fav' : ''}" aria-pressed="${isFav(listing.id)}" aria-label="${isFav(listing.id) ? 'Quitar de favoritos' : 'Guardar en favoritos'}" data-fav-id="${listing.id}" data-testid="btn-fab-favorite">${icon('heart')}</button>` : ''}
            </div>
          </div>
        </div>
        <div class="screen-content product-sheet" data-testid="screen-product-detail">
          <div class="flex-between">
            <span class="product-detail__price">$${price}${HAY_APP_MODE && bsLabel(price) ? ` <small class="price-bs price-bs--lg" data-testid="detail-price-bs">${bsLabel(price)}</small>` : ''}</span>
            <span class="badge badge--active">${condition}</span>
          </div>
          <h2 class="product-detail__title">${title}</h2>
          <span class="product-card__meta" style="margin-top:-6px;">${icon('pin')} ${zone || 'Zona no indicada'}${HAY_APP_MODE && listing && distanceLabel(listing) ? ' · ' + distanceLabel(listing) : ''}</span>

          <button class="card flex-row" style="width:100%; text-align:left; padding:var(--space-3);" data-nav="seller-profile" data-testid="btn-open-seller-profile">
            <div class="avatar avatar--md avatar--4">${sellerInitials}</div>
            <div class="grow" style="min-width:0;">
              <p style="font-weight:700; font-size:16px; color:var(--hay-navy); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sellerLabel}</p>
              ${sellerRatingHtml}
            </div>
            <span class="link-cyan" style="font-size:14px; flex-shrink:0;">Ver perfil</span>
          </button>
          ${isOwnListing ? `<p class="badge badge--cyan" style="align-self:flex-start;" data-testid="own-listing-notice">Esta es tu propia publicación</p>` : ''}

          <p style="font-size:16px; line-height:1.55; color:var(--hay-navy);">${description}</p>

          <div class="stack-sm">
            <span class="section-label">Ubicación aproximada</span>
            ${HAY_APP_MODE && listing && typeof listing.lat === 'number'
              ? osmMap(listing.lat, listing.lng, 'product-map')
              : `<div class="map-ph"><div class="map-ph__pin">${icon('pin')}</div></div>${HAY_APP_MODE ? `<span class="text-xs text-muted">El vendedor no marcó la ubicación en el mapa${zone ? '; zona indicada: ' + zone : ''}.</span>` : ''}`}
          </div>
        </div>
      </div>
      <div class="bottom-cta bottom-cta--bar">
        <button class="btn btn--outline" style="flex:0 0 auto; width:auto; padding-left:22px; padding-right:22px;" data-nav="make-offer" data-testid="btn-make-offer">Hacer oferta</button>
        <button class="btn btn--turquoise" data-nav="chat-detail" data-testid="btn-buy-now">${icon('chat')} Escribir</button>
      </div>
    </div>`;
    },
  },

  {
    id: 'make-offer',
    block: 'transaction',
    label: '17. Hacer oferta',
    html: () => {
      const listing = findListingById(CURRENT_PRODUCT_ID);
      const title = listing ? listing.title : 'Bicicleta montaña rodado 26';
      const price = listing ? listing.price : 180;
      const productIcon = listing ? listing.icon : 'bike';
      return `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4); padding-top:0;" data-testid="screen-make-offer">
            <button class="icon-btn" data-nav="product-detail" aria-label="Cerrar" data-testid="btn-close-make-offer">${icon('back')}</button>
            ${heroIcon('offer', 'pink', { size: 140 })}
            <h3 class="screen-title text-center" style="font-size:24px">Haz una oferta</h3>
            <div class="flex-row card" style="padding:var(--space-2);">
              ${listingArt(listing || { art: 1, icon: productIcon }, '', 'width:52px; aspect-ratio:1/1; border-radius:10px;')}
              <div class="grow">
                <p style="font-size:15px; font-weight:700; color:var(--hay-navy)">${title}</p>
                <span class="text-xs text-muted">Precio publicado: $${price}</span>
              </div>
            </div>
            <div class="field">
              <label for="offer-amount">Tu oferta (USD)</label>
              <input id="offer-amount" type="text" value="${Math.max(0, Math.round(price * 0.85))}" data-testid="input-offer-amount" style="font-family:var(--font-display); font-size:28px; font-weight:700;" />
              <span class="field--help">El vendedor recibirá tu oferta y podrá aceptar, rechazar o contraofertar.</span>
            </div>
            <div class="field">
              <label for="offer-msg">Mensaje (opcional)</label>
              <textarea id="offer-msg" placeholder="Ej. Puedo pasar a recogerla hoy mismo" data-testid="input-offer-message"></textarea>
            </div>
            <p class="text-xs" id="offerErrorMsg" data-testid="offer-error-msg" style="display:none; color:var(--color-error);"></p>
            <button class="btn btn--yellow" id="btnSendOffer" data-testid="btn-send-offer">Enviar oferta</button>
        </div>
      </div>
    </div>`;
    },
  },

  {
    id: 'offer-sent',
    block: 'transaction',
    label: '17b. Oferta enviada',
    html: () => {
      const sellerLabel = LAST_OFFER ? LAST_OFFER.sellerLabel : 'Carlos M.';
      const amount = LAST_OFFER ? LAST_OFFER.amount : 150;
      const title = LAST_OFFER ? LAST_OFFER.title : 'Bicicleta montaña rodado 26';
      return `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content screen-content--centered" data-testid="screen-offer-sent">
          ${heroIcon('offer', 'yellow', { size: 160 })}
          <h2 class="screen-title">¡Oferta enviada!</h2>
          <p class="screen-subtitle">Le avisamos a ${sellerLabel} que ofreces $${amount} por "${title}". Te notificaremos su respuesta.</p>
          <button class="btn btn--turquoise" data-nav="chat-detail" data-testid="btn-go-chat-after-offer">Ir al chat</button>
          <button class="btn btn--outline" data-nav="home" data-testid="btn-go-home-after-offer">Seguir explorando</button>
        </div>
      </div>
    </div>`;
    },
  },

  {
    id: 'seller-profile',
    block: 'transaction',
    label: '18. Perfil público del vendedor',
    html: () => {
      // V1.17: antes esta pantalla era 100% fija ("Carlos M.", 5.0 (18),
      // siempre los mismos 4 productos de muestra) sin importar qué
      // vendedor se hubiera tocado. Se llega siempre desde "Detalle de
      // producto" sin cambiar CURRENT_PRODUCT_ID en el medio, así que
      // reusamos esa misma publicación para saber quién es el vendedor real.
      const listing = findListingById(CURRENT_PRODUCT_ID);
      const hasRealSeller = Boolean(listing && listing.sellerId);
      const sellerLabel = hasRealSeller ? listing.sellerEmail : 'Carlos M.';
      const sellerInitials = hasRealSeller ? listing.sellerEmail.slice(0, 2).toUpperCase() : 'CM';
      const sellerRatingInfo = hasRealSeller ? RATINGS_CACHE.get(listing.sellerId) : null;
      const sellerRatingHtml = !hasRealSeller
        ? `<div class="flex-row" style="gap:6px;">${stars(5)}<span class="text-xs text-muted">5.0 (18 calificaciones)</span></div>`
        : !sellerRatingInfo
        ? `<span class="text-xs text-faint">Cargando reputación...</span>`
        : sellerRatingInfo.count === 0
        ? `<span class="text-xs text-faint">Todavía sin calificaciones</span>`
        : `<div class="flex-row" style="gap:6px;">${stars(sellerRatingInfo.average)}<span class="text-xs text-muted">${sellerRatingInfo.average.toFixed(1)} (${sellerRatingInfo.count} calificaci${sellerRatingInfo.count === 1 ? 'ón' : 'ones'})</span></div>`;
      // Sus otras publicaciones activas: reales, salidas de ALL_LISTINGS
      // (ya cargado por Inicio/Buscar), no un grid de muestra fijo.
      const sellerActiveListings = hasRealSeller
        ? (HAY_APP_MODE && SELLER_LISTINGS.has(listing.sellerId) ? SELLER_LISTINGS.get(listing.sellerId) : ALL_LISTINGS)
            .filter((l) => l.sellerId === listing.sellerId && l.id !== listing.id && (!l.status || l.status === 'active'))
        : [];
      const sellerListingsHtml = hasRealSeller
        ? sellerActiveListings.length
          ? `<div class="product-grid">${sellerActiveListings.slice(0, HAY_APP_MODE ? 10 : 4).map((l) => productCard(mapListingFromApi(l))).join('')}</div>`
          : `<p class="text-xs text-faint">No tiene otras publicaciones activas por ahora.</p>`
        : `<div class="product-grid">${PRODUCTS.slice(0, 4).map((p) => productCard(p)).join('')}</div>`;
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'product-detail', title: 'Perfil del vendedor', testid: 'seller' })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-seller-profile">
          <div class="stack text-center" style="align-items:center;">
            <div class="avatar avatar--lg avatar--4">${sellerInitials}</div>
            <h2 style="font-family:var(--font-display); font-size:24px; font-weight:600; color:var(--hay-navy); word-break:break-word;">${sellerLabel}</h2>
            ${sellerRatingHtml}
            ${hasRealSeller ? '' : `<span class="text-xs text-faint">Miembro desde marzo 2022 · Miami, FL</span>`}
          </div>
          <div class="btn--block-row">
            <button class="btn btn--pink" style="flex:1" data-nav="report" data-testid="btn-report-seller">Reportar</button>
            <button class="btn btn--turquoise" style="flex:1" data-nav="chat-detail" data-testid="btn-message-seller">Mensaje</button>
          </div>
          <div class="flex-between">
            <span class="section-label">Sus publicaciones activas</span>
            <span class="badge badge--cyan">${hasRealSeller ? sellerActiveListings.length : 6}</span>
          </div>
          ${sellerListingsHtml}
        </div>
      </div>
    </div>`;
    },
  },

  {
    id: 'chat-detail',
    block: 'transaction',
    label: '19. Chat individual',
    html: () => {
      // V1.7: chat real sobre CURRENT_CHAT (quién + qué publicación).
      // Si no hay contexto (se entró sin pasar por product-detail ni
      // por la lista de Mensajes), se muestra el chat de muestra
      // original para no dejar la pantalla rota.
      if (!CURRENT_CHAT) {
        return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'messages', title: 'Carlos M.', testid: 'chat' })}
      <div class="chat-product-pin" data-testid="chat-product-pin">
        <div class="ph-art ph-art--1">${icon('bike')}</div>
        <div class="grow">
          <p class="text-xs fw-800" style="color:var(--hay-navy)">Bicicleta montaña rodado 26</p>
          <span class="text-xs text-faint">$180 · Wynwood, Miami, FL</span>
        </div>
      </div>
      <div class="screen-body">
        <div class="chat-messages" data-testid="chat-messages">
          <div class="bubble-row bubble-row--in"><span class="bubble-avatar">${icon('user')}</span><div class="bubble bubble--in">Hola, ¿todavía está disponible la bici?</div></div>
          <div class="bubble bubble--out">¡Sí! Está disponible, la tengo en Wynwood.</div>
        </div>
      </div>
      <div class="chat-input-row">
        <div class="chat-input-row__box">
          <input type="text" placeholder="Escribe un mensaje" data-testid="input-chat-message" disabled />
          <button class="chat-send" aria-label="Enviar mensaje" data-testid="btn-send-chat-message" disabled>${icon('send')}</button>
        </div>
      </div>
    </div>`;
      }

      const listing = findListingById(CURRENT_CHAT.listingId);
      const listingTitle = CURRENT_CHAT.listingTitle || (listing ? listing.title : 'Publicación');
      const otherLabel = CURRENT_CHAT.otherUserEmail || 'Usuario';
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'messages', title: `${otherLabel} <span class="live-dot" title="Actualización en vivo" data-testid="chat-live-dot"></span>`, testid: 'chat' })}
      <div class="chat-product-pin" data-testid="chat-product-pin">
        ${listingArt(listing || { art: 1, icon: 'tag' })}
        <div class="grow">
          <p style="font-size:15px; font-weight:700; color:var(--hay-navy)">${listingTitle}</p>
          ${listing ? `<span style="font-family:var(--font-display); font-weight:700; font-size:15px;">$${listing.price}</span> <span class="text-xs text-muted">· ${listing.zone || ''}</span>` : ''}
        </div>
      </div>
      <div class="screen-body">
        <div class="chat-messages" data-testid="chat-messages">
          ${CHAT_LOADING ? `
            <p class="empty-msg">Cargando conversación...</p>
          ` : CHAT_MESSAGES.length === 0 ? `
            <p class="empty-msg">Todavía no hay mensajes. ¡Escribe el primero!</p>
          ` : CHAT_MESSAGES.map((m) => `
            ${m.type === 'offer' ? `
            <div class="bubble ${m.fromUserId === CURRENT_USER.id ? 'bubble--out' : 'bubble--in'} bubble--offer" data-testid="offer-bubble-${m.id}">
              <strong class="offer-label">OFERTA</strong><span class="offer-amount">$${m.amount}</span>
              ${m.text}
              ${m.offerStatus === 'accepted' ? `
              <p class="offer-status offer-status--ok">✓ Oferta aceptada</p>
              ${m.toUserId === CURRENT_USER?.id ? `
              <button class="btn btn--sm btn--green" style="margin-top:8px;" data-mark-sold-from-offer data-message-id="${m.id}" data-listing-id="${m.listingId}" data-buyer-id="${m.fromUserId}" data-amount="${m.amount}" data-testid="btn-mark-sold-${m.id}">Marcar como vendido</button>
              ` : ''}` : ''}
              ${m.offerStatus === 'rejected' ? `<p class="offer-status offer-status--no">✕ Oferta rechazada</p>` : ''}
              ${m.offerStatus === 'countered' ? `<p class="offer-status">↻ Contraofertada</p>` : ''}
              ${m.offerStatus === 'pending' && m.toUserId === CURRENT_USER.id && COUNTER_OFFER_OPEN_FOR !== m.id ? `
              <div class="flex-row" style="gap:8px; margin-top:8px; flex-wrap:wrap;">
                <button class="btn btn--sm btn--green" data-offer-response="accepted" data-message-id="${m.id}" data-testid="btn-accept-offer-${m.id}">Aceptar</button>
                <button class="btn btn--sm btn--outline" data-offer-response="rejected" data-message-id="${m.id}" data-testid="btn-reject-offer-${m.id}">Rechazar</button>
                <button class="btn btn--sm btn--outline" data-open-counter-offer data-message-id="${m.id}" data-testid="btn-counter-offer-${m.id}">Contraofertar</button>
              </div>` : ''}
              ${m.offerStatus === 'pending' && m.toUserId === CURRENT_USER.id && COUNTER_OFFER_OPEN_FOR === m.id ? `
              <div class="stack-sm" style="margin-top:8px;">
                <input type="text" inputmode="numeric" placeholder="Tu contraoferta (USD)" value="${Math.max(0, Math.round(m.amount * 0.9))}" data-counter-offer-input data-message-id="${m.id}" data-testid="input-counter-offer-${m.id}" style="min-height:36px;" />
                <div class="flex-row" style="gap:8px;">
                  <button class="btn btn--sm btn--yellow" data-send-counter-offer data-message-id="${m.id}" data-testid="btn-send-counter-offer-${m.id}">Enviar contraoferta</button>
                  <button class="btn btn--sm btn--outline" data-cancel-counter-offer data-testid="btn-cancel-counter-offer-${m.id}">Cancelar</button>
                </div>
              </div>` : ''}
              ${m.offerStatus === 'pending' && m.fromUserId === CURRENT_USER.id ? `<p class="text-xs text-faint" style="margin-top:6px;">Esperando respuesta...</p>` : ''}
            </div>` : `
            ${m.fromUserId === CURRENT_USER.id
              ? `<div class="bubble bubble--out">${m.text}</div>`
              : `<div class="bubble-row bubble-row--in"><span class="bubble-avatar">${icon('user')}</span><div class="bubble bubble--in">${m.text}</div></div>`}`}
          `).join('')}
        </div>
      </div>
      <p class="text-xs" id="chatErrorMsg" data-testid="chat-error-msg" style="display:none; color:var(--color-error); padding:0 var(--space-4);"></p>
      <div class="chat-input-row">
        <div class="chat-input-row__box">
          <input type="text" placeholder="Escribe un mensaje" data-testid="input-chat-message" id="chatMessageInput" />
          <button class="chat-send" aria-label="Enviar mensaje" data-testid="btn-send-chat-message" id="btnSendChatMessage">${icon('send')}</button>
        </div>
      </div>
    </div>`;
    },
  },

  {
    id: 'confirm-sale',
    block: 'transaction',
    label: '20. Confirmar venta',
    html: () => {
      // V1.10: antes esta pantalla era 100% de muestra (bici fija, "Carlos
      // M.", $180/$165 siempre) sin importar qué oferta se hubiera aceptado.
      // Ahora usa CURRENT_SALE, cargado real al tocar "Marcar como vendido"
      // desde una oferta aceptada en el chat.
      const sale = CURRENT_SALE;
      const listing = sale ? findListingById(sale.listingId) : null;
      const title = listing ? listing.title : (sale ? sale.listingTitle : 'Publicación');
      const publishedPrice = listing ? listing.price : (sale ? sale.amount : '');
      const buyerLabel = sale ? (sale.buyerEmail || sale.buyerId) : '';
      const finalPriceValue = sale ? sale.amount : '';
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: 'chat-detail', title: 'Confirmar venta', testid: 'confirm-sale' })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-confirm-sale">
          <div class="price-hero">
            <span class="pay-card-icon" aria-hidden="true"></span>
            <span class="price-hero__label">Total</span>
            <span class="price-hero__value" data-testid="confirm-sale-total">$${finalPriceValue || publishedPrice || 0}</span>
          </div>
          <p class="screen-subtitle text-center">Vas a marcar este producto como vendido. Esta acción lo quitará del feed de HAY.</p>
          ${!sale ? `<p class="text-xs" style="color:var(--color-error); text-align:center;">No hay una venta en curso. Vuelve al chat y acepta una oferta primero.</p>` : `
          <div class="card flex-row" style="padding:var(--space-3);">
            ${listingArt(listing || { art: 1, icon: 'tag' }, '', 'width:56px; aspect-ratio:1/1; border-radius:10px;')}
            <div class="grow">
              <p class="text-sm fw-800" style="color:var(--hay-navy)">${title}</p>
              <span class="text-xs text-faint">Precio publicado: $${publishedPrice}</span>
            </div>
          </div>
          <div class="field">
            <label for="sale-buyer">Comprador</label>
            <input id="sale-buyer" type="text" value="${buyerLabel}" disabled data-testid="input-sale-buyer" />
          </div>
          <div class="field">
            <label for="sale-price">Precio final de venta (USD)</label>
            <input id="sale-price" type="text" value="${finalPriceValue}" data-testid="input-sale-final-price" />
          </div>
          <p class="text-xs" id="saleErrorMsg" data-testid="sale-error-msg" style="display:none; color:var(--color-error);"></p>
          `}
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--outline" data-nav="chat-detail" data-testid="btn-cancel-confirm-sale">Cancelar</button>
        <button class="btn btn--yellow" ${!sale ? 'disabled' : ''} id="btnConfirmMarkSold" data-testid="btn-confirm-mark-sold">Marcar como vendido</button>
      </div>
    </div>`;
    },
  },

  {
    id: 'rate-transaction',
    block: 'transaction',
    label: '21. Calificar',
    html: () => {
      // V1.10: usa LAST_SALE (la venta que se acaba de confirmar de
      // verdad) en vez del "Carlos M." fijo de antes.
      const sale = LAST_SALE;
      const buyerLabel = sale ? (sale.buyerEmail || sale.buyerId) : 'el comprador';
      const initials = sale && sale.buyerEmail ? sale.buyerEmail.slice(0, 2).toUpperCase() : '??';
      return `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-rate-transaction">
          <div class="text-center stack-sm" style="align-items:center; margin-top:var(--space-4);">
            <div class="avatar avatar--md avatar--2">${initials}</div>
            <span class="badge badge--active">¡Venta completada!</span>
          </div>
          <div class="stars-card flex-row" style="justify-content:center; gap:var(--space-2);" data-testid="rating-stars-input">
            ${Array.from({ length: 5 })
              .map(
                (_, i) => `
              <button aria-label="${i + 1} estrellas" data-testid="star-${i + 1}" style="width:42px;height:42px; display:flex; align-items:center; justify-content:center;">
                <svg viewBox="0 0 24 24" style="width:40px;height:40px; fill:${i < SELECTED_RATING_STARS ? 'var(--hay-yellow)' : 'none'}; stroke:${i < SELECTED_RATING_STARS ? 'var(--hay-yellow)' : '#d9dfe8'}; stroke-width:1.5; stroke-linejoin:round;"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.6L12 17.5l-5.8 3.1 1.1-6.6-4.8-4.6 6.6-.9z"/></svg>
              </button>`
              )
              .join('')}
          </div>
          <div class="text-center stack-sm">
            <h2 class="screen-title" style="font-size:26px;">¿Cómo fue tu experiencia?</h2>
            <p class="screen-subtitle">Vendiéndole a ${buyerLabel}</p>
          </div>
          <div class="field">
            <label for="rate-comment">Cuéntanos más (opcional)</label>
            <textarea id="rate-comment" placeholder="Ej. Puntual, buena comunicación y el producto tal cual la descripción." data-testid="input-rate-comment"></textarea>
          </div>
          <p class="text-xs" id="rateErrorMsg" data-testid="rate-error-msg" style="display:none; color:var(--color-error);"></p>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--outline" data-nav="my-listings" data-testid="btn-skip-rating">Ahora no</button>
        <button class="btn btn--turquoise" id="btnSubmitRating" data-testid="btn-submit-rating">Enviar calificación</button>
      </div>
    </div>`;
    },
  },

  {
    id: 'report',
    block: 'transaction',
    label: '22. Reportar',
    html: () => {
      // V1.18: antes "Reportar" (perfil del vendedor) y "Reportar un
      // problema" (configuración) eran botones sin ninguna función.
      // Esta misma pantalla sirve para los dos casos, según
      // REPORT_CONTEXT.type, seteado justo antes de navegar acá.
      const ctx = REPORT_CONTEXT || { type: 'problem', returnScreen: 'settings' };
      const isUserReport = ctx.type === 'user';
      const title = isUserReport ? `Reportar a ${ctx.targetLabel || 'este vendedor'}` : 'Reportar un problema';
      const subtitle = isUserReport
        ? 'Contanos qué pasó. Tu reporte es confidencial y nuestro equipo lo va a revisar.'
        : 'Contanos qué encontraste. Tu reporte es confidencial y nuestro equipo lo va a revisar.';
      const reasons = isUserReport
        ? ['Estafa o fraude', 'Comportamiento abusivo', 'Producto falso o prohibido', 'Otro']
        : ['Error técnico', 'Contenido inapropiado', 'Problema de seguridad', 'Otro'];
      // V1.26: ícono y color por motivo (solo visual, como en la referencia)
      const REASON_LOOK = {
        'Estafa o fraude': ['user', 'cyan'],
        'Comportamiento abusivo': ['chat', 'pink'],
        'Producto falso o prohibido': ['close', 'green'],
        'Error técnico': ['bolt', 'cyan'],
        'Contenido inapropiado': ['close', 'green'],
        'Problema de seguridad': ['shield', 'pink'],
        Otro: ['more', 'yellow'],
      };
      return `
    <div class="phone__screen">
      ${statusBar()}
      ${topBar({ back: ctx.returnScreen || 'home', title: 'Reportar', testid: 'report' })}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-report">
          ${heroIcon('alert', 'pink', { size: 130, halo: true })}
          <div class="stack-sm text-center">
            <h2 class="screen-title" style="font-size:22px">${title}</h2>
            <p class="screen-subtitle">${subtitle}</p>
          </div>
          <div class="stack-sm">
            <span class="section-label">Motivo</span>
            <div class="chip-row reason-list" data-testid="report-reason-chips">
              ${reasons.map((r) => {
                const look = REASON_LOOK[r] || ['help', 'cyan'];
                return `<span class="chip reason-chip" data-value="${r}"><span class="list-row__icon tone-${look[1]}">${icon(look[0])}</span><span class="grow">${r}</span>${icon('chevronRight', 'list-row__chevron')}</span>`;
              }).join('')}
            </div>
          </div>
          <div class="field">
            <label for="report-details">Detalles (opcional)</label>
            <textarea id="report-details" placeholder="Agrega cualquier detalle que ayude a entender lo que pasó." data-testid="input-report-details"></textarea>
          </div>
          <p class="text-xs" id="reportErrorMsg" data-testid="report-error-msg" style="display:none; color:var(--color-error);"></p>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--outline" data-nav="${ctx.returnScreen || 'home'}" data-testid="btn-cancel-report">Cancelar</button>
        <button class="btn btn--pink" id="btnSubmitReport" data-testid="btn-submit-report">Enviar reporte</button>
      </div>
    </div>`;
    },
  },

  {
    id: 'report-sent',
    block: 'transaction',
    label: '22b. Reporte enviado',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      <div class="screen-body">
        <div class="screen-content screen-content--centered" data-testid="screen-report-sent">
          ${heroIcon('check', 'green', { size: 160 })}
          <h2 class="screen-title">Reporte enviado</h2>
          <p class="screen-subtitle">Gracias por avisarnos. Nuestro equipo lo va a revisar y, si hace falta, se pondrá en contacto contigo.</p>
          <button class="btn btn--turquoise" id="btnReportDone" data-testid="btn-report-done">Listo</button>
        </div>
      </div>
    </div>`,
  },
];
