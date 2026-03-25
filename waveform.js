(function () {
    const display = document.getElementById('waveform-display');
    if (!display) return;

    const container = display.parentElement;

    // --- Braille encoding ---
    const brailleOffsets = [
        [0x01, 0x08],
        [0x02, 0x10],
        [0x04, 0x20],
        [0x40, 0x80],
    ];

    // --- Wave layers ---
    const layers = [
        { frequency: 2.0, speed: 0.45,  phase: 0,             ampScale: 1.0  },
        { frequency: 3.7, speed: -0.70,  phase: Math.PI / 3,   ampScale: 0.65 },
        { frequency: 1.2, speed: 0.28,   phase: Math.PI,       ampScale: 0.45 },
    ];

    // --- Color palette (indexed by layer bitmask) ---
    const layerColors = [
        null,
        '#8a5a72',  // 0b001 - layer 1 (muted pink)
        '#7a6a8f',  // 0b010 - layer 2 (muted purple)
        '#806878',  // 0b011 - layers 1+2
        '#6a8a90',  // 0b100 - layer 3 (muted cyan)
        '#787880',  // 0b101 - layers 1+3
        '#728088',  // 0b110 - layers 2+3
        '#9a9a96',  // 0b111 - all three
    ];

    // --- Grid state ---
    let cols = 0, rows = 0;
    let pixelWidth = 0, pixelHeight = 0;
    let pixelBuffer = null;

    function measureGrid() {
        const probe = document.createElement('pre');
        probe.style.font = getComputedStyle(display).font;
        probe.style.lineHeight = getComputedStyle(display).lineHeight;
        probe.style.letterSpacing = '0';
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        probe.style.whiteSpace = 'pre';
        probe.textContent = '\u2800'.repeat(10) + '\n' + '\u2800'.repeat(10);
        document.body.appendChild(probe);
        const rect = probe.getBoundingClientRect();
        const charW = rect.width / 10;
        const charH = rect.height / 2;
        document.body.removeChild(probe);

        const bounds = container.getBoundingClientRect();
        cols = Math.floor(bounds.width / charW);
        rows = Math.floor(bounds.height / charH);
        if (cols < 1) cols = 1;
        if (rows < 1) rows = 1;
        pixelWidth = cols * 2;
        pixelHeight = rows * 4;
        pixelBuffer = new Uint8Array(pixelWidth * pixelHeight);
    }

    function clearBuffer() {
        pixelBuffer.fill(0);
    }

    function setPixel(px, py, layerBit) {
        if (px >= 0 && px < pixelWidth && py >= 0 && py < pixelHeight) {
            pixelBuffer[py * pixelWidth + px] |= layerBit;
        }
    }

    function rasterizeLayers(time) {
        for (let li = 0; li < layers.length; li++) {
            const layer = layers[li];
            const layerBit = 1 << li;
            const breathe = 0.72 + 0.28 * Math.sin(time * 0.38 + li * 1.1);
            const baseAmp = (pixelHeight / 2) * layer.ampScale * breathe * 0.7;

            for (let px = 0; px < pixelWidth; px++) {
                const fx = px / pixelWidth;
                const py = Math.round(
                    pixelHeight / 2 +
                    baseAmp * Math.sin(fx * layer.frequency * 2 * Math.PI + layer.phase + time * layer.speed)
                );
                setPixel(px, py - 1, layerBit);
                setPixel(px, py,     layerBit);
                setPixel(px, py + 1, layerBit);
            }
        }
    }

    function renderToDisplay() {
        let html = '';
        let currentColor = null;
        let currentChars = '';

        function flushSpan() {
            if (currentChars.length === 0) return;
            if (currentColor) {
                html += '<span style="color:' + currentColor + '">' + currentChars + '</span>';
            } else {
                html += currentChars;
            }
            currentChars = '';
        }

        for (let cy = 0; cy < rows; cy++) {
            for (let cx = 0; cx < cols; cx++) {
                let pattern = 0;
                let cellLayers = 0;

                for (let dy = 0; dy < 4; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        const px = cx * 2 + dx;
                        const py = cy * 4 + dy;
                        const val = pixelBuffer[py * pixelWidth + px];
                        if (val !== 0) {
                            pattern |= brailleOffsets[dy][dx];
                            cellLayers |= val;
                        }
                    }
                }

                let char, color;
                if (pattern === 0) {
                    char = '\u2800';
                    color = null;
                } else {
                    char = String.fromCharCode(0x2800 + pattern);
                    color = layerColors[cellLayers];
                }

                if (color !== currentColor) {
                    flushSpan();
                    currentColor = color;
                }
                currentChars += char;
            }

            flushSpan();
            currentColor = null;
            currentChars = '';
            if (cy < rows - 1) html += '\n';
        }

        flushSpan();
        display.innerHTML = html;
    }

    // --- Animation loop ---
    let lastFrame = 0;
    const targetInterval = 1000 / 30;

    function animate(timestamp) {
        requestAnimationFrame(animate);
        if (timestamp - lastFrame < targetInterval) return;
        lastFrame = timestamp;

        const time = timestamp / 1000;
        clearBuffer();
        rasterizeLayers(time);
        renderToDisplay();
    }

    // --- Resize handling ---
    let resizeTimeout;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(measureGrid, 200);
    });

    // --- Init ---
    measureGrid();
    requestAnimationFrame(animate);
    requestAnimationFrame(function () {
        display.style.opacity = '1';
    });
})();
