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

## Next

Continue to the [Quick start](quickstart.md).
