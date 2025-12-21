const nav = document.querySelector('.nav');
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

let targetT = 0;
let currentT = 0;
let rafId = null;

const getScrollT = () => clamp((window.scrollY || 0) / 140, 0, 1);
const getMenuT = () => (mobileMenu.classList.contains('active') ? 1 : 0);

const applyNavStyle = (t) => {
    const bgAlpha = 0.95 * t;
    const shadowAlpha = 0.35 * t;
    const blurPx = 12 * t;
    const pad = 20 - 8 * t;

    nav.style.backgroundColor = `rgba(26, 26, 26, ${bgAlpha})`;
    nav.style.backdropFilter = `blur(${blurPx}px)`;
    nav.style.boxShadow = `0 4px 30px rgba(0, 0, 0, ${shadowAlpha})`;
    nav.style.padding = `${pad}px 0`;
    nav.style.borderBottomColor = `rgba(48, 48, 48, ${0.6 * t})`;
};

const animateNav = () => {
    currentT += (targetT - currentT) * 0.12;
    applyNavStyle(currentT);

    if (Math.abs(targetT - currentT) > 0.001) {
        rafId = requestAnimationFrame(animateNav);
    } else {
        currentT = targetT;
        applyNavStyle(currentT);
        rafId = null;
    }
};

const setNavTarget = () => {
    targetT = Math.max(getScrollT(), getMenuT());
    if (!rafId) rafId = requestAnimationFrame(animateNav);
};

const setMobileMenuOpen = (open) => {
    hamburger.classList.toggle('active', open);
    mobileMenu.classList.toggle('active', open);
    document.body.classList.toggle('no-scroll', open);
    setNavTarget();
};

hamburger.addEventListener('click', () => {
    const open = !mobileMenu.classList.contains('active');
    setMobileMenuOpen(open);
});

document.querySelectorAll('.mobile-menu__link').forEach(link => {
    link.addEventListener('click', () => setMobileMenuOpen(false));
});

window.addEventListener('scroll', setNavTarget, { passive: true });
window.addEventListener('resize', setNavTarget);

setNavTarget();