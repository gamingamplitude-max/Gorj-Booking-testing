/* ═══════════════════════════════════════════════════════════════
   GORJ BOOKING — Premium JavaScript · v2 "Relief" redesign
   GSAP + Three.js 3D terrain + universal tilt engine + booking UI
   ═══════════════════════════════════════════════════════════════ */

'use strict';

const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// ── 1. LOADING SCREEN ─────────────────────────────────────────────
(function initLoader() {
  const screen  = document.getElementById('loading-screen');
  const bar     = document.querySelector('.loader-bar');
  const percent = document.querySelector('.loader-percent');
  const logo    = document.querySelector('.loader-logo');
  const sub     = document.querySelector('.loader-subtitle');
  const crest   = document.querySelector('.loader-crest');

  if (!screen) return;

  // Draw the crest ridgelines like a pen stroke
  if (!PREFERS_REDUCED_MOTION && typeof gsap !== 'undefined') {
    document.querySelectorAll('.crest-peak').forEach(peak => {
      const len = peak.getTotalLength ? peak.getTotalLength() : 400;
      peak.style.strokeDasharray = len;
      peak.style.strokeDashoffset = len;
      gsap.to(peak, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' });
    });
    gsap.fromTo('.crest-sun', { scale: 0, transformOrigin: 'center' }, { scale: 1, duration: 0.9, delay: 0.9, ease: 'back.out(2)' });
  }

  let progress = 0;
  const interval = setInterval(() => {
    progress += Math.random() * 12 + 3;
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      setTimeout(hideLoader, 350);
    }
    if (bar) bar.style.width = progress + '%';
    if (percent) percent.textContent = Math.round(progress) + '%';
  }, 70);

  function hideLoader() {
    gsap.to([crest, logo, sub, bar && bar.parentElement, percent].filter(Boolean), {
      opacity: 0,
      y: -20,
      stagger: 0.07,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => {
        gsap.to(screen, {
          scaleY: 0,
          transformOrigin: 'top',
          duration: 0.8,
          ease: 'power4.inOut',
          onComplete: () => {
            screen.style.display = 'none';
            initHeroAnimation();
          }
        });
      }
    });
  }
})();

// ── 2. CUSTOM CURSOR ──────────────────────────────────────────────
(function initCursor() {
  if (IS_TOUCH) return;
  const cursor   = document.getElementById('cursor');
  const follower = document.getElementById('cursor-follower');
  if (!cursor || !follower) return;

  let mouseX = 0, mouseY = 0;
  let followerX = 0, followerY = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    gsap.set(cursor, { x: mouseX, y: mouseY });
  });

  function animateFollower() {
    followerX += (mouseX - followerX) * 0.12;
    followerY += (mouseY - followerY) * 0.12;
    gsap.set(follower, { x: followerX, y: followerY });
    requestAnimationFrame(animateFollower);
  }
  animateFollower();

  // Delegated hover scale — works for dynamically created cards too
  document.addEventListener('mouseover', e => {
    if (e.target.closest('a, button, .dest-card, .accom-card, .location-card, .gallery-item, .testimonial-card, .exp-item')) {
      gsap.to(cursor,   { scale: 2,   duration: 0.3 });
      gsap.to(follower, { scale: 1.5, duration: 0.3, borderColor: 'rgba(201,168,76,0.9)' });
    }
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('a, button, .dest-card, .accom-card, .location-card, .gallery-item, .testimonial-card, .exp-item')) {
      gsap.to(cursor,   { scale: 1, duration: 0.3 });
      gsap.to(follower, { scale: 1, duration: 0.3, borderColor: 'rgba(201,168,76,0.6)' });
    }
  });
})();

// ── 3. NAVBAR ─────────────────────────────────────────────────────
(function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const menu      = document.getElementById('nav-menu');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  if (hamburger && menu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      menu.classList.toggle('open');
    });
    menu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        menu.classList.remove('open');
      });
    });
  }

  window._animateNavbar = function() {
    gsap.fromTo(navbar,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.2 }
    );
  };
})();

// ── 4. THREE.JS 3D TERRAIN — layered gold wireframe ridgelines ────
// A real-time 3D mountain relief rendered over the hero photo.
// Ridges gently drift; the whole terrain parallaxes with the mouse
// and recedes on scroll. Skipped on touch / reduced motion.
(function initThreeTerrain() {
  const canvas = document.getElementById('hero-3d-canvas');
  if (!canvas || typeof THREE === 'undefined' || PREFERS_REDUCED_MOTION) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  } catch (err) {
    canvas.style.display = 'none';
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene  = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.055);

  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.9, 7.5);
  camera.lookAt(0, 0.4, 0);

  // — Terrain: plane displaced by layered sine "ridges" (deterministic, cheap)
  const SEG_X = 110, SEG_Z = 46;
  const geo = new THREE.PlaneGeometry(30, 13, SEG_X, SEG_Z);
  geo.rotateX(-Math.PI / 2);

  function ridgeHeight(x, z) {
    // Several octaves of drifting sine ridges — resembles Parâng silhouettes
    let h = 0;
    h += Math.sin(x * 0.42 + z * 0.31) * 0.85;
    h += Math.sin(x * 0.83 - z * 0.52 + 1.7) * 0.45;
    h += Math.sin(x * 1.7 + z * 1.1 + 4.2) * 0.18;
    h += Math.cos(x * 0.23 - z * 0.71) * 0.55;
    // Sharpen into ridges
    h = Math.pow(Math.abs(h), 1.25) * Math.sign(h);
    // Raise far rows (background peaks), keep near rows low so text stays clear
    const depthBoost = THREE.MathUtils.smoothstep(-z, -2.0, 6.5);
    return h * 0.62 * (0.35 + depthBoost);
  }

  const pos = geo.attributes.position;
  const baseY = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const y = ridgeHeight(x, z);
    pos.setY(i, y);
    baseY[i] = y;
  }
  geo.computeVertexNormals();

  const wireMat = new THREE.MeshBasicMaterial({
    color: 0xC9A84C,
    wireframe: true,
    transparent: true,
    opacity: 0.16
  });
  const terrain = new THREE.Mesh(geo, wireMat);
  terrain.position.set(0, -1.5, -2.5);
  scene.add(terrain);

  // — Second, farther ridgeline: brighter crest silhouette
  const crestGeo = new THREE.PlaneGeometry(34, 8, 90, 16);
  crestGeo.rotateX(-Math.PI / 2);
  const cpos = crestGeo.attributes.position;
  for (let i = 0; i < cpos.count; i++) {
    const x = cpos.getX(i), z = cpos.getZ(i);
    let h = Math.sin(x * 0.3 + 2.2) * 1.4 + Math.sin(x * 0.71 + z * 0.4) * 0.6;
    h = Math.pow(Math.abs(h), 1.35) * Math.sign(h);
    cpos.setY(i, h * 0.5 + 0.4);
  }
  const crestMat = new THREE.MeshBasicMaterial({
    color: 0xE8C96A, wireframe: true, transparent: true, opacity: 0.07
  });
  const crest = new THREE.Mesh(crestGeo, crestMat);
  crest.position.set(0, -0.4, -8.5);
  scene.add(crest);

  // — Gold dust particles drifting like fireflies over the valley
  const P_COUNT = 320;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(P_COUNT * 3);
  const pSeed = new Float32Array(P_COUNT);
  for (let i = 0; i < P_COUNT; i++) {
    pPos[i * 3]     = (Math.random() - 0.5) * 24;
    pPos[i * 3 + 1] = Math.random() * 4.5 - 0.8;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2;
    pSeed[i] = Math.random() * Math.PI * 2;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({
    color: 0xE8C96A, size: 0.035, transparent: true, opacity: 0.55, sizeAttenuation: true
  });
  const dust = new THREE.Points(pGeo, pMat);
  scene.add(dust);

  // — Interaction state
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  let scrollFade = 1;
  window.addEventListener('scroll', () => {
    const h = window.innerHeight;
    scrollFade = Math.max(0, 1 - window.scrollY / (h * 0.85));
  }, { passive: true });

  // Pause rendering when hero is off-screen
  let heroVisible = true;
  const hero = document.getElementById('hero');
  if ('IntersectionObserver' in window && hero) {
    new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
    }, { threshold: 0.01 }).observe(hero);
  }

  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    if (!heroVisible) return;

    const t = clock.getElapsedTime();

    // Slow breathing of terrain ridges
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, baseY[i] + Math.sin(t * 0.5 + x * 0.6 + z * 0.4) * 0.045);
    }
    pos.needsUpdate = true;

    // Dust drift
    const dp = pGeo.attributes.position;
    for (let i = 0; i < P_COUNT; i++) {
      dp.array[i * 3 + 1] += Math.sin(t * 0.7 + pSeed[i]) * 0.0016;
      dp.array[i * 3]     += Math.cos(t * 0.35 + pSeed[i]) * 0.0011;
    }
    dp.needsUpdate = true;

    // Mouse parallax + scroll recede
    camera.position.x += (mouseX * 0.9 - camera.position.x) * 0.035;
    camera.position.y += ((1.9 - mouseY * 0.45) - camera.position.y) * 0.035;
    camera.lookAt(0, 0.4, 0);

    terrain.position.y = -1.5 - (1 - scrollFade) * 1.4;
    wireMat.opacity  = 0.16 * scrollFade;
    crestMat.opacity = 0.07 * scrollFade;
    pMat.opacity     = 0.55 * scrollFade;

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
})();

