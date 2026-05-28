// ================================================================
// BUCAL PRO — Three.js Visualizador 3D
// app.js v5.0 (Reescritura Anatómica Total)
// ================================================================

const PRESETS = [
  { id:'adx_pink',  name:'ADX\nPink',     c1:'#ff1493', c2:'#ffb6c1', metal:0.1, rough:0.15 },
  { id:'adx_white', name:'ADX\nBlack',    c1:'#151515', c2:'#f5f5f5', metal:0.1, rough:0.15 },
  { id:'adx_blue',  name:'ADX\nBlue',     c1:'#151515', c2:'#0033cc', metal:0.1, rough:0.15 },
  { id:'champion',  name:'Champion\nGold',c1:'#c8960a', c2:'#151515', metal:0.5, rough:0.2  },
  { id:'phantom',   name:'Phantom\nRed',  c1:'#151515', c2:'#cc0a2a', metal:0.1, rough:0.15 },
];

const STATE = {
  color1:      '#ff1493',
  color2:      '#ffb6c1',
  metalness:   0.1,
  roughness:   0.15,
  archWidth:   64,
  archDepth:   40,
  guardHeight: 16,
  labialWall:  4.5,
  palatalWall: 4.5,
  channelW:    10.0, 
  channelD:    3.0,  // Base de gel muy delgada -> Canal de dientes PROFUNDO
  showVents:   true,
  ventCount:   3,
  ventDiam:    3.5,
  grip:        0,
  showTab:     true,
  showRamps:   true,
  autoRotate:  true,
};

let scene, camera, renderer, controls;
let guardGroup;
let animId, autoRotating = true;

// ── Init ────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  try {
    buildPresets();
    bindControls();
    initThree();
    buildMouthguard();
    animate();
    setTimeout(hideLoading, 500);
  } catch (err) {
    console.error("Error inicializando:", err);
    const msg = document.getElementById('loader-msg');
    if (msg) {
      msg.textContent = "Error: " + err.message;
      msg.style.color = "#ff4444";
    }
    const ring = document.querySelector('.loader-ring');
    if (ring) ring.style.display = 'none';
  }
});

