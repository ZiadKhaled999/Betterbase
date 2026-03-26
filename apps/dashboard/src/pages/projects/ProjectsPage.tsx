import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { formatDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, FolderOpen, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

export default function ProjectsPage() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [createOpen, setCreateOpen] = useState(false);
	const [newProject, setNewProject] = useState({ name: "", slug: "" });
	const [revealedKey, setRevealedKey] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: QK.projects(),
		queryFn: () => api.get<{ projects: any[] }>("/admin/projects"),
	});

	const createMutation = useMutation({
		mutationFn: (body: { name: string; slug: string }) =>
			api.post<{ project: any; admin_key: string }>("/admin/projects", body),
		onSuccess: ({ admin_key }) => {
			setCreateOpen(false);
			setRevealedKey(admin_key);
			queryClient.invalidateQueries({ queryKey: QK.projects() });
		},
		onError: (err: any) => toast.error(err.message),
	});

	const copyKey = () => {
		if (revealedKey) {
			navigator.clipboard.writeText(revealedKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	if (isLoading) return <PageSkeleton />;

	return (
		<div>
			<PageHeader
				title="Projects"
				description="Manage your Betterbase projects"
				action={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus size={16} />
						New Project
					</Button>
				}
			/>

			<div className="px-8 pb-8">
				{!data?.projects || data.projects.length === 0 ? (
					<EmptyState
						icon={FolderOpen}
						title="No projects yet"
						description="Create your first project to get started."
						action={
							<Button onClick={() => setCreateOpen(true)}>
								<Plus size={16} />
								Create Project
							</Button>
						}
					/>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{data.projects.map((project: any) => (
							<Card
								key={project.id}
								className="hover:border-[var(--color-brand)] transition-colors cursor-pointer"
								onClick={() => navigate(`/projects/${project.id}`)}
							>
								<CardContent className="p-5">
									<div className="flex items-center gap-3 mb-2">
										<div
											className="w-8 h-8 rounded-lg flex items-center justify-center"
											style={{ background: "var(--color-brand-muted)" }}
										>
											<FolderOpen size={16} style={{ color: "var(--color-brand)" }} />
										</div>
										<div>
											<h3 className="font-medium" style={{ color: "var(--color-text-primary)" }}>
												{project.name}
											</h3>
											<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
												{project.slug}
											</p>
										</div>
									</div>
									<p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
										Created {formatDate(project.created_at)}
									</p>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>

			{/* Create Dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create Project</DialogTitle>
						<DialogDescription>Enter the details for your new project.</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>Project Name</Label>
							<Input
								value={newProject.name}
								onChange={(e) =>
									setNewProject({
										...newProject,
										name: e.target.value,
										slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
									})
								}
								placeholder="My Project"
							/>
						</div>
						<div className="space-y-2">
							<Label>Slug</Label>
							<Input
								value={newProject.slug}
								onChange={(e) =>
									setNewProject({
										...newProject,
										slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
									})
								}
								placeholder="my-project"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => createMutation.mutate(newProject)}
							disabled={!newProject.name || !newProject.slug}
						>
							Create Project
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Admin Key Reveal Dialog */}
			<Dialog open={!!revealedKey} onOpenChange={(open) => !open && setRevealedKey(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Save Your Admin Key</DialogTitle>
						<DialogDescription>
							This is the only time you'll see this key. Save it somewhere secure.
						</DialogDescription>
					</DialogHeader>
					<div className="py-4">
						<div
							className="flex items-center gap-2 p-3 rounded-lg"
							style={{
								background: "var(--color-surface-elevated)",
								border: "1px solid var(--color-border)",
							}}
						>
							<code
								className="flex-1 text-sm font-mono"
								style={{ color: "var(--color-text-primary)" }}
							>
								{revealedKey}
							</code>
							<Button variant="ghost" size="icon" onClick={copyKey}>
								{copied ? <Check size={16} /> : <Copy size={16} />}
							</Button>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={() => setRevealedKey(null)}>I've saved this key</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
