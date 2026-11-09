/* ===== Garbsen als Miniatur (Three.js) =====
   Ein Stück Nachbarschaft zum Anfassen: Klinkerhäuser mit Schieferdach, Hecken, eine Straße mit Gehweg,
   der Kanal vorne und ein Rapsfeld. Über den Dächern hängen die offenen Anfragen als Preisschilder.
   Die Schilder sind echte Knöpfe im HTML (lesbar, antippbar, mit Tastatur erreichbar), die Szene liegt dahinter.
   Aufruf: garbsenMiniatur(THREE, huelle, { nacht, wennSchild, foto }) → { schilder(liste), nacht(an), ende() } */
function garbsenMiniatur(THREE, huelle, opt = {}) {
  const reduziert = !!opt.foto || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const leinwand = document.createElement('canvas');
  leinwand.className = 'mini-leinwand';
  leinwand.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: leinwand, antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: !!opt.foto });
  } catch (e) {
    return null;
  }
  huelle.insertBefore(leinwand, huelle.firstChild);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(24, 1.6, 1, 140);
  const welt = new THREE.Group();
  szene.add(welt);

  // Immer gleicher Zufall, damit Ziegel und Fenster bei jedem Start gleich aussehen
  let saat = 20261109;
  const zufall = () => { saat |= 0; saat = (saat + 0x6D2B79F5) | 0; let t = Math.imul(saat ^ (saat >>> 15), 1 | saat); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ----- Farben: Klinker, Schiefer, Hecke, Raps, Kanal ----- */
  const F = {
    rasen: 0x86BE62, rasenStreifen: 0x93C96E, erde: 0x8A6A4C, erdeDunkel: 0x6F543C, sockel: 0xC9C0B4,
    klinker: [0x9E3A2B, 0xB04A36, 0x8E3427, 0xA8452F, 0x963A2E, 0xB2533B, 0x9A3F30],
    dach: [0x4A5462, 0x6E4034, 0x4A5462, 0x8C3B2B, 0x56606E, 0x4A5462, 0x6E4034],
    rahmen: 0xF3EFE8, glas: 0x2D4357, tuer: [0x2E6A86, 0x2F7346, 0x3B4552, 0xE9A800, 0x2E6A86, 0x7A2F2A, 0x2F7346],
    strasse: 0x666E78, gehweg: 0xD6D0C6, linie: 0xF4F2EC, hecke: 0x3D7E45, hecke2: 0x4A8C4C,
    baum: [0x5B9C4C, 0x6CAD54, 0x4C8E46], stamm: 0x76573C, nadel: 0x2E6A44, raps: 0xF2C318, rapsGruen: 0x7DAA48,
    wasser: 0x4E9FCC, auto: [0x3F6E99, 0xE6E2DA], post: 0xF4B400, mast: 0x3B4552, haut: 0xE8B892,
  };

  /* ----- Bausteine ----- */
  const mats = new Map();
  const mat = (farbe, extra) => {
    const k = farbe + (extra ? JSON.stringify(extra) : '');
    if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.86, metalness: 0, ...(extra || {}) }));
    return mats.get(k);
  };
  const geos = new Map();
  const geo = (k, bau) => { if (!geos.has(k)) geos.set(k, bau()); return geos.get(k); };
  const kiste = (b, h, t) => geo(`k${b}|${h}|${t}`, () => new THREE.BoxGeometry(b, h, t));
  const kugel = (r, d = 2) => geo(`s${r}|${d}`, () => new THREE.IcosahedronGeometry(r, d));
  const rolle = (r1, r2, h, n = 16) => geo(`c${r1}|${r2}|${h}|${n}`, () => new THREE.CylinderGeometry(r1, r2, h, n));
  // Weiche Kiste: abgerundete Kanten wie Knete
  function weich(b, h, t, r = 0.08) {
    return geo(`w${b}|${h}|${t}|${r}`, () => {
      const s = new THREE.Shape();
      const x = b / 2 - r, y = t / 2 - r, e = Math.min(r * 1.4, x, y);
      s.moveTo(-x + e, -y); s.lineTo(x - e, -y); s.quadraticCurveTo(x, -y, x, -y + e); s.lineTo(x, y - e);
      s.quadraticCurveTo(x, y, x - e, y); s.lineTo(-x + e, y); s.quadraticCurveTo(-x, y, -x, y - e); s.lineTo(-x, -y + e); s.quadraticCurveTo(-x, -y, -x + e, -y);
      const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 4 });
      g.rotateX(-Math.PI / 2);
      g.translate(0, -(h / 2 - r), 0);
      g.computeVertexNormals();
      return g;
    });
  }
  function teil(g, m, x, y, z, eltern = welt, schatten = true) {
    const n = new THREE.Mesh(g, m);
    n.position.set(x, y, z);
    n.castShadow = schatten;
    n.receiveShadow = true;
    eltern.add(n);
    return n;
  }
  const aufbau = []; // Teile, die beim Start nacheinander auf den Tisch gesetzt werden
  function gruppe(x, z, verz) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    welt.add(g);
    aufbau.push({ g, verz });
    return g;
  }

  // Ziegel als Bild, pro Farbe einmal gemalt
  const ziegelBilder = new Map();
  function ziegel(farbe) {
    if (!ziegelBilder.has(farbe)) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#d9d0c5';
      x.fillRect(0, 0, 128, 128);
      const basis = new THREE.Color(farbe);
      for (let r = 0; r < 8; r++) {
        for (let s = -1; s < 4; s++) {
          const f = basis.clone().offsetHSL((zufall() - 0.5) * 0.015, 0, (zufall() - 0.5) * 0.09);
          x.fillStyle = '#' + f.getHexString();
          x.fillRect(s * 32 + (r % 2) * 16 + 1.5, r * 16 + 1.5, 29, 13);
        }
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 4;
      ziegelBilder.set(farbe, t);
    }
    return ziegelBilder.get(farbe);
  }
  function wandMat(farbe, b, h) {
    const t = ziegel(farbe).clone();
    t.repeat.set(b / 1.05, h / 0.85);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0 });
  }

  // Dachziegel: Reihen parallel zum First
  const dachBild = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#c9c9c9';
    x.fillRect(0, 0, 7, 64);
    x.fillStyle = '#e6e6e6';
    x.fillRect(7, 0, 6, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 0.2, 1 / 0.2);
    t.anisotropy = 4;
    return t;
  })();
  const dachMats = new Map();
  const dachMat = (farbe) => {
    if (!dachMats.has(farbe)) dachMats.set(farbe, new THREE.MeshStandardMaterial({ color: farbe, map: dachBild, roughness: 0.7 }));
    return dachMats.get(farbe);
  };

  // Fenster leuchten abends, nicht alle
  const glasAn = new THREE.MeshStandardMaterial({ color: F.glas, roughness: 0.22, metalness: 0.15, emissive: 0xFFB54A, emissiveIntensity: 0 });
  const glasAus = new THREE.MeshStandardMaterial({ color: F.glas, roughness: 0.22, metalness: 0.15 });

  /* ----- Der Tisch: Rasen, Erde, Kanal ----- */
  const BREIT = 15, HINTEN = -5, KANAL = 4.5, VORN = 5.7, R = 0.7;
  function form(x0, x1, z0, z1, ecken) {
    // ecken: [hinten links, hinten rechts, vorne rechts, vorne links] gerundet? Formkoordinate y = -z
    const s = new THREE.Shape();
    const [hl, hr, vr, vl] = ecken.map((e) => (e ? R : 0));
    s.moveTo(x0 + vl, -z1);
    s.lineTo(x1 - vr, -z1); if (vr) s.quadraticCurveTo(x1, -z1, x1, -z1 + vr);
    s.lineTo(x1, -z0 - hr); if (hr) s.quadraticCurveTo(x1, -z0, x1 - hr, -z0);
    s.lineTo(x0 + hl, -z0); if (hl) s.quadraticCurveTo(x0, -z0, x0, -z0 - hl);
    s.lineTo(x0, -z1 + vl); if (vl) s.quadraticCurveTo(x0, -z1, x0 + vl, -z1);
    return s;
  }
  function platte(shape, dicke, oben, material, bevel = 0.06) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: dicke - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, oben - dicke + bevel, 0);
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    welt.add(m);
    return m;
  }
  // Rasen mit Mähstreifen
  const streifen = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#' + new THREE.Color(F.rasen).getHexString();
    x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#' + new THREE.Color(F.rasenStreifen).getHexString();
    x.fillRect(0, 0, 32, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 1.6, 1 / 1.6);
    return t;
  })();
  const rasenMat = new THREE.MeshStandardMaterial({ map: streifen, roughness: 0.95 });
  platte(form(-BREIT / 2, BREIT / 2, HINTEN, VORN, [1, 1, 1, 1]), 1.15, -0.28, [mat(F.erde), mat(F.erde)], 0.1);
  platte(form(-BREIT / 2, BREIT / 2, HINTEN, VORN, [1, 1, 1, 1]), 0.22, -1.1, mat(F.erdeDunkel), 0.08);
  platte(form(-BREIT / 2, BREIT / 2, HINTEN, KANAL, [1, 1, 0, 0]), 0.3, 0, [rasenMat, mat(F.rasen)], 0.05);
  const wasser = platte(form(-BREIT / 2, BREIT / 2, KANAL, VORN, [0, 0, 1, 1]), 0.2, -0.16, mat(F.wasser, { roughness: 0.18, metalness: 0.05, transparent: true, opacity: 0.94 }), 0.04);
  wasser.receiveShadow = true;
  // Uferkante aus Stein
  teil(kiste(BREIT - 0.02, 0.12, 0.16), mat(F.sockel), 0, -0.02, KANAL + 0.06);

  /* ----- Straße mit Gehwegen ----- */
  const STR = 0.95;
  teil(kiste(BREIT - 0.04, 0.05, 1.9), mat(F.strasse, { roughness: 0.95 }), 0, 0.02, STR, welt, false);
  teil(kiste(BREIT - 0.04, 0.1, 0.56), mat(F.gehweg), 0, 0.05, STR - 1.23);
  teil(kiste(BREIT - 0.04, 0.1, 0.56), mat(F.gehweg), 0, 0.05, STR + 1.23);
  for (let x = -6.6; x <= 6.6; x += 1.2) teil(kiste(0.55, 0.012, 0.07), mat(F.linie), x, 0.05, STR, welt, false);

  /* ----- Häuser ----- */
  const haeuser = [];
  function haus(nr, x, z, { b = 2.3, t = 2.0, h = 2.0, blick = 1, gaube = false, verz = 0, stiel = 14 }) {
    const g = gruppe(x, z, verz);
    if (blick < 0) g.rotation.y = Math.PI;
    const klinker = F.klinker[nr % F.klinker.length];
    teil(kiste(b + 0.14, 0.2, t + 0.14), mat(F.sockel), 0, 0.1, 0, g);
    teil(kiste(b, h, t), wandMat(klinker, b, h), 0, 0.2 + h / 2, 0, g);
    // Satteldach mit Überstand
    const ue = 0.24, dh = Math.min(1.25, t * 0.58), lang = b + 0.3;
    const dach = new THREE.Shape([new THREE.Vector2(-t / 2 - ue, 0), new THREE.Vector2(t / 2 + ue, 0), new THREE.Vector2(0, dh)]);
    const dg = new THREE.ExtrudeGeometry(dach, { depth: lang, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
    dg.translate(0, 0, -lang / 2);
    dg.rotateY(Math.PI / 2);
    const oben = 0.2 + h;
    teil(dg, dachMat(F.dach[nr % F.dach.length]), 0, oben - 0.04, 0, g);
    // Giebeldreieck in Klinker an den Seiten
    const giebel = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-t / 2, 0), new THREE.Vector2(t / 2, 0), new THREE.Vector2(0, dh * (t / 2) / (t / 2 + ue))]), { depth: b, bevelEnabled: false });
    giebel.translate(0, 0, -b / 2);
    giebel.rotateY(Math.PI / 2);
    teil(giebel, wandMat(klinker, b, 1), 0, oben - 0.02, 0, g);
    // Schornstein
    teil(kiste(0.3, 0.75, 0.3), wandMat(klinker, 0.3, 0.75), b / 2 - 0.55, oben + dh * 0.62, -t / 5, g);
    // Fenster und Tür vorne (lokal +z), Fenster hinten
    const fenster = (fx, fy, seite, fb = 0.44, fh = 0.56) => {
      const z0 = seite * (t / 2 + 0.03);
      teil(kiste(fb + 0.12, fh + 0.12, 0.06), mat(F.rahmen), fx, fy, z0, g, false);
      const gl = teil(kiste(fb, fh, 0.065), zufall() < 0.72 ? glasAn : glasAus, fx, fy, z0 + seite * 0.006, g, false);
      teil(kiste(0.035, fh, 0.075), mat(F.rahmen), fx, fy, z0 + seite * 0.008, g, false);
      teil(kiste(fb + 0.18, 0.05, 0.12), mat(F.sockel), fx, fy - fh / 2 - 0.08, z0 + seite * 0.04, g, false);
      return gl;
    };
    const unten = 0.2 + 0.62, obenF = 0.2 + h - 0.58, zweiStock = h > 1.7;
    const tuerX = -b / 2 + 0.62;
    teil(kiste(0.5, 0.92, 0.06), mat(F.tuer[nr % F.tuer.length], { roughness: 0.5 }), tuerX, 0.2 + 0.46, t / 2 + 0.03, g);
    teil(kiste(0.62, 1.02, 0.04), mat(F.rahmen), tuerX, 0.2 + 0.51, t / 2 + 0.012, g, false);
    teil(kiste(0.05, 0.05, 0.06), mat(0xD4B15A, { metalness: 0.6, roughness: 0.35 }), tuerX + 0.16, 0.2 + 0.45, t / 2 + 0.07, g, false);
    teil(kiste(0.8, 0.08, 0.4), mat(F.sockel), tuerX, 0.04, t / 2 + 0.22, g);
    teil(kiste(0.72, 0.05, 0.36), mat(F.rahmen), tuerX, 0.2 + 1.08, t / 2 + 0.17, g); // Vordach
    for (let fx = tuerX + 0.78; fx < b / 2 - 0.3; fx += 0.72) fenster(fx, unten, 1);
    if (zweiStock) for (let fx = -b / 2 + 0.5; fx < b / 2 - 0.3; fx += 0.72) fenster(fx, obenF, 1);
    for (let fx = -b / 2 + 0.5; fx < b / 2 - 0.3; fx += 0.9) fenster(fx, unten, -1);
    if (gaube) {
      const gz = t / 2 * 0.42, gy = oben + dh * 0.32;
      teil(kiste(0.78, 0.55, 0.7), wandMat(klinker, 0.78, 0.55), 0.2, gy + 0.22, gz - 0.12, g);
      const gd = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 0.32)]), { depth: 0.85, bevelEnabled: false });
      gd.translate(0, 0, -0.42);
      teil(gd, dachMat(F.dach[nr % F.dach.length]), 0.2, gy + 0.48, gz - 0.12, g);
      teil(kiste(0.5, 0.4, 0.04), mat(F.rahmen), 0.2, gy + 0.22, gz + 0.24, g, false);
      teil(kiste(0.4, 0.3, 0.05), zufall() < 0.6 ? glasAn : glasAus, 0.2, gy + 0.22, gz + 0.25, g, false);
    }
    // Ankerpunkt für das Preisschild: über dem First
    const anker = new THREE.Vector3(0, oben + dh + 0.55, 0);
    g.updateMatrix();
    haeuser.push({ g, anker: anker.applyMatrix4(g.matrix), nr, stiel }); // Anker im Tisch, unabhängig vom Aufbauen
    return g;
  }
  // Hintere Reihe blickt zur Straße, vorne zwei Bungalows mit Garten zum Kanal
  haus(0, -0.15, -2.15, { b: 2.4, t: 2.1, h: 2.1, gaube: true, verz: 0 });
  haus(1, -3.15, -2.3, { b: 2.2, t: 2.0, h: 1.9, verz: 1, stiel: 46 });
  haus(2, 2.85, -2.2, { b: 2.3, t: 2.0, h: 2.05, verz: 2, stiel: 46 });
  haus(3, -5.95, -2.05, { b: 2.0, t: 1.9, h: 1.55, verz: 3 });
  haus(4, 5.75, -2.1, { b: 2.1, t: 2.0, h: 1.7, gaube: true, verz: 4 });
  haus(5, -4.6, 3.15, { b: 2.4, t: 1.7, h: 1.35, blick: -1, verz: 5 });
  haus(6, 4.75, 3.15, { b: 2.3, t: 1.7, h: 1.35, blick: -1, verz: 6 });

  /* ----- Gärten: Hecken, Bäume, Wege ----- */
  const heckenMat = mat(F.hecke, { roughness: 0.95 });
  const hecke = (x, z, b, t, verz) => { const g = gruppe(x, z, verz); teil(weich(b, 0.5, t, 0.14), heckenMat, 0, 0.25, 0, g); };
  hecke(-1.65, -3.4, 0.38, 2.6, 7); hecke(1.35, -3.4, 0.38, 2.6, 7); hecke(-4.55, -3.4, 0.38, 2.6, 8); hecke(4.3, -3.4, 0.38, 2.6, 8);
  hecke(-1.1, 2.6, 4.1, 0.36, 9); hecke(3.0, 2.6, 0.9, 0.36, 9); hecke(-6.4, 2.6, 0.9, 0.36, 9); hecke(6.6, 2.6, 0.6, 0.36, 9);
  // Wege von der Tür zum Gehweg
  [[-0.15, 2.4], [-3.15, 2.2], [2.85, 2.3], [-5.95, 2.0], [5.75, 2.1]].forEach(([x, b], i) => {
    const tx = x - b / 2 + 0.62;
    teil(kiste(0.62, 0.05, 0.62), mat(F.gehweg), tx, 0.02, STR - 1.8 + (i === 3 ? 0.1 : 0), welt, false);
  });
  function baum(x, z, s, art, verz) {
    const g = gruppe(x, z, verz);
    g.scale.setScalar(s);
    g.userData.s = s;
    teil(rolle(0.08, 0.12, 0.9, 10), mat(F.stamm), 0, 0.45, 0, g);
    if (art === 3) {
      teil(geo('kegel1', () => new THREE.ConeGeometry(0.62, 1.15, 14)), mat(F.nadel), 0, 1.15, 0, g);
      teil(geo('kegel2', () => new THREE.ConeGeometry(0.46, 0.95, 14)), mat(F.nadel), 0, 1.7, 0, g);
    } else {
      const m = mat(F.baum[art], { roughness: 0.92 });
      teil(kugel(0.66), m, 0, 1.35, 0, g);
      teil(kugel(0.46), m, 0.38, 1.08, 0.12, g);
      teil(kugel(0.44), m, -0.34, 1.12, -0.14, g);
      teil(kugel(0.36), m, 0.05, 1.82, -0.05, g);
    }
  }
  baum(-7.0, -4.2, 1.05, 0, 10); baum(1.45, -4.35, 0.95, 1, 10); baum(-1.85, -4.4, 0.8, 3, 11); baum(6.9, -4.0, 1.1, 2, 11);
  baum(-4.4, -4.5, 0.75, 1, 12); baum(4.35, -4.5, 0.85, 3, 12); baum(-6.75, 3.7, 0.9, 2, 13); baum(6.85, 3.75, 0.8, 0, 13);

  /* ----- Rapsfeld zwischen den Bungalows ----- */
  const raps = gruppe(0.1, 3.55, 14);
  teil(weich(4.6, 0.12, 1.5, 0.05), mat(F.rapsGruen), 0, 0.06, 0, raps, false);
  const bluete = new THREE.InstancedMesh(kugel(0.11, 1), mat(F.raps, { roughness: 0.8 }), 132);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < 132; i++) {
    const r = Math.floor(i / 22), s = i % 22;
    tmp.position.set(-2.1 + s * 0.2 + (r % 2) * 0.1, 0.2 + zufall() * 0.08, -0.6 + r * 0.24);
    tmp.scale.setScalar(0.8 + zufall() * 0.5);
    tmp.updateMatrix();
    bluete.setMatrixAt(i, tmp.matrix);
  }
  bluete.castShadow = true;
  raps.add(bluete);

  /* ----- Kleinigkeiten: Auto, Laternen, Briefkasten, zwei Nachbarn ----- */
  const auto = gruppe(-1.95, STR - 0.42, 15);
  teil(weich(1.45, 0.42, 0.72, 0.12), mat(F.auto[0], { roughness: 0.45 }), 0, 0.33, 0, auto);
  teil(weich(0.82, 0.34, 0.66, 0.1), mat(F.auto[1], { roughness: 0.3 }), -0.08, 0.66, 0, auto);
  [[-0.45, 0.35], [0.45, 0.35], [-0.45, -0.35], [0.45, -0.35]].forEach(([x, z]) => {
    const rad = teil(rolle(0.15, 0.15, 0.12, 14), mat(0x2A2F36), x, 0.16, z, auto);
    rad.rotation.x = Math.PI / 2;
  });
  const lampen = [];
  [[-4.3, STR - 1.38], [1.6, STR - 1.38], [5.1, STR + 1.38]].forEach(([x, z], i) => {
    const g = gruppe(x, z, 16 + i * 0.3);
    teil(rolle(0.04, 0.05, 1.55, 8), mat(F.mast), 0, 0.78, 0, g);
    teil(kiste(0.08, 0.06, 0.38), mat(F.mast), 0, 1.53, 0.15 * (z < STR ? 1 : -1), g);
    const kopf = teil(kiste(0.16, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: 0xF4EAD2, emissive: 0xFFD27A, emissiveIntensity: 0 }), 0, 1.48, 0.3 * (z < STR ? 1 : -1), g, false);
    const licht = new THREE.PointLight(0xFFC66B, 0, 4.2, 1.6);
    licht.position.set(0, 1.3, 0.3 * (z < STR ? 1 : -1));
    g.add(licht);
    lampen.push({ kopf, licht });
  });
  const post = gruppe(3.95, STR - 1.32, 17);
  teil(rolle(0.03, 0.03, 0.55, 6), mat(F.mast), 0, 0.28, 0, post);
  teil(weich(0.3, 0.36, 0.22, 0.05), mat(F.post, { roughness: 0.5 }), 0, 0.68, 0, post);
  // Zwei Nachbarn vor dem mittleren Haus: Hand drauf
  const person = (x, farbe, dreh, verz) => {
    const g = gruppe(x, STR - 1.25, verz);
    g.rotation.y = dreh;
    teil(geo('koerper', () => new THREE.CapsuleGeometry(0.13, 0.32, 4, 10)), mat(farbe), 0, 0.36, 0, g);
    teil(kugel(0.12), mat(F.haut), 0, 0.73, 0, g);
  };
  person(-0.95, 0x2F7346, Math.PI / 2, 18);
  person(-0.6, 0xE9A800, -Math.PI / 2, 18.5);

  // Zu jeder Tätigkeit ein kleines Ding: Rasenmäher, Einkaufstüten, Umzugskartons, ein Hund
  const maeher = gruppe(5.7, 4.05, 19);
  maeher.rotation.y = -0.5;
  teil(weich(0.42, 0.18, 0.32, 0.05), mat(0xC8372D, { roughness: 0.5 }), 0, 0.16, 0, maeher);
  teil(weich(0.24, 0.1, 0.2, 0.03), mat(0x2A2F36), 0.02, 0.29, 0, maeher);
  [[-0.14, 0.17], [0.14, 0.17], [-0.14, -0.17], [0.14, -0.17]].forEach(([x, z]) => { const rad = teil(rolle(0.06, 0.06, 0.04, 10), mat(0x2A2F36), x, 0.07, z, maeher); rad.rotation.x = Math.PI / 2; });
  const stiel = teil(rolle(0.018, 0.018, 0.62, 6), mat(0x2A2F36), -0.33, 0.42, 0, maeher);
  stiel.rotation.z = 0.85;
  teil(rolle(0.02, 0.02, 0.3, 6), mat(0x2A2F36), -0.57, 0.62, 0, maeher).rotation.x = Math.PI / 2;
  const tueten = gruppe(2.85 - 2.3 / 2 + 0.62 + 0.42, STR - 1.62, 19.5);
  [[0, 0, 0xC9A57A], [0.2, 0.06, 0xE2D3B5]].forEach(([x, z, f]) => {
    teil(kiste(0.18, 0.24, 0.12), mat(f, { roughness: 0.95 }), x, 0.17, z, tueten);
    teil(kugel(0.045, 1), mat(0x7DAA48), x - 0.03, 0.32, z, tueten);
    teil(kugel(0.04, 1), mat(0xE7A33A), x + 0.04, 0.31, z + 0.02, tueten);
  });
  const kartons = gruppe(-5.95 + 0.55, STR - 1.75, 20);
  kartons.rotation.y = 0.25;
  teil(kiste(0.42, 0.32, 0.36), mat(0xC69C6D, { roughness: 0.95 }), 0, 0.16, 0, kartons);
  teil(kiste(0.36, 0.26, 0.3), mat(0xB88D5E, { roughness: 0.95 }), 0.03, 0.45, 0.01, kartons).rotation.y = 0.3;
  teil(kiste(0.43, 0.012, 0.06), mat(0xE8DCC6), 0, 0.325, 0, kartons, false);
  const hund = gruppe(-1.3, STR - 1.15, 20.5);
  hund.rotation.y = 0.4;
  const fell = mat(0xA8763E, { roughness: 0.95 });
  teil(geo('hundkoerper', () => new THREE.CapsuleGeometry(0.085, 0.22, 4, 10)), fell, 0, 0.2, 0, hund).rotation.z = Math.PI / 2;
  teil(kugel(0.085), fell, 0.2, 0.3, 0, hund);
  teil(kugel(0.04, 1), mat(0x3A2A1E), 0.28, 0.28, 0, hund);
  teil(kiste(0.04, 0.09, 0.05), mat(0x7A5430), 0.18, 0.38, 0.06, hund);
  teil(kiste(0.04, 0.09, 0.05), mat(0x7A5430), 0.18, 0.38, -0.06, hund);
  [[-0.1, 0.05], [0.1, 0.05], [-0.1, -0.05], [0.1, -0.05]].forEach(([x, z]) => teil(rolle(0.025, 0.025, 0.14, 6), fell, x, 0.07, z, hund));
  teil(rolle(0.015, 0.02, 0.16, 6), fell, -0.2, 0.28, 0, hund).rotation.z = 0.7;

  /* ----- Wolken ----- */
  const wolken = [];
  [[-5, 5.2, -3.8, 1], [3.5, 6.2, -4.6, 0.8], [8, 5.6, -1.5, 0.7]].forEach(([x, y, z, s]) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    const m = mat(0xFFFFFF, { roughness: 1, transparent: true, opacity: 0.92 });
    [[0, 0, 0, 0.7], [0.75, -0.12, 0.1, 0.52], [-0.72, -0.15, 0, 0.5], [0.2, 0.3, -0.1, 0.5]].forEach(([a, b, c, r]) => teil(kugel(r), m, a, b, c, g, false));
    szene.add(g);
    wolken.push(g);
  });

  /* ----- Licht ----- */
  const himmel = new THREE.HemisphereLight(0xE4F1FF, 0x8FB574, 1.25);
  szene.add(himmel);
  const sonne = new THREE.DirectionalLight(0xFFF3E0, 2.6);
  sonne.position.set(-6, 12, 7);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(1024, 1024);
  Object.assign(sonne.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sonne.shadow.bias = -0.0006;
  sonne.shadow.normalBias = 0.02;
  sonne.shadow.radius = 4;
  szene.add(sonne);
  // weicher Schatten unter dem schwebenden Tisch
  const bodenSchatten = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    const v = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    v.addColorStop(0, 'rgba(20,30,45,.38)');
    v.addColorStop(1, 'rgba(20,30,45,0)');
    x.fillStyle = v;
    x.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(BREIT * 1.35, (VORN - HINTEN) * 1.45), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, -1.9, 0.6);
    szene.add(m);
    return m;
  })();

  function setzeNacht(an) {
    himmel.color.set(an ? 0x7C97C9 : 0xE4F1FF);
    himmel.groundColor.set(an ? 0x2A3A30 : 0x8FB574);
    himmel.intensity = an ? 1.0 : 1.25;
    sonne.color.set(an ? 0xA9BEE6 : 0xFFF3E0);
    sonne.intensity = an ? 0.95 : 2.6;
    sonne.position.set(an ? 6 : -6, 12, 7);
    glasAn.emissiveIntensity = an ? 1.6 : 0;
    lampen.forEach(({ kopf, licht }) => { kopf.material.emissiveIntensity = an ? 2.2 : 0; licht.intensity = an ? 5 : 0; });
    wolken.forEach((w) => { w.visible = !an; });
    bodenSchatten.material.opacity = an ? 0.6 : 1;
    renderer.toneMappingExposure = an ? 1.15 : 1.0;
    wecken();
  }

  /* ----- Kamera passend zur Größe ----- */
  // Kamera so weit weg und so hoch, dass Tisch und Schilder genau hineinpassen, egal wie breit der Bildschirm ist
  const richtung = new THREE.Vector3(0, 0.8, 1).normalize();
  const ecken = [];
  [-BREIT / 2 - 0.1, BREIT / 2 + 0.1].forEach((x) => [HINTEN - 0.1, VORN + 0.1].forEach((z) => [-1.36, 0.1].forEach((y) => ecken.push(new THREE.Vector3(x, y, z)))));
  const pp = new THREE.Vector3();
  function stelle(abstand, hoehe) {
    const ziel = new THREE.Vector3(0, hoehe, 0.4);
    kamera.position.copy(ziel).addScaledVector(richtung, abstand);
    kamera.lookAt(ziel);
    kamera.updateMatrixWorld();
    kamera.updateProjectionMatrix();
  }
  function grenzen(raumOben) {
    let x = 0, yMin = 1e9, yMax = -1e9;
    ecken.forEach((p) => { pp.copy(p).project(kamera); x = Math.max(x, Math.abs(pp.x)); yMin = Math.min(yMin, pp.y); yMax = Math.max(yMax, pp.y); });
    haeuser.forEach((hs) => { pp.copy(hs.anker).applyMatrix4(welt.matrixWorld).project(kamera); x = Math.max(x, Math.abs(pp.x) + 0.12); yMax = Math.max(yMax, pp.y + raumOben); });
    return { x, yMin, yMax };
  }
  function einpassen() {
    const w = huelle.clientWidth || 1, h = huelle.clientHeight || 1;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    const winkelVorher = welt.rotation.y;
    welt.rotation.y = 0;
    welt.updateMatrixWorld(true);
    const raumOben = 84 / (h / 2); // Schild mit langem Stiel über dem höchsten Ankerpunkt
    let unten = 12, oben = 160, hoehe = 0.8;
    for (let k = 0; k < 22; k++) {
      const d = (unten + oben) / 2;
      // erst senkrecht mittig ausrichten, dann prüfen, ob alles passt
      for (let j = 0; j < 3; j++) {
        stelle(d, hoehe);
        const g = grenzen(raumOben);
        const sichtH = 2 * d * Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));
        hoehe += ((g.yMax + g.yMin) / 2) * (sichtH / 2) * 0.9;
      }
      stelle(d, hoehe);
      const g = grenzen(raumOben);
      if (g.x <= 0.96 && g.yMax <= 0.96 && g.yMin >= -0.92) oben = d; else unten = d;
    }
    stelle(oben, hoehe);
    welt.rotation.y = winkelVorher;
    wecken();
  }

  /* ----- Preisschilder (HTML) ----- */
  const ebene = huelle.querySelector('.mini-schilder') || huelle;
  let schilder = [];
  function setzeSchilder(liste) {
    ebene.querySelectorAll('.mini-anker').forEach((b) => b.remove());
    schilder = liste.slice(0, haeuser.length).map((s, i) => {
      const haus = haeuser[REIHENFOLGE[i]];
      // Anker am Dach (wandert mit der Szene), darin das Schild als echter Knopf
      const a = document.createElement('div');
      a.className = 'mini-anker' + (s.art ? ' mini-anker-' + s.art : '');
      a.style.setProperty('--i', i);
      a.style.setProperty('--stiel', haus.stiel + 'px');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mini-schild';
      b.dataset.id = s.id;
      b.setAttribute('aria-label', s.label);
      b.innerHTML = `${s.bild ? `<img class="bild" src="${s.bild}" alt="">` : ''}<span>${s.text}</span>`;
      b.addEventListener('click', () => opt.wennSchild && opt.wennSchild(s.id));
      a.appendChild(b);
      ebene.appendChild(a);
      return { b: a, haus };
    });
    wecken();
  }
  // Mitte zuerst, dann nach außen: die wichtigsten Schilder stehen vorne
  const REIHENFOLGE = [0, 2, 1, 5, 6, 4, 3];
  const v = new THREE.Vector3();
  function schilderSetzen() {
    const w = huelle.clientWidth, h = huelle.clientHeight;
    schilder.forEach(({ b, haus }) => {
      v.copy(haus.anker).applyMatrix4(welt.matrixWorld).project(kamera);
      b.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px)`;
    });
  }

  /* ----- Bewegung: aufbauen, sanft schwenken, mit dem Finger drehen ----- */
  let ziel = 0, winkel = 0, ziehen = null, start = 0, laeuft = false, sichtbar = true, letzte = 0, ruhig = 0, aktiv = 0, pause = false;
  const AUFBAU_MS = 1300;
  aufbau.forEach((a) => { a.y = a.g.position.y; a.s = a.g.userData.s || 1; });
  const zurueck = (p) => { const c = 1.6; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
  function zeichnen(t) {
    if (!start) start = t;
    const vergangen = reduziert ? 1e9 : t - start;
    aufbau.forEach((a) => {
      const p = Math.min(1, Math.max(0, (vergangen - a.verz * 45) / 520));
      const e = p >= 1 ? 1 : zurueck(p);
      a.g.scale.setScalar(Math.max(0.0001, e * a.s));
      a.g.position.y = a.y + (1 - Math.min(1, p * 1.4)) * 1.2;
    });
    if (vergangen > AUFBAU_MS * 0.7) huelle.classList.add('ist-bereit');
    const schwenk = reduziert ? 0 : Math.sin(t / 5200) * 0.05;
    winkel += (ziel + schwenk - winkel) * 0.08;
    welt.rotation.y = winkel;
    const dt = Math.min(64, t - (letzte || t)) / 1000;
    wolken.forEach((w) => { w.position.x += dt * 0.18; if (w.position.x > 11) w.position.x = -11; });
    renderer.render(szene, kamera);
    schilderSetzen();
  }
  function schleife(t) {
    if (!laeuft || pause) { laeuft = false; return; }
    // Ohne Bewegung reichen 30 Bilder pro Sekunde
    const aufbauFertig = start && t - start > AUFBAU_MS + 600;
    if (aufbauFertig && !ziehen && t - letzte < 31) { requestAnimationFrame(schleife); return; }
    zeichnen(t);
    letzte = t;
    if (reduziert && aufbauFertig && Math.abs(ziel - winkel) < 0.001 && ++ruhig > 2) { laeuft = false; return; }
    // Akku schonen: nach 15 Sekunden ohne Berührung bleibt die Szene stehen (die Schilder schweben per CSS weiter)
    if (aufbauFertig && !ziehen && t - aktiv > 15000) { laeuft = false; return; }
    requestAnimationFrame(schleife);
  }
  function wecken() {
    ruhig = 0;
    aktiv = performance.now();
    if (!laeuft && sichtbar && !pause && !document.hidden) { laeuft = true; requestAnimationFrame(schleife); }
  }
  const aus = () => { laeuft = false; };
  huelle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.mini-schild') || e.button > 0) return;
    ziehen = { x: e.clientX, w: ziel };
    huelle.classList.add('ist-gezogen');
    wecken();
  });
  const bewegen = (e) => { if (ziehen) { ziel = Math.max(-0.7, Math.min(0.7, ziehen.w + (e.clientX - ziehen.x) * 0.006)); aktiv = performance.now(); wecken(); } };
  const loslassen = () => { ziehen = null; huelle.classList.remove('ist-gezogen'); };
  window.addEventListener('pointermove', bewegen);
  window.addEventListener('pointerup', loslassen);
  window.addEventListener('pointercancel', loslassen);
  const beobachter = new IntersectionObserver((e) => { sichtbar = e[0].isIntersecting && e[0].intersectionRatio > 0; if (sichtbar) wecken(); else aus(); });
  beobachter.observe(huelle);
  const sichtWechsel = () => { if (document.hidden) aus(); else wecken(); };
  document.addEventListener('visibilitychange', sichtWechsel);
  const groesse = new ResizeObserver(einpassen);
  groesse.observe(huelle);

  einpassen();
  setzeNacht(!!opt.nacht);
  if (opt.foto) { zeichnen(1e9); huelle.classList.add('ist-bereit'); }
  else wecken();
  huelle.classList.add('ist-3d');

  return {
    schilder: setzeSchilder,
    nacht: setzeNacht,
    ruhe(an) { pause = !!an; if (!pause) wecken(); },
    bild: () => { zeichnen(performance.now()); return leinwand.toDataURL('image/png'); },
    ende() {
      aus();
      beobachter.disconnect();
      groesse.disconnect();
      document.removeEventListener('visibilitychange', sichtWechsel);
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', loslassen);
      window.removeEventListener('pointercancel', loslassen);
      renderer.dispose();
      leinwand.remove();
      huelle.classList.remove('ist-3d', 'ist-bereit');
    },
  };
}
