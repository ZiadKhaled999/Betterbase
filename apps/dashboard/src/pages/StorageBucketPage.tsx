import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
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
import { useQuery } from "@tanstack/react-query";
import { Download, HardDrive, Search, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";

export default function StorageBucketPage() {
	const { bucketName } = useParams();
	const [search, setSearch] = useState("");

	const { data, isLoading } = useQuery({
		queryKey: ["storageObjects", bucketName],
		queryFn: () => api.get<any>(`/admin/storage/${bucketName}`),
	});

	if (isLoading) return <PageSkeleton />;

	const objects = data?.objects ?? [];

	return (
		<div>
			<PageHeader
				title={bucketName ?? "Bucket"}
				description="Manage storage objects"
				action={
					<Button>
						<Upload size={16} />
						Upload
					</Button>
				}
			/>

			<div className="px-8 pb-8 space-y-6">
				{/* Search */}
				<div className="relative max-w-xs">
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2"
						size={14}
						style={{ color: "var(--color-text-muted)" }}
					/>
					<Input
						placeholder="Search objects..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>

				{/* Objects */}
				{objects.length === 0 ? (
					<EmptyState
						icon={HardDrive}
						title="No objects"
						description="Upload files to this bucket."
					/>
				) : (
					<div className="rounded-xl border" style={{ borderColor: "var(--color-border)" }}>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Size</TableHead>
									<TableHead>Type</TableHead>
									<TableHead>Created</TableHead>
									<TableHead className="w-24">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{objects
									.filter((o: any) => o.name.includes(search))
									.map((obj: any) => (
										<TableRow key={obj.name}>
											<TableCell className="font-mono">{obj.name}</TableCell>
											<TableCell style={{ color: "var(--color-text-secondary)" }}>
												{obj.size}
											</TableCell>
											<TableCell style={{ color: "var(--color-text-secondary)" }}>
												{obj.content_type}
											</TableCell>
											<TableCell style={{ color: "var(--color-text-secondary)" }}>
												{obj.created_at ? new Date(obj.created_at).toLocaleDateString() : "-"}
											</TableCell>
											<TableCell>
												<div className="flex gap-1">
													<Button variant="ghost" size="icon">
														<Download size={14} />
													</Button>
													<Button variant="ghost" size="icon">
														<Trash2 size={14} style={{ color: "var(--color-danger)" }} />
													</Button>
												</div>
											</TableCell>
										</TableRow>
									))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
