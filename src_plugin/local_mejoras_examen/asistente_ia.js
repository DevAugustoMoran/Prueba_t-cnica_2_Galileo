document.addEventListener("DOMContentLoaded", function() {
    // En Moodle, las preguntas de ensayo siempre tienen las clases .que y .essay
    let ensayos = document.querySelectorAll('.que.essay');
    
    if (ensayos.length === 0) return;

    ensayos.forEach(function(ensayo) {
        if (ensayo.querySelector('.panel-ia-agregado')) return;

        // Buscar el contenedor específico de la respuesta del estudiante
        let divRespuesta = ensayo.querySelector('.qtype_essay_response');
        if (!divRespuesta) return;

        // Detectar si la página actual tiene campos de calificación (solo en modo edición)
        let campoComentario = ensayo.querySelector('textarea[name*="-comment"]');
        let campoNota = ensayo.querySelector('input[name*="-mark"]');

        let panel_ia = document.createElement('div');
        panel_ia.className = 'panel-ia-agregado';
        panel_ia.style.cssText = "background: #f8f9fa; padding: 15px; border-radius: 8px; margin-top: 15px; border: 1px solid #dee2e6; width: 100%; clear: both;";
        panel_ia.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <strong style="font-size: 1.1em; color: #0d6efd;">🤖 Asistente de IA para Ensayo</strong>
            </div>
            <p style="font-size: 0.9em; margin-bottom: 10px; color: #6c757d;">Genera una sugerencia de calificación y retroalimentación basada en el enunciado y la respuesta del alumno. Debe estar orientada al profesor que calificará el ensayo.</p>
            <button type="button" class="btn-procesar-ia" style="background: #0d6efd; color: white; border: none; padding: 8px 16px; border-radius: 5px; cursor: pointer; font-weight: bold;">Generar Sugerencia</button>
            <span class="etiqueta-estado-ia" style="margin-left: 10px; font-style: italic; font-size: 0.9em;"></span>
            
            <div class="resultado-ia" style="display: none; margin-top: 15px; padding: 15px; background: #ffffff; border-left: 4px solid #0d6efd; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="margin-bottom: 8px;"><strong>Nota Sugerida:</strong> <span class="nota-sugerida-texto" style="font-weight: bold; color: #198754;"></span></div>
                <div><strong>Comentario Sugerido:</strong></div>
                <div class="comentario-sugerido-texto" style="margin-top: 5px; font-size: 0.95em; color: #212529; white-space: pre-wrap;"></div>
            </div>
        `;
        
        // Insertar el panel IA justo debajo de la respuesta del estudiante
        divRespuesta.parentNode.insertBefore(panel_ia, divRespuesta.nextSibling);

        let btnProcesar = panel_ia.querySelector('.btn-procesar-ia');
        let indicadorEstado = panel_ia.querySelector('.etiqueta-estado-ia');
        let divResultado = panel_ia.querySelector('.resultado-ia');
        let txtNota = panel_ia.querySelector('.nota-sugerida-texto');
        let txtComentario = panel_ia.querySelector('.comentario-sugerido-texto');

btnProcesar.addEventListener('click', function(evento) {
            evento.preventDefault();
            indicadorEstado.innerText = "Analizando contenido...";
            this.disabled = true;

            let contenidoPregunta = ensayo.querySelector('.qtext') ? ensayo.querySelector('.qtext').innerText : '';
            let contenidoRespuesta = divRespuesta.innerText;

            // Extracción dinámica de la nota máxima configurada para esta pregunta específica
            let campoMaxMark = ensayo.querySelector('input[name*="-maxmark"]');
            let notaMaxima = 1.0;
            if (campoMaxMark) {
                notaMaxima = parseFloat(campoMaxMark.value);
            } else {
                let elementoGrado = ensayo.querySelector('.grade');
                if (elementoGrado) {
                    let coincidencia = elementoGrado.innerText.match(/[\d]+[.,][\d]+/);
                    if (coincidencia) {
                        notaMaxima = parseFloat(coincidencia[0].replace(',', '.'));
                    }
                }
            }

            let paqueteDatos = new FormData();
            paqueteDatos.append('pregunta', contenidoPregunta);
            paqueteDatos.append('respuesta', contenidoRespuesta);
            paqueteDatos.append('nota_maxima', notaMaxima);

            fetch('/local/mejoras_examen/ajax_ia.php', {
                method: 'POST',
                body: paqueteDatos
            })
            .then(res => res.json())
            .then(datos => {
                txtNota.innerText = datos.nota_sugerida;
                txtComentario.innerText = datos.comentario_sugerido;
                divResultado.style.display = 'block';

                if (campoNota) campoNota.value = datos.nota_sugerida;
                if (campoComentario) {
                    campoComentario.value = datos.comentario_sugerido;
                    if (typeof tinyMCE !== 'undefined' && tinyMCE.get(campoComentario.id)) {
                        tinyMCE.get(campoComentario.id).setContent(datos.comentario_sugerido);
                    } else if (typeof Y !== 'undefined' && Y.one('#' + campoComentario.id + 'editable')) {
                        Y.one('#' + campoComentario.id + 'editable').setHTML(datos.comentario_sugerido);
                    }
                }

                indicadorEstado.innerText = campoComentario ? "Sugerencia aplicada al formulario." : "Sugerencia generada con éxito.";
                indicadorEstado.style.color = "green";
                this.disabled = false;
            })
            .catch(err => {
                indicadorEstado.innerText = "Fallo al conectar con el asistente.";
                indicadorEstado.style.color = "red";
                this.disabled = false;
            });
        });
    });
});