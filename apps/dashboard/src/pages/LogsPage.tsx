import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { formatDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
const STATUS_RANGES = ["all", "2xx", "3xx", "4xx", "5xx"] as const;
const TIME_RANGES = [
	{ value: "1h", label: "Last 1 hour" },
	{ value: "6h", label: "Last 6 hours" },
	{ value: "24h", label: "Last 24 hours" },
	{ value: "7d", label: "Last 7 days" },
];

interface RequestLog {
	id: number;
	method: string;
	path: string;
	status: number;
	duration_ms?: number;
	created_at: string;
}

interface LogsResponse {
	logs: RequestLog[];
	total: number;
	page: number;
	page_size: number;
}

export default function LogsPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const queryClient = useQueryClient();

	const method = searchParams.get("method") ?? "all";
	const status = searchParams.get("status") ?? "all";
	const path = searchParams.get("path") ?? "";
	const timeRange = searchParams.get("time") ?? "24h";
	const page = Number.parseInt(searchParams.get("page") ?? "1");
	const limit = 50;

	const { data, isLoading } = useQuery({
		queryKey: QK.logs({
			method,
			status,
			path,
			time: timeRange,
			page: String(page),
			limit: String(limit),
		}),
		queryFn: () =>
			api.get<LogsResponse>(
				`/admin/logs?method=${method}&status=${status}&path=${path}&time=${timeRange}&page=${page}&limit=${limit}`,
			),
	});

	const updateFilter = (key: string, value: string) => {
		const newParams = new URLSearchParams(searchParams);
		if (value === "all") {
			newParams.delete(key);
		} else {
			newParams.set(key, value);
		}
		newParams.delete("page");
		setSearchParams(newParams);
	};

	const summary = useMemo(() => {
		if (!data?.logs) return { total: 0, errors: 0, avgDuration: 0 };
		const total = data.logs.length;
		const errors = data.logs.filter((l) => l.status >= 400).length;
		const durations = data.logs.filter((l) => l.duration_ms != null).map((l) => l.duration_ms!);
		const avgDuration =
			durations.length > 0
				? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
				: 0;
		return { total, errors, avgDuration };
	}, [data]);

	const exportMutation = useMutation({
		mutationFn: () =>
			api.download(
				`/admin/logs/export?method=${method}&status=${status}&path=${path}&time=${timeRange}`,
			),
		onSuccess: (blob) => {
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `logs-${new Date().toISOString().split("T")[0]}.csv`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success("Logs exported");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const [detailLog, setDetailLog] = useState<RequestLog | null>(null);

	const getMethodColor = (m: string) => {
		switch (m) {
			case "GET":
				return "var(--color-info)";
			case "POST":
				return "var(--color-success)";
			case "DELETE":
				return "var(--color-danger)";
			case "PATCH":
				return "var(--color-warning)";
			default:
				return "var(--color-text-muted)";
		}
	};

	const getStatusColor = (s: number) => {
		if (s >= 200 && s < 300) return "var(--color-success)";
		if (s >= 300 && s < 400) return "var(--color-info)";
		if (s >= 400 && s < 500) return "var(--color-warning)";
		return "var(--color-danger)";
	};

	if (isLoading) return <PageSkeleton />;

	return (
		<div>
			<PageHeader title="Logs" description="View and filter request logs" />

			<div className="px-8 pb-8 space-y-6">
				{/* Filters */}
				<div className="flex flex-wrap gap-3">
					<Select value={method} onValueChange={(v) => updateFilter("method", v)}>
						<SelectTrigger className="w-32">
							<SelectValue placeholder="Method" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Methods</SelectItem>
							{METHODS.map((m) => (
								<SelectItem key={m} value={m}>
									{m}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={status} onValueChange={(v) => updateFilter("status", v)}>
						<SelectTrigger className="w-32">
							<SelectValue placeholder="Status" />
						</SelectTrigger>
						<SelectContent>
							{STATUS_RANGES.map((s) => (
								<SelectItem key={s} value={s}>
									{s === "all" ? "All Status" : s}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={timeRange} onValueChange={(v) => updateFilter("time", v)}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Time Range" />
						</SelectTrigger>
						<SelectContent>
							{TIME_RANGES.map((t) => (
								<SelectItem key={t.value} value={t.value}>
									{t.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Input
						placeholder="Path contains..."
						value={path}
						onChange={(e) => updateFilter("path", e.target.value)}
						className="w-64"
					/>

					<Button
						variant="outline"
						onClick={() => exportMutation.mutate()}
						disabled={exportMutation.isPending}
					>
						{exportMutation.isPending ? (
							<Loader2 className="animate-spin mr-2" />
						) : (
							<Download size={14} className="mr-2" />
						)}
						Export CSV
					</Button>
				</div>

				{/* Summary */}
				<div className="flex gap-6 text-sm">
					<div>
						<span style={{ color: "var(--color-text-muted)" }}>Total: </span>
						<span style={{ color: "var(--color-text-primary)" }}>{summary.total}</span>
					</div>
					<div>
						<span style={{ color: "var(--color-text-muted)" }}>Errors: </span>
						<span
							style={{
								color: summary.errors > 0 ? "var(--color-danger)" : "var(--color-text-primary)",
							}}
						>
							{summary.errors}
						</span>
					</div>
					<div>
						<span style={{ color: "var(--color-text-muted)" }}>Avg: </span>
						<span style={{ color: "var(--color-text-primary)" }}>{summary.avgDuration}ms</span>
					</div>
				</div>

				{/* Table */}
				<Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Method</TableHead>
									<TableHead>Path</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Duration</TableHead>
									<TableHead>Time</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.logs?.map((log) => (
									<TableRow
										key={log.id}
										className="cursor-pointer"
										onClick={() => setDetailLog(log)}
									>
										<TableCell>
											<span
												className="px-2 py-0.5 rounded text-xs font-medium"
												style={{
													background: "var(--color-surface-overlay)",
													color: getMethodColor(log.method),
												}}
											>
												{log.method}
											</span>
										</TableCell>
										<TableCell>
											<code
												style={{
													color: "var(--color-text-secondary)",
													fontFamily: "var(--font-mono)",
													fontSize: "12px",
												}}
											>
												{log.path}
											</code>
										</TableCell>
										<TableCell>
											<span
												className="px-2 py-0.5 rounded text-xs font-medium"
												style={{
													background: "var(--color-surface-overlay)",
													color: getStatusColor(log.status),
												}}
											>
												{log.status}
											</span>
										</TableCell>
										<TableCell style={{ color: "var(--color-text-secondary)" }}>
											{log.duration_ms != null ? `${log.duration_ms}ms` : "-"}
										</TableCell>
										<TableCell style={{ color: "var(--color-text-muted)" }}>
											{formatDate(log.created_at)}
										</TableCell>
									</TableRow>
								))}
								{data?.logs?.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={5}
											className="text-center py-8"
											style={{ color: "var(--color-text-muted)" }}
										>
											No logs found
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Pagination */}
				<div className="flex items-center justify-between">
					<div className="text-sm" style={{ color: "var(--color-text-muted)" }}>
						Page {page}
					</div>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => updateFilter("page", String(page - 1))}
						>
							<ChevronLeft size={14} />
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!data?.logs || data.logs.length < limit}
							onClick={() => updateFilter("page", String(page + 1))}
						>
							<ChevronRight size={14} />
						</Button>
					</div>
				</div>

				{/* Detail Modal */}
				<Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
					<DialogContent
						style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
					>
						<DialogHeader>
							<DialogTitle style={{ color: "var(--color-text-primary)" }}>
								Request Details
							</DialogTitle>
							<DialogDescription style={{ color: "var(--color-text-secondary)" }}>
								{detailLog?.method} {detailLog?.path}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3 text-sm">
							<div className="flex justify-between">
								<span style={{ color: "var(--color-text-muted)" }}>Status:</span>
								<span style={{ color: getStatusColor(detailLog?.status ?? 0) }}>
									{detailLog?.status}
								</span>
							</div>
							<div className="flex justify-between">
								<span style={{ color: "var(--color-text-muted)" }}>Duration:</span>
								<span style={{ color: "var(--color-text-primary)" }}>
									{detailLog?.duration_ms}ms
								</span>
							</div>
							<div className="flex justify-between">
								<span style={{ color: "var(--color-text-muted)" }}>Time:</span>
								<span style={{ color: "var(--color-text-primary)" }}>
									{formatDate(detailLog?.created_at ?? "")}
								</span>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
