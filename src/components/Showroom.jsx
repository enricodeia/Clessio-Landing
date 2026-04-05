import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { easing } from 'maath';
import * as THREE from 'three';

/* ══════════════════════════════════════
   CONFIG — copied from MatthewGreenberg/shoe-finder
   ══════════════════════════════════════ */
const CONFIG = {
  gridCols: 8,
  itemSize: 2.5,
  gap: 0.4,

  // Physics
  dragSpeed: 2.2,
  dampFactor: 0.2,
  tiltFactor: 0.08,
  clickThreshold: 5,
  dragResistance: 0.25,

  // Camera / Zoom (PERSPECTIVE — z-distance based, not ortho zoom)
  zoomIn: 12,
  zoomOut: 31,
  zoomDamp: 0.25,

  // Visuals
  focusScale: 1.5,
  dimScale: 0.5,
  dimOpacity: 0.15,

  // 3D Curvature
  curvatureStrength: 0.06,
  rotationStrength: 0,
};
if (typeof window !== 'undefined') window.showroomCONFIG = CONFIG;

/* Shoe data — 60 from shoe-finder repo */
const SHOE_BASE = 'https://raw.githubusercontent.com/MatthewGreenberg/shoe-finder/main/public/shoes/';
const SHOES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  image: `${SHOE_BASE}shoe-${String(i).padStart(3, '0')}.png`,
}));

/* Global rig state (Vector3 based like shoe-finder) */
const rigState = {
  target: new THREE.Vector3(0, 2, 0),
  current: new THREE.Vector3(0, 2, 0),
  velocity: new THREE.Vector3(0, 0, 0),
  zoom: CONFIG.zoomOut,
  isDragging: false,
  activeId: null,
  introStart: 0,
};

function calculateGridDimensions(count) {
  const rows = Math.ceil(count / CONFIG.gridCols);
  const spacing = CONFIG.itemSize + CONFIG.gap;
  return {
    width: CONFIG.gridCols * spacing,
    height: rows * spacing,
  };
}

/* ══════════════════════════════════════
   SHOE TILE — full curvature + focus/dim math
   ══════════════════════════════════════ */
