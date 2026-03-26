import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

interface Props {
	children: ReactNode;
	fallback?: ReactNode;
}

interface State {
	error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error: Error) {
		return { error };
	}

	render() {
		if (this.state.error) {
			return (
				this.props.fallback ?? (
					<div className="flex flex-col items-center justify-center py-20 gap-4">
						<AlertTriangle size={32} style={{ color: "var(--color-warning)" }} />
						<div className="text-center">
							<p className="font-medium mb-1" style={{ color: "var(--color-text-primary)" }}>
								Something went wrong
							</p>
							<p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
								{this.state.error.message}
							</p>
						</div>
						<Button variant="outline" onClick={() => this.setState({ error: null })}>
							Try again
						</Button>
					</div>
				)
			);
		}
		return this.props.children;
	}
}
