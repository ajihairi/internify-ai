# Install

## Requirements

- An AI coding tool: [opencode](https://opencode.ai) or Claude Code.
- [Bun](https://bun.sh) — the runtime internify uses.

    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```

## Install the CLI

=== "npm"

    ```bash
    npm i -g internify-ai
    ```

=== "bun"

    ```bash
    bun add -g internify-ai
    ```

=== "from GitHub"

    ```bash
    bun add -g git+ssh://git@github.com/ajihairi/internify-ai.git
    ```

Verify:

```bash
internify --help
```

!!! tip "No global install"
    You can also run it from a checkout:
    `bun /path/to/internify-ai/core/cli.ts <command>`.

## Troubleshooting

!!! warning "Command not found after install"
    If `internify` is not found, the global npm bin directory is not in your PATH.

    **Find your npm global bin path:**
    ```bash
    npm bin -g
    ```

    **zsh (macOS default):**
    ```bash
    echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.zshrc
    source ~/.zshrc
    ```

    **bash:**
    ```bash
    echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.bashrc
    source ~/.bashrc
    ```

!!! warning "bun: command not found"
    internify requires [bun](https://bun.sh). Install it:
    ```bash
    curl -fsSL https://bun.sh/install | bash
    ```
    Then verify: `bun --version`

## Next

Continue to the [Quick start](quickstart.md).
