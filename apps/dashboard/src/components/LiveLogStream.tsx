import { Button } from "@/components/ui/button";
import { useLogStream } from "@/hooks/useLogStream";
import { Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LiveLogStreamProps {
	projectId?: string;
	maxRows?: number;
	autoScroll?: boolean;
}

function getStatusColor(status: number): string {
	if (status >= 200 && status < 300) return "text-green-500";
	if (status >= 400 && status < 500) return "text-amber-500";
	if (status >= 500) return "text-red-500";
	return "text-gray-500";
}

function formatTime(timestamp: string): string {
	return new Date(timestamp).toLocaleTimeString();
}

export function LiveLogStream({ projectId, maxRows = 200, autoScroll = true }: LiveLogStreamProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [userScrolledUp, setUserScrolledUp] = useState(false);
	const { logs, isPolling, pause, resume, clear } = useLogStream({
		projectId,
		maxRows,
		enabled: true,
		pollIntervalMs: 3000,
	});

	// Auto-scroll to top when new logs come in
	useEffect(() => {
		if (autoScroll && !userScrolledUp && containerRef.current) {
			containerRef.current.scrollTop = 0;
		}
	}, [logs, autoScroll, userScrolledUp]);

	// Handle scroll to detect if user scrolled up
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const { scrollTop } = e.currentTarget;
		// If user scrolls up (not at top), pause auto-scroll
		if (scrollTop > 10) {
			setUserScrolledUp(true);
		} else {
			setUserScrolledUp(false);
		}
	};

	return (
		<div
			className="rounded-lg overflow-hidden"
			style={{
				background: "var(--color-surface)",
				border: "1px solid var(--color-border)",
			}}
		>
			{/* Controls */}
			<div
				className="flex items-center justify-between px-4 py-2 border-b"
				style={{ borderColor: "var(--color-border)" }}
			>
				<div className="flex items-center gap-2">
					{isPolling ? (
						<div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
					) : (
						<div className="w-2 h-2 rounded-full bg-gray-400" />
					)}
					<span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
						{logs.length} entries
					</span>
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={isPolling ? pause : resume}
						title={isPolling ? "Pause" : "Resume"}
					>
						{isPolling ? <Pause size={14} /> : <Play size={14} />}
					</Button>
					<Button variant="ghost" size="icon" onClick={clear} title="Clear">
						<Trash2 size={14} />
					</Button>
				</div>
			</div>

			{/* Log table */}
			<div ref={containerRef} onScroll={handleScroll} className="overflow-auto max-h-96">
				{logs.length === 0 ? (
					<div
						className="flex items-center justify-center py-8 gap-2"
						style={{ color: "var(--color-text-muted)" }}
					>
						<div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
						<span>Waiting for requests...</span>
					</div>
				) : (
					<table className="w-full text-sm">
						<thead className="sticky top-0" style={{ background: "var(--color-surface)" }}>
							<tr className="text-left text-xs" style={{ color: "var(--color-text-muted)" }}>
								<th className="px-4 py-2 font-medium">Time</th>
								<th className="px-4 py-2 font-medium">Method</th>
								<th className="px-4 py-2 font-medium">Path</th>
								<th className="px-4 py-2 font-medium">Status</th>
								<th className="px-4 py-2 font-medium">Duration</th>
								{!projectId && <th className="px-4 py-2 font-medium">Project</th>}
							</tr>
						</thead>
						<tbody>
							{logs.map((log, i) => (
								<tr
									key={log.id ?? i}
									className="border-t"
									style={{ borderColor: "var(--color-border)" }}
								>
									<td className="px-4 py-1.5 text-xs" style={{ color: "var(--color-text-muted)" }}>
										{formatTime(log.created_at)}
									</td>
									<td className="px-4 py-1.5">
										<span
											className="px-1.5 py-0.5 rounded text-xs font-medium"
											style={{
												background: "var(--color-brand-muted)",
												color: "var(--color-brand)",
											}}
										>
											{log.method}
										</span>
									</td>
									<td
										className="px-4 py-1.5 font-mono text-xs"
										style={{ color: "var(--color-text-secondary)" }}
									>
										{log.path}
									</td>
									<td className={`px-4 py-1.5 font-medium ${getStatusColor(log.status)}`}>
										{log.status}
									</td>
									<td className="px-4 py-1.5" style={{ color: "var(--color-text-secondary)" }}>
										{log.duration_ms}ms
									</td>
									{!projectId && (
										<td
											className="px-4 py-1.5 text-xs"
											style={{ color: "var(--color-text-muted)" }}
										>
											{log.project_id ? (
												<span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
													{log.project_id.slice(0, 8)}
												</span>
											) : (
												"-"
											)}
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
