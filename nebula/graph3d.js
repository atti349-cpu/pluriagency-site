// Neural OS v2 — 3D engine con Three.js
// Espone: window.NeuralGraph3D = { init, setData, refresh, focusNode, getNode, dispose, getCamera }

(function() {
  const THREE = window.THREE;

  function hexToRgb(hex) {
    const s = hex.replace("#", "");
    const n = parseInt(s.length === 3 ? s.split("").map(c => c+c).join("") : s, 16);
    return [((n >> 16) & 255)/255, ((n >> 8) & 255)/255, (n & 255)/255];
  }

  // ---------- Force simulation 3D ----------
  function buildSim(nodes, links) {
    const N = nodes.map(n => {
      // distribuzione iniziale sferica
      const r = 200 + Math.random() * 80;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      return {
        ...n,
        x: r * Math.sin(ph) * Math.cos(th),
        y: r * Math.sin(ph) * Math.sin(th),
        z: r * Math.cos(ph),
        vx: 0, vy: 0, vz: 0,
        fx: null, fy: null, fz: null
      };
    });
    // Hub non più bloccato: ha solo una leggera gravità verso l'origine
    const idx = new Map(N.map((n, i) => [n.id, i]));
    const L = links.map(l => ({ ...l, s: idx.get(l.source), t: idx.get(l.target) })).filter(l => l.s !== undefined && l.t !== undefined);
    return { N, L };
  }

  function stepSim(N, L, alpha) {
    const n = N.length;
    const idx2 = {};
    for (let i = 0; i < n; i++) idx2[N[i].id] = i;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = N[j].x - N[i].x, dy = N[j].y - N[i].y, dz = N[j].z - N[i].z;
        let d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < 1) d2 = 1;
        const d = Math.sqrt(d2);
        const f = 18000 / d2;
        const fx = (dx/d)*f, fy = (dy/d)*f, fz = (dz/d)*f;
        N[i].vx -= fx*alpha; N[i].vy -= fy*alpha; N[i].vz -= fz*alpha;
        N[j].vx += fx*alpha; N[j].vy += fy*alpha; N[j].vz += fz*alpha;
      }
    }
    for (const l of L) {
      const a = N[l.s], b = N[l.t];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.01;
      const target = l.type === "core" ? 220 : (l.type === "hosted" || l.type === "infra" ? 280 : 240);
      const k = l.type === "core" ? 0.06 : 0.035;
      const f = (d - target) * k;
      const fx = (dx/d)*f, fy = (dy/d)*f, fz = (dz/d)*f;
      if (a.fx === null) { a.vx += fx*alpha; a.vy += fy*alpha; a.vz += fz*alpha; }
      if (b.fx === null) { b.vx -= fx*alpha; b.vy -= fy*alpha; b.vz -= fz*alpha; }
    }
    // gravità debole verso l'origine solo per hub, e verso il proprio cluster head per i figli
    for (const node of N) {
      if (node.fx !== null) continue;
      let gx = 0, gy = 0, gz = 0;
      if (node.cluster && node.cluster !== node.id) {
        const ci = idx2[node.cluster];
        if (ci !== undefined) {
          const c = N[ci];
          gx = (c.x - node.x) * 0.012;
          gy = (c.y - node.y) * 0.012;
          gz = (c.z - node.z) * 0.012;
        }
      } else if (node.id === "hub") {
        gx = -node.x * 0.004; gy = -node.y * 0.004; gz = -node.z * 0.004;
      } else {
        gx = -node.x * 0.002; gy = -node.y * 0.002; gz = -node.z * 0.002;
      }
      node.vx += gx * alpha; node.vy += gy * alpha; node.vz += gz * alpha;
      node.vx *= 0.85; node.vy *= 0.85; node.vz *= 0.85;
      node.x += node.vx; node.y += node.vy; node.z += node.vz;
    }
  }

  // Glow sprite texture (cached)
  let _glowTex = null;
  function makeGlowTexture() {
    if (_glowTex) return _glowTex;
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(128,128,0,128,128,128);
    g.addColorStop(0,    "rgba(255,255,255,1)");
    g.addColorStop(0.2,  "rgba(255,255,255,0.55)");
    g.addColorStop(0.5,  "rgba(255,255,255,0.18)");
    g.addColorStop(1,    "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0,0,256,256);
    _glowTex = new THREE.CanvasTexture(c);
    return _glowTex;
  }

  // Label sprite (canvas-based)
  function makeLabelSprite(text, color) {
    const padX = 14, padY = 8;
    const fontSize = 28;
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    ctx.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    const w = Math.ceil(ctx.measureText(text).width) + padX*2;
    const h = fontSize + padY*2;
    c.width = w; c.height = h;
    const ctx2 = c.getContext("2d");
    ctx2.font = `600 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`;
    // pill bg
    ctx2.fillStyle = "rgba(8,10,18,0.72)";
    const r = 10;
    ctx2.beginPath();
    ctx2.moveTo(r,0); ctx2.lineTo(w-r,0); ctx2.quadraticCurveTo(w,0,w,r);
    ctx2.lineTo(w,h-r); ctx2.quadraticCurveTo(w,h,w-r,h);
    ctx2.lineTo(r,h); ctx2.quadraticCurveTo(0,h,0,h-r);
    ctx2.lineTo(0,r); ctx2.quadraticCurveTo(0,0,r,0); ctx2.closePath(); ctx2.fill();
    // border
    ctx2.strokeStyle = color + "55"; ctx2.lineWidth = 1.5; ctx2.stroke();
    // text
    ctx2.fillStyle = "#e6ebf5";
    ctx2.textBaseline = "middle";
    ctx2.fillText(text, padX, h/2 + 1);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
    const sp = new THREE.Sprite(mat);
    const scale = 0.55;
    sp.scale.set(w*scale, h*scale, 1);
    sp.userData.baseW = w*scale; sp.userData.baseH = h*scale;
    return sp;
  }

  // ---------- Nebula background ----------
  function buildNebula(scene) {
    const group = new THREE.Group();
    // distant stars
    const starCount = 4000;
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(starCount * 3);
    const sc = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 1500 + Math.random() * 1500;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sp[i*3]   = r * Math.sin(ph) * Math.cos(th);
      sp[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      sp[i*3+2] = r * Math.cos(ph);
      const t = Math.random();
      const c = t < 0.7 ? [0.85, 0.9, 1.0] : (t < 0.9 ? [0.7, 0.8, 1.0] : [1.0, 0.85, 0.8]);
      sc[i*3]=c[0]; sc[i*3+1]=c[1]; sc[i*3+2]=c[2];
    }
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sg.setAttribute("color", new THREE.BufferAttribute(sc, 3));
    const sm = new THREE.PointsMaterial({ size: 2.2, vertexColors: true, transparent: true, opacity: 0.85, sizeAttenuation: true, depthWrite: false });
    const stars = new THREE.Points(sg, sm);
    group.add(stars);

    // colored dust clouds (large sprites)
    const dustTex = makeGlowTexture();
    const palette = ["#3B82F6", "#8B5CF6", "#EC4899", "#10B981", "#F59E0B", "#6366F1"];
    for (let i = 0; i < 22; i++) {
      const col = palette[i % palette.length];
      const m = new THREE.SpriteMaterial({ map: dustTex, color: col, transparent: true, opacity: 0.10 + Math.random()*0.12, depthWrite: false, blending: THREE.AdditiveBlending });
      const sp = new THREE.Sprite(m);
      const r = 800 + Math.random() * 800;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      sp.position.set(r*Math.sin(ph)*Math.cos(th), r*Math.sin(ph)*Math.sin(th), r*Math.cos(ph));
      const s = 600 + Math.random()*900;
      sp.scale.set(s, s, 1);
      group.add(sp);
    }

    // floating particles closer in
    const partCount = 1200;
    const pg = new THREE.BufferGeometry();
    const pp = new Float32Array(partCount * 3);
    const pc = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount; i++) {
      const r = 300 + Math.random() * 800;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pp[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pp[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      pp[i*3+2] = r * Math.cos(ph);
      const t = Math.random();
      const c = t < 0.4 ? hexToRgb("#8B5CF6") : (t < 0.7 ? hexToRgb("#3B82F6") : hexToRgb("#EC4899"));
      pc[i*3]=c[0]; pc[i*3+1]=c[1]; pc[i*3+2]=c[2];
    }
    pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
    pg.setAttribute("color", new THREE.BufferAttribute(pc, 3));
    const pm = new THREE.PointsMaterial({ size: 3.5, vertexColors: true, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const parts = new THREE.Points(pg, pm);
    group.add(parts);

    scene.add(group);
    return { group, stars, parts };
  }

  // ---------- Custom Orbit Controls ----------
  // Left mouse: handled outside (drag pianeti). Middle button: rotate camera.
  // Right click: pan. Wheel: linear zoom (slow & adattabile).
  function createOrbitControls(camera, dom, opts = {}) {
    const isRotating = () => false; // gestito da pointerdown qui sotto
    const target = new THREE.Vector3(0, 0, 0);
    const spherical = new THREE.Spherical();
    const offset = new THREE.Vector3();
    offset.copy(camera.position).sub(target);
    spherical.setFromVector3(offset);
    let sphericalDelta = { theta: 0, phi: 0 };
    let panOffset = new THREE.Vector3();
    let radiusDelta = 0;
    let isDragging = false;
    let dragButton = -1;
    let lastX = 0, lastY = 0;
    const minDistance = 40, maxDistance = 4000;
    const minPolar = 0.02, maxPolar = Math.PI - 0.02;
    const damping = 0.1;
    const rotateSpeed = 0.55;
    const panSpeed = 0.9;
    // zoom lineare: ogni notch della rotella sposta di una quantità FISSA in distanza,
    // non moltiplicativa — così avanti/indietro è sempre uguale.
    const zoomStep = 18; // unità per evento wheel "normale"

    const onPointerDown = (e) => {
      // bottone 0 (left) = lasciato al chiamante (drag nodo). Bottone 1 (middle) = rotate. Bottone 2 (right) = pan.
      if (e.button !== 1 && e.button !== 2) return;
      // Se c'è un hit su nodo e button=0, non rotear comunque — gestito fuori
      isDragging = true;
      dragButton = e.button;
      lastX = e.clientX; lastY = e.clientY;
      try { dom.setPointerCapture && dom.setPointerCapture(e.pointerId); } catch(_){}
      controls._isDragging = true;
      e.preventDefault();
    };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      // Non ruotare mentre si fa pinch (2 dita) — gestito da onTouchMove
      if (_pinchDist !== null) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (dragButton === 2) {
        // pan
        const el = dom.clientHeight;
        const distance = camera.position.distanceTo(target);
        const fov = camera.fov * Math.PI / 180;
        const factor = (2 * distance * Math.tan(fov / 2)) / el;
        const xAxis = new THREE.Vector3();
        const yAxis = new THREE.Vector3();
        xAxis.setFromMatrixColumn(camera.matrix, 0);
        yAxis.setFromMatrixColumn(camera.matrix, 1);
        panOffset.addScaledVector(xAxis, -dx * factor * panSpeed);
        panOffset.addScaledVector(yAxis,  dy * factor * panSpeed);
      } else if (dragButton === 1) {
        // rotate (middle)
        sphericalDelta.theta -= 2 * Math.PI * dx / dom.clientWidth * rotateSpeed;
        sphericalDelta.phi   -= 2 * Math.PI * dy / dom.clientHeight * rotateSpeed;
      }
    };
    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      dragButton = -1;
      controls._isDragging = false;
      try { dom.releasePointerCapture && dom.releasePointerCapture(e.pointerId); } catch(_){}
    };
    const onWheel = (e) => {
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      const clamped = Math.max(-100, Math.min(100, dy));
      const zoomAmount = (clamped / 100) * zoomStep;

      // Zoom verso cursore (stile Figma/Blender):
      // calcola il punto 3D sotto il mouse e sposta il target in quella direzione
      // proporzionalmente allo zoom — così il punto sotto il cursore rimane fisso.
      const rect = dom.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      const my = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

      // Raggio camera → cursore in world-space
      const ndc = new THREE.Vector3(mx, my, 0.5);
      ndc.unproject(camera);
      const rayDir = ndc.sub(camera.position).normalize();

      // Punto 3D alla distanza attuale dalla camera
      const dist = camera.position.distanceTo(target);
      const worldPoint = camera.position.clone().addScaledVector(rayDir, dist);

      // Pan del target verso worldPoint proporzionale alla frazione di zoom
      // (quando il cursore è al centro worldPoint ≈ target → nessun pan extra)
      const fraction = (zoomAmount / dist) * 0.42;
      panOffset.addScaledVector(worldPoint.clone().sub(target), -fraction);

      radiusDelta += zoomAmount;
    };
    const onContext = (e) => e.preventDefault();
    const onAuxClick = (e) => { if (e.button === 1) e.preventDefault(); };
    const onMouseDownNative = (e) => { if (e.button === 1) e.preventDefault(); };

    dom.addEventListener("pointerdown", onPointerDown);
    dom.addEventListener("pointermove", onPointerMove);
    dom.addEventListener("pointerup", onPointerUp);
    dom.addEventListener("pointercancel", onPointerUp);
    dom.addEventListener("wheel", onWheel, { passive: false });
    dom.addEventListener("contextmenu", onContext);
    dom.addEventListener("auxclick", onAuxClick);
    dom.addEventListener("mousedown", onMouseDownNative);

    // Pinch-to-zoom + pan a 2 dita
    let _pinchDist = null;
    let _pinchCenter = null;
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        _pinchDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
        _pinchCenter = { x:(e.touches[0].clientX+e.touches[1].clientX)/2, y:(e.touches[0].clientY+e.touches[1].clientY)/2 };
      }
    };
    const onTouchMove = (e) => {
      if (e.touches.length !== 2 || _pinchDist === null) return;
      e.preventDefault();
      const newDist = Math.hypot(e.touches[0].clientX-e.touches[1].clientX, e.touches[0].clientY-e.touches[1].clientY);
      const newCenter = { x:(e.touches[0].clientX+e.touches[1].clientX)/2, y:(e.touches[0].clientY+e.touches[1].clientY)/2 };
      // Zoom da distanza tra le dita
      radiusDelta += (_pinchDist - newDist) * 0.55;
      // Pan dal movimento del centro
      const pdx = newCenter.x - _pinchCenter.x;
      const pdy = newCenter.y - _pinchCenter.y;
      if (Math.abs(pdx) > 0.3 || Math.abs(pdy) > 0.3) {
        const dist = camera.position.distanceTo(target);
        const fov = camera.fov * Math.PI / 180;
        const factor = (2 * dist * Math.tan(fov/2)) / dom.clientHeight;
        const xA = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const yA = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        panOffset.addScaledVector(xA, -pdx * factor * panSpeed);
        panOffset.addScaledVector(yA,  pdy * factor * panSpeed);
      }
      _pinchDist = newDist;
      _pinchCenter = newCenter;
    };
    const onTouchEnd = (e) => { if (e.touches.length < 2) { _pinchDist = null; _pinchCenter = null; } };
    dom.addEventListener("touchstart", onTouchStart, { passive: true });
    dom.addEventListener("touchmove", onTouchMove, { passive: false });
    dom.addEventListener("touchend", onTouchEnd);

    const controls = {
      target,
      _isDragging: false,
      // Permette al codice esterno (es. left-drag su spazio vuoto) di avviare una rotazione
      startRotate(x, y) { isDragging = true; dragButton = 1; lastX = x; lastY = y; this._isDragging = true; },
      stopRotate()       { isDragging = false; this._isDragging = false; },
      update() {
        offset.copy(camera.position).sub(target);
        spherical.setFromVector3(offset);
        spherical.theta += sphericalDelta.theta;
        spherical.phi += sphericalDelta.phi;
        spherical.phi = Math.max(minPolar, Math.min(maxPolar, spherical.phi));
        spherical.radius += radiusDelta;
        spherical.radius = Math.max(minDistance, Math.min(maxDistance, spherical.radius));
        target.add(panOffset);
        offset.setFromSpherical(spherical);
        camera.position.copy(target).add(offset);
        camera.lookAt(target);
        sphericalDelta.theta *= (1 - damping);
        sphericalDelta.phi *= (1 - damping);
        panOffset.multiplyScalar(1 - damping);
        radiusDelta *= (1 - damping);
      },
      dispose() {
        dom.removeEventListener("pointerdown", onPointerDown);
        dom.removeEventListener("pointermove", onPointerMove);
        dom.removeEventListener("pointerup", onPointerUp);
        dom.removeEventListener("pointercancel", onPointerUp);
        dom.removeEventListener("wheel", onWheel);
        dom.removeEventListener("contextmenu", onContext);
        dom.removeEventListener("auxclick", onAuxClick);
        dom.removeEventListener("mousedown", onMouseDownNative);
        dom.removeEventListener("touchstart", onTouchStart);
        dom.removeEventListener("touchmove", onTouchMove);
        dom.removeEventListener("touchend", onTouchEnd);
      }
    };
    return controls;
  }

  // ---------- Main ----------
  function init({ container, onSelect, onHover }) {
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05060f, 0.00042);

    const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 1, 5000);
    camera.position.set(0, 80, 700);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ---- Custom orbit controls (inline) ----
    const controls = createOrbitControls(camera, renderer.domElement);

    // Lights (subtle)
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pl = new THREE.PointLight(0x8B5CF6, 1.2, 1500);
    pl.position.set(0, 200, 300);
    scene.add(pl);

    buildNebula(scene);

    // Containers for graph items
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    let state = {
      data: null,
      sim: null,
      nodeMeshes: new Map(),  // id -> { group, sphere, glow, label, n }
      linkLines: [],          // { line, mesh-pulse, dot, l }
      neighbors: new Map(),
      selectedId: null,
      hoveredId: null,
      activeCats: null,       // Set, null = all
      activeClusters: null,   // Set di cluster id attivi, null = tutti
      searchQuery: "",
      focusMode: false,
      time: 0,
      alpha: 1.0
    };

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 6 };
    const pointer = new THREE.Vector2();

    function isVisible(n) {
      if (state.activeCats && !state.activeCats.has("all") && !state.activeCats.has(n.category)) return false;
      if (state.activeClusters && !state.activeClusters.has("all")) {
        // Controlla l'antenato top-level: se STARTUP è attivo, mostra anche THINKR e ADMIN_T
        const topCluster = state.ancestorMap?.get(n.id) || n.id;
        if (!state.activeClusters.has(topCluster)) return false;
      }
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        if (!n.label.toLowerCase().includes(q) && !n.id.toLowerCase().includes(q)) return false;
      }
      return true;
    }

    function nodeRadius(n) { return 4 + n.size * 4.5; }

    function buildNeighbors() {
      const m = new Map();
      for (const l of state.data.links) {
        if (!m.has(l.source)) m.set(l.source, new Set());
        if (!m.has(l.target)) m.set(l.target, new Set());
        m.get(l.source).add(l.target);
        m.get(l.target).add(l.source);
      }
      state.neighbors = m;
    }

    function clearGraph() {
      for (const { group } of state.nodeMeshes.values()) {
        graphGroup.remove(group);
        group.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) {
            if (o.material.map) o.material.map.dispose();
            o.material.dispose();
          }
        });
      }
      for (const ll of state.linkLines) {
        graphGroup.remove(ll.line);
        if (ll.dot) graphGroup.remove(ll.dot);
        ll.line.geometry.dispose(); ll.line.material.dispose();
        if (ll.dot) { ll.dot.material.map?.dispose?.(); ll.dot.material.dispose(); }
      }
      state.nodeMeshes.clear();
      state.linkLines = [];
    }

    function buildGraph() {
      // Salva posizioni correnti prima del rebuild — evita che i nodi volino via
      const savedPos = new Map();
      if (state.sim) {
        for (const n of state.sim.N) {
          if (n.x !== undefined) savedPos.set(n.id, { x: n.x, y: n.y, z: n.z, fx: n.fx, fy: n.fy, fz: n.fz });
        }
      }

      clearGraph();
      const data = state.data;
      // auto-flag cluster heads: non mutare data.nodes (React state) — calcolo locale
      const headsSet = new Set();
      for (const n of data.nodes) if (n.cluster && n.cluster !== n.id) headsSet.add(n.cluster);

      const { N, L } = buildSim(data.nodes, data.links);
      // marca _isHead sui sim nodes (copie separate, non React state)
      for (const sn of N) sn._isHead = sn.isClusterHead === true || headsSet.has(sn.id);

      // Ripristina posizioni per i nodi già esistenti
      let restored = 0;
      for (const sn of N) {
        const s = savedPos.get(sn.id);
        if (s) { sn.x=s.x; sn.y=s.y; sn.z=s.z; sn.vx=0; sn.vy=0; sn.vz=0; sn.fx=s.fx; sn.fy=s.fy; sn.fz=s.fz; restored++; }
      }
      state.sim = { N, L };

      // Mappa antenato: ogni nodo → id del cluster top-level (radice senza padre)
      // es. admin_t → startup, thinkr → startup, git → pluriagency
      const nodeById = new Map(data.nodes.map(n => [n.id, n]));
      const getTopAncestor = (id, visited = new Set()) => {
        if (visited.has(id)) return id;
        visited.add(id);
        const nd = nodeById.get(id);
        if (!nd || !nd.cluster || nd.cluster === id) return id;
        return getTopAncestor(nd.cluster, visited);
      };
      const ancestorMap = new Map();
      for (const sn of N) ancestorMap.set(sn.id, getTopAncestor(sn.id));
      state.ancestorMap = ancestorMap;

      // Pre-warm ridotto se tutti i nodi avevano già una posizione
      const warmSteps = restored === N.length ? 5 : 280;
      for (let i = 0; i < warmSteps; i++) stepSim(N, L, 0.6);

      const glowTex = makeGlowTexture();

      // Nodes
      for (const n of N) {
        const cat = data.categories[n.category] || data.categories.hub;
        const colHex = cat.color;
        const colObj = new THREE.Color(colHex);

        const grp = new THREE.Group();
        grp.userData.nodeId = n.id;

        // outer halo sprite — più grande per cluster head
        const haloMat = new THREE.SpriteMaterial({ map: glowTex, color: colHex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
        const halo = new THREE.Sprite(haloMat);
        const r = nodeRadius(n);
        const haloMul = n._isHead ? 11 : 6;
        halo.scale.set(r*haloMul, r*haloMul, 1);
        grp.add(halo);

        // sphere body
        const sphereGeo = new THREE.SphereGeometry(r, 32, 32);
        const sphereMat = new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.32 });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        sphere.userData.nodeId = n.id;
        grp.add(sphere);

        // inner bright core
        const coreMat = new THREE.SpriteMaterial({ map: glowTex, color: n.id === "hub" ? "#ffffff" : colHex, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
        const core = new THREE.Sprite(coreMat);
        core.scale.set(r*2.2, r*2.2, 1);
        grp.add(core);

        // ring (wireframe sphere outline)
        const ringGeo = new THREE.SphereGeometry(r, 24, 16);
        const ringMat = new THREE.MeshBasicMaterial({ color: colHex, wireframe: true, transparent: true, opacity: 0.35 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        grp.add(ring);

        // anello orbitale per cluster head
        let orbitRing = null;
        if (n._isHead) {
          const orbitGeo = new THREE.RingGeometry(r * 4, r * 4.2, 96);
          const orbitMat = new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false });
          orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
          orbitRing.rotation.x = Math.PI / 2;
          grp.add(orbitRing);
          // secondo anello, inclinato
          const orbitGeo2 = new THREE.RingGeometry(r * 5.5, r * 5.65, 96);
          const orbitMat2 = new THREE.MeshBasicMaterial({ color: colHex, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
          const orbitRing2 = new THREE.Mesh(orbitGeo2, orbitMat2);
          orbitRing2.rotation.x = Math.PI / 2.4;
          orbitRing2.rotation.y = Math.PI / 6;
          grp.add(orbitRing2);
          grp.userData.orbitRing2 = orbitRing2;
        }
        grp.userData.orbitRing = orbitRing;

        // sfera hit invisibile più grande per cluster head (rende draggabile l'intera area visiva)
        let hitSphere = null;
        if (n._isHead) {
          const hitGeo = new THREE.SphereGeometry(r * 4.5, 8, 8);
          const hitMat = new THREE.MeshBasicMaterial({ visible: false });
          hitSphere = new THREE.Mesh(hitGeo, hitMat);
          hitSphere.userData.nodeId = n.id;
          grp.add(hitSphere);
        }

        // label
        const label = makeLabelSprite(n.label, colHex);
        label.position.set(0, r + 14, 0);
        grp.add(label);

        grp.position.set(n.x, n.y, n.z);
        graphGroup.add(grp);
        state.nodeMeshes.set(n.id, { group: grp, sphere, halo, core, ring, label, hitSphere, n, baseHaloOp: 0.85, baseSphereOp: 0.32 });
      }

      // Links
      const dotTex = glowTex;
      for (const l of L) {
        const a = N[l.s], b = N[l.t];
        const lt = data.linkTypes[l.type] || data.linkTypes.uses;
        const colHex = lt.color;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z]);
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const mat = lt.dashed
          ? new THREE.LineDashedMaterial({ color: colHex, dashSize: 8, gapSize: 6, transparent: true, opacity: 0.55 })
          : new THREE.LineBasicMaterial({ color: colHex, transparent: true, opacity: 0.55 });
        const line = new THREE.Line(geo, mat);
        if (lt.dashed) line.computeLineDistances();
        graphGroup.add(line);

        // pulse dot
        const dotMat = new THREE.SpriteMaterial({ map: dotTex, color: colHex, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
        const dot = new THREE.Sprite(dotMat);
        dot.scale.set(14, 14, 1);
        graphGroup.add(dot);

        state.linkLines.push({ line, dot, l, lt, mat, baseOp: 0.55 });
      }

      buildNeighbors();
    }

    function setData(data) {
      state.data = data;
      buildGraph();
    }

    function refresh() { buildGraph(); }

    function setFilters(activeCats, searchQuery, activeClusters) {
      state.activeCats = activeCats;
      state.searchQuery = searchQuery;
      state.activeClusters = activeClusters || null;
    }
    function setSelected(id) { state.selectedId = id; }
    function setFocusMode(v) { state.focusMode = v; }

    function focusNode(id) {
      const m = state.nodeMeshes.get(id);
      if (!m) return;
      const p = m.group.position;
      const target = new THREE.Vector3(p.x, p.y, p.z);
      // animate camera target + position
      const startTarget = controls.target.clone();
      const startPos = camera.position.clone();
      const dist = 220;
      const dir = camera.position.clone().sub(controls.target).normalize();
      const endPos = target.clone().add(dir.multiplyScalar(dist));
      const t0 = performance.now();
      const T = 700;
      function animate() {
        const t = Math.min(1, (performance.now() - t0) / T);
        const e = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2, 2)/2;
        controls.target.lerpVectors(startTarget, target, e);
        camera.position.lerpVectors(startPos, endPos, e);
        if (t < 1) requestAnimationFrame(animate);
      }
      animate();
    }

    function getNode(id) { return state.nodeMeshes.get(id)?.n; }

    // pointer handling
    let lastMoveSx = 0, lastMoveSy = 0;
    function onPointerMove(e) {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      lastMoveSx = e.clientX; lastMoveSy = e.clientY;
      if (!controls._isDragging) {
        const hit = pickNode();
        const newId = hit ? hit.userData.nodeId : null;
        if (newId !== state.hoveredId) {
          state.hoveredId = newId;
          onHover && onHover(newId);
          renderer.domElement.style.cursor = newId ? "pointer" : "grab";
        }
      }
    }
    function pickNode() {
      raycaster.setFromCamera(pointer, camera);
      // raccoglie sfera visibile + sfera hit grande (cluster head)
      const candidates = [];
      for (const m of state.nodeMeshes.values()) {
        if (m.hitSphere) candidates.push(m.hitSphere);
        candidates.push(m.sphere);
      }
      const hits = raycaster.intersectObjects(candidates, false);
      if (hits.length > 0) {
        // sphere.userData.nodeId è già impostato direttamente
        const o = hits[0].object;
        if (o.userData.nodeId) return o;
        // fallback: traversa il parent (per sicurezza)
        let p = o.parent;
        while (p && !p.userData.nodeId) p = p.parent;
        return p;
      }
      return null;
    }

    // ---- Left-click drag (sposta pianeti) ----
    let mouseDownPos = null;
    let dragNode = null;       // simulazione nodo che si sta trascinando
    let dragPlane = new THREE.Plane();
    let dragOffset = new THREE.Vector3();
    let dragHitPoint = new THREE.Vector3();
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointermove", (e) => {
      if (!dragNode) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const p = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, p)) {
        dragNode.fx = p.x - dragOffset.x;
        dragNode.fy = p.y - dragOffset.y;
        dragNode.fz = p.z - dragOffset.z;
        dragNode.x = dragNode.fx;
        dragNode.y = dragNode.fy;
        dragNode.z = dragNode.fz;
        state.alpha = Math.max(state.alpha, 0.4);
      }
    });
    renderer.domElement.addEventListener("pointerdown", (e) => {
      // Ignora il 2° dito in un pinch touch (non-primary) — gestito da onTouchMove
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      mouseDownPos = { x: e.clientX, y: e.clientY, button: e.button };
      if (e.button === 0) {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const hit = pickNode();
        if (hit && state.sim) {
          const id = hit.userData.nodeId;
          const node = state.sim.N.find(nn => nn.id === id);
          if (node) {
            dragNode = node;
            // piano perpendicolare alla camera passante per il nodo
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            dragPlane.setFromNormalAndCoplanarPoint(camDir, new THREE.Vector3(node.x, node.y, node.z));
            // calcola offset tra punto click sul piano e centro nodo
            raycaster.setFromCamera(pointer, camera);
            raycaster.ray.intersectPlane(dragPlane, dragHitPoint);
            dragOffset.set(dragHitPoint.x - node.x, dragHitPoint.y - node.y, dragHitPoint.z - node.z);
            renderer.domElement.style.cursor = "grabbing";
            try { renderer.domElement.setPointerCapture(e.pointerId); } catch(_){}
          }
        } else {
          // spazio vuoto + tasto sinistro → ruota la visuale (come tasto centrale)
          controls.startRotate(e.clientX, e.clientY);
          renderer.domElement.style.cursor = "grabbing";
          try { renderer.domElement.setPointerCapture(e.pointerId); } catch(_){}
        }
      }
    });
    renderer.domElement.addEventListener("pointerup", (e) => {
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      if (dragNode) {
        dragNode = null;
        renderer.domElement.style.cursor = "grab";
      }
      if (!mouseDownPos) return;
      const dx = e.clientX - mouseDownPos.x;
      const dy = e.clientY - mouseDownPos.y;
      const moved = Math.hypot(dx, dy);
      if (moved < 4 && mouseDownPos.button === 0) {
        // click vero
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        const hit = pickNode();
        if (hit) {
          onSelect && onSelect(hit.userData.nodeId);
        } else {
          onSelect && onSelect(null);
        }
      }
      mouseDownPos = null;
    });
    renderer.domElement.addEventListener("dblclick", () => {
      const hit = pickNode();
      if (!hit) return;
      const n = state.nodeMeshes.get(hit.userData.nodeId)?.n;
      if (n && n.url) window.open(n.url, "_blank", "noopener");
    });

    // resize
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // animation loop
    let raf;
    function animate() {
      state.time += 1;
      // physics update (lieve)
      if (state.sim) {
        state.alpha = Math.max(0.04, state.alpha * 0.992);
        stepSim(state.sim.N, state.sim.L, state.alpha * 0.5);
        // sync mesh positions
        for (const n of state.sim.N) {
          const m = state.nodeMeshes.get(n.id);
          if (m) m.group.position.set(n.x, n.y, n.z);
        }
        // update lines
        for (const ll of state.linkLines) {
          const a = state.sim.N[ll.l.s], b = state.sim.N[ll.l.t];
          const arr = ll.line.geometry.attributes.position.array;
          arr[0]=a.x; arr[1]=a.y; arr[2]=a.z;
          arr[3]=b.x; arr[4]=b.y; arr[5]=b.z;
          ll.line.geometry.attributes.position.needsUpdate = true;
          if (ll.lt.dashed) ll.line.computeLineDistances();
          // pulse
          const speed = 0.005 + (ll.lt.pulse || 0.5) * 0.008;
          const phase = ((state.time * speed) + (ll.l.s*0.13 + ll.l.t*0.07)) % 1;
          ll.dot.position.set(
            a.x + (b.x - a.x) * phase,
            a.y + (b.y - a.y) * phase,
            a.z + (b.z - a.z) * phase
          );
        }
      }

      // visibility / focus / hover
      const focusSet = state.focusMode && state.selectedId
        ? new Set([state.selectedId, ...(state.neighbors.get(state.selectedId) || [])])
        : null;
      const hoverSet = !focusSet && state.hoveredId
        ? new Set([state.hoveredId, ...(state.neighbors.get(state.hoveredId) || [])])
        : null;

      for (const [id, m] of state.nodeMeshes) {
        const visible = isVisible(m.n);
        m.group.visible = visible;
        if (!visible) continue;
        let alpha = 1;
        if (focusSet && !focusSet.has(id)) alpha = 0.12;
        else if (hoverSet && !hoverSet.has(id)) alpha = 0.3;
        m.halo.material.opacity = m.baseHaloOp * alpha;
        m.sphere.material.opacity = m.baseSphereOp * alpha;
        m.core.material.opacity = 1 * alpha;
        m.ring.material.opacity = 0.35 * alpha;
        m.label.material.opacity = alpha;

        // pulse for future category
        if (m.n.category === "future") {
          const s = 1 + 0.18 * Math.sin(state.time * 0.06);
          m.halo.scale.setScalar((4 + m.n.size*4.5) * 6 * s);
        }
        // pulse for nodes with WIP tasks — halo più grande e luminoso
        if (m.n.tasks && m.n.tasks.some(t => t.status === "wip")) {
          const p = 0.5 + 0.5 * Math.sin(state.time * 0.14);
          m.halo.scale.setScalar((4 + m.n.size*4.5) * 6 * (1 + 0.9 * p));
          m.halo.material.opacity = Math.min(1, m.baseHaloOp * alpha * (1.6 + 1.0 * p));
        }
        // ruota lentamente gli anelli orbitali dei cluster head
        if (m.group.userData.orbitRing) m.group.userData.orbitRing.rotation.z += 0.003;
        if (m.group.userData.orbitRing2) m.group.userData.orbitRing2.rotation.z -= 0.002;
        // selected gets emphasized
        if (id === state.selectedId) {
          m.halo.material.opacity = Math.min(1, m.baseHaloOp * alpha * 1.6);
        }
      }
      for (const ll of state.linkLines) {
        const aN = state.sim.N[ll.l.s], bN = state.sim.N[ll.l.t];
        const aVis = isVisible(aN), bVis = isVisible(bN);
        ll.line.visible = aVis && bVis;
        ll.dot.visible = aVis && bVis;
        if (!ll.line.visible) continue;
        let a = ll.baseOp;
        if (focusSet && !(focusSet.has(aN.id) && focusSet.has(bN.id))) a = 0.04;
        else if (hoverSet && !(hoverSet.has(aN.id) && hoverSet.has(bN.id))) a = 0.10;
        ll.line.material.opacity = a;
        ll.dot.material.opacity = a > 0.2 ? 0.95 : 0;
      }

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    function dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      clearGraph();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    }

    return {
      setData, refresh, setFilters, setSelected, setFocusMode,
      focusNode, getNode, dispose,
      getSim: () => state.sim,
      _state: state
    };
  }

  window.NeuralGraph3D = { init };
})();
