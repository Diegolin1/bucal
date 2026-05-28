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
  viewMode:    'param', // 'param' o 'tripo'
  color1:      '#ff1493',
  color2:      '#ffb6c1',
  metalness:   0.1,
  roughness:   0.15,
  archWidth:   62,
  archDepth:   42,
  guardHeight: 22,
  labialWall:  5.0,
  palatalWall: 4.5,
  channelW:    12.0, 
  channelD:    8.0,
  showVents:   true,
  ventCount:   3,
  ventDiam:    3.5,
  showRamps:   true,
  showTab:     true,
  gripType:    0, // 0:Diamond, 1:Lines, 2:Dots, 3:None
  logoTex:     null,
  logoScale:   1.0
};

const RENDER_PRESETS = {
  param: {
    ambient: 0.8,
    key: 1.4,
    fill: 0.6,
    rim: 0.9,
    kicker: 0.0,
    exposure: 1.1,
    shadowOpacity: 0.15
  },
  tripo: {
    ambient: 0.45,
    key: 1.9,
    fill: 0.35,
    rim: 1.2,
    kicker: 0.7,
    exposure: 1.2,
    shadowOpacity: 0.28
  }
};

// Variables para el Recortador 2D
let isDraggingCrop = false;
let startCropX = 0, startCropY = 0;
let imgCropX = 0, imgCropY = 0;

let scene, camera, renderer, controls;
let guardGroup;
let animId, autoRotating = true;
let lightRig;
let shadowPlane;
let renderPreset = 'param';
let studioEnvTexture = null;
let studioHDRI = null;
let studioHDRILoading = false;

const STUDIO_HDRI_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_03_1k.hdr';

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
  lightRig = {};
  lightRig.ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(lightRig.ambient);

  lightRig.key = new THREE.DirectionalLight(0xffffff, 1.4);
  lightRig.key.position.set(40, 80, 80);
  lightRig.key.castShadow = true;
  lightRig.key.shadow.mapSize.width = 2048;
  lightRig.key.shadow.mapSize.height = 2048;
  scene.add(lightRig.key);

  lightRig.fill = new THREE.DirectionalLight(0xddeeff, 0.6);
  lightRig.fill.position.set(-60, 20, 40);
  scene.add(lightRig.fill);

  lightRig.rim = new THREE.DirectionalLight(0xffffff, 0.9);
  lightRig.rim.position.set(0, 40, -100);
  scene.add(lightRig.rim);

  lightRig.kicker = new THREE.PointLight(0xffffff, 0.7, 200);
  lightRig.kicker.position.set(0, 28, 85);
  lightRig.kicker.visible = false;
  scene.add(lightRig.kicker);

  const planeGeo = new THREE.PlaneGeometry(300, 300);
  const planeMat = new THREE.ShadowMaterial({ opacity: 0.15 });
  shadowPlane = new THREE.Mesh(planeGeo, planeMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = -5;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);

  window.addEventListener('resize', () => {
    const w = vp.clientWidth, h = vp.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  setRenderPreset(STATE.viewMode);
}

function animate() {
  animId = requestAnimationFrame(animate);
  if (autoRotating && guardGroup) {
    guardGroup.rotation.y += 0.005;
  }
  controls.update();
  renderer.render(scene, camera);
}

function setRenderPreset(mode) {
  const preset = RENDER_PRESETS[mode] || RENDER_PRESETS.param;
  if (!lightRig || !renderer) return;

  lightRig.ambient.intensity = preset.ambient;
  lightRig.key.intensity = preset.key;
  lightRig.fill.intensity = preset.fill;
  lightRig.rim.intensity = preset.rim;
  lightRig.kicker.intensity = preset.kicker;
  lightRig.kicker.visible = preset.kicker > 0.01;

  if (shadowPlane && shadowPlane.material) {
    shadowPlane.material.opacity = preset.shadowOpacity;
    shadowPlane.material.needsUpdate = true;
  }

  renderer.toneMappingExposure = preset.exposure;

  if (mode === 'tripo') {
    ensureStudioHDRI();
    const env = studioHDRI || getStudioEnvTexture();
    if (env) scene.environment = env;
  } else {
    scene.environment = null;
  }

  renderPreset = mode;
}

function buildEnvFace(size, topColor, bottomColor) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75);
  vignette.addColorStop(0, 'rgba(255,255,255,0.05)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function getStudioEnvTexture() {
  if (studioEnvTexture || !renderer) return studioEnvTexture;
  const size = 256;
  const px = buildEnvFace(size, '#f4f6f8', '#9aa3ad');
  const nx = buildEnvFace(size, '#f1f3f5', '#8f98a2');
  const py = buildEnvFace(size, '#ffffff', '#cfd6dd');
  const ny = buildEnvFace(size, '#6b737d', '#20252b');
  const pz = buildEnvFace(size, '#f2f4f7', '#9099a3');
  const nz = buildEnvFace(size, '#eef1f4', '#8b949f');

  const cube = new THREE.CubeTexture([px, nx, py, ny, pz, nz]);
  cube.encoding = THREE.sRGBEncoding;
  cube.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromCubemap(cube).texture;
  pmrem.dispose();

  studioEnvTexture = env;
  return studioEnvTexture;
}

