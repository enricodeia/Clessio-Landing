import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';

gsap.registerPlugin(Observer);

const MEDIA = [
  '/artist-01.webp.webp',
  '/artist-02.webp.webp',
  '/artist-03.webp.webp',
  '/artist-04.webp.webp',
  '/artist-05.webp.webp',
];

// ── Tunable scroll FX params ──
const FX = {
  // Scroll scaleY stretch
  stretchAmount: 0.46,
  stretchDivisor: 110,
  stretchResetMs: 66,
  // RGB split on scroll
  rgbEnabled: true,
  rgbMax: 12,
  rgbDecay: 0.92,
  // Blur on speed
  blurEnabled: false,
  blurMax: 1.5,
  blurDecay: 0.99,
  // Saturation boost on speed
  satEnabled: false,
  satMin: 1.45,
  satMax: 1.6,
  satDecay: 0.93,
  // Noise grain overlay
  noiseEnabled: true,
  noiseOpacity: 0.085,
  // Auto-scroll speed
  autoSpeed: 46,
  // Image size
  imageWidth: 45,
  imageGap: 28,
  imageBorderRadius: 0.2,
};

export default function Progetti() {
  const contentRef = useRef(null);
  const containerRef = useRef(null);
  const fxRef = useRef({ velocity: 0, rgb: 0, blur: 0, sat: 1 });
  const canvasRef = useRef(null);
  const [, forceRender] = useState(0);

  // Expose rerender for GUI
  useEffect(() => {
    window._rerenderProgetti = () => forceRender((c) => c + 1);
    return () => { window._rerenderProgetti = null; };
  }, []);

  function applyImageSize() {
    const el = containerRef.current;
    if (!el) return;
    el.style.width = FX.imageWidth + 'vw';
    const content = contentRef.current;
    if (content) content.style.rowGap = FX.imageGap + 'px';
    el.querySelectorAll('.progetti-effect__media').forEach((m) => {
      m.style.borderRadius = FX.imageBorderRadius + 'em';
    });
  }

  // ── GUI for Progetti scroll effects ──
  useEffect(() => {
    if (!window.lil) return;
    const gui = new lil.GUI({ title: 'Progetti FX', width: 280 });
    gui.close();

    gui.add(FX, 'autoSpeed', 5, 100, 1).name('Auto-scroll Speed');
    gui.add(FX, 'stretchAmount', 0, 0.5, 0.01).name('Stretch Amount');
    gui.add(FX, 'stretchDivisor', 50, 1000, 10).name('Stretch Divisor');

    const fRGB = gui.addFolder('RGB Split');
    fRGB.add(FX, 'rgbEnabled').name('Enabled');
    fRGB.add(FX, 'rgbMax', 0, 30, 0.5).name('Max Shift (px)');
    fRGB.add(FX, 'rgbDecay', 0.8, 0.99, 0.005).name('Decay');

    const fBlur = gui.addFolder('Motion Blur');
    fBlur.add(FX, 'blurEnabled').name('Enabled');
    fBlur.add(FX, 'blurMax', 0, 20, 0.5).name('Max Blur (px)');
    fBlur.add(FX, 'blurDecay', 0.8, 0.99, 0.005).name('Decay');

    const fSat = gui.addFolder('Saturation Boost');
    fSat.add(FX, 'satEnabled').name('Enabled');
    fSat.add(FX, 'satMin', 0, 2, 0.05).name('Min');
    fSat.add(FX, 'satMax', 1, 3, 0.05).name('Max');
    fSat.add(FX, 'satDecay', 0.8, 0.99, 0.005).name('Decay');

    const fN = gui.addFolder('Noise Grain');
    fN.add(FX, 'noiseEnabled').name('Enabled');
    fN.add(FX, 'noiseOpacity', 0, 0.3, 0.005).name('Opacity');

    const fImg = gui.addFolder('Images');
    fImg.add(FX, 'imageWidth', 10, 90, 1).name('Width (vw)').onChange(applyImageSize);
    fImg.add(FX, 'imageGap', 0, 80, 1).name('Gap (px)').onChange(applyImageSize);
    fImg.add(FX, 'imageBorderRadius', 0, 3, 0.05).name('Border Radius (em)').onChange(applyImageSize);

    return () => gui.destroy();
  }, []);

  // ── Noise canvas ──
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    cvs.width = 256;
    cvs.height = 256;
    let raf;
    function drawNoise() {
      if (!FX.noiseEnabled) { cvs.style.opacity = '0'; raf = requestAnimationFrame(drawNoise); return; }
      cvs.style.opacity = String(FX.noiseOpacity);
      const id = ctx.createImageData(256, 256);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
      }
      ctx.putImageData(id, 0, 0);
      raf = requestAnimationFrame(drawNoise);
    }
    drawNoise();
    return () => cancelAnimationFrame(raf);
  }, []);

  // ── Scroll + FX loop ──
  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    let incrTick = 0;
    let interactionTimeout;
    const fx = fxRef.current;

    const initId = setTimeout(() => {
      const half = content.getBoundingClientRect().height / 2;
      const wrap = gsap.utils.wrap(-half, 0);

      const yTo = gsap.quickTo(content, 'y', {
        duration: 1,
        ease: 'power4',
        modifiers: { y: gsap.utils.unitize(wrap) },
      });

      const scaleTo = gsap.quickTo(container, 'scaleY', {
        duration: 0.6,
        ease: 'power4',
      });

      const handleInteraction = (e) => {
        if (e.event.type === 'wheel') incrTick -= e.deltaY;
        else incrTick += e.deltaY;

        const valSc = 1 - gsap.utils.clamp(-FX.stretchAmount, FX.stretchAmount, e.deltaY / FX.stretchDivisor);
        scaleTo(valSc);

        // Track velocity for FX
        fx.velocity = Math.abs(e.deltaY);

        window.clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(() => scaleTo(1), FX.stretchResetMs);
      };

      const obs = Observer.create({
        target: window,
        type: 'wheel,pointer,touch',
        onChange: handleInteraction,
      });

      const tick = (time, dt) => {
        incrTick += dt / FX.autoSpeed;
        yTo(incrTick);

        // Decay velocity-driven FX
        const speed = fx.velocity;

        // RGB split
        if (FX.rgbEnabled) {
          fx.rgb = Math.min(FX.rgbMax, fx.rgb + speed * 0.08);
          fx.rgb *= FX.rgbDecay;
        } else { fx.rgb = 0; }

        // Motion blur
        if (FX.blurEnabled) {
          fx.blur = Math.min(FX.blurMax, fx.blur + speed * 0.04);
          fx.blur *= FX.blurDecay;
        } else { fx.blur = 0; }

        // Saturation
        if (FX.satEnabled) {
          fx.sat = Math.min(FX.satMax, fx.sat + speed * 0.003);
          fx.sat = FX.satMin + (fx.sat - FX.satMin) * FX.satDecay;
        } else { fx.sat = 1; }

        fx.velocity *= 0.9;

        // Apply CSS filters to container
        const filters = [];
        if (fx.blur > 0.1) filters.push(`blur(${fx.blur.toFixed(1)}px)`);
        if (fx.sat !== 1) filters.push(`saturate(${fx.sat.toFixed(2)})`);
        container.style.filter = filters.length ? filters.join(' ') : 'none';

        // RGB split via CSS custom props on content children
        if (fx.rgb > 0.3) {
          container.style.setProperty('--rgb-shift', `${fx.rgb.toFixed(1)}px`);
          container.classList.add('progetti-fx--rgb');
        } else {
          container.classList.remove('progetti-fx--rgb');
        }
      };
      gsap.ticker.add(tick);

      return () => {
        obs.kill();
        gsap.ticker.remove(tick);
        window.clearTimeout(interactionTimeout);
      };
    }, 200);

    return () => clearTimeout(initId);
  }, []);

  const mediaDoubled = [...MEDIA, ...MEDIA];

  return (
    <section className="progetti-effect section-enter">
      <p className="progetti-effect__texts">
        <span className="progetti-effect__line progetti-effect__line--1">Not</span>
        <span className="progetti-effect__line progetti-effect__line--2">
          <span>For</span>
          <span className="progetti-effect__line--indent">Ordinary</span>
        </span>
        <span className="progetti-effect__line progetti-effect__line--3">People</span>
      </p>

      <div ref={containerRef} className="progetti-effect__container">
        <div ref={contentRef} className="progetti-effect__content">
          {mediaDoubled.map((src, i) => (
            <div key={i} className="progetti-effect__media">
              <img src={src} alt="" />
            </div>
          ))}
        </div>
      </div>

      <canvas ref={canvasRef} className="progetti-effect__noise" />
    </section>
  );
}
