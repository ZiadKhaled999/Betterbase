import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createBrowserRouter } from "react-router";
import { Toaster } from "sonner";
import { routes } from "./routes";
import "./index.css";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			gcTime: 5 * 60 * 1000,
			retry: (failureCount, error: any) => {
				if (error?.status === 401 || error?.status === 404) return false;
				return failureCount < 2;
			},
		},
	},
});

const router = createBrowserRouter(routes);

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<ErrorBoundary>
			<QueryClientProvider client={queryClient}>
				<TooltipProvider>
					<RouterProvider router={router} />
					<Toaster
						position="bottom-right"
						toastOptions={{
							style: {
								background: "var(--color-surface-elevated)",
								border: "1px solid var(--color-border)",
								color: "var(--color-text-primary)",
							},
						}}
					/>
					{import.meta.env.DEV && <ReactQueryDevtools />}
				</TooltipProvider>
			</QueryClientProvider>
		</ErrorBoundary>
	</React.StrictMode>,
);
