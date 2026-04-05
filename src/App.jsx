import React, { useState, useCallback, useEffect } from 'react';
import Header from './components/Header.jsx';
import Navbar from './components/Navbar.jsx';
import Hero from './components/Hero.jsx';
import Progetti from './components/Progetti.jsx';
import Preloader from './components/Preloader.jsx';

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

  const handlePreloaderDone = useCallback(() => {
    setLoaded(true);
    // Title animation already triggered by Preloader at -0.5s mark
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

      {loaded && <Header activeTab={activeTab} />}

      {/* Hero canvas stays mounted across home/showroom tabs */}
      {(activeTab === 'home' || activeTab === 'showroom') && (
        <Hero loaded={loaded} showroom={activeTab === 'showroom'} />
      )}
      {activeTab === 'progetti' && loaded && <Progetti />}

      {loaded && (
        <Navbar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          trackingActive={trackingActive}
          onTrackingToggle={handleTrackingToggle}
        />
      )}
    </div>
  );
}