// ── 5. UNIVERSAL 3D TILT ENGINE ───────────────────────────────────
// Any element with .tilt-3d gets pointer-tracked perspective tilt,
// pop-out layers via [data-tilt-layer], and a moving glare highlight.
(function initTiltEngine() {
  if (IS_TOUCH || PREFERS_REDUCED_MOTION) return;

  function bindTilt(el) {
    if (el._tiltBound) return;
    el._tiltBound = true;

    const max = Number(el.dataset.tiltMax) || 8;
    const layers = el.querySelectorAll('[data-tilt-layer]');
    let raf = null;
    let targetRX = 0, targetRY = 0, curRX = 0, curRY = 0;

    function loop() {
      curRX += (targetRX - curRX) * 0.14;
      curRY += (targetRY - curRY) * 0.14;
      el.style.transform = `perspective(var(--tilt-perspective)) rotateX(${curRX.toFixed(3)}deg) rotateY(${curRY.toFixed(3)}deg)`;
      layers.forEach(layer => {
        const depth = Number(layer.dataset.tiltLayer) || 1;
        layer.style.transform = `translateZ(${depth * 18}px) translateX(${(-curRY * depth * 0.55).toFixed(2)}px) translateY(${(curRX * depth * 0.55).toFixed(2)}px)`;
      });
      if (Math.abs(curRX - targetRX) > 0.02 || Math.abs(curRY - targetRY) > 0.02) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
      }
    }

    function kick() { if (!raf) raf = requestAnimationFrame(loop); }

    el.addEventListener('mousemove', e => {
      const rect = el.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      targetRY = (px - 0.5) * 2 * max;
      targetRX = -(py - 0.5) * 2 * max;
      el.style.setProperty('--glare-x', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--glare-y', (py * 100).toFixed(1) + '%');
      kick();
    });

    el.addEventListener('mouseleave', () => {
      targetRX = 0; targetRY = 0;
      kick();
    });
  }

  document.querySelectorAll('.tilt-3d').forEach(bindTilt);
  // expose for dynamically created cards
  window.__bindTilt = bindTilt;
})();

// ── 6. HERO ANIMATION (called after loader) ───────────────────────
function initHeroAnimation() {
  if (window._animateNavbar) window._animateNavbar();

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.to('.hero-bg-img', { scale: 1.0, duration: 3, ease: 'power1.out' }, 0)
    .to('.hero-eyebrow', { opacity: 1, y: 0, duration: 0.9 }, 0.4)
    .fromTo('.hero-title .line',
      { opacity: 0, y: 60, rotationX: -55, transformOrigin: '50% 100% -30px' },
      { opacity: 1, y: 0, rotationX: 0, duration: 1.25, stagger: 0.2, ease: 'power4.out' }, 0.7)
    .to('.hero-sub', { opacity: 1, y: 0, duration: 0.8 }, 1.35)
    .to('.hero-divider', { opacity: 1, width: 80, duration: 0.9 }, 1.6)
    .to('.hero-cta', { opacity: 1, y: 0, duration: 0.8 }, 1.9)
    .to('.hero-search-wrap', { opacity: 1, y: 0, duration: 1 }, 2.05)
    .to('.hero-scroll-hint', { opacity: 1, duration: 0.6 }, 2.35)
    .to('.hero-stats', { opacity: 1, duration: 0.8 }, 2.1);

  setTimeout(() => {
    document.querySelectorAll('.stat-num[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      gsap.to({ val: 0 }, {
        val: target,
        duration: 2.5,
        ease: 'power2.out',
        delay: 0.5,
        onUpdate: function() {
          el.textContent = Math.round(this.targets()[0].val);
        }
      });
    });
  }, 1800);
}

// ── 7. REGISTER GSAP PLUGINS ──────────────────────────────────────
if (typeof gsap !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
  if (typeof TextPlugin !== 'undefined') gsap.registerPlugin(TextPlugin);
}

// ── 8. SCROLL ANIMATIONS ──────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (PREFERS_REDUCED_MOTION) return;

  gsap.utils.toArray('.section-header').forEach(header => {
    gsap.fromTo(header,
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
        scrollTrigger: { trigger: header, start: 'top 80%', once: true } }
    );
  });

  // Destination cards rise with 3D unfold
  gsap.utils.toArray('.dest-card').forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, y: 70, rotationX: -10, transformPerspective: 1200 },
      { opacity: 1, y: 0, rotationX: 0,
        duration: 1,
        delay: (i % 3) * 0.12,
        ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 88%', once: true },
        clearProps: 'transform' }
    );
  });

  gsap.utils.toArray('.accom-summary-card').forEach((card, i) => {
    gsap.fromTo(card,
      { opacity: 0, y: 34 },
      { opacity: 1, y: 0, duration: 0.8, delay: i * 0.08, ease: 'power3.out',
        scrollTrigger: { trigger: card, start: 'top 92%', once: true } }
    );
  });

  gsap.utils.toArray('.gallery-item').forEach((item, i) => {
    gsap.fromTo(item,
      { opacity: 0, scale: 0.92 },
      { opacity: 1, scale: 1, duration: 0.9, delay: (i % 4) * 0.09, ease: 'power3.out',
        scrollTrigger: { trigger: item, start: 'top 90%', once: true },
        clearProps: 'transform' }
    );
  });

  gsap.utils.toArray('.faq-item').forEach((item, i) => {
    gsap.fromTo(item,
      { opacity: 0, x: -28 },
      { opacity: 1, x: 0, duration: 0.7, delay: i * 0.06, ease: 'power3.out',
        scrollTrigger: { trigger: item, start: 'top 92%', once: true } }
    );
  });

  gsap.utils.toArray('.exp-item').forEach((item, i) => {
    gsap.fromTo(item,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.7, delay: i * 0.07, ease: 'power3.out',
        scrollTrigger: { trigger: item, start: 'top 94%', once: true } }
    );
  });

  const aboutVisual = document.querySelector('.about-visual');
  if (aboutVisual) {
    gsap.fromTo('.about-img--back', { y: 46 }, {
      y: -30, ease: 'none',
      scrollTrigger: { trigger: aboutVisual, start: 'top bottom', end: 'bottom top', scrub: 1.1 }
    });
    gsap.fromTo('.about-img--front', { y: 26 }, {
      y: -56, ease: 'none',
      scrollTrigger: { trigger: aboutVisual, start: 'top bottom', end: 'bottom top', scrub: 0.8 }
    });
  }

  // Booking bg parallax
  const bookingBg = document.querySelector('.booking-bg img');
  if (bookingBg) {
    gsap.fromTo(bookingBg, { yPercent: -8 }, {
      yPercent: 8, ease: 'none',
      scrollTrigger: { trigger: '#booking', start: 'top bottom', end: 'bottom top', scrub: 1.2 }
    });
  }

  // Footer reveal
  gsap.fromTo('#footer .footer-top',
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '#footer', start: 'top 90%', once: true } }
  );
});

