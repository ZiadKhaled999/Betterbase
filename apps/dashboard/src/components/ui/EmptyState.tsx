import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description: string;
	action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-20 gap-4">
			<div
				className="w-14 h-14 rounded-2xl flex items-center justify-center"
				style={{
					background: "var(--color-surface-elevated)",
					border: "1px solid var(--color-border)",
				}}
			>
				<Icon size={24} style={{ color: "var(--color-text-muted)" }} />
			</div>
			<div className="text-center">
				<p className="font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
					{title}
				</p>
				<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
					{description}
				</p>
			</div>
			{action && <div className="mt-2">{action}</div>}
		</div>
	);
}
