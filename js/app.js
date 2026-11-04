/* app.js — motor de navegación del prototipo (sin backend) */

const ALL_SCREENS = [
  ...SCREENS_ONBOARDING,
  ...SCREENS_MAIN,
  ...SCREENS_PUBLISH,
  ...SCREENS_TRANSACTION,
  ...SCREENS_ACCOUNT,
];

const SCREEN_MAP = Object.fromEntries(ALL_SCREENS.map((s) => [s.id, s]));

/* V1.16: actualización en vivo del chat. Este prototipo no tiene
   WebSockets, así que se resuelve con polling simple: mientras un
   "phone" (frame) esté mostrando chat-detail, se vuelve a pedir el
   historial completo de esa conversación cada 4s y, si cambió algo
   (mensaje nuevo, una oferta que pasó a aceptada/rechazada/
   contraofertada desde el otro lado), se vuelve a pintar la pantalla.
   Cada frame del prototipo puede estar en una conversación distinta
   (o en la misma, viendo los dos lados a la vez), por eso el estado
   del polling se guarda por phoneEl, no de forma global. */
const CHAT_POLLS = new Map(); // phoneEl -> { intervalId, threadId }

function stopChatPoll(phoneEl) {
  const existing = CHAT_POLLS.get(phoneEl);
  if (existing) {
    clearInterval(existing.intervalId);
    CHAT_POLLS.delete(phoneEl);
  }
}

function startChatPoll(phoneEl, threadId) {
  const existing = CHAT_POLLS.get(phoneEl);
  if (existing && existing.threadId === threadId) return; // ya está andando para esta misma conversación
  stopChatPoll(phoneEl);
  const intervalId = setInterval(async () => {
    if (phoneEl.dataset.currentScreen !== 'chat-detail' || !CURRENT_CHAT || CURRENT_CHAT.threadId !== threadId) {
      stopChatPoll(phoneEl);
      return;
    }
    const data = await apiFetchThreadMessages(threadId);
    if (!data) return; // backend no disponible momentáneamente: no cortar el polling, reintentar en el próximo ciclo
    const freshMessages = data.messages || [];
    const changed = JSON.stringify(freshMessages) !== JSON.stringify(CHAT_MESSAGES);
    if (changed) {
      CHAT_MESSAGES = freshMessages;
      if (phoneEl.dataset.currentScreen === 'chat-detail') {
        navigateTo(phoneEl, 'chat-detail', { skipFetch: true });
      }
    }
  }, 4000);
  CHAT_POLLS.set(phoneEl, { intervalId, threadId });
}

function renderScreens() {
  const grid = document.getElementById('screensGrid');
  grid.innerHTML = ALL_SCREENS.map(
    (s, i) => `
    <div class="screen-slot" data-block="${s.block}" data-screen-id="${s.id}">
      <span class="screen-slot__label"><span class="screen-slot__number">${i + 1}.</span>${s.label.replace(/^\d+[a-z]?\.\s*/, '')}</span>
      <div class="phone" id="phone-${s.id}" data-testid="phone-${s.id}" style="--frame:${frameColorFor(s.id)}">
        <div class="phone__notch"></div>
        ${s.html()}
      </div>
    </div>`
  ).join('');
}

/* Navegación: cada frame es independiente visualmente, pero al hacer click en un
   elemento con data-nav dentro de UN frame, navegamos DENTRO de ese mismo frame,
   reemplazando su contenido por el de la pantalla destino, para simular una app real
   de una sola ventana. */
function mountNavigation() {
  document.getElementById('screensGrid').addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-nav]');
    if (!trigger) return;
    const phoneEl = trigger.closest('.phone');
    if (!phoneEl) return;
    let targetId = trigger.getAttribute('data-nav');
    // V1.32: el bloque "¿Algo que ya no usas?" de Inicio también empieza
    // una publicación nueva, igual que el botón + de la barra.
    const startsNewPublish = ['tab-publish', 'btn-home-publish'].includes(trigger.getAttribute('data-testid'));
    // V1.28: para publicar hace falta sesión y la verificación de identidad
    if (targetId === 'publish-step1' && startsNewPublish) {
      if (!CURRENT_USER && HAY_APP_MODE) {
        PENDING_AFTER_LOGIN = 'publish-step1';
        targetId = 'login';
      } else if (needsIdentity()) {
        PENDING_AFTER_IDENTITY = 'publish-step1';
        targetId = 'verify-identity';
      }
    }
    const target = SCREEN_MAP[targetId];
    if (!target) return;
    // Arrancar un flujo de "Publicar" nuevo (desde el botón central de la
    // barra inferior) debe limpiar cualquier borrador anterior. El botón
    // "Seguir editando" del modal de descarte también apunta a
    // publish-step1 pero NO debe borrar lo ya tipeado, por eso se
    // distingue por su data-testid puntual.
    if (targetId === 'publish-step1' && startsNewPublish) {
      resetPublishDraft();
    }
    // Cerrar sesión (V1.2): limpiar token + usuario antes de navegar a login.
    if (trigger.getAttribute('data-testid') === 'btn-logout') {
      stopInboxPoll(); // V1.35
      apiLogout();
    }
    // V1.7: recordar qué publicación real se está mirando, para que
    // "product-detail" deje de mostrar siempre el mismo producto fijo.
    if (targetId === 'product-detail' && trigger.hasAttribute('data-listing-id')) {
      CURRENT_PRODUCT_ID = trigger.getAttribute('data-listing-id');
    }
    // V1.18: armar el contexto del reporte según desde dónde se entró
    // (perfil del vendedor vs. Configuración), antes de navegar a la
    // pantalla compartida "report".
    if (targetId === 'report') {
      REPORT_REASON = null;
      if (trigger.getAttribute('data-testid') === 'btn-report-seller') {
        const listing = findListingById(CURRENT_PRODUCT_ID);
        REPORT_CONTEXT = {
          type: 'user',
          targetUserId: listing ? listing.sellerId : null,
          targetLabel: listing ? listing.sellerEmail : null,
          listingId: listing ? listing.id : null,
          returnScreen: 'seller-profile',
        };
      } else if (trigger.getAttribute('data-testid') === 'btn-settings-report-problem') {
        REPORT_CONTEXT = { type: 'problem', targetUserId: null, listingId: null, returnScreen: 'settings' };
      }
    }
    navigateTo(phoneEl, targetId);
  });
}

function navigateTo(phoneEl, targetId, opts) {
  const skipFetch = opts && opts.skipFetch;
  const target = SCREEN_MAP[targetId];
  if (!target) return;
  const willFetchMyListings = targetId === 'my-listings' && CURRENT_USER && !skipFetch;
  if (willFetchMyListings) {
    MY_LISTINGS_LOADING = true;
    MY_LISTINGS_TAB = 'active';
  }
  const willFetchThreads = targetId === 'messages' && CURRENT_USER && !skipFetch;
  if (willFetchThreads) THREADS_LOADING = true;
  // V1.21: panel de moderador — solo se pide si el usuario logueado
  // es moderador (si no lo es, ni siquiera debería poder llegar a
  // esta pantalla, pero igual se valida del lado del backend).
  const willFetchReports = targetId === 'moderation-panel' && CURRENT_USER && CURRENT_USER.isAdmin && !skipFetch;
  if (willFetchReports) { REPORTS_LOADING = true; IDENTITIES_LOADING = true; }
  // V1.25: números de emergencia — públicos, se cargan tanto en la
  // pantalla de Seguridad (cualquiera) como en su admin (moderador).
  const willFetchEmergencyNumbers = (targetId === 'safety' || targetId === 'safety-admin') && !skipFetch;
  if (willFetchEmergencyNumbers) EMERGENCY_NUMBERS_LOADING = true;
  const willFetchChat = targetId === 'chat-detail' && CURRENT_USER && CURRENT_CHAT && !skipFetch;
  if (willFetchChat) CHAT_LOADING = true;
  // V1.29: si la publicación no está en memoria (ej. se abrió desde un
  // chat o de una página vieja), se pide al servidor y se repinta.
  const listingIdNeeded =
    targetId === 'product-detail' || targetId === 'make-offer' || targetId === 'seller-profile' ? CURRENT_PRODUCT_ID
      : targetId === 'chat-detail' && CURRENT_CHAT ? CURRENT_CHAT.listingId
      : targetId === 'confirm-sale' && CURRENT_SALE ? CURRENT_SALE.listingId
      : null;
  const willFetchListing = Boolean(listingIdNeeded && !skipFetch && !findListingById(listingIdNeeded));
  let sellerToFetch = null;
  if (HAY_APP_MODE && targetId === 'seller-profile' && !skipFetch) {
    const l = findListingById(CURRENT_PRODUCT_ID);
    if (l && l.sellerId) sellerToFetch = l.sellerId;
  }
  // V1.17: reputación real del vendedor en "Detalle de producto" y
  // "Perfil del vendedor". Solo se pide si no está ya en caché, para
  // no repetir el fetch cada vez que se re-pinta la misma pantalla.
  let sellerIdToRate = null;
  // V1.27: reputación real de la propia cuenta en "Mi perfil"
  if (targetId === 'profile' && CURRENT_USER && !skipFetch && !RATINGS_CACHE.has(CURRENT_USER.id)) {
    sellerIdToRate = CURRENT_USER.id;
  }
  if ((targetId === 'product-detail' || targetId === 'seller-profile') && !skipFetch) {
    const listingForRating = findListingById(CURRENT_PRODUCT_ID);
    if (listingForRating && listingForRating.sellerId && !RATINGS_CACHE.has(listingForRating.sellerId)) {
      sellerIdToRate = listingForRating.sellerId;
    }
  }

  if (targetId !== 'verify-identity') IDENTITY_NOTICE = null; // V1.36
  phoneEl.querySelector('.phone__notch')?.remove();
  phoneEl.innerHTML = `<div class="phone__notch"></div>${target.html()}`;
  const prevScreen = phoneEl.dataset.currentScreen;
  phoneEl.dataset.currentScreen = targetId;
  // V1.27: botón "atrás" del teléfono en la app real (historial del navegador)
  if (HAY_APP_MODE && !(opts && opts.fromHistory) && !skipFetch && prevScreen !== targetId) {
    try {
      if (opts && opts.replaceHistory) history.replaceState({ screen: targetId }, '');
      else history.pushState({ screen: targetId }, '');
    } catch (e) {}
  }
  // V1.26: el borde del marco toma el color del bloque de la pantalla destino
  phoneEl.style.setProperty('--frame', frameColorFor(targetId));
  wireInteractiveBehaviors(phoneEl, targetId);
  // Scroll de vuelta al top del contenido nuevo
  const body = phoneEl.querySelector('.screen-body');
  if (body) body.scrollTop = 0;

  // V1.35: al ver Mensajes o Notificaciones se dan por leídos los avisos;
  // al abrir un chat, los de esa conversación.
  if (HAY_APP_MODE && CURRENT_USER) {
    if (targetId === 'messages' || targetId === 'notifications') markNotifsRead();
    else if (targetId === 'chat-detail' && CURRENT_CHAT && CURRENT_CHAT.threadId) markNotifsRead(CURRENT_CHAT.threadId);
  }

  // V1.16: solo pollear mientras este frame esté realmente en el chat;
  // al navegar a cualquier otra pantalla, cortar el polling de ese frame.
  if (targetId === 'chat-detail' && CURRENT_CHAT && CURRENT_CHAT.threadId) {
    startChatPoll(phoneEl, CURRENT_CHAT.threadId);
  } else {
    stopChatPoll(phoneEl);
  }

  // V1.4: "Mis publicaciones" necesita datos reales del backend. Como
  // target.html() es síncrono, primero se pinta en estado "cargando" y,
  // apenas llega la respuesta real, se vuelve a pintar la misma
  // pantalla ya con los datos correctos. skipFetch evita un bucle
  // infinito en ese segundo pintado.
  if (willFetchMyListings) {
    apiFetchMyListings().then((listings) => {
      MY_LISTINGS_LOADING = false;
      if (listings) MY_LISTINGS = listings;
      if (phoneEl.dataset.currentScreen === 'my-listings') {
        navigateTo(phoneEl, 'my-listings', { skipFetch: true });
      }
    });
  }

  if (willFetchListing) {
    apiFetchListing(listingIdNeeded).then((l) => {
      if (!l) return;
      rememberListings([l]);
      if (phoneEl.dataset.currentScreen === targetId) navigateTo(phoneEl, targetId, { skipFetch: true });
    });
  }
  if (sellerToFetch) {
    apiFetchFeed({ sellerId: sellerToFetch, limit: 10 }).then((page) => {
      if (!page) return;
      rememberListings(page.items);
      SELLER_LISTINGS.set(sellerToFetch, page.items);
      if (phoneEl.dataset.currentScreen === 'seller-profile') navigateTo(phoneEl, 'seller-profile', { skipFetch: true });
    });
  }

  if (willFetchReports) {
    Promise.all([apiFetchReports(), apiFetchIdentities()]).then(([result, identities]) => {
      REPORTS_LOADING = false;
      IDENTITIES_LOADING = false;
      if (identities) IDENTITIES = identities;
      if (result.ok) REPORTS = result.reports;
      if (phoneEl.dataset.currentScreen === 'moderation-panel') {
        navigateTo(phoneEl, 'moderation-panel', { skipFetch: true });
      }
    });
  }

  if (willFetchEmergencyNumbers) {
    apiFetchEmergencyNumbers().then((numbers) => {
      EMERGENCY_NUMBERS_LOADING = false;
      if (numbers) EMERGENCY_NUMBERS = numbers;
      if (phoneEl.dataset.currentScreen === targetId) {
        navigateTo(phoneEl, targetId, { skipFetch: true });
      }
    });
  }

  // V1.7: lista real de conversaciones (Mensajes).
  if (willFetchThreads) {
    apiFetchThreads().then((threads) => {
      THREADS_LOADING = false;
      if (threads) THREADS = threads;
      if (phoneEl.dataset.currentScreen === 'messages') {
        navigateTo(phoneEl, 'messages', { skipFetch: true });
      }
    });
  }

  // V1.7: historial real de la conversación abierta. threadId puede
  // no existir todavía (conversación nueva, sin mensajes enviados) —
  // en ese caso se predice el mismo id que calcularía el backend al
  // primer mensaje, así ya se puede consultar si por casualidad ya
  // existen mensajes previos con esa persona sobre esa publicación.
  if (willFetchChat) {
    const threadId = CURRENT_CHAT.threadId || threadIdFor(CURRENT_CHAT.listingId, CURRENT_USER.id, CURRENT_CHAT.otherUserId);
    apiFetchThreadMessages(threadId).then((data) => {
      CHAT_LOADING = false;
      if (data) {
        CHAT_MESSAGES = data.messages || [];
        CURRENT_CHAT.threadId = threadId;
        if (!CURRENT_CHAT.otherUserEmail && data.otherUser) CURRENT_CHAT.otherUserEmail = data.otherUser.email;
        if (!CURRENT_CHAT.listingTitle && data.listingTitle) CURRENT_CHAT.listingTitle = data.listingTitle;
      }
      if (phoneEl.dataset.currentScreen === 'chat-detail') {
        navigateTo(phoneEl, 'chat-detail', { skipFetch: true });
      }
    });
  }

  // V1.17: una vez que llega el promedio real de calificaciones del
  // vendedor, se vuelve a pintar la misma pantalla ya con ese dato
  // (antes de esto, "5.0 (18)" era fijo sin importar el vendedor).
  if (sellerIdToRate) {
    apiFetchUserRatings(sellerIdToRate).then((data) => {
      RATINGS_CACHE.set(sellerIdToRate, data ? { average: data.average || 0, count: data.count } : { average: 0, count: 0 });
      if (phoneEl.dataset.currentScreen === targetId) {
        navigateTo(phoneEl, targetId, { skipFetch: true });
      }
    });
  }
}

