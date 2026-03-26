import { api } from "@/lib/api";
import { useEffect, useState } from "react";

interface OverviewMetrics {
	projects: number;
	admin_users: number;
	functions: number;
	errors_24h: number;
	server_uptime_seconds: number;
	timestamp: string;
}

interface LatencyMetrics {
	p50: number;
	p95: number;
	p99: number;
	avg: number;
}

interface TimeseriesData {
	bucket: string;
	total: number;
	errors: number;
}

interface EndpointData {
	path: string;
	method: string;
	count: number;
	avg_ms: number;
	errors: number;
}

interface GlobalMetricsData {
	overview: OverviewMetrics;
	latency: LatencyMetrics;
	timeseries: TimeseriesData[];
	endpoints: EndpointData[];
}

export function useGlobalMetrics(period: "24h" | "7d" | "30d" = "24h") {
	const [data, setData] = useState<GlobalMetricsData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchData() {
			setLoading(true);
			setError(null);

			try {
				const [overviewRes, latencyRes, timeseriesRes, endpointsRes] = await Promise.all([
					api.get<{ metrics: OverviewMetrics }>("/admin/metrics/overview"),
					api.get<{ latency: LatencyMetrics }>(`/admin/metrics/latency?period=${period}`),
					api.get<{ timeseries: TimeseriesData[] }>(`/admin/metrics/timeseries?period=${period}`),
					api.get<{ endpoints: EndpointData[] }>("/admin/metrics/top-endpoints?limit=10"),
				]);

				setData({
					overview: overviewRes.metrics,
					latency: latencyRes.latency,
					timeseries: timeseriesRes.timeseries,
					endpoints: endpointsRes.endpoints,
				});
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch metrics");
			} finally {
				setLoading(false);
			}
		}

		fetchData();
	}, [period]);

	return { ...data, loading, error };
}
