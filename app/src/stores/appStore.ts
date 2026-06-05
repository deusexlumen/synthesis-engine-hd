/**
 * App State Management with Zustand
 * OPTIMIZED: Proper typing, persistence, and selectors
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AppState,
  UserData,
  UserProfile,
  AppSettings,
  HumanDesignChart,
  MillmanProfile,
  AppStep,
} from '@/types/humanDesign';

// ============================================================================
// ACTIONS INTERFACE
// ============================================================================

interface AppActions {
  // Data setters
  setUserData: (data: UserData | null) => void;
  setHDChart: (chart: HumanDesignChart | null) => void;
  setMillmanProfile: (profile: MillmanProfile | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setSettings: (settings: AppSettings | null) => void;

  // UI state
  setLoading: (loading: boolean) => void;
  setStep: (step: AppStep) => void;

  // Batch updates
  setBirthData: (data: {
    userData: UserData;
    hdChart: HumanDesignChart;
    millmanProfile: MillmanProfile;
  }) => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const initialState: AppState = {
  userData: null,
  hdChart: null,
  millmanProfile: null,
  profile: null,
  settings: null,
  isLoading: false,
  currentStep: 'onboarding',
};

// ============================================================================
// STORE CREATION
// ============================================================================

type AppStore = AppState & AppActions;

export const useAppStore = create<AppStore>()(
  immer(
    persist(
      (set) => ({
        ...initialState,

        setUserData: (data) =>
          set((state) => {
            state.userData = data;
          }),

        setHDChart: (chart) =>
          set((state) => {
            state.hdChart = chart;
          }),

        setMillmanProfile: (profile) =>
          set((state) => {
            state.millmanProfile = profile;
          }),

        setProfile: (profile) =>
          set((state) => {
            state.profile = profile;
          }),

        setSettings: (settings) =>
          set((state) => {
            state.settings = settings;
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading;
          }),

        setStep: (step) =>
          set((state) => {
            state.currentStep = step;
          }),

        setBirthData: (data) =>
          set((state) => {
            state.userData = data.userData;
            state.hdChart = data.hdChart;
            state.millmanProfile = data.millmanProfile;
            state.currentStep = 'results';
          }),

        reset: () =>
          set((state) => {
            Object.assign(state, initialState);
          }),
      }),
      {
        name: 'synthesis-engine-v1',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist these fields
          userData: state.userData,
          hdChart: state.hdChart,
          millmanProfile: state.millmanProfile,
          profile: state.profile,
          settings: state.settings,
        }),
        version: 1, // Migration support
        migrate: (persistedState: unknown, version: number) => {
          if (version === 0) {
            // Handle migrations from old versions
            return persistedState;
          }
          return persistedState;
        },
      }
    )
  )
);

// ============================================================================
// SELECTOR HOOKS (Performance Optimization)
// ============================================================================

/**
 * Use this for components that only need the chart
 * Prevents re-renders when other state changes
 */
export function useHDChart(): HumanDesignChart | null {
  return useAppStore((state) => state.hdChart);
}

/**
 * Use this for components that only need user data
 */
export function useUserData(): UserData | null {
  return useAppStore((state) => state.userData);
}

/**
 * Use this for components that only need the current step
 */
export function useCurrentStep(): AppStep {
  return useAppStore((state) => state.currentStep);
}

/**
 * Check if we have all data to show results
 */
export function useHasCompleteData(): boolean {
  return useAppStore(
    (state) =>
      state.userData !== null &&
      state.hdChart !== null &&
      state.millmanProfile !== null
  );
}
