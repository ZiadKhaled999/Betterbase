import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

export function SetupGuard({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const [checking, setChecking] = useState(true);

	useEffect(() => {
		// Try hitting /admin/auth/setup without a token.
		// If setup is complete, login page is appropriate.
		// If setup is not done, /admin/auth/setup returns 201, not 410.
		fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/admin/auth/setup`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ _check: true }), // Will fail validation but we only care about 410
		})
			.then((res) => {
				if (res.status === 410) {
					// Setup complete — redirect to login
					navigate("/login", { replace: true });
				}
				setChecking(false);
			})
			.catch(() => setChecking(false));
	}, [navigate]);

	if (checking) return null;
	return <>{children}</>;
}
