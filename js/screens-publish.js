/* screens-publish.js — Bloque 3: Publicar producto, flujo de 5 pasos (pantallas 11-15) */

/* PUBLISH_DRAFT — estado real del formulario de publicar, en memoria.
   Antes (V1.0), cada paso mostraba texto fijo sin importar qué escribiera
   el usuario; el paso 5 (Revisión) siempre mostraba "Bicicleta montaña
   rodado 26" aunque el usuario hubiera tipeado otra cosa. Ahora los pasos
   3/4/5 leen y escriben este mismo objeto, así que lo que se tipea en el
   paso 3 realmente aparece en la Revisión y en la publicación creada.
   Los valores iniciales son los mismos que ya estaban hardcodeados, para
   que el prototipo se vea igual si nadie interactúa con los campos. */
let PUBLISH_DRAFT = {
  title: 'Bicicleta montaña rodado 26',
  description: 'Bicicleta rodado 26 en buen estado, frenos y cambios recién ajustados. Ideal para uso diario o senderos ligeros. Se entrega con casco de regalo.',
  category: 'Deportes y aire libre',
  categoryIcon: 'ball',
  condition: 'Usado',
  price: 180,
  zone: 'Wynwood, Miami, FL',
  acceptsOffers: true,
  photos: 3,
  photoData: [], // V1.27: fotos nuevas (data URL ya comprimidas en el teléfono)
  photoUrls: [], // V1.27: fotos ya subidas que se conservan al editar
};
const MAX_LISTING_PHOTOS = 6;
function draftPhotoList() {
  return (PUBLISH_DRAFT.photoUrls || []).map((u) => photoSrc(u)).concat(PUBLISH_DRAFT.photoData || []);
}

/* EDITING_LISTING_ID (V1.5): si no es null, el flujo de Publicar está
   en modo edición sobre una publicación real ya existente — al
   confirmar, se actualiza en vez de crear una nueva. */
let EDITING_LISTING_ID = null;

function resetPublishDraft() {
  EDITING_LISTING_ID = null;
  PUBLISH_DRAFT = {
    title: '',
    description: '',
    category: 'Otros',
    categoryIcon: 'tag',
    condition: 'Usado',
    price: '',
    zone: '',
    acceptsOffers: true,
    photos: 0,
    photoData: [],
    thumbData: [], // V1.35: miniaturas de las fotos nuevas
    photoUrls: [],
    lat: null, // V1.35: ubicación aproximada (GPS)
    lng: null,
  };
}

function publishStepHeader(step, title, backTarget) {
  return `
  <div class="step-header">
    <div class="step-header__top">
      <button class="icon-btn" data-nav="${backTarget}" aria-label="Volver" data-testid="btn-back-publish-step${step}">${backTarget === 'exit-publish-confirm' ? icon('close') : icon('back')}</button>
      <span class="step-header__title">${title}</span>
      <span class="step-header__count">${step}/5</span>
    </div>
    ${stepperDots(step, 5)}
  </div>`;
}

/* V1.45: Publicar en UNA sola página (diseño Stitch): fotos, qué vendes,
   precio y detalles/ubicación, con el botón «Publicar artículo ahora» al final.
   Usa los mismos data-* de siempre (data-draft-field, data-photo-input,
   .category-tile, #btnConfirmPublish…), así la lógica de app.js no cambia:
   las fotos se siguen revisando en el teléfono y en el servidor.
   Los ids viejos publish-step2…5 muestran esta misma página (para «Editar»
   una publicación y para volver después de verificar la identidad). */
