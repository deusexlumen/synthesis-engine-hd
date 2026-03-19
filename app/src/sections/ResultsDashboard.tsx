import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '@/stores/appStore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, 
  Zap, 
  Target, 
  Calendar,
  Share2,
  RefreshCw,
  Brain,
  Star,
  LayoutGrid,
  Compass,
  Shield
} from 'lucide-react';
import { BodyGraphResponsive } from '@/components/BodyGraphResponsive';
import { ResultsDashboardSkeleton, StatsCardSkeleton } from '@/components/Skeleton';
import { NumerologyChart } from '@/components/NumerologyChart';
import { AICoaching } from '@/components/AICoaching';

const springConfig = { stiffness: 400, damping: 30 };

// Energy type styles
const energyTypeStyles: Record<string, { 
  gradient: string; 
  label: string; 
  description: string;
  strategy: string;
}> = {
  MANIFESTOR: { 
    gradient: 'from-amber-400 via-orange-400 to-yellow-400',
    label: 'Manifestor',
    description: 'Der Initiator',
    strategy: 'Informiere, bevor du handelst'
  },
  GENERATOR: { 
    gradient: 'from-red-500 via-rose-500 to-orange-500',
    label: 'Generator',
    description: 'Der Arbeiter',
    strategy: 'Warte auf deine innere Reaktion'
  },
  MANIFESTING_GENERATOR: { 
    gradient: 'from-orange-400 via-amber-400 to-red-400',
    label: 'Manifesting Generator',
    description: 'Der dynamische Macher',
    strategy: 'Informiere und warte auf Reaktion'
  },
  PROJECTOR: { 
    gradient: 'from-yellow-300 via-amber-300 to-orange-300',
    label: 'Projector',
    description: 'Der Führer',
    strategy: 'Warte auf die Einladung'
  },
  REFLECTOR: { 
    gradient: 'from-slate-300 via-gray-300 to-zinc-300',
    label: 'Reflector',
    description: 'Der Spiegel',
    strategy: 'Warte einen Mondzyklus ab'
  },
};

// Number colors
const numberColors: Record<number, string> = {
  1: 'text-red-400',
  2: 'text-orange-400',
  3: 'text-yellow-400',
  4: 'text-green-400',
  5: 'text-cyan-400',
  6: 'text-blue-400',
  7: 'text-indigo-400',
  8: 'text-purple-400',
  9: 'text-pink-400',
  11: 'text-amber-400',
  22: 'text-violet-400',
};