// ── 9. ACCOMMODATION DATA + CARD GRID + MAP + DETAILS ─────────────
(function initAccommodations() {
  const accommodations = [
    {
      id: 'hotel-gorj',
      name: 'Hotel Gorj',
      type: 'Hotel',
      region: 'Târgu Jiu',
      short: 'Hotel confortabil în centrul orașului, lângă operele lui Brâncuși.',
      description: 'Hotel Gorj este alegerea ideală pentru vizite culturale în Târgu Jiu, cu camere moderne, mic dejun inclus și acces rapid la principalele atracții din județul Gorj.',
      price: 120,
      rating: 4.0,
      amenities: ['Mic dejun inclus', 'WiFi gratuit', 'Parcare', 'Recepție 24h'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Hotel+Gorj+Targu+Jiu+Gorj+Romania',
      googleQuery: 'Hotel+Gorj+Targu+Jiu+Gorj+Romania',
      images: ['images/coloana.jpg'],
      position: { left: '52%', top: '62%' },
      distanceFromPrevious: '0 km (prima locație)',
      previous: 'Prima cazare din listă'
    },
    {
      id: 'hotel-central',
      name: 'Hotel Central Târgu Jiu',
      type: 'Hotel',
      region: 'Târgu Jiu',
      short: 'Hotel modern în inima orașului, ideal pentru city break-uri.',
      description: 'Hotel Central oferă camere elegante, restaurant cu specific local și o poziție centrală foarte bună pentru explorarea orașului și a obiectivelor turistice din Gorj.',
      price: 105,
      rating: 4.0,
      amenities: ['Camere moderne', 'Mic dejun', 'WiFi', 'Room service'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Hotel+Central+Targu+Jiu+Gorj+Romania',
      googleQuery: 'Hotel+Central+Targu+Jiu+Gorj+Romania',
      images: ['images/coloana.jpg'],
      position: { left: '54%', top: '65%' },
      distanceFromPrevious: '2 km / 6 min',
      previous: 'Hotel Gorj'
    },
    {
      id: 'casa-gorjeana',
      name: 'Casa Gorjeană',
      type: 'Pensiune',
      region: 'Târgu Jiu',
      short: 'Pensiune boutique cu atmosferă autentică oltenească.',
      description: 'Casa Gorjeană combină ospitalitatea locală cu facilități confortabile și este o opțiune excelentă pentru cine caută o experiență autentică de cazare în Gorj.',
      price: 90,
      rating: 4.2,
      amenities: ['Terasă', 'WiFi', 'Mic dejun tradițional', 'Grădină'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Casa+Gorjeana+Targu+Jiu+Gorj+Romania',
      googleQuery: 'Casa+Gorjeana+Targu+Jiu+Gorj+Romania',
      images: ['images/casa-gorjeana.jpg'],
      position: { left: '51%', top: '67%' },
      distanceFromPrevious: '1.5 km / 5 min',
      previous: 'Hotel Central Târgu Jiu'
    },
    {
      id: 'vila-ozon-ranca',
      name: 'Vila Ozon Rânca',
      type: 'Vilă',
      region: 'Rânca',
      short: 'Vila de munte cu camere moderne și vedere către vârfuri.',
      description: 'Vila Ozon Rânca este foarte apreciată de iubitorii de munte, cu camere confortabile, acces rapid la pârtii și o ambianță prietenoasă.',
      price: 70,
      rating: 4.1,
      amenities: ['WiFi', 'Mic dejun', 'Parcare', 'Saună'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Vila+Ozon+Ranca+Romania',
      googleQuery: 'Vila+Ozon+Ranca+Romania',
      images: ['images/thumbs/vila-ozon-ranca.jpg', 'images/ranca.jpg'],
      thumb: 'images/ranca.jpg',
      position: { left: '60%', top: '38%' },
      distanceFromPrevious: '32 km / 44 min',
      previous: 'Casa Gorjeană'
    },
    {
      id: 'pensiunea-alpin',
      name: 'Pensiunea Alpin',
      type: 'Pensiune',
      region: 'Rânca',
      short: 'Spațiu confortabil cu note elegante, aproape de pârtii.',
      description: 'Pensiunea Alpin oferă camere moderne, atmosferă caldă și acces ușor la principalele puncte de interes din Rânca.',
      price: 82,
      rating: 4.3,
      amenities: ['Mic dejun', 'WiFi', 'Grădină', 'Șemineu'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Pensiunea+Alpin+Ranca+Romania',
      googleQuery: 'Pensiunea+Alpin+Ranca+Romania',
      images: ['images/thumbs/pensiunea-alpin.jpg', 'images/hero-dusk.jpg'],
      thumb: 'images/hero-dusk.jpg',
      position: { left: '58%', top: '34%' },
      distanceFromPrevious: '4 km / 9 min',
      previous: 'Vila Ozon Rânca'
    },
    {
      id: 'pensiunea-antonia',
      name: 'Pensiunea Antonia Spa',
      type: 'Pensiune',
      region: 'Rânca',
      short: 'Spa modern și panoramă 180° către Munții Parâng.',
      description: 'Pensiunea Antonia Spa oferă facilități wellness, camere spațioase și o priveliște impresionantă, potrivită pentru relaxare după drumeții.',
      price: 115,
      rating: 4.8,
      amenities: ['Spa', 'Jacuzzi', 'WiFi', 'Terasă'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Pensiunea+Antonia+Spa+Ranca+Romania',
      googleQuery: 'Pensiunea+Antonia+Spa+Ranca+Romania',
      images: ['images/thumbs/pensiunea-antonia.jpg', 'images/hero-dusk.jpg'],
      thumb: 'images/hero-dusk.jpg',
      position: { left: '62%', top: '30%' },
      distanceFromPrevious: '6 km / 12 min',
      previous: 'Pensiunea Alpin'
    },
    {
      id: 'cabana-terra',
      name: 'Cabana Terra',
      type: 'Cabană',
      region: 'Rânca',
      short: 'Cabana cu restaurant și mâncare tradițională, aproape de natură.',
      description: 'Cabana Terra este recunoscută pentru ospitalitatea locală și restaurantul său, oferind camere calde și un ambient relaxant după o zi de drumeții.',
      price: 95,
      rating: 4.4,
      amenities: ['Restaurant', 'WiFi', 'Parcare', 'Spațiu evenimente'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Cabana+Terra+Ranca+Romania',
      googleQuery: 'Cabana+Terra+Ranca+Romania',
      images: ['images/thumbs/cabana-terra.jpg', 'images/ranca.jpg'],
      thumb: 'images/ranca.jpg',
      position: { left: '61%', top: '37%' },
      distanceFromPrevious: '2.5 km / 7 min',
      previous: 'Pensiunea Antonia Spa'
    },
    {
      id: 'pensiunea-tismana',
      name: 'Tismana Forest Retreat',
      type: 'Pensiune',
      region: 'Tismana',
      short: 'Retreat eco și wellness în pădurea de lângă Mănăstirea Tismana.',
      description: 'Această pensiune eco este o enclavă liniștită în pădure, perfectă pentru relaxare și pentru cei care vor să exploreze zona istorică a Tismanei.',
      price: 98,
      rating: 4.6,
      amenities: ['Natură', 'WiFi', 'Mic dejun tradițional', 'Povești locale'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Pensiunea+Tismana+Romania',
      googleQuery: 'Pensiunea+Tismana+Romania',
      images: ['images/tismana-retreat.jpg', 'images/tismana.jpg'],
      thumb: 'images/tismana-retreat.jpg',
      position: { left: '24%', top: '46%' },
      distanceFromPrevious: '76 km / 1h 30 min',
      previous: 'Cabana Terra'
    },
    {
      id: 'taverna-olteanului',
      name: 'Taverna Olteanului',
      type: 'Pensiune',
      region: 'Baia de Fier',
      short: 'Pensiune cu restaurant tradițional, ideală pentru grupuri.',
      description: 'Taverna Olteanului este apreciată pentru restaurantul său tradițional și cazarea confortabilă, cu acces rapid la Peștera Muierilor și Cheile Sohodolului.',
      price: 85,
      rating: 4.3,
      amenities: ['Restaurant tradițional', 'Parcare', 'WiFi', 'Camere spațioase'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Taverna+Olteanului+Baia+de+Fier+Romania',
      googleQuery: 'Taverna+Olteanului+Baia+de+Fier+Romania',
      images: ['images/thumbs/taverna-olteanului.jpg', 'images/pestera.jpg'],
      thumb: 'images/pestera.jpg',
      position: { left: '64%', top: '50%' },
      distanceFromPrevious: '29 km / 35 min',
      previous: 'Tismana Forest Retreat'
    },
    {
      id: 'vila-alpina',
      name: 'Vila Alpina Transalpina',
      type: 'Vilă',
      region: 'Transalpina',
      short: 'Vila privată de munte cu șemineu și panoramă către Transalpina.',
      description: 'Vila Alpina este o opțiune premium pentru cei care doresc o experiență exclusivă la munte, aproape de șoseaua Transalpina și de natură.',
      price: 180,
      rating: 4.9,
      amenities: ['Șemineu', 'Jacuzzi', 'WiFi', 'Grătar', 'Vedere spre munte'],
      googleUrl: 'https://www.google.com/maps/search/?api=1&query=Vila+Alpina+Transalpina+Romania',
      googleQuery: 'Vila+Alpina+Transalpina+Romania',
      images: ['images/villa-alpina.webp', 'images/transalpina.jpg'],
      thumb: 'images/villa-alpina.webp',
      position: { left: '74%', top: '28%' },
      distanceFromPrevious: '18 km / 28 min',
      previous: 'Taverna Olteanului',
      roomTypes: [
        { id: 'standard', name: 'Standard', price: 180, capacity: 2 },
        { id: 'deluxe', name: 'Deluxe', price: 230, capacity: 4 }
      ]
    }
  ];

  // Expose globally (reservations renderer + booking form need it)
  window.GORJ_ACCOMMODATIONS = accommodations;

  const cardsGrid = document.getElementById('accom-cards-grid');
  const emptyState = document.getElementById('accom-empty-state');
  const resultsCount = document.getElementById('accom-results-count');
  const listContainer = document.getElementById('accom-locations');
  const mapFrame = document.getElementById('accom-map-frame');
  const detailPanel = document.getElementById('accom-detail-panel');
  const detailTitle = document.getElementById('accom-detail-title');
  const detailText = document.getElementById('accom-detail-text');
  const detailMeta = document.getElementById('accom-detail-meta');
  const detailDist = document.getElementById('accom-detail-dist');
  const detailGallery = document.getElementById('accom-detail-gallery');
  const detailGoogle = document.getElementById('accom-detail-google');
  const detailBook = document.getElementById('accom-detail-book');
  const mapFrameIframe = document.getElementById('google-map-frame');
  const detailClose = document.getElementById('accom-detail-close');
  const detailCloseBtn = document.getElementById('accom-detail-closebtn');

  if (!cardsGrid || !listContainer || !mapFrame || !detailPanel) return;

  let currentDetailId = null;

  function starLabel(rating) {
    return rating.toFixed(1).replace('.', ',') + ' ★';
  }

  function cardImage(loc) {
    return loc.thumb || loc.images[0];
  }

  // — Primary booking card
  function makeAccomCard(loc) {
    const card = document.createElement('article');
    card.className = 'accom-card tilt-3d';
    card.dataset.id = loc.id;
    card.dataset.region = loc.region;
    card.dataset.type = loc.type;
    card.dataset.tiltMax = '5';
    card.innerHTML = `
      <div class="accom-card-media">
        <img src="${cardImage(loc)}" alt="${loc.name}" loading="lazy" />
        <span class="accom-card-type">${loc.type}</span>
        <span class="accom-card-rating">${starLabel(loc.rating)}</span>
      </div>
      <div class="accom-card-body">
        <span class="accom-card-region">${loc.region}</span>
        <h3 class="accom-card-name">${loc.name}</h3>
        <p class="accom-card-short">${loc.short}</p>
        <div class="accom-card-amenities">
          ${loc.amenities.slice(0, 3).map(a => `<span class="accom-amenity">${a}</span>`).join('')}
        </div>
        <div class="accom-card-foot">
          <div class="accom-card-price">
            <span class="accom-card-price-num">€${loc.price}</span>
            <span class="accom-card-price-label">pe noapte</span>
          </div>
          <button type="button" class="accom-card-book">Rezervă</button>
        </div>
      </div>
      <div class="tilt-glare"></div>
    `;
    card.addEventListener('click', () => openLocation(loc.id));
    card.querySelector('.accom-card-book').addEventListener('click', e => {
      e.stopPropagation();
      window.__openBookingFor && window.__openBookingFor(loc.id);
    });
    if (window.__bindTilt) window.__bindTilt(card);
    return card;
  }

  // — Compact list card next to the map
  function makeListCard(loc) {
    const card = document.createElement('article');
    card.className = 'location-card';
    card.dataset.id = loc.id;
    card.innerHTML = `
      <div class="location-card-main">
        <span class="location-card-region">${loc.region} · ${loc.type}</span>
        <h3 class="location-card-title">${loc.name}</h3>
        <div class="location-card-meta">
          <span>${starLabel(loc.rating)}</span>
          <span>·</span>
          <span>€${loc.price} / noapte</span>
        </div>
        <div class="location-card-actions">
          <button type="button" class="btn-primary location-reserve"><span>Rezervă</span></button>
        </div>
      </div>
      <div class="location-card-hover">${loc.short}</div>
    `;
    card.addEventListener('click', () => openLocation(loc.id));
    card.querySelector('.location-reserve').addEventListener('click', e => {
      e.stopPropagation();
      window.__openBookingFor && window.__openBookingFor(loc.id);
    });
    return card;
  }

  function makePin(loc) {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'accom-map-pin';
    pin.dataset.id = loc.id;
    pin.title = loc.name;
    pin.setAttribute('aria-label', loc.name);
    pin.style.left = loc.position.left;
    pin.style.top = loc.position.top;
    pin.addEventListener('click', () => openLocation(loc.id));
    return pin;
  }

  function highlightSelection(id) {
    document.querySelectorAll('.accom-map-pin').forEach(p => p.classList.toggle('active', p.dataset.id === id));
    document.querySelectorAll('.location-card').forEach(c => c.classList.toggle('active', c.dataset.id === id));
  }

  function openLocation(id) {
    const loc = accommodations.find(item => item.id === id);
    if (!loc) return;
    currentDetailId = id;

    detailTitle.textContent = loc.name;
    detailText.textContent = loc.description;
    detailMeta.innerHTML = `
      <strong>Regiune:</strong> ${loc.region} · <strong>Tip:</strong> ${loc.type} · <strong>Preț:</strong> €${loc.price} / noapte<br>
      <strong>Rating:</strong> ${starLabel(loc.rating)} · <strong>Facilități:</strong> ${loc.amenities.join(' · ')}
    `;
    detailDist.innerHTML = `
      <strong>Distanță față de locația precedentă:</strong> ${loc.distanceFromPrevious}<br>
      <strong>Locația precedentă:</strong> ${loc.previous}
    `;
    detailGoogle.href = loc.googleUrl;
    if (mapFrameIframe) {
      mapFrameIframe.src = `https://www.google.com/maps?q=${encodeURIComponent(loc.googleQuery)}&output=embed`;
    }

    detailGallery.innerHTML = '';
    loc.images.forEach(src => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = loc.name;
      img.loading = 'lazy';
      detailGallery.appendChild(img);
    });

    highlightSelection(id);
    detailPanel.classList.remove('hidden');
    if (!PREFERS_REDUCED_MOTION) {
      gsap.fromTo(detailPanel, { opacity: 0, y: 34 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' });
    }
    detailPanel.scrollIntoView({ behavior: PREFERS_REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
  }

  function closeDetails() {
    detailPanel.classList.add('hidden');
    currentDetailId = null;
    highlightSelection(null);
  }

  detailBook?.addEventListener('click', () => {
    if (currentDetailId && window.__openBookingFor) window.__openBookingFor(currentDetailId);
  });

  // — Build all three views
  accommodations.forEach(loc => {
    cardsGrid.appendChild(makeAccomCard(loc));
    listContainer.appendChild(makeListCard(loc));
    mapFrame.appendChild(makePin(loc));
  });

  // — Filtering + sorting
  const state = { region: 'all', type: 'all', sort: 'recommended' };
  const regionChips = document.querySelectorAll('[data-filter-region]');
  const typeSelect = document.getElementById('accom-filter-type');
  const sortSelect = document.getElementById('accom-sort');
  const resetBtn = document.getElementById('accom-reset-filters');

  function applyFilters() {
    let visible = 0;
    const cards = Array.from(cardsGrid.querySelectorAll('.accom-card'));

    // sort — reorder DOM
    const sorted = cards.slice().sort((a, b) => {
      const la = accommodations.find(x => x.id === a.dataset.id);
      const lb = accommodations.find(x => x.id === b.dataset.id);
      switch (state.sort) {
        case 'price-asc':  return la.price - lb.price;
        case 'price-desc': return lb.price - la.price;
        case 'rating-desc': return lb.rating - la.rating;
        default: return accommodations.indexOf(la) - accommodations.indexOf(lb);
      }
    });
    sorted.forEach(c => cardsGrid.appendChild(c));

    sorted.forEach(card => {
      const okRegion = state.region === 'all' || card.dataset.region === state.region;
      const okType = state.type === 'all' || card.dataset.type === state.type;
      const show = okRegion && okType;
      card.classList.toggle('filtering-out', !show);
      // fully remove from layout after transition so the grid re-flows
      if (show) { card.style.display = ''; visible++; }
      else { setTimeout(() => { if (card.classList.contains('filtering-out')) card.style.display = 'none'; }, 380); }
    });

    if (resultsCount) {
      resultsCount.textContent = visible === 1 ? '1 cazare găsită' : `${visible} cazări găsite`;
    }
    if (emptyState) emptyState.classList.toggle('hidden', visible > 0);
  }

  regionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      regionChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.region = chip.dataset.filterRegion;
      applyFilters();
    });
  });

  typeSelect?.addEventListener('change', () => { state.type = typeSelect.value; applyFilters(); });
  sortSelect?.addEventListener('change', () => { state.sort = sortSelect.value; applyFilters(); });

  resetBtn?.addEventListener('click', () => {
    state.region = 'all'; state.type = 'all'; state.sort = 'recommended';
    regionChips.forEach(c => c.classList.toggle('active', c.dataset.filterRegion === 'all'));
    if (typeSelect) typeSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'recommended';
    applyFilters();
  });

  applyFilters();

  // Hero search → filter accommodations by destination and prefill booking dates
  const heroSearchForm = document.getElementById('hero-search-form');
  heroSearchForm?.addEventListener('submit', e => {
    e.preventDefault();
    const dest = document.getElementById('search-destination')?.value || '';
    const checkin = document.getElementById('search-checkin')?.value || '';
    const checkout = document.getElementById('search-checkout')?.value || '';
    const guests = document.getElementById('search-guests')?.value || '2';

    state.region = dest || 'all';
    regionChips.forEach(c => c.classList.toggle('active', c.dataset.filterRegion === state.region));
    applyFilters();

    // Prefill booking form
    const ci = document.getElementById('checkin');
    const co = document.getElementById('checkout');
    const g = document.getElementById('guests');
    if (ci && checkin) { ci.value = checkin; ci.dispatchEvent(new Event('change', { bubbles: true })); }
    if (co && checkout) { co.value = checkout; co.dispatchEvent(new Event('change', { bubbles: true })); }
    if (g && guests) g.value = guests;

    document.getElementById('accommodations')?.scrollIntoView({ behavior: PREFERS_REDUCED_MOTION ? 'auto' : 'smooth' });
  });

  detailClose?.addEventListener('click', closeDetails);
  detailCloseBtn?.addEventListener('click', closeDetails);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !detailPanel.classList.contains('hidden')) closeDetails();
  });
})();

// ── 10. BOOKING FORM + AUTH + PRICING ─────────────────────────────
(function initBookingAndAuth() {
  const form    = document.getElementById('booking-form');
  const success = document.getElementById('form-success');
  const submitBtn = document.getElementById('booking-submit-btn');
  if (!form || !success) return;

  const accommodations = window.GORJ_ACCOMMODATIONS || [];

  // — Date minimums
  const today = new Date().toISOString().split('T')[0];
  const checkin  = document.getElementById('checkin');
  const checkout = document.getElementById('checkout');
  if (checkin)  checkin.min  = today;
  if (checkout) checkout.min = today;
  checkin?.addEventListener('change', () => { if (checkout) checkout.min = checkin.value; });

  const searchCheckin = document.getElementById('search-checkin');
  const searchCheckout = document.getElementById('search-checkout');
  if (searchCheckin) searchCheckin.min = today;
  if (searchCheckout) searchCheckout.min = today;
  searchCheckin?.addEventListener('change', () => { if (searchCheckout) searchCheckout.min = searchCheckin.value; });

  // — Auth plumbing (backend API with localStorage fallback, same contract as v1)
  const API_BASE = '';
  const tokenKey = 'gorjBookingToken';
  const authModal = document.getElementById('auth-modal');
  const authModalClose = document.getElementById('auth-modal-close');
  const modalLoginForm = document.getElementById('modal-login-form');
  const modalRegisterForm = document.getElementById('modal-register-form');
  const modalAuthTabs = document.querySelectorAll('#auth-modal .account-tab');
  const accountPanel = document.getElementById('account-panel');
  const accountName = document.getElementById('account-name');
  const reservationList = document.getElementById('reservation-list');
  const reservationCount = document.getElementById('account-reservation-count');
  const guestNote = document.getElementById('guest-note');
  const accountButton = document.getElementById('account-button');
  const accountWidgetWrapper = document.getElementById('account-widget-wrapper');
  const logoutBtn = document.getElementById('logout-btn');
  const bookingEmail = document.getElementById('email');
  const GUIDE_FEE = 30;
  const guideOptionInputs = document.querySelectorAll('input[name="guide-option"]');
  const accomSelect = document.getElementById('accommodation');
  const roomTypeWrap = document.getElementById('room-type-wrap');
  const roomTypeSelect = document.getElementById('room-type');
  const totalWrap = document.getElementById('total-wrap');
  const guestsEl = document.getElementById('guests');

  function getToken() { return localStorage.getItem(tokenKey); }
  function setToken(token) { localStorage.setItem(tokenKey, token); }
  function clearToken() { localStorage.removeItem(tokenKey); }

  function showAuthModal() {
    if (!authModal) return;
    authModal.classList.remove('hidden');
    authModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (!PREFERS_REDUCED_MOTION) {
      gsap.fromTo('.auth-modal-content', { opacity: 0, y: 30, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' });
    }
  }

  function hideAuthModal() {
    if (!authModal) return;
    authModal.classList.add('hidden');
    authModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  authModalClose?.addEventListener('click', hideAuthModal);
  authModal?.querySelector('.auth-modal-overlay')?.addEventListener('click', hideAuthModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && authModal && !authModal.classList.contains('hidden')) hideAuthModal();
  });

  async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin', ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw data;
    return data;
  }

  function stableTokenForEmail(email) {
    return 'local-' + email.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  }

  async function fetchProfile() {
    const token = getToken();
    if (!token) return null;
    const profiles = JSON.parse(localStorage.getItem('gorjLocalProfiles') || '{}');
    if (profiles[token]) return { user: profiles[token] };
    try {
      return await apiFetch('/api/profile');
    } catch (error) {
      clearToken();
      return null;
    }
  }

  async function fetchReservations() {
    const token = getToken();
    const bookings = JSON.parse(localStorage.getItem('gorjLocalBookings') || '[]');
    const userBookings = bookings.filter(b => b.ownerToken === token);
    if (userBookings.length) return userBookings;
    try {
      const result = await apiFetch('/api/bookings');
      return result.bookings || [];
    } catch (error) {
      return userBookings;
    }
  }

  async function loginUser(email, password) {
    const users = JSON.parse(localStorage.getItem('gorjLocalUsers') || '[]');
    const user = users.find(u => u.email === email);
    if (!user) {
      try {
        return await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      } catch (err) {
        throw { error: 'Utilizator inexistent. Creează un cont.' };
      }
    }
    if (user.password !== password) throw { error: 'Parolă incorectă.' };
    const token = stableTokenForEmail(email);
    const profiles = JSON.parse(localStorage.getItem('gorjLocalProfiles') || '{}');
    profiles[token] = { name: user.name, email: user.email };
    localStorage.setItem('gorjLocalProfiles', JSON.stringify(profiles));
    return { token, user: { name: user.name, email: user.email } };
  }

  async function registerUser(name, email, password) {
    const users = JSON.parse(localStorage.getItem('gorjLocalUsers') || '[]');
    if (users.find(u => u.email === email)) throw { error: 'Email deja folosit.' };
    // Also try backend registration (best effort)
    try {
      const res = await apiFetch('/api/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      if (res?.token) {
        return res;
      }
    } catch (e) { /* offline mode — continue with local */ }
    users.push({ name, email, password });
    localStorage.setItem('gorjLocalUsers', JSON.stringify(users));
    const token = stableTokenForEmail(email);
    const profiles = JSON.parse(localStorage.getItem('gorjLocalProfiles') || '{}');
    profiles[token] = { name, email };
    localStorage.setItem('gorjLocalProfiles', JSON.stringify(profiles));
    return { token, user: { name, email } };
  }

  async function createBooking(bookingData) {
    const token = getToken();
    const item = Object.assign({}, bookingData, {
      createdAt: new Date().toISOString(),
      id: 'local-booking-' + Date.now(),
      ownerToken: token || null
    });
    const key = 'gorjLocalBookings';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(item);
    localStorage.setItem(key, JSON.stringify(existing));
    // Best-effort mirror to backend
    try {
      await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(bookingData) });
    } catch (e) { /* local-only mode */ }
    try {
      renderReservations(existing.filter(b => b.ownerToken === (token || null)));
    } catch (e) { /* ignore */ }
    return { ok: true, booking: item };
  }

  // — Pricing
  function updatePriceAndTotal() {
    const pricePerNightLabel = document.getElementById('price-per-night');
    const nightsCountLabel = document.getElementById('nights-count');
    const totalPriceLabel = document.getElementById('total-price');
    const summaryBasePrice = document.getElementById('summary-base-price');
    const summaryGuidePrice = document.getElementById('summary-guide-price');
    const summaryTotalPrice = document.getElementById('summary-total-price');
    const priceBreakdown = document.getElementById('price-breakdown');
    const guideNoteEl = document.getElementById('guide-note');
    const accomId = accomSelect?.value;
    const roomId = roomTypeSelect?.value;
    const loc = accommodations.find(a => a.id === accomId);
    const guideSelected = document.querySelector('input[name="guide-option"]:checked')?.value === 'on';

    function setGuideTexts() {
      if (summaryGuidePrice) summaryGuidePrice.textContent = guideSelected ? `€${GUIDE_FEE}` : '€0';
      if (guideNoteEl) guideNoteEl.textContent = guideSelected
        ? `Ghid local inclus: +€${GUIDE_FEE} / rezervare.`
        : `Adaugă ghid local pentru +€${GUIDE_FEE} / rezervare.`;
    }

    if (!accomId || !loc) {
      if (pricePerNightLabel) pricePerNightLabel.textContent = 'Preț: -';
      if (nightsCountLabel) nightsCountLabel.textContent = 'Nopți: -';
      if (totalPriceLabel) totalPriceLabel.textContent = '-';
      if (summaryBasePrice) summaryBasePrice.textContent = '-';
      if (summaryTotalPrice) summaryTotalPrice.textContent = '-';
      if (priceBreakdown) priceBreakdown.textContent = 'Alege o cazare pentru a vedea totalul.';
      setGuideTexts();
      return;
    }

    const hasRoomTypes = Array.isArray(loc.roomTypes) && loc.roomTypes.length > 0;
    if (hasRoomTypes && !roomId) {
      if (priceBreakdown) priceBreakdown.textContent = 'Selectează tipul camerei pentru a vedea totalul.';
      setGuideTexts();
      return;
    }

    const room = hasRoomTypes ? loc.roomTypes.find(r => r.id === roomId) : null;
    const price = room ? Number(room.price) : Number(loc.price) || 0;
    const guideFee = guideSelected ? GUIDE_FEE : 0;

    let nights = 1;
    if (checkin?.value && checkout?.value) {
      const ms = new Date(checkout.value) - new Date(checkin.value);
      nights = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
    }

    const baseTotal = price * nights;
    const total = baseTotal + guideFee;

    if (pricePerNightLabel) pricePerNightLabel.textContent = `Preț: €${price} / noapte`;
    if (nightsCountLabel) nightsCountLabel.textContent = `Nopți: ${nights}`;
    if (totalPriceLabel) totalPriceLabel.textContent = `€${total.toFixed(2)}`;
    if (summaryBasePrice) summaryBasePrice.textContent = `€${baseTotal.toFixed(2)}`;
    if (summaryTotalPrice) {
      const prev = summaryTotalPrice.textContent;
      summaryTotalPrice.textContent = `€${total.toFixed(2)}`;
      if (prev !== summaryTotalPrice.textContent && !PREFERS_REDUCED_MOTION) {
        summaryTotalPrice.classList.add('price-bump');
        setTimeout(() => summaryTotalPrice.classList.remove('price-bump'), 260);
      }
    }
    if (priceBreakdown) priceBreakdown.textContent = `${guideSelected ? 'Cu ghid local' : 'Fără ghid'} · ${nights} ${nights === 1 ? 'noapte' : 'nopți'}`;
    setGuideTexts();
  }

  window.__refreshBookingPricing = updatePriceAndTotal;

  // — Populate accommodation select + room types
  if (accomSelect) {
    accommodations.forEach(loc => {
      const opt = document.createElement('option');
      opt.value = loc.id;
      opt.textContent = `${loc.name} — ${loc.region} (€${loc.price}/noapte)`;
      accomSelect.appendChild(opt);
    });

    accomSelect.addEventListener('change', () => {
      const loc = accommodations.find(a => a.id === accomSelect.value);
      if (!loc) return;
      roomTypeSelect.innerHTML = '';
      if (Array.isArray(loc.roomTypes) && loc.roomTypes.length) {
        loc.roomTypes.forEach(rt => {
          const o = document.createElement('option');
          o.value = rt.id;
          o.textContent = `${rt.name} — €${rt.price} / noapte (${rt.capacity} pers)`;
          roomTypeSelect.appendChild(o);
        });
        roomTypeWrap.style.display = '';
        roomTypeSelect.value = roomTypeSelect.options[0]?.value || '';
      } else {
        roomTypeSelect.value = '';
        roomTypeWrap.style.display = 'none';
      }
      totalWrap.style.display = '';
      updatePriceAndTotal();
    });
  }

  // — Open booking prefilled for a given accommodation id (used by cards, detail panel)
  window.__openBookingFor = function(id) {
    const bookingSection = document.getElementById('booking');
    if (accomSelect) {
      accomSelect.value = id;
      accomSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (form) { form.style.display = ''; }
    if (success) success.classList.remove('active');
    if (roomTypeSelect && roomTypeSelect.options.length) roomTypeSelect.selectedIndex = 0;
    updatePriceAndTotal();
    if (bookingSection) {
      setTimeout(() => {
        bookingSection.scrollIntoView({ behavior: PREFERS_REDUCED_MOTION ? 'auto' : 'smooth', block: 'start' });
        document.getElementById('fname')?.focus({ preventScroll: true });
      }, 120);
    }
  };

  // — Guide option
  guideOptionInputs.forEach(input => {
    input.addEventListener('change', updatePriceAndTotal);
  });

  // — Recalculate on any relevant change
  document.addEventListener('change', e => {
    if (['checkin', 'checkout', 'guests', 'room-type', 'accommodation'].includes(e.target?.id)) {
      updatePriceAndTotal();
    }
  });

  // — Auth UI
  function refreshAccountButton(profile) {
    if (!accountButton) return;
    accountButton.textContent = profile?.user ? profile.user.name : 'Cont';
  }

  accountButton?.addEventListener('click', async () => {
    const profile = await fetchProfile();
    if (profile?.user) {
      refreshAccountButton(profile);
      if (!accountWidgetWrapper) return;
      accountWidgetWrapper.classList.toggle('hidden');
      if (!accountWidgetWrapper.classList.contains('hidden')) {
        accountPanel?.classList.remove('hidden');
        if (!PREFERS_REDUCED_MOTION) {
          gsap.fromTo('.account-widget', { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
        }
      }
    } else {
      accountWidgetWrapper?.classList.add('hidden');
      showAuthModal();
    }
  });

  // Close account widget when clicking outside
  document.addEventListener('click', e => {
    if (!accountWidgetWrapper || accountWidgetWrapper.classList.contains('hidden')) return;
    if (e.target.closest('.account-widget-wrapper') || e.target.closest('#account-button')) return;
    accountWidgetWrapper.classList.add('hidden');
  });

  modalAuthTabs.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      modalAuthTabs.forEach(b => b.classList.toggle('active', b === button));
      modalLoginForm?.classList.toggle('hidden', tab !== 'modal-login');
      modalRegisterForm?.classList.toggle('hidden', tab !== 'modal-register');
    });
  });

  function showAuthError(message, field) {
    if (guestNote) guestNote.textContent = message;
    if (field) {
      gsap.to(field, {
        borderColor: '#e05a5a', duration: 0.3, yoyo: true, repeat: 1,
        onComplete: () => gsap.to(field, { borderColor: 'rgba(201,168,76,0.2)', duration: 0.3 })
      });
      gsap.fromTo(field, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
    }
  }

  modalLoginForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('modal-login-email')?.value.trim().toLowerCase();
    const password = document.getElementById('modal-login-password')?.value || '';
    if (!email || !password) return;
    try {
      const res = await loginUser(email, password);
      setToken(res.token);
      await updateAuthUI();
      hideAuthModal();
    } catch (err) {
      showAuthError(err?.error || 'Date incorecte. Verifică email-ul și parola.', document.getElementById('modal-login-email'));
    }
  });

  modalRegisterForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('modal-register-name')?.value.trim();
    const email = document.getElementById('modal-register-email')?.value.trim().toLowerCase();
    const password = document.getElementById('modal-register-password')?.value || '';
    const confirm = document.getElementById('modal-register-password-confirm')?.value || '';
    if (!name || !email || !password || !confirm) {
      return showAuthError('Completează toate câmpurile.', document.getElementById('modal-register-name'));
    }
    if (password !== confirm) {
      return showAuthError('Parolele nu coincid.', document.getElementById('modal-register-password'));
    }
    try {
      const res = await registerUser(name, email, password);
      setToken(res.token);
      await updateAuthUI();
      hideAuthModal();
    } catch (err) {
      showAuthError(err?.error || 'Nu s-a putut crea contul.', document.getElementById('modal-register-email'));
    }
  });

  function renderReservations(bookings) {
    if (!reservationList) return;
    reservationList.innerHTML = '';
    if (!bookings.length) {
      reservationList.innerHTML = '<p class="reservation-empty">Nu există rezervări salvate.</p>';
      return;
    }
    bookings.slice().reverse().forEach(item => {
      const card = document.createElement('div');
      card.className = 'reservation-card';
      const accomName = accommodations.find(a => a.id === item.accommodation)?.name || item.accommodation || 'Cazare';
      const guideLabel = item.guideIncluded ? `Cu ghid (+€${Number(item.guideFee || 0).toFixed(2)})` : 'Fără ghid';
      const totalLabel = item.totalPrice != null ? `€${Number(item.totalPrice).toFixed(2)}` : '-';
      card.innerHTML = `
        <h5>${accomName}</h5>
        <p><strong>Perioadă:</strong> ${item.checkin} – ${item.checkout}</p>
        <p><strong>Persoane:</strong> ${item.guests}</p>
        <p><strong>Ghid:</strong> ${guideLabel}</p>
        <p><strong>Total final:</strong> ${totalLabel}</p>
        <p><strong>Înregistrat:</strong> ${new Date(item.createdAt).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p>${item.message ? `Notă: ${item.message}` : 'Fără cerințe speciale.'}</p>
      `;
      reservationList.appendChild(card);
    });
  }

  async function updateAuthUI() {
    const profile = await fetchProfile();
    refreshAccountButton(profile);
    if (profile?.user) {
      try { hideAuthModal(); } catch (e) { }
      accountPanel?.classList.remove('hidden');
      if (accountName) accountName.textContent = profile.user.name;
      const bookings = await fetchReservations();
      if (reservationCount) reservationCount.textContent = bookings.length;
      renderReservations(bookings);
      if (submitBtn) submitBtn.disabled = false;
      form?.classList.remove('disabled');
      if (guestNote) guestNote.textContent = 'Rezervările tale vor fi salvate în profilul tău.';
      if (bookingEmail) { bookingEmail.value = profile.user.email; bookingEmail.disabled = true; }
      return;
    }

    accountPanel?.classList.add('hidden');
    accountWidgetWrapper?.classList.add('hidden');
    refreshAccountButton(null);
    if (submitBtn) submitBtn.disabled = false; // keep clickable — it prompts login
    form?.classList.add('disabled');
    if (guestNote) guestNote.textContent = 'Te poți autentifica sau înregistra pentru a salva rezervările în profilul tău.';
    if (bookingEmail) { bookingEmail.value = ''; bookingEmail.disabled = false; }
  }

  logoutBtn?.addEventListener('click', async () => {
    clearToken();
    await updateAuthUI();
  });

  updateAuthUI();

  // — Confetti on success
  function createConfetti() {
    if (PREFERS_REDUCED_MOTION) return;
    const colors = ['#C9A84C', '#E8C96A', '#8A6D28', '#FFFFFF'];
    const bookingSection = document.getElementById('booking');
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.className = 'confetti-piece';
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.top = '-10px';
      confetti.style.width = Math.random() * 8 + 4 + 'px';
      confetti.style.height = Math.random() * 8 + 4 + 'px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
      confetti.style.opacity = Math.random() * 0.7 + 0.3;
      bookingSection?.appendChild(confetti);

      gsap.to(confetti, {
        y: window.innerHeight + 20,
        x: Math.tan((Math.random() * 60 - 30) * Math.PI / 180) * window.innerHeight * 0.8,
        opacity: 0,
        rotation: Math.random() * 720 - 360,
        duration: Math.random() * 2 + 2.5,
        delay: Math.random() * 0.3,
        ease: 'none',
        onComplete: () => confetti.remove()
      });
    }
  }

  // — Submit
  async function handleBookingSubmit(e) {
    e?.preventDefault?.();

    const token = getToken();
    if (!token) {
      showAuthModal();
      if (guestNote) guestNote.textContent = 'Autentifică-te sau creează un cont pentru a trimite rezervarea.';
      return false;
    }

    let valid = true;
    let firstInvalid = null;
    form.querySelectorAll('[required]').forEach(field => {
      if (!field.value.trim()) {
        valid = false;
        firstInvalid = firstInvalid || field;
        gsap.to(field, {
          borderColor: '#e05a5a', duration: 0.3, yoyo: true, repeat: 1,
          onComplete: () => gsap.to(field, { borderColor: 'rgba(201,168,76,0.2)', duration: 0.3 })
        });
      }
    });

    if (!valid) {
      firstInvalid?.focus();
      if (guestNote) guestNote.textContent = 'Completează câmpurile obligatorii marcate.';
      return false;
    }

    // Date sanity
    if (checkin?.value && checkout?.value && new Date(checkout.value) <= new Date(checkin.value)) {
      if (guestNote) guestNote.textContent = 'Data de check-out trebuie să fie după check-in.';
      gsap.fromTo(checkout, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
      checkout.focus();
      return false;
    }

    const guideSelected = document.querySelector('input[name="guide-option"]:checked')?.value === 'on';
    const loc = accommodations.find(a => a.id === accomSelect?.value);
    const room = loc?.roomTypes?.find(r => r.id === roomTypeSelect?.value);
    const price = room ? room.price : (loc?.price || 0);
    let nights = 1;
    if (checkin?.value && checkout?.value) {
      nights = Math.max(1, Math.round((new Date(checkout.value) - new Date(checkin.value)) / 86400000));
    }
    const guideFee = guideSelected ? GUIDE_FEE : 0;

    const bookingData = {
      firstName: document.getElementById('fname')?.value.trim(),
      lastName: document.getElementById('lname')?.value.trim(),
      email: bookingEmail?.value.trim(),
      accommodation: accomSelect?.value,
      roomType: roomTypeSelect?.value || null,
      checkin: checkin?.value,
      checkout: checkout?.value,
      guests: guestsEl?.value,
      message: document.getElementById('message')?.value.trim(),
      guideIncluded: guideSelected,
      guideFee,
      totalPrice: price * nights + guideFee
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      const label = submitBtn.querySelector('.btn-submit-text');
      if (label) label.textContent = 'Se trimite…';
    }

    try {
      await createBooking(bookingData);
      form.style.display = 'none';
      success.classList.add('active');
      createConfetti();
      const bookings = await fetchReservations();
      if (reservationCount) reservationCount.textContent = bookings.length;
      renderReservations(bookings);
      // restore form after a while for a new booking
      setTimeout(() => {
        form.reset();
        form.style.display = '';
        success.classList.remove('active');
        if (accomSelect) accomSelect.selectedIndex = 0;
        roomTypeWrap.style.display = 'none';
        totalWrap.style.display = 'none';
        updatePriceAndTotal();
        updateAuthUI();
      }, 6000);
    } catch (err) {
      if (guestNote) guestNote.textContent = err?.error || 'Rezervarea nu a putut fi trimisă. Încearcă din nou.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        const label = submitBtn.querySelector('.btn-submit-text');
        if (label) label.textContent = 'Trimite Rezervarea';
      }
    }
    return false;
  }

  window.__submitBookingReservation = handleBookingSubmit;
  form.addEventListener('submit', handleBookingSubmit);

  updatePriceAndTotal();
})();