function publishSinglePage() {
  const photos = draftPhotoList();
  const editing = Boolean(EDITING_LISTING_ID);
  const condOpts = [
    { v: 'Nuevo', ic: 'sparkle' },
    { v: 'Como nuevo', ic: 'star' },
    { v: 'Usado', ic: 'reorder' },
  ];
  return `
    <div class="phone__screen screen--alegre">
      ${statusBar()}
      <header class="pub-head">
        <button class="icon-btn pub-head__back" data-nav="exit-publish-confirm" aria-label="Salir de publicar" data-testid="btn-back-publish-step1">${icon('back')}</button>
        <div class="pub-head__text">
          <h1 class="screen-title">${editing ? 'Editar publicación' : 'Publicar artículo'}</h1>
          <p>Completa los datos y conéctate con compradores al instante</p>
        </div>
      </header>
      <div class="screen-body">
        <div class="screen-content pub-page" data-testid="screen-publish-step1">

          <section class="pub-card" data-testid="publish-photos">
            <div class="pub-card__head"><h2><span class="pub-dot pub-dot--cyan"></span>Fotos del producto</h2><span class="pub-count" data-testid="photo-count">${photos.length} de ${MAX_LISTING_PHOTOS} fotos</span></div>
            <p class="pub-hint">La primera foto será la portada. Usa buena luz natural.</p>
            <p class="photo-rules" data-testid="photo-rules">Solo fotos del artículo. No se permiten fotos de personas ni contenido sexual o violento.</p>
            <div class="photo-actions">
              <label class="btn btn--turquoise" style="cursor:pointer;" data-testid="btn-open-camera">
                ${icon('camera')} Tomar foto
                <input type="file" accept="image/*" capture="environment" data-photo-input data-testid="input-photo-camera" style="display:none;" />
              </label>
              <label class="btn btn--green" style="cursor:pointer;" data-testid="btn-open-gallery">
                ${icon('gallery')} Galería
                <input type="file" accept="image/*" multiple data-photo-input data-testid="input-photo-file" style="display:none;" />
              </label>
            </div>
            <p class="text-xs" id="photoCheckMsg" data-testid="photo-check-msg" style="display:none; font-weight:700;"></p>
            <p class="text-xs photo-error" id="photoErrorMsg" data-testid="photo-error-msg" role="alert" style="display:none;"></p>
            ${photos.length ? `<div class="photo-grid pub-photos" data-testid="photo-grid">
              ${photos.map((src, i) => `
              <div class="photo-slot photo-slot--img" style="position:relative;">
                <img src="${src}" alt="Foto ${i + 1}" />
                ${i === 0 ? '<span class="photo-slot--cover">PORTADA</span>' : ''}
                <span class="photo-slot__remove" role="button" aria-label="Quitar foto" data-remove-photo="${i}" data-testid="btn-remove-photo-${i + 1}">${icon('close')}</span>
              </div>`).join('')}
              ${photos.length < MAX_LISTING_PHOTOS ? `<label class="photo-slot photo-slot--empty" aria-label="Agregar foto" data-testid="btn-add-photo-${photos.length + 1}" style="cursor:pointer;">${icon('camera')}<span>Subir foto</span><input type="file" accept="image/*" multiple data-photo-input style="display:none;" /></label>` : ''}
            </div>` : ''}
          </section>

          <section class="pub-card" data-testid="publish-what">
            <div class="pub-card__head"><h2><span class="pub-dot pub-dot--yellow"></span>¿Qué estás vendiendo?</h2></div>
            <div class="field">
              <label for="pub-title">Título del artículo</label>
              <input id="pub-title" type="text" value="${String(PUBLISH_DRAFT.title || '').replace(/"/g, '&quot;')}" maxlength="60" placeholder="Ej. Bicicleta rin 26" data-testid="input-publish-title" data-draft-field="title" />
            </div>
            <div class="field">
              <label>Categoría</label>
              <div class="category-grid pub-cats" data-testid="category-grid">
                ${CATEGORY_ICONS.map((c) => {
                  const sel = PUBLISH_DRAFT.category === c.label;
                  return `<button class="category-tile ${sel ? 'is-selected' : ''}" data-testid="category-${c.label.split(' ')[0].toLowerCase()}" data-cat-label="${c.label}" data-cat-icon="${c.icon}"><span class="category-tile__icon">${icon(c.icon)}</span><span>${c.label}</span></button>`;
                }).join('')}
              </div>
            </div>
            <div class="field">
              <label>Estado del producto</label>
              <div class="pill-row pub-cond" data-testid="condition-pills" data-draft-field="condition">
                ${condOpts.map((o) => `<span class="pill ${PUBLISH_DRAFT.condition === o.v ? 'is-selected' : ''}">${o.v}</span>`).join('')}
              </div>
            </div>
          </section>

          <section class="pub-card" data-testid="publish-price">
            <div class="pub-card__head"><h2><span class="pub-dot pub-dot--green"></span>Fija tu precio</h2>${HAY_APP_MODE ? '<span class="pub-count">Doble moneda</span>' : ''}</div>
            <div class="field">
              <label for="pub-price">Precio en dólares (USD)</label>
              <div class="pub-price">
                <span class="pub-price__sign">$</span>
                <input id="pub-price" type="text" inputmode="decimal" value="${PUBLISH_DRAFT.price || ''}" placeholder="0" data-testid="input-publish-price" data-draft-field="price" />
                <span class="pub-price__cur">USD</span>
              </div>
            </div>
            ${HAY_APP_MODE ? `<div class="pub-bs">
              <span class="pub-bs__icon">Bs</span>
              <div><small>Equivale a</small><strong id="pubPriceBs" data-testid="publish-price-bs">${bsLabel(PUBLISH_DRAFT.price) || (DOLAR_BCV ? 'Escribe el precio' : 'Equivalencia no disponible')}</strong></div>
              ${DOLAR_BCV ? `<span class="pub-bs__rate">Dólar BCV<br/>Bs ${Number(DOLAR_BCV.tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>` : ''}
            </div>` : ''}
            <div class="toggle-row">
              <div class="toggle-row__text">
                <strong>Acepto ofertas</strong>
                <span>Los compradores podrán proponerte un precio</span>
              </div>
              <button class="toggle ${PUBLISH_DRAFT.acceptsOffers ? 'is-on' : ''}" role="switch" aria-checked="${PUBLISH_DRAFT.acceptsOffers}" aria-label="Acepto ofertas" data-testid="toggle-accept-offers" data-draft-field="acceptsOffers"></button>
            </div>
          </section>

          <section class="pub-card" data-testid="publish-details">
            <div class="pub-card__head"><h2><span class="pub-dot pub-dot--coral"></span>Detalles y ubicación</h2></div>
            <div class="field">
              <label for="pub-desc">Descripción</label>
              <textarea id="pub-desc" placeholder="Cuenta cómo está, qué incluye y cómo lo entregas." data-testid="input-publish-description" data-draft-field="description">${PUBLISH_DRAFT.description || ''}</textarea>
            </div>
            <div class="field">
              <label for="pub-zone">Zona de entrega</label>
              ${HAY_APP_MODE ? `<button class="btn btn--green btn--sm pub-gps" data-action="gps-publish" data-testid="btn-publish-gps">${icon('pin')} ${typeof PUBLISH_DRAFT.lat === 'number' ? 'Actualizar mi ubicación' : 'Usar mi ubicación actual'}</button>
              <p class="gps-msg" id="gpsMsg" data-testid="gps-msg" style="display:none;"></p>` : ''}
              ${HAY_APP_MODE && typeof PUBLISH_DRAFT.lat === 'number' ? osmMap(PUBLISH_DRAFT.lat, PUBLISH_DRAFT.lng, 'publish-map') : ''}
              <input id="pub-zone" type="text" value="${String(PUBLISH_DRAFT.zone || '').replace(/"/g, '&quot;')}" placeholder="Ej. Chacao, Caracas" data-testid="input-publish-zone" data-draft-field="zone" />
            </div>
            <div class="pub-safe">
              ${icon('shield')}
              <p><strong>Venta segura cara a cara</strong>Coordina la entrega en lugares públicos y concurridos (plazas, centros comerciales).</p>
            </div>
          </section>

          <p class="text-xs" id="publishErrorMsg" data-testid="publish-error-msg" role="alert" style="display:none; color:var(--color-error); font-weight:700;"></p>
          <button class="btn btn--yellow pub-submit" id="btnConfirmPublish" data-testid="btn-confirm-publish">${icon('send')} ${editing ? 'Guardar cambios' : 'Publicar artículo ahora'}</button>
          <p class="pub-terms">Al publicar, aceptas los Términos y Normas de la comunidad de HAY.</p>
        </div>
      </div>
    </div>`;
}

