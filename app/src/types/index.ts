/**
 * Type Exports
 * Unified export for all types
 */

// Re-export all types from humanDesign.ts
export * from './humanDesign';

// Legacy compatibility exports (to be removed after migration)
// These ensure existing imports continue to work
export type { 
  HumanDesignChart as HDChart,
  MillmanProfile as NumerologyProfile,
  UserData,
  AppState,
} from './humanDesign';
