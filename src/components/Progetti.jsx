import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Observer } from 'gsap/Observer';

gsap.registerPlugin(Observer);

// Placeholder images — replace with real project photos
const MEDIA = [
  'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
  'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=800',
  'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800',
  'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800',
  'https://images.unsplash.com/photo-1514989940723-e8e51635b782?w=800',
  'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=800',
];

export default function Progetti() {
  const contentRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const content = contentRef.current;
    const container = containerRef.current;
    if (!content || !container) return;

    let incrTick = 0;
    let interactionTimeout;

    // Delay to let images load and measure
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

        const valSc = 1 - gsap.utils.clamp(-0.2, 0.2, e.deltaY / 300);
        scaleTo(valSc);

        window.clearTimeout(interactionTimeout);
        interactionTimeout = setTimeout(() => scaleTo(1), 66);
      };

      const obs = Observer.create({
        target: window,
        type: 'wheel,pointer,touch',
        onChange: handleInteraction,
      });

      const tick = (time, dt) => {
        incrTick += dt / 30;
        yTo(incrTick);
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

  // Duplicate media for seamless infinite scroll
  const mediaDoubled = [...MEDIA, ...MEDIA];

  return (
    <section className="progetti-effect section-enter">
      <div className="progetti-effect__header">
        <p className="progetti-effect__brand">Clessio®</p>
        <div className="progetti-effect__menu">
          <p>Progetti</p>
          <p>Info</p>
          <p>Contatti</p>
        </div>
      </div>

      <p className="progetti-effect__texts">
        <span className="progetti-effect__line progetti-effect__line--1">Glimpse</span>
        <span className="progetti-effect__line--inline">Of</span>
        <span className="progetti-effect__line progetti-effect__line--2">Clessio's</span>
        <span className="progetti-effect__line progetti-effect__line--3">
          <span>New</span>
          <span>Fall</span>
        </span>
        <span className="progetti-effect__line progetti-effect__line--4">Collection</span>
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
    </section>
  );
}
