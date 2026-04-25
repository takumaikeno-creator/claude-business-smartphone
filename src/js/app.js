'use strict';

// Floating CTA visibility
const floatingCta = document.querySelector('.floating-cta');
const heroSection = document.querySelector('.hero');

if (floatingCta && heroSection) {
  const observer = new IntersectionObserver(
    ([entry]) => floatingCta.classList.toggle('show', !entry.isIntersecting),
    { threshold: 0.1 }
  );
  observer.observe(heroSection);
}

// Scroll-triggered fade-up animations
const animatedEls = document.querySelectorAll('[data-animate]');
if (animatedEls.length) {
  const animObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-up');
          animObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  animatedEls.forEach((el) => animObserver.observe(el));
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

// Live counter animation
function animateCounter(el, end, duration = 1200) {
  const start = 0;
  const step = (end - start) / (duration / 16);
  let current = start;
  const timer = setInterval(() => {
    current += step;
    if (current >= end) { current = end; clearInterval(timer); }
    el.textContent = Math.floor(current).toLocaleString('ja-JP');
  }, 16);
}

const counters = document.querySelectorAll('[data-counter]');
if (counters.length) {
  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target, Number(entry.target.dataset.counter));
          counterObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((el) => counterObserver.observe(el));
}

// Registration form (stub)
const form = document.querySelector('#signup-form');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.textContent = '登録中…';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = '登録完了！メールをご確認ください ✓';
      btn.style.background = 'var(--success)';
    }, 1200);
  });
}
