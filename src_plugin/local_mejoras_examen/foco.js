console.log("Script de detección de foco inicializado.");

document.addEventListener("visibilitychange", function() {
    console.log("Evento visibilitychange. Oculto: ", document.hidden);
    if (document.hidden) {
        registrar_evento_foco();
    }
});

window.addEventListener("blur", function() {
    console.log("Evento blur detectado.");
    registrar_evento_foco();
});

function registrar_evento_foco() {
    console.log("Iniciando registro de infracción...");
    const parametros_url = new URLSearchParams(window.location.search);
    const id_intento_actual = parametros_url.get('attempt');

    if (!id_intento_actual) {
        console.error("Fallo: No se encontró el parámetro 'attempt' en la URL.");
        return;
    }

    const marca_tiempo_actual = Date.now();
    if (window.ultima_perdida_foco && (marca_tiempo_actual - window.ultima_perdida_foco < 2000)) {
        console.log("Evento ignorado: límite de 2 segundos activado.");
        return;
    }
    window.ultima_perdida_foco = marca_tiempo_actual;

    const datos_formulario = new FormData();
    datos_formulario.append('intento_id', id_intento_actual);
    datos_formulario.append('sesskey', M.cfg.sesskey);

    console.log("Enviando petición a registrar_foco.php con intento_id:", id_intento_actual);

    fetch(M.cfg.wwwroot + '/local/mejoras_examen/registrar_foco.php', {
        method: 'POST',
        body: datos_formulario
    })
    .then(respuesta => respuesta.text())
    .then(texto => console.log("Respuesta del servidor backend:", texto))
    .catch(error => console.error("Error crítico en la petición Fetch:", error));
}