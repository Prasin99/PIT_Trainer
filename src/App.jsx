import React, { useState, useCallback } from 'react';
import { PITSetup } from './pitTrainer/PITSetup.jsx';
import { PITTraining } from './pitTrainer/PITTraining.jsx';
import { PITSummary } from './pitTrainer/PITSummary.jsx';
import { PITPanel } from './pitTrainer/PITPanel.jsx';

// Dev-only preview route: ?preview=pit renders just the instrument panel
// full-screen for visual sign-off against the reference photo.
function PITPanelPreview() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <PITPanel />
    </div>
  );
}

/**
 * Standalone shell for the PIT (Panel Instrument Test) trainer. Inside the
 * LMS, the course config mounts <PITTraining/> directly with its own
 * settings — this App is for dev / preview / standalone testing.
 */
export default function App() {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'pit') {
    return <PITPanelPreview />;
  }

  const [phase, setPhase] = useState('setup'); // 'setup' | 'training' | 'summary'
  const [settings, setSettings] = useState(null);
  const [result, setResult] = useState(null);

  const handleStart = useCallback((s) => { setSettings(s); setResult(null); setPhase('training'); }, []);
  const handleComplete = useCallback((r) => { setResult(r); setPhase('summary'); }, []);
  const handleExit = useCallback(() => { setPhase('setup'); }, []);
  const handleTryAgain = useCallback(() => { setPhase('training'); }, []);
  const handleDone = useCallback(() => { setPhase('setup'); setSettings(null); setResult(null); }, []);

  if (phase === 'setup') {
    return <PITSetup onStart={handleStart} />;
  }

  if (phase === 'training') {
    return (
      <div className="w-screen h-screen overflow-hidden">
        <PITTraining settings={settings} onComplete={handleComplete} onExit={handleExit} />
      </div>
    );
  }

  return <PITSummary result={result} onTryAgain={handleTryAgain} onDone={handleDone} />;
}
