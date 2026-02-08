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
```

- Subject line: imperative mood, lowercase, no period, max 72 characters
- Body: wrap at 80 characters
- One logical change per commit (atomic commits)

## Rules
- Never commit secrets, credentials, API keys, or `.env` files
- Never force-push to `main` or `master`
- Rebase feature branches onto main before merging (prefer linear history)
- Delete feature branches after merge
- Tag releases with semantic versioning (`v1.2.3`)
