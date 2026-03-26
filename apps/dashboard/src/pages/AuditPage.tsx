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
import { Download, Loader2, Search } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";

interface AuditLog {
	id: number;
	actor_id?: string;
	actor_email?: string;
	action: string;
	resource_type?: string;
	resource_id?: string;
	resource_name?: string;
	before_data?: unknown;
	after_data?: unknown;
	ip_address?: string;
	created_at: string;
}

interface AuditResponse {
	logs: AuditLog[];
	total: number;
	page: number;
	page_size: number;
	actions: string[];
}

export default function AuditPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const queryClient = useQueryClient();

	const actor = searchParams.get("actor") ?? "";
	const action = searchParams.get("action") ?? "all";
	const resourceType = searchParams.get("resource_type") ?? "all";
	const page = Number.parseInt(searchParams.get("page") ?? "1");
	const limit = 50;

	const { data, isLoading } = useQuery({
		queryKey: QK.audit({
			actor,
			action,
			resource_type: resourceType,
			page: String(page),
			limit: String(limit),
		}),
		queryFn: () =>
			api.get<AuditResponse>(
				`/admin/audit?actor=${actor}&action=${action}&resource_type=${resourceType}&page=${page}&limit=${limit}`,
			),
	});

	const { data: actionsData } = useQuery({
		queryKey: QK.auditActions(),
		queryFn: () => api.get<{ actions: string[] }>("/admin/audit/actions"),
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

	const exportMutation = useMutation({
		mutationFn: () =>
			api.download(
				`/admin/audit/export?actor=${actor}&action=${action}&resource_type=${resourceType}`,
			),
		onSuccess: (blob) => {
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `audit-${new Date().toISOString().split("T")[0]}.csv`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success("Audit log exported");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

	if (isLoading) return <PageSkeleton />;

	return (
		<div>
			<PageHeader
				title="Audit Log"
				description="Track all administrative actions and changes"
				action={
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
				}
			/>

			<div className="px-8 pb-8 space-y-6">
				{/* Filters */}
				<div className="flex flex-wrap gap-3">
					<Input
						placeholder="Search actor..."
						value={actor}
						onChange={(e) => updateFilter("actor", e.target.value)}
						className="w-48"
					/>

					<Select value={action} onValueChange={(v) => updateFilter("action", v)}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Action" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Actions</SelectItem>
							{data?.actions?.map((a) => (
								<SelectItem key={a} value={a}>
									{a}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<Select value={resourceType} onValueChange={(v) => updateFilter("resource_type", v)}>
						<SelectTrigger className="w-40">
							<SelectValue placeholder="Resource Type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Types</SelectItem>
							<SelectItem value="project">Project</SelectItem>
							<SelectItem value="user">User</SelectItem>
							<SelectItem value="settings">Settings</SelectItem>
							<SelectItem value="api_key">API Key</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Table */}
				<Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Actor</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Resource</TableHead>
									<TableHead>IP Address</TableHead>
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
										<TableCell style={{ color: "var(--color-text-primary)" }}>
											{log.actor_email ?? log.actor_id ?? "system"}
										</TableCell>
										<TableCell>
											<span
												className="px-2 py-0.5 rounded text-xs"
												style={{
													background: "var(--color-brand-muted)",
													color: "var(--color-brand)",
												}}
											>
												{log.action}
											</span>
										</TableCell>
										<TableCell style={{ color: "var(--color-text-secondary)" }}>
											{log.resource_type && (
												<span>
													{log.resource_type}: {log.resource_name ?? log.resource_id}
												</span>
											)}
										</TableCell>
										<TableCell style={{ color: "var(--color-text-muted)" }}>
											{log.ip_address ?? "-"}
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
											No audit logs found
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
							Prev
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={!data?.logs || data.logs.length < limit}
							onClick={() => updateFilter("page", String(page + 1))}
						>
							Next
						</Button>
					</div>
				</div>

				{/* Detail Modal */}
				<Dialog open={!!detailLog} onOpenChange={(open) => !open && setDetailLog(null)}>
					<DialogContent
						style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
						className="max-w-2xl"
					>
						<DialogHeader>
							<DialogTitle style={{ color: "var(--color-text-primary)" }}>
								Audit Entry Details
							</DialogTitle>
							<DialogDescription style={{ color: "var(--color-text-secondary)" }}>
								{detailLog?.action} — {detailLog?.resource_type}
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<span style={{ color: "var(--color-text-muted)" }}>Actor: </span>
									<span style={{ color: "var(--color-text-primary)" }}>
										{detailLog?.actor_email ?? "system"}
									</span>
								</div>
								<div>
									<span style={{ color: "var(--color-text-muted)" }}>IP: </span>
									<span style={{ color: "var(--color-text-primary)" }}>
										{detailLog?.ip_address ?? "-"}
									</span>
								</div>
								<div>
									<span style={{ color: "var(--color-text-muted)" }}>Time: </span>
									<span style={{ color: "var(--color-text-primary)" }}>
										{formatDate(detailLog?.created_at ?? "")}
									</span>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<h4 className="text-sm font-medium mb-2" style={{ color: "var(--color-danger)" }}>
										Before
									</h4>
									<pre
										className="text-xs p-3 rounded overflow-auto max-h-64"
										style={{
											background: "var(--color-surface-elevated)",
											color: "var(--color-text-secondary)",
										}}
									>
										{detailLog?.before_data
											? JSON.stringify(detailLog.before_data, null, 2)
											: "(no data)"}
									</pre>
								</div>
								<div>
									<h4
										className="text-sm font-medium mb-2"
										style={{ color: "var(--color-success)" }}
									>
										After
									</h4>
									<pre
										className="text-xs p-3 rounded overflow-auto max-h-64"
										style={{
											background: "var(--color-surface-elevated)",
											color: "var(--color-text-secondary)",
										}}
									>
										{detailLog?.after_data
											? JSON.stringify(detailLog.after_data, null, 2)
											: "(no data)"}
									</pre>
								</div>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
