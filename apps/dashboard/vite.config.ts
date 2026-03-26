import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": path.resolve(__dirname, "./src") },
	},
	define: {
		"import.meta.env.VITE_API_URL": JSON.stringify(
			process.env.VITE_API_URL ?? "http://localhost:3001",
		),
	},
});
