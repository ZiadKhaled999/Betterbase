import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

interface ConfirmDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel?: string;
	confirmValue?: string; // If set, user must type this exact string
	variant?: "danger" | "warning";
	onConfirm: () => void;
	loading?: boolean;
}

export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel = "Confirm",
	confirmValue,
	variant = "danger",
	onConfirm,
	loading,
}: ConfirmDialogProps) {
	const [typed, setTyped] = useState("");
	const canConfirm = confirmValue ? typed === confirmValue : true;

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent
				style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
			>
				<AlertDialogHeader>
					<AlertDialogTitle style={{ color: "var(--color-text-primary)" }}>
						{title}
					</AlertDialogTitle>
					<AlertDialogDescription style={{ color: "var(--color-text-secondary)" }}>
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				{confirmValue && (
					<div className="py-2">
						<p className="text-sm mb-2" style={{ color: "var(--color-text-secondary)" }}>
							Type <strong style={{ color: "var(--color-text-primary)" }}>{confirmValue}</strong> to
							confirm:
						</p>
						<Input
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							placeholder={confirmValue}
						/>
					</div>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<Button
						onClick={onConfirm}
						disabled={!canConfirm || loading}
						style={{
							background: variant === "danger" ? "var(--color-danger)" : "var(--color-warning)",
						}}
					>
						{loading ? "..." : confirmLabel}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
