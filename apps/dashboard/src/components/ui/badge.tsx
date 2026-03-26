import { cn } from "@/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";
import type * as React from "react";

const badgeVariants = cva(
	"inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]",
	{
		variants: {
			variant: {
				default: "border-transparent bg-[var(--color-brand)] text-white",
				secondary:
					"border-transparent bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)]",
				success: "border-transparent bg-[var(--color-success-muted)] text-[var(--color-success)]",
				warning: "border-transparent bg-[var(--color-warning-muted)] text-[var(--color-warning)]",
				destructive: "border-transparent bg-[var(--color-danger-muted)] text-[var(--color-danger)]",
				outline: "border-[var(--color-border)] text-[var(--color-text-secondary)]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
