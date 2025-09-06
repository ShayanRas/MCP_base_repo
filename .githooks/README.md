# Git Hooks for Security

These hooks help enforce the repository's usage restrictions.

## Installation

To enable these hooks, run:

```bash
git config core.hooksPath .githooks
```

This will configure git to use these hooks for this repository.

## What They Do

- **pre-commit**: Prevents creating archives, bundles, or patches that could be used to extract code

## Enforcement

These hooks are part of the security measures to ensure all code remains within the repository as required by the license.