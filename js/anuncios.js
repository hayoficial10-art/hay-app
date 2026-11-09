/* HAY — anuncios de Adsterra (V1.52, corregido en V1.53, V1.54, V1.56 y V1.57)
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

  // V1.57: los anuncios esperan a que la app termine de cargar (5 s después de abrir),
  // cada recuadro carga solo cuando el usuario se acerca a él, y queda oculto (sin espacio
  // en blanco) hasta que el anuncio llega de verdad. Si no llega en 15 s, se quita.
  let LISTO = false;
  const ESPERA_INICIO = 5000;
  const visor = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          visor.unobserve(en.target);
          cargar(en.target);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  function crearSlot(tipo) {
    const box = document.createElement('div');
    box.className = 'ad-slot ad-slot--' + tipo;
    box.setAttribute('data-ad-slot', tipo);
    box.setAttribute('data-testid', 'ad-' + tipo);
    // oculto y sin ocupar espacio mientras no haya anuncio
    box.style.cssText = 'height:0;margin:0;overflow:hidden;visibility:hidden;';
    if (visor) visor.observe(box); else cargar(box);
    return box;
  }

  function cargar(box) {
    const a = ADS[box.getAttribute('data-ad-slot')];
    const label = document.createElement('span');
    label.className = 'ad-slot__label';
    label.textContent = 'Publicidad';
    const f = document.createElement('iframe');
    f.width = a.w; f.height = a.h; f.title = 'Publicidad';
    f.setAttribute('scrolling', 'no');
    f.setAttribute('loading', 'lazy');
    // V1.53: página propia del mismo sitio, para que Adsterra reconozca el dominio aprobado.
    // V1.54/V1.56: encerrado en su recuadro (sin «allow-top-navigation» no puede sacar al
    // usuario de la app); solo abre pestaña nueva si el usuario toca el anuncio.
    f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
    f.src = 'assets/anuncio-' + a.w + '.html?v=1.57';
    box.appendChild(label);
    box.appendChild(f);
    let intentos = 0;
    const revisar = setInterval(() => {
      intentos += 1;
      if (!box.isConnected) { clearInterval(revisar); return; }
      let lleno = false;
      try {
        const d = f.contentDocument;
        lleno = Boolean(d && d.body && d.body.querySelector('iframe, img, a, ins, object, embed, video'));
      } catch (e) { lleno = true; }
      if (lleno) {
        clearInterval(revisar);
        box.style.cssText = '';
      } else if (intentos >= 15) {
        clearInterval(revisar);
        box.remove();
      }
    }, 1000);
  }

  function colocar() {
    if (!LISTO) return;
    const home = document.querySelector('[data-testid="screen-home"]');
    if (!home) return;
    if (!home.querySelector('[data-ad-slot="b320"]')) {
      // V1.58: sin el bloque «Publica gratis», el anuncio va debajo de las categorías
      const ancla = home.querySelector('[data-testid="home-categories"]');
      if (ancla) ancla.after(crearSlot('b320'));
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
  function arrancar() {
    setTimeout(() => { LISTO = true; colocar(); }, ESPERA_INICIO);
  }
  if (document.readyState === 'complete') arrancar();
  else window.addEventListener('load', arrancar, { once: true });
})();
