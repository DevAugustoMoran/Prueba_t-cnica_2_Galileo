document.addEventListener("DOMContentLoaded", function() {
    console.log("Script de alerta de foco inicializado.");

    // Buscar las casillas de verificación que contienen los IDs de los intentos
    const casillas_intentos = document.querySelectorAll('input[name="attemptid[]"]');
    
    if (casillas_intentos.length === 0) {
        console.log("No se detectaron intentos en esta tabla.");
        return;
    }

    let array_ids_intentos = [];
    let mapa_filas = {};

    // Extraer los IDs y mapear cada ID a su fila (tr) correspondiente
    casillas_intentos.forEach(casilla => {
        let id_intento = casilla.value;
        if (id_intento) {
            array_ids_intentos.push(id_intento);
            mapa_filas[id_intento] = casilla.closest('tr');
        }
    });

    if (array_ids_intentos.length === 0) return;

    const datos_formulario = new FormData();
    datos_formulario.append('ids', array_ids_intentos.join(','));
    datos_formulario.append('sesskey', M.cfg.sesskey);

    // Consultar al servidor
    fetch(M.cfg.wwwroot + '/local/mejoras_examen/obtener_foco.php', {
        method: 'POST',
        body: datos_formulario
    })
    .then(respuesta => respuesta.json())
    .then(datos => {
        console.log("Datos de foco recibidos desde el servidor:", datos);
        
        for (let id in datos) {
            let cantidad_infracciones = parseInt(datos[id]);
            let fila = mapa_filas[id];

            if (cantidad_infracciones > 0 && fila) {
                // Buscar la celda donde está el enlace al perfil del usuario para colocar la alerta debajo
                let enlace_usuario = fila.querySelector('a[href*="user/view.php"]');
                let contenedor_objetivo = enlace_usuario ? enlace_usuario.parentNode : fila.cells[2];

                let etiqueta_alerta = document.createElement('div');
                etiqueta_alerta.style.marginTop = '6px';
                etiqueta_alerta.style.display = 'inline-block';
                etiqueta_alerta.style.padding = '3px 8px';
                etiqueta_alerta.style.borderRadius = '4px';
                etiqueta_alerta.style.fontSize = '12px';
                etiqueta_alerta.style.fontWeight = 'bold';

                // Aplicar estilos según la regla de negocio (más de 3 es crítico)
                if (cantidad_infracciones > 3) {
                    etiqueta_alerta.style.backgroundColor = '#f8d7da';
                    etiqueta_alerta.style.color = '#721c24';
                    etiqueta_alerta.style.border = '1px solid #f5c6cb';
                    etiqueta_alerta.innerText = '⚠️ Foco perdido: ' + cantidad_infracciones;
                    fila.style.backgroundColor = '#fff3cd'; 
                } else {
                    etiqueta_alerta.style.backgroundColor = '#e2e3e5';
                    etiqueta_alerta.style.color = '#383d41';
                    etiqueta_alerta.innerText = 'Foco perdido: ' + cantidad_infracciones;
                }

                if (contenedor_objetivo) {
                    contenedor_objetivo.appendChild(etiqueta_alerta);
                }
            }
        }
    })
    .catch(error => console.error("Error en la petición fetch de foco:", error));
});