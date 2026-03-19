/**
 * Cosmic Loader Component
 * Animated loader with cosmic/astrological theme
 */

import { motion } from 'framer-motion';

interface CosmicLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  subtext?: string;
}

const sizeConfig = {
  sm: { container: 60, orbit: 20, planet: 6 },
  md: { container: 100, orbit: 35, planet: 10 },
  lg: { container: 150, orbit: 50, planet: 14 },
};

export function CosmicLoader({ size = 'md', text, subtext }: CosmicLoaderProps) {
  const config = sizeConfig[size];

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="relative"
        style={{ width: config.container, height: config.container }}
      >
        {/* Central sun */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-400 to-orange-600"
          style={{ width: config.planet * 1.5, height: config.planet * 1.5 }}
          animate={{
            boxShadow: [
              '0 0 20px rgba(251, 191, 36, 0.4)',
              '0 0 40px rgba(251, 191, 36, 0.6)',
              '0 0 20px rgba(251, 191, 36, 0.4)',
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Orbit rings */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10"
            style={{
              width: config.orbit * (1.5 + i * 0.8),
              height: config.orbit * (1.5 + i * 0.8),
            }}
            animate={{ rotate: 360 }}
            transition={{
              duration: 8 + i * 4,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {/* Planet on orbit */}
            <motion.div
              className="absolute rounded-full"
              style={{
                width: config.planet * (0.6 + i * 0.2),
                height: config.planet * (0.6 + i * 0.2),
                top: -config.planet * (0.3 + i * 0.1),
                left: '50%',
                marginLeft: -config.planet * (0.3 + i * 0.1),
                background: `linear-gradient(135deg, ${
                  i === 0 ? '#a855f7, #6366f1' : i === 1 ? '#ec4899, #f43f5e' : '#14b8a6, #06b6d4'
                })`,
              }}
            />
          </motion.div>
        ))}

        {/* Particles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={`particle-${i}`}
            className="absolute w-1 h-1 rounded-full bg-white/40"
            style={{
              top: '50%',
              left: '50%',
            }}
            animate={{
              x: [
                0,
                Math.cos((i * Math.PI) / 3) * config.container * 0.4,
                Math.cos((i * Math.PI) / 3) * config.container * 0.5,
                0,
              ],
              y: [
                0,
                Math.sin((i * Math.PI) / 3) * config.container * 0.4,
                Math.sin((i * Math.PI) / 3) * config.container * 0.5,
                0,
              ],
              opacity: [0, 1, 0, 0],
              scale: [0, 1, 0.5, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.5,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Text */}
      {text && (
        <motion.p
          className="mt-6 text-white/80 text-sm font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {text}
        </motion.p>
      )}

      {subtext && (
        <motion.p
          className="mt-2 text-white/40 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {subtext}
        </motion.p>
      )}
    </div>
  );
}

export function FullscreenLoader({
  text = 'Berechne dein Human Design...',
  subtext = 'NASA JPL Ephemeris',
}: {
  text?: string;
  subtext?: string;
}) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <CosmicLoader size="lg" text={text} subtext={subtext} />
    </motion.div>
  );
}
