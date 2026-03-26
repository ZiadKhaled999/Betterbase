import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

type StatusFilter = "all" | "success" | "failed";

function getStatusBadge(status: string) {
	switch (status) {
		case "success":
			return <Badge variant="success">Success</Badge>;
		case "failed":
			return <Badge variant="destructive">Failed</Badge>;
		default:
			return <Badge variant="outline">Pending</Badge>;
	}
}

function formatTime(timestamp: string): string {
	return new Date(timestamp).toLocaleString();
}

export default function WebhookDeliveriesPage() {
	const { webhookId } = useParams();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const { data: stats, isLoading: loadingStats } = useQuery({
		queryKey: QK.webhookStats(webhookId!),
		queryFn: () => api.get<{ stats: any }>(`/admin/webhooks/${webhookId}/stats`),
		refetchInterval: 30_000,
	});

	const { data: deliveries, isLoading: loadingDeliveries } = useQuery({
		queryKey: QK.webhookDeliveries(webhookId!, statusFilter),
		queryFn: () =>
			api.get<{ deliveries: any[] }>(
				`/admin/webhooks/${webhookId}/deliveries?limit=50${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`,
			),
		refetchInterval: 30_000,
	});

	const isLoading = loadingStats || loadingDeliveries;

	if (isLoading) return <PageSkeleton />;

	const s = stats?.stats;
	const d = deliveries?.delivers ?? deliveries?.deliveries ?? [];

	return (
		<div>
			<PageHeader title="Webhook Deliveries" description="Debug webhook delivery attempts" />

			<div className="px-8 pb-8 space-y-6">
				{/* Stats bar */}
				<div
					className="grid grid-cols-4 gap-4 p-4 rounded-lg"
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
							{s?.failed ?? 0}
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Failed
						</div>
					</div>
					<div className="text-center">
						<div className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
							{s?.avg_duration_ms ? `${s.avg_duration_ms}ms` : "0ms"}
						</div>
						<div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Avg Duration
						</div>
					</div>
				</div>

				{/* Filter tabs */}
				<div className="flex gap-2">
					{(["all", "success", "failed"] as StatusFilter[]).map((status) => (
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
							{status === "all" ? "All" : status === "success" ? "Success" : "Failed"}
						</button>
					))}
				</div>

				{/* Deliveries table */}
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
									<th className="px-4 py-2 font-medium">Event</th>
									<th className="px-4 py-2 font-medium">Table</th>
									<th className="px-4 py-2 font-medium">Status</th>
									<th className="px-4 py-2 font-medium">HTTP</th>
									<th className="px-4 py-2 font-medium">Duration</th>
									<th className="px-4 py-2 font-medium">Error</th>
								</tr>
							</thead>
							<tbody>
								{d.length === 0 ? (
									<tr>
										<td
											colSpan={7}
											className="px-4 py-8 text-center"
											style={{ color: "var(--color-text-muted)" }}
										>
											No deliveries yet
										</td>
									</tr>
								) : (
									d.map((delivery: any, i: number) => (
										<tr
											key={delivery.id ?? i}
											className="border-t"
											style={{ borderColor: "var(--color-border)" }}
										>
											<td
												className="px-4 py-2 text-xs"
												style={{ color: "var(--color-text-muted)" }}
											>
												{formatTime(delivery.created_at)}
											</td>
											<td className="px-4 py-2" style={{ color: "var(--color-text-primary)" }}>
												{delivery.event_type}
											</td>
											<td
												className="px-4 py-2 font-mono text-xs"
												style={{ color: "var(--color-text-secondary)" }}
											>
												{delivery.table_name}
											</td>
											<td className="px-4 py-2">{getStatusBadge(delivery.status)}</td>
											<td
												className="px-4 py-2"
												style={{
													color:
														delivery.http_status >= 200 && delivery.http_status < 300
															? "var(--color-success)"
															: "var(--color-danger)",
												}}
											>
												{delivery.http_status ?? "-"}
											</td>
											<td className="px-4 py-2" style={{ color: "var(--color-text-secondary)" }}>
												{delivery.duration_ms ? `${delivery.duration_ms}ms` : "-"}
											</td>
											<td
												className="px-4 py-2 max-w-xs truncate"
												style={{ color: "var(--color-danger)" }}
												title={delivery.error_msg}
											>
												{delivery.error_msg ? delivery.error_msg.slice(0, 200) : "-"}
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