// ── 11. DESTINATION GUIDE +€30 TOGGLE ─────────────────────────────
(function initDestinationGuideOption() {
  document.querySelectorAll('.guide-btn').forEach(button => {
    const basePrice = Number(button.dataset.basePrice) || 0;
    const guidePrice = Number(button.dataset.guidePrice) || 30;
    const originalText = button.textContent.trim();

    button.addEventListener('click', event => {
      event.stopPropagation();
      const active = button.classList.toggle('active');
      const total = basePrice + (active ? guidePrice : 0);
      button.textContent = active ? `Ghid adăugat +€${guidePrice}` : originalText;

      const card = button.closest('.dest-card');
      if (!card) return;
      const meta = card.querySelector('.dest-meta');
      if (!meta) return;
      const priceLabel = meta.querySelector('.dest-price');
      if (priceLabel) {
        priceLabel.textContent = `de la €${total}`;
      } else {
        const span = document.createElement('span');
        span.className = 'dest-price';
        span.textContent = `de la €${total}`;
        meta.appendChild(span);
      }
    });
  });
})();

// ── 12. TESTIMONIALS — 3D COVERFLOW CAROUSEL ──────────────────────
(function initTestimonialCoverflow() {
  const track = document.getElementById('testimonial-track');
  const prev = document.getElementById('testimonial-prev');
  const next = document.getElementById('testimonial-next');
  const dotsBox = document.getElementById('testimonial-dots');
  if (!track) return;

  const cards = Array.from(track.querySelectorAll('.testimonial-card'));
  const total = cards.length;
  let active = 0;
  let autoTimer = null;

  // Build dots
  cards.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'testimonial-dot';
    dot.setAttribute('aria-label', `Recenzia ${i + 1}`);
    dot.addEventListener('click', () => goTo(i, true));
    dotsBox?.appendChild(dot);
  });

  function layout() {
    const dots = dotsBox?.querySelectorAll('.testimonial-dot') || [];
    cards.forEach((card, i) => {
      // Shortest signed distance on the circle
      let d = i - active;
      if (d > total / 2) d -= total;
      if (d < -total / 2) d += total;
      const abs = Math.abs(d);
      const x = d * 220;            // horizontal offset (px)
      const rotY = d * -22;          // side rotation
      const scale = 1 - abs * 0.11;
      const opacity = abs > 2 ? 0 : 1 - abs * 0.28;
      const z = -abs * 60;
      const zIndex = 20 - abs;
      const active_ = abs === 0;

      if (!PREFERS_REDUCED_MOTION) {
        gsap.to(card, {
          xPercent: -50,
          yPercent: -50,
          x: x,
          y: 0,
          rotationY: rotY,
          scale,
          opacity,
          z,
          duration: 0.75,
          ease: 'power3.out'
        });
      } else {
        gsap.set(card, { xPercent: -50, yPercent: -50 });
        card.style.opacity = active_ ? 1 : 0;
      }
      card.style.zIndex = String(zIndex);
      card.classList.toggle('is-active', active_);
      card.setAttribute('aria-hidden', active_ ? 'false' : 'true');
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === active));
  }

  function goTo(i, resetTimer) {
    active = ((i % total) + total) % total;
    layout();
    if (resetTimer) startAuto();
  }

  function startAuto() {
    clearInterval(autoTimer);
    if (PREFERS_REDUCED_MOTION) return;
    autoTimer = setInterval(() => goTo(active + 1), 6800);
  }

  prev?.addEventListener('click', () => goTo(active - 1, true));
  next?.addEventListener('click', () => goTo(active + 1, true));

  cards.forEach((card, i) => {
    card.addEventListener('click', () => {
      if (i !== active) goTo(i, true);
    });
  });

  // Keyboard navigation
  track.tabIndex = 0;
  track.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { goTo(active - 1, true); e.preventDefault(); }
    if (e.key === 'ArrowRight') { goTo(active + 1, true); e.preventDefault(); }
  });

  // Pause auto-rotate on hover / focus
  const coverflow = document.getElementById('testimonial-coverflow');
  coverflow?.addEventListener('mouseenter', () => clearInterval(autoTimer));
  coverflow?.addEventListener('mouseleave', startAuto);
  coverflow?.addEventListener('focusin', () => clearInterval(autoTimer));
  coverflow?.addEventListener('focusout', startAuto);

  // Basic swipe on touch
  let startX = null;
  track.addEventListener('touchstart', e => { startX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (startX == null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) goTo(active + (dx < 0 ? 1 : -1), true);
    startX = null;
  }, { passive: true });

  layout();
  startAuto();
})();

