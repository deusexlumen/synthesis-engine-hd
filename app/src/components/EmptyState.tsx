import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
}

export function EmptyState({ title, description, icon }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
        {icon || <Info className="w-8 h-8 text-white/30" />}
      </div>
      <h3 className="text-lg font-medium text-white/70 mb-2">{title}</h3>
      <p className="text-sm text-white/40 max-w-sm">{description}</p>
    </motion.div>
  );
}
