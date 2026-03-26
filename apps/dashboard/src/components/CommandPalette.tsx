import { api } from "@/lib/api";
import { QK } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import {
	FolderOpen,
	HardDrive,
	LayoutDashboard,
	ScrollText,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

interface CommandPaletteProps {
	open: boolean;
	onClose: () => void;
}

const staticCommands = [
	{ label: "Overview", href: "/", icon: LayoutDashboard },
	{ label: "Projects", href: "/projects", icon: FolderOpen },
	{ label: "Storage", href: "/storage", icon: HardDrive },
	{ label: "Logs", href: "/logs", icon: ScrollText },
	{ label: "Audit Log", href: "/audit", icon: Shield },
	{ label: "Team", href: "/team", icon: Users },
	{ label: "Settings", href: "/settings", icon: Settings },
	{ label: "SMTP Settings", href: "/settings/smtp", icon: Settings },
	{ label: "API Keys", href: "/settings/api-keys", icon: Settings },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
	const navigate = useNavigate();
	const [query, setQuery] = useState("");

	const { data: projectsData } = useQuery({
		queryKey: QK.projects(),
		queryFn: () => api.get<{ projects: { id: string; name: string }[] }>("/admin/projects"),
		enabled: open,
	});

	useEffect(() => {
		if (!open) setQuery("");
	}, [open]);

	if (!open) return null;

	function go(href: string) {
		navigate(href);
		onClose();
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-24"
			style={{ background: "rgba(0,0,0,0.7)" }}
			onClick={onClose}
		>
			<div
				className="w-[560px] rounded-2xl overflow-hidden shadow-2xl"
				style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
				onClick={(e) => e.stopPropagation()}
			>
				<Command>
					<div className="px-4 py-3 border-b" style={{ borderColor: "var(--color-border)" }}>
						<Command.Input
							value={query}
							onValueChange={setQuery}
							placeholder="Search pages, projects..."
							className="w-full bg-transparent outline-none text-sm"
							style={{ color: "var(--color-text-primary)" }}
							autoFocus
						/>
					</div>
					<Command.List className="max-h-80 overflow-y-auto p-2">
						<Command.Empty
							className="py-8 text-center text-sm"
							style={{ color: "var(--color-text-muted)" }}
						>
							No results found.
						</Command.Empty>

						<Command.Group heading="Navigation">
							{staticCommands.map((cmd) => (
								<Command.Item
									key={cmd.href}
									value={cmd.label}
									onSelect={() => go(cmd.href)}
									className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm"
									style={{ color: "var(--color-text-secondary)" }}
								>
									<cmd.icon size={14} />
									{cmd.label}
								</Command.Item>
							))}
						</Command.Group>

						{(projectsData?.projects?.length ?? 0) > 0 && (
							<Command.Group heading="Projects">
								{projectsData!.projects.map((p) => (
									<Command.Item
										key={p.id}
										value={p.name}
										onSelect={() => go(`/projects/${p.id}`)}
										className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer text-sm"
										style={{ color: "var(--color-text-secondary)" }}
									>
										<FolderOpen size={14} />
										{p.name}
									</Command.Item>
								))}
							</Command.Group>
						)}
					</Command.List>
				</Command>
			</div>
		</div>
	);
}