// ── Three.js Setup ─────────────────────────────────────────────
function initThree() {
  if (typeof THREE === 'undefined') throw new Error("Three.js no cargó correctamente del CDN.");
  if (typeof THREE.OrbitControls === 'undefined') throw new Error("OrbitControls no está disponible.");

  const canvas = document.getElementById('canvas3d');
  const vp     = document.getElementById('viewport');

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(42, vp.clientWidth / vp.clientHeight, 0.1, 1000);
  camera.position.set(0, 50, 90);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(vp.clientWidth, vp.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 20;
  controls.maxDistance = 150;
  controls.target.set(0, 0, 0);

  // Iluminación Profesional Tipo Estudio
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(40, 80, 80);
  key.castShadow = true;
  key.shadow.mapSize.width = 2048;
  key.shadow.mapSize.height = 2048;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xddeeff, 0.6);
  fill.position.set(-60, 20, 40);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.9);
  rim.position.set(0, 40, -100);
  scene.add(rim);

  const planeGeo = new THREE.PlaneGeometry(300, 300);
  const planeMat = new THREE.ShadowMaterial({ opacity: 0.15 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -5;
  plane.receiveShadow = true;
  scene.add(plane);

  window.addEventListener('resize', () => {
    const w = vp.clientWidth, h = vp.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}

function animate() {
  animId = requestAnimationFrame(animate);
  if (autoRotating && guardGroup) {
    guardGroup.rotation.y += 0.005;
  }
  controls.update();
  renderer.render(scene, camera);
}

// ── Perfiles Doble Densidad (Proporciones Según Dibujo de Corte Transversal) ──
function createDualShapes(p) {
  const rInner = 2.0; 
  const rOuter = 4.0; // Líneas azules: Esquinas inferiores muy curveadas
  const outT = 2.0; // Grosor de carcasa dura
  
  const labOutX = p.channelW/2 + p.labialWall;
  const palOutX = -p.channelW/2 - p.palatalWall;
  const labInX = p.channelW/2;
  const palInX = -p.channelW/2;
  
  const floorTopY = p.channelD; // Ej. 3.0mm (Suelo muy bajo = Canal profundo)
  const labTopY = p.guardHeight; // Ej. 16mm
  const palTopY = p.guardHeight - 1.0; // Líneas rojas: Pared palatina alta igual que la frontal
  
  // 1. CARCASA EXTERIOR (Rosa Fuerte)
  const out = new THREE.Shape();
  out.moveTo(palOutX, palTopY - 1.5);
  out.lineTo(palOutX, rOuter);
  out.quadraticCurveTo(palOutX, 0, palOutX + rOuter, 0); // Curva azul inferior interna
  out.lineTo(labOutX - rOuter, 0);
  out.quadraticCurveTo(labOutX, 0, labOutX, rOuter); // Curva azul inferior externa
  out.lineTo(labOutX, labTopY - 1.5);
  
  // Interfaz interna
  out.lineTo(labOutX - outT, labTopY - 1.5);
  out.lineTo(labOutX - outT, outT); // Suelo duro base
  out.lineTo(palOutX + outT, outT); 
  out.lineTo(palOutX + outT, palTopY - 1.5);
  out.lineTo(palOutX, palTopY - 1.5); 
  
  // 2. GEL INTERNO (Rosa Claro)
  const inn = new THREE.Shape();
  inn.moveTo(palOutX + outT, palTopY - 1.5);
  inn.lineTo(palOutX + outT, outT);
  inn.lineTo(labOutX - outT, outT); 
  inn.lineTo(labOutX - outT, labTopY - 1.5);
  
  // Rebose acolchado superior frontal
  inn.lineTo(labOutX + 0.5, labTopY - 1.5);
  inn.lineTo(labOutX + 0.5, labTopY - rInner);
  inn.quadraticCurveTo(labOutX + 0.5, labTopY, labOutX - rInner, labTopY);
  
  // Caída profunda al canal dental (Líneas rojas)
  inn.lineTo(labInX + rInner, labTopY);
  inn.quadraticCurveTo(labInX, labTopY, labInX, labTopY - rInner);
  inn.lineTo(labInX, floorTopY + rOuter); // Pared recta profunda
  inn.quadraticCurveTo(labInX, floorTopY, 0, floorTopY); // Centro de la U profunda
  inn.quadraticCurveTo(palInX, floorTopY, palInX, floorTopY + rOuter); // Pared recta profunda
  
  // Subida a la pared palatina (Pared alta)
  inn.lineTo(palInX, palTopY - rInner);
  inn.quadraticCurveTo(palInX, palTopY, palInX - rInner, palTopY);
  inn.lineTo(palOutX - 0.5, palTopY);
  inn.lineTo(palOutX - 0.5, palTopY - 1.5);
  inn.lineTo(palOutX + outT, palTopY - 1.5); 
  
  return { out, inn };
}

// ── Barrido Parabólico Personalizado (Orientación 100% Perfecta) ──
function generateSweepGeometry(profileShape, steps, p, closeCaps = true) {
  const profile2D = profileShape.getPoints(20);
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const indices = [];
  
  const w = p.archWidth;
  const d = p.archDepth;
  
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 (Izquierda) a 1 (Derecha)
    
    // Curva Parabólica Humana
    const nx_val = (t - 0.5) * 2; 
    const x = (w / 2) * nx_val;
    const z = -d * Math.pow(Math.abs(nx_val), 2.2); // Más estrecho al frente que una elipse
    
    // Tangente y Normal para orientar el perfil
    const delta = 0.001;
    const nx_val_next = ((t + delta) - 0.5) * 2;
    const x_next = (w / 2) * nx_val_next;
    const z_next = -d * Math.pow(Math.abs(nx_val_next), 2.2);
    
    let tx = x_next - x;
    let tz = z_next - z;
    const tLen = Math.sqrt(tx*tx + tz*tz);
    tx /= tLen; tz /= tLen;
    
    const normX = tz;
    const normZ = -tx; // Normal apunta hacia afuera (Labial)
    
    for (let j = 0; j < profile2D.length; j++) {
      const px = profile2D[j].x; // X = Ancho/Grosor
      let py = profile2D[j].y; // Y = Altura (Arriba/Abajo)
      
      // ── DEFORMACIÓN ANATÓMICA Y ORGÁNICA ──
      
      // 1. Perfil Decreciente (Taper) hacia Molares
      const dist_from_center = Math.abs(t - 0.5) * 2; 
      let taper = 1.0;
      if (dist_from_center > 0.4) {
        taper = 1.0 - 0.35 * ((dist_from_center - 0.4) / 0.6); // Baja 35% atrás
      }
      if (py > p.channelD) {
        py = p.channelD + (py - p.channelD) * taper;
      }
      
      // 2. Ondas Gingivales (Festoneado Suave)
      if (px > 0 && py > p.guardHeight * 0.7) {
        const teeth = Math.sin(t * Math.PI * 14);
        const weight = (py - p.guardHeight * 0.7) / (p.guardHeight * 0.3);
        py += teeth * 0.3 * weight; // Muy sutil
      }
      
      // 3. Escotadura Central Amplia (Frenulum Notch)
      if (dist_from_center < 0.45) { // Más ancho
        const depth = 4.5 * Math.exp(-Math.pow(dist_from_center, 2) / 0.05); // Suave y profundo
        if (px > 0 && py > p.channelD + 1) { 
          // Rebaje Frontal Labial
          const factor = (py - (p.channelD + 1)) / (p.guardHeight - (p.channelD + 1));
          py -= depth * Math.max(0, factor);
        }
        if (px < 0 && py > p.channelD + 1) { 
          // Rebaje Palatino
          const factor = (py - (p.channelD + 1)) / (8.0 - (p.channelD + 1)); // 8.0 es palTopY
          py -= (depth * 0.6) * Math.max(0, factor);
        }
      }

      // Aplicar Posición 3D
      const finalX = x + normX * px;
      const finalZ = z + normZ * px;
      const finalY = py;
      
      verts.push(finalX, finalY, finalZ);
    }
  }
  
  const numPts = profile2D.length;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < numPts - 1; j++) {
      const a = i * numPts + j;
      const b = i * numPts + (j + 1);
      const c = (i + 1) * numPts + j;
      const d_idx = (i + 1) * numPts + (j + 1);
      
      indices.push(a, b, d_idx);
      indices.push(a, d_idx, c);
    }
  }
  
  if (closeCaps) {
    const capIndices = THREE.ShapeUtils.triangulateShape(profile2D, []);
    for (let i = 0; i < capIndices.length; i++) {
      const tri = capIndices[i];
      indices.push(tri[0], tri[2], tri[1]);
    }
    const offset = steps * numPts;
    for (let i = 0; i < capIndices.length; i++) {
      const tri = capIndices[i];
      indices.push(offset + tri[0], offset + tri[1], offset + tri[2]);
    }
  }
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── Textura de Goma ────────────────────────────────────────────
let _noiseTex = null;
function getFineNoiseTexture() {
  if (_noiseTex) return _noiseTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(256, 256);
  for(let i=0; i<imgData.data.length; i+=4) {
    const val = 128 + (Math.random() * 10 - 5); 
    imgData.data[i] = val;
    imgData.data[i+1] = val;
    imgData.data[i+2] = val;
    imgData.data[i+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  _noiseTex = new THREE.CanvasTexture(canvas);
  _noiseTex.wrapS = THREE.RepeatWrapping;
  _noiseTex.wrapT = THREE.RepeatWrapping;
  _noiseTex.repeat.set(10, 10);
  return _noiseTex;
}

// ── Ensamblaje del Bucal ───────────────────────────────────────
function buildMouthguard() {
  if (guardGroup) {
    scene.remove(guardGroup);
    guardGroup.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }

  guardGroup = new THREE.Group();
  scene.add(guardGroup);

  const p = STATE;
  const shapes = createDualShapes(p);
  
  const outerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.color1),
    metalness: p.metalness,
    roughness: p.roughness,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    bumpMap: getFineNoiseTexture(),
    bumpScale: 0.02,
    side: THREE.DoubleSide
  });

  const innerMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.color2),
    metalness: Math.max(0, p.metalness - 0.1),
    roughness: Math.min(1, p.roughness + 0.1),
    clearcoat: 0.8,
    bumpMap: getFineNoiseTexture(),
    bumpScale: 0.02,
    side: THREE.DoubleSide
  });

  // Carcasa Externa (Negra)
  const outGeo = generateSweepGeometry(shapes.out, 120, p);
  const outMesh = new THREE.Mesh(outGeo, outerMat);
  outMesh.castShadow = true;
  outMesh.receiveShadow = true;
  guardGroup.add(outMesh);

  // Gel Interno (Blanco)
  const innGeo = generateSweepGeometry(shapes.inn, 120, p);
  const innMesh = new THREE.Mesh(innGeo, innerMat);
  innMesh.castShadow = true;
  innMesh.receiveShadow = true;
  guardGroup.add(innMesh);

  // Grip Oclusal Inferior
  if (p.grip < 3) {
    const gripGroup = new THREE.Group();
    const gripMat = outerMat.clone();
    gripMat.color = new THREE.Color(p.color1).multiplyScalar(0.7);
    
    const w = p.archWidth;
    const d = p.archDepth;
    
    for (let i = 10; i <= 110; i += 5) {
      const t = i / 120;
      if (Math.abs(t - 0.5) < 0.25) continue; // Evitar el centro
      
      const nx_val = (t - 0.5) * 2; 
      const x = (w / 2) * nx_val;
      const z = -d * Math.pow(Math.abs(nx_val), 2.2);
      
      let m;
      if (p.grip === 0) {
        m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), gripMat);
        m.rotation.y = Math.PI / 4;
      } else {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 8), gripMat);
      }
      m.position.set(x, -0.1, z);
      gripGroup.add(m);
    }
    guardGroup.add(gripGroup);
  }

  // Respiraderos (Si aplica)
  if (p.showVents) {
    const ventMat = new THREE.MeshPhysicalMaterial({ color: 0x05080c, roughness: 0.9, metalness: 0 });
    const spread = 0.08;
    const startT = 0.5 - ((p.ventCount - 1) / 2) * spread;

    for (let i = 0; i < p.ventCount; i++) {
      const t = startT + i * spread;
      const nx_val = (t - 0.5) * 2; 
      const x = (p.archWidth / 2) * nx_val;
      const z = -p.archDepth * Math.pow(Math.abs(nx_val), 2.2);
      
      const m = new THREE.Mesh(new THREE.CylinderGeometry(p.ventDiam/2, p.ventDiam/2, p.labialWall+6, 16), ventMat);
      m.position.set(x, p.channelD * 0.5, z);
      m.rotation.x = Math.PI / 2;
      
      // Orientación manual del respiradero
      const delta = 0.01;
      const x_n = (p.archWidth/2) * ((t+delta - 0.5)*2);
      const z_n = -p.archDepth * Math.pow(Math.abs((t+delta - 0.5)*2), 2.2);
      let tx = x_n - x, tz = z_n - z;
      const len = Math.sqrt(tx*tx + tz*tz);
      const normX = tz/len, normZ = -tx/len;
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(normX, 0, normZ).normalize());
      
      guardGroup.add(m);
    }
  }

  // Centrar en pantalla
  guardGroup.position.set(0, 0, 0);

  // Animación de Entrada
  if (!guardGroup.userData.scaled) {
    guardGroup.scale.set(0.01, 0.01, 0.01);
    gsapScaleIn(guardGroup, 1, 600);
    guardGroup.userData.scaled = true;
  }
}

