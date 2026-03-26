import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

export default function ProjectRealtimePage() {
	const { projectId } = useParams();
	const [enabled, setEnabled] = useState(false);

	const { data, isLoading } = useQuery({
		queryKey: QK.projectRealtime(projectId!),
		queryFn: () => api.get<any>(`/admin/projects/${projectId}/realtime`),
	});

	const updateMutation = useMutation({
		mutationFn: (realtime_enabled: boolean) =>
			api.patch(`/admin/projects/${projectId}/realtime`, { realtime_enabled }),
		onSuccess: () => toast.success("Realtime settings updated"),
		onError: (err: any) => toast.error(err.message),
	});

	if (isLoading) return <PageSkeleton />;

	const config = data?.config ?? {};

	return (
		<div>
			<PageHeader
				title="Realtime"
				description="Configure realtime subscriptions for this project"
			/>

			<div className="px-8 pb-8 space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Realtime</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div>
								<Label>Enable Realtime</Label>
								<p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
									Allow clients to subscribe to database changes
								</p>
							</div>
							<Switch
								checked={config.realtime_enabled ?? false}
								onCheckedChange={(checked) => {
									setEnabled(checked);
									updateMutation.mutate(checked);
								}}
							/>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Channels</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
							{config.channels?.length ?? 0} active channels
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
