document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        // El navegador dispara 'hidden' tanto al cambiar de pestaña/ventana (lo que
        // sí queremos detectar) como al navegar a otra página dentro del mismo
        // examen -- por ejemplo, al pasar a la siguiente página de preguntas o al
        // enviar el intento (lo que NO debería contar como señal de integridad).
        // 'pagehide' solo se dispara en el segundo caso (la página se está
        // descargando de verdad), así que lo usamos para distinguirlos: esperamos
        // un instante breve y, si 'pagehide' se disparó en ese lapso, ignoramos
        // este 'hidden' por tratarse de una navegación normal.
        let es_navegacion = false;

        const marcar_navegacion = function() {
            es_navegacion = true;
        };
        window.addEventListener('pagehide', marcar_navegacion, { once: true });

        setTimeout(function() {
            window.removeEventListener('pagehide', marcar_navegacion);

            if (es_navegacion) {
                return;
            }

            const parametros_url = new URLSearchParams(window.location.search);
            const intento_id = parametros_url.get('attempt');

            if (!intento_id) {
                console.warn("Fallo: No se encontró el parámetro 'attempt' en la URL.");
                return;
            }

            console.log("Ocultamiento de pestaña detectado. Registrando infracción...");

            const datos_peticion = new FormData();
            datos_peticion.append('intento_id', intento_id);

            // Se extrae y adjunta la llave de seguridad obligatoria del entorno Moodle
            datos_peticion.append('sesskey', M.cfg.sesskey);

            fetch('/local/mejoras_examen/registrar_foco.php', {
                method: 'POST',
                body: datos_peticion,
                keepalive: true
            })
            .then(respuesta => respuesta.text())
            .then(texto => console.log("Respuesta del servidor:", texto))
            .catch(error => console.error("Error en la conexión Fetch:", error));
        }, 150);
    }
});