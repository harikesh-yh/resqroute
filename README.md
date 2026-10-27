# ResQroute — Multi-Agent Disaster Response Simulator

ResQroute is a prototype that explores emergency dispatch as a multi-agent coordination problem. Fire, Medical, and Police department agents coordinate with a Central Coordinator to allocate scarce emergency vehicles and re-prioritize responses as incident severity changes. The configured scenario represents Mumbai’s Dadar–Byculla–Parel corridor.

## Project status

This repository contains a working prototype/simulator and supporting product/design documentation. Treat the scenario as a simulation, not a live emergency-dispatch service. Do not use it for real emergency response.

## Tech stack

- TypeScript and React
- pnpm workspaces
- Multi-agent coordination and real-time event simulation
- OpenStreetMap-based map experience
- Optional LLM provider configuration (see `.env.example`)

## Prerequisites

- Node.js 20 or newer
- pnpm 10.x (the package metadata specifies pnpm 10.33.2)

## Local development

```bash
cp .env.example .env
# Add a valid provider API key only if using live LLM mode. Keep .env local.
pnpm install
pnpm dev
```

Build and checks:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Check the package scripts and `.env.example` for the current configuration. The exact behavior of each command may depend on the installed workspace dependencies and provider configuration.

## Configuration and safety

- `.env.example` is a template only; never commit `.env` or provider credentials.
- Use replay/demo mode where available if you do not want live provider calls.
- This is a demonstration project, not an operational public-safety system.

## Documentation

- [`productSpec.md`](productSpec.md) — product scope and coordination protocol
- [`BuildPlan.md`](BuildPlan.md) — implementation plan

## License

No license has been added. Unless a license is added, standard copyright applies and others do not automatically receive permission to reuse the code.
