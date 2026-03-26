import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function useTheme() {
	const [theme, setTheme] = useState<Theme>(() => {
		return (localStorage.getItem("bb_theme") as Theme) ?? "dark";
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		localStorage.setItem("bb_theme", theme);
	}, [theme]);

	return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}
