# Contributing to Lambda Cloud CLI

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone git@github.com:jwjohns/Lambda-Cloud-CLI.git
cd Lambda-Cloud-CLI
npm install
```

### Run in dev mode (no build step)

```bash
npx tsx src/index.ts --help
npx tsx src/index.ts types
```

### Build & link globally

```bash
npm run build
npm link
lambda --help
```

## Project Structure

```
src/
├── index.ts              # CLI entry point (Commander setup)
├── api.ts                # Lambda Cloud API client
├── config.ts             # Config management (uses `conf`)
├── ssh.ts                # SSH/SCP operations (uses `node-ssh`)
├── types.ts              # TypeScript interfaces
├── commands/
│   ├── config.tsx        # config show / config set
│   ├── instances.tsx     # List running instances
│   ├── launch.tsx        # Launch instance + wait
│   ├── poll.tsx          # Poll availability with live TUI
│   ├── remote.tsx        # push / pull / setup
│   ├── terminate.tsx     # Terminate with confirmation
│   └── types.tsx         # List GPU types + pricing
└── ui/
    ├── StatusBadge.tsx   # Status/price formatters
    └── Table.tsx         # Reusable table component
```

## Tech Stack

- **TypeScript** — strict mode
- **[Ink](https://github.com/vadimdemedes/ink)** — React-based terminal UI
- **[Commander](https://github.com/tj/commander.js)** — CLI argument parsing
- **[conf](https://github.com/sindresorhus/conf)** — persistent config storage

## Code Style

- Use `tsx` components (`.tsx`) for anything that renders UI
- Use `.ts` for pure logic (API, config, SSH)
- Keep commands self-contained — each file in `commands/` handles one command
- No external CSS/styling deps — use Ink's `<Box>` and `<Text>` primitives

## Adding a New Command

1. Create `src/commands/mycommand.tsx`
2. Export a `runMyCommand()` function that calls `render(<MyCommandView />)`
3. Wire it up in `src/index.ts`:
   ```typescript
   program
     .command('mycommand')
     .description('What it does')
     .action(() => runMyCommand());
   ```
4. Run `npm run lint` to type-check

## Testing

```bash
npm run lint          # Type check (tsc --noEmit)
npm run build         # Compile to dist/
lambda config show    # Smoke test
```

## Pull Requests

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run lint` — must pass
5. Commit with a clear message
6. Push and open a PR against `main`

CI will automatically run lint + build (npm, yarn, pnpm, bun) on your PR.

## Lambda API Reference

- **Base URL**: `https://cloud.lambda.ai/api/v1`
- **Auth**: Basic auth with API key
- **Docs**: [Lambda Cloud API](https://cloud.lambdalabs.com/api/v1/docs)

## License

MIT — see [LICENSE](LICENSE) for details.
