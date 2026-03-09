<div align="center">

# ⚡ Lambda Cloud CLI

**A fast, interactive CLI + MCP server for managing Lambda Cloud GPU instances.**

[![CI](https://github.com/jwjohns/Lambda-Cloud-CLI/actions/workflows/ci.yml/badge.svg)](https://github.com/jwjohns/Lambda-Cloud-CLI/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/lambda-cloud-cli.svg?color=cb3837)](https://www.npmjs.com/package/lambda-cloud-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-8B5CF6?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAyTDIgN2wxMCA1IDEwLTUtMTAtNXoiLz48cGF0aCBkPSJNMiAxN2wxMCA1IDEwLTUiLz48cGF0aCBkPSJNMiAxMmwxMCA1IDEwLTUiLz48L3N2Zz4=)](https://modelcontextprotocol.io)

Built with [Ink](https://github.com/vadimdemedes/ink) (React TUI) · [Commander](https://github.com/tj/commander.js) · [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)

---

</div>

## Install

```bash
npm install
npm run build
npm link    # creates global 'lambda' and 'lambda-cli' commands
```

## Setup

```bash
lambda config set apiKey YOUR_LAMBDA_API_KEY
lambda config set defaultSshKey YOUR_SSH_KEY_NAME
lambda config set defaultRegion us-east-3
```

## Commands

| Command | Description |
|---------|-------------|
| `lambda types [filter]` | List available GPU instance types with pricing |
| `lambda instances` | List running instances |
| `lambda launch <type>` | Launch a new instance, wait for active, show SSH |
| `lambda terminate [id]` | Terminate instance(s) with confirmation |
| `lambda poll <type>` | Poll for GPU availability with live TUI + auto-launch |
| `lambda ssh <id> [cmd]` | Interactive SSH or run remote command |
| `lambda push <id> <local> <remote>` | Upload files/dirs to instance |
| `lambda pull <id> <remote> <local>` | Download files/dirs from instance |
| `lambda setup <id>` | Upload training code and run setup script |
| `lambda config show` | Display current configuration |
| `lambda config set <key> <value>` | Set a config value |

## Examples

```bash
# Check GH200 availability
lambda types gh200

# Poll for a GH200 and auto-launch when available
lambda poll gpu_1x_gh200 --auto-launch

# List running instances
lambda instances

# SSH into an instance
lambda ssh <instance-id>

# Push training data
lambda push <instance-id> ./data /home/ubuntu/data

# Terminate all instances
lambda terminate --all
```

## Cost Tracking

The CLI automatically tracks instance uptime and calculates running costs:

- **On launch**: records timestamp and hourly rate locally
- **On `lambda instances`**: shows Uptime and Cost columns + session total
- **On `lambda terminate`**: shows final session cost per instance

```
$ lambda instances
  Status      Name          IP              GPU                    Region       $/hr    Uptime     Cost
  🟢 active   datagen-test  192.222.56.129  1x GH200 480GB        us-east-3   $1.99    5h 14m   $10.44
  💰 Session total: $10.44 across 1 instance(s)
```

Cost data is stored locally in `~/.config/lambda-cli/cost-tracker.json`.

## Config Keys

| Key | Description | Default |
|-----|-------------|---------|
| `apiKey` | Lambda Cloud API key | (required) |
| `defaultSshKey` | SSH key name registered with Lambda | `dasm-mac` |
| `defaultRegion` | Preferred launch region | `us-east-3` |
| `defaultInstanceType` | Default GPU type | `gpu_1x_gh200` |
| `sshPrivateKeyPath` | Path to SSH private key | auto-detect |
| `wandbApiKey` | Weights & Biases API key for training monitoring | — |

## MCP Server (AI Agent Integration)

Lambda Cloud CLI includes a built-in [MCP](https://modelcontextprotocol.io/) server so AI agents can manage GPU instances programmatically.

### Setup for Claude Code / Cursor / Codex

Add to your MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "lambda": {
      "command": "lambda-cli",
      "args": ["mcp"]
    }
  }
}
```

Or via npx (no global install):

```json
{
  "mcpServers": {
    "lambda": {
      "command": "npx",
      "args": ["-y", "lambda-cloud-cli", "mcp"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `list_instance_types` | Browse GPU types with pricing and regional availability |
| `check_availability` | Check if a specific GPU type is available now |
| `list_instances` | List all running instances with IPs and status |
| `launch_instance` | Launch a new GPU instance |
| `terminate_instance` | Terminate instance(s) by ID |
| `ssh_command` | Run shell commands on an instance via SSH |
| `list_ssh_keys` | List SSH keys registered with Lambda |
| `get_config` | View current CLI configuration |

### What agents can do

> "Launch a GH200, upload my training data, start the fine-tuning job, monitor it, pull the results, and terminate the instance."

All autonomously, with full visibility into costs and availability.

## License

MIT
