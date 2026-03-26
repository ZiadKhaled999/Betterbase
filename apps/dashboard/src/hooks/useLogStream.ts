import { api } from "@/lib/api";
import { useCallback, useEffect, useRef, useState } from "react";

interface LogEntry {
	id: string;
	method: string;
	path: string;
	status: number;
	duration_ms: number;
	project_id?: string;
	ip?: string;
	user_agent?: string;
	created_at: string;
}

interface UseLogStreamOptions {
	projectId?: string;
	maxRows?: number;
	enabled?: boolean;
	pollIntervalMs?: number;
}

interface UseLogStreamResult {
	logs: LogEntry[];
	isPolling: boolean;
	pause: () => void;
	resume: () => void;
	clear: () => void;
}

export function useLogStream(opts: UseLogStreamOptions): UseLogStreamResult {
	const { projectId, maxRows = 200, enabled = true, pollIntervalMs = 3000 } = opts;

	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isPolling, setIsPolling] = useState(true);
	const nextSinceRef = useRef<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const isPausedRef = useRef(false);

	const fetchLogs = useCallback(async () => {
		if (isPausedRef.current) return;

		try {
			const url = projectId
				? `/admin/logs/stream?project_id=${projectId}&limit=100`
				: `/admin/logs/stream?limit=100`;

			const params = nextSinceRef.value ? `&since=${encodeURIComponent(nextSinceRef.value)}` : "";
			const fullUrl = params ? `${url}${params}` : url;

			const response = await api.get<{ logs: LogEntry[]; next_since: string }>(fullUrl);

			if (response.logs && response.logs.length > 0) {
				setLogs((prev) => {
					const newLogs = [...response.logs, ...prev];
					// Ring buffer - keep only maxRows
					return newLogs.slice(0, maxRows);
				});
				nextSinceRef.current = response.next_since;
			}
		} catch (error) {
			// Silently ignore errors - polling continues
		}
	}, [projectId, maxRows]);

	const startPolling = useCallback(() => {
		if (intervalRef.current) return;

		// Initial fetch
		fetchLogs();

		// Set up interval
		intervalRef.current = setInterval(fetchLogs, pollIntervalMs);
		setIsPolling(true);
	}, [fetchLogs, pollIntervalMs]);

	const stopPolling = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setIsPolling(false);
	}, []);

	const pause = useCallback(() => {
		isPausedRef.current = true;
	}, []);

	const resume = useCallback(() => {
		isPausedRef.current = false;
		fetchLogs();
	}, [fetchLogs]);

	const clear = useCallback(() => {
		setLogs([]);
		nextSinceRef.current = null;
	}, []);

	// Start/stop polling based on enabled
	useEffect(() => {
		if (enabled) {
			startPolling();
		} else {
			stopPolling();
		}

		return () => {
			stopPolling();
		};
	}, [enabled, startPolling, stopPolling]);

	return { logs, isPolling, pause, resume, clear };
}
