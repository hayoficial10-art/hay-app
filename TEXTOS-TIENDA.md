# HAY — Textos y respuestas para Google Play Console

Copia y pega cada bloque en la sección indicada de Play Console.

---

## Ficha de la tienda (Store listing)

**Nombre de la app** (máx. 30 caracteres)
```
HAY: compra y vende cerca
```

**Descripción breve** (máx. 80 caracteres)
```
Publica lo que ya no usas y encuentra lo que buscas cerca de ti. Fácil y seguro
```

**Descripción completa** (máx. 4.000 caracteres)
```
¿Tienes cosas que ya no usas? ¿Buscas algo sin gastar de más? En HAY lo publicas en minutos y lo encuentras cerca de ti.

Lo tienes, publícalo, véndelo.

📸 PUBLICA EN MINUTOS
Toma fotos con tu teléfono, escribe un título, elige la categoría y ponle precio. Listo: tu publicación ya está visible para la gente de tu zona.

🔎 ENCUENTRA LO QUE BUSCAS
Explora por categorías (hogar, electrónica, ropa, vehículos, herramientas, niños y bebés, mascotas, servicios y más), filtra entre personas y negocios, y busca por nombre o por zona.

💬 CHATEA Y NEGOCIA
Escríbele al vendedor dentro de la app, haz una oferta, recibe contraofertas y cierra el trato sin compartir tu número si no quieres.

⭐ REPUTACIÓN REAL
Después de cada venta, comprador y vendedor se califican. Así sabes con quién estás tratando.

🛡️ PENSADA PARA TU SEGURIDAD
• Verificación de identidad para publicar.
• Reporta publicaciones o usuarios sospechosos.
• Números de emergencia y consejos para reunirte de forma segura.
• Tus fotos de verificación se guardan cifradas y nunca se muestran a otros usuarios.

🏪 PARA NEGOCIOS
¿Tienes una tienda? Crea una cuenta de Negocio y muestra tus productos a clientes cerca de ti.

HAY no cobra comisiones por vender: el precio, el pago y la entrega los acuerdas directamente con la otra persona.

¿Dudas o sugerencias? Escríbenos a [CORREO DE SOPORTE].
```

**Categoría de la app:** Compras
**Etiquetas sugeridas:** Compras, Marketplace, Ventas
**Correo de contacto:** [CORREO DE SOPORTE]
**Sitio web:** https://[TU-DOMINIO]
**Política de privacidad (URL):** https://[TU-DOMINIO]/privacidad.html

**Gráficos** (carpeta `play-store/`):
- Ícono de la app: `icono-512.png` (512×512)
- Gráfico destacado: `grafico-destacado-1024x500.png`
- Capturas de teléfono: `captura-1.png` a `captura-5.png` (1080×1920)

---

## Contenido de la app (App content)

**Política de privacidad:** https://[TU-DOMINIO]/privacidad.html

**Acceso a la app (para los revisores de Google):** "Todas las funciones o algunas requieren acceso especial" → crea una cuenta de prueba y pon aquí su correo y contraseña. La cuenta de prueba **ya debe tener la verificación de identidad enviada**, para que el revisor pueda publicar.

**Anuncios:** *No, mi app no contiene anuncios.*
> ⚠️ Cuando activemos la publicidad (v1.31), hay que cambiar esta respuesta a "Sí".

**Público objetivo:** 18 años o más (así lo dicen los términos de uso).

**Clasificación de contenido (cuestionario IARC):**
- Categoría: "Todas las demás apps" (tienda / marketplace).
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí** (chat entre usuarios y publicaciones).
- ¿Comparte la ubicación del usuario? **No** (la zona la escribe la persona; no usamos el GPS).
- ¿Permite compras digitales? **No**.
- Violencia, sexo, drogas, apuestas, lenguaje: **No** en todo.

**Eliminación de cuenta (URL):** https://[TU-DOMINIO]/eliminar-cuenta.html

**Aplicación gubernamental / financiera / de salud:** No.

---

## Seguridad de los datos (Data safety)

**¿Tu app recopila o comparte datos del usuario?** Sí.
**¿Todos los datos se cifran en tránsito?** Sí (HTTPS).
**¿Los usuarios pueden pedir que se borren sus datos?** Sí (en la app y en la página de eliminar cuenta).

| Tipo de dato (Play Console) | ¿Se recopila? | ¿Se comparte? | Obligatorio | Para qué |
|---|---|---|---|---|
| Información personal → **Dirección de correo** | Sí | No | Sí | Funcionamiento de la app, administración de la cuenta |
| Información personal → **ID de usuario** | Sí | No | Sí | Funcionamiento de la app, administración de la cuenta |
| Información personal → **Otra información** (foto de cédula) | Sí | No | Sí, para publicar | Seguridad, prevención de fraude |
| Fotos y videos → **Fotos** (productos y selfie) | Sí | No | Sí, para publicar | Funcionamiento de la app, prevención de fraude |
| Mensajes → **Otros mensajes en la app** (chat y ofertas) | Sí | No | No | Funcionamiento de la app |

**No se recopila:** ubicación del dispositivo, contactos, datos financieros, salud, historial de navegación, identificadores del dispositivo, audio.

> "Compartir" en Play significa entregar datos a terceros para su propio uso. El hosting (Render) y Google (si entras con Google) actúan como proveedores de servicio y **no** cuentan como compartir.
