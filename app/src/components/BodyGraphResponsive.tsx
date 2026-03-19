/**
 * Responsive BodyGraph Component
 * OPTIMIZED: Mobile-first, touch support, performance
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { HumanDesignChart } from '@/types/humanDesign';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

interface BodyGraphResponsiveProps {
  chart?: HumanDesignChart;
  className?: string;
  interactive?: boolean;
}

interface ViewState {
  zoom: number;
  pan: { x: number; y: number };
}

interface TouchState {
  startX: number;
  startY: number;
  initialPan: { x: number; y: number };
  initialDistance: number;
  initialZoom: number;
}

// Center positions (percentage-based)
const CENTERS = {
  HEAD: { x: 50, y: 8, shape: 'diamond' as const },
  AJNA: { x: 50, y: 20, shape: 'triangle-down' as const },
  THROAT: { x: 50, y: 32, shape: 'rectangle' as const },
  G_CENTER: { x: 50, y: 45, shape: 'diamond' as const },
  SACRAL: { x: 50, y: 60, shape: 'rectangle' as const },
  ROOT: { x: 50, y: 78, shape: 'rectangle' as const },
  SPLEEN: { x: 25, y: 50, shape: 'triangle-left' as const },
  SOLAR_PLEXUS: { x: 75, y: 50, shape: 'triangle-right' as const },
  HEART: { x: 25, y: 35, shape: 'triangle-left' as const },
} as const;

const CHANNELS: [keyof typeof CENTERS, keyof typeof CENTERS][] = [
  ['HEAD', 'AJNA'],
  ['AJNA', 'THROAT'],
  ['THROAT', 'G_CENTER'],
  ['THROAT', 'SPLEEN'],
  ['THROAT', 'SOLAR_PLEXUS'],
  ['THROAT', 'HEART'],
  ['G_CENTER', 'SACRAL'],
  ['G_CENTER', 'SPLEEN'],
  ['G_CENTER', 'SOLAR_PLEXUS'],
  ['SACRAL', 'ROOT'],
  ['SACRAL', 'SPLEEN'],
  ['SACRAL', 'SOLAR_PLEXUS'],
  ['ROOT', 'SPLEEN'],
  ['ROOT', 'SOLAR_PLEXUS'],
  ['SPLEEN', 'HEART'],
];

// Gate positions (simplified for performance)
const GATES: Record<number, { x: number; y: number }> = {
  64: { x: 45, y: 5 }, 61: { x: 50, y: 3 }, 63: { x: 55, y: 5 }, 60: { x: 50, y: 7 },
  47: { x: 45, y: 17 }, 24: { x: 55, y: 17 }, 4: { x: 47, y: 22 }, 11: { x: 53, y: 22 },
  56: { x: 35, y: 30 }, 35: { x: 42, y: 28 }, 12: { x: 46, y: 30 }, 45: { x: 50, y: 28 },
  33: { x: 54, y: 30 }, 20: { x: 58, y: 28 }, 31: { x: 62, y: 30 }, 8: { x: 65, y: 32 },
  23: { x: 38, y: 32 }, 1: { x: 45, y: 42 }, 13: { x: 55, y: 42 }, 25: { x: 42, y: 45 },
  46: { x: 58, y: 45 }, 2: { x: 45, y: 48 }, 15: { x: 55, y: 48 }, 10: { x: 47, y: 50 },
  7: { x: 53, y: 50 }, 5: { x: 42, y: 57 }, 14: { x: 58, y: 57 }, 29: { x: 38, y: 60 },
  59: { x: 62, y: 60 }, 9: { x: 42, y: 63 }, 3: { x: 58, y: 63 }, 42: { x: 45, y: 66 },
  27: { x: 55, y: 66 }, 34: { x: 50, y: 63 }, 53: { x: 38, y: 75 }, 54: { x: 62, y: 75 },
  60: { x: 45, y: 77 }, 52: { x: 55, y: 77 }, 19: { x: 35, y: 80 }, 39: { x: 65, y: 80 },
  38: { x: 42, y: 82 }, 58: { x: 58, y: 82 }, 41: { x: 48, y: 84 }, 32: { x: 52, y: 84 },
  48: { x: 15, y: 45 }, 57: { x: 20, y: 48 }, 44: { x: 18, y: 52 }, 50: { x: 25, y: 55 },
  18: { x: 22, y: 58 }, 36: { x: 85, y: 45 }, 55: { x: 80, y: 48 }, 30: { x: 82, y: 52 },
  49: { x: 75, y: 55 }, 37: { x: 78, y: 58 }, 22: { x: 70, y: 50 }, 6: { x: 72, y: 47 },
  40: { x: 15, y: 32 }, 26: { x: 20, y: 35 }, 51: { x: 25, y: 38 }, 21: { x: 18, y: 40 },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function BodyGraphResponsive({
  chart,
  className,
  interactive = true,
}: BodyGraphResponsiveProps) {
  // View state
  const [view, setView] = useState<ViewState>({ zoom: 1, pan: { x: 0, y: 0 } });
  const [selectedGate, setSelectedGate] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const touchState = useRef<TouchState | null>(null);
  const lastTapRef = useRef(0);

  // Memoized derived state
  const definedGates = useMemo(() => {
    if (!chart?.gates) return new Set<number>();
    return new Set(chart.gates.map((g) => g.number));
  }, [chart?.gates]);

  const definedChannels = useMemo(() => {
    if (!chart?.channels) return new Set<string>();
    return new Set(chart.channels.map((c) => `${c.gate1}-${c.gate2}`));
  }, [chart?.channels]);

  const definedCenters = useMemo(() => {
    if (!chart?.definedCenters) return new Set<string>();
    return new Set(chart.definedCenters);
  }, [chart?.definedCenters]);

  const isChannelDefined = useCallback(
    (from: keyof typeof CENTERS, to: keyof typeof CENTERS) => {
      const key1 = `${GATES_BY_CENTER[from]}-${GATES_BY_CENTER[to]}`;
      const key2 = `${GATES_BY_CENTER[to]}-${GATES_BY_CENTER[from]}`;
      return definedChannels.has(key1) || definedChannels.has(key2);
    },
    [definedChannels]
  );

  // Reset view
  const resetView = useCallback(() => {
    setView({ zoom: 1, pan: { x: 0, y: 0 } });
  }, []);

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setView((v) => ({ ...v, zoom: Math.min(2, v.zoom + 0.2) }));
  }, []);

  const zoomOut = useCallback(() => {
    setView((v) => ({ ...v, zoom: Math.max(0.5, v.zoom - 0.2) }));
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!interactive) return;
      e.preventDefault();

      const touch = e.touches[0];
      const now = Date.now();

      // Double tap detection
      if (now - lastTapRef.current < 300) {
        resetView();
        return;
      }
      lastTapRef.current = now;

      if (e.touches.length === 1) {
        // Single touch - pan
        touchState.current = {
          startX: touch.clientX,
          startY: touch.clientY,
          initialPan: { ...view.pan },
          initialDistance: 0,
          initialZoom: view.zoom,
        };
        setIsDragging(true);
      } else if (e.touches.length === 2) {
        // Double touch - pinch zoom
        const touch2 = e.touches[1];
        const distance = Math.hypot(
          touch2.clientX - touch.clientX,
          touch2.clientY - touch.clientY
        );
        touchState.current = {
          ...touchState.current!,
          initialDistance: distance,
          initialZoom: view.zoom,
        };
      }
    },
    [interactive, view, resetView]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!interactive || !touchState.current) return;
      e.preventDefault();

      if (e.touches.length === 1 && isDragging) {
        // Pan
        const touch = e.touches[0];
        const dx = touch.clientX - touchState.current.startX;
        const dy = touch.clientY - touchState.current.startY;

        setView((v) => ({
          ...v,
          pan: {
            x: touchState.current!.initialPan.x + dx * 0.5,
            y: touchState.current!.initialPan.y + dy * 0.5,
          },
        }));
      } else if (e.touches.length === 2 && touchState.current.initialDistance > 0) {
        // Pinch zoom
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const distance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
        const scale = distance / touchState.current.initialDistance;

        setView((v) => ({
          ...v,
          zoom: Math.max(0.5, Math.min(2, touchState.current!.initialZoom * scale)),
        }));
      }
    },
    [interactive, isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    touchState.current = null;
  }, []);

  // Wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!interactive) return;
      e.preventDefault();

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setView((v) => ({
        ...v,
        zoom: Math.max(0.5, Math.min(2, v.zoom + delta)),
      }));
    },
    [interactive]
  );

  // Gate selection
  const handleGateClick = useCallback(
    (gateNum: number) => (e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedGate((prev) => (prev === gateNum ? null : gateNum));
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      touchState.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full min-h-[350px] select-none touch-manipulation', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onWheel={handleWheel}
    >
      {/* Controls */}
      {interactive && (
        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
          <ControlButton onClick={zoomIn} label="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </ControlButton>
          <ControlButton onClick={zoomOut} label="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </ControlButton>
          <ControlButton onClick={resetView} label="Reset view">
            <RotateCcw className="w-4 h-4" />
          </ControlButton>
        </div>
      )}

      {/* SVG Container */}
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        style={{
          transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: isDragging ? 'grabbing' : interactive ? 'grab' : 'default',
        }}
      >
        <defs>
          <linearGradient id="definedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="undefinedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="100%" stopColor="#1f2937" />
          </linearGradient>
        </defs>

        {/* Channels */}
        {CHANNELS.map(([from, to], i) => {
          const fromCenter = CENTERS[from];
          const toCenter = CENTERS[to];
          const isDefined = isChannelDefined(from, to);

          return (
            <motion.line
              key={`${from}-${to}`}
              x1={fromCenter.x}
              y1={fromCenter.y}
              x2={toCenter.x}
              y2={toCenter.y}
              stroke={isDefined ? 'url(#definedGradient)' : '#374151'}
              strokeWidth={isDefined ? 0.8 : 0.3}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: i * 0.03 }}
            />
          );
        })}

        {/* Centers */}
        {Object.entries(CENTERS).map(([name, center]) => {
          const isDefined = definedCenters.has(name);
          const size = name === 'G_CENTER' ? 6 : 5;

          return (
            <CenterShape
              key={name}
              name={name}
              center={center}
              size={size}
              isDefined={isDefined}
            />
          );
        })}

        {/* Gates */}
        {Object.entries(GATES).map(([gateNumStr, pos]) => {
          const gateNum = parseInt(gateNumStr, 10);
          const isDefined = definedGates.has(gateNum);
          const isSelected = selectedGate === gateNum;

          return (
            <motion.circle
              key={gateNum}
              cx={pos.x}
              cy={pos.y}
              r={isSelected ? 1.8 : 1.2}
              fill={isDefined ? '#fbbf24' : '#6b7280'}
              stroke={isSelected ? '#fff' : 'none'}
              strokeWidth="0.3"
              onClick={handleGateClick(gateNum)}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
              whileHover={interactive ? { scale: 1.5 } : undefined}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: gateNum * 0.005 }}
            />
          );
        })}
      </svg>

      {/* Gate Info Panel */}
      <AnimatePresence>
        {selectedGate && interactive && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-4 left-4 right-4 p-4 rounded-xl bg-black/80 backdrop-blur-md border border-white/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-white">Tor {selectedGate}</p>
                <p className="text-sm text-white/60">
                  {definedGates.has(selectedGate) ? 'Definiert' : 'Nicht definiert'}
                </p>
              </div>
              <button
                onClick={() => setSelectedGate(null)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                aria-label="Schließen"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom indicator */}
      {view.zoom !== 1 && (
        <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-xs text-white/70">
          {Math.round(view.zoom * 100)}%
        </div>
      )}
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="p-2 rounded-lg bg-white/10 backdrop-blur-sm hover:bg-white/20 transition-colors text-white/70 hover:text-white"
      aria-label={label}
    >
      {children}
    </button>
  );
}

