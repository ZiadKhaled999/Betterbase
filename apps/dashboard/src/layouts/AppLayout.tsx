import { CommandPalette } from "@/components/CommandPalette";
import { Avatar } from "@/components/ui/Avatar";
import { useTheme } from "@/hooks/useTheme";
import { clearToken, getStoredAdmin } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
	Bell,
	ChevronDown,
	ChevronRight,
	Command,
	Database,
	FolderOpen,
	HardDrive,
	LayoutDashboard,
	LogOut,
	Moon,
	ScrollText,
	Settings,
	Shield,
	Sun,
	Users,
	Webhook,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";

const nav = [
	{ label: "Overview", href: "/", icon: LayoutDashboard },
	{ label: "Projects", href: "/projects", icon: FolderOpen },
	{ label: "Storage", href: "/storage", icon: HardDrive },
	{ label: "Logs", href: "/logs", icon: ScrollText },
	{ label: "Audit Log", href: "/audit", icon: Shield },
	{ label: "Team", href: "/team", icon: Users },
	{
		label: "Settings",
		href: "/settings",
		icon: Settings,
		children: [
			{ label: "General", href: "/settings" },
			{ label: "SMTP", href: "/settings/smtp" },
			{ label: "Notifications", href: "/settings/notifications" },
			{ label: "API Keys", href: "/settings/api-keys" },
		],
	},
];

export function AppLayout() {
	const [cmdOpen, setCmdOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const { theme, toggle } = useTheme();
	const navigate = useNavigate();
	const admin = getStoredAdmin();

	function handleLogout() {
		clearToken();
		navigate("/login");
	}

	// Global ⌘K
	if (typeof window !== "undefined") {
		window.onkeydown = (e) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setCmdOpen(true);
			}
		};
	}

	return (
		<div
			className="flex h-screen overflow-hidden"
			style={{ background: "var(--color-background)" }}
		>
			{/* Sidebar */}
			<aside
				className="flex flex-col w-60 shrink-0"
				style={{ background: "var(--color-surface)", borderRight: "1px solid var(--color-border)" }}
			>
				{/* Logo */}
				<div
					className="flex items-center gap-2.5 px-5 h-14 border-b"
					style={{ borderColor: "var(--color-border)" }}
				>
					<div
						className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
						style={{ background: "var(--color-brand)" }}
					>
						B
					</div>
					<span className="font-semibold text-sm" style={{ color: "var(--color-text-primary)" }}>
						Betterbase
					</span>
				</div>

				{/* Nav */}
				<nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
					{nav.map((item) => {
						if (item.children) {
							return (
								<div key={item.label}>
									<button
										onClick={() => setSettingsOpen((o) => !o)}
										className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors"
										style={{ color: "var(--color-text-secondary)" }}
									>
										<item.icon size={15} />
										<span className="flex-1 text-left">{item.label}</span>
										{settingsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
									</button>
									<AnimatePresence>
										{settingsOpen && (
											<motion.div
												initial={{ height: 0, opacity: 0 }}
												animate={{ height: "auto", opacity: 1 }}
												exit={{ height: 0, opacity: 0 }}
												transition={{ duration: 0.15 }}
												className="overflow-hidden pl-5"
											>
												{item.children.map((child) => (
													<NavLink
														key={child.href}
														to={child.href}
														end={child.href === "/settings"}
														className={({ isActive }) =>
															cn(
																"flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors",
																isActive ? "font-medium" : "opacity-70 hover:opacity-100",
															)
														}
														style={({ isActive }) => ({
															color: isActive
																? "var(--color-brand)"
																: "var(--color-text-secondary)",
														})}
													>
														{child.label}
													</NavLink>
												))}
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							);
						}

						return (
							<NavLink
								key={item.href}
								to={item.href}
								end={item.href === "/"}
								className={({ isActive }) =>
									cn(
										"flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
										isActive ? "font-medium" : "hover:opacity-80",
									)
								}
								style={({ isActive }) => ({
									background: isActive ? "var(--color-brand-muted)" : "transparent",
									color: isActive ? "var(--color-brand)" : "var(--color-text-secondary)",
								})}
							>
								<item.icon size={15} />
								{item.label}
							</NavLink>
						);
					})}
				</nav>

				{/* Bottom bar */}
				<div
					className="px-3 py-3 border-t space-y-1"
					style={{ borderColor: "var(--color-border)" }}
				>
					{/* ⌘K button */}
					<button
						onClick={() => setCmdOpen(true)}
						className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
						style={{ color: "var(--color-text-muted)" }}
					>
						<Command size={13} />
						<span className="flex-1 text-left">Command</span>
						<kbd
							className="text-xs px-1.5 py-0.5 rounded"
							style={{
								background: "var(--color-surface-overlay)",
								color: "var(--color-text-muted)",
							}}
						>
							⌘K
						</kbd>
					</button>

					{/* Theme toggle */}
					<button
						onClick={toggle}
						className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm transition-colors hover:opacity-80"
						style={{ color: "var(--color-text-muted)" }}
					>
						{theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
						{theme === "dark" ? "Light mode" : "Dark mode"}
					</button>

					{/* Admin info */}
					<div className="flex items-center gap-2 px-3 py-2">
						<Avatar email={admin?.email ?? ""} size={24} />
						<span
							className="text-xs flex-1 truncate"
							style={{ color: "var(--color-text-secondary)" }}
						>
							{admin?.email}
						</span>
						<button onClick={handleLogout} className="hover:opacity-80 transition-opacity">
							<LogOut size={13} style={{ color: "var(--color-text-muted)" }} />
						</button>
					</div>
				</div>
			</aside>

			{/* Main */}
			<main className="flex-1 overflow-y-auto">
				<Outlet />
			</main>

			<CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
		</div>
	);
}