function gsapScaleIn(obj, target, durationMs) {
  const start = performance.now();
  function tick(now) {
    const t = Math.min((now - start) / durationMs, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    const s = ease * target;
    obj.scale.set(s, s, s);
    if (t < 1) requestAnimationFrame(tick);
    else obj.scale.set(target, target, target);
  }
  requestAnimationFrame(tick);
}

// ── UI Logic ───────────────────────────────────────────────────
function buildPresets() {
  const grid = document.getElementById('presets-grid');
  grid.innerHTML = '';
  PRESETS.forEach((pr, idx) => {
    const btn = document.createElement('button');
    btn.className = 'preset-btn' + (idx === 0 ? ' active' : '');
    btn.dataset.id = pr.id;
    btn.id = 'preset-' + pr.id;
    btn.innerHTML = `
      <div class="preset-swatch" style="background:${pr.c1};--color2:${pr.c2}">
        <div style="position:absolute;top:0;right:0;width:50%;height:100%;background:${pr.c2};border-radius:0 50% 50% 0;"></div>
      </div>
      <span class="preset-name">${pr.name}</span>`;
    btn.addEventListener('click', () => applyPreset(pr));
    grid.appendChild(btn);
  });
}

function applyPreset(pr) {
  STATE.color1 = pr.c1; STATE.color2 = pr.c2;
  STATE.metalness = pr.metal; STATE.roughness = pr.rough;

  document.getElementById('color1-dot').style.background = pr.c1;
  document.getElementById('color1-hex').textContent = pr.c1.toUpperCase();
  document.getElementById('color2-dot').style.background = pr.c2;
  document.getElementById('color2-hex').textContent = pr.c2.toUpperCase();
  document.getElementById('inp-color1').value = pr.c1;
  document.getElementById('inp-color2').value = pr.c2;
  document.getElementById('inp-metal').value = pr.metal;
  document.getElementById('val-metal').textContent = Math.round(pr.metal * 100) + '%';
  document.getElementById('inp-rough').value = pr.rough;
  document.getElementById('val-rough').textContent = Math.round(pr.rough * 100) + '%';

  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('preset-' + pr.id)?.classList.add('active');

  buildMouthguard();
  showToast('✦ Preset aplicado: ' + pr.name.replace('\n', ' '));
}

function bindControls() {
  bindColor('inp-color1', 'color1-dot', 'color1-hex', 'color1');
  bindColor('inp-color2', 'color2-dot', 'color2-hex', 'color2');

  bindSlider('inp-width',    'val-width',    'archWidth',   'mm');
  bindSlider('inp-depth',    'val-depth',    'archDepth',   'mm');
  bindSlider('inp-height',   'val-height',   'guardHeight', 'mm');
  bindSlider('inp-labial',   'val-labial',   'labialWall',  'mm');
  bindSlider('inp-channel',  'val-channel',  'channelW',    'mm');
  bindSlider('inp-chandepth','val-chandepth','channelD',    'mm');
  bindSlider('inp-metal', 'val-metal', 'metalness', '%', v => Math.round(v*100)+'%');
  bindSlider('inp-rough',  'val-rough',  'roughness',  '%', v => Math.round(v*100)+'%');
  bindSlider('inp-ventcount', 'val-ventcount', 'ventCount', '', v => Math.round(v));

  document.getElementById('sel-grip').addEventListener('change', e => {
    STATE.grip = parseInt(e.target.value);
    buildMouthguard();
  });

  bindToggle('tog-vents', 'showVents');
  bindToggle('tog-tab', 'showTab');
  bindToggle('tog-ramps', 'showRamps');

  document.getElementById('btn-front').addEventListener('click', () => setView('front'));
  document.getElementById('btn-side').addEventListener('click', () => setView('side'));
  document.getElementById('btn-top').addEventListener('click', () => setView('top'));
  document.getElementById('btn-persp').addEventListener('click', () => setView('persp'));

  document.getElementById('autorotate-btn').addEventListener('click', () => {
    autoRotating = !autoRotating;
    const btn = document.getElementById('autorotate-btn');
    btn.classList.toggle('active', autoRotating);
    btn.querySelector('.ar-label').textContent = autoRotating ? 'Auto ON' : 'Auto OFF';
  });

  document.getElementById('btn-download').addEventListener('click', downloadSTL);
  document.getElementById('btn-reset').addEventListener('click', () => { applyPreset(PRESETS[0]); });
}

function bindColor(inputId, dotId, hexId, stateKey) {
  const input = document.getElementById(inputId);
  const dot = document.getElementById(dotId);
  const hex = document.getElementById(hexId);
  if (!input) return;
  input.parentElement.addEventListener('click', () => input.click());
  input.addEventListener('input', e => {
    STATE[stateKey] = e.target.value;
    dot.style.background = e.target.value;
    hex.textContent = e.target.value.toUpperCase();
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    buildMouthguard();
  });
}

function bindSlider(inputId, valId, stateKey, unit, fmt) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', e => {
    const v = parseFloat(e.target.value);
    STATE[stateKey] = v;
    document.getElementById(valId).textContent = fmt ? fmt(v) : (v + unit);
    buildMouthguard();
    updateInfo();
  });
}

