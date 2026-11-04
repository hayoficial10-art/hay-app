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

const SCREENS_PUBLISH = [
  {
    id: 'publish-step1',
    block: 'publish',
    label: '11. Paso 1 · Fotos',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${publishStepHeader(1, 'Agrega fotos', 'exit-publish-confirm')}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-publish-step1">
          ${heroIcon('camera', 'cyan', { size: 150 })}
          <p class="screen-subtitle text-center">Usa buena luz natural. La primera foto será la portada de tu publicación.</p>
          <p class="photo-rules" data-testid="photo-rules">Solo fotos del artículo. No se permiten fotos de personas ni contenido sexual o violento.</p>
          <!-- V1.33: la cámara se abre directo con "Tomar foto" (capture). Con
               "multiple" Android solo ofrecía la galería, por eso van separados. -->
          <div class="photo-actions">
            <label class="btn btn--turquoise" style="cursor:pointer;" data-testid="btn-open-camera">
              ${icon('camera')} Tomar foto
              <input type="file" accept="image/*" capture="environment" data-photo-input data-testid="input-photo-camera" style="display:none;" />
            </label>
            <label class="btn btn--outline" style="cursor:pointer;" data-testid="btn-open-gallery">
              ${icon('gallery')} Galería
              <input type="file" accept="image/*" multiple data-photo-input data-testid="input-photo-file" style="display:none;" />
            </label>
          </div>
          <p class="text-xs" id="photoCheckMsg" data-testid="photo-check-msg" style="display:none; font-weight:700;"></p>
          <p class="text-xs photo-error" id="photoErrorMsg" data-testid="photo-error-msg" role="alert" style="display:none;"></p>
          <div class="photo-grid" data-testid="photo-grid">
            ${draftPhotoList()
              .map(
                (src, i) => `
            <div class="photo-slot photo-slot--img" style="position:relative;">
              <img src="${src}" alt="Foto ${i + 1}" />
              ${i === 0 ? '<span class="photo-slot--cover">PORTADA</span>' : ''}
              <span class="photo-slot__remove" role="button" aria-label="Quitar foto" data-remove-photo="${i}" data-testid="btn-remove-photo-${i + 1}">${icon('close')}</span>
            </div>`
              )
              .join('')}
            ${Array.from({ length: Math.max(0, MAX_LISTING_PHOTOS - draftPhotoList().length) })
              .map(
                (_, i) => `
            <label class="photo-slot photo-slot--empty" aria-label="Agregar foto" data-testid="btn-add-photo-${draftPhotoList().length + i + 1}" style="cursor:pointer;">
              ${icon('camera')}
              <input type="file" accept="image/*" multiple data-photo-input style="display:none;" />
            </label>`
              )
              .join('')}
          </div>
          <p class="field--help" data-testid="photo-count">Hasta ${MAX_LISTING_PHOTOS} fotos · ${draftPhotoList().length} de ${MAX_LISTING_PHOTOS} agregadas</p>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--turquoise" data-nav="publish-step2" data-testid="btn-publish-step1-continue" ${HAY_APP_MODE && draftPhotoList().length === 0 ? 'disabled' : ''}>Continuar</button>
      </div>
    </div>`,
  },

  {
    id: 'publish-step2',
    block: 'publish',
    label: '12. Paso 2 · Categoría',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${publishStepHeader(2, 'Elige una categoría', 'publish-step1')}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-publish-step2">
          <div class="searchbar">${icon('search')}<input type="text" placeholder="Buscar categoría..." /></div>
          <div class="category-grid" data-testid="category-grid">
            ${CATEGORY_ICONS.map((c) => {
              const sel = PUBLISH_DRAFT.category === c.label;
              return `
            <button class="category-tile ${sel ? 'is-selected' : ''}" data-testid="category-${c.label.split(' ')[0].toLowerCase()}" data-cat-label="${c.label}" data-cat-icon="${c.icon}">
              <span class="category-tile__icon" style="background:${sel ? 'var(--hay-turquoise-highlight)' : 'var(--color-surface-2)'}">${icon(c.icon)}</span>
              <span>${c.label}</span>
            </button>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--turquoise" data-nav="publish-step3" data-testid="btn-publish-step2-continue">Continuar</button>
      </div>
    </div>`,
  },

  {
    id: 'publish-step3',
    block: 'publish',
    label: '13. Paso 3 · Detalles',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${publishStepHeader(3, 'Cuéntanos más', 'publish-step2')}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-publish-step3">
          <div class="field">
            <label for="pub-title">Título</label>
            <input id="pub-title" type="text" value="${PUBLISH_DRAFT.title}" maxlength="60" placeholder="Ej. Mochila nueva" data-testid="input-publish-title" data-draft-field="title" />
            <span class="field--help">${PUBLISH_DRAFT.title.length}/60 caracteres</span>
          </div>
          <div class="field">
            <label>Categoría</label>
            <div class="input-icon" data-testid="publish-step3-category">
              ${icon(PUBLISH_DRAFT.categoryIcon)}
              <span class="grow" style="font-weight:600; color:var(--hay-navy);">${PUBLISH_DRAFT.category}</span>
            </div>
          </div>
          <div class="field">
            <label for="pub-desc">Descripción</label>
            <textarea id="pub-desc" placeholder="Cuéntale a los demás..." data-testid="input-publish-description" data-draft-field="description">${PUBLISH_DRAFT.description}</textarea>
          </div>
          <div class="stack-sm">
            <span class="section-label">Condición</span>
            <div class="pill-row" data-testid="condition-pills" data-draft-field="condition">
              <span class="pill ${PUBLISH_DRAFT.condition === 'Nuevo' ? 'is-selected' : ''}">Nuevo</span>
              <span class="pill ${PUBLISH_DRAFT.condition === 'Usado' ? 'is-selected' : ''}">Usado</span>
              <span class="pill ${PUBLISH_DRAFT.condition === 'Como nuevo' ? 'is-selected' : ''}">Como nuevo</span>
            </div>
          </div>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--turquoise" data-nav="publish-step4" data-testid="btn-publish-step3-continue">Continuar</button>
      </div>
    </div>`,
  },

  {
    id: 'publish-step4',
    block: 'publish',
    label: '14. Paso 4 · Precio y ubicación',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${publishStepHeader(4, 'Precio y ubicación', 'publish-step3')}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-5)" data-testid="screen-publish-step4">
          <div class="price-hero">
            ${heroIcon('', 'yellow', { size: 110, text: '$' })}
            <label for="pub-price" class="price-hero__label">Precio (USD)</label>
            <div class="field" style="width:100%;">
              <input id="pub-price" type="text" value="$ ${PUBLISH_DRAFT.price}" data-testid="input-publish-price" data-draft-field="price" style="text-align:center; font-family:var(--font-display); font-size:28px; font-weight:700; background:#fff; border-color:#fff;" />
            </div>
          </div>
          <div class="toggle-row card">
            <div class="toggle-row__text">
              <strong>Acepto ofertas</strong>
              <span>Los compradores podrán proponerte un precio distinto</span>
            </div>
            <button class="toggle ${PUBLISH_DRAFT.acceptsOffers ? 'is-on' : ''}" role="switch" aria-checked="${PUBLISH_DRAFT.acceptsOffers}" aria-label="Acepto ofertas" data-testid="toggle-accept-offers" data-draft-field="acceptsOffers"></button>
          </div>
          <div class="stack-sm">
            <span class="section-label">Zona de encuentro</span>
            ${HAY_APP_MODE && typeof PUBLISH_DRAFT.lat === 'number'
              ? osmMap(PUBLISH_DRAFT.lat, PUBLISH_DRAFT.lng, 'publish-map')
              : `<div class="map-ph"><div class="map-ph__pin">${icon('pin')}</div></div>`}
            ${HAY_APP_MODE ? `<button class="btn btn--green btn--sm" data-action="gps-publish" data-testid="btn-publish-gps">${icon('pin')} ${typeof PUBLISH_DRAFT.lat === 'number' ? 'Actualizar mi ubicación (GPS)' : 'Usar mi ubicación (GPS)'}</button>
            <p class="gps-msg" id="gpsMsg" data-testid="gps-msg" style="display:none;"></p>` : ''}
            <div class="field">
              <label for="pub-zone" class="sr-only">Zona</label>
              <input id="pub-zone" type="text" value="${PUBLISH_DRAFT.zone}" placeholder="Ej. Chacao, Caracas" data-testid="input-publish-zone" data-draft-field="zone" />
            </div>
          </div>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--turquoise" data-nav="publish-step5" data-testid="btn-publish-step4-continue">Continuar</button>
      </div>
    </div>`,
  },

  {
    id: 'publish-step5',
    block: 'publish',
    label: '15. Paso 5 · Revisión',
    html: () => `
    <div class="phone__screen">
      ${statusBar()}
      ${publishStepHeader(5, EDITING_LISTING_ID ? 'Revisa los cambios' : 'Revisa tu publicación', 'publish-step4')}
      <div class="screen-body">
        <div class="screen-content" style="gap:var(--space-4)" data-testid="screen-publish-step5">
          <p class="screen-subtitle">Así se verá tu producto en el feed y en la búsqueda.</p>
          <div class="product-card" style="width:100%; position:relative; pointer-events:none;">
            ${draftPhotoList().length
              ? `<div class="ph-art ph-art--photo" style="aspect-ratio:16/10;"><img src="${draftPhotoList()[0]}" alt="Portada" /><span class="ph-art__badge">${PUBLISH_DRAFT.condition}</span></div>`
              : `<div class="ph-art ph-art--2" style="aspect-ratio:16/10;">${icon(PUBLISH_DRAFT.categoryIcon)}<span class="ph-art__badge">${PUBLISH_DRAFT.condition}</span></div>`}
            <div class="dots" style="margin:2px 0;"><div class="dots__dot is-active"></div><div class="dots__dot"></div><div class="dots__dot"></div></div>
            <p class="product-card__title" style="font-size:17px;">${PUBLISH_DRAFT.title || '(sin título)'}</p>
            <span class="product-card__price" style="font-size:24px;">$${PUBLISH_DRAFT.price || 0}</span>
            <span class="product-card__meta">${icon('pin')} ${PUBLISH_DRAFT.zone || 'Sin zona indicada'}</span>
          </div>
          <div class="card stack-sm">
            <div class="flex-between"><span class="text-xs text-muted">Categoría</span><span class="text-xs fw-800">${PUBLISH_DRAFT.category}</span></div>
            <div class="flex-between"><span class="text-xs text-muted">Condición</span><span class="text-xs fw-800">${PUBLISH_DRAFT.condition}</span></div>
            <div class="flex-between"><span class="text-xs text-muted">Acepta ofertas</span><span class="text-xs fw-800">${PUBLISH_DRAFT.acceptsOffers ? 'Sí' : 'No'}</span></div>
            <div class="flex-between"><span class="text-xs text-muted">Fotos</span><span class="text-xs fw-800">${draftPhotoList().length || PUBLISH_DRAFT.photos} de ${MAX_LISTING_PHOTOS}</span></div>
          </div>
          <p class="text-xs text-faint" id="publishErrorMsg" data-testid="publish-error-msg" style="display:none; color:var(--color-error);"></p>
        </div>
      </div>
      <div class="bottom-cta">
        <button class="btn btn--outline" data-nav="publish-step2" data-testid="btn-edit-publish-review">Editar</button>
        <button class="btn btn--turquoise" id="btnConfirmPublish" data-testid="btn-confirm-publish">${EDITING_LISTING_ID ? 'Guardar cambios' : 'Publicar'}</button>
      </div>
    </div>`,
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
