import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useQuery } from "@tanstack/react-query";
import { Download, Search, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

export default function ProjectUsersPage() {
	const { projectId } = useParams();
	const [searchParams, setSearchParams] = useSearchParams();

	const search = searchParams.get("search") ?? "";
	const banned = searchParams.get("banned") ?? "all";
	const offset = Number.parseInt(searchParams.get("offset") ?? "0");
	const limit = 50;

	const { data, isLoading } = useQuery({
		queryKey: QK.projectUsers(projectId!, { search, banned, offset: String(offset) }),
		queryFn: () =>
			api.get<{ users: any[]; total: number }>(
				`/admin/projects/${projectId}/users?limit=${limit}&offset=${offset}&search=${search}&banned=${banned}`,
			),
	});

	const { data: stats } = useQuery({
		queryKey: QK.projectUserStats(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/users/stats/overview`),
	});

	const handleSearch = (value: string) => {
		const params = new URLSearchParams(searchParams);
		if (value) params.set("search", value);
		else params.delete("search");
		params.set("offset", "0");
		setSearchParams(params);
	};

	const handleFilter = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams);
		if (value && value !== "all") params.set(key, value);
		else params.delete(key);
		params.set("offset", "0");
		setSearchParams(params);
	};

	const handlePage = (newOffset: number) => {
		const params = new URLSearchParams(searchParams);
		params.set("offset", String(newOffset));
		setSearchParams(params);
	};

	const exportCSV = async () => {
		const blob = await api.download(
			`/admin/projects/${projectId}/users/export?search=${search}&banned=${banned}`,
		);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `users-${projectId}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	if (isLoading) return <PageSkeleton />;

	return (
		<div>
			<PageHeader
				title="Users"
				description={`${data?.total ?? 0} total users`}
				action={
					<Button onClick={exportCSV}>
						<Download size={16} />
						Export CSV
					</Button>
				}
			/>

			<div className="px-8 pb-6 space-y-6">
				{/* Stats */}
				<div className="grid grid-cols-3 gap-4">
					<div
						className="rounded-xl p-4"
						style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
					>
						<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Total
						</p>
						<p className="text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
							{stats?.total ?? 0}
						</p>
					</div>
					<div
						className="rounded-xl p-4"
						style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
					>
						<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Banned
						</p>
						<p className="text-2xl font-semibold" style={{ color: "var(--color-danger)" }}>
							{stats?.banned ?? 0}
						</p>
					</div>
					<div
						className="rounded-xl p-4"
						style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
					>
						<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
							Active
						</p>
						<p className="text-2xl font-semibold" style={{ color: "var(--color-success)" }}>
							{(stats?.total ?? 0) - (stats?.banned ?? 0)}
						</p>
					</div>
				</div>

				{/* Filters */}
				<div className="flex gap-3 flex-wrap">
					<div className="relative flex-1 max-w-xs">
						<Search
							className="absolute left-3 top-1/2 -translate-y-1/2"
							size={14}
							style={{ color: "var(--color-text-muted)" }}
						/>
						<Input
							placeholder="Search users..."
							value={search}
							onChange={(e) => handleSearch(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Select value={banned} onValueChange={(v) => handleFilter("banned", v)}>
						<SelectTrigger className="w-32">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="true">Banned</SelectItem>
							<SelectItem value="false">Not Banned</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Table */}
				{!data?.users || data.users.length === 0 ? (
					<EmptyState
						icon={Users}
						title="No users found"
						description="Users will appear here once they sign up."
					/>
				) : (
					<div className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Providers</TableHead>
									<TableHead>Created</TableHead>
									<TableHead>Last Sign In</TableHead>
									<TableHead>Status</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.users.map((user: any) => (
									<TableRow
										key={user.id}
										className="cursor-pointer"
										onClick={() =>
											(window.location.href = `/projects/${projectId}/users/${user.id}`)
										}
									>
										<TableCell>
											<div className="flex items-center gap-3">
												<Avatar email={user.email} size={32} />
												<div>
													<p className="font-medium" style={{ color: "var(--color-text-primary)" }}>
														{user.name || user.email}
													</p>
													<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
														{user.email}
													</p>
												</div>
											</div>
										</TableCell>
										<TableCell>
											<div className="flex gap-1">
												{user.providers?.map((p: string) => (
													<Badge key={p} variant="outline" className="text-xs">
														{p}
													</Badge>
												))}
											</div>
										</TableCell>
										<TableCell style={{ color: "var(--color-text-secondary)" }}>
											{user.created_at ? new Date(user.created_at).toLocaleDateString() : "-"}
										</TableCell>
										<TableCell style={{ color: "var(--color-text-secondary)" }}>
											{user.last_sign_in_at
												? new Date(user.last_sign_in_at).toLocaleDateString()
												: "Never"}
										</TableCell>
										<TableCell>
											<Badge variant={user.banned ? "destructive" : "success"}>
												{user.banned ? "Banned" : "Active"}
											</Badge>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				{/* Pagination */}
				{data?.total && data.total > limit && (
					<div className="flex justify-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={offset === 0}
							onClick={() => handlePage(offset - limit)}
						>
							Previous
						</Button>
						<span
							className="flex items-center text-sm"
							style={{ color: "var(--color-text-secondary)" }}
						>
							{offset + 1}-{Math.min(offset + limit, data.total)} of {data.total}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={offset + limit >= data.total}
							onClick={() => handlePage(offset + limit)}
						>
							Next
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}
