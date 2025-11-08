#!/usr/bin/env bash

# We guard the prepare-commit-msg hook so Commitizen guides teammates only when Git has not already filled in a commit message.
# This keeps scripted releases, rebases, and amend flows non-interactive while preserving the wizard for day-to-day commits.
# When CI=1 (our automation flag) we respect that opt-out to keep pipelines and non-interactive sessions unblocked without prompting.

set -euo pipefail

msg_file="${1:-}"
msg_source="${2:-}"
ci_mode="${CI:-0}"

if [[ "$ci_mode" == "1" ]]; then
  exit 0
fi

# We exit early whenever Git already staged a message (via -m/-F/templates) so automation can keep its own wording untouched.
if [[ -n "$msg_file" && -s "$msg_file" ]]; then
  exit 0
fi

# We also skip the wizard for merge, squash, commit, or amend flows because Git pre-populates those messages for us.
case "$msg_source" in
  message|template|merge|squash|commit|amend)
    exit 0
    ;;
esac

# We reach this point only when Git expects us to author a brand-new message, so we launch Commitizen to craft a conventional commit together.
pnpm commit --hook