/* Comportamientos interactivos específicos por pantalla (toggles, stepper onboarding,
   panel de filtros, estrellas, etc.) Se re-aplican cada vez que se monta una pantalla. */
/* V1.23: filtra PRODUCTS por categoría (chip activo) y tipo de vendedor
   (pill activo: Todos/Personas/Negocios) y repinta la grilla de esa
   pantalla dentro del mismo frame. Funciona tanto en Inicio como en
   Buscar, que comparten la misma estructura de filtros. */
function currentFeedFilters(phoneEl) {
  const catRow = phoneEl.querySelector('[data-testid="home-categories"], [data-testid="search-categories"]');
  const sellerRow = phoneEl.querySelector('[data-testid="home-seller-type"], [data-testid="search-seller-type"]');
  const activeCat = catRow ? catRow.querySelector('.chip.is-active') : null;
  const catValue = activeCat ? activeCat.getAttribute('data-cat') : 'Todos';
  const activePill = sellerRow ? sellerRow.querySelector('.pill.is-selected') : null;
  const sellerType = activePill ? activePill.getAttribute('data-seller-type') : 'all';
  const searchInput = phoneEl.querySelector('[data-testid="input-search"]');
  return {
    category: catValue && catValue !== 'Todos' ? catValue : null,
    sellerType: sellerType && sellerType !== 'all' ? sellerType : null,
    q: searchInput ? searchInput.value.trim() : '',
  };
}

/* V1.29: en la app real el feed viene del servidor de a 20 y se
   completa al bajar (scroll infinito). append=true agrega la página
   siguiente; si no, vuelve a empezar con los filtros actuales. */
let FEED_DEBOUNCE = null;
let FEED_PREFETCH = null; // V1.35: { key, promise } de la primera página
async function loadFeed(phoneEl, { append = false } = {}) {
  const grid = phoneEl.querySelector('[data-testid="home-product-grid"], [data-testid="search-results-grid"]');
  if (!grid) return;
  const filters = currentFeedFilters(phoneEl);
  const key = JSON.stringify(filters);
  if (append && (!APP_FEED.nextCursor || APP_FEED.loading || APP_FEED.key !== key)) return;
  const reqId = Symbol('feed');
  APP_FEED.req = reqId;
  APP_FEED.loading = true;
  if (!append) {
    APP_FEED.key = key;
    grid.setAttribute('aria-busy', 'true');
  } else {
    grid.insertAdjacentHTML('beforeend', '<p class="empty-msg" data-feed-more style="grid-column:1/-1; margin:var(--space-2) 0;">Cargando más…</p>');
  }
  // V1.35: la primera página se pide mientras se muestra la pantalla de inicio
  const usePrefetch = !append && FEED_PREFETCH && key === FEED_PREFETCH.key;
  const page = usePrefetch ? await FEED_PREFETCH.promise : await apiFetchFeed({ ...filters, cursor: append ? APP_FEED.nextCursor : null });
  if (usePrefetch) FEED_PREFETCH = null;
  if (APP_FEED.req !== reqId) return; // llegó una búsqueda más nueva: ignorar esta
  APP_FEED.loading = false;
  grid.removeAttribute('aria-busy');
  grid.querySelectorAll('[data-feed-more]').forEach((n) => n.remove());
  if (!page) {
    APP_FEED.error = true;
    if (!append) grid.innerHTML = `<p class="empty-msg" style="grid-column:1/-1;">No se pudo cargar. Revisa tu conexión y vuelve a intentar.</p>`;
    return;
  }
  APP_FEED.error = false;
  rememberListings(page.items);
  const mapped = page.items.map(mapListingFromApi);
  APP_FEED.items = append ? APP_FEED.items.concat(mapped) : mapped;
  APP_FEED.nextCursor = page.nextCursor;
  PRODUCTS = APP_FEED.items;
  if (append) grid.insertAdjacentHTML('beforeend', mapped.map((p) => productCard(p)).join(''));
  else grid.innerHTML = mapped.length
    ? mapped.map((p) => productCard(p)).join('')
    : `<p class="empty-msg" style="grid-column:1/-1; padding:var(--space-4) 0;">${filters.q || filters.category || filters.sellerType ? 'No hay publicaciones con estos filtros todavía.' : 'Todavía no hay publicaciones. ¡Sé el primero en publicar con el botón +!'}</p>`;
  wireFavButtons(phoneEl); // V1.32: favoritos reales
  const countEl = phoneEl.querySelector('[data-testid="search-results-count"]');
  if (countEl) countEl.textContent = `${APP_FEED.items.length}${APP_FEED.nextCursor ? '+' : ''} resultado${APP_FEED.items.length === 1 ? '' : 's'}`;
}

function applyProductFilters(phoneEl) {
  if (HAY_APP_MODE) {
    clearTimeout(FEED_DEBOUNCE);
    FEED_DEBOUNCE = setTimeout(() => loadFeed(phoneEl), 250);
    return;
  }
  const catRow = phoneEl.querySelector('[data-testid="home-categories"], [data-testid="search-categories"]');
  const sellerRow = phoneEl.querySelector('[data-testid="home-seller-type"], [data-testid="search-seller-type"]');
  const grid = phoneEl.querySelector('[data-testid="home-product-grid"], [data-testid="search-results-grid"]');
  if (!grid) return;

  const activeCat = catRow ? catRow.querySelector('.chip.is-active') : null;
  const catValue = activeCat ? activeCat.getAttribute('data-cat') : 'Todos';
  const activePill = sellerRow ? sellerRow.querySelector('.pill.is-selected') : null;
  const sellerType = activePill ? activePill.getAttribute('data-seller-type') : 'all';

  let filtered = PRODUCTS;
  if (catValue && catValue !== 'Todos') {
    filtered = filtered.filter((p) => p.category === catValue);
  }
  if (sellerType && sellerType !== 'all') {
    filtered = filtered.filter((p) => (p.sellerType || 'persona') === sellerType);
  }
  // V1.27: la caja de búsqueda ahora filtra de verdad (título, categoría, zona)
  const searchInput = phoneEl.querySelector('[data-testid="input-search"]');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (q) {
    const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const nq = norm(q);
    filtered = filtered.filter((p) => norm(p.title).includes(nq) || norm(p.category).includes(nq) || norm(p.zone).includes(nq));
  }

  grid.innerHTML = filtered.length
    ? filtered.map((p) => productCard(p)).join('')
    : `<p class="empty-msg" style="grid-column:1/-1; padding:var(--space-4) 0;">${PRODUCTS.length ? 'No hay publicaciones con estos filtros todavía.' : 'Todavía no hay publicaciones. ¡Sé el primero en publicar con el botón +!'}</p>`;

  const countEl = phoneEl.querySelector('[data-testid="search-results-count"]');
  if (countEl) countEl.textContent = `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`;
}

