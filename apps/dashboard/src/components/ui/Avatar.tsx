interface AvatarProps {
	email: string;
	size?: number;
}

export function Avatar({ email, size = 32 }: AvatarProps) {
	const initials = email.slice(0, 2).toUpperCase();
	const hue = Array.from(email).reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
	return (
		<div
			className="rounded-full flex items-center justify-center font-medium text-white shrink-0"
			style={{
				width: size,
				height: size,
				fontSize: size * 0.35,
				background: `hsl(${hue}, 55%, 45%)`,
			}}
		>
			{initials}
		</div>
	);
}