function ensureStudioHDRI() {
  if (studioHDRI || studioHDRILoading || !renderer) return;
  if (typeof THREE.RGBELoader === 'undefined') return;
  studioHDRILoading = true;

  const loader = new THREE.RGBELoader();
  loader.setDataType(THREE.UnsignedByteType);
  loader.load(
    STUDIO_HDRI_URL,
    (texture) => {
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromEquirectangular(texture).texture;
      pmrem.dispose();
      texture.dispose();
      studioHDRI = env;
      studioHDRILoading = false;
      if (renderPreset === 'tripo' || STATE.viewMode === 'tripo') {
        scene.environment = studioHDRI;
      }
    },
    undefined,
    (err) => {
      console.warn('HDRI load failed:', err);
      studioHDRILoading = false;
    }
  );
}

// ── Perfiles Doble Densidad (Proporciones Exactas Dinámicas) ──
function createDualShapes(p) {
  const rInner = 2.0; 
  
  // Profundidad del canal = Qué tan profundo entran los dientes desde arriba
  let floorTopY = p.guardHeight - p.channelD;
  if (floorTopY < 3.0) floorTopY = 3.0; // Base protectora inferior mínima de 3mm
  
  const rOuter = Math.min(4.0, floorTopY * 0.8);
  const outT = 2.0; 
  
  const labOutX = p.channelW/2 + p.labialWall;
  const palOutX = -p.channelW/2 - p.palatalWall;
  const labInX = p.channelW/2;
  const palInX = -p.channelW/2;
  
  const labTopY = p.guardHeight;
  const palTopY = p.guardHeight - 1.0; 
  
  // 1. CARCASA EXTERIOR
  const out = new THREE.Shape();
  out.moveTo(palOutX, palTopY - 1.5);
  out.lineTo(palOutX, rOuter);
  out.quadraticCurveTo(palOutX, 0, palOutX + rOuter, 0); 
  out.lineTo(labOutX - rOuter, 0);
  out.quadraticCurveTo(labOutX, 0, labOutX, rOuter);
  out.lineTo(labOutX, labTopY - 1.5);
  // Bisel interno
  out.lineTo(labOutX - outT, labTopY - 1.5);
  out.lineTo(labOutX - outT, outT);
  out.lineTo(palOutX + outT, outT);
  out.lineTo(palOutX + outT, palTopY - 1.5);
  
  // 2. GEL INTERNO
  const inn = new THREE.Shape();
  inn.moveTo(palOutX + outT, palTopY - 1.5);
  inn.lineTo(palOutX + outT, outT);
  inn.lineTo(labOutX - outT, outT); 
  inn.lineTo(labOutX - outT, labTopY - 1.5);
  
  // Rebose acolchado labial
  inn.lineTo(labOutX + 0.5, labTopY - 1.5);
  inn.lineTo(labOutX + 0.5, labTopY - rInner);
  inn.quadraticCurveTo(labOutX + 0.5, labTopY, labOutX - rInner, labTopY);
  
  // Caída al canal dental
  inn.lineTo(labInX + rInner, labTopY);
  inn.quadraticCurveTo(labInX, labTopY, labInX, labTopY - rInner);
  
  // Suelo del canal
  inn.lineTo(labInX, floorTopY + rInner);
  inn.quadraticCurveTo(labInX, floorTopY, labInX - rInner, floorTopY);
  inn.lineTo(palInX + rInner, floorTopY);
  inn.quadraticCurveTo(palInX, floorTopY, palInX, floorTopY + rInner);
  
  // Subida palatina
  inn.lineTo(palInX, palTopY - rInner);
  inn.quadraticCurveTo(palInX, palTopY, palInX - rInner, palTopY);
  inn.lineTo(palOutX - 0.5, palTopY);
  inn.lineTo(palOutX - 0.5, palTopY - 1.5);
  
  return { out, inn };
}

