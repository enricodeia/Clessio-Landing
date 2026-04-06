import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import GradualBlur from './GradualBlur.jsx';
import ElectricBorder from './ElectricBorder.jsx';

const TARGET = Date.now() + 128 * 3600 * 1000;
const TITLE_TEXT = 'Luis Vuitton x Clessio';
const SUBTITLE_TEXT = 'Air Nike Air Jordan 1';

export default function Hero({ loaded = true, showroom = false, uiRevealed = false }) {
  const [time, setTime] = useState(getRemaining());
  const [, forceRender] = useState(0);
  const titleRef = useRef(null);
  const subtitleRef = useRef(null);

  // Expose rerender for GUI
  useEffect(() => {
    window._rerenderHero = () => forceRender((c) => c + 1);
    return () => { window._rerenderHero = null; };
  }, []);

  // Init shoe lab
  useEffect(() => {
    const t = setTimeout(() => {
      if (window.initShoeLab) window.initShoeLab();
    }, 50);
    return () => { clearTimeout(t); if (window.destroyShoeLab) window.destroyShoeLab(); };
  }, []);

  // Title animation — runs ONCE per page load
  const hasPlayed = useRef(false);
  useEffect(() => {
    if (!window.titleAnim) {
      window.titleAnim = {
        duration: 1.5,
        stagger: 0.035,
        startY: 120,
        startRotation: 0,
        delay: 500,
        subDelay: 550,
        ease: 'quint.out',
      };
    }

    const runAnimation = (isReplay = false) => {
      if (!titleRef.current || !subtitleRef.current) return;
      // Skip if already played (unless manual replay from GUI)
      if (hasPlayed.current && !isReplay) return;
      hasPlayed.current = true;

      const T = window.titleAnim;
      const titleChars = titleRef.current.querySelectorAll('.char');
      const subChars = subtitleRef.current.querySelectorAll('.char');

      gsap.killTweensOf([titleChars, subChars]);

      const startY = T.startY != null ? T.startY : 120;
      const duration = T.duration != null ? T.duration : 1.2;
      const stagger = T.stagger != null ? T.stagger : 0.03;
      const ease = T.ease || 'quint.out';
      const delay = (T.delay != null ? T.delay : 500) / 1000;
      const subDelay = ((T.delay != null ? T.delay : 500) + (T.subDelay != null ? T.subDelay : 550)) / 1000;
      const rot = T.startRotation || 0;

      // Reveal UI components ~1s before title ends (as chars are still revealing)
      const revealDelay = Math.max(0, (delay + duration * 0.3)) * 1000;
      setTimeout(() => { if (window._revealHomeUI) window._revealHomeUI(); }, revealDelay);

      gsap.fromTo(
        titleChars,
        { yPercent: startY, opacity: 0, rotationZ: rot },
        { yPercent: 0, opacity: 1, rotationZ: 0, duration, stagger, ease, delay }
      );
      gsap.fromTo(
        subChars,
        { yPercent: startY, opacity: 0, rotationZ: rot },
        { yPercent: 0, opacity: 1, rotationZ: 0, duration: duration * 0.8, stagger: stagger * 0.8, ease, delay: subDelay }
      );
    };

    // Hide chars synchronously until first play (prevents FOUC)
    if (!hasPlayed.current && titleRef.current && subtitleRef.current) {
      const all = [
        ...titleRef.current.querySelectorAll('.char'),
        ...subtitleRef.current.querySelectorAll('.char'),
      ];
      gsap.set(all, { yPercent: 120, opacity: 0 });
    }

    // GUI replay: force re-run (only from lil-gui button)
    window._replayTitleAnim = () => runAnimation(true);
    // Called by Preloader timeline — only runs if not yet played
    window._playTitleOnce = () => runAnimation(false);

    if (loaded && !hasPlayed.current) {
      const id = setTimeout(() => runAnimation(false), 50);
      return () => { clearTimeout(id); };
    }
  }, [loaded]);

  // Countdown ticker
  useEffect(() => {
    const id = setInterval(() => setTime(getRemaining()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className={`hero section-enter${showroom ? ' hero--showroom' : ''}`}>
      <div className="hero__canvas" id="hero-canvas" />

      <GradualBlur
        position="top"
        height="7rem"
        strength={1.5}
        divCount={2}
        curve="bezier"
        exponential
        opacity={1}
        zIndex={3}
      />

      <div className="hero__content">
        <h1 ref={titleRef} className="hero__title">
          {splitChars(TITLE_TEXT)}
        </h1>
        <p ref={subtitleRef} className="hero__subtitle">
          {splitChars(SUBTITLE_TEXT)}
        </p>
      </div>

      <div className={`hero__footer${uiRevealed ? ' hero__footer--visible' : ''}`}>
        <div className="hero__countdown">
          {time.h}<span>h</span> {time.m}<span>m</span> {time.s}<span>s</span>
        </div>
        {renderCta()}
      </div>
    </section>
  );
}

function renderCta() {
  const EB = (typeof window !== 'undefined' && window.electricBtn) || {};
  const btn = <button className="hero__cta">Entra in Waitinglist</button>;

  if (!EB.enabled) return btn;

  if (EB.position === 'around') {
    return (
      <ElectricBorder
        color={EB.color}
        speed={EB.speed}
        chaos={EB.chaos}
        thickness={EB.thickness}
        borderRadius={EB.borderRadius}
        style={{ borderRadius: EB.borderRadius }}
      >
        {btn}
      </ElectricBorder>
    );
  }

  // Above or below: standalone decorative line
  const line = (
    <ElectricBorder
      color={EB.color}
      speed={EB.speed}
      chaos={EB.chaos}
      thickness={EB.thickness}
      borderRadius={EB.borderRadius}
      style={{ borderRadius: EB.borderRadius, width: 240, height: 6 }}
    >
      <div style={{ width: 240, height: 6 }} />
    </ElectricBorder>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {EB.position === 'above' && line}
      {btn}
      {EB.position === 'below' && line}
    </div>
  );
}

function splitChars(text) {
  return text.split('').map((ch, i) => (
    <span key={i} className="char-wrap">
      <span className="char">{ch === ' ' ? '\u00A0' : ch}</span>
    </span>
  ));
}

function getRemaining() {
  const diff = Math.max(0, TARGET - Date.now());
  return {
    h: Math.floor(diff / 3600000),
    m: Math.floor((diff % 3600000) / 60000),
    s: Math.floor((diff % 60000) / 1000),
  };
}
