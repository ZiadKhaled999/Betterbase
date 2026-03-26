import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { formatDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Eye, EyeOff, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ApiKey {
	id: string;
	name: string;
	key_prefix: string;
	scopes: string[];
	last_used_at?: string;
	expires_at?: string;
	created_at: string;
}

interface CliSession {
	id: string;
	status: string;
	created_at: string;
	expires_at: string;
}

const SCOPES = [
	{ value: "projects:read", label: "Read Projects" },
	{ value: "projects:write", label: "Write Projects" },
	{ value: "users:read", label: "Read Users" },
	{ value: "users:write", label: "Write Users" },
	{ value: "settings:read", label: "Read Settings" },
	{ value: "settings:write", label: "Write Settings" },
];

export default function ApiKeysPage() {
	const queryClient = useQueryClient();
	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [deleteKey, setDeleteKey] = useState<ApiKey | null>(null);
	const [newKey, setNewKey] = useState<string | null>(null);
	const [showSecret, setShowSecret] = useState(false);
	const [copied, setCopied] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: QK.apiKeys(),
		queryFn: () => api.get<{ keys: ApiKey[] }>("/admin/api-keys"),
	});

	const { data: cliData, isLoading: cliLoading } = useQuery({
		queryKey: QK.cliSessions(),
		queryFn: () => api.get<{ sessions: CliSession[] }>("/admin/cli-sessions"),
	});

	const createMutation = useMutation({
		mutationFn: (data: { name: string; expires_at?: string; scopes?: string[] }) =>
			api.post<{ key: string }>("/admin/api-keys", data),
		onSuccess: (res) => {
			setNewKey(res.key);
			setShowCreateDialog(false);
			queryClient.invalidateQueries({ queryKey: QK.apiKeys() });
			toast.success("API key created");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.delete(`/admin/api-keys/${id}`),
		onSuccess: () => {
			toast.success("API key revoked");
			setDeleteKey(null);
			queryClient.invalidateQueries({ queryKey: QK.apiKeys() });
		},
		onError: (err: any) => toast.error(err.message),
	});

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (isLoading || cliLoading) return <PageSkeleton />;

	const keys = data?.keys ?? [];
	const sessions = cliData?.sessions ?? [];

	return (
		<div>
			<PageHeader title="API Keys" description="Manage API keys and CLI sessions" />

			<div className="px-8 pb-8 space-y-8">
				{/* API Keys */}
				<Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
					<CardHeader className="flex flex-row items-center justify-between">
						<div>
							<CardTitle style={{ color: "var(--color-text-primary)" }}>
								<Key size={18} className="inline mr-2" />
								API Keys
							</CardTitle>
							<CardDescription style={{ color: "var(--color-text-secondary)" }}>
								Create and manage API keys for programmatic access
							</CardDescription>
						</div>
						<Button onClick={() => setShowCreateDialog(true)}>
							<Plus size={16} className="mr-2" />
							Create Key
						</Button>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Prefix</TableHead>
									<TableHead>Scopes</TableHead>
									<TableHead>Last Used</TableHead>
									<TableHead>Expires</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{keys.map((key) => (
									<TableRow key={key.id}>
										<TableCell style={{ color: "var(--color-text-primary)" }}>{key.name}</TableCell>
										<TableCell>
											<code className="text-xs" style={{ color: "var(--color-text-muted)" }}>
												{key.key_prefix}...
											</code>
										</TableCell>
										<TableCell>
											<div className="flex flex-wrap gap-1">
												{key.scopes.map((s) => (
													<span
														key={s}
														className="px-1.5 py-0.5 rounded text-xs"
														style={{
															background: "var(--color-surface-overlay)",
															color: "var(--color-text-muted)",
														}}
													>
														{s}
													</span>
												))}
											</div>
										</TableCell>
										<TableCell style={{ color: "var(--color-text-secondary)" }}>
											{key.last_used_at ? formatDate(key.last_used_at) : "Never"}
										</TableCell>
										<TableCell style={{ color: "var(--color-text-secondary)" }}>
											{key.expires_at ? formatDate(key.expires_at) : "Never"}
										</TableCell>
										<TableCell className="text-right">
											<Button variant="ghost" size="icon" onClick={() => setDeleteKey(key)}>
												<Trash2 size={16} style={{ color: "var(--color-danger)" }} />
											</Button>
										</TableCell>
									</TableRow>
								))}
								{keys.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={6}
											className="text-center py-8"
											style={{ color: "var(--color-text-muted)" }}
										>
											No API keys created yet
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* CLI Sessions */}
				<Card style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}>
					<CardHeader>
						<CardTitle style={{ color: "var(--color-text-primary)" }}>
							<Key size={18} className="inline mr-2" />
							CLI Sessions
						</CardTitle>
						<CardDescription style={{ color: "var(--color-text-secondary)" }}>
							Pending authorizations for CLI login requests
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Status</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Expires</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{sessions.map((session) => (
									<TableRow key={session.id}>
										<TableCell>
											<span
												className="px-2 py-0.5 rounded text-xs font-medium"
												style={{
													background:
														session.status === "pending"
															? "var(--color-warning-muted)"
															: "var(--color-success-muted)",
													color:
														session.status === "pending"
															? "var(--color-warning)"
															: "var(--color-success)",
												}}
											>
												{session.status}
											</span>
										</TableCell>
										<TableCell style={{ color: "var(--color-text-secondary)" }}>
											{formatDate(session.created_at)}
										</TableCell>
										<TableCell style={{ color: "var(--color-text-muted)" }}>
											{formatDate(session.expires_at)}
										</TableCell>
									</TableRow>
								))}
								{sessions.length === 0 && (
									<TableRow>
										<TableCell
											colSpan={3}
											className="text-center py-8"
											style={{ color: "var(--color-text-muted)" }}
										>
											No pending CLI sessions
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				{/* Create Dialog */}
				<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
					<DialogContent
						style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
					>
						<DialogHeader>
							<DialogTitle style={{ color: "var(--color-text-primary)" }}>
								Create API Key
							</DialogTitle>
							<DialogDescription style={{ color: "var(--color-text-secondary)" }}>
								Create a new API key for programmatic access
							</DialogDescription>
						</DialogHeader>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								const formData = new FormData(e.currentTarget);
								createMutation.mutate({
									name: formData.get("name") as string,
									expires_at: (formData.get("expires_at") as string) || undefined,
									scopes: formData.getAll("scopes") as string[],
								});
							}}
						>
							<div className="space-y-4 py-4">
								<div className="grid gap-2">
									<Label>Name</Label>
									<Input name="name" placeholder="My API Key" required />
								</div>
								<div className="grid gap-2">
									<Label>Expires (optional)</Label>
									<Input name="expires_at" type="date" />
								</div>
								<div className="grid gap-2">
									<Label>Scopes</Label>
									<div className="space-y-2">
										{SCOPES.map((scope) => (
											<label key={scope.value} className="flex items-center gap-2">
												<input
													type="checkbox"
													name="scopes"
													value={scope.value}
													className="rounded"
												/>
												<span style={{ color: "var(--color-text-secondary)" }}>{scope.label}</span>
											</label>
										))}
									</div>
								</div>
							</div>
							<DialogFooter>
								<Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
									Cancel
								</Button>
								<Button type="submit" disabled={createMutation.isPending}>
									{createMutation.isPending ? "Creating..." : "Create"}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>

				{/* New Key Reveal Modal */}
				<Dialog open={!!newKey} onOpenChange={(open) => !open && setNewKey(null)}>
					<DialogContent
						style={{ background: "var(--color-surface)", borderColor: "var(--color-border)" }}
					>
						<DialogHeader>
							<DialogTitle style={{ color: "var(--color-text-primary)" }}>
								API Key Created
							</DialogTitle>
							<DialogDescription style={{ color: "var(--color-text-secondary)" }}>
								Copy your API key now. You won't be able to see it again.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-4 py-4">
							<div
								className="flex items-center gap-2 p-3 rounded-lg"
								style={{ background: "var(--color-surface-elevated)" }}
							>
								<code
									className="flex-1 text-sm"
									style={{ color: "var(--color-text-primary)", fontFamily: "var(--font-mono)" }}
								>
									{newKey}
								</code>
								<Button variant="ghost" size="icon" onClick={() => copyToClipboard(newKey!)}>
									{copied ? (
										<Check size={16} style={{ color: "var(--color-success)" }} />
									) : (
										<Copy size={16} />
									)}
								</Button>
							</div>
						</div>
						<DialogFooter>
							<Button onClick={() => setNewKey(null)}>I've saved this key</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				{/* Delete Confirmation */}
				<ConfirmDialog
					open={!!deleteKey}
					onOpenChange={(open) => !open && setDeleteKey(null)}
					title="Revoke API Key"
					description={`Are you sure you want to revoke "${deleteKey?.name}"? This action cannot be undone.`}
					confirmLabel="Revoke"
					variant="danger"
					onConfirm={() => deleteKey && deleteMutation.mutate(deleteKey.id)}
					loading={deleteMutation.isPending}
				/>
			</div>
		</div>
	);
}
