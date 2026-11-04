/* verificacion.js — V1.37: verificación de identidad de verdad.
 *
 * 1. SELFIE EN VIVO: la selfie ya no se puede subir desde la galería. Se toma
 *    con la cámara frontal DENTRO de la app (no se abre la app de cámara, así
 *    Android no cierra HAY). Antes de tomarla, la persona hace dos movimientos
 *    al azar (acercar la cara, girar a la izquierda o a la derecha) que se
 *    comprueban con el detector de caras SSD MobileNet que ya trae la app.
 *    Una foto impresa o en otra pantalla no hace esos movimientos solos.
 * 2. CARA DE LA CÉDULA: se revisa que en la foto de la cédula se vea una cara.
 * 3. COMPARACIÓN: la cara de la selfie se compara con la de la cédula con el
 *    modelo de reconocimiento de face-api (128 números por cara). Si la
 *    distancia es menor que 0,55 se considera la misma persona.
 *    Los modelos de puntos de la cara y de reconocimiento (~6,5 MB) se
 *    descargan del CDN jsDelivr la primera vez y quedan guardados.
 *    Si no se pueden descargar, la verificación se envía marcada para
 *    revisión manual del moderador.
 * Todo corre en el teléfono; el servidor guarda el resultado junto a las fotos.
 */
