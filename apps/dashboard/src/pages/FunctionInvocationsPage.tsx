import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Clock, Snowflake, Zap } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

type StatusFilter = "all" | "success" | "error";

function getLatencyColor(ms: number): string {
	if (ms < 100) return "var(--color-success)";
	if (ms < 500) return "var(--color-warning)";
	return "var(--color-danger)";
}

function formatTime(timestamp: string): string {
	return new Date(timestamp).toLocaleString();
}

export default function FunctionInvocationsPage() {
	const { functionId } = useParams();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const { data: stats, isLoading: loadingStats } = useQuery({
		queryKey: QK.functionStats(functionId!),
		queryFn: () => api.get<{ stats: any }>(`/admin/functions/${functionId}/stats`),
		refetchInterval: 30_000,
	});

	const { data: invocations, isLoading: loadingInvocations } = useQuery({
		queryKey: QK.functionInvocations(functionId!, statusFilter),
		queryFn: () =>
			api.get<{ invocations: any[] }>(
				`/admin/functions/${functionId}/invocations?limit=50${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`,
			),
		refetchInterval: 30_000,
	});

	const isLoading = loadingStats || loadingInvocations;

	if (isLoading) return <PageSkeleton />;

	const s = stats?.stats;
	const inv = invocations?.invocations ?? [];

	return (
		<div>
			<PageHeader title="Function Invocations" description="Trace function executions" />

			<div className="px-8 pb-8 space-y-6">
				{/* Stats bar */}
				<div
					className="grid grid-cols-6 gap-4 p-4 rounded-lg"
					style={{
						background: "var(--color-surface)",
						border: "1px solid var(--color-border)",
					}}
				>
					<div className="text-center">
						<div className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
							{s?.total ?? 0}
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Total
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold" style={{ color: "var(--color-success)" }}>
							{s?.success ?? 0}
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Success
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold" style={{ color: "var(--color-danger)" }}>
							{s?.errors ?? 0}
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Errors
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold" style={{ color: "#3b82f6" }}>
							{s?.cold_starts ?? 0}
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Cold Starts
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold" style={{ color: getLatencyColor(s?.p50_ms ?? 0) }}>
							{s?.p50_ms ?? 0}ms
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							P50
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold" style={{ color: getLatencyColor(s?.p95_ms ?? 0) }}>
							{s?.p95_ms ?? 0}ms
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							P95
						</div>
					</div>
				</div>

				{/* Filter tabs */}
				<div className="flex gap-2">
					{(["all", "success", "error"] as StatusFilter[]).map((status) => (
						<button
							key={status}
							onClick={() => setStatusFilter(status)}
							className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
								statusFilter === status ? "font-medium" : "opacity-60 hover:opacity-100"
							}`}
							style={{
								background: statusFilter === status ? "var(--color-brand)" : "var(--color-surface)",
								color: statusFilter === status ? "white" : "var(--color-text-secondary)",
								border: `1px solid ${statusFilter === status ? "var(--color-brand)" : "var(--color-border)"}`,
							}}
						>
							{status === "all" ? "All" : status === "success" ? "Success" : "Error"}
						</button>
					))}
				</div>

				{/* Invocations table */}
				<div
					className="rounded-lg overflow-hidden"
					style={{
						background: "var(--color-surface)",
						border: "1px solid var(--color-border)",
					}}
				>
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="text-left text-xs" style={{ color: "var(--color-text-muted)" }}>
									<th className="px-4 py-2 font-medium">Timestamp</th>
									<th className="px-4 py-2 font-medium">Method</th>
									<th className="px-4 py-2 font-medium">Path</th>
									<th className="px-4 py-2 font-medium">Status</th>
									<th className="px-4 py-2 font-medium">Response</th>
									<th className="px-4 py-2 font-medium">Duration</th>
									<th className="px-4 py-2 font-medium">Cold</th>
									<th className="px-4 py-2 font-medium">Error</th>
								</tr>
							</thead>
							<tbody>
								{inv.length === 0 ? (
									<tr>
										<td
											colSpan={8}
											className="px-4 py-8 text-center"
											style={{ color: "var(--color-text-muted)" }}
										>
											No invocations yet
										</td>
									</tr>
								) : (
									inv.map((invocation: any, i: number) => (
										<tr
											key={invocation.id ?? i}
											className="border-t"
											style={{
												borderColor: "var(--color-border)",
												background:
													invocation.status === "error" ? "rgba(239, 68, 68, 0.05)" : "transparent",
											}}
										>
											<td
												className="px-4 py-2 text-xs"
												style={{ color: "var(--color-text-muted)" }}
											>
												{formatTime(invocation.created_at)}
											</td>
											<td className="px-4 py-2" style={{ color: "var(--color-text-primary)" }}>
												{invocation.request_method ?? "-"}
											</td>
											<td
												className="px-4 py-2 font-mono text-xs"
												style={{ color: "var(--color-text-secondary)" }}
											>
												{invocation.request_path ?? "-"}
											</td>
											<td className="px-4 py-2">
												<Badge
													variant={
														invocation.status === "success"
															? "success"
															: invocation.status === "error"
																? "destructive"
																: "outline"
													}
												>
													{invocation.status}
												</Badge>
											</td>
											<td className="px-4 py-2" style={{ color: "var(--color-text-secondary)" }}>
												{invocation.response_status ?? "-"}
											</td>
											<td
												className="px-4 py-2"
												style={{ color: getLatencyColor(invocation.duration_ms ?? 0) }}
											>
												{invocation.duration_ms ? `${invocation.duration_ms}ms` : "-"}
											</td>
											<td className="px-4 py-2">
												{invocation.cold_start ? (
													<Badge variant="outline" className="bg-blue-50 text-blue-600">
														<Snowflake size={10} className="mr-1" />
														COLD
													</Badge>
												) : (
													<span style={{ color: "var(--color-text-muted)" }}>-</span>
												)}
											</td>
											<td
												className="px-4 py-2 max-w-xs truncate"
												style={{ color: "var(--color-danger)" }}
											>
												{invocation.error_msg ?? "-"}
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
