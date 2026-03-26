export function PageSkeleton() {
	return (
		<div className="p-8 space-y-6 animate-pulse">
			<div
				className="h-8 w-64 rounded-lg"
				style={{ background: "var(--color-surface-elevated)" }}
			/>
			<div className="grid grid-cols-4 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={i}
						className="h-28 rounded-xl"
						style={{ background: "var(--color-surface-elevated)" }}
					/>
				))}
			</div>
			<div className="h-64 rounded-xl" style={{ background: "var(--color-surface-elevated)" }} />
		</div>
	);
}
