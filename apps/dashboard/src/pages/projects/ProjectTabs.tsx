import { PageHeader } from "@/components/ui/PageHeader";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Clock, Database, FolderOpen, Globe, Key, Users, Webhook, Zap } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";

export default function ProjectDetailPageWrapper() {
	const { projectId } = useParams();

	return (
		<Tabs defaultValue="overview">
			<TabsList className="mb-6 ml-8">
				<TabsTrigger value="overview" asChild>
					<Link to={`/projects/${projectId}`} className="flex items-center gap-1.5">
						<FolderOpen size={14} /> Overview
					</Link>
				</TabsTrigger>
				<TabsTrigger value="users" asChild>
					<Link to={`/projects/${projectId}/users`} className="flex items-center gap-1.5">
						<Users size={14} /> Users
					</Link>
				</TabsTrigger>
				<TabsTrigger value="auth" asChild>
					<Link to={`/projects/${projectId}/auth`} className="flex items-center gap-1.5">
						<Key size={14} /> Auth
					</Link>
				</TabsTrigger>
				<TabsTrigger value="database" asChild>
					<Link to={`/projects/${projectId}/database`} className="flex items-center gap-1.5">
						<Database size={14} /> Database
					</Link>
				</TabsTrigger>
				<TabsTrigger value="env" asChild>
					<Link to={`/projects/${projectId}/env`} className="flex items-center gap-1.5">
						<Globe size={14} /> Environment
					</Link>
				</TabsTrigger>
				<TabsTrigger value="webhooks" asChild>
					<Link to={`/projects/${projectId}/webhooks`} className="flex items-center gap-1.5">
						<Webhook size={14} /> Webhooks
					</Link>
				</TabsTrigger>
				<TabsTrigger value="functions" asChild>
					<Link to={`/projects/${projectId}/functions`} className="flex items-center gap-1.5">
						<Zap size={14} /> Functions
					</Link>
				</TabsTrigger>
				<TabsTrigger value="realtime" asChild>
					<Link to={`/projects/${projectId}/realtime`} className="flex items-center gap-1.5">
						<Clock size={14} /> Realtime
					</Link>
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
