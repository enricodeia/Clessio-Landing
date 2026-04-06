import React, { useState, useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import Header from './components/Header.jsx';
import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import Progetti from './components/Progetti.jsx';
import Preloader from './components/Preloader.jsx';
import PageTransition from './components/PageTransition.jsx';
import CustomCursor from './components/CustomCursor.jsx';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [trackingActive, setTrackingActive] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleTrackingToggle = useCallback(() => {
    setTrackingActive((prev) => {
      const next = !prev;
      if (window.toggleHandTracking) window.toggleHandTracking(next);
      return next;
    });
  }, []);

  const [uiRevealed, setUiRevealed] = useState(false);

  const handlePreloaderDone = useCallback(() => {
    setLoaded(true);
  }, []);

  // Reveal header/navbar/footer after title animation finishes
  useEffect(() => {
    window._revealHomeUI = () => setUiRevealed(true);
    return () => { window._revealHomeUI = null; };
  }, []);

  const pendingTabRef = useRef(null);

  const handleTabChange = useCallback((tab) => {
    if (tab === activeTab) return;
    // Only use page transition wipe for Progetti (entering or leaving)
    if (tab === 'progetti' || activeTab === 'progetti') {
      pendingTabRef.current = tab;
      if (window._runPageTransition) window._runPageTransition();
    } else {
      // Home ↔ Showroom: direct switch (zoom transition handled by shoe-lab)
      setActiveTab(tab);
    }
  }, [activeTab]);

  const handleTransitionMidpoint = useCallback(() => {
    const target = pendingTabRef.current;
    pendingTabRef.current = null;
    if (!target) return;

    if (target === 'showroom') {
      // Coming from Progetti → Showroom: mount Hero as 'showroom' directly.
      // The useEffect will call enterShowroom() which builds the grid.
      // The shoe is already in the scene from initShoeLab.
      setActiveTab('showroom');
    } else {
      setActiveTab(target);
    }

    // Animate Progetti container in from right after reveal
    setTimeout(() => {
      const container = document.querySelector('.progetti-effect__container');
      if (container) {
        gsap.fromTo(container,
          { x: 60, opacity: 0 },
          { x: 0, opacity: 1, duration: 1.2, ease: 'circ.out' }
        );
      }
    }, 0);
  }, []);

  // Auto-disable head tracking when leaving home tab
  useEffect(() => {
    if (activeTab !== 'home' && trackingActive) {
      if (window.toggleHandTracking) window.toggleHandTracking(false);
      setTrackingActive(false);
    }
  }, [activeTab, trackingActive]);

  // Toggle showroom grid inside the same 3D scene
  useEffect(() => {
    if (!loaded) return;
    if (activeTab === 'showroom') {
      if (window.enterShowroom) window.enterShowroom();
    } else {
      if (window.exitShowroom) window.exitShowroom();
    }
  }, [activeTab, loaded]);


  return (
    <div className="app">
      {!loaded && <Preloader onComplete={handlePreloaderDone} />}

      {loaded && <Header activeTab={activeTab} visible={uiRevealed} onLogoClick={() => handleTabChange('home')} />}

      {/* Hero canvas stays ALWAYS mounted so 3D scene persists across tabs */}
      <div style={{ display: activeTab === 'progetti' ? 'none' : 'contents' }}>
        <Hero loaded={loaded} showroom={activeTab === 'showroom'} uiRevealed={uiRevealed} />
      </div>
      {activeTab === 'progetti' && loaded && <Progetti />}

      {loaded && (
        <Navbar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          trackingActive={trackingActive}
          onTrackingToggle={handleTrackingToggle}
          visible={uiRevealed}
        />
      )}

      {loaded && <PageTransition onMidpoint={handleTransitionMidpoint} />}
      <CustomCursor />
    </div>
  );
}
