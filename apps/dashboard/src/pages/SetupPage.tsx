import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, setStoredAdmin, setToken } from "@/lib/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
	email: z.string().email(),
	password: z.string().min(8, "Minimum 8 characters"),
});
type FormData = z.infer<typeof schema>;

export default function SetupPage() {
	const navigate = useNavigate();
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<FormData>({ resolver: zodResolver(schema) });

	const mutation = useMutation({
		mutationFn: (data: FormData) =>
			api.postPublic<{ token: string; admin: { id: string; email: string } }>(
				"/admin/auth/setup",
				data,
			),
		onSuccess: ({ token, admin }) => {
			setToken(token);
			setStoredAdmin(admin);
			toast.success("Admin account created. Welcome to Betterbase.");
			navigate("/", { replace: true });
		},
		onError: (err: any) => toast.error(err.message),
	});

	return (
		<div
			className="min-h-screen flex items-center justify-center p-4"
			style={{ background: "var(--color-background)" }}
		>
			<div className="w-full max-w-sm space-y-6">
				<div>
					<div
						className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold mb-6"
						style={{ background: "var(--color-brand)" }}
					>
						B
					</div>
					<h1 className="text-2xl font-semibold" style={{ color: "var(--color-text-primary)" }}>
						Setup Betterbase
					</h1>
					<p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
						Create the first admin account to get started.
					</p>
				</div>
				<form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
					<div className="space-y-1.5">
						<Label>Email</Label>
						<Input {...register("email")} type="email" placeholder="admin@example.com" />
						{errors.email && (
							<p className="text-xs" style={{ color: "var(--color-danger)" }}>
								{errors.email.message}
							</p>
						)}
					</div>
					<div className="space-y-1.5">
						<Label>Password</Label>
						<Input {...register("password")} type="password" placeholder="Min. 8 characters" />
						{errors.password && (
							<p className="text-xs" style={{ color: "var(--color-danger)" }}>
								{errors.password.message}
							</p>
						)}
					</div>
					<Button type="submit" className="w-full" disabled={mutation.isPending}>
						{mutation.isPending ? "Creating..." : "Create admin account"}
					</Button>
				</form>
			</div>
		</div>
	);
}
