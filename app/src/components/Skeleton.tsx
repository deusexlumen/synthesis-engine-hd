/**
 * Skeleton Loading Components
 * Accessible, animated skeleton loaders
 */

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/5',
        className
      )}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton patterns
export function CardSkeleton() {
  return (
    <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}

export function BodyGraphSkeleton() {
  return (
    <div className="relative w-full max-w-[400px] mx-auto aspect-[400/580]">
      {/* Centers */}
      <Skeleton className="absolute top-[15%] left-[50%] -translate-x-1/2 w-16 h-12 rounded-lg" />
      <Skeleton className="absolute top-[35%] left-[50%] -translate-x-1/2 w-14 h-14 rounded-full" />
      <Skeleton className="absolute top-[55%] left-[50%] -translate-x-1/2 w-14 h-14 rounded-full" />
      <Skeleton className="absolute top-[75%] left-[50%] -translate-x-1/2 w-16 h-12 rounded-lg" />
      <Skeleton className="absolute top-[45%] left-[20%] w-12 h-16 rounded-lg" />
      <Skeleton className="absolute top-[45%] right-[20%] w-12 h-16 rounded-lg" />
      <Skeleton className="absolute top-[25%] left-[20%] w-12 h-14 rounded-lg" />
      <Skeleton className="absolute top-[25%] right-[20%] w-12 h-14 rounded-lg" />
      <Skeleton className="absolute top-[65%] left-[20%] w-12 h-14 rounded-lg" />
      
      {/* Connection lines */}
      <Skeleton className="absolute top-[20%] left-[35%] w-12 h-0.5 rotate-45" />
      <Skeleton className="absolute top-[20%] right-[35%] w-12 h-0.5 -rotate-45" />
      <Skeleton className="absolute top-[40%] left-[50%] -translate-x-1/2 w-0.5 h-20" />
      <Skeleton className="absolute top-[60%] left-[50%] -translate-x-1/2 w-0.5 h-20" />
    </div>
  );
}

export function ResultsDashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6">
        <Skeleton className="h-32 w-full md:w-1/3 rounded-2xl" />
        <div className="flex-1 grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-lg flex-shrink-0" />
        ))}
      </div>

      {/* Content */}
      <div className="grid md:grid-cols-2 gap-6">
        <BodyGraphSkeleton />
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function OnboardingStepSkeleton() {
  return (
    <div className="max-w-md mx-auto space-y-6">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6 mx-auto" />
      
      <div className="space-y-4 pt-4">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>

      <div className="flex justify-between pt-6">
        <Skeleton className="h-12 w-28 rounded-xl" />
        <Skeleton className="h-12 w-28 rounded-xl" />
      </div>
    </div>
  );
}

export function StatsCardSkeleton() {
  return (
    <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <Skeleton className="h-2 w-full mt-4" />
    </div>
  );
}
