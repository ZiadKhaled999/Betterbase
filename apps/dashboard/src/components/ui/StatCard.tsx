import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
	label: string;
	value: string | number;
	icon?: LucideIcon;
	trend?: { value: number; period: string };
	color?: "default" | "success" | "warning" | "danger" | "brand";
}

const colorMap = {
	default: { icon: "var(--color-text-muted)", bg: "var(--color-surface-overlay)" },
	brand: { icon: "var(--color-brand)", bg: "var(--color-brand-muted)" },
	success: { icon: "var(--color-success)", bg: "var(--color-success-muted)" },
	warning: { icon: "var(--color-warning)", bg: "var(--color-warning-muted)" },
	danger: { icon: "var(--color-danger)", bg: "var(--color-danger-muted)" },
};

export function StatCard({ label, value, icon: Icon, trend, color = "default" }: StatCardProps) {
	const colors = colorMap[color];
	return (
		<div
			className="rounded-xl p-5 flex flex-col gap-3"
			style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
		>
			<div className="flex items-center justify-between">
				<span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
					{label}
				</span>
				{Icon && (
					<div
						className="w-8 h-8 rounded-lg flex items-center justify-center"
						style={{ background: colors.bg }}
					>
						<Icon size={14} style={{ color: colors.icon }} />
					</div>
				)}
			</div>
			<div className="text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
				{value}
			</div>
			{trend && (
				<div
					className="text-xs"
					style={{ color: trend.value >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
				>
					{trend.value >= 0 ? "+" : ""}
					{trend.value}% vs {trend.period}
				</div>
			)}
		</div>
	);
}
