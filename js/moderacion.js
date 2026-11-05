/* moderacion.js — V1.33: revisión automática de las fotos de las publicaciones.
 *
 * Antes de agregar una foto a una publicación, el teléfono la revisa:
 *   - PERSONAS: si se ve una cara, no se acepta (detector de caras SSD MobileNet de face-api).
 *     Se usa un umbral bajo (0,2) porque en las pruebas una selfie muy de cerca y con los ojos
 *     cerrados dio 0,25; puede rechazar por error alguna foto de objeto: el mensaje lo explica.
 *   - CONTENIDO SEXUAL: si el clasificador la marca como desnudo o sexual, no se acepta
 *     (modelo MobileNetV2 de nsfwjs).
 * Todo corre en el teléfono, sin mandar la foto a nadie. Los modelos se sirven desde
 * la propia app (carpeta vendor/, ~9,5 MB) y se descargan solo la primera vez que
 * alguien agrega una foto; después quedan guardados en el teléfono.
 *
 * V1.39: este detector NO ve las caras que llenan toda la foto (selfie muy de cerca).
 * El bloqueo seguro de personas lo hace el servidor con Google Vision (GOOGLE_VISION_KEY).
 *
 * La violencia no tiene un detector confiable que corra en el teléfono: para eso
 * quedan los términos de uso y el botón Reportar.
 *
 * Licencias: face-api (MIT, Vladimir Mandic) y nsfwjs (MIT, Infinite Red) en vendor/.
 */
const HAY_MODERACION = (() => {
  const UMBRAL_CARA = 0.2;        // confianza mínima para decir "hay una cara"
  const UMBRAL_SEXUAL = 0.5;      // Porn + Hentai
  const UMBRAL_INSINUANTE = 0.75; // Sexy
  let preparando = null;

  function cargarScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('no se pudo descargar ' + src));
      document.head.appendChild(s);
    });
  }

  function preparar() {
    if (!preparando) {
      preparando = (async () => {
        if (!window.faceapi) await cargarScript('vendor/face-api.js');
        const fa = window.faceapi;
        const tf = fa.tf;
        await tf.ready();
        await fa.nets.ssdMobilenetv1.loadFromUri('vendor/modelos');
        const nsfw = await tf.loadLayersModel('vendor/modelos/nsfw/model.json');
        return { fa, tf, nsfw };
      })().catch((e) => {
        preparando = null; // se puede reintentar
        throw e;
      });
    }
    return preparando;
  }

  function cargarImagen(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('no se pudo leer la foto'));
      img.src = dataUrl;
    });
  }

  /* Devuelve { ok: true } o { ok: false, motivo: 'persona' | 'sexual', detalle }.
     Si no se pudo revisar (sin conexión la primera vez), lanza un error. */
  async function revisar(dataUrl) {
    const { fa, tf, nsfw } = await preparar();
    const img = await cargarImagen(dataUrl);
    const caras = await fa.detectAllFaces(img, new fa.SsdMobilenetv1Options({ minConfidence: UMBRAL_CARA }));
    if (caras.length) return { ok: false, motivo: 'persona', detalle: caras.length };
    const salida = tf.tidy(() => {
      const t = tf.browser.fromPixels(img).toFloat().div(255);
      const r = tf.image.resizeBilinear(t, [224, 224], true).reshape([1, 224, 224, 3]);
      return nsfw.predict(r);
    });
    const p = await salida.data(); // Drawing, Hentai, Neutral, Porn, Sexy
    salida.dispose();
    if (p[3] + p[1] >= UMBRAL_SEXUAL || p[4] >= UMBRAL_INSINUANTE) {
      return { ok: false, motivo: 'sexual', detalle: Array.from(p) };
    }
    return { ok: true, detalle: Array.from(p) };
  }

  const MENSAJES = {
    persona: 'Esta foto no se puede usar: parece que se ve una persona. En HAY solo van fotos del artículo, sin personas. Si es un error, tómala de nuevo solo al artículo, con un fondo liso.',
    sexual: 'Esta foto no se puede usar: parece tener contenido sexual. HAY no permite ese tipo de fotos.',
  };

  return { preparar, revisar, MENSAJES };
})();
