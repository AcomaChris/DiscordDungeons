---
name: issue
description: Create a GitHub issue for a bug, feature, or task
user_invocable: true
---

# File a GitHub Issue

Create a GitHub issue using the `gh` CLI.

## From arguments
If `$ARGUMENTS` is provided, interpret it as the issue description. Extract a concise title and write a clear body. Example usage:
- `/issue Add dark mode support for the game client`
- `/issue Bug: character falls through floor when jumping at edges`

## From conversation
If no arguments are provided, ask the user what the issue is about.

## Steps
1. **Draft the issue**: Write a title (under 70 chars) and a markdown body with:
   - **Summary**: 1-3 sentences describing the issue
   - **Context**: Any relevant technical details, file paths, or reproduction steps
   - **Labels suggestion**: Mention if this is a `bug`, `enhancement`, or `task` (but don't add labels unless the repo has them configured)
2. **Show the draft** to the user for approval before creating.
3. **Create**: `gh issue create --title "..." --body "..."` using a HEREDOC for the body.
4. **Report**: Show the issue URL.
