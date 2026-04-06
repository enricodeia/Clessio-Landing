import { useEffect, useRef, useLayoutEffect } from 'react';
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
  noiseOpacity: 0.03,
  // Auto-scroll speed
  autoSpeed: 46,
  // Image size
  imageWidth: 45,
  imageGap: 28,
  imageBorderRadius: 0.2,
  // Text
  fontSize: 10,        // vw
  lineHeight: 0.85,
  letterSpacing: -0.05, // em
  textColor: '#b8aa98',
  textOpacity: 1,
};

export default function Progetti() {
  const contentRef = useRef(null);
  const containerRef = useRef(null);
  const textsRef = useRef(null);
  const fxRef = useRef({ velocity: 0, rgb: 0, blur: 0, sat: 1 });
  const canvasRef = useRef(null);

  // Word-by-word reveal animation
  useLayoutEffect(() => {
    if (!textsRef.current) return;
    const words = textsRef.current.querySelectorAll('.progetti-word');
    gsap.set(words, { yPercent: 110, opacity: 0 });
    gsap.to(words, {
      yPercent: 0,
      opacity: 1,
      duration: 1.2,
      stagger: 0.12,
      ease: 'quint.out',
      delay: 0.3,
    });
  }, []);


  // ── Progetti FX control panel ──
  useEffect(() => {
    if (!window.lil) return;
    const gui = new lil.GUI({ title: 'Progetti FX', width: 280 });
    gui.close();

    const fScroll = gui.addFolder('Scroll');
    fScroll.add(FX, 'autoSpeed', 5, 100, 1).name('Auto Speed');
    fScroll.add(FX, 'stretchAmount', 0, 0.8, 0.01).name('Stretch Amount');
    fScroll.add(FX, 'stretchDivisor', 30, 1000, 5).name('Stretch Divisor');
    fScroll.add(FX, 'stretchResetMs', 20, 200, 5).name('Reset Delay (ms)');

    const fRGB = gui.addFolder('RGB Split');
    fRGB.add(FX, 'rgbEnabled').name('Enabled');
    fRGB.add(FX, 'rgbMax', 0, 40, 0.5).name('Max Shift (px)');
    fRGB.add(FX, 'rgbDecay', 0.8, 0.995, 0.005).name('Decay');

    const fBlur = gui.addFolder('Motion Blur');
    fBlur.add(FX, 'blurEnabled').name('Enabled');
    fBlur.add(FX, 'blurMax', 0, 20, 0.5).name('Max Blur (px)');
    fBlur.add(FX, 'blurDecay', 0.8, 0.995, 0.005).name('Decay');

    const fSat = gui.addFolder('Saturation Boost');
    fSat.add(FX, 'satEnabled').name('Enabled');
    fSat.add(FX, 'satMin', 0, 2, 0.05).name('Min');
    fSat.add(FX, 'satMax', 1, 3, 0.05).name('Max');
    fSat.add(FX, 'satDecay', 0.8, 0.995, 0.005).name('Decay');

    const fNoise = gui.addFolder('Noise Grain');
    fNoise.add(FX, 'noiseEnabled').name('Enabled');
    fNoise.add(FX, 'noiseOpacity', 0, 0.3, 0.005).name('Opacity');

    const fImg = gui.addFolder('Images');
    fImg.add(FX, 'imageWidth', 10, 90, 1).name('Width (vw)').onChange(() => {
      if (containerRef.current) containerRef.current.style.width = FX.imageWidth + 'vw';
    });
    fImg.add(FX, 'imageGap', 0, 80, 1).name('Gap (px)').onChange(() => {
      if (contentRef.current) contentRef.current.style.rowGap = FX.imageGap + 'px';
    });
    fImg.add(FX, 'imageBorderRadius', 0, 3, 0.05).name('Border Radius').onChange(() => {
      if (containerRef.current) {
        containerRef.current.querySelectorAll('.progetti-effect__media').forEach(m => {
          m.style.borderRadius = FX.imageBorderRadius + 'em';
        });
      }
    });

    const fTxt = gui.addFolder('Text');
    fTxt.add(FX, 'fontSize', 4, 25, 0.5).name('Size (vw)').onChange(syncText);
    fTxt.add(FX, 'lineHeight', 0.5, 1.5, 0.01).name('Line Height').onChange(syncText);
    fTxt.add(FX, 'letterSpacing', -0.15, 0.1, 0.005).name('Letter Spacing').onChange(syncText);
    fTxt.addColor(FX, 'textColor').name('Color').onChange(syncText);
    fTxt.add(FX, 'textOpacity', 0, 1, 0.01).name('Opacity').onChange(syncText);

    function syncText() {
      const r = document.documentElement.style;
      r.setProperty('--cl-proj-fs', FX.fontSize + 'vw');
      r.setProperty('--cl-proj-lh', String(FX.lineHeight));
      r.setProperty('--cl-proj-ls', FX.letterSpacing + 'em');
      r.setProperty('--cl-proj-color', FX.textColor);
      r.setProperty('--cl-proj-opacity', String(FX.textOpacity));
    }

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
      <p className="progetti-effect__texts" ref={textsRef}>
        <span className="progetti-effect__line progetti-effect__line--1">
          <span className="progetti-word-wrap"><span className="progetti-word">Not</span></span>
        </span>
        <span className="progetti-effect__line progetti-effect__line--2">
          <span className="progetti-word-wrap"><span className="progetti-word">For</span></span>
          <span className="progetti-word-wrap progetti-effect__line--indent"><span className="progetti-word">Ordinary</span></span>
        </span>
        <span className="progetti-effect__line progetti-effect__line--3">
          <span className="progetti-word-wrap"><span className="progetti-word">People</span></span>
        </span>
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
