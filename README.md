# Lambda Cloud CLI

A fast, interactive CLI tool with TUI for managing Lambda Cloud GPU instances.

Built with TypeScript, [Ink](https://github.com/vadimdemedes/ink) (React-based TUI), and [Commander](https://github.com/tj/commander.js).

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

## Config Keys

| Key | Description | Default |
|-----|-------------|---------|
| `apiKey` | Lambda Cloud API key | (required) |
| `defaultSshKey` | SSH key name registered with Lambda | `dasm-mac` |
| `defaultRegion` | Preferred launch region | `us-east-3` |
| `defaultInstanceType` | Default GPU type | `gpu_1x_gh200` |
| `sshPrivateKeyPath` | Path to SSH private key | auto-detect |

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
