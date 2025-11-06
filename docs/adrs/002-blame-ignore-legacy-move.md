# ADR 002: Ignore Legacy Relocation Commit in Git Blame

## Status
Accepted – 6 November 2025

## Context
The modernization work relocates the historical web assets into `legacy_html/` so we can keep the original experience runnable while building the new stack. Commit `1b60e250f51ec65b62e85b177ebcb1d740bddfe7` performs that move without modifying any file contents. Without special handling, `git blame` would attribute every line in the legacy files to that relocation commit, obscuring the original authorship.

GitHub’s blame view automatically respects `.git-blame-ignore-revs`, but local Git clients require an explicit configuration pointing to the ignore list.

## Decision
- Maintain a `.git-blame-ignore-revs` file at the repository root that lists pure-move commits (starting with `1b60e250f51ec65b62e85b177ebcb1d740bddfe7`).
- Document that contributors should run `git config blame.ignoreRevsFile .git-blame-ignore-revs` after cloning so local blame results match GitHub’s behaviour.

## Consequences
- Historical investigation remains accurate: when teammates run `git blame` (locally or on GitHub), they see the true origin of legacy code instead of the relocation commit.
- Onboarding steps now include a one-time Git configuration command; we can fold it into future setup guides or scripts if needed.
