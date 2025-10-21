import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import './LoadingScreen.css';

export default function LoadingScreen({ onLoadingComplete }) {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    let progressInterval;
    let minLoadTimeout;
    let hasReachedTarget = false;
    const startTime = Date.now();
    const totalDuration = 2500; // ms

    progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progressPercentage = Math.min((elapsed / totalDuration) * 100, 100);
      const variance = Math.random() * 3 - 1.5; // jitter +/-1.5%
      const adjustedProgress = Math.min(Math.max(progressPercentage + variance, 0), 100);
      setProgress(adjustedProgress);

      if (adjustedProgress >= 100 && !hasReachedTarget) {
        hasReachedTarget = true;
        clearInterval(progressInterval);
        // Hold for 2s to allow users to read, then slide up
        setTimeout(() => {
          setIsVisible(false);
          // After slide-up completes, notify parent
          setTimeout(() => { onLoadingComplete && onLoadingComplete(); }, 1200);
        }, 2000);
      }
    }, 50);

    minLoadTimeout = setTimeout(() => {
      if (!hasReachedTarget) {
        hasReachedTarget = true;
        setProgress(100);
        clearInterval(progressInterval);
        // Same hold and slide timings as above
        setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => { onLoadingComplete && onLoadingComplete(); }, 1200);
        }, 2000);
      }
    }, totalDuration + 500);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(minLoadTimeout);
    };
  }, [onLoadingComplete]);

  return (
    <motion.div
      className="loading-screen"
      initial={{ y: 0, opacity: 1 }}
      animate={{ y: isVisible ? 0 : '-100%', opacity: 1 }}
      transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="loading-screen__content">
        <div className="loading-screen__header">
          <h1 className="loading-screen__title">Build your Career</h1>
          <p className="loading-screen__subtitle">Turn your professional growth into a quest-driven adventure.</p>
        </div>

        <div className="loading-screen__progress">
          <div className="loading-screen__progress-bar">
            <div className="loading-screen__progress-fill" style={{ width: `${Math.floor(progress)}%` }} />
          </div>
          <div className="loading-screen__percentage">{Math.floor(progress)}%</div>
        </div>

        <div className="loading-screen__dots">
          <div className="loading-screen__dot loading-screen__dot--1" />
          <div className="loading-screen__dot loading-screen__dot--2" />
          <div className="loading-screen__dot loading-screen__dot--3" />
        </div>
      </div>
    </motion.div>
  );
}


