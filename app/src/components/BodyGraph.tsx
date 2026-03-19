import { useState } from 'react';
import { motion } from 'framer-motion';

interface Gate {
  number: number;
  line: number;
  color: number;
  tone: number;
  base: number;
  planet: string;
  isDesign: boolean;
}

interface Channel {
  gate1: number;
  gate2: number;
}

interface BodyGraphProps {
  gates: Gate[];
  channels: Channel[];
  definedCenters: string[];
  energyType: string;
}

// Center positions and sizes
const centers = {
  HEAD: { x: 200, y: 40, w: 60, h: 40, label: 'Kopf', desc: 'Inspiration & Druck' },
  AJNA: { x: 200, y: 110, w: 60, h: 50, label: 'Ajna', desc: 'Verstand & Konzepte' },
  THROAT: { x: 200, y: 200, w: 80, h: 45, label: 'Kehle', desc: 'Kommunikation & Aktion' },
  G_CENTER: { x: 200, y: 290, w: 70, h: 70, label: 'G-Zentrum', desc: 'Identität & Richtung' },
  HEART: { x: 320, y: 290, w: 55, h: 55, label: 'Herz', desc: 'Wille & Ego' },
  SACRAL: { x: 200, y: 400, w: 80, h: 60, label: 'Sakral', desc: 'Lebenskraft & Arbeit' },
  SPLEEN: { x: 80, y: 290, w: 55, h: 70, label: 'Milz', desc: 'Intuition & Überleben' },
  SOLAR_PLEXUS: { x: 80, y: 400, w: 60, h: 60, label: 'Solarplexus', desc: 'Emotionen & Begierde' },
  ROOT: { x: 200, y: 510, w: 80, h: 50, label: 'Wurzel', desc: 'Adrenalin & Stress' },
};

// Gate positions within centers
const gatePositions: Record<number, { center: string; x: number; y: number }> = {
  // Head Center
  64: { center: 'HEAD', x: 185, y: 45 },
  61: { center: 'HEAD', x: 200, y: 35 },
  63: { center: 'HEAD', x: 215, y: 45 },
  
  // Ajna Center
  47: { center: 'AJNA', x: 185, y: 120 },
  24: { center: 'AJNA', x: 200, y: 110 },
  4: { center: 'AJNA', x: 215, y: 120 },
  11: { center: 'AJNA', x: 200, y: 145 },
  
  // Throat Center
  62: { center: 'THROAT', x: 170, y: 205 },
  23: { center: 'THROAT', x: 185, y: 200 },
  56: { center: 'THROAT', x: 200, y: 195 },
  35: { center: 'THROAT', x: 215, y: 200 },
  12: { center: 'THROAT', x: 230, y: 205 },
  45: { center: 'THROAT', x: 170, y: 235 },
  33: { center: 'THROAT', x: 200, y: 240 },
  20: { center: 'THROAT', x: 230, y: 235 },
  
  // G Center
  10: { center: 'G_CENTER', x: 185, y: 300 },
  15: { center: 'G_CENTER', x: 215, y: 300 },
  46: { center: 'G_CENTER', x: 185, y: 340 },
  25: { center: 'G_CENTER', x: 215, y: 340 },
  2: { center: 'G_CENTER', x: 200, y: 280 },
  1: { center: 'G_CENTER', x: 200, y: 360 },
  7: { center: 'G_CENTER', x: 165, y: 320 },
  13: { center: 'G_CENTER', x: 235, y: 320 },
  
  // Heart Center
  40: { center: 'HEART', x: 335, y: 300 },
  26: { center: 'HEART', x: 360, y: 300 },
  51: { center: 'HEART', x: 335, y: 330 },
  21: { center: 'HEART', x: 360, y: 330 },
  44: { center: 'HEART', x: 347, y: 275 },
  
  // Sacral Center
  34: { center: 'SACRAL', x: 185, y: 410 },
  59: { center: 'SACRAL', x: 215, y: 410 },
  27: { center: 'SACRAL', x: 170, y: 435 },
  42: { center: 'SACRAL', x: 200, y: 445 },
  3: { center: 'SACRAL', x: 230, y: 435 },
  9: { center: 'SACRAL', x: 185, y: 390 },
  5: { center: 'SACRAL', x: 215, y: 390 },
  14: { center: 'SACRAL', x: 200, y: 425 },
  29: { center: 'SACRAL', x: 170, y: 400 },
  
  // Spleen Center
  57: { center: 'SPLEEN', x: 95, y: 300 },
  48: { center: 'SPLEEN', x: 120, y: 300 },
  18: { center: 'SPLEEN', x: 95, y: 330 },
  32: { center: 'SPLEEN', x: 120, y: 330 },
  50: { center: 'SPLEEN', x: 107, y: 275 },
  28: { center: 'SPLEEN', x: 107, y: 355 },
  
  // Solar Plexus Center
  22: { center: 'SOLAR_PLEXUS', x: 95, y: 410 },
  55: { center: 'SOLAR_PLEXUS', x: 125, y: 410 },
  36: { center: 'SOLAR_PLEXUS', x: 95, y: 440 },
  30: { center: 'SOLAR_PLEXUS', x: 125, y: 440 },
  37: { center: 'SOLAR_PLEXUS', x: 110, y: 390 },
  49: { center: 'SOLAR_PLEXUS', x: 110, y: 460 },
  6: { center: 'SOLAR_PLEXUS', x: 80, y: 425 },
  
  // Root Center
  58: { center: 'ROOT', x: 170, y: 515 },
  52: { center: 'ROOT', x: 185, y: 510 },
  19: { center: 'ROOT', x: 200, y: 505 },
  39: { center: 'ROOT', x: 215, y: 510 },
  41: { center: 'ROOT', x: 230, y: 515 },
  54: { center: 'ROOT', x: 170, y: 545 },
  60: { center: 'ROOT', x: 200, y: 550 },
  38: { center: 'ROOT', x: 230, y: 545 },
  53: { center: 'ROOT', x: 185, y: 535 },
};

