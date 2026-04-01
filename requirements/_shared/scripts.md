# Automation Script Standards

When scripts are created for the requirement:

- Place them under a `scripts/` directory in the repository root or the requirement folder.
- Provide both `.sh` and `.bat` when the workflow is intended for repeated manual execution across platforms.
- Scripts must be idempotent where practical.
- Scripts must print clear step headers and exit non-zero on failure.

