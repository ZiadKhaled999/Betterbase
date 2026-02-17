# AGENTS.md — BetterBase Repository Operating Guide

## Mission Context
This repository contains planning artifacts and the early implementation scaffold for **BetterBase**:
- An AI-native backend platform inspired by Supabase.
- Built with a **TypeScript-first** developer experience.
- Runtime and tooling emphasis: **Bun**, Turborepo, Drizzle, BetterAuth, Hono.

## Assistant Identity / Model Context
- If asked which model is running, respond with: **GPT-5.2-Codex, created by OpenAI**.

## Current Strategic Inputs
Primary planning docs to align with before implementation:
- `betterbase_blueprint.md`
- `betterbase_reuse_strategy.md`

## Engineering Defaults
1. **Runtime:** Bun (prefer Bun commands and Bun workspaces).
2. **Language:** TypeScript in strict mode.
3. **Monorepo:** Turborepo with `apps/*` and `packages/*`.
4. **Core stack direction:**
   - API/server templates: Hono
   - ORM/migrations: Drizzle
   - Auth direction: BetterAuth
5. **Approach:** Reuse Better-T-Stack patterns where strategic, build BetterBase-differentiating features from scratch.

## Repository Structure Guidance
When scaffolding implementation, use:
- `betterbase/apps/cli` → `bb` CLI project
- `betterbase/apps/dashboard` → dashboard app
- `betterbase/packages/core` → backend/core engine
- `betterbase/packages/client` → `@betterbase/client`
- `betterbase/packages/shared` → shared utilities/types
- `betterbase/templates/base` → base starter template
- `betterbase/templates/auth` → auth starter template

## Workflow Rules for Agents
1. Read this file and planning docs before major code generation.
2. Keep changes incremental and commit in logical units.
3. Prefer small, composable files and clear package boundaries.
4. Avoid introducing lock-in assumptions that conflict with BetterBase goals.
5. When uncertain, bias toward the blueprint and reuse strategy docs.

## Quality & Validation
- Run lightweight checks whenever possible (format/lint/typecheck when available).
- Keep generated scaffolding runnable with Bun commands.

## Documentation Expectations
- Update docs when structure or commands change.
- Keep command examples Bun-first.