function bindToggle(toggleId, stateKey) {
  const el = document.getElementById(toggleId);
  if (!el) return;
  el.addEventListener('change', e => {
    STATE[stateKey] = e.target.checked;
    buildMouthguard();
  });
}

function setView(view) {
  const targets = {
    front: { pos: [0, 10, 110], up: [0, 1, 0] },
    side:  { pos: [110, 10, -30], up: [0, 1, 0] },
    top:   { pos: [0, 120, -20], up: [0, 0, -1] },
    persp: { pos: [60, 50, 60], up: [0, 1, 0] },
  };
  const t = targets[view];
  if (!t) return;
  const start = performance.now();
  const fromPos = camera.position.clone();
  const toPos = new THREE.Vector3(...t.pos);
  function tick(now) {
    const pct = Math.min((now - start) / 600, 1);
    const ease = 1 - Math.pow(1 - pct, 3);
    camera.position.lerpVectors(fromPos, toPos, ease);
    controls.update();
    if (pct < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateInfo() {
  const el = id => document.getElementById(id);
  if (el('info-width')) el('info-width').textContent = STATE.archWidth + ' mm';
  if (el('info-depth')) el('info-depth').textContent = STATE.archDepth + ' mm';
  if (el('info-height')) el('info-height').textContent = STATE.guardHeight + ' mm';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function hideLoading() {
  const el = document.getElementById('loading');
  if (el) el.classList.add('hidden');
}

function downloadSTL() {
  if (typeof THREE.STLExporter === 'undefined') {
    showToast('❌ STLExporter no disponible');
    return;
  }
  if (!guardGroup) return;
  showToast('⏳ Generando STL…');
  setTimeout(() => {
    try {
      const exporter = new THREE.STLExporter();
      const tmp = new THREE.Group();
      guardGroup.traverse(obj => {
        if (obj.isMesh && obj.geometry) {
          const cloneGeo = obj.geometry.clone();
          cloneGeo.applyMatrix4(obj.matrixWorld);
          tmp.add(new THREE.Mesh(cloneGeo));
        }
      });
      const stlStr = exporter.parse(tmp, { binary: false });
      const blob = new Blob([stlStr], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bucal_adx_${Date.now()}.stl`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('✅ STL descargado');
    } catch (err) {
      console.error(err);
      showToast('❌ Error al generar STL');
    }
  }, 50);
}
