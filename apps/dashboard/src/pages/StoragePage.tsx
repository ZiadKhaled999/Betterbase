import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { formatDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen, HardDrive } from "lucide-react";
import { Link } from "react-router";

export default function StoragePage() {
	const { data, isLoading } = useQuery({
		queryKey: QK.storageBuckets(),
		queryFn: () => api.get<any>("/admin/storage"),
	});

	if (isLoading) return <PageSkeleton />;

	const buckets = data?.buckets ?? [];

	return (
		<div>
			<PageHeader title="Storage" description="Manage storage buckets" />

			<div className="px-8 pb-8">
				{buckets.length === 0 ? (
					<EmptyState
						icon={HardDrive}
						title="No buckets"
						description="Storage buckets will appear here."
					/>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						{buckets.map((bucket: any) => (
							<Link key={bucket.name} to={`/storage/${bucket.name}`}>
								<Card className="hover:border-[var(--color-brand)] transition-colors">
									<CardContent className="p-5">
										<div className="flex items-center gap-3">
											<div
												className="w-10 h-10 rounded-lg flex items-center justify-center"
												style={{ background: "var(--color-brand-muted)" }}
											>
												<FolderOpen size={18} style={{ color: "var(--color-brand)" }} />
											</div>
											<div>
												<h3 className="font-medium" style={{ color: "var(--color-text-primary)" }}>
													{bucket.name}
												</h3>
												<p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
													{bucket.public ? "Public" : "Private"}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
