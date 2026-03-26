import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ban, LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

export default function ProjectUserPage() {
	const { projectId, userId } = useParams();
	const [deleteOpen, setDeleteOpen] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: ["projectUser", projectId, userId],
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/users/${userId}`),
	});

	const banMutation = useMutation({
		mutationFn: (banned: boolean) =>
			api.patch(`/admin/projects/${projectId}/users/${userId}`, { banned }),
		onSuccess: () => toast.success("User updated"),
		onError: (err: any) => toast.error(err.message),
	});

	const deleteMutation = useMutation({
		mutationFn: () => api.delete(`/admin/projects/${projectId}/users/${userId}`),
		onSuccess: () => {
			toast.success("User deleted");
			window.location.href = `/projects/${projectId}/users`;
		},
		onError: (err: any) => toast.error(err.message),
	});

	if (isLoading) return <PageSkeleton />;
	const user = data?.user;

	return (
		<div>
			<PageHeader
				title="User Details"
				action={
					<div className="flex gap-2">
						<Button variant="outline" onClick={() => banMutation.mutate(!user?.banned)}>
							<Ban size={16} /> {user?.banned ? "Unban" : "Ban"}
						</Button>
						<Button variant="destructive" onClick={() => setDeleteOpen(true)}>
							<Trash2 size={16} />
						</Button>
					</div>
				}
			/>

			<div className="px-8 pb-8 space-y-6">
				{/* Header */}
				<div className="flex items-center gap-4">
					<Avatar email={user?.email ?? ""} size={48} />
					<div>
						<h2 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
							{user?.name || user?.email}
						</h2>
						<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
							{user?.email}
						</p>
					</div>
					<Badge variant={user?.banned ? "destructive" : "success"}>
						{user?.banned ? "Banned" : "Active"}
					</Badge>
				</div>

				{/* Details */}
				<div className="grid grid-cols-2 gap-6">
					<Card>
						<CardHeader>
							<CardTitle>Details</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex justify-between">
								<span style={{ color: "var(--color-text-muted)" }}>Created</span>
								<span style={{ color: "var(--color-text-primary)" }}>
									{formatDate(user?.created_at)}
								</span>
							</div>
							<div className="flex justify-between">
								<span style={{ color: "var(--color-text-muted)" }}>Last Sign In</span>
								<span style={{ color: "var(--color-text-primary)" }}>
									{user?.last_sign_in_at ? formatDate(user.last_sign_in_at) : "Never"}
								</span>
							</div>
							<div className="flex justify-between">
								<span style={{ color: "var(--color-text-muted)" }}>User ID</span>
								<code className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
									{user?.id}
								</code>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Providers</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="flex gap-2">
								{user?.providers?.map((p: string) => (
									<Badge key={p} variant="outline">
										{p}
									</Badge>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title="Delete User"
				description="This will permanently delete this user and all their data."
				confirmLabel="Delete User"
				variant="danger"
				onConfirm={() => deleteMutation.mutate()}
				loading={deleteMutation.isPending}
			/>
		</div>
	);
}