function wireInteractiveBehaviors(phoneEl, screenId) {
  // V1.27: búsqueda por texto en vivo
  const searchBox = phoneEl.querySelector('[data-testid="input-search"]');
  if (searchBox) {
    searchBox.addEventListener('input', () => applyProductFilters(phoneEl));
    if (searchBox.value && !HAY_APP_MODE) applyProductFilters(phoneEl);
  }
  // V1.29: feed paginado del servidor + más al llegar al final
  if (HAY_APP_MODE && (screenId === 'home' || screenId === 'search')) {
    loadFeed(phoneEl);
    const body = phoneEl.querySelector('.screen-body');
    if (body) {
      body.addEventListener('scroll', () => {
        if (body.scrollTop + body.clientHeight > body.scrollHeight - 600) loadFeed(phoneEl, { append: true });
      }, { passive: true });
    }
  }
  // V1.27: marcar el onboarding como visto al salir de él
  if (screenId === 'register' || screenId === 'login' || screenId === 'home') {
    try { localStorage.setItem('hay_onboarding_seen', '1'); } catch (e) {}
  }

  // Toggles genéricos (funcionan en cualquier pantalla: publicar, settings)
  phoneEl.querySelectorAll('.toggle').forEach((t) => {
    t.addEventListener('click', (e) => {
      e.stopPropagation();
      t.classList.toggle('is-on');
      t.setAttribute('aria-checked', t.classList.contains('is-on') ? 'true' : 'false');
    });
  });

  // V1.35: Configuración → silenciar mensajes / notificaciones (se guarda en el teléfono)
  phoneEl.querySelectorAll('[data-pref]').forEach((t) => {
    t.addEventListener('click', async () => {
      const key = t.getAttribute('data-pref');
      const on = t.classList.contains('is-on');
      setPref(key, on);
      if (key === 'muteNotifications' && !on) {
        const perm = await requestNotificationPermission();
        const msg = phoneEl.querySelector('#notifPermMsg');
        if (msg) {
          msg.textContent = perm === 'denied' ? 'El teléfono tiene bloqueadas las notificaciones de HAY: actívalas en Ajustes del teléfono para recibir avisos con la app cerrada o en segundo plano.' : '';
          msg.style.display = perm === 'denied' ? 'block' : 'none';
        }
      }
      if (key === 'muteMessages' && !on) playMessageSound(); // prueba del sonido
    });
  });
  phoneEl.querySelectorAll('[data-action="enable-system-notifs"]').forEach((b) => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      await requestNotificationPermission();
      navigateTo(phoneEl, screenId, { skipFetch: true });
    });
  });
  // V1.35: tocar un aviso en Notificaciones abre ese chat
  phoneEl.querySelectorAll('[data-notif-id]').forEach((row) => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const n = loadNotifs().find((x) => x.id === row.getAttribute('data-notif-id'));
      if (n) openChatFromNotif(n);
    });
  });

  // V1.35: GPS — Inicio (tu zona y distancias) y Publicar paso 4 (zona de encuentro + mapa)
  phoneEl.querySelectorAll('[data-action="gps-home"], [data-action="gps-publish"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isPublish = btn.getAttribute('data-action') === 'gps-publish';
      const msg = phoneEl.querySelector('#gpsMsg');
      const say = (text, isError) => {
        if (msg) { msg.textContent = text; msg.classList.toggle('is-error', Boolean(isError)); msg.style.display = text ? 'block' : 'none'; }
        else if (isError) alert(text);
      };
      btn.disabled = true;
      const oldLabel = btn.innerHTML;
      if (isPublish) btn.textContent = 'Buscando tu ubicación…';
      else btn.lastChild && (btn.lastChild.textContent = 'Buscando…');
      say(isPublish ? 'Buscando tu ubicación… (puede tardar unos segundos)' : '');
      try {
        const loc = await getGpsLocation();
        if (isPublish) {
          PUBLISH_DRAFT.lat = loc.lat;
          PUBLISH_DRAFT.lng = loc.lng;
          if (loc.zone) PUBLISH_DRAFT.zone = loc.zone;
          navigateTo(phoneEl, 'publish-step4', { skipFetch: true });
          const m2 = phoneEl.querySelector('#gpsMsg');
          if (m2) { m2.textContent = loc.zone ? 'Ubicación lista ✓ Puedes corregir el nombre de la zona.' : 'Ubicación lista ✓ Escribe el nombre de tu zona.'; m2.style.display = 'block'; }
        } else {
          navigateTo(phoneEl, screenId, { skipFetch: true });
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = oldLabel;
        say(err.message, true);
      }
    });
  });

  // V1.35: moderador — miniaturas de las fotos publicadas antes de la v1.35
  const thumbsBtn = phoneEl.querySelector('#btnBackfillThumbs');
  if (thumbsBtn) {
    thumbsBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const msg = phoneEl.querySelector('#backfillMsg');
      thumbsBtn.disabled = true;
      if (msg) { msg.style.display = 'block'; msg.textContent = 'Preparando fotos… no cierres la app.'; }
      try {
        const n = await backfillThumbs((k) => { if (msg) msg.textContent = `Fotos optimizadas: ${k} publicaciones…`; });
        if (msg) msg.textContent = n ? `Listo ✓ ${n} publicaciones optimizadas.` : 'Listo ✓ No había fotos antiguas por optimizar.';
      } catch (err) {
        if (msg) msg.textContent = 'No se pudo terminar: ' + err.message + '. Vuelve a tocar el botón para seguir.';
      }
      thumbsBtn.disabled = false;
    });
  }

  // Chips seleccionables (categorías, filtros) — togglean is-active en su grupo local
  const FILTERABLE_CHIP_ROWS = ['home-categories', 'search-categories'];
  phoneEl.querySelectorAll('.chip-row').forEach((row) => {
    const testid = row.getAttribute('data-testid');
    row.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        row.querySelectorAll('.chip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        if (FILTERABLE_CHIP_ROWS.includes(testid)) applyProductFilters(phoneEl);
      });
    });
  });

  // Pills de condición (publicar paso 3) y de tipo de vendedor (Inicio/Buscar)
  const FILTERABLE_PILL_ROWS = ['home-seller-type', 'search-seller-type'];
  phoneEl.querySelectorAll('.pill-row').forEach((row) => {
    const testid = row.getAttribute('data-testid');
    row.querySelectorAll('.pill').forEach((pill) => {
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        row.querySelectorAll('.pill').forEach((p) => p.classList.remove('is-selected'));
        pill.classList.add('is-selected');
        if (FILTERABLE_PILL_ROWS.includes(testid)) applyProductFilters(phoneEl);
        // V1.24: elegir "Negocio" al registrarse muestra los campos de
        // nombre comercial + categoría de negocio; "Persona" los oculta.
        if (testid === 'register-account-type') {
          const fields = phoneEl.querySelector('#registerBusinessFields');
          if (fields) fields.style.display = pill.getAttribute('data-account-type') === 'negocio' ? 'flex' : 'none';
        }
      });
    });
  });

  // Category tiles (publicar paso 2)
  phoneEl.querySelectorAll('.category-grid').forEach((grid) => {
    grid.querySelectorAll('.category-tile').forEach((tile) => {
      tile.addEventListener('click', (e) => {
        e.stopPropagation();
        grid.querySelectorAll('.category-tile').forEach((t) => {
          t.classList.remove('is-selected');
          t.querySelector('.category-tile__icon').style.background = 'var(--color-surface-2)';
        });
        tile.classList.add('is-selected');
        tile.querySelector('.category-tile__icon').style.background = 'var(--hay-turquoise-highlight)';
      });
    });
  });

  // Segmented control (mis publicaciones)
  phoneEl.querySelectorAll('.segmented').forEach((seg) => {
    const panelsHost = seg.closest('.phone__screen');
    seg.querySelectorAll('.segmented__item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        seg.querySelectorAll('.segmented__item').forEach((i) => i.classList.remove('is-active'));
        item.classList.add('is-active');
        const tab = item.getAttribute('data-tab');
        if (tab && panelsHost) {
          panelsHost.querySelectorAll('[data-panel]').forEach((panel) => {
            panel.style.display = panel.getAttribute('data-panel') === tab ? '' : 'none';
          });
        }
      });
    });
  });

  // V1.26: ojo para mostrar/ocultar contraseña (referencia "Iniciar sesión").
  // Solo cambia el tipo del input; no toca la lógica de login/registro.
  phoneEl.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const input = phoneEl.querySelector('#' + btn.getAttribute('data-toggle-password'));
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.setAttribute('aria-pressed', input.type === 'text' ? 'true' : 'false');
    });
  });

  // Favoritos (V1.32): reales, guardados en el teléfono — tarjetas y detalle
  wireFavButtons(phoneEl);

  // Estrellas de calificación (pantalla calificar). V1.17: antes solo
  // cambiaban de color al tocarlas (efecto visual, sin guardar nada);
  // ahora también actualizan SELECTED_RATING_STARS, que es lo que
  // realmente se manda al backend al tocar "Enviar calificación".
  phoneEl.querySelectorAll('[data-testid="rating-stars-input"]').forEach((row) => {
    const buttons = row.querySelectorAll('button');
    buttons.forEach((btn, idx) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        SELECTED_RATING_STARS = idx + 1;
        buttons.forEach((b, i) => {
          const svg = b.querySelector('svg');
          if (i <= idx) {
            svg.style.fill = 'var(--hay-yellow)';
            svg.style.stroke = 'var(--hay-yellow)';
          } else {
            svg.style.fill = 'none';
            svg.style.stroke = '#d9dfe8';
          }
        });
      });
    });
  });

  // Enviar calificación real (V1.17): antes este botón solo navegaba a
  // "Mis publicaciones" sin tocar el backend ni guardar nada.
  const submitRatingBtn = phoneEl.querySelector('#btnSubmitRating');
  if (submitRatingBtn) {
    submitRatingBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#rateErrorMsg');
      if (errEl) errEl.style.display = 'none';
      if (!LAST_SALE || !LAST_SALE.listingId) {
        if (errEl) { errEl.textContent = 'No hay una venta reciente para calificar.'; errEl.style.display = 'block'; }
        return;
      }
      if (!SELECTED_RATING_STARS) {
        if (errEl) { errEl.textContent = 'Elige de 1 a 5 estrellas antes de enviar.'; errEl.style.display = 'block'; }
        return;
      }
      const comment = phoneEl.querySelector('#rate-comment')?.value || '';
      submitRatingBtn.disabled = true;
      submitRatingBtn.textContent = 'Enviando...';
      const result = await apiSubmitRating(LAST_SALE.listingId, SELECTED_RATING_STARS, comment);
      submitRatingBtn.disabled = false;
      submitRatingBtn.textContent = 'Enviar calificación';
      if (!result.ok) {
        if (errEl) { errEl.textContent = 'No se pudo enviar: ' + result.error; errEl.style.display = 'block'; }
        return;
      }
      // La reputación de ese usuario cambió: invalidar la caché para
      // que la próxima vez que se muestre (detalle/perfil) se pida de nuevo.
      RATINGS_CACHE.delete(result.rating.toUserId);
      navigateTo(phoneEl, 'my-listings');
    });
  }

  // Chips de motivo en la pantalla de reporte (V1.18): selección única,
  // guardada en REPORT_REASON (además del efecto visual genérico que ya
  // aplica el manejador de .chip-row de más abajo).
  phoneEl.querySelectorAll('[data-testid="report-reason-chips"]').forEach((row) => {
    row.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        REPORT_REASON = chip.getAttribute('data-value');
      });
    });
  });

  // Enviar reporte real (V1.18): antes "Reportar" (perfil del vendedor)
  // y "Reportar un problema" (configuración) no tenían ninguna función.
  const submitReportBtn = phoneEl.querySelector('#btnSubmitReport');
  if (submitReportBtn) {
    submitReportBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#reportErrorMsg');
      if (errEl) errEl.style.display = 'none';
      const ctx = REPORT_CONTEXT || { type: 'problem' };
      if (ctx.type === 'user' && !ctx.targetUserId) {
        if (errEl) { errEl.textContent = 'No se pudo identificar a quién estás reportando. Vuelve a intentar desde su perfil.'; errEl.style.display = 'block'; }
        return;
      }
      if (!REPORT_REASON) {
        if (errEl) { errEl.textContent = 'Elige un motivo antes de enviar el reporte.'; errEl.style.display = 'block'; }
        return;
      }
      const details = phoneEl.querySelector('#report-details')?.value || '';
      submitReportBtn.disabled = true;
      submitReportBtn.textContent = 'Enviando...';
      const result = await apiSubmitReport({
        type: ctx.type,
        targetUserId: ctx.targetUserId || undefined,
        listingId: ctx.listingId || undefined,
        reason: REPORT_REASON,
        details,
      });
      submitReportBtn.disabled = false;
      submitReportBtn.textContent = 'Enviar reporte';
      if (!result.ok) {
        if (errEl) { errEl.textContent = 'No se pudo enviar: ' + result.error; errEl.style.display = 'block'; }
        return;
      }
      navigateTo(phoneEl, 'report-sent');
    });
  }

  // "Listo" en la confirmación de reporte enviado: vuelve a donde se
  // entró (perfil del vendedor o Configuración), no siempre al mismo lado.
  const reportDoneBtn = phoneEl.querySelector('#btnReportDone');
  if (reportDoneBtn) {
    reportDoneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigateTo(phoneEl, (REPORT_CONTEXT && REPORT_CONTEXT.returnScreen) || 'home');
    });
  }

  // Panel de moderador (V1.21): marcar un reporte como revisado o
  // descartado. Antes esta pantalla no existía — los reportes desde
  // V1.18 quedaban guardados sin que nadie los viera.
  phoneEl.querySelectorAll('[data-action="review-report"], [data-action="dismiss-report"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const row = btn.closest('[data-report-id]');
      const reportId = row?.getAttribute('data-report-id');
      const errEl = phoneEl.querySelector('#moderationErrorMsg');
      if (errEl) errEl.style.display = 'none';
      if (!reportId) return;
      const newStatus = btn.getAttribute('data-action') === 'review-report' ? 'reviewed' : 'dismissed';
      btn.disabled = true;
      const result = await apiUpdateReportStatus(reportId, newStatus);
      btn.disabled = false;
      if (!result.ok) {
        if (errEl) { errEl.textContent = 'No se pudo actualizar: ' + result.error; errEl.style.display = 'block'; }
        return;
      }
      const i = REPORTS.findIndex((r) => r.id === reportId);
      if (i !== -1) REPORTS[i] = { ...REPORTS[i], ...result.report };
      navigateTo(phoneEl, 'moderation-panel', { skipFetch: true });
    });
  });

  // Panel de filtros (Buscar)
  if (screenId === 'search') {
    const overlay = phoneEl.querySelector('#filtersOverlay');
    const openBtn = phoneEl.querySelector('#openFiltersBtn');
    const closeBtn = phoneEl.querySelector('#closeFiltersBtn');
    const applyBtn = phoneEl.querySelector('#applyFiltersBtn');
    const clearBtn = phoneEl.querySelector('#clearFiltersBtn');
    const show = () => (overlay.style.display = 'block');
    const hide = () => (overlay.style.display = 'none');
    openBtn?.addEventListener('click', (e) => { e.stopPropagation(); show(); });
    closeBtn?.addEventListener('click', (e) => { e.stopPropagation(); hide(); });
    applyBtn?.addEventListener('click', (e) => { e.stopPropagation(); hide(); });
    clearBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      overlay.querySelectorAll('.chip, .pill').forEach((el) => el.classList.remove('is-active', 'is-selected'));
    });
  }

  // Onboarding slides (swipe simulado con botón Continuar + dots)
  if (screenId === 'onboarding-slides') {
    const slidesData = [
      { icon: 'boxOpen', tone: 2, hero: 'cyan', badge: 'camera', eyebrow: 'Paso 1 de 3', title: 'Lo tienes', body: 'Esa bici, esa silla, ese celular que ya no usas — seguro alguien cerca de ti lo está buscando ahora mismo.' },
      { icon: 'camera', tone: 3, hero: 'yellow', badge: 'sparkle', eyebrow: 'Paso 2 de 3', title: 'Publícalo', body: 'Toma unas fotos, escribe un título y ponle precio. Publicar en HAY toma menos de un minuto.' },
      { icon: 'tag', tone: 1, hero: 'green', badge: 'chat', eyebrow: 'Paso 3 de 3', title: 'Véndelo', body: 'Chatea con compradores cerca de ti, acuerda un punto de encuentro seguro y cierra la venta.' },
    ];
    let current = 0;
    const artWrap = phoneEl.querySelector('#onboardingSlideWrap');
    const dotsWrap = phoneEl.querySelector('#onboardingDots');
    const nextBtn = phoneEl.querySelector('#onboardingNextBtn');

    function renderSlide(i) {
      const s = slidesData[i];
      artWrap.innerHTML = `
        ${heroIcon(s.icon, s.hero, { size: 230, halo: true, badge: s.badge })}
        <div class="text-center stack-sm">
          <span class="screen-eyebrow">${s.eyebrow}</span>
          <h2 class="screen-title">${s.title}</h2>
          <p class="screen-subtitle">${s.body}</p>
        </div>`;
      dotsWrap.querySelectorAll('.dots__dot').forEach((d, idx) => d.classList.toggle('is-active', idx === i));
      nextBtn.textContent = i === slidesData.length - 1 ? 'Comenzar' : 'Continuar';
    }

    nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (current < slidesData.length - 1) {
        current += 1;
        renderSlide(current);
      } else {
        navigateTo(phoneEl, 'register');
      }
    });

    dotsWrap?.querySelectorAll('.dots__dot').forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        current = Number(dot.dataset.dot);
        renderSlide(current);
      });
    });
  }

  // Captura de campos del formulario de Publicar hacia PUBLISH_DRAFT
  // (paso 3: título/descripción/condición; paso 4: precio/zona/ofertas).
  phoneEl.querySelectorAll('[data-draft-field]').forEach((el) => {
    const field = el.dataset.draftField;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.addEventListener('input', () => {
        PUBLISH_DRAFT[field] = field === 'price' ? el.value.replace(/[^0-9.]/g, '') : el.value;
      });
    }
  });

  // Pills de condición: si estamos en el paso 3 de publicar (tiene
  // data-draft-field="condition" en el contenedor), además de la clase
  // visual is-selected (ya cableada arriba), guardamos el valor elegido.
  phoneEl.querySelectorAll('[data-draft-field="condition"] .pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      PUBLISH_DRAFT.condition = pill.textContent.trim();
    });
  });

  // Toggle "Acepto ofertas" (paso 4)
  phoneEl.querySelectorAll('[data-draft-field="acceptsOffers"]').forEach((t) => {
    t.addEventListener('click', () => {
      PUBLISH_DRAFT.acceptsOffers = t.classList.contains('is-on');
    });
  });

  // Categoría (paso 2): guarda label + ícono elegidos en el draft.
  phoneEl.querySelectorAll('.category-tile[data-cat-label]').forEach((tile) => {
    tile.addEventListener('click', () => {
      PUBLISH_DRAFT.category = tile.dataset.catLabel;
      PUBLISH_DRAFT.categoryIcon = tile.dataset.catIcon;
    });
  });

  // "Continuar con Google" real (V1.22) — antes este botón (en
  // Registro y Login) no tenía ninguna función. Un mismo flujo sirve
  // para las dos pantallas: si el email de Google ya tiene cuenta,
  // inicia sesión; si no, la crea al vuelo (lo decide el backend).
  phoneEl.querySelectorAll('[data-testid="btn-google-signup"], [data-testid="btn-google-login"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#authErrorMsg');
      if (errEl) errEl.style.display = 'none';
      if (!ensureGoogleTokenClient()) {
        if (errEl) { errEl.textContent = 'El inicio de sesión de Google todavía está cargando — espera un segundo y vuelve a tocar el botón.'; errEl.style.display = 'block'; }
        return;
      }
      GOOGLE_AUTH_CTX = { phoneEl };
      btn.disabled = true;
      btn.textContent = 'Conectando con Google...';
      GOOGLE_TOKEN_CLIENT.requestAccessToken();
    });
  });

  // Registro / Login reales (V1.2) — reemplaza el data-nav directo que
  // había en V1.1 (que solo simulaba avanzar de pantalla sin backend).
  const registerBtn = phoneEl.querySelector('#btnRegisterSubmit');
  if (registerBtn) {
    registerBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#authErrorMsg');
      const email = phoneEl.querySelector('#reg-email')?.value.trim() || '';
      const password = phoneEl.querySelector('#reg-pass')?.value || '';
      // V1.24: tipo de cuenta y, si es Negocio, sus datos propios.
      const accountTypePill = phoneEl.querySelector('[data-testid="register-account-type"] .pill.is-selected');
      const accountType = accountTypePill ? accountTypePill.getAttribute('data-account-type') : 'persona';
      let businessName = '';
      let businessCategory = '';
      if (accountType === 'negocio') {
        businessName = phoneEl.querySelector('#reg-business-name')?.value.trim() || '';
        const catChip = phoneEl.querySelector('[data-testid="register-business-category"] .chip.is-active');
        businessCategory = catChip ? catChip.getAttribute('data-cat') : '';
      }
      if (errEl) errEl.style.display = 'none';
      registerBtn.disabled = true;
      registerBtn.textContent = 'Creando cuenta...';
      const result = await apiRegister(email, password, { accountType, businessName, businessCategory });
      registerBtn.disabled = false;
      registerBtn.textContent = 'Crear cuenta';
      if (!result.ok) {
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      setToken(result.token);
      CURRENT_USER = result.user;
      startInboxPoll();
      // V1.35: aviso de registro completado (+ correo de bienvenida)
      REGISTER_DONE = { welcomeEmail: result.welcomeEmail };
      navigateTo(phoneEl, 'register-success');
    });
  }

  // V1.35: botón "Continuar" de "Registro completado"
  const regDoneBtn = phoneEl.querySelector('#btnRegisterDoneContinue');
  if (regDoneBtn) {
    regDoneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      REGISTER_DONE = null;
      navigateTo(phoneEl, afterLoginTarget());
    });
  }
  const regDoneVerifyBtn = phoneEl.querySelector('#btnRegisterDoneVerify');
  if (regDoneVerifyBtn) {
    regDoneVerifyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      REGISTER_DONE = null;
      if (PENDING_AFTER_LOGIN === 'publish-step1') PENDING_AFTER_IDENTITY = 'publish-step1';
      PENDING_AFTER_LOGIN = null;
      navigateTo(phoneEl, 'verify-identity');
    });
  }
  const idDoneBtn = phoneEl.querySelector('#btnIdentityDoneContinue');
  if (idDoneBtn) {
    idDoneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = (IDENTITY_DONE && IDENTITY_DONE.next) || 'home';
      IDENTITY_DONE = null;
      if (next === 'publish-step1') resetPublishDraft();
      navigateTo(phoneEl, next);
    });
  }

  // V1.25: administrar números de emergencia (agregar / borrar).
  const addEmergencyBtn = phoneEl.querySelector('#btnAddEmergencyNumber');
  if (addEmergencyBtn) {
    addEmergencyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#emergencyAdminErrorMsg');
      const label = phoneEl.querySelector('#new-emergency-label')?.value.trim() || '';
      const phone = phoneEl.querySelector('#new-emergency-phone')?.value.trim() || '';
      const typePill = phoneEl.querySelector('[data-testid="new-emergency-type"] .pill.is-selected');
      const type = typePill ? typePill.getAttribute('data-emergency-type') : 'call';
      if (errEl) errEl.style.display = 'none';
      addEmergencyBtn.disabled = true;
      addEmergencyBtn.textContent = 'Agregando...';
      const result = await apiAddEmergencyNumber(label, phone, type);
      addEmergencyBtn.disabled = false;
      addEmergencyBtn.textContent = 'Agregar';
      if (!result.ok) {
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      EMERGENCY_NUMBERS.push(result.number);
      navigateTo(phoneEl, 'safety-admin', { skipFetch: true });
    });
  }

  phoneEl.querySelectorAll('[data-delete-emergency-id]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-delete-emergency-id');
      btn.disabled = true;
      const result = await apiDeleteEmergencyNumber(id);
      if (result.ok) {
        EMERGENCY_NUMBERS = EMERGENCY_NUMBERS.filter((n) => n.id !== id);
        navigateTo(phoneEl, 'safety-admin', { skipFetch: true });
      } else {
        btn.disabled = false;
      }
    });
  });

  const loginBtn = phoneEl.querySelector('#btnLoginSubmit');
  if (loginBtn) {
    loginBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#authErrorMsg');
      const email = phoneEl.querySelector('#log-email')?.value.trim() || '';
      const password = phoneEl.querySelector('#log-pass')?.value || '';
      if (errEl) errEl.style.display = 'none';
      loginBtn.disabled = true;
      loginBtn.textContent = 'Entrando...';
      const result = await apiLogin(email, password);
      loginBtn.disabled = false;
      loginBtn.textContent = 'Entrar';
      if (!result.ok) {
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      setToken(result.token);
      CURRENT_USER = result.user;
      startInboxPoll(); // V1.35
      navigateTo(phoneEl, afterLoginTarget());
    });
  }

  // Recuperar contraseña (V1.3)
  const sendResetBtn = phoneEl.querySelector('#btnSendResetLink');
  if (sendResetBtn) {
    sendResetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#authErrorMsg');
      const email = phoneEl.querySelector('#fp-email')?.value.trim() || '';
      if (errEl) errEl.style.display = 'none';
      if (!email) {
        if (errEl) { errEl.textContent = 'Ingresa tu email'; errEl.style.display = 'block'; }
        return;
      }
      sendResetBtn.disabled = true;
      sendResetBtn.textContent = 'Enviando...';
      const result = await apiForgotPassword(email);
      sendResetBtn.disabled = false;
      sendResetBtn.textContent = 'Enviar enlace';
      if (!result.ok) {
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      PASSWORD_RESET_DEV_TOKEN = result.devResetToken;
      navigateTo(phoneEl, 'forgot-password-sent');
    });
  }

  const confirmResetBtn = phoneEl.querySelector('#btnConfirmResetPassword');
  if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#authErrorMsg');
      const newPassword = phoneEl.querySelector('#rp-password')?.value || '';
      if (errEl) errEl.style.display = 'none';
      confirmResetBtn.disabled = true;
      confirmResetBtn.textContent = 'Cambiando...';
      const result = await apiResetPassword(PASSWORD_RESET_DEV_TOKEN, newPassword);
      confirmResetBtn.disabled = false;
      confirmResetBtn.textContent = 'Cambiar contraseña';
      if (!result.ok) {
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      PASSWORD_RESET_DEV_TOKEN = null;
      navigateTo(phoneEl, 'login');
    });
  }

  // Eliminar publicación real (V1.4)
  phoneEl.querySelectorAll('[data-listing-id]').forEach((btn) => {
    if (btn.getAttribute('data-testid')?.startsWith('btn-delete-listing-')) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-listing-id');
        const confirmed = window.confirm('¿Eliminar esta publicación? No se puede deshacer.');
        if (!confirmed) return;
        const result = await apiDeleteListing(id);
        if (!result.ok) {
          alert('No se pudo eliminar: ' + result.error);
          return;
        }
        MY_LISTINGS = MY_LISTINGS.filter((l) => l.id !== id);
        navigateTo(phoneEl, 'my-listings', { skipFetch: true });
      });
    }
    // Editar publicación real (V1.5): precarga PUBLISH_DRAFT con los
    // datos reales de esa publicación y entra al flujo de Publicar en
    // modo edición (EDITING_LISTING_ID marcado).
    if (btn.getAttribute('data-testid')?.startsWith('btn-edit-listing-')) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-listing-id');
        const listing = MY_LISTINGS.find((l) => l.id === id);
        if (!listing) return;
        EDITING_LISTING_ID = id;
        PUBLISH_DRAFT = {
          title: listing.title,
          description: listing.description || '',
          category: listing.category,
          categoryIcon: listing.icon,
          condition: listing.condition,
          price: String(listing.price),
          zone: listing.zone,
          acceptsOffers: Boolean(listing.acceptsOffers),
          photos: listing.photos || 0,
          photoData: [],
          thumbData: [],
          photoUrls: listing.photoUrls || [],
          lat: listing.lat ?? null,
          lng: listing.lng ?? null,
        };
        navigateTo(phoneEl, 'publish-step2');
      });
    }
    // Pausar / Reanudar / Marcar como vendida (V1.6): botones con
    // data-next-status en la fila de "Mis publicaciones".
    if (btn.hasAttribute('data-next-status')) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-listing-id');
        const nextStatus = btn.getAttribute('data-next-status');
        const result = await apiSetListingStatus(id, nextStatus);
        if (!result.ok) {
          alert('No se pudo actualizar: ' + result.error);
          return;
        }
        const i = MY_LISTINGS.findIndex((l) => l.id === id);
        if (i !== -1) MY_LISTINGS[i] = result.listing;
        navigateTo(phoneEl, 'my-listings', { skipFetch: true });
      });
    }
  });

  // Pestañas reales de "Mis publicaciones" (V1.6)
  phoneEl.querySelectorAll('[data-my-listings-tab]').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.stopPropagation();
      MY_LISTINGS_TAB = tab.getAttribute('data-my-listings-tab');
      navigateTo(phoneEl, 'my-listings', { skipFetch: true });
    });
  });

  // Abrir una conversación real desde la lista de Mensajes (V1.7)
  phoneEl.querySelectorAll('[data-thread-id]').forEach((row) => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const threadId = row.getAttribute('data-thread-id');
      const thread = THREADS.find((t) => t.threadId === threadId);
      if (!thread) return;
      CURRENT_CHAT = {
        threadId: thread.threadId,
        listingId: thread.listingId,
        listingTitle: thread.listingTitle,
        otherUserId: thread.otherUser.id,
        otherUserEmail: thread.otherUser.email,
      };
      CHAT_MESSAGES = [];
      navigateTo(phoneEl, 'chat-detail');
    });
  });

  // Enviar una oferta real (V1.8): usa la misma mensajería que el chat,
  // marcada con type:"offer" y el monto, para que el vendedor la vea
  // destacada en la conversación.
  if (screenId === 'make-offer') {
    const sendOfferBtn = phoneEl.querySelector('#btnSendOffer');
    if (sendOfferBtn) {
      sendOfferBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const errEl = phoneEl.querySelector('#offerErrorMsg');
        if (errEl) errEl.style.display = 'none';
        if (!CURRENT_USER) {
          if (errEl) { errEl.textContent = 'Inicia sesión para hacer una oferta.'; errEl.style.display = 'block'; }
          return;
        }
        const listing = findListingById(CURRENT_PRODUCT_ID);
        if (!listing || !listing.sellerId) {
          if (errEl) { errEl.textContent = 'Este producto de muestra no tiene un vendedor real.'; errEl.style.display = 'block'; }
          return;
        }
        if (listing.sellerId === CURRENT_USER.id) {
          if (errEl) { errEl.textContent = 'No puedes hacerte una oferta a ti mismo.'; errEl.style.display = 'block'; }
          return;
        }
        const amountRaw = phoneEl.querySelector('#offer-amount')?.value.replace(/[^0-9.]/g, '') || '';
        const amount = Number(amountRaw);
        if (!amountRaw || Number.isNaN(amount) || amount <= 0) {
          if (errEl) { errEl.textContent = 'Ingresa un monto de oferta válido.'; errEl.style.display = 'block'; }
          return;
        }
        const extraMsg = phoneEl.querySelector('#offer-msg')?.value.trim() || '';
        const text = extraMsg || `Te ofrezco $${amount} por "${listing.title}"`;

        sendOfferBtn.disabled = true;
        sendOfferBtn.textContent = 'Enviando...';
        const result = await apiSendMessage(listing.id, listing.sellerId, text, { type: 'offer', amount });
        sendOfferBtn.disabled = false;
        sendOfferBtn.textContent = 'Enviar oferta';
        if (!result.ok) {
          if (errEl) { errEl.textContent = 'No se pudo enviar: ' + result.error; errEl.style.display = 'block'; }
          return;
        }

        LAST_OFFER = { sellerLabel: listing.sellerEmail, amount, title: listing.title };
        CURRENT_CHAT = {
          threadId: result.threadId,
          listingId: listing.id,
          listingTitle: listing.title,
          otherUserId: listing.sellerId,
          otherUserEmail: listing.sellerEmail,
        };
        CHAT_MESSAGES = [result.message];
        navigateTo(phoneEl, 'offer-sent');
      });
    }
  }

  // Iniciar (o continuar) un chat real desde el detalle de un producto (V1.7)
  if (screenId === 'product-detail') {
    ['btn-fab-chat', 'btn-buy-now'].forEach((testid) => {
      const btn = phoneEl.querySelector(`[data-testid="${testid}"]`);
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (!CURRENT_USER) {
          alert('Inicia sesión para chatear con el vendedor.');
          return;
        }
        const listing = findListingById(CURRENT_PRODUCT_ID);
        if (!listing || !listing.sellerId) {
          alert('Este producto de muestra no tiene un vendedor real para chatear todavía.');
          return;
        }
        if (listing.sellerId === CURRENT_USER.id) {
          alert('No puedes chatear contigo mismo: esta es tu propia publicación.');
          return;
        }
        CURRENT_CHAT = {
          threadId: null,
          listingId: listing.id,
          listingTitle: listing.title,
          otherUserId: listing.sellerId,
          otherUserEmail: listing.sellerEmail,
        };
        CHAT_MESSAGES = [];
        navigateTo(phoneEl, 'chat-detail');
      });
    });
  }

  // Aceptar / rechazar una oferta real (V1.9)
  phoneEl.querySelectorAll('[data-offer-response]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const messageId = btn.getAttribute('data-message-id');
      const response = btn.getAttribute('data-offer-response');
      btn.disabled = true;
      const result = await apiRespondOffer(messageId, response);
      if (!result.ok) {
        alert('No se pudo responder la oferta: ' + result.error);
        btn.disabled = false;
        return;
      }
      const i = CHAT_MESSAGES.findIndex((m) => m.id === messageId);
      if (i !== -1) CHAT_MESSAGES[i] = result.message;
      navigateTo(phoneEl, 'chat-detail', { skipFetch: true });
    });
  });

  // Contraofertar (V1.12): abrir/cerrar el formulario inline con el
  // monto nuevo, dentro de la misma burbuja de la oferta pendiente.
  phoneEl.querySelectorAll('[data-open-counter-offer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      COUNTER_OFFER_OPEN_FOR = btn.getAttribute('data-message-id');
      navigateTo(phoneEl, 'chat-detail', { skipFetch: true });
    });
  });
  phoneEl.querySelectorAll('[data-cancel-counter-offer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      COUNTER_OFFER_OPEN_FOR = null;
      navigateTo(phoneEl, 'chat-detail', { skipFetch: true });
    });
  });
  phoneEl.querySelectorAll('[data-send-counter-offer]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const messageId = btn.getAttribute('data-message-id');
      const input = phoneEl.querySelector(`[data-counter-offer-input][data-message-id="${messageId}"]`);
      const raw = input ? input.value.replace(/[^0-9.]/g, '') : '';
      const counterAmount = Number(raw);
      if (!raw || Number.isNaN(counterAmount) || counterAmount <= 0) {
        alert('Ingresa un monto de contraoferta válido.');
        return;
      }
      btn.disabled = true;
      const result = await apiRespondOffer(messageId, 'countered', counterAmount);
      if (!result.ok) {
        alert('No se pudo enviar la contraoferta: ' + result.error);
        btn.disabled = false;
        return;
      }
      const i = CHAT_MESSAGES.findIndex((m) => m.id === messageId);
      if (i !== -1) CHAT_MESSAGES[i] = result.message;
      if (result.counterMessage) CHAT_MESSAGES.push(result.counterMessage);
      COUNTER_OFFER_OPEN_FOR = null;
      navigateTo(phoneEl, 'chat-detail', { skipFetch: true });
    });
  });

  // Ir a "Confirmar venta" real desde una oferta ya aceptada (V1.10)
  phoneEl.querySelectorAll('[data-mark-sold-from-offer]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const listingId = btn.getAttribute('data-listing-id');
      const buyerId = btn.getAttribute('data-buyer-id');
      const amount = btn.getAttribute('data-amount');
      const listing = findListingById(listingId);
      CURRENT_SALE = {
        listingId,
        listingTitle: listing ? listing.title : (CURRENT_CHAT ? CURRENT_CHAT.listingTitle : null),
        buyerId,
        buyerEmail: CURRENT_CHAT && CURRENT_CHAT.otherUserId === buyerId ? CURRENT_CHAT.otherUserEmail : null,
        amount,
      };
      navigateTo(phoneEl, 'confirm-sale');
    });
  });

  // Confirmar venta real (V1.10): antes este botón solo navegaba a
  // "Calificar" sin tocar el backend; ahora marca la publicación como
  // vendida de verdad, con comprador y precio final reales.
  const confirmMarkSoldBtn = phoneEl.querySelector('#btnConfirmMarkSold');
  if (confirmMarkSoldBtn) {
    confirmMarkSoldBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#saleErrorMsg');
      if (errEl) errEl.style.display = 'none';
      if (!CURRENT_SALE) return;
      const priceRaw = phoneEl.querySelector('#sale-price')?.value.replace(/[^0-9.]/g, '') || '';
      const finalPrice = Number(priceRaw);
      if (!priceRaw || Number.isNaN(finalPrice) || finalPrice <= 0) {
        if (errEl) { errEl.textContent = 'Ingresa un precio final válido.'; errEl.style.display = 'block'; }
        return;
      }
      confirmMarkSoldBtn.disabled = true;
      confirmMarkSoldBtn.textContent = 'Guardando...';
      const result = await apiSetListingStatus(CURRENT_SALE.listingId, 'sold', {
        buyerId: CURRENT_SALE.buyerId,
        finalPrice,
      });
      confirmMarkSoldBtn.disabled = false;
      confirmMarkSoldBtn.textContent = 'Marcar como vendido';
      if (!result.ok) {
        if (errEl) { errEl.textContent = 'No se pudo confirmar: ' + result.error; errEl.style.display = 'block'; }
        return;
      }
      // Reflejar el nuevo estado en las listas locales que ya tengamos cargadas.
      const iMine = MY_LISTINGS.findIndex((l) => l.id === CURRENT_SALE.listingId);
      if (iMine !== -1) MY_LISTINGS[iMine] = result.listing;
      const iAll = ALL_LISTINGS.findIndex((l) => l.id === CURRENT_SALE.listingId);
      if (iAll !== -1) ALL_LISTINGS[iAll] = result.listing;
      // V1.17: se agrega listingId, indispensable para poder calificar
      // esta transacción de verdad desde la pantalla "Calificar".
      LAST_SALE = { listingId: CURRENT_SALE.listingId, buyerEmail: CURRENT_SALE.buyerEmail, buyerId: CURRENT_SALE.buyerId, listingTitle: CURRENT_SALE.listingTitle, finalPrice };
      SELECTED_RATING_STARS = 0;
      CURRENT_SALE = null;
      navigateTo(phoneEl, 'rate-transaction');
    });
  }

  // Enviar un mensaje real en el chat (V1.7)
  const sendChatBtn = phoneEl.querySelector('#btnSendChatMessage');
  if (sendChatBtn && CURRENT_CHAT) {
    sendChatBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const input = phoneEl.querySelector('#chatMessageInput');
      const errEl = phoneEl.querySelector('#chatErrorMsg');
      const text = input?.value.trim();
      if (!text) return;
      if (errEl) errEl.style.display = 'none';
      sendChatBtn.disabled = true;
      const result = await apiSendMessage(CURRENT_CHAT.listingId, CURRENT_CHAT.otherUserId, text);
      sendChatBtn.disabled = false;
      if (!result.ok) {
        if (errEl) { errEl.textContent = 'No se pudo enviar: ' + result.error; errEl.style.display = 'block'; }
        return;
      }
      CURRENT_CHAT.threadId = result.threadId;
      CHAT_MESSAGES.push(result.message);
      navigateTo(phoneEl, 'chat-detail', { skipFetch: true });
    });
  }

  // V1.27: fotos reales en Publicar paso 1 — se comprimen en el teléfono
  // (máx. 1280 px, JPEG) antes de guardarlas en el borrador.
  phoneEl.querySelectorAll('[data-photo-input]').forEach((input) => {
    input.addEventListener('click', (e) => { e.stopPropagation(); markCameraOpening('publish-step1'); });
    input.addEventListener('change', async (e) => {
      e.stopPropagation();
      clearCameraOpening();
      const files = Array.from(input.files || []);
      if (!files.length) return;
      // V1.33: cada foto se revisa en el teléfono antes de aceptarla
      // (personas y contenido sexual no se permiten; ver moderacion.js).
      const checkEl = phoneEl.querySelector('#photoCheckMsg');
      phoneEl.querySelectorAll('[data-photo-input]').forEach((i) => { i.disabled = true; });
      if (checkEl) {
        checkEl.style.display = 'block';
        checkEl.style.color = 'var(--color-text-muted)';
        checkEl.textContent = 'Revisando la foto… (la primera vez tarda un poco más)';
      }
      const avisos = [];
      let room = MAX_LISTING_PHOTOS - draftPhotoList().length;
      for (const file of files) {
        if (room <= 0) break;
        let data;
        try {
          data = await compressImage(file);
        } catch (err) {
          avisos.push('No se pudo leer una de las fotos: ' + err.message);
          continue;
        }
        try {
          const r = await HAY_MODERACION.revisar(data);
          if (!r.ok) {
            avisos.push(HAY_MODERACION.MENSAJES[r.motivo]);
            continue;
          }
        } catch (err) {
          avisos.push('No se pudo revisar la foto (' + err.message + '). Revisa tu conexión e inténtalo de nuevo.');
          continue;
        }
        PUBLISH_DRAFT.photoData.push(data);
        // V1.35: miniatura para las tarjetas del feed (carga mucho más rápido)
        let thumb = null;
        try { thumb = await makeThumb(data); } catch (err) {}
        (PUBLISH_DRAFT.thumbData = PUBLISH_DRAFT.thumbData || []).push(thumb);
        room -= 1;
      }
      PUBLISH_DRAFT.photos = draftPhotoList().length;
      navigateTo(phoneEl, 'publish-step1', { skipFetch: true });
      const errEl = phoneEl.querySelector('#photoErrorMsg');
      if (errEl && avisos.length) {
        errEl.textContent = [...new Set(avisos)].join(' ');
        errEl.style.display = 'block';
      }
    });
  });
  phoneEl.querySelectorAll('[data-remove-photo]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const i = Number(btn.getAttribute('data-remove-photo'));
      const keptCount = (PUBLISH_DRAFT.photoUrls || []).length;
      if (i < keptCount) PUBLISH_DRAFT.photoUrls.splice(i, 1);
      else {
        PUBLISH_DRAFT.photoData.splice(i - keptCount, 1);
        if (PUBLISH_DRAFT.thumbData) PUBLISH_DRAFT.thumbData.splice(i - keptCount, 1);
      }
      PUBLISH_DRAFT.photos = draftPhotoList().length;
      navigateTo(phoneEl, 'publish-step1', { skipFetch: true });
    });
  });

  // V1.33: foto de perfil desde la cámara (frontal) o la galería
  const avatarMsg = (text, color) => {
    const el = phoneEl.querySelector('#avatarMsg');
    if (!el) return;
    el.textContent = text;
    el.style.color = color || 'var(--color-text-muted)';
    el.style.display = text ? 'block' : 'none';
  };
  phoneEl.querySelectorAll('[data-avatar-input]').forEach((input) => {
    input.addEventListener('click', (e) => { e.stopPropagation(); markCameraOpening('edit-profile'); });
    input.addEventListener('change', async (e) => {
      e.stopPropagation();
      clearCameraOpening();
      const file = input.files && input.files[0];
      if (!file) return;
      if (!CURRENT_USER) { navigateTo(phoneEl, 'login'); return; }
      avatarMsg('Subiendo tu foto…');
      let data;
      try {
        data = await squareImage(file, 512);
      } catch (err) {
        avatarMsg('No se pudo leer la foto: ' + err.message, 'var(--color-error)');
        return;
      }
      const result = await apiUploadAvatar(data);
      if (!result.ok) { avatarMsg('No se pudo guardar la foto: ' + result.error, 'var(--color-error)'); return; }
      CURRENT_USER = result.user;
      navigateTo(phoneEl, 'edit-profile', { skipFetch: true });
      const el = phoneEl.querySelector('#avatarMsg');
      if (el) { el.textContent = 'Foto de perfil guardada ✓'; el.style.color = 'var(--hay-green-active)'; el.style.display = 'block'; }
    });
  });
  const avatarRemove = phoneEl.querySelector('[data-avatar-remove]');
  if (avatarRemove) {
    avatarRemove.addEventListener('click', async (e) => {
      e.stopPropagation();
      avatarMsg('Quitando la foto…');
      const result = await apiUploadAvatar(null);
      if (!result.ok) { avatarMsg('No se pudo quitar: ' + result.error, 'var(--color-error)'); return; }
      CURRENT_USER = result.user;
      navigateTo(phoneEl, 'edit-profile', { skipFetch: true });
    });
  }

  // V1.28: verificación de identidad — capturar cédula y selfie
  phoneEl.querySelectorAll('[data-identity-input]').forEach((input) => {
    input.addEventListener('click', (e) => {
      e.stopPropagation();
      markCameraOpening('verify-identity'); // V1.36
    });
    input.addEventListener('change', async (e) => {
      e.stopPropagation();
      clearCameraOpening();
      const kind = input.getAttribute('data-identity-input');
      const file = input.files && input.files[0];
      const errEl = phoneEl.querySelector('#identityErrorMsg');
      IDENTITY_NOTICE = null;
      if (!file) return;
      // V1.36: se avisa que la foto se está preparando (antes no se veía nada)
      if (errEl) { errEl.textContent = 'Preparando la foto…'; errEl.style.color = 'var(--color-text-muted)'; errEl.style.display = 'block'; }
      let data;
      try {
        data = await compressImage(file);
      } catch (err) {
        if (errEl) { errEl.textContent = 'No se pudo leer la foto: ' + err.message; errEl.style.color = 'var(--color-error)'; errEl.style.display = 'block'; }
        return;
      }
      // V1.37: en la foto de la cédula se tiene que ver la cara
      if (kind === 'cedula') {
        if (errEl) errEl.textContent = 'Revisando la foto de la cédula… (la primera vez tarda un poco)';
        let cara = true;
        try { cara = await HAY_VERIFICACION.hayCaraEnCedula(data); } catch (err) { cara = true; }
        if (!cara) {
          if (errEl) { errEl.textContent = 'No se ve la cara en la foto de la cédula. Tómala de nuevo más cerca, con buena luz y sin reflejos, del lado de la foto.'; errEl.style.color = 'var(--color-error)'; }
          return;
        }
      }
      IDENTITY_DRAFT[kind] = data;
      if (kind === 'selfie') IDENTITY_SELFIE_RETOS = null;
      IDENTITY_TRIES = 0;
      navigateTo(phoneEl, 'verify-identity', { skipFetch: true });
    });
  });
  // V1.37: selfie en vivo con la cámara dentro de la app
  const selfieBtn = phoneEl.querySelector('[data-action="selfie-live"]');
  if (selfieBtn) {
    selfieBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const box = phoneEl.querySelector('#selfieLive');
      const est = phoneEl.querySelector('#selfieEstado');
      const errEl = phoneEl.querySelector('#identityErrorMsg');
      if (errEl) errEl.style.display = 'none';
      selfieBtn.disabled = true;
      est.style.display = 'block';
      try {
        const r = await HAY_VERIFICACION.selfieEnVivo(box, (t) => { est.textContent = t; });
        IDENTITY_DRAFT.selfie = r.foto;
        IDENTITY_SELFIE_RETOS = r.retos;
        IDENTITY_TRIES = 0;
        navigateTo(phoneEl, 'verify-identity', { skipFetch: true });
      } catch (err) {
        selfieBtn.disabled = false;
        est.style.display = 'none';
        if (errEl) { errEl.textContent = 'No se pudo tomar la selfie: ' + err.message; errEl.style.color = 'var(--color-error)'; errEl.style.display = 'block'; }
      }
    });
  }
  const submitIdentityBtn = phoneEl.querySelector('#btnSubmitIdentity');
  if (submitIdentityBtn) {
    submitIdentityBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#identityErrorMsg');
      if (errEl) errEl.style.display = 'none';
      if (!CURRENT_USER) {
        PENDING_AFTER_LOGIN = 'verify-identity';
        navigateTo(phoneEl, 'login');
        return;
      }
      if (!IDENTITY_SELFIE_RETOS) {
        if (errEl) { errEl.textContent = 'Toma la selfie en vivo con el botón «Tomar selfie en vivo».'; errEl.style.display = 'block'; }
        return;
      }
      submitIdentityBtn.disabled = true;
      // V1.37: comparar la cara de la selfie con la de la cédula
      submitIdentityBtn.textContent = 'Comparando tu cara con la cédula…';
      let match = null;
      let matchError = null;
      try {
        match = await HAY_VERIFICACION.comparar(IDENTITY_DRAFT.selfie, IDENTITY_DRAFT.cedula);
        if (match.error) { matchError = match.error; match = null; }
      } catch (err) {
        matchError = 'no se pudo hacer la comparación automática (' + err.message + ')';
      }
      if (match && !match.coincide && IDENTITY_TRIES < 2) {
        IDENTITY_TRIES += 1;
        submitIdentityBtn.disabled = false;
        submitIdentityBtn.textContent = IDENTITY_TRIES >= 2 ? 'Enviar para revisión manual' : 'Enviar verificación';
        if (errEl) {
          errEl.textContent = IDENTITY_TRIES >= 2
            ? 'La cara sigue sin coincidir con la de la cédula. Puedes enviarla para que un moderador la revise a mano.'
            : 'La cara de la selfie no coincide con la de la cédula. Repite la selfie con buena luz y la foto de la cédula bien enfocada.';
          errEl.style.display = 'block';
        }
        return;
      }
      if (matchError && errEl) { errEl.textContent = 'Aviso: ' + matchError + '. Se enviará para revisión manual.'; errEl.style.display = 'block'; }
      submitIdentityBtn.textContent = 'Enviando...';
      const check = {
        liveness: true,
        retos: IDENTITY_SELFIE_RETOS,
        distancia: match ? match.distancia : null,
        coincide: Boolean(match && match.coincide),
        nota: matchError || null,
      };
      const result = await apiSubmitIdentity(IDENTITY_DRAFT.cedula, IDENTITY_DRAFT.selfie, check);
      if (!result.ok) {
        submitIdentityBtn.disabled = false;
        submitIdentityBtn.textContent = 'Enviar verificación';
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      CURRENT_USER = result.user;
      IDENTITY_DRAFT = { cedula: null, selfie: null };
      IDENTITY_SELFIE_RETOS = null;
      IDENTITY_TRIES = 0;
      const next = PENDING_AFTER_IDENTITY;
      PENDING_AFTER_IDENTITY = null;
      // V1.35: aviso de verificación completada (+ correo)
      IDENTITY_DONE = { email: result.email, next: next || 'home' };
      navigateTo(phoneEl, 'identity-success');
    });
  }
  // V1.28: moderador — ver fotos de una verificación (se piden al tocar)
  phoneEl.querySelectorAll('[data-view-identity]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const userId = btn.getAttribute('data-view-identity');
      const box = phoneEl.querySelector(`[data-identity-photos="${userId}"]`);
      if (!box) return;
      btn.disabled = true;
      const [ced, sel] = await Promise.all([apiFetchIdentityPhoto(userId, 'cedula'), apiFetchIdentityPhoto(userId, 'selfie')]);
      box.innerHTML = [ced, sel]
        .map((u, i) => (u ? `<img src="${u}" alt="${i ? 'Selfie' : 'Cédula'}" style="width:48%; border-radius:12px; object-fit:cover; aspect-ratio:3/4;" />` : `<p class="text-xs" style="color:var(--color-error)">No se pudo cargar</p>`))
        .join('');
      box.style.display = 'flex';
    });
  });

  // V1.30: eliminar cuenta
  const deleteBtn = phoneEl.querySelector('#btnConfirmDeleteAccount');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#deleteErrorMsg');
      if (errEl) errEl.style.display = 'none';
      const confirmTxt = phoneEl.querySelector('#del-confirm')?.value || '';
      if (confirmTxt.trim().toUpperCase() !== 'ELIMINAR') {
        if (errEl) { errEl.textContent = 'Escribe ELIMINAR para confirmar.'; errEl.style.display = 'block'; }
        return;
      }
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Eliminando...';
      const result = await apiDeleteAccount(phoneEl.querySelector('#del-pass')?.value || '', confirmTxt);
      if (!result.ok) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = 'Eliminar';
        if (errEl) { errEl.textContent = result.error; errEl.style.display = 'block'; }
        return;
      }
      stopInboxPoll();
      setToken(null);
      CURRENT_USER = null;
      MY_LISTINGS = [];
      THREADS = [];
      navigateTo(phoneEl, 'onboarding-slides');
    });
  }

  // Botón "Publicar" (paso 5 → crea la publicación real vía backend)
  const confirmPublishBtn = phoneEl.querySelector('#btnConfirmPublish');
  if (confirmPublishBtn) {
    confirmPublishBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const errEl = phoneEl.querySelector('#publishErrorMsg');
      if (errEl) errEl.style.display = 'none';
      const isEditing = Boolean(EDITING_LISTING_ID);
      confirmPublishBtn.disabled = true;
      confirmPublishBtn.textContent = isEditing ? 'Guardando...' : 'Publicando...';

      const payload = {
        title: PUBLISH_DRAFT.title,
        description: PUBLISH_DRAFT.description,
        price: PUBLISH_DRAFT.price,
        category: PUBLISH_DRAFT.category,
        icon: PUBLISH_DRAFT.categoryIcon,
        condition: PUBLISH_DRAFT.condition,
        zone: PUBLISH_DRAFT.zone,
        acceptsOffers: PUBLISH_DRAFT.acceptsOffers,
        photos: draftPhotoList().length || PUBLISH_DRAFT.photos,
        // V1.27: fotos reales
        photoData: PUBLISH_DRAFT.photoData || [],
        thumbData: PUBLISH_DRAFT.thumbData || [], // V1.35
        keepPhotoUrls: PUBLISH_DRAFT.photoUrls || [],
        lat: PUBLISH_DRAFT.lat ?? null, // V1.35: ubicación aproximada (GPS)
        lng: PUBLISH_DRAFT.lng ?? null,
      };

      const result = isEditing
        ? await apiUpdateListing(EDITING_LISTING_ID, payload)
        : await apiCreateListing(payload);

      if (!result.ok && result.status === 403 && /identidad/i.test(result.error || '')) {
        // V1.28: el servidor pide verificar identidad antes de publicar
        if (CURRENT_USER) CURRENT_USER.identityStatus = 'none';
        PENDING_AFTER_IDENTITY = 'publish-step5';
        navigateTo(phoneEl, 'verify-identity');
        return;
      }
      if (!result.ok) {
        confirmPublishBtn.disabled = false;
        confirmPublishBtn.textContent = isEditing ? 'Guardar cambios' : 'Publicar';
        if (errEl) {
          errEl.textContent = (isEditing ? 'No se pudo guardar: ' : 'No se pudo publicar: ') + result.error + (HAY_APP_MODE ? '' : ' (¿está corriendo el backend en localhost:3000?)');
          errEl.style.display = 'block';
        }
        return;
      }

      await refreshProductGrids();

      if (isEditing) {
        EDITING_LISTING_ID = null;
        resetPublishDraft();
        navigateTo(phoneEl, 'my-listings');
      } else {
        navigateTo(phoneEl, 'publish-success');
      }
    });
  }

  // Splash: avance automático a onboarding tras 1.6s
  if (screenId === 'splash') {
    setTimeout(() => {
      if (phoneEl.dataset.currentScreen === 'splash' || !phoneEl.dataset.currentScreen) {
        // V1.27: en la app real, quien ya tiene sesión o ya vio el
        // onboarding entra directo a Inicio.
        let seen = false;
        try { seen = localStorage.getItem('hay_onboarding_seen') === '1'; } catch (e) {}
        // V1.36: si el teléfono cerró la app al abrir la cámara, se vuelve a esa pantalla con un aviso
        const back = HAY_APP_MODE && CURRENT_USER ? takeCameraOpening() : null;
        if (back) {
          if (back === 'verify-identity') IDENTITY_NOTICE = 'Tu teléfono cerró HAY al abrir la cámara y la foto se perdió. Toma la foto con la cámara normal del teléfono y luego súbela con el botón «Galería».';
          if (back === 'publish-step1' && !PUBLISH_DRAFT.photoData) resetPublishDraft();
          navigateTo(phoneEl, back === 'publish-step1' ? 'publish-step1' : back, { replaceHistory: true });
          if (back !== 'verify-identity') {
            const m = phoneEl.querySelector('#photoErrorMsg, #avatarMsg');
            if (m) { m.textContent = 'Tu teléfono cerró HAY al abrir la cámara. Toma la foto con la cámara normal y súbela con «Galería».'; m.style.display = 'block'; }
          }
          return;
        }
        navigateTo(phoneEl, HAY_APP_MODE && (CURRENT_USER || seen) ? 'home' : 'onboarding-slides', { replaceHistory: true });
      }
    }, HAY_APP_MODE && CURRENT_USER ? 500 : 1600); // V1.35: quien ya entró antes no espera
  }
}

