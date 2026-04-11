import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';

const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
const COLS = isMobile ? 10 : 24;
const ROWS = isMobile ? 18 : 14;

const ClessioIcon = () => (
  <svg width="48" height="32" viewBox="0 0 396 260" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M183.275 196.858V259.064L108.772 215.04C93.5328 205.445 64.0716 175.08 68.1353 130.379L183.275 196.858ZM325.514 130.379C329.578 175.08 300.116 205.445 284.876 215.04L210.375 259.064V196.858L325.514 130.379ZM394.933 0C398.997 43.3467 366.148 75.6307 349.215 86.3545L196.825 172.71C164.089 153.52 88.1196 109.382 46.1275 86.3545C4.13537 63.3266 -1.84794 19.1899 0.409695 0L196.825 113.446C256.088 79.5817 378.678 9.48209 394.933 0Z" fill="currentColor"/>
  </svg>
);

export default function Preloader({ onComplete }) {
  const gridRef = useRef(null);
  const barRef = useRef(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [showEnter, setShowEnter] = useState(false);

  useEffect(() => {
    window._onShoeLabReady = () => setReady(true);
    return () => { window._onShoeLabReady = null; };
  }, []);

  // Loading bar animation
  useEffect(() => {
    if (!barRef.current) return;
    const bar = barRef.current;

    if (!ready) {
      const tl = gsap.timeline({ repeat: -1 });
      tl.set(bar, { left: '-30%', width: '30%' });
      tl.to(bar, { left: '100%', duration: 1.4, ease: 'power2.inOut' });
      return () => tl.kill();
    }

    // Ready: fill bar then show "Entra" button
    gsap.killTweensOf(bar);
    gsap.to(bar, {
      left: 0, width: '100%', duration: 0.4, ease: 'power3.out',
      onComplete: () => setShowEnter(true),
    });
  }, [ready]);

  function handleEnter() {
    // Fade out logo + bar/button immediately
    if (contentRef.current) {
      gsap.to(contentRef.current, {
        opacity: 0,
        duration: 0.35,
        ease: 'power2.out',
      });
    }
    runExit();
  }

  function runExit() {
    if (!gridRef.current) return;

    const cells = gridRef.current.querySelectorAll('.preloader__cell');
    const centerX = COLS / 2;
    const centerY = ROWS / 2;

    // Sort: CENTER first → outer last (reveal radiates outward)
    const sorted = Array.from(cells).map((el, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return { el, dist };
    }).sort((a, b) => a.dist - b.dist);

    // Pick ~12% of cells to remain as residual "frame" — they won't fully dissolve
    const residualSet = new Set();
    const residualCount = Math.floor(sorted.length * 0.12);
    while (residualSet.size < residualCount) {
      residualSet.add(Math.floor(Math.random() * sorted.length));
    }

    const fullCells = sorted.filter((_, i) => !residualSet.has(i));
    const residualCells = sorted.filter((_, i) => residualSet.has(i));

    const totalDuration = 1.2;
    const cellDuration = 0.5;
    const stagger = (totalDuration - cellDuration) / sorted.length;

    // ── Orchestrated timeline ──
    const tl = gsap.timeline({
      onComplete: () => { setTimeout(() => onComplete(), 100); },
    });

    // Fully dissolve ~88% of cells
    tl.to(
      fullCells.map((s) => s.el),
      {
        scale: 0,
        opacity: 0,
        duration: cellDuration,
        stagger,
        ease: 'power3.inOut',
      },
      0
    );

    // Residual cells: shrink + dim but stay visible as randomic frame
    tl.to(
      residualCells.map((s) => s.el),
      {
        scale: () => 0.15 + Math.random() * 0.25, // 0.15..0.4
        opacity: () => 0.12 + Math.random() * 0.25, // 0.12..0.37
        duration: cellDuration,
        stagger,
        ease: 'power3.inOut',
      },
      0
    );

    // Subtle flicker for residual cells while the rest fade
    residualCells.forEach((s) => {
      tl.to(s.el, {
        opacity: () => 0.05 + Math.random() * 0.3,
        duration: 0.15,
        repeat: 3,
        yoyo: true,
        ease: 'none',
      }, totalDuration - 0.4 + Math.random() * 0.3);
    });

    // Shoe in at -0.85s before grid finishes
    tl.call(
      () => { if (window.animateShoeIn) window.animateShoeIn(); },
      null,
      Math.max(0, totalDuration - 0.85)
    );

    // Title reveal at -1s before grid finishes (first play only)
    tl.call(
      () => { if (window._playTitleOnce) window._playTitleOnce(); },
      null,
      Math.max(0, totalDuration - 1)
    );
  }

  const cells = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    cells.push(<div key={i} className="preloader__cell" />);
  }

  return (
    <div className="preloader" ref={containerRef}>
      <div
        ref={gridRef}
        className="preloader__grid"
        style={{
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        }}
      >
        {cells}
      </div>

      <div className="preloader__content" ref={contentRef}>
        <div className="preloader__icon">
          <ClessioIcon />
        </div>
        {!showEnter && (
          <div className="preloader__bar-track">
            <div ref={barRef} className="preloader__bar-fill" />
          </div>
        )}
        {showEnter && (
          <button className="preloader__enter" onClick={handleEnter}>
            Entra
          </button>
        )}
      </div>
    </div>
  );
}
