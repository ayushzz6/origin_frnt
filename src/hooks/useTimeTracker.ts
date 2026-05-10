'use client';
import { useTimeTracker as useGlobalTimeTracker } from '@/context/TimeTrackerContext';

export type { TimeType } from '@/context/TimeTrackerContext';

export function useTimeTracker(enabled: boolean = true) {
    const context = useGlobalTimeTracker();
    return context;
}