function ShoeTile({ shoe, index, basePos }) {
  const groupRef = useRef();
  const matRef = useRef();
  const [hovered, setHovered] = useState(false);
  const texture = useLoader(THREE.TextureLoader, shoe.image);

  // Animation refs
  const focusZ = useRef({ current: 0 });
  const curveZ = useRef({ current: 0 });
  const rotationX = useRef({ current: 0 });
  const rotationY = useRef({ current: 0 });
  const introScale = useRef({ current: 0 });

  // Intro stagger: delay based on distance from center
  const distFromCenter = useMemo(() => {
    return Math.sqrt(basePos.x * basePos.x + basePos.y * basePos.y);
  }, [basePos]);

  useMemo(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
  }, [texture]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    // ── Intro: stagger from center outward ──
    const elapsed = (performance.now() - rigState.introStart) / 1000;
    const introDelay = distFromCenter * 0.08;
    const introT = Math.max(0, Math.min(1, (elapsed - introDelay) / 0.9));
    const introEase = Math.sqrt(1 - Math.pow(introT - 1, 2)); // circ.out
    easing.damp(introScale.current, 'current', introEase, 0.1, delta);

    const x = basePos.x;
    const y = basePos.y;

    // ── Curvature (zoom-based) ──
    const isZoomedIn = rigState.zoom <= CONFIG.zoomIn + 0.5;
    const maxZoom = CONFIG.zoomOut || 50;
    const zoomRatio = isZoomedIn
      ? 0
      : THREE.MathUtils.clamp((rigState.zoom - CONFIG.zoomIn) / (maxZoom - CONFIG.zoomIn), 0, 1);
    const smoothRatio = easing.cubic.inOut(zoomRatio);
    const distSq = x * x + y * y;
    const dist = Math.sqrt(distSq);
    const targetCurveZ = -distSq * CONFIG.curvatureStrength * smoothRatio;

    // Rotation toward center (optional)
    let rotX = 0;
    let rotY = 0;
    if (CONFIG.rotationStrength > 0) {
      const rotationIntensity = Math.min(dist * 0.4, 2.0) * smoothRatio;
      rotX = y * CONFIG.curvatureStrength * CONFIG.rotationStrength * rotationIntensity;
      rotY = -x * CONFIG.curvatureStrength * CONFIG.rotationStrength * rotationIntensity;
    }

    // ── Focus / Dim state ──
    const isFocusMode = rigState.activeId !== null;
    const isActive = rigState.activeId === index;
    const isHover = hovered && !rigState.isDragging;

    let interactionScale = 1.0;
    let interactionOpacity = 1.0;
    let targetFocusZ = 0;

    if (isFocusMode) {
      if (isActive) {
        interactionScale = CONFIG.focusScale;
        interactionOpacity = 1.0;
        targetFocusZ = 2;
      } else {
        interactionScale = CONFIG.dimScale;
        interactionOpacity = CONFIG.dimOpacity;
        targetFocusZ = -0.5;
      }
    } else {
      interactionScale = isHover ? 1.05 : 1.0;
      targetFocusZ = isHover ? 0.5 : 0;
    }

    const combinedScale = interactionScale * introScale.current.current;
    const finalOpacity = interactionOpacity * introScale.current.current;

    // ── Apply ──
    easing.damp(groupRef.current.scale, 'x', combinedScale, 0.15, delta);
    easing.damp(groupRef.current.scale, 'y', combinedScale, 0.15, delta);
    easing.damp(focusZ.current, 'current', targetFocusZ, 0.2, delta);
    easing.damp(curveZ.current, 'current', targetCurveZ, 0.2, delta);

    groupRef.current.position.set(x, y, curveZ.current.current + focusZ.current.current);

    easing.damp(rotationX.current, 'current', rotX, 0.2, delta);
    easing.damp(rotationY.current, 'current', rotY, 0.2, delta);
    groupRef.current.rotation.set(rotationX.current.current, rotationY.current.current, 0);

    if (matRef.current) {
      easing.damp(matRef.current, 'opacity', finalOpacity, 0.15, delta);
    }
  });

  const handleClick = (e) => {
    e.stopPropagation();
    if (rigState.isDragging) return;
    if (rigState.activeId === index) {
      rigState.activeId = null;
      rigState.zoom = CONFIG.zoomOut;
    } else {
      rigState.activeId = index;
      rigState.target.set(basePos.x, basePos.y, 0);
      rigState.zoom = CONFIG.zoomIn;
    }
  };

  return (
    <group
      ref={groupRef}
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <planeGeometry args={[CONFIG.itemSize, CONFIG.itemSize]} />
        <meshBasicMaterial
          ref={matRef}
          map={texture}
          transparent
          opacity={1}
          alphaTest={0.02}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/* ══════════════════════════════════════
   RIG — drag, zoom, tilt, bounds
   ══════════════════════════════════════ */
function Rig({ gridW, gridH }) {
  const { camera, gl } = useThree();
  const prevPos = useRef(new THREE.Vector3());

  // Visible bounds helper
  const getBounds = () => {
    const dist = camera.position.z;
    const vFov = (camera.fov * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
    const visibleWidth = visibleHeight * camera.aspect;
    const xLimit = Math.max(0, (gridW - visibleWidth) / 2 + 2);
    const yLimit = Math.max(0, (gridH - visibleHeight) / 2 + 2);
    return { x: xLimit, y: yLimit, visibleHeight };
  };

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.style.cursor = 'grab';

    let isDown = false;
    let startX = 0;
    let startY = 0;
    let initialRigX = 0;
    let initialRigY = 0;
    let maxDragDistance = 0;

    const onDown = (e) => {
      isDown = true;
      startX = e.clientX;
      startY = e.clientY;
      initialRigX = rigState.target.x;
      initialRigY = rigState.target.y;
      maxDragDistance = 0;
      rigState.isDragging = false;
      canvas.style.cursor = 'grabbing';
    };

    const onMove = (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      maxDragDistance = Math.max(maxDragDistance, distance);

      const threshold = 'ontouchstart' in window ? 15 : CONFIG.clickThreshold;
      if (maxDragDistance > threshold) {
        rigState.isDragging = true;
        rigState.activeId = null;
      }

      const { x: bx, y: by, visibleHeight } = getBounds();
      const sensitivity = (visibleHeight / window.innerHeight) * CONFIG.dragSpeed;
      let rawTargetX = initialRigX + dx * sensitivity;
      let rawTargetY = initialRigY - dy * sensitivity;

      if (rawTargetX > bx) rawTargetX = bx + (rawTargetX - bx) * CONFIG.dragResistance;
      if (rawTargetX < -bx) rawTargetX = -bx + (rawTargetX + bx) * CONFIG.dragResistance;
      if (rawTargetY > by) rawTargetY = by + (rawTargetY - by) * CONFIG.dragResistance;
      if (rawTargetY < -by) rawTargetY = -by + (rawTargetY + by) * CONFIG.dragResistance;

      const maxOvershoot = 3;
      rawTargetX = Math.max(-bx - maxOvershoot, Math.min(bx + maxOvershoot, rawTargetX));
      rawTargetY = Math.max(-by - maxOvershoot, Math.min(by + maxOvershoot, rawTargetY));

      rigState.target.set(rawTargetX, rawTargetY, 0);
    };

    const onUp = () => {
      if (!isDown) return;
      isDown = false;
      setTimeout(() => { rigState.isDragging = false; }, 50);
      canvas.style.cursor = 'grab';

      if (rigState.activeId !== null) return;

      const { x: bx, y: by } = getBounds();
      const isZoomedOut = camera.position.z > CONFIG.zoomIn + 2;
      const snapX = isZoomedOut ? 0 : Math.max(-bx, Math.min(bx, rigState.target.x));
      const snapY = isZoomedOut ? 0 : Math.max(-by, Math.min(by, rigState.target.y));
      rigState.target.set(snapX, snapY, 0);
    };

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [gl, camera, gridW, gridH]);

  useFrame((_, delta) => {
    easing.damp3(rigState.current, rigState.target, CONFIG.dampFactor, delta);
    camera.position.x = rigState.current.x;
    camera.position.y = rigState.current.y;
    easing.damp(camera.position, 'z', rigState.zoom, CONFIG.zoomDamp, delta);

    rigState.velocity.copy(rigState.current).sub(prevPos.current);
    prevPos.current.copy(rigState.current);

    const zoomFactor = Math.min(1, CONFIG.zoomIn / rigState.zoom);
    const tiltX = rigState.velocity.y * CONFIG.tiltFactor * zoomFactor;
    const tiltY = -rigState.velocity.x * CONFIG.tiltFactor * zoomFactor;
    easing.damp(camera.rotation, 'x', tiltX, 0.2, delta);
    easing.damp(camera.rotation, 'y', tiltY, 0.2, delta);
  });

  return null;
}

/* ══════════════════════════════════════
   MAIN SHOWROOM
   ══════════════════════════════════════ */
export default function Showroom() {
  const { mappedItems, dims } = useMemo(() => {
    const spacing = CONFIG.itemSize + CONFIG.gap;
    const d = calculateGridDimensions(SHOES.length);
    const mapped = SHOES.map((shoe, i) => {
      const col = i % CONFIG.gridCols;
      const row = Math.floor(i / CONFIG.gridCols);
      return {
        ...shoe,
        basePos: {
          x: col * spacing - d.width / 2 + spacing / 2,
          y: -(row * spacing) + d.height / 2 - spacing / 2,
        },
      };
    });
    return { mappedItems: mapped, dims: d };
  }, []);

  useEffect(() => {
    rigState.target.set(0, 0, 0);
    rigState.current.set(0, 0, 0);
    rigState.zoom = CONFIG.zoomOut;
    rigState.activeId = null;
    rigState.introStart = performance.now();

    // lil-gui control panel
    let gui;
    if (window.lil && window.lil.GUI) {
      gui = new window.lil.GUI({ title: 'Showroom Lab', width: 300 });
      gui.close();
      gui.add({ copy: () => navigator.clipboard.writeText(JSON.stringify(CONFIG, null, 2)) }, 'copy').name('📋 Copy Params');
      gui.add({ replay: () => { rigState.introStart = performance.now(); } }, 'replay').name('▶ Replay Intro');

      const fG = gui.addFolder('Grid');
      fG.add(CONFIG, 'gridCols', 4, 16, 1).name('Columns');
      fG.add(CONFIG, 'itemSize', 1, 5, 0.1).name('Item Size');
      fG.add(CONFIG, 'gap', 0, 2, 0.05).name('Gap');
      fG.add(CONFIG, 'curvatureStrength', 0, 0.3, 0.005).name('Curvature');
      fG.add(CONFIG, 'rotationStrength', 0, 5, 0.1).name('Rotation Strength');

      const fC = gui.addFolder('Camera / Zoom');
      fC.add(CONFIG, 'zoomIn', 4, 30, 0.5).name('Zoom In (focus)');
      fC.add(CONFIG, 'zoomOut', 15, 60, 0.5).name('Zoom Out (grid)');
      fC.add(CONFIG, 'zoomDamp', 0.05, 0.6, 0.01).name('Zoom Damp');

      const fP = gui.addFolder('Drag Physics');
      fP.add(CONFIG, 'dragSpeed', 0.5, 5, 0.1).name('Drag Speed');
      fP.add(CONFIG, 'dampFactor', 0.05, 0.5, 0.01).name('Damp Factor');
      fP.add(CONFIG, 'tiltFactor', 0, 0.3, 0.01).name('Tilt Factor');
      fP.add(CONFIG, 'dragResistance', 0, 1, 0.02).name('Drag Resistance');

      const fF = gui.addFolder('Focus / Dim');
      fF.add(CONFIG, 'focusScale', 1, 3, 0.05).name('Focus Scale');
      fF.add(CONFIG, 'dimScale', 0.1, 1, 0.05).name('Dim Scale');
      fF.add(CONFIG, 'dimOpacity', 0, 1, 0.05).name('Dim Opacity');
    }

    return () => { if (gui) gui.destroy(); };
  }, []);

  return (
    <section className="showroom section-enter">
      <div className="showroom__canvas">
        <Canvas
          camera={{ fov: 35, position: [0, 0, CONFIG.zoomOut], near: 0.1, far: 200 }}
          gl={{ antialias: true }}
          style={{ background: 'transparent' }}
          onPointerMissed={() => {
            if (rigState.activeId !== null) {
              rigState.activeId = null;
              rigState.zoom = CONFIG.zoomOut;
            }
          }}
        >
          <Rig gridW={dims.width} gridH={dims.height} />
          <React.Suspense fallback={null}>
            {mappedItems.map((item, i) => (
              <ShoeTile key={item.id} shoe={item} index={i} basePos={item.basePos} />
            ))}
          </React.Suspense>
        </Canvas>
      </div>
    </section>
  );
}