// ── 13. FAQ ACCORDION ─────────────────────────────────────────────
(function initFaq() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const btn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    if (!btn || !answer) return;

    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      // Close all others for a cleaner behavior
      items.forEach(other => {
        if (other !== item) {
          other.classList.remove('open');
          const otherAnswer = other.querySelector('.faq-answer');
          const otherBtn = other.querySelector('.faq-question');
          if (otherAnswer) otherAnswer.style.maxHeight = '';
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });

      if (isOpen) {
        item.classList.remove('open');
        answer.style.maxHeight = '';
        btn.setAttribute('aria-expanded', 'false');
      } else {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

// ── 14. GALLERY + IMAGE LIGHTBOX ──────────────────────────────────
(function initImageLightbox() {
  const modal = document.getElementById('image-modal');
  const modalImg = document.getElementById('image-modal-img');
  const modalCaption = document.getElementById('image-modal-caption');
  const closeBtn = document.getElementById('image-modal-close');
  if (!modal || !modalImg) return;

  function openModalFromImage(img, caption) {
    modalImg.src = img.currentSrc || img.src;
    modalImg.alt = img.alt || '';
    if (modalCaption) modalCaption.textContent = caption || img.alt || '';
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (!PREFERS_REDUCED_MOTION) {
      gsap.fromTo(modalImg, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, ease: 'power3.out' });
    }
  }

  function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Galleries + accommodation cards media
  document.querySelectorAll('.gallery-item').forEach(item => {
    const img = item.querySelector('img');
    if (!img) return;
    img.style.cursor = 'zoom-in';
    item.addEventListener('click', e => {
      e.preventDefault();
      openModalFromImage(img, item.dataset.caption);
    });
  });

  // Destination card images: open lightbox on click (but let button clicks pass through)
  document.querySelectorAll('.dest-card-img').forEach(img => {
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', e => {
      // Only open if clicking the image directly, not inside actions
      const card = img.closest('.dest-card');
      const name = card?.querySelector('.dest-name')?.textContent || img.alt;
      openModalFromImage(img, name);
      e.stopPropagation();
    });
  });

  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('active')) closeModal(); });
})();

