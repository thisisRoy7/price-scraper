// Public/js/vanta-animation.js

let vantaEffect = null;

// EXPORT: This function initializes the entire effect.
export const initVanta = () => {
    vantaEffect = VANTA.WAVES({
        el: "#vanta-bg",
        mouseControls: false,
        touchControls: false,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: 0x808080,
        waveHeight: 8.00,
        waveSpeed: 0.85,
        zoom: 1.90
    });
    vantaEffect.resize();
};