// ── Prototipo AI (Tripo 3D) ──
function getTripoParams() {
  return {
    ...STATE,
    archWidth: 66,
    archDepth: 44,
    guardHeight: 19.5,
    labialWall: 5.5,
    palatalWall: 4.8,
    channelW: 10.5,
    channelD: 7.5
  };
}

function createTripoShape(p) {
  const s = new THREE.Shape();
  const labX = p.channelW/2 + p.labialWall; 
  const palX = -p.channelW/2 - p.palatalWall; 
  const H = p.guardHeight; 
  const rBase = 3.0;
  
  s.moveTo(palX, H - 2);
  s.lineTo(palX, rBase);
  s.quadraticCurveTo(palX, 0, palX + rBase, 0); 
  
  s.lineTo(labX - rBase, 0);
  s.quadraticCurveTo(labX, 0, labX, rBase);
  
  s.lineTo(labX, H - 1.5);
  s.quadraticCurveTo(labX, H, labX - 1.5, H);
  
  const floorY = H - p.channelD; 
  s.bezierCurveTo(labX - 2.0, H,   labX/2, floorY,   0, floorY);
  s.bezierCurveTo(palX/2, floorY,   palX + 2.0, H - 1,   palX + 1.5, H - 1);
  s.quadraticCurveTo(palX, H, palX, H - 2);
  
  return s;
}

function getTripoInnerParams(p) {
  const inset = 1.2;
  return {
    ...p,
    labialWall: Math.max(3.0, p.labialWall - inset),
    palatalWall: Math.max(3.0, p.palatalWall - inset),
    channelW: Math.max(8.5, p.channelW - 1.1),
    channelD: Math.max(5.5, p.channelD - 1.0),
    guardHeight: Math.max(16.0, p.guardHeight - 1.0)
  };
}

function createTripoMaterials(p) {
  const roughTex = getMicroRoughnessTexture();
  const bumpTex = getFineNoiseTexture();
  const normalTex = getMicroNormalTexture();
  const outerColor = new THREE.Color(p.color1);
  const innerColor = new THREE.Color(p.color2).lerp(outerColor, 0.35);

  const outer = new THREE.MeshPhysicalMaterial({
    color: outerColor,
    metalness: 0.0,
    roughness: 0.22,
    transmission: 0.6,
    ior: 1.46,
    transparent: true,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.2,
    bumpMap: bumpTex,
    bumpScale: 0.03,
    roughnessMap: roughTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.35, 0.2),
    side: THREE.DoubleSide
  });

  const inner = new THREE.MeshPhysicalMaterial({
    color: innerColor,
    metalness: 0.0,
    roughness: 0.36,
    transmission: 0.25,
    ior: 1.46,
    transparent: true,
    clearcoat: 0.2,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.6,
    bumpMap: bumpTex,
    bumpScale: 0.02,
    roughnessMap: roughTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(0.18, 0.12),
    side: THREE.DoubleSide
  });

  return { outer, inner };
}

