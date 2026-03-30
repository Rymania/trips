# Copilot Instructions for Trips Repository

This is a **Speckit-based project** — an AI-driven development framework that structures work around features, specifications, and implementation plans.

## High-Level Architecture

**Speckit Framework Structure:**

The project uses Speckit (v0.4.3) to manage feature development through a structured workflow:

1. **Feature Branches**: Organized as numbered (e.g., `001-feature-name`) or timestamped (e.g., `20260319-143022-feature-name`)
2. **Feature Directories**: Each feature branch corresponds to a directory in `specs/` containing:
   - `spec.md` — detailed feature specification
   - `plan.md` — implementation plan
   - `tasks.md` — actionable task breakdown
   - `research.md` — domain research (optional)
   - `data-model.md` — data model documentation (optional)
   - `contracts/` — contract tests (optional)
   - `quickstart.md` — quick reference guide (optional)

3. **Speckit Automation**: Configured agents in `.github/agents/` and prompts in `.github/prompts/` guide the AI through each phase:
   - `speckit.clarify` — Requirements clarification
   - `speckit.specify` — Feature specification
   - `speckit.analyze` — Technical analysis
   - `speckit.plan` — Implementation planning
   - `speckit.tasks` — Task breakdown
   - `speckit.implement` — Implementation execution
   - `speckit.checklist` — Completion verification
   - `speckit.constitution` — Project constitution management

## Project Configuration

- **AI Framework**: GitHub Copilot (configured in `.specify/init-options.json`)
- **Branch Numbering**: Sequential (e.g., `001-`, `002-`, etc.)
- **Script Runtime**: Bash (sh)
- **Speckit Version**: 0.4.3

## Key Conventions

### Repository Root Detection

The repository root is identified by the presence of a `.specify/` directory. This takes precedence over git root detection, allowing Speckit projects to exist in subdirectories of larger repos.

**Key scripts** (use these for automation):
- `.specify/scripts/bash/common.sh` — Core utility functions for path resolution and validation
- `.specify/scripts/bash/check-prerequisites.sh` — Validate feature readiness before implementation

### Feature Path Resolution

When working with features:

```bash
# Get feature paths for current branch
.specify/scripts/bash/check-prerequisites.sh --paths-only

# Check prerequisites in JSON format
.specify/scripts/bash/check-prerequisites.sh --json

# Validate implementation prerequisites
.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

### Template Resolution

Templates are resolved with this priority:
1. `.specify/templates/overrides/` — Project-specific overrides
2. `.specify/presets/<preset-id>/templates/` — Preset templates (by priority)
3. `.specify/extensions/<ext-id>/templates/` — Extension-provided templates
4. `.specify/templates/` — Core Speckit templates

### Extension Hooks

Projects can define extension hooks in `.specify/extensions.yml` for:
- `hooks.before_implement` — Pre-implementation setup/validation
- Hook execution respects `enabled`, `optional`, and `condition` fields

### JSON Construction

When constructing JSON in scripts, use `jq` if available; otherwise, use the `json_escape()` function from `common.sh` for safe string escaping.

## Implementation Workflow

When implementing a feature:

1. **Verify Prerequisites**: Run check-prerequisites with `--require-tasks` to ensure all documentation exists
2. **Load Context**: Read the feature's spec.md, plan.md, and tasks.md to understand scope and design
3. **Source Common Functions**: Import `.specify/scripts/bash/common.sh` for utility functions
4. **Execute Tasks**: Work through tasks.md in order, updating progress as needed
5. **Validate Completion**: Run checklist or verification steps defined in the feature documentation

## Testing and Validation

Currently, no build, test, or lint commands are configured in this repository. As features are implemented, these commands should be established and documented here.

**When adding a feature**:
- If your feature includes tests or builds, update this section with the commands
- Format: Include both single-test (e.g., `npm test -- single-test.spec.js`) and full-suite commands

## File Structure Reference

```
trips/
├── .github/
│   ├── agents/           # Speckit agent definitions
│   └── prompts/          # Speckit prompt templates
├── .specify/
│   ├── memory/
│   │   └── constitution.md    # Project constitution (fill this in)
│   ├── scripts/bash/          # Core automation scripts
│   ├── templates/             # Document templates
│   └── init-options.json      # Speckit configuration
├── .vscode/
│   └── settings.json          # VSCode Speckit integration
└── specs/                     # Feature directories (will be created per feature)
    └── 001-example-feature/   # Example structure
        ├── spec.md
        ├── plan.md
        ├── tasks.md
        └── ...
```

## Important Notes

- **Constitution File**: `.specify/memory/constitution.md` is currently a template. Fill it with actual project principles, constraints, and governance rules.
- **No Active Code**: This repository is initialized but has no source code yet. Project structure will depend on feature implementations.
- **VSCode Integration**: Speckit prompts are auto-recommended in VSCode chat via `.vscode/settings.json`.