// ── 15. STICKY BOOKING BAR + SCROLL-TOP ───────────────────────────
(function initStickyUI() {
  const bar = document.getElementById('sticky-booking-bar');
  const topBtn = document.getElementById('scroll-top-btn');
  const bookingSection = document.getElementById('booking');
  if (!bar && !topBtn) return;

  const hero = document.getElementById('hero');
  const heroHeight = hero ? hero.offsetHeight : 700;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;

    // Show sticky bar once past the hero, hide when the booking section is already visible
    if (bar) {
      const bookingRect = bookingSection?.getBoundingClientRect();
      const bookingVisible = bookingRect && bookingRect.top < window.innerHeight * 0.75 && bookingRect.bottom > 0;
      const shouldShow = y > heroHeight * 0.9 && !bookingVisible;
      bar.classList.toggle('visible', shouldShow);
    }

    // Scroll-top after 1.5 viewports
    if (topBtn) {
      topBtn.classList.toggle('visible', y > window.innerHeight * 1.2);
    }
  }, { passive: true });

  topBtn?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: PREFERS_REDUCED_MOTION ? 'auto' : 'smooth' });
  });
})();

// ── 16. NEWSLETTER FORM ───────────────────────────────────────────
(function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  const note = document.getElementById('newsletter-note');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]')?.value.trim();
    if (!email) return;
    if (note) note.textContent = 'Mulțumim! Verifică-ți inboxul pentru confirmare.';
    form.reset();
    if (!PREFERS_REDUCED_MOTION) {
      gsap.fromTo(note, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    }
    setTimeout(() => { if (note) note.textContent = ''; }, 5000);
  });
})();