// ── Matemáticas Anatómicas "Sculpt" ──
function getLabialHeight(u) {
  let base = 1.0;
  if (u > 0.4) {
    base = 1.0 - 0.5 * Math.pow((u - 0.4) / 0.6, 1.5);
  }
  let frenulum = -0.35 * Math.exp(-Math.pow(u / 0.05, 2));
  let central = 0.06 * Math.exp(-Math.pow((u - 0.08) / 0.04, 2));
  let lateral = 0.03 * Math.exp(-Math.pow((u - 0.18) / 0.04, 2));
  let canine = 0.1 * Math.exp(-Math.pow((u - 0.32) / 0.06, 2));
  return base + frenulum + central + lateral + canine;
}

function getPalatalHeight(u) {
  let base = 0.8; 
  if (u > 0.4) {
    base = 0.8 - 0.3 * Math.pow((u - 0.4) / 0.6, 1.5); 
  }
  let centerDip = -0.2 * Math.exp(-Math.pow(u / 0.15, 2));
  return base + centerDip;
}

function getPalatalThickness(u) {
  return 0.4 + 0.6 * Math.exp(-Math.pow(u / 0.3, 2));
}

function organicNoise(x, y, z) {
  return (Math.sin(x*3.1) * Math.cos(y*4.3) * Math.sin(z*2.7) + 
          Math.sin(x*7.2 + z*5.1) * Math.cos(y*6.3)) * 0.5;
}