const HAY_VERIFICACION = (() => {
  const MODELOS_CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7/model';
  const UMBRAL_MISMA_PERSONA = 0.55;
  let base = null;
  let reconocimiento = null;

  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('no se pudo descargar ' + src));
      document.head.appendChild(s);
    });
  }

  // Detector de caras (local, en vendor/)
  function prepararBase() {
    if (!base) {
      base = (async () => {
        if (!window.faceapi) await cargarScript('vendor/face-api.js');
        const fa = window.faceapi;
        await fa.tf.ready();
        if (!fa.nets.ssdMobilenetv1.isLoaded) await fa.nets.ssdMobilenetv1.loadFromUri('vendor/modelos');
        return fa;
      })().catch((e) => { base = null; throw e; });
    }
    return base;
  }

  // Puntos de la cara + reconocimiento (CDN)
  function prepararReconocimiento() {
    if (!reconocimiento) {
      reconocimiento = (async () => {
        const fa = await prepararBase();
        if (!fa.nets.faceLandmark68Net.isLoaded) await fa.nets.faceLandmark68Net.loadFromUri(MODELOS_CDN);
        if (!fa.nets.faceRecognitionNet.isLoaded) await fa.nets.faceRecognitionNet.loadFromUri(MODELOS_CDN);
        return fa;
      })().catch((e) => { reconocimiento = null; throw e; });
    }
    return reconocimiento;
  }

  function cargarImagen(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('no se pudo leer la foto'));
      img.src = src;
    });
  }

  // ¿Se ve una cara en la foto de la cédula?
  async function hayCaraEnCedula(dataUrl) {
    const fa = await prepararBase();
    const img = await cargarImagen(dataUrl);
    const caras = await fa.detectAllFaces(img, new fa.SsdMobilenetv1Options({ minConfidence: 0.3 }));
    return caras.length > 0;
  }

  // Distancia entre la cara de la selfie y la de la cédula (null si no se pudo)
  async function comparar(selfieUrl, cedulaUrl) {
    // si los modelos no llegan en 60 s (sin conexión), se sigue sin comparación
    const fa = await Promise.race([
      prepararReconocimiento(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('la descarga de los modelos tardó demasiado')), 60000)),
    ]);
    const opts = new fa.SsdMobilenetv1Options({ minConfidence: 0.3 });
    const [a, b] = await Promise.all([cargarImagen(selfieUrl), cargarImagen(cedulaUrl)]);
    const da = await fa.detectSingleFace(a, opts).withFaceLandmarks().withFaceDescriptor();
    const db = await fa.detectSingleFace(b, opts).withFaceLandmarks().withFaceDescriptor();
    if (!da) return { error: 'no se encontró tu cara en la selfie' };
    if (!db) return { error: 'no se encontró la cara en la foto de la cédula' };
    const distancia = fa.euclideanDistance(da.descriptor, db.descriptor);
    return { distancia: Math.round(distancia * 1000) / 1000, coincide: distancia < UMBRAL_MISMA_PERSONA };
  }

  /* ---------------- Selfie en vivo ---------------- */
  const RETOS = {
    acerca: 'Acerca la cara al teléfono',
    izquierda: 'Gira la cabeza a tu izquierda',
    derecha: 'Gira la cabeza a tu derecha',
  };

  function elegirRetos() {
    const lista = Object.keys(RETOS).sort(() => Math.random() - 0.5);
    return lista.slice(0, 2);
  }

  /* Abre la cámara frontal en `contenedor` y guía a la persona.
     onEstado(texto) muestra las instrucciones. Devuelve una promesa con
     { foto (data URL), retos } o lanza un error con el motivo en palabras. */
  async function selfieEnVivo(contenedor, onEstado) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('este teléfono no permite usar la cámara dentro de la app. Actualiza Chrome e inténtalo de nuevo.');
    }
    onEstado('Preparando la cámara…');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } }, audio: false });
    } catch (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        throw new Error('no diste permiso para la cámara. Actívalo en Ajustes del teléfono → Aplicaciones → HAY (o Chrome) → Permisos → Cámara, y vuelve a tocar.');
      }
      throw new Error('no se pudo abrir la cámara frontal (' + (e && e.name ? e.name : 'error') + ').');
    }
    const video = document.createElement('video');
    video.setAttribute('playsinline', '');
    video.muted = true;
    video.srcObject = stream;
    video.className = 'selfie-live__video';
    contenedor.innerHTML = '';
    contenedor.appendChild(video);
    const guia = document.createElement('div');
    guia.className = 'selfie-live__guia';
    contenedor.appendChild(guia);
    contenedor.style.display = 'block';
    try { (contenedor.previousElementSibling || contenedor).scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
    const parar = () => { stream.getTracks().forEach((t) => t.stop()); contenedor.style.display = 'none'; contenedor.innerHTML = ''; };
    try {
      await video.play();
      onEstado('Cargando el detector de caras… (la primera vez tarda un poco)');
      const fa = await prepararBase();
      const opts = new fa.SsdMobilenetv1Options({ minConfidence: 0.5 });
      const retos = elegirRetos();
      const pasos = ['centrar', ...retos, 'final'];
      let paso = 0;
      let ref = null; // caja de referencia (cara centrada)
      const inicio = Date.now();
      while (paso < pasos.length) {
        if (Date.now() - inicio > 90000) throw new Error('se acabó el tiempo. Vuelve a intentarlo con buena luz y la cara de frente.');
        const det = await fa.detectSingleFace(video, opts);
        const vw = video.videoWidth || 1;
        const actual = pasos[paso];
        if (!det) {
          onEstado(actual === 'centrar' || actual === 'final' ? 'Pon tu cara dentro del óvalo, de frente y con buena luz' : RETOS[actual]);
          await new Promise((r) => setTimeout(r, 150));
          continue;
        }
        const b = det.box;
        // la vista es en espejo: "a tu izquierda" = la cara se mueve a la derecha de la imagen de la cámara
        const cx = 1 - (b.x + b.width / 2) / vw;
        const ancho = b.width / vw;
        if (actual === 'centrar') {
          onEstado('Pon tu cara dentro del óvalo, de frente y con buena luz');
          if (cx > 0.35 && cx < 0.65 && ancho > 0.25) { ref = { cx, ancho }; paso++; }
        } else if (actual === 'acerca') {
          onEstado(RETOS.acerca);
          if (ancho > ref.ancho * 1.25) { paso++; ref = null; }
        } else if (actual === 'izquierda') {
          onEstado(ref ? RETOS.izquierda : 'Vuelve a poner la cara al centro');
          if (ref && cx < ref.cx - 0.08) { paso++; ref = null; }
        } else if (actual === 'derecha') {
          onEstado(ref ? RETOS.derecha : 'Vuelve a poner la cara al centro');
          if (ref && cx > ref.cx + 0.08) { paso++; ref = null; }
        } else if (actual === 'final') {
          onEstado('Ahora mira de frente y quédate quieto');
          if (cx > 0.35 && cx < 0.65 && ancho > 0.25) paso++;
        }
        // después de cada reto, se vuelve a tomar la referencia con la cara al centro
        if (!ref && paso < pasos.length && pasos[paso] !== 'final') {
          const otra = await fa.detectSingleFace(video, opts);
          if (otra) {
            const ocx = 1 - (otra.box.x + otra.box.width / 2) / vw;
            const oan = otra.box.width / vw;
            if (ocx > 0.3 && ocx < 0.7) ref = { cx: ocx, ancho: oan };
          }
        }
        await new Promise((r) => setTimeout(r, 120));
      }
      // foto final (sin espejo, como la ve la cámara)
      const canvas = document.createElement('canvas');
      const escala = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * escala);
      canvas.height = Math.round(video.videoHeight * escala);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const foto = canvas.toDataURL('image/jpeg', 0.85);
      onEstado('¡Listo! Selfie tomada ✓');
      return { foto, retos };
    } finally {
      parar();
    }
  }

  return { selfieEnVivo, hayCaraEnCedula, comparar, prepararReconocimiento, UMBRAL_MISMA_PERSONA };
})();