// ── 17. SMOOTH ANCHOR SCROLL ──────────────────────────────────────
document.addEventListener('click', event => {
  const anchor = event.target.closest('a[href^="#"]');
  if (!anchor) return;
  const href = anchor.getAttribute('href');
  if (!href || href === '#') return;
  const target = document.querySelector(href);
  if (!target) return;
  event.preventDefault();
  const navbar = document.getElementById('navbar');
  const offset = navbar ? navbar.offsetHeight + 12 : 70;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: PREFERS_REDUCED_MOTION ? 'auto' : 'smooth' });
  history.replaceState(null, '', href);
});

// ── 18. ACTIVE NAV LINK HIGHLIGHTING ─────────────────────────────
(function initActiveNav() {
  const links = document.querySelectorAll('.nav-link[href^="#"]');
  const targets = Array.from(links).map(link => {
    const id = link.getAttribute('href').slice(1);
    return { link, section: document.getElementById(id) };
  }).filter(item => item.section);

  if (!targets.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        targets.forEach(({ link, section }) => {
          link.classList.toggle('active', section === entry.target);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

  targets.forEach(({ section }) => observer.observe(section));
})();

// ── 19. IMAGE FALLBACK ────────────────────────────────────────────
document.querySelectorAll('img').forEach(img => {
  img.addEventListener('error', function() {
    // Only apply fallback to local relative paths that failed
    if (!/^(https?:)?\/\//.test(this.src) && !this.dataset.fallbackApplied) {
      this.dataset.fallbackApplied = '1';
      this.src = 'images/hero-mountains.jpg';
    }
  });
});

// ── 20. HERO CLICK-TO-RIPPLE WATER ANIMATION ──────────────────────
(function initHeroRipple() {
  if (PREFERS_REDUCED_MOTION) return;
  const ready = fn => (document.readyState !== 'loading') ? fn() : document.addEventListener('DOMContentLoaded', fn);
  ready(() => {
    const hero = document.getElementById('hero');
    const canvas = document.getElementById('hero-ripple-canvas');
    if (!hero || !canvas) return;
    const ctx = canvas.getContext('2d');
    const ripples = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const rect = hero.getBoundingClientRect();
      canvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width  = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    function spawn(x, y) {
      const now = performance.now();
      for (let i = 0; i < 3; i++) {
        ripples.push({ x, y, t0: now + i * 120, life: 1400, max: 220 + i * 40 });
      }
    }

    hero.addEventListener('click', e => {
      // Ignore clicks on actual UI
      if (e.target.closest('a, button, input, select, textarea, label, .hero-search')) return;
      const rect = hero.getBoundingClientRect();
      spawn(e.clientX - rect.left, e.clientY - rect.top);
    });

    function loop(now) {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const dt = now - r.t0;
        if (dt < 0) continue;
        const p = dt / r.life;
        if (p >= 1) { ripples.splice(i, 1); continue; }
        const radius = r.max * (1 - Math.pow(1 - p, 3));
        const alpha = (1 - p) * 0.55;
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.lineWidth = 2.2 * (1 - p) + 0.6;
        ctx.strokeStyle = 'rgba(201,168,76,' + alpha.toFixed(3) + ')';
        ctx.shadowColor = 'rgba(201,168,76,0.6)';
        ctx.shadowBlur = 18 * (1 - p);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,235,180,' + (alpha * 0.5).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  });
})();

// ── 21. CONSOLE CREDITS ───────────────────────────────────────────
console.log('%c GORJ BOOKING · Luxury Tourism ',
  'background:#000; color:#C9A84C; padding:8px 16px; letter-spacing:0.3em; font-family:serif; border:1px solid #C9A84C');
console.log('%c Redesigned in 3D · v2 · Created by Teodor Becheanu & Popescu Alexandru',
  'color:#8A6D28; letter-spacing:0.08em');
