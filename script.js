document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const mediaPlayer = document.getElementById('mediaPlayer');
    const mediaFileInput = document.getElementById('mediaFile');
    const subtitleFileInput = document.getElementById('subtitleFile');
    const subtitleDisplay = document.getElementById('subtitleDisplay');
    const offsetDisplay = document.getElementById('offsetDisplay');
    const shiftBackButton = document.getElementById('shiftBack');
    const shiftForwardButton = document.getElementById('shiftForward');
    const resetOffsetButton = document.getElementById('resetOffset');
    const videoContainer = document.getElementById('videoContainer');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const fullscreenIcon = document.getElementById('fullscreenIcon');

    // --- State Variables ---
    let subtitles = [];
    let subtitleOffset = 0;

    // --- File Loading (sin cambios funcionales) ---
    if (mediaFileInput) { mediaFileInput.addEventListener('change', function(event) { const file = event.target.files[0]; if (file && mediaPlayer && fullscreenBtn) { try { const fileURL = URL.createObjectURL(file); mediaPlayer.src = fileURL; resetSubtitles(); fullscreenBtn.disabled = false; console.log("Media file loaded:", file.name); } catch (error) { console.error("Error creating object URL for media file:", error); if(fullscreenBtn) fullscreenBtn.disabled = true; } } else if (!mediaPlayer || !fullscreenBtn) { console.error("Error: mediaPlayer or fullscreenBtn element not found when trying to load media."); } }); } else { console.error("Error: Media file input ('mediaFile') not found."); }
    if (subtitleFileInput) { subtitleFileInput.addEventListener('change', function(event) { const file = event.target.files[0]; if (file) { const reader = new FileReader(); reader.onload = function(e) { try { subtitles = parseSRT(e.target.result); subtitleOffset = 0; updateOffsetDisplay(); console.log(`Loaded ${subtitles.length} subtitles.`); updateSubtitleDisplay('subtitle_load'); } catch (error) { console.error("Error parsing SRT file:", error); if (subtitleDisplay) subtitleDisplay.textContent = "Error parsing SRT file."; subtitles = []; } }; reader.onerror = function(e) { console.error("Error reading subtitle file:", e); if (subtitleDisplay) subtitleDisplay.textContent = "Error reading subtitle file."; subtitles = []; }; reader.readAsText(file); } }); } else { console.error("Error: Subtitle file input ('subtitleFile') not found."); }

    // --- SRT Parsing Logic ---
    function parseSRT(srtContent) {
        console.log("Starting SRT Parse..."); // Log inicio parseo
        const subs = [];
        const blocks = srtContent.trim().replace(/\r\n/g, '\n').split('\n\n');
        let parseErrors = 0;

        blocks.forEach((block, blockIndex) => {
            const lines = block.split('\n');
            if (lines.length >= 3) {
                const index = parseInt(lines[0], 10);
                // *** Regex mejorada: acepta coma (,) o punto (.) para ms ***
                const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);

                if (!isNaN(index) && timeMatch) {
                    const startTime = timeToMs(timeMatch[1], timeMatch[2], timeMatch[3], timeMatch[4]);
                    const endTime = timeToMs(timeMatch[5], timeMatch[6], timeMatch[7], timeMatch[8]);

                    // *** Comprobación de NaN ***
                    if (isNaN(startTime) || isNaN(endTime)) {
                        console.warn(`SRT Parse Warning: Invalid time calculation for index ${index}. Block:`, block);
                        parseErrors++;
                        return; // Saltar este bloque
                    }

                    const text = lines.slice(2).join('<br>');
                    subs.push({ index, startTime, endTime, text });
                } else {
                    // Solo loguear si no es una línea vacía al final
                    if(block.trim() !== "") {
                        console.warn(`SRT Parse Warning: Invalid format for index ${index} or time mismatch. Block:`, block);
                        parseErrors++;
                    }
                }
            } else if (block.trim() !== "") {
                 console.warn(`SRT Parse Warning: Block ${blockIndex + 1} has too few lines. Block:`, block);
                 parseErrors++;
            }
        });
        console.log(`SRT Parse finished. ${subs.length} subtitles parsed successfully. ${parseErrors} blocks skipped due to errors.`);
        // Ordenar por si acaso (aunque no debería ser necesario si el SRT está bien)
        subs.sort((a, b) => a.startTime - b.startTime);
        // Log del primer y último subtítulo parseado para verificación
        if (subs.length > 0) {
            console.log("First parsed subtitle:", subs[0]);
            console.log("Last parsed subtitle:", subs[subs.length - 1]);
        }
        return subs;
    }

    function timeToMs(h, m, s, ms) {
        // Convertir cada parte a número
        const hours = parseInt(h, 10);
        const minutes = parseInt(m, 10);
        const seconds = parseInt(s, 10);
        const milliseconds = parseInt(ms, 10);
        // Comprobar si alguna conversión falló (resultó en NaN)
        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds)) {
            return NaN; // Devolver NaN si alguna parte no es un número válido
        }
        return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
    }

    // --- Subtitle Synchronization and Display ---
    if (mediaPlayer) {
        mediaPlayer.addEventListener('timeupdate', () => updateSubtitleDisplay('timeupdate'));
        mediaPlayer.addEventListener('ended', () => { if (subtitleDisplay) subtitleDisplay.innerHTML = ''; });
        mediaPlayer.addEventListener('emptied', () => { if(subtitleDisplay) subtitleDisplay.innerHTML = ''; resetSubtitles(); if (fullscreenBtn) fullscreenBtn.disabled = true; });
    } else { console.error("Error: The mediaPlayer element was not found."); }

    function updateSubtitleDisplay(caller = 'unknown') {
        if (!subtitles.length || !mediaPlayer || !subtitleDisplay) return;

        const currentTime = mediaPlayer.currentTime;
        const currentTimeMs = (currentTime * 1000) + subtitleOffset;
        let currentSubtitleText = '';

        // Log principal para ver el tiempo efectivo y el offset usado
        // console.log(`[${caller}] Time: ${currentTime?.toFixed(3)}s | Offset Used: ${subtitleOffset}ms | Efectivo: ${currentTimeMs.toFixed(0)}ms`);

        const currentSub = subtitles.find(sub => currentTimeMs >= sub.startTime && currentTimeMs <= sub.endTime);

        if (currentSub) {
            currentSubtitleText = currentSub.text;
            // *** Log para ver los tiempos del subtítulo encontrado ***
            console.log(`   >> Found Sub Idx: ${currentSub.index} | Start: ${currentSub.startTime}ms | End: ${currentSub.endTime}ms | Text: ${currentSubtitleText.substring(0,30)}...`);
        } else {
            currentSubtitleText = '';
            // Log si no se encuentra nada (puede ser normal)
            // console.log(`   >> No subtitle found for time ${currentTimeMs.toFixed(0)}ms`);
        }

        if (subtitleDisplay.innerHTML !== currentSubtitleText) {
            subtitleDisplay.innerHTML = currentSubtitleText;
        }
    }

    function resetSubtitles() {
        subtitles = []; if (subtitleDisplay) subtitleDisplay.innerHTML = ''; subtitleOffset = 0; updateOffsetDisplay();
     }

    // --- Offset Controls ---
    if (shiftBackButton) { shiftBackButton.addEventListener('click', () => { subtitleOffset -= 100; updateOffsetDisplay(); updateSubtitleDisplay('button_click'); }); } else { console.error("Offset button '-' not found."); }
    if (shiftForwardButton) { shiftForwardButton.addEventListener('click', () => { subtitleOffset += 100; updateOffsetDisplay(); updateSubtitleDisplay('button_click'); }); } else { console.error("Offset button '+' not found."); }
    if (resetOffsetButton) { resetOffsetButton.addEventListener('click', () => { subtitleOffset = 0; updateOffsetDisplay(); updateSubtitleDisplay('button_click'); }); } else { console.error("Offset button 'Reset' not found."); }
    function updateOffsetDisplay() { if (offsetDisplay) offsetDisplay.textContent = subtitleOffset; }

    // --- Fullscreen API Logic (sin cambios) ---
    function toggleFullscreen() { if (!videoContainer || !document) { console.error("Error: videoContainer or document not found for fullscreen toggle."); return; } if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) { if (videoContainer.requestFullscreen) { videoContainer.requestFullscreen().catch(err => console.error(`Error entering fullscreen: ${err.message}`, err)); } else if (videoContainer.webkitRequestFullscreen) { videoContainer.webkitRequestFullscreen().catch(err => console.error(`Error webkit fullscreen: ${err.message}`, err)); } else if (videoContainer.mozRequestFullScreen) { videoContainer.mozRequestFullScreen().catch(err => console.error(`Error moz fullscreen: ${err.message}`, err)); } else if (videoContainer.msRequestFullscreen) { videoContainer.msRequestFullscreen().catch(err => console.error(`Error ms fullscreen: ${err.message}`, err)); } else { console.error("Fullscreen API is not supported by this browser."); alert("Fullscreen API is not supported by this browser."); } } else { if (document.exitFullscreen) { document.exitFullscreen().catch(err => console.error(`Error exiting fullscreen: ${err.message}`, err)); } else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); } else if (document.mozCancelFullScreen) { document.mozCancelFullScreen(); } else if (document.msExitFullscreen) { document.msExitFullscreen(); } else { console.error("Exit Fullscreen API is not supported."); } } }
    function updateFullscreenIcon() { if (!fullscreenIcon || !document) return; if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) { fullscreenIcon.classList.remove('fa-expand'); fullscreenIcon.classList.add('fa-compress'); if(fullscreenBtn) fullscreenBtn.title = "Salir de Pantalla Completa"; } else { fullscreenIcon.classList.remove('fa-compress'); fullscreenIcon.classList.add('fa-expand'); if(fullscreenBtn) fullscreenBtn.title = "Pantalla Completa"; } }
    if (fullscreenBtn && videoContainer) { fullscreenBtn.disabled = !mediaPlayer || !mediaPlayer.currentSrc; fullscreenBtn.addEventListener('click', toggleFullscreen); document.addEventListener('fullscreenchange', updateFullscreenIcon); document.addEventListener('webkitfullscreenchange', updateFullscreenIcon); document.addEventListener('mozfullscreenchange', updateFullscreenIcon); document.addEventListener('MSFullscreenChange', updateFullscreenIcon); } else { console.error("Error: Fullscreen button ('fullscreenBtn') or video container ('videoContainer') not found."); if(fullscreenBtn) fullscreenBtn.disabled = true; }
    updateFullscreenIcon();

}); // End of DOMContentLoaded
