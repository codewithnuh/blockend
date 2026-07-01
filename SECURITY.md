# Security Policy

## Supported Versions

We actively monitor and patch vulnerabilities in our core packages and CLI engines. Because Blockend is moving quickly toward stable milestones, we focus maintenance efforts on the current major release branch.

| Version | Supported          | Notes                                       |
| ------- | ------------------ | ------------------------------------------- |
| 1.x.x   | :white_check_mark: | Active Development & Current Stable Release |
| < 1.0.0 | :x:                | Alpha/Beta versions; please upgrade to 1.x  |

## Reporting a Vulnerability

We take the security of our modular backend blocks seriously. If you discover a vulnerability or security flaw in any package or CLI engine, please **do not open a public GitHub issue**. Publicly disclosing flaws makes applications using Blockend vulnerable before a patch can be deployed.

### How to Report

Please report security issues privately via email to:
👉 **codewithnuh@gmail.com**

To help us remediate the issue efficiently, please include:

1. A description of the vulnerability and its potential impact.
2. Step-by-step instructions or a minimal proof-of-concept (PoC) block layout to reproduce the issue.
3. The specific package name (e.g., `blockend-cli`, `@blockend/detector`) and version used.

### What to Expect

- **Acknowledgment:** You will receive an initial response confirming receipt of your report within **48 hours**.
- **Investigation:** We will investigate the submission and keep you updated as we triage, accept, or decline the vulnerability status.
- **Resolution:** If confirmed, we will coordinate a fix and release a patch version (e.g., `1.3.2`) before publishing a public security advisory on GitHub to credit your discovery.
