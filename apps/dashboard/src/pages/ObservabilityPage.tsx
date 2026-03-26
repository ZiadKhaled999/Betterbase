import { LiveLogStream } from "@/components/LiveLogStream";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, BarChart2, Clock, FolderOpen, Zap } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Period = "24h" | "7d" | "30d";

function getLatencyColor(ms: number): string {
	if (ms < 100) return "success";
	if (ms < 500) return "warning";
	return "danger";
}

function getStatusColor(status: number): string {
	if (status >= 200 && status < 300) return "text-green-500";
	if (status >= 400 && status < 500) return "text-amber-500";
	if (status >= 500) return "text-red-500";
	return "text-gray-500";
}

function formatTime(timestamp: string): string {
	return new Date(timestamp).toLocaleTimeString();
}

export default function ObservabilityPage() {
	const [period, setPeriod] = useState<Period>("24h");

	const { data: metrics, isLoading: loadingOverview } = useQuery({
		queryKey: QK.metricsOverview(),
		queryFn: () => api.get<{ metrics: any }>("/admin/metrics/overview"),
		refetchInterval: 30_000,
	});

	const { data: latency, isLoading: loadingLatency } = useQuery({
		queryKey: QK.metricsLatency(period),
		queryFn: () => api.get<{ latency: any }>(`/admin/metrics/latency?period=${period}`),
		refetchInterval: 30_000,
	});

	const { data: timeseries, isLoading: loadingTimeseries } = useQuery({
		queryKey: QK.metricsTimeseries("requests", period),
		queryFn: () => api.get<{ timeseries: any[] }>(`/admin/metrics/timeseries?period=${period}`),
		refetchInterval: 30_000,
	});

	const { data: topEndpoints, isLoading: loadingEndpoints } = useQuery({
		queryKey: QK.metricsTopEndpoints(period),
		queryFn: () => api.get<{ endpoints: any[] }>(`/admin/metrics/top-endpoints?limit=10`),
		refetchInterval: 30_000,
	});

	const isLoading = loadingOverview || loadingLatency || loadingTimeseries || loadingEndpoints;

	if (isLoading) return <PageSkeleton />;

	const m = metrics?.metrics;
	const l = latency?.latency;
	const ts = timeseries?.timeseries ?? [];
	const endpoints = topEndpoints?.endpoints ?? [];

	return (
		<div>
			<PageHeader
				title="Observability"
				description="Monitor your Betterbase instance in real-time"
			/>

			<div className="px-8 pb-8 space-y-6">
				{/* Period selector */}
				<div className="flex gap-2">
					{(["24h", "7d", "30d"] as Period[]).map((p) => (
						<button
							key={p}
							onClick={() => setPeriod(p)}
							className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
								period === p ? "font-medium" : "opacity-60 hover:opacity-100"
							}`}
							style={{
								background: period === p ? "var(--color-brand)" : "var(--color-surface)",
								color: period === p ? "white" : "var(--color-text-secondary)",
								border: `1px solid ${period === p ? "var(--color-brand)" : "var(--color-border)"}`,
							}}
						>
							{p}
						</button>
					))}
				</div>

				{/* StatCards */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
					<StatCard
						label="Total Projects"
						value={m?.projects ?? 0}
						icon={FolderOpen}
						color="brand"
					/>
					<StatCard label="Total Functions" value={m?.functions ?? 0} icon={Zap} color="success" />
					<StatCard
						label="Errors (24h)"
						value={m?.errors_24h ?? 0}
						icon={AlertTriangle}
						color={(m?.errors_24h ?? 0) > 0 ? "danger" : "default"}
					/>
					<StatCard label="Avg Latency" value={`${l?.avg ?? 0}ms`} icon={Clock} color="default" />
				</div>

				{/* Request Volume Chart */}
				<div
					className="p-4 rounded-lg"
					style={{
						background: "var(--color-surface)",
						border: "1px solid var(--color-border)",
					}}
				>
					<h3 className="text-sm font-medium mb-4" style={{ color: "var(--color-text-primary)" }}>
						Request Volume
					</h3>
					<div className="h-64">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={ts} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
								<XAxis
									dataKey="bucket"
									tickFormatter={(v) =>
										new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
									}
									stroke="var(--color-text-muted)"
									fontSize={11}
								/>
								<YAxis stroke="var(--color-text-muted)" fontSize={11} />
								<Toltip
									contentStyle={{
										background: "var(--color-surface)",
										border: "1px solid var(--color-border)",
										borderRadius: "6px",
									}}
								/>
								<Area
									type="monotone"
									dataKey="total"
									stroke="var(--color-brand)"
									fill="var(--color-brand-muted)"
									strokeWidth={2}
								/>
								<Area
									type="monotone"
									dataKey="errors"
									stroke="#ef4444"
									fill="#fef2f2"
									strokeWidth={2}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>

				{/* Latency Pills */}
				<div className="flex gap-3 flex-wrap">
					{[
						{ label: "P50", value: l?.p50 ?? 0 },
						{ label: "P95", value: l?.p95 ?? 0 },
						{ label: "P99", value: l?.p99 ?? 0 },
					].map(({ label, value }) => {
						const color = getLatencyColor(value);
						return (
							<div
								key={label}
								className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
								style={{
									background: "var(--color-surface)",
									border: "1px solid var(--color-border)",
								}}
							>
								<Clock size={11} />
								<span style={{ color: "var(--color-text-muted)" }}>{label}</span>
								<span
									style={{
										color:
											color === "success"
												? "var(--color-success)"
												: color === "warning"
													? "var(--color-warning)"
													: "var(--color-danger)",
									}}
								>
									{value}ms
								</span>
							</div>
						);
					})}
				</div>

				{/* Top Endpoints Table */}
				<div
					className="rounded-lg overflow-hidden"
					style={{
						background: "var(--color-surface)",
						border: "1px solid var(--color-border)",
					}}
				>
					<h3
						className="text-sm font-medium px-4 py-3 border-b"
						style={{ borderColor: "var(--color-border)" }}
					>
						Top Endpoints
					</h3>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-left text-xs" style={{ color: "var(--color-text-muted)" }}>
									<th className="px-4 py-2 font-medium">Method</th>
									<th className="px-4 py-2 font-medium">Path</th>
									<th className="px-4 py-2 font-medium">Count</th>
									<th className="px-4 py-2 font-medium">Avg Latency</th>
									<th className="px-4 py-2 font-medium">Errors</th>
								</tr>
							</thead>
							<tbody>
								{endpoints.length === 0 ? (
									<tr>
										<td
											colSpan={5}
											className="px-4 py-8 text-center"
											style={{ color: "var(--color-text-muted)" }}
										>
											No endpoint data available
										</td>
									</tr>
								) : (
									endpoints.map((ep: any, i: number) => (
										<tr key={i} className="border-t" style={{ borderColor: "var(--color-border)" }}>
											<td className="px-4 py-2">
												<span
													className="px-2 py-0.5 rounded text-xs font-medium"
													style={{
														background: "var(--color-brand-muted)",
														color: "var(--color-brand)",
													}}
												>
													{ep.method}
												</span>
											</td>
											<td
												className="px-4 py-2 font-mono text-xs"
												style={{ color: "var(--color-text-secondary)" }}
											>
												{ep.path}
											</td>
											<td className="px-4 py-2" style={{ color: "var(--color-text-primary)" }}>
												{ep.count}
											</td>
											<td className="px-4 py-2" style={{ color: "var(--color-text-primary)" }}>
												{ep.avg_ms}ms
											</td>
											<td
												className="px-4 py-2"
												style={{
													color: ep.errors > 0 ? "var(--color-danger)" : "var(--color-text-muted)",
												}}
											>
												{ep.errors}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>

				{/* Recent Activity Feed - Live Log Stream */}
				<LiveLogStream maxRows={200} autoScroll={true} />
			</div>
		</div>
	);
}
