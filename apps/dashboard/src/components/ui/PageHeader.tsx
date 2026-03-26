interface PageHeaderProps {
	title: string;
	description?: string;
	action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
	return (
		<div className="flex items-start justify-between px-8 pt-8 pb-6">
			<div>
				<h1 className="text-xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
					{title}
				</h1>
				{description && (
					<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
						{description}
					</p>
				)}
			</div>
			{action && <div>{action}</div>}
		</div>
	);
}
