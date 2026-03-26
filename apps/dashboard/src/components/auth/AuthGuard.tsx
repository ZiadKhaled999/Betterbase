import { getToken } from "@/lib/api";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export function AuthGuard({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();

	useEffect(() => {
		if (!getToken()) {
			navigate("/login", { replace: true });
		}
	}, [navigate]);

	if (!getToken()) return null;
	return <>{children}</>;
}
