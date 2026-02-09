# Git Workflow

## Branch Naming
Format: `type/short-description`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

Examples:
- `feat/user-authentication`
- `fix/login-redirect-loop`
- `refactor/extract-payment-service`

## Commit Messages
Follow Conventional Commits:

```
type(scope): short description

Optional body explaining why, not what.

Optional footer (e.g., BREAKING CHANGE, Closes #123)
Assisted-by: Claude Code
```

- Subject line: imperative mood, lowercase, no period, max 72 characters
- Body: wrap at 80 characters
- One logical change per commit (atomic commits)

## AI Assistance Trailers

When committing code that was written or substantially shaped by an AI tool, include a trailer in the commit message footer:

- `Assisted-by: <tool name>` — for commits where AI assisted but a human drove the design and logic
- `Generated-by: <tool name>` — for commits where the code is substantially AI-generated

The `prepare-commit-msg` hook in `.claude/hooks/` can automate this for Claude Code commits. See `.claude/rules/ai-compliance.md` for full Red Hat policy details on AI marking requirements.

## Rules
- Never commit secrets, credentials, API keys, or `.env` files
- Never force-push to `main` or `master`
- Rebase feature branches onto main before merging (prefer linear history)
- Delete feature branches after merge
- Tag releases with semantic versioning (`v1.2.3`)