// ── Barrido Parabólico Personalizado (Orientación 100% Perfecta) ──
function generateSweepGeometry(profileShape, steps, p, closeCaps = true) {
  const profile2D = profileShape.getPoints(40);
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
      let px = profile2D[j].x; // X = Ancho/Grosor
      let py = profile2D[j].y; // Y = Altura (Arriba/Abajo)
      
      // ── DEFORMACIÓN ANATÓMICA "SCULPT" ──
      const u = Math.abs(t - 0.5) * 2;
      
      if (px > 0) {
        // Pared Labial (Frontal exterior real)
        let hMod = getLabialHeight(u);
        if (py > p.channelD) {
          let factor = (py - p.channelD) / (p.guardHeight - p.channelD);
          let targetY = p.channelD + (p.guardHeight - p.channelD) * hMod;
          py = p.channelD + (targetY - p.channelD) * factor;
        }
      } else if (px < -p.channelW/2) {
        // Pared Palatina (Interior real)
        let hMod = getPalatalHeight(u);
        let topY = p.guardHeight - 1.0;
        
        if (py > p.channelD) {
          let factor = (py - p.channelD) / (topY - p.channelD);
          if (factor > 1) factor = 1;
          let targetY = p.channelD + (topY - p.channelD) * hMod;
          py = p.channelD + (targetY - p.channelD) * factor;
        }
        
        let thickMod = getPalatalThickness(u);
        let wallX = px + (p.channelW/2); 
        px = -p.channelW/2 + wallX * thickMod;
      }
      
      // Ruido Orgánico Superficial (Sutil "Pinceladas")
      if (Math.abs(px) > p.channelW/2 + 1.0) {
        let noiseAmount = 0.15 * organicNoise(x, py, z);
        px += noiseAmount;
        py += noiseAmount * 0.5;
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

// ── Generador de Piel "Full Wrap" ──
function generateWrapGeometry(p) {
  const stepsX = 400;
  const stepsY = 40;
  const geo = new THREE.PlaneGeometry(1, 1, stepsX, stepsY);
  const pos = geo.attributes.position;
  
  const w = p.archWidth;
  const d = p.archDepth;
  
  let floorTopY = p.guardHeight - p.channelD;
  if (floorTopY < 3.0) floorTopY = 3.0;
  const rOuter = Math.min(4.0, floorTopY * 0.8);

  for(let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5; // 0 a 1
    const v = pos.getY(i) + 0.5; // 0 a 1
    const t = u; // Mapeo directo del arco
    
    const nx_val = (t - 0.5) * 2;
    const x = (w / 2) * nx_val;
    const z = -d * Math.pow(Math.abs(nx_val), 2.2);
    const delta = 0.001;
    const t_n = t + delta;
    const nx_n = (t_n - 0.5) * 2;
    const x_n = (w / 2) * nx_n;
    const z_n = -d * Math.pow(Math.abs(nx_n), 2.2);
    const tx = x_n - x, tz = z_n - z;
    const len = Math.sqrt(tx*tx + tz*tz);
    const normX = -tz/len, normZ = tx/len;
    
    const u_norm = Math.abs(t - 0.5) * 2;
    
    let hMod = getLabialHeight(u_norm);
    let targetTopY = p.channelD + (p.guardHeight - p.channelD) * hMod;
    
    let py = targetTopY * v;
    
    const labOutX = p.channelW/2 + p.labialWall;
    let px = labOutX;
    
    if (py < rOuter) {
      if (py >= 0) {
        px = (labOutX - rOuter) + Math.sqrt(Math.pow(rOuter, 2) - Math.pow(py - rOuter, 2));
      } else {
        px = labOutX - rOuter;
      }
    } else if (py > targetTopY - 1.5) {
      px = labOutX - (py - (targetTopY - 1.5));
    }
    
    px += 0.2; // Offset para que la piel flote
    
    // Ruido Orgánico Superficial (Sutil)
    let noiseAmount = 0.15 * organicNoise(x, py, z);
    px += noiseAmount;
    py += noiseAmount * 0.5;
    
    pos.setXYZ(i, x + normX * px, py, z + normZ * px);
  }
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

let _roughTex = null;
function getMicroRoughnessTexture() {
  if (_roughTex) return _roughTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(256, 256);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const val = 110 + (Math.random() * 90);
    imgData.data[i] = val;
    imgData.data[i+1] = val;
    imgData.data[i+2] = val;
    imgData.data[i+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  _roughTex = new THREE.CanvasTexture(canvas);
  _roughTex.wrapS = THREE.RepeatWrapping;
  _roughTex.wrapT = THREE.RepeatWrapping;
  _roughTex.repeat.set(18, 18);
  return _roughTex;
}

let _microNormalTex = null;
function getMicroNormalTexture() {
  if (_microNormalTex) return _microNormalTex;
  const size = 256;
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const stripe = Math.sin((y / size) * Math.PI * 2 * 22) * 0.5 + 0.5;
      const jitter = Math.random() * 0.2;
      height[idx] = stripe * 0.7 + jitter * 0.3;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);

  const strength = 3.0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = y * size + x;
      const x1 = (x + 1) % size;
      const y1 = (y + 1) % size;
      const x0 = (x - 1 + size) % size;
      const y0 = (y - 1 + size) % size;

      const hL = height[y * size + x0];
      const hR = height[y * size + x1];
      const hU = height[y0 * size + x];
      const hD = height[y1 * size + x];

      let nx = (hL - hR) * strength;
      let ny = (hU - hD) * strength;
      let nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
      nx /= len; ny /= len; nz /= len;

      const out = idx * 4;
      imgData.data[out] = Math.round((nx * 0.5 + 0.5) * 255);
      imgData.data[out + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      imgData.data[out + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      imgData.data[out + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  _microNormalTex = new THREE.CanvasTexture(canvas);
  _microNormalTex.wrapS = THREE.RepeatWrapping;
  _microNormalTex.wrapT = THREE.RepeatWrapping;
  _microNormalTex.repeat.set(26, 26);
  return _microNormalTex;
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

  setRenderPreset(STATE.viewMode);

  const p = STATE.viewMode === 'tripo' ? getTripoParams() : STATE;
  let gripBaseMat = null;

  if (STATE.viewMode === 'tripo') {
    const mats = createTripoMaterials(p);
    gripBaseMat = mats.outer;

    const tripoShape = createTripoShape(p);
    const tripoGeo = generateSweepGeometry(tripoShape, 800, p, true); // Ultra High Res
    const tripoMesh = new THREE.Mesh(tripoGeo, mats.outer);
    tripoMesh.castShadow = true;
    tripoMesh.receiveShadow = true;
    tripoMesh.renderOrder = 1;
    guardGroup.add(tripoMesh);

    const innerParams = getTripoInnerParams(p);
    const tripoInnerShape = createTripoShape(innerParams);
    const tripoInnerGeo = generateSweepGeometry(tripoInnerShape, 700, innerParams, true);
    const tripoInnerMesh = new THREE.Mesh(tripoInnerGeo, mats.inner);
    tripoInnerMesh.castShadow = true;
    tripoInnerMesh.receiveShadow = true;
    tripoInnerMesh.renderOrder = 0;
    guardGroup.add(tripoInnerMesh);
  } else {
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

    const { out, inn } = createDualShapes(p);
    const innerMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(p.color2),
      metalness: Math.max(0, p.metalness - 0.1),
      roughness: Math.min(1, p.roughness + 0.1),
      clearcoat: 0.8,
      bumpMap: getFineNoiseTexture(),
      bumpScale: 0.02,
      side: THREE.DoubleSide
    });

    const outGeo = generateSweepGeometry(out, 400, p, true);
    const outMesh = new THREE.Mesh(outGeo, outerMat);
    outMesh.castShadow = true;
    outMesh.receiveShadow = true;
    guardGroup.add(outMesh);

    const innGeo = generateSweepGeometry(inn, 400, p, true);
    const innMesh = new THREE.Mesh(innGeo, innerMat);
    innMesh.castShadow = true;
    innMesh.receiveShadow = true;
    guardGroup.add(innMesh);

    gripBaseMat = outerMat;
  }
  
  // Grip Oclusal Inferior
  if (p.gripType < 3 && gripBaseMat) {
    const gripGroup = new THREE.Group();
    const gripMat = gripBaseMat.clone();
    gripMat.color = new THREE.Color(p.color1).multiplyScalar(0.7);
    
    const w = p.archWidth;
    const d = p.archDepth;
    
    for (let i = 10; i <= 110; i += 5) {
      const t = i / 120;
      if (Math.abs(t - 0.5) < 0.25) continue; 
      
      const nx_val = (t - 0.5) * 2; 
      const x = (w / 2) * nx_val;
      const z = -d * Math.pow(Math.abs(nx_val), 2.2);
      
      let m;
      if (p.gripType === 0) {
        m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), gripMat);
        m.rotation.y = Math.PI / 4;
      } else if (p.gripType === 1) {
        m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 0.5), gripMat);
      } else {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 8), gripMat);
      }
      m.position.set(x, -0.1, z);
      gripGroup.add(m);
    }
    guardGroup.add(gripGroup);
  }

  // Piel Frontal (Full Wrap)
  if (STATE.logoTex) {
    const wrapGeo = generateWrapGeometry(p);
    const wrapMat = new THREE.MeshStandardMaterial({
      map: STATE.logoTex,
      transparent: true,
      roughness: STATE.roughness,
      metalness: STATE.metalness,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1
    });
    const wrapMesh = new THREE.Mesh(wrapGeo, wrapMat);
    guardGroup.add(wrapMesh);
  }

  // Respiraderos
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
      
      const delta = 0.01;
      const x_n = (p.archWidth/2) * ((t+delta - 0.5)*2);
      const z_n = -p.archDepth * Math.pow(Math.abs((t+delta - 0.5)*2), 2.2);
      let tx = x_n - x, tz = z_n - z;
      const len = Math.sqrt(tx*tx + tz*tz);
      const normX = -tz/len, normZ = tx/len;
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), new THREE.Vector3(normX, 0, normZ).normalize());
      guardGroup.add(m);
    }
  }

  guardGroup.position.set(0, 0, 0);

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
  // Eventos de Pestañas de Modo
  const btnParam = document.getElementById('btn-mode-param');
  const btnTripo = document.getElementById('btn-mode-tripo');
  const panelAjuste = document.getElementById('panel-ajuste');

  if (btnParam && btnTripo) {
    btnParam.addEventListener('click', () => {
      STATE.viewMode = 'param';
      btnParam.style.background = '#ff1493';
      btnParam.style.color = 'white';
      btnTripo.style.background = '#333';
      btnTripo.style.color = '#ccc';
      if (panelAjuste) panelAjuste.style.display = 'block';
      buildMouthguard();
    });
    btnTripo.addEventListener('click', () => {
      STATE.viewMode = 'tripo';
      btnTripo.style.background = '#ff1493';
      btnTripo.style.color = 'white';
      btnParam.style.background = '#333';
      btnParam.style.color = '#ccc';
      if (panelAjuste) panelAjuste.style.display = 'none';
      buildMouthguard();
    });
  }

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

  document.getElementById('sel-grip').addEventListener('change', (e) => { STATE.gripType = parseInt(e.target.value); buildMouthguard(); });

