// A module-scoped variable to hold the Vanta instance.
let vantaEffect = null;

const Easing = {
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeOutQuint: t => 1 - Math.pow(1 - t, 5)
};

const animateVantaProperty = (property, start, end, duration, easingFunc) => {
    if (!vantaEffect) return;

    let startTime = null;
    const range = end - start;

    const step = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsedTime = timestamp - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        const easedProgress = easingFunc(progress);
        const value = start + range * easedProgress;

        vantaEffect.setOptions({ [property]: value });

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    };
    requestAnimationFrame(step);
};

// EXPORT: This function can be imported and used by other scripts.
export const triggerRipple = () => {
    if (vantaEffect) {
        const baseHeight = 7.00;
        const peakHeight = 9.00;
        const baseSpeed = 0.75;
        const peakSpeed = 1.0;
        const swellDuration = 800;
        const calmDuration = 6000;

        animateVantaProperty('waveHeight', baseHeight, peakHeight, swellDuration, Easing.easeOutCubic);
        animateVantaProperty('waveSpeed', baseSpeed, peakSpeed, swellDuration, Easing.easeOutCubic);

        setTimeout(() => {
            animateVantaProperty('waveHeight', peakHeight, baseHeight, calmDuration, Easing.easeOutQuint);
            animateVantaProperty('waveSpeed', peakSpeed, baseSpeed, calmDuration, Easing.easeOutQuint);
        }, swellDuration);
    }
};

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
        waveHeight: 7.00,
        waveSpeed: 1,
        zoom: 1.90
    });
    vantaEffect.resize();
};