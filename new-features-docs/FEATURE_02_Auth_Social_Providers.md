# Feature 2: Auth Social Providers Setup

**Priority**: Medium (Week 8-9)  
**Complexity**: Low  
**Dependencies**: None (uses existing BetterAuth)  
**Estimated Effort**: 2 weeks

---

## Problem Statement

BetterAuth supports OAuth providers (Google, GitHub, Discord, etc.) but requires manual configuration:
1. Read BetterAuth documentation
2. Create OAuth apps on provider platforms
3. Manually edit `src/auth/index.ts`
4. Set environment variables
5. Hope you didn't make a typo

**This is error-prone and time-consuming.**

---

## Solution

CLI command `bb auth add-provider <name>` that:
- Auto-generates BetterAuth configuration
- Adds environment variables to `.env`
- Prints OAuth app setup instructions
- Validates provider name

---

## Implementation Steps

### Step 1: Create Provider Templates

**File**: `packages/cli/src/commands/auth-providers.ts` (NEW FILE)

```typescript
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
    name: 'google',
    displayName: 'Google',
    envVars: [
      { key: 'GOOGLE_CLIENT_ID', description: 'OAuth Client ID' },
      { key: 'GOOGLE_CLIENT_SECRET', description: 'OAuth Client Secret' },
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
5. Add redirect: http://localhost:3000/api/auth/callback/google
6. Copy Client ID and Secret to .env
`,
    docsUrl: 'https://developers.google.com/identity/protocols/oauth2',
  },

  github: {
    name: 'github',
    displayName: 'GitHub',
    envVars: [
      { key: 'GITHUB_CLIENT_ID', description: 'OAuth App Client ID' },
      { key: 'GITHUB_CLIENT_SECRET', description: 'OAuth App Client Secret' },
    ],
    configCode: `    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      redirectURI: process.env.AUTH_URL + '/api/auth/callback/github',
    },`,
    setupInstructions: `
1. Go to: https://github.com/settings/developers
2. Click "New OAuth App"
3. Homepage: http://localhost:3000
4. Callback: http://localhost:3000/api/auth/callback/github
5. Copy Client ID and Secret to .env
`,
    docsUrl: 'https://docs.github.com/en/developers/apps',
  },

  // Add discord, apple, microsoft, twitter, facebook similarly
};

export function getProviderTemplate(name: string): ProviderTemplate | null {
  return PROVIDER_TEMPLATES[name.toLowerCase()] || null;
}

export function getAvailableProviders(): string[] {
  return Object.keys(PROVIDER_TEMPLATES);
}
```

---

### Step 2: Create Add Provider Command

**File**: `packages/cli/src/commands/auth.ts`

**ADD** this function:

```typescript
import { getProviderTemplate, getAvailableProviders } from './auth-providers';
import { promises as fs } from 'fs';
import path from 'path';

export async function runAuthAddProviderCommand(
  projectRoot: string,
  providerName: string
): Promise<void> {
  const template = getProviderTemplate(providerName);
  
  if (!template) {
    logger.error(`Unknown provider: ${providerName}`);
    logger.info(`Available: ${getAvailableProviders().join(', ')}`);
    process.exit(1);
  }

  logger.info(`Adding ${template.displayName} OAuth provider...`);

  // Check if auth file exists
  const authFile = path.join(projectRoot, 'src', 'auth', 'index.ts');
  let authContent = await fs.readFile(authFile, 'utf-8');

  // Check if provider already configured
  if (authContent.includes(`${template.name}:`)) {
    logger.warn(`${template.displayName} already configured`);
    return;
  }

  // Find socialProviders section
  const socialRegex = /socialProviders:\s*{([^}]*)}/s;
  const match = authContent.match(socialRegex);

  if (match) {
    // Add to existing socialProviders
    const existing = match[1];
    const newContent = existing.trim() 
      ? `${existing.trimEnd()},\n${template.configCode}`
      : template.configCode;
    
    authContent = authContent.replace(
      socialRegex,
      `socialProviders: {\n${newContent}\n  }`
    );
  } else {
    // Create socialProviders section
    authContent = authContent.replace(
      /betterAuth\(\s*{/,
      `betterAuth({\n  socialProviders: {\n${template.configCode}\n  },`
    );
  }

  // Write updated file
  await fs.writeFile(authFile, authContent, 'utf-8');
  logger.success(`✅ Added ${template.displayName} to ${authFile}`);

  // Add env vars
  const envFile = path.join(projectRoot, '.env');
  let envContent = '';
  try {
    envContent = await fs.readFile(envFile, 'utf-8');
  } catch {}

  const envVarsToAdd: string[] = [];
  for (const envVar of template.envVars) {
    if (!envContent.includes(envVar.key)) {
      envVarsToAdd.push(`${envVar.key}=""`);
    }
  }

  if (envVarsToAdd.length > 0) {
    const newEnv = envContent.trim()
      ? `${envContent}\n\n# ${template.displayName} OAuth\n${envVarsToAdd.join('\n')}\n`
      : `# ${template.displayName} OAuth\n${envVarsToAdd.join('\n')}\n`;
    
    await fs.writeFile(envFile, newEnv, 'utf-8');
    logger.success(`✅ Added env vars to .env`);
  }

  // Print setup instructions
  console.log('\n' + '='.repeat(60));
  console.log(template.setupInstructions);
  console.log('='.repeat(60));
  console.log(`\nDocs: ${template.docsUrl}\n`);
}
```

---

### Step 3: Register CLI Command

**File**: `packages/cli/src/index.ts`

```typescript
import { runAuthAddProviderCommand } from './commands/auth';

program
  .command('auth:add-provider <provider>')
  .description('Add OAuth provider (google, github, discord, apple, microsoft, twitter, facebook)')
  .action(async (provider: string) => {
    await runAuthAddProviderCommand(process.cwd(), provider);
  });
```

---

## Testing

```bash
# Test adding Google
bb auth:add-provider google

# Verify config added
cat src/auth/index.ts | grep "google:"

# Verify env vars added
cat .env | grep GOOGLE

# Test duplicate detection
bb auth:add-provider google
# Should warn "already configured"

# Test invalid provider
bb auth:add-provider invalid
# Should show available providers
```

---

## Acceptance Criteria

- [ ] Provider templates for Google, GitHub, Discord, Apple, Microsoft, Twitter, Facebook
- [ ] `bb auth:add-provider <name>` command works
- [ ] Auto-injects config into src/auth/index.ts
- [ ] Adds env vars to .env
- [ ] Prints setup instructions
- [ ] Detects if provider already configured
- [ ] Shows available providers if invalid name

---

**Priority Order** (implement in this order):
1. Google (most used)
2. GitHub (dev tools)
3. Discord (gaming/community)
4. Apple (iOS requirement)
5. Microsoft (enterprise)
6. Twitter (social apps)
7. Facebook (declining but still used)