// ── Lógica de UI para Recorte 2D ──
  document.getElementById('inp-logo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
          const texture = new THREE.Texture(img);
          texture.encoding = THREE.sRGBEncoding;
          texture.center.set(0, 1); // Origen Top-Left
          texture.needsUpdate = true;
          STATE.logoTex = texture;
          
          document.getElementById('crop-ui').style.display = 'block';
          document.getElementById('crop-img').src = evt.target.result;
          
          imgCropX = 0;
          imgCropY = 0;
          STATE.logoScale = 1.0;
          document.getElementById('inp-logoscale').value = 1.0;
          updateCropTexture();
          buildMouthguard();
        };
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });
  
  function updateCropTexture() {
    if (!STATE.logoTex) return;
    const scale = STATE.logoScale; 
    const cropImg = document.getElementById('crop-img');
    cropImg.style.width = (100 * scale) + '%';
    cropImg.style.left = imgCropX + '%';
    cropImg.style.top = imgCropY + '%';
    
    // Aplicar a Three.js
    STATE.logoTex.repeat.set(1 / scale, 1 / scale);
    STATE.logoTex.offset.set(
      -(imgCropX / 100) / scale,
      (imgCropY / 100) / scale
    );
  }

  const cropBox = document.getElementById('crop-box');
  cropBox.addEventListener('mousedown', (e) => {
    isDraggingCrop = true;
    startCropX = e.clientX;
    startCropY = e.clientY;
  });
  window.addEventListener('mousemove', (e) => {
    if (!isDraggingCrop) return;
    const dx = e.clientX - startCropX;
    const dy = e.clientY - startCropY;
    startCropX = e.clientX;
    startCropY = e.clientY;
    
    const boxW = cropBox.clientWidth;
    const boxH = cropBox.clientHeight;
    
    imgCropX += (dx / boxW) * 100;
    imgCropY += (dy / boxH) * 100;
    
    updateCropTexture();
  });
  window.addEventListener('mouseup', () => { isDraggingCrop = false; });
  
  const inpLogoScale = document.getElementById('inp-logoscale');
  if(inpLogoScale) {
    inpLogoScale.addEventListener('input', (e) => {
      STATE.logoScale = parseFloat(e.target.value);
      document.getElementById('val-logoscale').innerText = STATE.logoScale.toFixed(2) + 'x';
      updateCropTexture();
    });
  }

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
