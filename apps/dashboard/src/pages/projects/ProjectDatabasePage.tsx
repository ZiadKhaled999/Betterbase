import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Database } from "lucide-react";
import { useParams } from "react-router";

export default function ProjectDatabasePage() {
	const { projectId } = useParams();

	const { data, isLoading } = useQuery({
		queryKey: QK.projectDatabase(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/database`),
	});

	if (isLoading) return <PageSkeleton />;

	return (
		<div>
			<PageHeader title="Database" description="View project database tables" />

			<div className="px-8 pb-8">
				<Card>
					<CardHeader>
						<CardTitle>Tables</CardTitle>
					</CardHeader>
					<CardContent>
						{!data?.tables || data.tables.length === 0 ? (
							<EmptyState
								icon={Database}
								title="No tables"
								description="Database tables will appear here."
							/>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Rows</TableHead>
										<TableHead>Size</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{data.tables.map((table: any) => (
										<TableRow key={table.name}>
											<TableCell className="font-mono">{table.name}</TableCell>
											<TableCell>{table.row_count?.toLocaleString()}</TableCell>
											<TableCell>{table.size}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
