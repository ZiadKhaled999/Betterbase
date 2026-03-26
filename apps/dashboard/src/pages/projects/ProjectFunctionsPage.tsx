import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

export default function ProjectFunctionsPage() {
	const { projectId } = useParams();
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [newFn, setNewFn] = useState({
		name: "",
		code: "export default async (req) => { return { status: 200, body: {} }; }",
	});
	const [deleteId, setDeleteId] = useState<string | null>(null);
	const [invokeId, setInvokeId] = useState<string | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: QK.projectFunctions(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/functions`),
	});

	const createMutation = useMutation({
		mutationFn: (body: any) => api.post(`/admin/projects/${projectId}/functions`, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.projectFunctions(projectId!) });
			setCreateOpen(false);
			setNewFn({
				name: "",
				code: "export default async (req) => { return { status: 200, body: {} }; }",
			});
			toast.success("Function created");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.delete(`/admin/projects/${projectId}/functions/${id}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.projectFunctions(projectId!) });
			setDeleteId(null);
			toast.success("Function deleted");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const invokeMutation = useMutation({
		mutationFn: (id: string) => api.post(`/admin/projects/${projectId}/functions/${id}/invoke`, {}),
		onSuccess: (res) => {
			toast.success("Function invoked successfully");
			setInvokeId(null);
		},
		onError: (err: any) => toast.error(err.message),
	});

	if (isLoading) return <PageSkeleton />;

	const functions = data?.functions ?? [];

	return (
		<div>
			<PageHeader
				title="Functions"
				description="Serverless functions for this project"
				action={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus size={16} />
						New Function
					</Button>
				}
			/>

			<div className="px-8 pb-8">
				{functions.length === 0 ? (
					<EmptyState
						icon={Zap}
						title="No functions"
						description="Create a serverless function to get started."
					/>
				) : (
					<div className="grid gap-4">
						{functions.map((fn: any) => (
							<Card key={fn.id}>
								<CardContent className="p-5">
									<div className="flex items-center justify-between">
										<div>
											<div className="flex items-center gap-2 mb-1">
												<h3 className="font-medium" style={{ color: "var(--color-text-primary)" }}>
													{fn.name}
												</h3>
												<Badge variant="secondary">{fn.invocations?.length ?? 0} invocations</Badge>
											</div>
											<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
												Updated {new Date(fn.updated_at).toLocaleDateString()}
											</p>
										</div>
										<div className="flex gap-2">
											<Button variant="outline" size="sm" onClick={() => setInvokeId(fn.id)}>
												<Play size={14} /> Test
											</Button>
											<Button variant="ghost" size="icon" onClick={() => setDeleteId(fn.id)}>
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

			{/* Create Modal */}
			{createOpen && (
				<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
					<Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
						<CardHeader>
							<CardTitle>New Function</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-2">
								<Label>Function Name</Label>
								<Input
									value={newFn.name}
									onChange={(e) => setNewFn({ ...newFn, name: e.target.value })}
									placeholder="my-function"
								/>
							</div>
							<div className="space-y-2">
								<Label>Code</Label>
								<Textarea
									value={newFn.code}
									onChange={(e) => setNewFn({ ...newFn, code: e.target.value })}
									className="font-mono text-sm h-64"
									placeholder="export default async (req) => { ... }"
								/>
							</div>
							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={() => setCreateOpen(false)}>
									Cancel
								</Button>
								<Button onClick={() => createMutation.mutate(newFn)} disabled={!newFn.name}>
									Create
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			<ConfirmDialog
				open={!!deleteId}
				onOpenChange={(open) => !open && setDeleteId(null)}
				title="Delete Function"
				description="This will permanently delete this function."
				confirmLabel="Delete"
				variant="danger"
				onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
