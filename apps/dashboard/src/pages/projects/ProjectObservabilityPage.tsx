import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { StatCard } from "@/components/ui/StatCard";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, BarChart2, Clock, FolderOpen } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Period = "24h" | "7d";

function getStatusColor(status: number): string {
	if (status >= 200 && status < 300) return "text-green-500";
	if (status >= 400 && status < 500) return "text-amber-500";
	if (status >= 500) return "text-red-500";
	return "text-gray-500";
}

function formatTime(timestamp: string): string {
	return new Date(timestamp).toLocaleTimeString();
}

export default function ProjectObservabilityPage() {
	const { projectId } = useParams();
	const [period, setPeriod] = useState<Period>("24h");

	const { data: project, isLoading: loadingProject } = useQuery({
		queryKey: QK.project(projectId!),
		queryFn: () => api.get<{ project: any }>(`/admin/projects/${projectId}`),
	});

	const { data: metrics, isLoading: loadingMetrics } = useQuery({
		queryKey: QK.projectMetricsOverview(projectId!),
		queryFn: () => api.get<{ metrics: any }>(`/admin/projects/${projectId}/metrics/overview`),
		refetchInterval: 30_000,
	});

	const { data: timeseries, isLoading: loadingTimeseries } = useQuery({
		queryKey: QK.projectMetricsTimeseries(projectId!, period),
		queryFn: () =>
			api.get<{ timeseries: any[] }>(
				`/admin/projects/${projectId}/metrics/timeseries?period=${period}`,
			),
		refetchInterval: 30_000,
	});

	const { data: logs, isLoading: loadingLogs } = useQuery({
		queryKey: QK.projectLogs(projectId!),
		queryFn: () => api.get<{ logs: any[] }>(`/admin/logs?project_id=${projectId}&limit=50`),
		refetchInterval: 30_000,
	});

	const isLoading = loadingProject || loadingMetrics || loadingTimeseries || loadingLogs;

	if (isLoading) return <PageSkeleton />;

	const m = metrics?.metrics;
	const ts = timeseries?.timeseries ?? [];
	const projectLogs = logs?.logs ?? [];

	return (
		<div>
			<PageHeader
				title={`${project?.project?.name ?? "Project"} > Observability`}
				description="Monitor this project's requests and performance"
			/>

			<div className="px-8 pb-8 space-y-6">
				{/* Period selector */}
				<div className="flex gap-2">
					{(["24h", "7d"] as Period[]).map((p) => (
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

				{/* Project StatCards */}
				<div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
					<StatCard
						label="Requests (24h)"
						value={m?.requests_24h ?? 0}
						icon={Activity}
						color="brand"
					/>
					<StatCard
						label="Errors (24h)"
						value={m?.errors_24h ?? 0}
						icon={AlertTriangle}
						color={(m?.errors_24h ?? 0) > 0 ? "danger" : "default"}
					/>
					<StatCard
						label="Avg Latency"
						value={`${m?.avg_latency_ms ?? 0}ms`}
						icon={Clock}
						color="default"
					/>
				</div>

				{/* Project Timeseries Chart */}
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
						{ts.length === 0 ? (
							<div
								className="h-full flex items-center justify-center"
								style={{ color: "var(--color-text-muted)" }}
							>
								No request data for this project yet
							</div>
						) : (
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
									<Tooltip
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
						)}
					</div>
				</div>

				{/* Project Log Feed */}
				<div
					className="rounded-lg overflow-hidden"
					style={{
						background: "var(--color-surface)",
						border: "1px solid var(--color-border)",
					}}
				>
					<h3
						className="text-sm font-medium px-4 py-3 border-b flex items-center gap-2"
						style={{ borderColor: "var(--color-border)" }}
					>
						<Activity size={14} />
						Recent Requests
					</h3>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-left text-xs" style={{ color: "var(--color-text-muted)" }}>
									<th className="px-4 py-2 font-medium">Time</th>
									<th className="px-4 py-2 font-medium">Method</th>
									<th className="px-4 py-2 font-medium">Path</th>
									<th className="px-4 py-2 font-medium">Status</th>
									<th className="px-4 py-2 font-medium">Duration</th>
								</tr>
							</thead>
							<tbody>
								{projectLogs.length === 0 ? (
									<tr>
										<td
											colSpan={5}
											className="px-4 py-8 text-center"
											style={{ color: "var(--color-text-muted)" }}
										>
											No requests logged for this project yet
										</td>
									</tr>
								) : (
									projectLogs.slice(0, 50).map((log: any, i: number) => (
										<tr
											key={log.id ?? i}
											className="border-t"
											style={{ borderColor: "var(--color-border)" }}
										>
											<td
												className="px-4 py-2 text-xs"
												style={{ color: "var(--color-text-muted)" }}
											>
												{formatTime(log.created_at)}
											</td>
											<td className="px-4 py-2">
												<span
													className="px-2 py-0.5 rounded text-xs font-medium"
													style={{
														background: "var(--color-brand-muted)",
														color: "var(--color-brand)",
													}}
												>
													{log.method}
												</span>
											</td>
											<td
												className="px-4 py-2 font-mono text-xs"
												style={{ color: "var(--color-text-secondary)" }}
											>
												{log.path}
											</td>
											<td className={`px-4 py-2 font-medium ${getStatusColor(log.status)}`}>
												{log.status}
											</td>
											<td className="px-4 py-2" style={{ color: "var(--color-text-secondary)" }}>
												{log.duration_ms}ms
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
