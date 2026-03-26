import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { formatDate } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	Clock,
	Database,
	FolderOpen,
	Globe,
	Key,
	Pause,
	Play,
	Trash2,
	Users,
	Webhook,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function ProjectDetailPage() {
	const { projectId } = useParams();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [typedSlug, setTypedSlug] = useState("");

	const { data, isLoading } = useQuery({
		queryKey: QK.project(projectId!),
		queryFn: () => api.get<{ project: any }>(`/admin/projects/${projectId}`),
	});

	const statusMutation = useMutation({
		mutationFn: (status: string) => api.patch(`/admin/projects/${projectId}`, { status }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: QK.project(projectId!) });
			toast.success("Project status updated");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: () => api.delete(`/admin/projects/${projectId}`),
		onSuccess: () => {
			toast.success("Project deleted");
			navigate("/projects");
		},
		onError: (err: any) => toast.error(err.message),
	});

	const rotateKeyMutation = useMutation({
		mutationFn: () => api.post<{ admin_key: string }>(`/admin/projects/${projectId}/rotate-key`),
		onSuccess: ({ admin_key }) => {
			queryClient.invalidateQueries({ queryKey: QK.project(projectId!) });
			toast.success(`New key: ${admin_key.slice(0, 8)}...`);
		},
		onError: (err: any) => toast.error(err.message),
	});

	if (isLoading) return <PageSkeleton />;
	const project = data?.project;

	const tabs = [
		{ value: "overview", label: "Overview", icon: FolderOpen },
		{
			value: "observability",
			label: "Observability",
			icon: Activity,
			href: `/projects/${projectId}/observability`,
		},
		{ value: "users", label: "Users", icon: Users, href: `/projects/${projectId}/users` },
		{ value: "auth", label: "Auth", icon: Key, href: `/projects/${projectId}/auth` },
		{
			value: "database",
			label: "Database",
			icon: Database,
			href: `/projects/${projectId}/database`,
		},
		{ value: "env", label: "Environment", icon: Globe, href: `/projects/${projectId}/env` },
		{
			value: "webhooks",
			label: "Webhooks",
			icon: Webhook,
			href: `/projects/${projectId}/webhooks`,
		},
		{ value: "functions", label: "Functions", icon: Zap, href: `/projects/${projectId}/functions` },
		{ value: "realtime", label: "Realtime", icon: Clock, href: `/projects/${projectId}/realtime` },
	];

	return (
		<div>
			<PageHeader
				title={project?.name ?? "Project"}
				description={`Slug: ${project?.slug}`}
				action={
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								statusMutation.mutate(project?.status === "suspended" ? "active" : "suspended")
							}
						>
							{project?.status === "suspended" ? <Play size={16} /> : <Pause size={16} />}
							{project?.status === "suspended" ? "Unsuspend" : "Suspend"}
						</Button>
						<Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
							<Trash2 size={16} />
						</Button>
					</div>
				}
			/>

			<div className="px-8 pb-8">
				<Tabs defaultValue="overview">
					<TabsList className="mb-6">
						{tabs.map((tab) =>
							tab.href ? (
								<TabsTrigger key={tab.value} value={tab.value} asChild>
									<Link to={tab.href} className="flex items-center gap-1.5">
										<tab.icon size={14} /> {tab.label}
									</Link>
								</TabsTrigger>
							) : (
								<TabsTrigger
									key={tab.value}
									value={tab.value}
									className="flex items-center gap-1.5"
								>
									<tab.icon size={14} /> {tab.label}
								</TabsTrigger>
							),
						)}
					</TabsList>

					<TabsContent value="overview">
						<div className="grid gap-6 max-w-2xl">
							<Card>
								<CardHeader>
									<CardTitle>Project Details</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between">
										<span style={{ color: "var(--color-text-secondary)" }}>Status</span>
										<Badge variant={project?.status === "active" ? "success" : "destructive"}>
											{project?.status}
										</Badge>
									</div>
									<div className="flex justify-between">
										<span style={{ color: "var(--color-text-secondary)" }}>Slug</span>
										<span style={{ color: "var(--color-text-primary)" }}>{project?.slug}</span>
									</div>
									<div className="flex justify-between">
										<span style={{ color: "var(--color-text-secondary)" }}>Created</span>
										<span style={{ color: "var(--color-text-primary)" }}>
											{formatDate(project?.created_at)}
										</span>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardHeader>
									<CardTitle>Admin Key</CardTitle>
									<CardDescription>
										Use this key to authenticate as this project's admin.
									</CardDescription>
								</CardHeader>
								<CardContent>
									<Button variant="outline" onClick={() => rotateKeyMutation.mutate()}>
										Rotate Key
									</Button>
								</CardContent>
							</Card>

							<Card className="border-[var(--color-danger)]">
								<CardHeader>
									<CardTitle style={{ color: "var(--color-danger)" }}>Danger Zone</CardTitle>
									<CardDescription>Irreversible and destructive actions.</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex justify-between items-center">
										<div>
											<p style={{ color: "var(--color-text-primary)" }}>Suspend Project</p>
											<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
												Prevents all user authentication.
											</p>
										</div>
										<Button
											variant={project?.status === "suspended" ? "outline" : "destructive"}
											size="sm"
											onClick={() =>
												statusMutation.mutate(
													project?.status === "suspended" ? "active" : "suspended",
												)
											}
										>
											{project?.status === "suspended" ? "Unsuspend" : "Suspend"}
										</Button>
									</div>
									<div className="flex justify-between items-center">
										<div>
											<p style={{ color: "var(--color-text-primary)" }}>Delete Project</p>
											<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
												Permanently remove this project and all data.
											</p>
										</div>
										<Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
											Delete
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>
				</Tabs>
			</div>

			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title="Delete Project"
				description={`This will permanently delete "${project?.name}" and all its data. This action cannot be undone.`}
				confirmLabel="Delete Project"
				confirmValue={project?.slug}
				variant="danger"
				onConfirm={() => deleteMutation.mutate()}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