export function ResultsDashboard() {
  const { userData, hdChart, millmanProfile, reset } = useAppStore();
  const [activeTab, setActiveTab] = useState('overview');

  if (!hdChart || !millmanProfile) {
    return (
      <div className="min-h-screen p-4 sm:p-6">
        <ResultsDashboardSkeleton />
      </div>
    );
  }

  const energyStyle = energyTypeStyles[hdChart.energyType] || energyTypeStyles.GENERATOR;
  const numberColor = numberColors[millmanProfile.destinyNumber] || 'text-purple-400';

  return (
    <div className="min-h-screen p-4 sm:p-6 pb-24">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/50 text-sm mb-1"
            >
              Dein persönliches Profil
            </motion.p>
            <h1 className="text-3xl sm:text-4xl font-serif font-medium">
              Hallo, <span className="gradient-text">{userData?.fullName.split(' ')[0]}</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="border-white/10 hover:bg-white/5 rounded-xl">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-white/10 hover:bg-white/5 rounded-xl" onClick={reset}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-white/[0.03] backdrop-blur-xl rounded-2xl p-1 mb-8 border border-white/[0.06]">
            {[
              { id: 'overview', icon: LayoutGrid, label: 'Übersicht' },
              { id: 'bodygraph', icon: Zap, label: 'BodyGraph' },
              { id: 'numerology', icon: Target, label: 'Numerologie' },
              { id: 'details', icon: Compass, label: 'Details' },
              { id: 'coaching', icon: Brain, label: 'KI-Coaching' },
            ].map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-white/10 data-[state=active]:text-white rounded-xl py-3 text-sm font-medium text-white/50 transition-all"
              >
                <tab.icon className="w-4 h-4 mr-2 hidden sm:inline" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
              transition={{ type: 'spring', ...springConfig }}
            >
              {/* OVERVIEW TAB */}
              <TabsContent value="overview" className="mt-0 space-y-6">
                {/* Hero Cards */}
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Human Design Card */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Card className="glass rounded-3xl overflow-hidden card-hover h-full">
                      <div className={`h-2 bg-gradient-to-r ${energyStyle.gradient}`} />
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${energyStyle.gradient} flex items-center justify-center`}>
                            <Zap className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-white/50 text-sm">Energie-Typ</p>
                            <p className="text-lg font-medium">{energyStyle.label}</p>
                          </div>
                        </div>
                        <div className={`text-4xl font-serif font-medium bg-gradient-to-r ${energyStyle.gradient} bg-clip-text text-transparent mb-3`}>
                          {hdChart.energyType.replace('_', ' ')}
                        </div>
                        <p className="text-white/50 text-sm mb-4">{energyStyle.description}</p>
                        
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Strategie</p>
                          <p className="text-white/80 text-sm">{energyStyle.strategy}</p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-white/20">Autorität: {hdChart.authority}</Badge>
                          <Badge variant="outline" className="border-white/20">Profil: {hdChart.profile}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Numerology Card */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Card className="glass rounded-3xl overflow-hidden card-hover h-full">
                      <div className="h-2 bg-gradient-to-r from-purple-500 via-violet-500 to-indigo-500" />
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="text-white/50 text-sm">Lebenszahl</p>
                            <p className="text-lg font-medium">{millmanProfile.lifePathString}</p>
                          </div>
                        </div>
                        <div className={`text-6xl font-serif font-medium ${numberColor} mb-3`}>
                          {millmanProfile.destinyNumber}
                        </div>
                        <p className="text-white/50 text-sm mb-4">Schicksalszahl</p>

                        {millmanProfile.hasMasterNumber && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 mb-4">
                            <p className="text-amber-400 text-sm flex items-center gap-2">
                              <Star className="w-4 h-4" /> Meisterzahl erkannt
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="border-white/20">
                            Persönliches Jahr: {millmanProfile.personalYear}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Quick Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="grid grid-cols-2 sm:grid-cols-4 gap-4"
                >
                  {[
                    { icon: Shield, label: 'Definierte Zentren', value: hdChart.definedCenters.length },
                    { icon: Zap, label: 'Aktive Kanäle', value: hdChart.channels.length },
                    { icon: Star, label: 'Aktivierte Tore', value: hdChart.gates.length },
                    { icon: Calendar, label: 'Persönliches Jahr', value: millmanProfile.personalYear },
                  ].map((stat, i) => (
                    <Card key={i} className="glass rounded-2xl">
                      <CardContent className="p-4 text-center">
                        <stat.icon className="w-5 h-5 text-white/40 mx-auto mb-2" />
                        <p className="text-2xl font-serif font-medium">{stat.value}</p>
                        <p className="text-white/40 text-xs">{stat.label}</p>
                      </CardContent>
                    </Card>
                  ))}
                </motion.div>

                {/* Synthesis Preview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="glass rounded-3xl">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        <h3 className="text-lg font-medium">Deine einzigartige Kombination</h3>
                      </div>
                      <p className="text-white/70 leading-relaxed">
                        Als <span className="text-purple-400 font-medium">{energyStyle.label}</span> mit der 
                        Lebenszahl <span className={`font-medium ${numberColor}`}>{millmanProfile.destinyNumber}</span> besitzt du 
                        eine seltene Kombination aus {energyStyle.description.toLowerCase()} und der Energie der Zahl {millmanProfile.destinyNumber}. 
                        Dein Profil {hdChart.profile} zeigt, wie du am besten mit der Welt interagierst.
                      </p>
                      <div className="mt-4 flex gap-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setActiveTab('coaching')}
                          className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          KI-Coaching starten
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* BODYGRAPH TAB */}
              <TabsContent value="bodygraph" className="mt-0">
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* BodyGraph Visualization */}
                  <div className="lg:col-span-2">
                    <Card className="glass rounded-3xl overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-medium">Dein BodyGraph</h3>
                            <p className="text-white/50 text-sm">Human Design Chart</p>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span className="flex items-center gap-1 text-white/40">
                              <div className="w-2 h-2 bg-purple-500 rounded-full" /> Bewusst
                            </span>
                            <span className="flex items-center gap-1 text-white/40">
                              <div className="w-2 h-2 bg-red-500 rounded-full" /> Unbewusst
                            </span>
                          </div>
                        </div>
                        <BodyGraphResponsive 
                          chart={hdChart}
                          className="h-[400px] sm:h-[500px]"
                          interactive
                        />
                      </CardContent>
                    </Card>
                  </div>

                  {/* Center Info */}
                  <div className="space-y-4">
                    <Card className="glass rounded-3xl">
                      <CardContent className="p-5">
                        <h4 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">
                          Deine Zentren
                        </h4>
                        <div className="space-y-3">
                          {[
                            { name: 'HEAD', label: 'Kopf', desc: 'Inspiration' },
                            { name: 'AJNA', label: 'Ajna', desc: 'Verstand' },
                            { name: 'THROAT', label: 'Kehle', desc: 'Kommunikation' },
                            { name: 'G_CENTER', label: 'G-Zentrum', desc: 'Identität' },
                            { name: 'HEART', label: 'Herz', desc: 'Wille' },
                            { name: 'SACRAL', label: 'Sakral', desc: 'Lebenskraft' },
                            { name: 'SPLEEN', label: 'Milz', desc: 'Intuition' },
                            { name: 'SOLAR_PLEXUS', label: 'Solarplexus', desc: 'Emotionen' },
                            { name: 'ROOT', label: 'Wurzel', desc: 'Adrenalin' },
                          ].map((center) => {
                            const isDefined = hdChart.definedCenters.includes(center.name);
                            return (
                              <div
                                key={center.name}
                                className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                                  isDefined 
                                    ? 'bg-purple-500/10 border border-purple-500/20' 
                                    : 'bg-white/[0.02] border border-white/[0.04]'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${isDefined ? 'bg-purple-400' : 'bg-white/20'}`} />
                                  <div>
                                    <p className={`text-sm font-medium ${isDefined ? 'text-white' : 'text-white/50'}`}>
                                      {center.label}
                                    </p>
                                    <p className="text-white/30 text-xs">{center.desc}</p>
                                  </div>
                                </div>
                                {isDefined && (
                                  <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-xs">
                                    Definiert
                                  </Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              {/* NUMEROLOGY TAB */}
              <TabsContent value="numerology" className="mt-0">
                <div className="max-w-2xl mx-auto">
                  <NumerologyChart
                    lifePathString={millmanProfile.lifePathString}
                    destinyNumber={millmanProfile.destinyNumber}
                    root1={millmanProfile.root1}
                    root2={millmanProfile.root2}
                    baseSum={millmanProfile.baseSum}
                    hasMasterNumber={millmanProfile.hasMasterNumber}
                    hasZeroEnhancer={millmanProfile.hasZeroEnhancer}
                    soulUrgeString={millmanProfile.soulUrgeString}
                    expressionString={millmanProfile.expressionString}
                    personalYear={millmanProfile.personalYear}
                    challenges={millmanProfile.challenges}
                    pinnacles={millmanProfile.pinnacles}
                  />
                </div>
              </TabsContent>

              {/* DETAILS TAB */}
              <TabsContent value="details" className="mt-0 space-y-6">
                {/* Compact Overview */}
                <Card className="glass rounded-3xl">
                  <CardContent className="p-6">
                    <h3 className="text-lg font-medium mb-6">Kompakte Übersicht</h3>
                    
                    <div className="grid sm:grid-cols-2 gap-6">
                      {/* Human Design Summary */}
                      <div>
                        <h4 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Zap className="w-4 h-4" /> Human Design
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-white/50">Energie-Typ</span>
                            <span className="font-medium">{hdChart.energyType.replace('_', ' ')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Autorität</span>
                            <span className="font-medium">{hdChart.authority}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Profil</span>
                            <span className="font-medium">{hdChart.profile}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Inkarnationskreuz</span>
                            <span className="font-medium text-right max-w-[150px]">{hdChart.incarnationCross}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Definierte Zentren</span>
                            <span className="font-medium">{hdChart.definedCenters.length} / 9</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Aktive Kanäle</span>
                            <span className="font-medium">{hdChart.channels.length}</span>
                          </div>
                        </div>
                      </div>

                      {/* Numerology Summary */}
                      <div>
                        <h4 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4 flex items-center gap-2">
                          <Target className="w-4 h-4" /> Numerologie
                        </h4>
                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-white/50">Lebenszahl</span>
                            <span className="font-medium">{millmanProfile.lifePathString}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Schicksalszahl</span>
                            <span className={`font-medium ${numberColor}`}>{millmanProfile.destinyNumber}</span>
                          </div>
                          {millmanProfile.soulUrgeString && (
                            <div className="flex justify-between">
                              <span className="text-white/50">Seelenweg</span>
                              <span className="font-medium text-pink-400">{millmanProfile.soulUrgeString}</span>
                            </div>
                          )}
                          {millmanProfile.expressionString && (
                            <div className="flex justify-between">
                              <span className="text-white/50">Berufsweg</span>
                              <span className="font-medium text-cyan-400">{millmanProfile.expressionString}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-white/50">Persönliches Jahr</span>
                            <span className="font-medium text-green-400">{millmanProfile.personalYear}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-white/50">Meisterzahl</span>
                            <span className="font-medium">{millmanProfile.hasMasterNumber ? 'Ja' : 'Nein'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Variables */}
                <Card className="glass rounded-3xl">
                  <CardContent className="p-6">
                    <h4 className="text-sm font-medium text-white/50 uppercase tracking-wider mb-4">
                      Variablen (Human Design)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        { label: 'Verdauung', value: hdChart.variables.digestion },
                        { label: 'Umgebung', value: hdChart.variables.environment },
                        { label: 'Bewusstsein', value: hdChart.variables.awareness },
                        { label: 'Motivation', value: hdChart.variables.motivation },
                        { label: 'Sinn', value: hdChart.variables.sense },
                        { label: 'Stil', value: hdChart.variables.style },
                      ].map((v, i) => (
                        <div key={i} className="p-3 rounded-xl bg-white/[0.03]">
                          <p className="text-white/40 text-xs mb-1">{v.label}</p>
                          <p className="font-medium">{v.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* COACHING TAB */}
              <TabsContent value="coaching" className="mt-0">
                <div className="max-w-2xl mx-auto">
                  <AICoaching
                    hdData={{
                      energyType: hdChart.energyType,
                      authority: hdChart.authority,
                      profile: hdChart.profile,
                      definedCenters: hdChart.definedCenters,
                      incarnationCross: hdChart.incarnationCross,
                    }}
                    numerologyData={{
                      lifePathString: millmanProfile.lifePathString,
                      destinyNumber: millmanProfile.destinyNumber,
                      hasMasterNumber: millmanProfile.hasMasterNumber,
                      personalYear: millmanProfile.personalYear,
                    }}
                  />
                </div>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}