/* Vuelve a pintar SOLO el grid de productos de Inicio y Buscar (no todo
   el frame), usando el PRODUCTS actual — se usa al arrancar (si el
   backend respondió) y después de publicar algo nuevo. No tocamos el
   resto de cada pantalla (barra de búsqueda, chips, etc.) para no perder
   estado que el usuario ya haya tocado ahí. */
async function refreshProductGrids() {
  if (HAY_APP_MODE) return; // V1.29: la app real recarga el feed al volver a Inicio/Buscar
  const fresh = await apiFetchListings();
  if (fresh) {
    setProducts(fresh);
    ALL_LISTINGS = fresh;
  }

  const homePhone = document.getElementById('phone-home');
  if (homePhone) {
    const grid = homePhone.querySelector('[data-testid="home-product-grid"]');
    if (grid) grid.innerHTML = PRODUCTS.slice(0, 8).map((p) => productCard(p)).join('');
  }
  const searchPhone = document.getElementById('phone-search');
  if (searchPhone) {
    const grid = searchPhone.querySelector('[data-testid="search-results-grid"]');
    if (grid) grid.innerHTML = PRODUCTS.slice(1, 9).map((p) => productCard(p)).join('');
  }
}

/* Filtro de bloques (barra superior de navegación por bloques) */
function mountBlockFilter() {
  const buttons = document.querySelectorAll('.block-nav__btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      const block = btn.dataset.block;
      document.querySelectorAll('.screen-slot').forEach((slot) => {
        slot.style.display = block === 'all' || slot.dataset.block === block ? '' : 'none';
      });
    });
  });
}

