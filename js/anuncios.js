/* HAY — anuncios de Adsterra (V1.52, corregido en V1.53 y V1.54)
   Solo en la pantalla de Inicio:
   - Banner 320x50 debajo del recuadro «¿Algo que ya no usas?».
   - Banner 300x250 cada 8 publicaciones en la lista de productos.
   Cada anuncio va dentro de su propio iframe (página del mismo sitio) para que su código no
   choque con el de la app ni con el de los otros anuncios. No toca nada más. */
(function () {
  const ADS = {
    b320: { key: 'a47e812c6b964c9077b592dfc33568a9', w: 320, h: 50 },
    b300: { key: 'fad06defcc214a33d64e4d9f83c51938', w: 300, h: 250 },
  };
  const CADA = 8; // un 300x250 cada 8 publicaciones

  const css = document.createElement('style');
  css.textContent = `
    .ad-slot{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;gap:2px;margin:4px 0;}
    .ad-slot__label{font-size:10px;line-height:1;color:#8a8a99;letter-spacing:.04em;text-transform:uppercase;}
    .ad-slot iframe{display:block;border:0;max-width:100%;background:transparent;}`;
  document.head.appendChild(css);

  function crearSlot(tipo) {
    const a = ADS[tipo];
    const box = document.createElement('div');
    box.className = 'ad-slot ad-slot--' + tipo;
    box.setAttribute('data-ad-slot', tipo);
    box.setAttribute('data-testid', 'ad-' + tipo);
    const label = document.createElement('span');
    label.className = 'ad-slot__label';
    label.textContent = 'Publicidad';
    const f = document.createElement('iframe');
    f.width = a.w; f.height = a.h; f.title = 'Publicidad';
    f.setAttribute('scrolling', 'no');
    // V1.53: página propia del mismo sitio (hay-app.onrender.com), para que
    // Adsterra reconozca el dominio aprobado (con srcdoc no lo reconocía).
    f.src = 'assets/anuncio-' + a.w + '.html?v=1.54';
    // V1.54: el anuncio queda encerrado en su recuadro. Sin «allow-top-navigation» ni
    // «allow-same-origin», no puede sacar al usuario de la app ni llevarlo a otra página.
    // Solo abre una pestaña nueva si el usuario toca el anuncio.
    f.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    box.appendChild(label);
    box.appendChild(f);
    return box;
  }

  function colocar() {
    const home = document.querySelector('[data-testid="screen-home"]');
    if (!home) return;
    if (!home.querySelector('[data-ad-slot="b320"]')) {
      const promo = home.querySelector('[data-testid="btn-home-publish"]');
      if (promo) promo.after(crearSlot('b320'));
    }
    const grid = home.querySelector('[data-testid="home-product-grid"]');
    if (!grid) return;
    const cards = grid.querySelectorAll(':scope > .product-card');
    cards.forEach((c, i) => {
      if ((i + 1) % CADA === 0 && !c.hasAttribute('data-ad-after')) {
        c.setAttribute('data-ad-after', '1');
        c.after(crearSlot('b300'));
      }
    });
  }

  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(colocar, 150); })
    .observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', colocar);
  else colocar();
})();