// Channel connections
const channelPaths: Record<string, [number, number]> = {
  '1-8': [1, 8],
  '2-14': [2, 14],
  '3-60': [3, 60],
  '4-63': [4, 63],
  '5-15': [5, 15],
  '6-59': [6, 59],
  '7-31': [7, 31],
  '9-52': [9, 52],
  '10-20': [10, 20],
  '10-34': [10, 34],
  '10-57': [10, 57],
  '11-56': [11, 56],
  '12-22': [12, 22],
  '13-33': [13, 33],
  '16-48': [16, 48],
  '17-62': [17, 62],
  '18-58': [18, 58],
  '19-49': [19, 49],
  '20-34': [20, 34],
  '20-57': [20, 57],
  '21-45': [21, 45],
  '23-43': [23, 43],
  '24-61': [24, 61],
  '25-51': [25, 51],
  '26-44': [26, 44],
  '27-50': [27, 50],
  '28-38': [28, 38],
  '29-46': [29, 46],
  '30-41': [30, 41],
  '32-54': [32, 54],
  '34-57': [34, 57],
  '35-36': [35, 36],
  '37-40': [37, 40],
  '39-55': [39, 55],
  '42-53': [42, 53],
  '47-64': [47, 64],
};

export function BodyGraph({ gates, channels, definedCenters, energyType }: BodyGraphProps) {
  const [hoveredGate, setHoveredGate] = useState<Gate | null>(null);
  const [hoveredCenter, setHoveredCenter] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const activeGateNumbers = new Set(gates.map(g => g.number));
  const activeChannelPairs = channels.map(c => [c.gate1, c.gate2].sort().join('-'));

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  const getGateInfo = (gateNum: number): Gate | undefined => {
    return gates.find(g => g.number === gateNum);
  };

  const isGateActive = (gateNum: number) => activeGateNumbers.has(gateNum);

  const isChannelActive = (g1: number, g2: number) => {
    return activeChannelPairs.includes([g1, g2].sort().join('-'));
  };

  const getCenterColor = (centerName: string) => {
    if (definedCenters.includes(centerName)) {
      switch (energyType) {
        case 'MANIFESTOR': return '#fbbf24';
        case 'GENERATOR': return '#f87171';
        case 'MANIFESTING_GENERATOR': return '#fb923c';
        case 'PROJECTOR': return '#fde047';
        case 'REFLECTOR': return '#94a3b8';
        default: return '#a855f7';
      }
    }
    return 'transparent';
  };

  const getCenterBorderColor = (centerName: string) => {
    return definedCenters.includes(centerName) ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
  };

  return (
    <div className="relative" onMouseMove={handleMouseMove}>
      <svg viewBox="0 0 400 580" className="w-full max-w-md mx-auto">
        {/* Background */}
        <rect width="400" height="580" fill="transparent" />

        {/* Channels */}
        {Object.entries(channelPaths).map(([key, [g1, g2]]) => {
          const pos1 = gatePositions[g1];
          const pos2 = gatePositions[g2];
          if (!pos1 || !pos2) return null;

          const isActive = isChannelActive(g1, g2);

          return (
            <line
              key={key}
              x1={pos1.x}
              y1={pos1.y}
              x2={pos2.x}
              y2={pos2.y}
              stroke={isActive ? 'rgba(168, 85, 247, 0.8)' : 'rgba(255,255,255,0.08)'}
              strokeWidth={isActive ? 3 : 1}
              strokeLinecap="round"
            />
          );
        })}

        {/* Centers */}
        {Object.entries(centers).map(([name, center]) => (
          <g key={name}>
            <motion.rect
              x={center.x - center.w / 2}
              y={center.y - center.h / 2}
              width={center.w}
              height={center.h}
              rx={8}
              fill={getCenterColor(name)}
              stroke={getCenterBorderColor(name)}
              strokeWidth={2}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHoveredCenter(name)}
              onMouseLeave={() => setHoveredCenter(null)}
              style={{
                filter: hoveredCenter === name ? 'brightness(1.2)' : 'none',
              }}
            />
            <text
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={definedCenters.includes(name) ? 'white' : 'rgba(255,255,255,0.5)'}
              fontSize={10}
              fontWeight={500}
            >
              {center.label}
            </text>
          </g>
        ))}

        {/* Gates */}
        {Object.entries(gatePositions).map(([gateNum, pos]) => {
          const gate = getGateInfo(parseInt(gateNum));
          const isActive = isGateActive(parseInt(gateNum));

          return (
            <g key={gateNum}>
              <motion.circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? 8 : 5}
                fill={isActive 
                  ? (gate?.isDesign ? '#ef4444' : '#000')
                  : 'transparent'
                }
                stroke={isActive
                  ? (gate?.isDesign ? '#ef4444' : '#a855f7')
                  : 'rgba(255,255,255,0.2)'
                }
                strokeWidth={isActive ? 2 : 1}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: parseInt(gateNum) * 0.01 }}
                className="cursor-pointer"
                onMouseEnter={() => gate && setHoveredGate(gate)}
                onMouseLeave={() => setHoveredGate(null)}
              />
              {isActive && (
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={gate?.isDesign ? 'white' : '#a855f7'}
                  fontSize={6}
                  fontWeight={600}
                >
                  {gateNum}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip for Gates */}
      {hoveredGate && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y - 10,
          }}
        >
          <div className="glass-strong rounded-xl p-4 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl font-bold text-purple-400">
                Tor {hoveredGate.number}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                hoveredGate.isDesign 
                  ? 'bg-red-500/20 text-red-300' 
                  : 'bg-purple-500/20 text-purple-300'
              }`}>
                {hoveredGate.isDesign ? 'Unbewusst' : 'Bewusst'}
              </span>
            </div>
            <p className="text-white/60 text-sm mb-1">
              Planet: <span className="text-white">{hoveredGate.planet}</span>
            </p>
            <p className="text-white/60 text-sm mb-1">
              Linie: <span className="text-white">{hoveredGate.line}</span>
            </p>
            <p className="text-white/60 text-sm">
              Farbe/Ton/Basis: <span className="text-white">{hoveredGate.color}/{hoveredGate.tone}/{hoveredGate.base}</span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Tooltip for Centers */}
      {hoveredCenter && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed z-50 pointer-events-none"
          style={{
            left: mousePos.x + 15,
            top: mousePos.y - 10,
          }}
        >
          <div className="glass-strong rounded-xl p-4 min-w-[180px]">
            <h4 className="font-semibold text-lg mb-1">
              {centers[hoveredCenter as keyof typeof centers].label}
            </h4>
            <p className="text-white/60 text-sm mb-2">
              {centers[hoveredCenter as keyof typeof centers].desc}
            </p>
            <span className={`text-xs px-2 py-1 rounded ${
              definedCenters.includes(hoveredCenter)
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-white/10 text-white/50'
            }`}>
              {definedCenters.includes(hoveredCenter) ? 'Definiert' : 'Offen'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
