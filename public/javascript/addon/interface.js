const nav = document.querySelector('.nav');
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

let targetT = 0;
let currentT = 0;
let rafId = null;

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

const setNavTargetFromScroll = () => {
    const open = mobileMenu.classList.contains('active');
    const y = open ? 999 : (window.scrollY || 0);
    targetT = clamp(y / 140, 0, 1);

    if (!rafId) rafId = requestAnimationFrame(animateNav);
};

const setMobileMenuOpen = (open) => {
    hamburger.classList.toggle('active', open);
    mobileMenu.classList.toggle('active', open);
    nav.classList.toggle('nav--menu-open', open);
    document.body.classList.toggle('no-scroll', open);
    setNavTargetFromScroll();
};

hamburger.addEventListener('click', () => {
    const open = !mobileMenu.classList.contains('active');
    setMobileMenuOpen(open);
});

document.querySelectorAll('.mobile-menu__link').forEach(link => {
    link.addEventListener('click', () => setMobileMenuOpen(false));
});

window.addEventListener('scroll', setNavTargetFromScroll, { passive: true });
window.addEventListener('resize', setNavTargetFromScroll);

setNavTargetFromScroll();

const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, observerOptions);

document.querySelectorAll('.neu-card, .section-header, .hero__content, .hero__visual').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});