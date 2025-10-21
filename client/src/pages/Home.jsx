import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen.jsx';

export default function Home() {
  const [showLoader] = useState(() => {
    try { return !sessionStorage.getItem('pq_loader_seen'); } catch { return true; }
  });
  const navigate = useNavigate();

  useEffect(() => {
    if (!showLoader) {
      // Skip loader on subsequent visits this session
      navigate('/login?mode=signup', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoadingComplete = () => {
    try { sessionStorage.setItem('pq_loader_seen', '1'); } catch {}
    navigate('/login?mode=signup', { replace: true });
  };

  return (
    <motion.div
      className="min-h-screen flex items-center justify-center px-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
    >
      {showLoader && (
        <LoadingScreen
          onLoadingComplete={() => {
            handleLoadingComplete();
          }}
        />
      )}
      {!showLoader && (
      <section className="flex flex-col items-center text-center max-w-3xl">
        <motion.h1
          className="heading text-4xl md:text-6xl"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
        >
          Build your Career
        </motion.h1>
        <motion.p
          className="subheading mt-4 max-w-2xl text-lg md:text-xl"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: 0.05 }}
        >
          Turn your professional growth into a quest-driven adventure.
        </motion.p>
        <motion.div
          className="mt-8 flex gap-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
        >
          <Link to="/login" className="btn-primary text-lg px-6 py-3">Get Started</Link>
        </motion.div>
      </section>
      )}
    </motion.div>
  );
}


