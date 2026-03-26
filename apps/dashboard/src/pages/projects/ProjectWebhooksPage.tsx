import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

export default function ProjectWebhooksPage() {
	const { projectId } = useParams();
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [newWebhook, setNewWebhook] = useState({ url: "", events: "user.created" });
	const [deleteId, setDeleteId] = useState<string | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: QK.projectWebhooks(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/webhooks`),
	});

	const createMutation = useMutation({
		mutationFn: (body: any) => api.post(`/admin/projects/${projectId}/webhooks`, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.projectWebhooks(projectId!) });
			setCreateOpen(false);
			setNewWebhook({ url: "", events: "user.created" });
			toast.success("Webhook created");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.delete(`/admin/projects/${projectId}/webhooks/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.projectWebhooks(projectId!) });
			setDeleteId(null);
			toast.success("Webhook deleted");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const toggleMutation = useMutation({
		mutationFn: ({ id, active }: { id: string; active: boolean }) =>
			api.patch(`/admin/projects/${projectId}/webhooks/${id}`, { active }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.projectWebhooks(projectId!) });
		},
		onError: (err: any) => toast.error(err.message),
	});

	const retryMutation = useMutation({
		mutationFn: (id: string) => api.post(`/admin/projects/${projectId}/webhooks/${id}/retry`),
		onSuccess: () => toast.success("Retrying deliveries"),
		onError: (err: any) => toast.error(err.message),
	});

	if (isLoading) return <PageSkeleton />;

	const webhooks = data?.webhooks ?? [];

	return (
		<div>
			<PageHeader
				title="Webhooks"
				description="Configure webhooks for this project"
				action={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus size={16} />
						Add Webhook
					</Button>
				}
			/>

			<div className="px-8 pb-8">
				{webhooks.length === 0 ? (
					<EmptyState
						icon={Webhook}
						title="No webhooks"
						description="Add a webhook to receive events."
					/>
				) : (
					<div className="space-y-4">
						{webhooks.map((wh: any) => (
							<Card key={wh.id}>
								<CardContent className="p-5">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<Switch
												checked={wh.active}
												onCheckedChange={(checked) =>
													toggleMutation.mutate({ id: wh.id, active: checked })
												}
											/>
											<div>
												<p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
													{wh.url}
												</p>
												<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
													{wh.events}
												</p>
											</div>
										</div>
										<div className="flex gap-2">
											<Button
												variant="ghost"
												size="icon"
												onClick={() => retryMutation.mutate(wh.id)}
											>
												<RefreshCw size={14} />
											</Button>
											<Button variant="ghost" size="icon" onClick={() => setDeleteId(wh.id)}>
												<Trash2 size={14} style={{ color: "var(--color-danger)" }} />
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>

			{/* Create Dialog - simplified inline for now */}
			{createOpen && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<Card className="w-full max-w-md">
						<CardHeader>
							<CardTitle>Add Webhook</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label>URL</Label>
								<Input
									value={newWebhook.url}
									onChange={(e) => setNewWebhook({ ...newWebhook, url: e.target.value })}
									placeholder="https://example.com/webhook"
								/>
							</div>
							<div className="space-y-2">
								<Label>Events</Label>
								<Input
									value={newWebhook.events}
									onChange={(e) => setNewWebhook({ ...newWebhook, events: e.target.value })}
									placeholder="user.created,user.updated"
								/>
							</div>
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setCreateOpen(false)}>
									Cancel
								</Button>
								<Button onClick={() => createMutation.mutate(newWebhook)}>Create</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			<ConfirmDialog
				open={!!deleteId}
				onOpenChange={(open) => !open && setDeleteId(null)}
				title="Delete Webhook"
				description="This will permanently delete this webhook."
				confirmLabel="Delete"
				variant="danger"
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
