# Blockend CLI

> Install production-ready backend blocks into your project directly from the terminal.

Blockend CLI helps you scaffold reusable backend features such as authentication, authorization, email, storage, payments, middleware, utilities, and more. It detects your project's framework, generates a `blockend.json` configuration, and installs only the blocks compatible with your stack.

## Features

- Framework detection for supported Node.js frameworks.
- Generates a `blockend.json` configuration file.
- Installs only compatible backend blocks.
- Automatically installs required dependencies.
- Writes clean, editable source code directly into your project.
- No runtime lock-in—your code stays yours.
- Works seamlessly with the Blockend ecosystem.

## Quick Start

Initialize Blockend in your project:

```bash
npx blockend-cli init
```

Blockend will:

- Detect your framework
- Create a `blockend.json` file
- Prepare your project for backend blocks

## Add Backend Blocks

Browse and install compatible backend blocks:

```bash
npx blockend-cli add
```

## Example

```bash
npx blockend-cli init
npx blockend-cli add
```

## Supported Frameworks

- Next.js
- Express
- Hono
- Fastify

More frameworks are coming soon.

## Documentation

Visit the documentation:

**https://blockend.noorulhassan.com**

## Repository

GitHub:

**https://github.com/codewithnuh/blockend**

## License

MIT © CodeWithNuh

See the full license here:

https://github.com/codewithnuh/blockend/blob/master/LICENSE