interface CenterShapeProps {
  name: string;
  center: { x: number; y: number; shape: string };
  size: number;
  isDefined: boolean;
}

function CenterShape({ name, center, size, isDefined }: CenterShapeProps) {
  const fill = isDefined ? 'url(#definedGradient)' : '#1f2937';
  const stroke = isDefined ? '#a855f7' : '#374151';

  const renderShape = () => {
    switch (center.shape) {
      case 'diamond':
        return (
          <polygon
            points={`${center.x},${center.y - size} ${center.x + size * 0.8},${center.y} ${center.x},${center.y + size} ${center.x - size * 0.8},${center.y}`}
            fill={fill}
            stroke={stroke}
            strokeWidth="0.3"
          />
        );
      case 'triangle-down':
        return (
          <polygon
            points={`${center.x},${center.y + size} ${center.x - size},${center.y - size} ${center.x + size},${center.y - size}`}
            fill={fill}
            stroke={stroke}
            strokeWidth="0.3"
          />
        );
      case 'triangle-left':
        return (
          <polygon
            points={`${center.x - size},${center.y} ${center.x + size},${center.y - size * 0.8} ${center.x + size},${center.y + size * 0.8}`}
            fill={fill}
            stroke={stroke}
            strokeWidth="0.3"
          />
        );
      case 'triangle-right':
        return (
          <polygon
            points={`${center.x + size},${center.y} ${center.x - size},${center.y - size * 0.8} ${center.x - size},${center.y + size * 0.8}`}
            fill={fill}
            stroke={stroke}
            strokeWidth="0.3"
          />
        );
      default: // rectangle
        return (
          <rect
            x={center.x - size * 0.8}
            y={center.y - size * 0.6}
            width={size * 1.6}
            height={size * 1.2}
            rx="0.5"
            fill={fill}
            stroke={stroke}
            strokeWidth="0.3"
          />
        );
    }
  };

  return <g data-center={name}>{renderShape()}</g>;
}

// Helper to get a representative gate for each center (for channel checking)
const GATES_BY_CENTER: Record<string, number> = {
  HEAD: 64,
  AJNA: 47,
  THROAT: 56,
  G_CENTER: 1,
  HEART: 40,
  SACRAL: 5,
  SPLEEN: 48,
  SOLAR_PLEXUS: 36,
  ROOT: 53,
};
