import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Check, Copy, Globe, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

export default function ProjectEnvPage() {
	const { projectId } = useParams();
	const queryClient = useQueryClient();
	const [newKey, setNewKey] = useState("");
	const [newValue, setNewValue] = useState("");
	const [deleteKey, setDeleteKey] = useState<string | null>(null);
	const [copiedKey, setCopiedKey] = useState<string | null>(null);

	const { data, isLoading } = useQuery({
		queryKey: QK.projectEnv(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/env`),
	});

	const createMutation = useMutation({
		mutationFn: (body: { key: string; value: string }) =>
			api.post(`/admin/projects/${projectId}/env`, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.projectEnv(projectId!) });
			setNewKey("");
			setNewValue("");
			toast.success("Environment variable added");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (key: string) => api.delete(`/admin/projects/${projectId}/env/${key}`),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.projectEnv(projectId!) });
			setDeleteKey(null);
			toast.success("Environment variable deleted");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const copyValue = (key: string, value: string) => {
		navigator.clipboard.writeText(value);
		setCopiedKey(key);
		setTimeout(() => setCopiedKey(null), 2000);
	};

	if (isLoading) return <PageSkeleton />;

	const envVars = data?.env ?? [];

	return (
		<div>
			<PageHeader title="Environment" description="Manage environment variables for this project" />

			<div className="px-8 pb-8 space-y-6">
				{/* Add new */}
				<Card>
					<CardHeader>
						<CardTitle>Add Variable</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex gap-3">
							<Input
								placeholder="KEY"
								value={newKey}
								onChange={(e) => setNewKey(e.target.value.toUpperCase())}
								className="w-48"
							/>
							<Input
								placeholder="Value"
								value={newValue}
								onChange={(e) => setNewValue(e.target.value)}
								className="flex-1"
							/>
							<Button
								onClick={() => createMutation.mutate({ key: newKey, value: newValue })}
								disabled={!newKey}
							>
								<Plus size={16} /> Add
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* List */}
				<Card>
					<CardHeader>
						<CardTitle>Variables</CardTitle>
					</CardHeader>
					<CardContent>
						{envVars.length === 0 ? (
							<EmptyState
								icon={Globe}
								title="No variables"
								description="Add environment variables to get started."
							/>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Key</TableHead>
										<TableHead>Value</TableHead>
										<TableHead className="w-24">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{envVars.map((env: any) => (
										<TableRow key={env.key}>
											<TableCell className="font-mono">{env.key}</TableCell>
											<TableCell>
												<div className="flex items-center gap-2">
													<code className="text-sm">
														{env.value.length > 30 ? env.value.slice(0, 30) + "..." : env.value}
													</code>
													<Button
														variant="ghost"
														size="icon"
														onClick={() => copyValue(env.key, env.value)}
													>
														{copiedKey === env.key ? <Check size={14} /> : <Copy size={14} />}
													</Button>
												</div>
											</TableCell>
											<TableCell>
												<Button variant="ghost" size="icon" onClick={() => setDeleteKey(env.key)}>
													<Trash2 size={14} style={{ color: "var(--color-danger)" }} />
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>

			<ConfirmDialog
				open={!!deleteKey}
				onOpenChange={(open) => !open && setDeleteKey(null)}
				title="Delete Variable"
				description={`Delete environment variable "${deleteKey}"?`}
				confirmLabel="Delete"
				variant="danger"
				onConfirm={() => deleteKey && deleteMutation.mutate(deleteKey)}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
