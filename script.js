const canvas = document.getElementById('hero-canvas');
const ctx = canvas.getContext('2d', { alpha: false }); // Optimization for opaque canvas
const debugFrame = document.getElementById('debug-frame');
const debugSheets = document.getElementById('debug-sheets');
const scrollContainer = document.querySelector('.scroll-container');
const scrollPrompt = document.getElementById('scroll-prompt');
const k2Text = document.getElementById('k2-text');

// Configuration based on sprite sheet specs
const TOTAL_SHEETS = 6;
const FRAMES_PER_SHEET = 16;
const COLS = 4;
const ROWS = 4;
const TOTAL_FRAMES = 96;
const FRAME_WIDTH = 960;
const FRAME_HEIGHT = 540;
const LERP_FACTOR = 0.15;

// State
let images = new Array(TOTAL_SHEETS).fill(null);
let loadedStatus = new Array(TOTAL_SHEETS).fill(false);
let loadedCount = 0;

let targetFrame = 0;
let currentFrameFloat = 0;
let lastDrawnFrame = -1;
let rafId;

function updateDebug() {
    debugFrame.textContent = Math.round(currentFrameFloat);
    debugSheets.textContent = `${loadedCount} / ${TOTAL_SHEETS}`;
}

function loadImage(index) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = `sheet_0${index}.webp`;
        img.onload = () => {
            images[index] = img;
            loadedStatus[index] = true;
            loadedCount++;
            updateDebug();
            resolve();
        };
        img.onerror = () => {
            console.error(`Failed to load sheet_0${index}.webp`);
            reject();
        };
    });
}

async function loadAssets() {
    // 2. Loads sheet_00.webp and sheet_01.webp first (first 32 frames)
    await Promise.all([loadImage(0), loadImage(1)]);
    
    // Once those are ready, load sheet_02 through sheet_05 in the background
    for (let i = 2; i < TOTAL_SHEETS; i++) {
        loadImage(i).catch(() => {}); // Catch to avoid unhandled rejections if a file is missing
    }
}

function resize() {
    // 10. Add basic resize handling so canvas stays full-screen and correctly cropped
    // Use devicePixelRatio for crisp rendering on high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    // The canvas CSS width/height remains 100% (or innerWidth/Height)
    // Force a redraw of the current frame so it scales properly on resize
    drawFrame(lastDrawnFrame !== -1 ? lastDrawnFrame : 0, true);
}

window.addEventListener('resize', resize);
resize();

// Scroll handler
window.addEventListener('scroll', () => {
    // 4. Map scroll progress (0 to 1) to a frame index from 0 to 95
    const containerTop = scrollContainer.offsetTop;
    const containerHeight = scrollContainer.offsetHeight - window.innerHeight; // The actual scrollable range for the sticky section
    
    let scrollTop = window.scrollY - containerTop;
    
    // Clamp
    if (scrollTop < 0) scrollTop = 0;
    if (scrollTop > containerHeight) scrollTop = containerHeight;
    
    const progress = scrollTop / containerHeight;
    targetFrame = progress * (TOTAL_FRAMES - 1);

    // Aesthetic touch: fade out scroll prompt when user starts scrolling
    if (progress > 0.02) {
        scrollPrompt.style.opacity = '0';
    } else {
        scrollPrompt.style.opacity = '0.8';
    }
});

function drawFrame(frameIndex, force = false) {
    // Clamp frame index
    if (frameIndex < 0) frameIndex = 0;
    if (frameIndex >= TOTAL_FRAMES) frameIndex = TOTAL_FRAMES - 1;
    
    let sheetIndex = Math.floor(frameIndex / FRAMES_PER_SHEET);
    
    // 8. If required sheet hasn't finished loading yet, hold the last successfully drawn frame
    if (!loadedStatus[sheetIndex]) {
        if (lastDrawnFrame !== -1) {
            frameIndex = lastDrawnFrame;
            sheetIndex = Math.floor(frameIndex / FRAMES_PER_SHEET);
        } else {
            return; // Can't draw anything yet
        }
    }
    
    // Optimization: Don't redraw the exact same frame unless forced (e.g., on resize)
    if (frameIndex === lastDrawnFrame && !force) {
        return;
    }
    
    // Calculate position in the 4x4 sprite sheet grid
    const frameInSheet = frameIndex % FRAMES_PER_SHEET;
    const col = frameInSheet % COLS;
    const row = Math.floor(frameInSheet / COLS);
    
    const sx = col * FRAME_WIDTH;
    const sy = row * FRAME_HEIGHT;
    
    // 7. Scale/crop each source frame to fill canvas without distortion (background-size: cover equivalent)
    const imgRatio = FRAME_WIDTH / FRAME_HEIGHT;
    const canvasRatio = canvas.width / canvas.height;
    
    let dw, dh, dx, dy;
    
    if (canvasRatio > imgRatio) {
        // Canvas is wider than image aspect ratio, fit to width and crop vertical
        dw = canvas.width;
        dh = canvas.width / imgRatio;
        dx = 0;
        dy = (canvas.height - dh) / 2;
    } else {
        // Canvas is taller than image aspect ratio, fit to height and crop horizontal
        dh = canvas.height;
        dw = canvas.height * imgRatio;
        dx = (canvas.width - dw) / 2;
        dy = 0;
    }
    
    const img = images[sheetIndex];
    if (img) {
        // Draw the cropped region to the calculated destination
        ctx.drawImage(img, sx, sy, FRAME_WIDTH, FRAME_HEIGHT, dx, dy, dw, dh);
        lastDrawnFrame = frameIndex;
    }
}

function loop() {
    // 6. Add lerp-based smoothing between current and target frame (~0.15 per tick)
    currentFrameFloat += (targetFrame - currentFrameFloat) * LERP_FACTOR;
    
    const currentFrameInt = Math.round(currentFrameFloat);
    
    // 5. Draw calls must happen inside a requestAnimationFrame loop
    drawFrame(currentFrameInt);
    updateDebug();
    
    // Apple-style cinematic typography fade and scale
    let textOpacity = 0;
    let textScale = 0.95;
    
    if (currentFrameFloat > 40) {
        // Fade in 42 -> 52
        if (currentFrameFloat <= 52) {
            textOpacity = Math.max(0, (currentFrameFloat - 42) / 10);
        } 
        // Hold indefinitely
        else {
            textOpacity = 1;
        }
        
        // Continuous slow, elegant scale up
        textScale = 0.95 + (currentFrameFloat - 42) * 0.002;
    }
    
    k2Text.style.opacity = textOpacity.toFixed(3);
    k2Text.style.transform = `translate(-50%, -50%) scale(${textScale.toFixed(3)})`;
    
    rafId = requestAnimationFrame(loop);
}

// Initialization
loadAssets().then(() => {
    // Update target frame immediately based on current scroll position 
    // (in case user reloads halfway down the page)
    window.dispatchEvent(new Event('scroll'));
});

// Start loop immediately; it won't draw until the first sheet is loaded
loop();
