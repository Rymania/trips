import type { Activity } from '../domain/types';

/**
 * An aggregation source. Real integrations (Eventbrite, TripAdvisor, Google Places…)
 * implement this and normalise their payloads into Activity. Sources are fetched
 * independently so one failing source degrades results rather than breaking them.
 */
export interface ActivitySource {
  name: string;
  fetch(): Promise<Activity[]>;
}

export interface AggregateResult {
  activities: Activity[];
  failedSources: string[];
}

/** Merges sources, tolerating failures and de-duplicating by source+id. */
export async function aggregate(sources: ActivitySource[]): Promise<AggregateResult> {
  const settled = await Promise.allSettled(sources.map((s) => s.fetch()));
  const seen = new Map<string, Activity>();
  const failedSources: string[] = [];
  settled.forEach((r, i) => {
    if (r.status === 'rejected') failedSources.push(sources[i]!.name);
    else r.value.forEach((a) => seen.set(`${a.sourceName}:${a.sourceId}`, a));
  });
  return { activities: [...seen.values()], failedSources };
}
