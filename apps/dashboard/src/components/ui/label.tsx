import { cn } from "@/lib/utils";
import * as React from "react";

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
	<label
		ref={ref}
		className={cn("text-xs font-medium leading-none text-[var(--color-text-secondary)]", className)}
		{...props}
	/>
));
Label.displayName = "Label";

export { Label };
