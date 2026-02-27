---
name: commit
description: Run tests, lint, and commit changes with a conventional message
user_invocable: true
---

# Commit Workflow

Follow these steps exactly:

1. **Run tests**: `npm test` — if tests fail, stop and fix them first.
2. **Run lint**: `npm run lint` — if lint fails, fix issues first.
3. **Check status**: `git status` to see what changed. Review staged and unstaged changes with `git diff` and `git diff --cached`.
4. **Stage relevant files**: `git add` specific files (not `git add .`). Never stage `.env` or credential files.
5. **Write commit message**: Use conventional format — `type(scope): description`
   - Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`
   - Reference GitHub issues when applicable: `(#42)` or `(fixes #42)`
   - Keep the first line under 72 characters
6. **Commit**: Create the commit using a HEREDOC for the message.
7. **Confirm**: Show `git log --oneline -3` to confirm.

If `$ARGUMENTS` is provided, use it as guidance for the commit message.

**Do NOT push unless the user explicitly asks.** Just commit locally.
