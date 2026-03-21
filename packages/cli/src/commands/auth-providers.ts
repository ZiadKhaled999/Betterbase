/**
 * OAuth Provider Templates for BetterAuth
 *
 * This module contains templates for configuring social OAuth providers
 * with BetterAuth. Each template includes the necessary configuration code,
 * environment variables, and setup instructions.
 */

export type ProviderTemplate = {
	name: string;
	displayName: string;
	envVars: { key: string; description: string }[];
	configCode: string;
	setupInstructions: string;
	docsUrl: string;
};

export const PROVIDER_TEMPLATES: Record<string, ProviderTemplate> = {
	google: {
		name: "google",
		displayName: "Google",
		envVars: [
			{ key: "GOOGLE_CLIENT_ID", description: "OAuth Client ID" },
			{ key: "GOOGLE_CLIENT_SECRET", description: "OAuth Client Secret" },
		],
		configCode: `    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/google',
    },`,
		setupInstructions: `
1. Go to: https://console.cloud.google.com/
2. Create new project or select existing
3. APIs & Services > Credentials
4. Create OAuth 2.0 Client ID
5. Add redirect: \${process.env.AUTH_URL || 'http://localhost:3000'}/api/auth/callback/google
6. Copy Client ID and Secret to .env
`,
		docsUrl: "https://developers.google.com/identity/protocols/oauth2",
	},

	github: {
		name: "github",
		displayName: "GitHub",
		envVars: [
			{ key: "GITHUB_CLIENT_ID", description: "OAuth App Client ID" },
			{ key: "GITHUB_CLIENT_SECRET", description: "OAuth App Client Secret" },
		],
		configCode: `    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/github',
    },`,
		setupInstructions: `
1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Homepage: \${process.env.AUTH_URL || 'http://localhost:3000'}
4. Callback: \${process.env.AUTH_URL || 'http://localhost:3000'}/api/auth/callback/github
5. Copy Client ID and Secret to .env
`,
		docsUrl: "https://docs.github.com/en/developers/apps",
	},

	discord: {
		name: "discord",
		displayName: "Discord",
		envVars: [
			{ key: "DISCORD_CLIENT_ID", description: "OAuth2 Client ID" },
			{ key: "DISCORD_CLIENT_SECRET", description: "OAuth2 Client Secret" },
		],
		configCode: `    discord: {
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/discord',
    },`,
		setupInstructions: `
1. Go to: https://discord.com/developers/applications
2. Click "New Application"
3. Go to OAuth2 > General
4. Add redirect: \${process.env.AUTH_URL || 'http://localhost:3000'}/api/auth/callback/discord
5. Copy Client ID and Secret to .env
`,
		docsUrl: "https://discord.com/developers/docs/topics/oauth2",
	},

	apple: {
		name: "apple",
		displayName: "Apple",
		envVars: [
			{ key: "APPLE_CLIENT_ID", description: "Services ID" },
			{ key: "APPLE_CLIENT_SECRET", description: "Apple Client Secret (generated)" },
			{ key: "APPLE_TEAM_ID", description: "Apple Team ID" },
			{ key: "APPLE_KEY_ID", description: "Apple Key ID" },
		],
		configCode: `    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/apple',
      teamId: process.env.APPLE_TEAM_ID!,
      keyId: process.env.APPLE_KEY_ID!,
    },`,
		setupInstructions: `
1. Go to: https://developer.apple.com/account/
2. Create a new Services ID
3. Configure Sign in with Apple
4. Add return URL: \${process.env.AUTH_URL || 'http://localhost:3000'}/api/auth/callback/apple
5. Create a private key in Keys section
6. Copy Services ID, Team ID, Key ID, and generated Client Secret to .env
`,
		docsUrl: "https://developer.apple.com/sign-in-with-apple/",
	},

	microsoft: {
		name: "microsoft",
		displayName: "Microsoft",
		envVars: [
			{ key: "MICROSOFT_CLIENT_ID", description: "Application (client) ID" },
			{ key: "MICROSOFT_CLIENT_SECRET", description: "Client Secret" },
			{ key: "MICROSOFT_TENANT_ID", description: "Tenant ID (optional, defaults to common)" },
		],
		configCode: `    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID!,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/microsoft',
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
    },`,
		setupInstructions: `
1. Go to: https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps
2. Click "New registration"
3. Add redirect URI: \${process.env.AUTH_URL || 'http://localhost:3000'}/api/auth/callback/microsoft
4. Go to Certificates & secrets
5. Create new client secret
6. Copy Application ID and Secret to .env
`,
		docsUrl: "https://docs.microsoft.com/en-us/azure/active-directory/develop/",
	},

	twitter: {
		name: "twitter",
		displayName: "Twitter",
		envVars: [
			{ key: "TWITTER_CLIENT_ID", description: "OAuth 2.0 Client ID" },
			{ key: "TWITTER_CLIENT_SECRET", description: "OAuth 2.0 Client Secret" },
		],
		configCode: `    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/twitter',
    },`,
		setupInstructions: `
1. Go to: https://developer.twitter.com/en/portal/dashboard
2. Create a new project and app
3. Set up OAuth 2.0
4. Add redirect: \${process.env.AUTH_URL || 'http://localhost:3000'}/api/auth/callback/twitter
5. Copy Client ID and Secret to .env
`,
		docsUrl: "https://developer.twitter.com/en/docs/twitter-api",
	},

	facebook: {
		name: "facebook",
		displayName: "Facebook",
		envVars: [
			{ key: "FACEBOOK_CLIENT_ID", description: "App ID" },
			{ key: "FACEBOOK_CLIENT_SECRET", description: "App Secret" },
		],
		configCode: `    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID!,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/facebook',
    },`,
		setupInstructions: `
1. Go to: https://developers.facebook.com/apps/
2. Create a new app
3. Add Facebook Login product
4. Go to Settings > Facebook Login
5. Add redirect URI: \${process.env.AUTH_URL || 'http://localhost:3000'}/api/auth/callback/facebook
6. Copy App ID and Secret to .env
`,
		docsUrl: "https://developers.facebook.com/docs/facebook-login/",
	},
};

/**
 * Get a provider template by name (case-insensitive)
 */
export function getProviderTemplate(name: string): ProviderTemplate | null {
	return PROVIDER_TEMPLATES[name.toLowerCase()] || null;
}

/**
 * Get a list of all available provider names
 */
export function getAvailableProviders(): string[] {
	return Object.keys(PROVIDER_TEMPLATES);
}
