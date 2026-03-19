/**
 * Animation Presets
 * Consistent, accessible animations across the app
 */

import { Variants } from 'framer-motion';

// Spring configurations for different feels
export const springs = {
  // Snappy - for buttons, interactions
  snappy: { stiffness: 500, damping: 25 },
  // Smooth - for page transitions
  smooth: { stiffness: 300, damping: 30 },
  // Gentle - for subtle effects
  gentle: { stiffness: 200, damping: 25 },
  // Bouncy - for celebratory moments
  bouncy: { stiffness: 400, damping: 15 },
};

// Fade variants
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// Slide variants
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const slideInLeftVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const slideInRightVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

// Scale variants
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

// Stagger container
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

// Card hover effect
export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4 },
};

// Button tap effect
export const buttonTap = {
  scale: 0.97,
};

// Page transition
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20, filter: 'blur(10px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -20, filter: 'blur(10px)' },
};

// List item variants
export const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 10 },
};

// Gateway reveal - for important reveals
export const gatewayReveal: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.8,
    filter: 'blur(20px) brightness(0.5)',
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    filter: 'blur(0px) brightness(1)',
    transition: {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  },
};

// Pulse animation for indicators
export const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.8, 1, 0.8],
};

// Glow animation
export const glowAnimation = {
  boxShadow: [
    '0 0 20px rgba(168, 85, 247, 0.3)',
    '0 0 40px rgba(168, 85, 247, 0.5)',
    '0 0 20px rgba(168, 85, 247, 0.3)',
  ],
};

// Utility: Get reduced motion variant
export function getAccessibleVariant(
  variant: Variants,
  prefersReducedMotion: boolean
): Variants {
  if (prefersReducedMotion) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }
  return variant;
}

// Utility: Get animation duration based on preference
export function getAnimationDuration(
  baseDuration: number,
  prefersReducedMotion: boolean
): number {
  return prefersReducedMotion ? 0 : baseDuration;
}