async function init() {
  // Si el backend (backend/server.js) está corriendo en localhost:3000,
  // reemplazamos los productos de muestra por los datos reales ANTES de
  // pintar las pantallas. Si no responde (backend apagado, o el archivo
  // se abrió directo con file://), seguimos con los datos de respaldo
  // sin romper nada — ver api.js y screens-main.js.
  // V1.29: la app real no descarga todo: Inicio/Buscar piden de a 20.
  // V1.35: la primera página del feed se pide YA, en paralelo con la sesión.
  if (HAY_APP_MODE) {
    FEED_PREFETCH = { key: JSON.stringify({ category: null, sellerType: null, q: '' }), promise: apiFetchFeed({}) };
  }
  const listings = HAY_APP_MODE ? null : await apiFetchListings();
  if (HAY_APP_MODE) PRODUCTS = [];
  if (listings) {
    setProducts(listings);
    // V1.7: guardamos también los objetos completos (con sellerId,
    // sellerEmail, descripción) para la pantalla de detalle real y
    // para poder iniciar un chat real desde ahí.
    ALL_LISTINGS = listings;
  }

  // V1.2: si ya había una sesión guardada (token en localStorage),
  // la restauramos contra el backend antes de pintar las pantallas,
  // para que "Mi perfil" muestre al usuario real desde el arranque.
  CURRENT_USER = await apiFetchMe();

  if (HAY_APP_MODE) {
    // V1.27: app real — una sola pantalla a tamaño completo
    resetPublishDraft();
    const root = document.getElementById('screensGrid');
    root.innerHTML = `<div class="phone phone--app" id="phone-app" data-testid="phone-app"><div class="phone__notch"></div>${SCREEN_MAP.splash.html()}</div>`;
    mountNavigation();
    const phoneEl = document.getElementById('phone-app');
    phoneEl.dataset.currentScreen = 'splash';
    try { history.replaceState({ screen: 'splash' }, ''); } catch (e) {}
    window.addEventListener('popstate', (ev) => {
      const target = (ev.state && ev.state.screen) || 'home';
      if (target === 'splash') return;
      navigateTo(phoneEl, target, { fromHistory: true });
    });
    wireInteractiveBehaviors(phoneEl, 'splash');
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      // V1.35: cuando llega una versión nueva, la app se recarga una vez sola
      const hadController = Boolean(navigator.serviceWorker.controller);
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController || reloaded) return;
        reloaded = true;
        location.reload();
      });
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    startInboxPoll(); // V1.35: avisos y sonido de mensajes nuevos
    return;
  }
  renderScreens();
  mountNavigation();
  mountBlockFilter();
  // Inicializa comportamientos interactivos de cada frame en su estado inicial
  document.querySelectorAll('.phone').forEach((phoneEl) => {
    const id = phoneEl.id.replace('phone-', '');
    phoneEl.dataset.currentScreen = id;
    wireInteractiveBehaviors(phoneEl, id);
  });
}

