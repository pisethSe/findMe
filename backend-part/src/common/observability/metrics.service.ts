import { Injectable } from "@nestjs/common";

export interface MetricLabels {
  [label: string]: string;
}

const DURATION_BUCKET_BOUNDS_MS = [
  5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000,
] as const;

/**
 * Bounds the number of distinct label combinations per metric name so a single
 * crafted label value cannot grow process memory without limit.
 */
export const MAX_SERIES_PER_METRIC = 200;

interface SeriesState {
  labels: MetricLabels;
  count: number;
  sum: number;
  bucketCounts: number[];
}

export interface CounterSnapshot {
  name: string;
  labels: MetricLabels;
  value: number;
}

export interface HistogramSnapshot {
  name: string;
  labels: MetricLabels;
  count: number;
  sum: number;
  buckets: Array<{ lessThanOrEqual: number | "Infinity"; count: number }>;
}

export interface MetricsSnapshot {
  counters: CounterSnapshot[];
  histograms: HistogramSnapshot[];
  droppedSeries: Array<{ name: string; dropped: number }>;
}

export function statusClass(status: number): string {
  if (status >= 500) return "5xx";
  if (status >= 400) return "4xx";
  if (status >= 300) return "3xx";
  if (status >= 200) return "2xx";
  return "1xx";
}

function labelKey(labels: MetricLabels): string {
  return Object.keys(labels)
    .sort()
    .map((key) => `${key}=${labels[key]}`)
    .join(",");
}

@Injectable()
export class MetricsService {
  private readonly series = new Map<string, Map<string, SeriesState>>();
  private readonly droppedSeries = new Map<string, number>();

  incrementCounter(name: string, labels: MetricLabels = {}, amount = 1): void {
    const state = this.obtainSeries(name, labels, () => ({
      labels,
      count: 0,
      sum: 0,
      bucketCounts: [],
    }));
    if (!state) return;

    state.count += amount;
  }

  observeMilliseconds(
    name: string,
    value: number,
    labels: MetricLabels = {},
  ): void {
    const state = this.obtainSeries(name, labels, () => ({
      labels,
      count: 0,
      sum: 0,
      bucketCounts: DURATION_BUCKET_BOUNDS_MS.map(() => 0),
    }));
    if (!state) return;

    state.count += 1;
    state.sum += value;
    const bucketIndex = DURATION_BUCKET_BOUNDS_MS.findIndex(
      (bound) => value <= bound,
    );
    if (bucketIndex >= 0) {
      state.bucketCounts[bucketIndex] =
        (state.bucketCounts[bucketIndex] ?? 0) + 1;
    }
  }

  recordHttpRequest(input: {
    method: string;
    route: string;
    status: number;
    durationMs: number;
  }): void {
    this.incrementCounter("http_requests_total", {
      method: input.method,
      route: input.route,
      statusClass: statusClass(input.status),
    });
    this.observeMilliseconds("http_request_duration_ms", input.durationMs, {
      route: input.route,
    });
  }

  snapshot(): MetricsSnapshot {
    const counters: CounterSnapshot[] = [];
    const histograms: HistogramSnapshot[] = [];

    for (const [name, metricSeries] of this.series) {
      for (const state of metricSeries.values()) {
        if (state.bucketCounts.length === 0) {
          counters.push({ name, labels: state.labels, value: state.count });
          continue;
        }

        let cumulative = 0;
        const buckets = DURATION_BUCKET_BOUNDS_MS.map((bound, index) => {
          cumulative += state.bucketCounts[index] ?? 0;
          return { lessThanOrEqual: bound as number, count: cumulative };
        });
        histograms.push({
          name,
          labels: state.labels,
          count: state.count,
          sum: state.sum,
          buckets: [
            ...buckets,
            { lessThanOrEqual: "Infinity", count: state.count },
          ],
        });
      }
    }

    return {
      counters: counters.sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      histograms: histograms.sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
      droppedSeries: [...this.droppedSeries].map(([name, dropped]) => ({
        name,
        dropped,
      })),
    };
  }

  reset(): void {
    this.series.clear();
    this.droppedSeries.clear();
  }

  private obtainSeries(
    name: string,
    labels: MetricLabels,
    create: () => SeriesState,
  ): SeriesState | null {
    let metricSeries = this.series.get(name);
    if (!metricSeries) {
      metricSeries = new Map();
      this.series.set(name, metricSeries);
    }

    const key = labelKey(labels);
    const existing = metricSeries.get(key);
    if (existing) return existing;

    if (metricSeries.size >= MAX_SERIES_PER_METRIC) {
      this.droppedSeries.set(name, (this.droppedSeries.get(name) ?? 0) + 1);
      return null;
    }

    const created = create();
    metricSeries.set(key, created);
    return created;
  }
}
