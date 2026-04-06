import { useRef, useCallback } from 'react';
import gsap from 'gsap';

const COLS = 24;
const ROWS = 14;

export default function PageTransition({ onMidpoint }) {
  const gridRef = useRef(null);
  const containerRef = useRef(null);
  const busyRef = useRef(false);

  const run = useCallback(() => {
    if (busyRef.current || !gridRef.current) return;
    busyRef.current = true;

    const container = containerRef.current;
    const cells = gridRef.current.querySelectorAll('.pt__cell');
    // Sort by column: RIGHT first (high col) → LEFT last
    const sorted = Array.from(cells).map((el, i) => {
      const col = i % COLS;
      return { el, col };
    }).sort((a, b) => b.col - a.col);

    // Show container
    container.style.pointerEvents = 'auto';
    container.style.visibility = 'visible';

    // Reset all cells to invisible
    gsap.set(sorted.map((s) => s.el), { scaleX: 0, opacity: 1 });

    const coverDuration = 0.6;
    const revealDuration = 0.6;
    const cellDur = 0.35;
    const coverStagger = (coverDuration - cellDur) / sorted.length;
    const revealStagger = (revealDuration - cellDur) / sorted.length;

    const tl = gsap.timeline({
      onComplete: () => {
        container.style.pointerEvents = 'none';
        container.style.visibility = 'hidden';
        busyRef.current = false;
      },
    });

    // Phase 1: COVER — cells scale in from center outward
    tl.to(
      sorted.map((s) => s.el),
      {
        scaleX: 1,
        duration: cellDur,
        stagger: coverStagger,
        ease: 'circ.inOut',
      },
      0
    );

    // Midpoint: switch tab content
    tl.call(
      () => { if (onMidpoint) onMidpoint(); },
      null,
      coverDuration
    );

    // Phase 2: REVEAL — cells scale out from center outward
    tl.to(
      sorted.map((s) => s.el),
      {
        scaleX: 0,
        duration: cellDur,
        stagger: revealStagger,
        ease: 'circ.inOut',
      },
      coverDuration
    );
  }, [onMidpoint]);

  // Expose trigger
  if (typeof window !== 'undefined') {
    window._runPageTransition = run;
  }

  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    cells.push(<div key={i} className="pt__cell" />);
  }

  return (
    <div className="pt" ref={containerRef} style={{ visibility: 'hidden', pointerEvents: 'none' }}>
      <div
        ref={gridRef}
        className="pt__grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {cells}
      </div>
    </div>
  );
}
