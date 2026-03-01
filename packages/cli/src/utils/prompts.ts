import inquirer from "inquirer";
import { z } from "zod";

const textOptionsSchema = z.object({
	message: z.string().min(1),
	initial: z.string().optional(),
});

const confirmOptionsSchema = z.object({
	message: z.string().min(1),
	// Support both 'default' (new API) and 'initial' (backward compatibility)
	default: z.boolean().optional(),
	initial: z.boolean().optional(),
});

const selectOptionSchema = z.object({
	value: z.string().min(1),
	label: z.string().min(1),
});

const selectOptionsSchema = z
	.object({
		message: z.string().min(1),
		options: z.array(selectOptionSchema).min(1),
		// Support both 'default' (new API) and 'initial' (backward compatibility)
		default: z.string().optional(),
		initial: z.string().optional(),
	})
	.refine(
		({ options, default: defaultValue, initial }) => {
			const effectiveDefault = defaultValue ?? initial;
			return (
				effectiveDefault === undefined ||
				options.some((option) => option.value === effectiveDefault)
			);
		},
		{
			message: "Select default value must match one of the option values.",
			path: ["default"],
		},
	);

/**
 * Prompt for text input.
 */
export async function text(options: {
	message: string;
	initial?: string;
}): Promise<string> {
	const parsed = textOptionsSchema.parse(options);

	const response = await inquirer.prompt<{ value: string }>([
		{
			type: "input",
			name: "value",
			message: parsed.message,
			default: parsed.initial,
		},
	]);

	return response.value;
}

/**
 * Prompt for yes/no confirmation.
 */
export async function confirm(options: {
	message: string;
	default?: boolean;
	initial?: boolean;
}): Promise<boolean> {
	const parsed = confirmOptionsSchema.parse(options);

	// Support both 'default' (new API) and 'initial' (backward compatibility)
	const effectiveDefault = parsed.default ?? parsed.initial;

	const response = await inquirer.prompt<{ value: boolean }>([
		{
			type: "confirm",
			name: "value",
			message: parsed.message,
			default: effectiveDefault,
		},
	]);

	return response.value;
}

/**
 * Prompt for selecting one option.
 */
export async function select(options: {
	message: string;
	options: Array<{ value: string; label: string }>;
	default?: string;
	initial?: string;
}): Promise<string> {
	const parsed = selectOptionsSchema.parse(options);

	// Support both 'default' (new API) and 'initial' (backward compatibility)
	const effectiveDefault = parsed.default ?? parsed.initial;

	const response = await inquirer.prompt<{ value: string }>([
		{
			type: "list",
			name: "value",
			message: parsed.message,
			choices: parsed.options.map((opt) => ({
				name: opt.label,
				value: opt.value,
			})),
			default: effectiveDefault,
		},
	]);

	return response.value;
}