const SCREENS_PUBLISH = [
  {
    id: 'publish-step1',
    block: 'publish',
    label: '11. Paso 1 · Fotos',
    html: () => publishSinglePage(),
  },

  {
    id: 'publish-step2',
    block: 'publish',
    label: '12. Paso 2 · Categoría',
    html: () => publishSinglePage(),
  },

  {
    id: 'publish-step3',
    block: 'publish',
    label: '13. Paso 3 · Detalles',
    html: () => publishSinglePage(),
  },

  {
    id: 'publish-step4',
    block: 'publish',
    label: '14. Paso 4 · Precio y ubicación',
    html: () => publishSinglePage(),
  },

  {
    id: 'publish-step5',
    block: 'publish',
    label: '15. Paso 5 · Revisión',
    html: () => publishSinglePage(),
  },

  {
    id: 'publish-success',
    block: 'publish',
    label: '15b. Publicación exitosa',
    html: () => `
    <div class="phone__screen success-screen">
      ${statusBar()}
      <span class="confetti" aria-hidden="true" style="width:18px;height:18px;background:var(--hay-yellow);top:96px;left:52px;transform:rotate(20deg);"></span>
      <span class="confetti" aria-hidden="true" style="width:14px;height:14px;border-radius:50%;background:var(--hay-turquoise);top:140px;right:70px;"></span>
      <span class="confetti" aria-hidden="true" style="width:22px;height:10px;background:var(--hay-pink);top:220px;left:34px;transform:rotate(-30deg);"></span>
      <span class="confetti" aria-hidden="true" style="width:16px;height:16px;background:#ffffff;top:250px;right:40px;transform:rotate(35deg);"></span>
      <span class="confetti" aria-hidden="true" style="width:20px;height:9px;background:var(--hay-purple);top:300px;left:90px;transform:rotate(25deg);"></span>
      <div class="screen-body" style="position:relative; z-index:1;">
        <div class="screen-content screen-content--centered" data-testid="screen-publish-success">
          ${heroIcon('check', 'green', { size: 170, halo: true })}
          <h2 class="screen-title" style="font-size:38px;">¡Publicado!</h2>
          <p class="screen-subtitle" style="font-size:17px;">Tu "${PUBLISH_DRAFT.title}" ya se ve en Inicio. Te avisamos cuando alguien te escriba.</p>
          <button class="btn btn--ink" data-nav="my-listings" data-testid="btn-view-my-listing">Ver mi publicación</button>
          <button class="btn btn--ghost" style="color:var(--hay-navy); text-decoration:underline; text-underline-offset:4px;" data-nav="home" data-testid="btn-go-home-after-publish">Volver al inicio</button>
        </div>
      </div>
    </div>`,
  },

  {
    id: 'exit-publish-confirm',
    block: 'publish',
    label: '11b. Confirmar salida',
    html: () => `
    <div class="phone__screen">
      <div class="screen-body">
        <div class="modal-scrim">
          <div class="card stack text-center" style="background:var(--color-surface); width:100%; align-items:center; padding:var(--space-6) var(--space-5);">
            ${heroIcon('trash', 'pink', { size: 110 })}
            <h3 class="screen-title" style="font-size:22px">¿Descartar publicación?</h3>
            <p class="screen-subtitle">Perderás las fotos y datos que agregaste hasta ahora.</p>
            <div class="btn--block-row" style="width:100%;">
              <button class="btn btn--outline" data-nav="publish-step1" data-testid="btn-cancel-exit-publish">Seguir editando</button>
              <button class="btn btn--danger" data-nav="home" data-testid="btn-confirm-exit-publish">Descartar</button>
            </div>
          </div>
        </div>
      </div>
    </div>`,
  },
];
