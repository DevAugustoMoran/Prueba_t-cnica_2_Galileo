document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
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
    }
});