document.addEventListener('DOMContentLoaded', init);

/* V1.27: reduce una foto del teléfono (que suele pesar 3-8 MB) a un
   JPEG de máx. 1280 px, para que subirla sea rápido aun con datos
   móviles. Si sigue pesando más de ~1,3 MB, se baja la calidad. */
/* V1.36: la foto se abre sin copiarla entera a texto (FileReader + base64 de
   5-10 MB era lo que más memoria gastaba y hacía fallar teléfonos sencillos).
   Se usa createImageBitmap, que además respeta la orientación de la cámara.
   Si el teléfono no puede abrirla (ej. foto HEIC), se explica qué hacer. */
async function compressImage(file) {
  const isHeic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name || '');
  if (file.type && !file.type.startsWith('image/') && !isHeic) throw new Error('el archivo no es una imagen');
  if (window.createImageBitmap) {
    let bmp = null;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { bmp = null; }
    if (bmp) {
      const encode = (maxSide, quality) => {
        const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bmp.width * scale);
        canvas.height = Math.round(bmp.height * scale);
        canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', quality);
      };
      let out = encode(1280, 0.8);
      if (out.length * 0.75 > 1.3 * 1024 * 1024) out = encode(1024, 0.65);
      if (bmp.close) bmp.close();
      return out;
    }
    if (isHeic) throw new Error('la foto está en formato HEIC y este teléfono no la puede abrir. Usa «Tomar foto», o en la cámara del teléfono cambia el formato a JPG (Ajustes de la cámara → Formatos de imagen).');
  }
  return compressImageLegacy(file);
}
function compressImageLegacy(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('el archivo no es una imagen'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lectura fallida'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('formato no soportado'));
      img.onload = () => {
        const encode = (maxSide, quality) => {
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', quality);
        };
        let out = encode(1280, 0.8);
        if (out.length * 0.75 > 1.3 * 1024 * 1024) out = encode(1024, 0.65);
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* V1.33: foto cuadrada (recorte al centro), para la foto de perfil. */
function squareImage(file, side = 512) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('el archivo no es una imagen'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('lectura fallida'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('formato no soportado'));
      img.onload = () => {
        const s = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.min(side, s);
        canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* V1.28: a dónde ir después de iniciar sesión o registrarse. */
function afterLoginTarget() {
  const pending = PENDING_AFTER_LOGIN;
  PENDING_AFTER_LOGIN = null;
  if (pending === 'publish-step1' && needsIdentity()) {
    PENDING_AFTER_IDENTITY = 'publish-step1';
    return 'verify-identity';
  }
  if (pending === 'publish-step1') resetPublishDraft();
  return pending || 'home';
}

/* V1.36: Android a veces cierra el navegador o la app mientras la cámara está
   abierta (poca memoria). Antes de abrir la cámara se anota la pantalla; si la
   app vuelve a arrancar en menos de 10 minutos, se regresa a esa pantalla. */
const CAMERA_KEY = 'hay_camera_open';
function markCameraOpening(screen) {
  try { sessionStorage.setItem(CAMERA_KEY, JSON.stringify({ screen, at: Date.now() })); } catch (e) {}
  try { localStorage.setItem(CAMERA_KEY, JSON.stringify({ screen, at: Date.now() })); } catch (e) {}
}
// Si la persona cancela la cámara o la galería no llega ningún "change": al
// volver a la app se borra la marca (si la app se cerró, no corre nada y queda).
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) setTimeout(clearCameraOpening, 4000);
});
function clearCameraOpening() {
  try { sessionStorage.removeItem(CAMERA_KEY); } catch (e) {}
  try { localStorage.removeItem(CAMERA_KEY); } catch (e) {}
}
function takeCameraOpening() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(CAMERA_KEY) || 'null'); } catch (e) {}
  clearCameraOpening();
  return v && Date.now() - v.at < 10 * 60 * 1000 ? v.screen : null;
}
