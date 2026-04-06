import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    // Skip on mobile/touch devices
    if ('ontouchstart' in window || window.innerWidth <= 768) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = 0, my = 0;
    let dx = 0, dy = 0;
    let isHover = false;

    const onMove = (e) => {
      mx = e.clientX;
      my = e.clientY;
    };

    const checkHover = (e) => {
      const el = e.target;
      const clickable = el.closest('a, button, [role="button"], .navbar__item, .shoe-detail__size, .header__logo, .navbar-tracking');
      const next = !!clickable;
      if (next !== isHover) {
        isHover = next;
        ring.style.transform = isHover
          ? 'translate(-50%, -50%) scale(1)'
          : 'translate(-50%, -50%) scale(0)';
        dot.style.transform = isHover
          ? 'translate(-50%, -50%) scale(0.6)'
          : 'translate(-50%, -50%) scale(1)';
      }
    };

    let raf;
    const tick = () => {
      // Smooth follow
      dx += (mx - dx) * 0.18;
      dy += (my - dy) * 0.18;
      dot.style.left = dx + 'px';
      dot.style.top = dy + 'px';
      ring.style.left = dx + 'px';
      ring.style.top = dy + 'px';
      raf = requestAnimationFrame(tick);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', checkHover);
    raf = requestAnimationFrame(tick);

    // Hide default cursor
    document.documentElement.style.cursor = 'none';
    document.body.style.cursor = 'none';

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', checkHover);
      cancelAnimationFrame(raf);
      document.documentElement.style.cursor = '';
      document.body.style.cursor = '';
    };
  }, []);

  // Don't render on mobile
  if (typeof window !== 'undefined' && ('ontouchstart' in window || window.innerWidth <= 768)) {
    return null;
  }

  return (
    <>
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </>
  );
}
