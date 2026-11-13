/* ==========================================================================
   ARSEL — landing page interactions

   Each letter of ARSEL is a category. The word is laid out in SVG user units
   (font-size 1000) and the viewBox is fitted around it, so the composition
   scales with the viewport. Each letter is an SVG <text>; the same glyph is
   reused as a clipPath for an HTML <video>/<img> sitting exactly on top of it.
   Hovering a letter previews the category; clicking opens its gallery.
   ========================================================================== */
(() => {
  'use strict';

  const CFG = window.ARSEL || {};
  const CATS = (Array.isArray(CFG.categories) ? CFG.categories : [])
    .filter(c => c && c.char);
  const FPS = CFG.fps || 24;

  const FS = 1000;          // font size, user units
  const TRACK = -0.045;     // tracking between letters (em)
  const ROW_GAP = 0.50;     // gap between rows when the word stacks (em)
  const PAD = 0.035;        // media box padding around the cap-height box (em)
  const BAR_H = 0.042;      // bar thickness (em)
  const BAR_GAP = 0.075;    // distance between letter and bar (em)
  const LABEL_SIZE = 0.115; // category label size (em)
  const LABEL_GAP = 0.075;  // distance between bar and label baseline (em)
  const LABEL_ASC = 0.78;   // label ascender, as a fraction of its own size
  const NS = 'http://www.w3.org/2000/svg';

  const body = document.body;
  const hero = document.querySelector('.hero');
  const svg = hero.querySelector('.type');
  const defs = svg.querySelector('defs');
  const gLabels = svg.querySelector('.labels');
  const gLetters = svg.querySelector('.letters');
  const gHits = svg.querySelector('.hits');
  const barSelect = svg.querySelector('.bar-select');
  const barProgress = svg.querySelector('.bar-progress');
  const mediaLayer = hero.querySelector('.media-layer');

  const cornerStatus = document.querySelector('[data-corner="status"]');
  const cornerWork = document.querySelector('[data-corner="work"]');
  const tcEl = document.querySelector('[data-tc]');
  const cursor = document.querySelector('.cursor');
  const cursorRing = cursor.querySelector('.cursor-ring');
  const cursorDot = cursor.querySelector('.cursor-dot');
  const cursorLabel = cursorRing.querySelector('span');

  const gallery = document.querySelector('.gallery');
  const galCrumb = gallery.querySelector('[data-gal-crumb]');
  const galName = gallery.querySelector('#gal-name');
  const galCount = gallery.querySelector('[data-gal-count]');
  const galGrid = gallery.querySelector('[data-gal-grid]');
  const galClose = gallery.querySelector('.gallery-close');

  const lightbox = document.querySelector('.lightbox');
  const lbStage = lightbox.querySelector('[data-lb-stage]');
  const lbTitle = lightbox.querySelector('[data-lb-title]');
  const lbMeta = lightbox.querySelector('[data-lb-meta]');
  const lbClose = lightbox.querySelector('.lb-close');
  const lbPrev = lightbox.querySelector('.lb-prev');
  const lbNext = lightbox.querySelector('.lb-next');

  const isTouch = matchMedia('(hover: none)').matches;
  const hasCursor = matchMedia('(hover: hover) and (pointer: fine)').matches;

  const pad2 = n => String(n).padStart(2, '0');
  const IDLE = {
    status: ['Standby'],
    work: [isTouch ? 'Tap to reveal' : 'Hover to reveal', pad2(CATS.length) + ' categories'],
  };

  let active = -1;
  let ready = false;
  let capRatio = 0.72;
  let rowsSig = '';

  /* ---------------------------------------------------------------- build */

  const make = (name, attrs) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  const coverOf = cat => cat.cover || (cat.works && cat.works[0]) || null;
  const worksOf = cat => (Array.isArray(cat.works) ? cat.works : []);

  function build(cat, i) {
    const id = 'clip-' + i;
    const works = worksOf(cat);
    const cover = coverOf(cat);

    // glyph used as a clip for the preview media
    const clip = make('clipPath', { id, clipPathUnits: 'objectBoundingBox' });
    const clipText = make('text', { class: 'glyph', 'font-size': FS });
    clipText.textContent = cat.char;
    clip.appendChild(clipText);
    defs.appendChild(clip);

    // visible glyph
    const text = make('text', { class: 'glyph glyph-fill', 'font-size': FS });
    text.textContent = cat.char;
    text.style.setProperty('--i', i);
    gLetters.appendChild(text);

    // hollow category name, sits above the letter on hover
    const label = make('text', {
      class: 'cat-label', 'font-size': LABEL_SIZE * FS, 'text-anchor': 'middle',
    });
    label.textContent = cat.name || '';
    gLabels.appendChild(label);

    // hover / tap / focus target
    const hit = make('rect', {
      class: 'hit', tabindex: 0, role: 'button',
      'aria-label': `${cat.name} — ${works.length} works`,
    });
    gHits.appendChild(hit);

    // preview media, clipped to the glyph
    const media = document.createElement('div');
    media.className = 'media';
    media.style.clipPath = `url(#${id})`;
    media.style.webkitClipPath = `url(#${id})`;

    let node = null;
    if (cover) {
      if (cover.type === 'video') {
        node = document.createElement('video');
        node.muted = true;
        node.loop = true;
        node.playsInline = true;
        node.preload = 'auto';
        node.disablePictureInPicture = true;
        node.setAttribute('muted', '');
        node.setAttribute('playsinline', '');
        if (cover.poster) node.poster = cover.poster;
        node.src = cover.src;
      } else {
        node = new Image();
        node.decoding = 'async';
        node.alt = '';
        node.src = cover.src;
      }
      media.appendChild(node);
    }
    mediaLayer.appendChild(media);

    const L = {
      cat, i, works, cover, clipText, text, label, hit, media, node,
      box: null, row: 0, justOpened: false, tiles: null,
    };

    hit.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') activate(i, true); });
    hit.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch' && active === i) deactivate(); });
    hit.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch') return;
      if (active !== i) { activate(i, true); L.justOpened = true; }
    });
    hit.addEventListener('click', () => {
      if (L.justOpened) { L.justOpened = false; return; }
      openGallery(i);
    });
    hit.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openGallery(i); }
    });
    hit.addEventListener('focus', () => activate(i, false));
    hit.addEventListener('blur', () => { if (active === i) deactivate(); });

    return L;
  }

  const letters = CATS.map(build);
  const last = letters[letters.length - 1];

  /* --------------------------------------------------------------- layout */

  // one row in landscape, two rows in portrait
  function rowsOf() {
    const n = letters.length;
    const portrait = innerWidth < innerHeight * 0.9;
    if (!portrait || n < 4) return [letters.map(l => l.i)];
    const first = Math.ceil(n / 2);
    return [letters.slice(0, first).map(l => l.i), letters.slice(first).map(l => l.i)];
  }

  // cap height of the display face, as a fraction of the font size
  function measureCap() {
    try {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `900 ${FS}px ${getComputedStyle(letters[0].text).fontFamily}`;
      try { ctx.fontStretch = 'extra-expanded'; } catch (_) { /* older browsers */ }
      const m = ctx.measureText('H');
      if (m.actualBoundingBoxAscent > 0) capRatio = m.actualBoundingBoxAscent / FS;
    } catch (_) { /* keep the default */ }
  }

  function layout() {
    if (!letters.length) return;
    const rows = rowsOf();
    rowsSig = rows.map(r => r.join('')).join('|');
    measureCap();

    const cap = capRatio * FS;
    const track = TRACK * FS;
    const pad = PAD * FS;
    const rowH = cap + ROW_GAP * FS;
    const barSpace = (BAR_GAP + BAR_H) * FS;
    const labelDrop = (BAR_GAP + BAR_H + LABEL_GAP) * FS;
    let minX = Infinity, maxX = -Infinity;

    rows.forEach((row, r) => {
      const baseline = cap + r * rowH;
      let x = 0;
      row.forEach(idx => {
        const L = letters[idx];
        L.row = r;
        L.text.setAttribute('x', x);
        L.text.setAttribute('y', baseline);
        L.clipText.setAttribute('x', x);
        L.clipText.setAttribute('y', baseline);
        x += L.text.getComputedTextLength() + track;
      });
      row.forEach(idx => {
        const L = letters[idx];
        const b = L.text.getBBox();
        // tight box around the cap height, with a little breathing room
        const box = { x: b.x - pad, y: baseline - cap - pad, w: b.width + pad * 2, h: cap + pad * 2 };
        L.box = box;
        L.clipText.setAttribute('transform', `scale(${1 / box.w} ${1 / box.h}) translate(${-box.x} ${-box.y})`);
        L.hit.setAttribute('x', box.x);
        L.hit.setAttribute('y', box.y - barSpace);
        L.hit.setAttribute('width', box.w);
        L.hit.setAttribute('height', box.h + barSpace * 2);

        // the hollow category name, centred over its letter
        const cx = box.x + box.w / 2;
        L.label.setAttribute('x', cx);
        L.label.setAttribute('y', box.y - labelDrop);
        const half = L.label.getComputedTextLength() / 2;

        minX = Math.min(minX, box.x, cx - half);
        maxX = Math.max(maxX, box.x + box.w, cx + half);
      });
    });

    const top = -pad - labelDrop - LABEL_ASC * LABEL_SIZE * FS;
    const bottom = cap + (rows.length - 1) * rowH + pad + barSpace;
    svg.setAttribute('viewBox', `${minX} ${top} ${maxX - minX} ${bottom - top}`);

    barSelect.setAttribute('height', BAR_H * FS);
    barProgress.setAttribute('height', BAR_H * FS);
    placeSelect(active >= 0 ? letters[active] : null);
    sync();
  }

  // the selector bar rests above the tail of the word, and glides to the open letter
  function placeSelect(L) {
    let x, w, y;
    if (L) {
      x = L.box.x; w = L.box.w; y = L.box.y;
    } else {
      const prev = letters[letters.length - 2] || last;
      const from = prev.row === last.row ? prev : last;
      x = from.box.x; w = last.box.x + last.box.w - x; y = last.box.y;
    }
    y -= (BAR_GAP + BAR_H) * FS;
    barSelect.style.transform = `translate(${x}px, ${y}px) scaleX(${ready ? w : 0})`;
  }

  // put each preview box exactly over its letter (screen px)
  function sync() {
    const m = svg.getScreenCTM();
    if (!m) return;
    const base = mediaLayer.getBoundingClientRect();
    const sw = 1.5 / (m.a || 1);
    letters.forEach(L => {
      if (!L.box) return;
      const x = m.a * L.box.x + m.e - base.left;
      const y = m.d * L.box.y + m.f - base.top;
      L.media.style.width = (L.box.w * m.a) + 'px';
      L.media.style.height = (L.box.h * m.d) + 'px';
      L.media.style.transform = `translate(${x}px, ${y}px)`;
      // keep the hollow label a crisp hairline whatever the word scales to
      L.label.style.strokeWidth = sw;
    });
  }

  /* ------------------------------------------------------------ reveal */

  function setLines(container, lines) {
    const targets = container.querySelectorAll('[data-txt]');
    lines.forEach((txt, k) => {
      const t = targets[k];
      if (!t || txt == null || t.textContent === txt) return;
      t.textContent = txt;
      const line = t.closest('.line');
      line.classList.remove('swap');
      void line.offsetWidth;
      line.classList.add('swap');
    });
  }

  // viaPointer: only a real hover should grow the custom cursor ring,
  // keyboard focus must not expand it at a stale mouse position
  function activate(i, viaPointer) {
    if (active === i) return;
    if (active >= 0) release(letters[active]);
    active = i;
    const L = letters[i];
    const isVideo = L.cover && L.cover.type === 'video';

    body.classList.add('is-hovering');
    L.text.classList.add('is-current');
    L.label.classList.add('is-on');
    placeSelect(L);

    const n = `${pad2(i + 1)}/${pad2(letters.length)}`;
    setLines(cornerStatus, [isVideo ? `Reel ${n}` : `Still ${n}`]);
    cornerStatus.classList.toggle('is-rec', !!isVideo);
    setLines(cornerWork, [
      `${pad2(L.works.length)} works`,
      isTouch ? 'Tap to open' : 'Click to open',
    ]);
    if (viaPointer) {
      cursorLabel.textContent = 'View';
      cursor.classList.add('is-over');
    }

    if (!L.node) return;

    // only fade the preview in once there is a frame to show
    const reveal = () => {
      if (active !== i) return;
      L.media.classList.add('is-active');
      L.text.classList.add('is-active');
      if (isVideo) barProgress.classList.add('is-on');
    };
    if (isVideo) {
      const v = L.node;
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
      if (v.readyState >= 2) reveal();
      else v.addEventListener('loadeddata', reveal, { once: true });
    } else {
      const img = L.node;
      if (img.complete && img.naturalWidth) reveal();
      else img.addEventListener('load', reveal, { once: true });
    }
  }

  function release(L) {
    L.media.classList.remove('is-active');
    L.text.classList.remove('is-active', 'is-current');
    L.label.classList.remove('is-on');
    barProgress.classList.remove('is-on');
    if (L.cover && L.cover.type === 'video' && L.node) {
      setTimeout(() => { if (active !== L.i) L.node.pause(); }, 650);
    }
  }

  function deactivate() {
    if (active < 0) return;
    release(letters[active]);
    active = -1;
    body.classList.remove('is-hovering');
    placeSelect(null);
    setLines(cornerStatus, IDLE.status);
    cornerStatus.classList.remove('is-rec');
    setLines(cornerWork, IDLE.work);
    cursor.classList.remove('is-over');
  }

  hero.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    if (e.target.classList && e.target.classList.contains('hit')) return;
    deactivate();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) deactivate(); });

  /* ----------------------------------------------------------- gallery */

  let galOpen = -1;
  let lbIndex = -1;
  let restoreFocus = null;

  // a still frame for a grid tile: the poster if given, else a seek into the clip
  const tileSrc = w => (w.type === 'video' && !w.poster ? w.src + '#t=1' : w.src);

  function buildGrid(L) {
    const tiles = [];

    L.works.forEach((w, k) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.style.setProperty('--k', Math.min(k, 12));
      tile.setAttribute('aria-label', `${w.title} — open`);

      const frame = document.createElement('div');
      frame.className = 'tile-frame';

      let node;
      if (w.type === 'video') {
        node = document.createElement('video');
        node.muted = true;
        node.loop = true;
        node.playsInline = true;
        node.preload = 'metadata';
        node.disablePictureInPicture = true;
        node.setAttribute('muted', '');
        node.setAttribute('playsinline', '');
        if (w.poster) node.poster = w.poster;
        node.src = tileSrc(w);
        tile.addEventListener('pointerenter', e => {
          if (e.pointerType === 'touch') return;
          const p = node.play();
          if (p && p.catch) p.catch(() => {});
        });
        tile.addEventListener('pointerleave', e => {
          if (e.pointerType !== 'touch') node.pause();
        });
      } else {
        node = new Image();
        node.loading = 'lazy';
        node.decoding = 'async';
        node.alt = w.title || '';
        node.src = w.src;
      }
      frame.appendChild(node);

      const kind = document.createElement('span');
      kind.className = 'tile-kind';
      kind.textContent = w.type === 'video' ? 'Film' : 'Photo';
      frame.appendChild(kind);

      const cap = document.createElement('div');
      cap.className = 'tile-cap';
      const t = document.createElement('span');
      t.className = 'tile-title';
      t.textContent = w.title || '';
      const m = document.createElement('span');
      m.className = 'tile-meta';
      m.textContent = [w.client, w.year].filter(Boolean).join(' · ');
      cap.append(t, m);

      tile.append(frame, cap);
      tile.addEventListener('click', () => openLightbox(k));
      tiles.push(tile);
    });

    return tiles;
  }

  function openGallery(i) {
    if (galOpen >= 0) return;
    const L = letters[i];
    if (!L.works.length) return;

    restoreFocus = document.activeElement;
    galOpen = i;
    deactivate();

    galCrumb.textContent = L.cat.name;
    galName.textContent = L.cat.name;
    galCount.textContent = `${pad2(L.works.length)} works`;

    if (!L.tiles) L.tiles = buildGrid(L);
    galGrid.replaceChildren(...L.tiles);

    gallery.hidden = false;
    gallery.scrollTop = 0;
    body.classList.add('gallery-open');
    setInert(hero, true);

    requestAnimationFrame(() => requestAnimationFrame(() => {
      gallery.classList.add('is-open');
      galClose.focus({ preventScroll: true });
    }));
  }

  function closeGallery() {
    if (galOpen < 0) return;
    closeLightbox();
    const L = letters[galOpen];
    galOpen = -1;

    gallery.classList.remove('is-open');
    body.classList.remove('gallery-open');
    setInert(hero, false);

    setTimeout(() => {
      if (galOpen >= 0) return;
      gallery.hidden = true;
      galGrid.querySelectorAll('video').forEach(v => v.pause());
    }, 460);

    const back = restoreFocus && restoreFocus.isConnected ? restoreFocus : L.hit;
    restoreFocus = null;
    if (back && back.focus) back.focus({ preventScroll: true });
  }

  function setInert(el, on) {
    if ('inert' in el) el.inert = on;
    else el.setAttribute('aria-hidden', on ? 'true' : 'false');
  }

  galClose.addEventListener('click', closeGallery);

  /* ---------------------------------------------------------- lightbox */

  function openLightbox(k) {
    if (galOpen < 0) return;
    const L = letters[galOpen];
    const w = L.works[k];
    if (!w) return;
    lbIndex = k;

    let node;
    if (w.type === 'video') {
      node = document.createElement('video');
      node.controls = true;
      node.autoplay = true;
      node.loop = true;
      node.muted = true;
      node.playsInline = true;
      node.setAttribute('muted', '');
      node.setAttribute('playsinline', '');
      if (w.poster) node.poster = w.poster;
      node.src = w.src;
    } else {
      node = new Image();
      node.decoding = 'async';
      node.alt = w.title || '';
      node.src = w.src;
    }
    lbStage.replaceChildren(node);

    lbTitle.textContent = w.title || '';
    lbMeta.textContent = [w.client, w.year, `${pad2(k + 1)}/${pad2(L.works.length)}`]
      .filter(Boolean).join(' · ');

    const many = L.works.length > 1;
    lbPrev.hidden = !many;
    lbNext.hidden = !many;

    lightbox.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      lightbox.classList.add('is-open');
      lbClose.focus({ preventScroll: true });
    }));
  }

  function stepLightbox(d) {
    if (lbIndex < 0 || galOpen < 0) return;
    const n = letters[galOpen].works.length;
    openLightbox((lbIndex + d + n) % n);
  }

  function closeLightbox() {
    if (lbIndex < 0) return;
    lbIndex = -1;
    lightbox.classList.remove('is-open');
    setTimeout(() => {
      if (lbIndex >= 0) return;
      lightbox.hidden = true;
      lbStage.replaceChildren();
    }, 380);
    if (galOpen >= 0) galClose.focus({ preventScroll: true });
  }

  lbClose.addEventListener('click', closeLightbox);
  lbPrev.addEventListener('click', () => stepLightbox(-1));
  lbNext.addEventListener('click', () => stepLightbox(1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  addEventListener('keydown', e => {
    if (lbIndex >= 0) {
      if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
      else if (e.key === 'ArrowLeft') stepLightbox(-1);
      else if (e.key === 'ArrowRight') stepLightbox(1);
      return;
    }
    if (galOpen >= 0 && e.key === 'Escape') { e.preventDefault(); closeGallery(); }
  });

  /* ---------------------------------------------------------- cursor */

  const cur = { x: -100, y: -100, tx: -100, ty: -100 };
  if (hasCursor) {
    addEventListener('pointermove', e => {
      cur.tx = e.clientX; cur.ty = e.clientY;
      cursorDot.style.transform = `translate3d(${cur.tx}px, ${cur.ty}px, 0)`;
    }, { passive: true });
    document.querySelectorAll('.corner a').forEach(a => {
      a.addEventListener('pointerenter', () => cursor.classList.add('is-link'));
      a.addEventListener('pointerleave', () => cursor.classList.remove('is-link'));
    });
  }

  /* ------------------------------------------------------ frame loop */

  function tcString(sec) {
    const s = Math.floor(sec);
    const f = Math.floor((sec - s) * FPS);
    return `${pad2(Math.floor(s / 3600) % 24)}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}:${pad2(f)}`;
  }

  let lastTc = '';
  function frame() {
    if (hasCursor) {
      cur.x += (cur.tx - cur.x) * 0.16;
      cur.y += (cur.ty - cur.y) * 0.16;
      cursorRing.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
    }

    // timecode: the playing preview's time, otherwise the local clock
    const L = active >= 0 ? letters[active] : null;
    let sec;
    if (L && L.cover && L.cover.type === 'video' && L.node) {
      const v = L.node;
      sec = v.currentTime || 0;
      if (v.duration > 0 && L.box) {
        const y = L.box.y + L.box.h + BAR_GAP * FS;
        barProgress.style.transform = `translate(${L.box.x}px, ${y}px) scaleX(${L.box.w * sec / v.duration})`;
      }
    } else {
      const d = new Date();
      sec = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
    }
    const tc = tcString(sec);
    if (tc !== lastTc) { lastTc = tc; tcEl.textContent = tc; }

    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ init */

  async function init() {
    // wait for the display face (but never longer than a moment)
    try {
      await Promise.race([
        Promise.all([
          document.fonts.load('900 extra-expanded 100px "Archivo"'),
          document.fonts.load('700 100px "Space Mono"'),
        ]),
        new Promise(r => setTimeout(r, 2500)),
      ]);
    } catch (_) { /* fall back to whatever font we have */ }

    layout();
    requestAnimationFrame(frame);

    // intro
    requestAnimationFrame(() => requestAnimationFrame(() => {
      body.classList.add('is-ready');
      setTimeout(() => { ready = true; placeSelect(active >= 0 ? letters[active] : null); }, 450);
    }));

    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', layout);
    }
    new ResizeObserver(() => {
      const sig = rowsOf().map(r => r.join('')).join('|');
      if (sig !== rowsSig) layout(); else sync();
    }).observe(hero);

    // deep links: ?open=S previews a category, ?gallery=S opens it
    const q = new URLSearchParams(location.search);
    const find = v => letters.findIndex(l => l.cat.char.toLowerCase() === String(v).toLowerCase());
    const g = q.get('gallery');
    const o = q.get('open');
    if (g && find(g) >= 0) setTimeout(() => openGallery(find(g)), 900);
    else if (o && find(o) >= 0) setTimeout(() => activate(find(o), false), 1100);
  }

  init();
})();
