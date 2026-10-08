## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
_GS=""
for _D in "${GSTACK_ROOT:-}" "$HOME/.claude/skills/gstack" "$HOME/.codex/skills/gstack" "$HOME/.factory/skills/gstack" "$HOME/.kiro/skills/gstack" "$HOME/.config/opencode/skills/gstack" "$HOME/.slate/skills/gstack" "$HOME/.cursor/skills/gstack" "$HOME/.openclaw/skills/gstack" "$HOME/.hermes/skills/gstack" "$HOME/.gbrain/skills/gstack" "$HOME/.gstack/repos/gstack"; do
  [ -z "$_GS" ] && [ -n "$_D" ] && [ -d "$_D/bin" ] && _GS="$_D"
done
[ -n "$_GS" ] && echo "GSTACK_OK: $_GS" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing (Aside first, the bundled gstack browser as fallback).
Use the resolved install path above for gstack file paths
(default: ~/.claude/skills/gstack).

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

This worktree's pinned code source answered a source-scoped page read. This
does not verify semantic search or write availability. Prefer gbrain over Grep
when the question is semantic or when you don't know the exact identifier yet;
if a query fails, report that failure rather than assuming the index is healthy.

**This worktree is pinned to a worktree-scoped code source** via the
`.gbrain-source` file in the repo root (kubectl-style context).
`gbrain code-def`, `code-refs`, `code-callers`, `code-callees`, `search`, and
`query` from anywhere under this worktree route to that source by default --
no `--source` flag needed (gbrain >= 0.41.38.0; on older gbrain the call-graph
commands need `--source "$(cat .gbrain-source)"`).

**IMPORTANT CAVEAT — this is a frozen snapshot, not a live-tracked index.**
`gbrain sources add`/`gbrain sync --strategy code` against this repo's actual
working directory fails with `writer_manifest_unsafe: Canonical checkout
recovery refuses symbolic links` (gbrain 0.58.1.0 bug, confirmed at
`src/core/persistence/topology-filesystem.ts:37` in the gbrain source) --
it scans the live directory as-given, not a git-clean checkout, and this
repo has real symlinks on disk (`.venv/bin/*`, `web/node_modules/.bin/*`).
Workaround used: registered the source against a disposable clone at
`~/.gstack-clean-checkouts/SportsWeb` instead (git clones never contain
symlinks here, since nothing symlinked is actually tracked by git). That
clone is a point-in-time snapshot from whenever it was last made -- it does
NOT auto-update as this repo's real code changes, and `gbrain autopilot`
can't refresh it either (same live-directory scan, same bug). To refresh:
`rm -rf ~/.gstack-clean-checkouts/SportsWeb && git clone /home/neo/SportsWeb
~/.gstack-clean-checkouts/SportsWeb && gbrain sync --strategy code --source
gstack-code-sportsweb --full --yes --no-pull`, then `gbrain extract --stale
--source gstack-code-sportsweb`. Re-check this bug's status on a future
gbrain upgrade -- if fixed, re-register directly against this repo's real
path instead and remove this caveat.

Two indexed corpora available via the `gbrain` CLI:
- This worktree's code (auto-pinned via `.gbrain-source`) -- see staleness
  caveat above.
- `~/.gstack/` curated memory (registered as `gstack-brain-<user>` source via
  the existing federation pipeline) -- this one DOES stay current via the
  normal memory/brain-sync stages, which aren't affected by the symlink bug.

Prefer gbrain when:
- "Where is X handled?" / semantic intent, no exact string yet:
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions:
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?":
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans, retros, learnings:
    `gbrain search "<terms>" --source gstack-brain-<user>`

Grep is still right for known exact strings, regex, multiline patterns, and
file globs -- and is the MORE reliable choice here specifically for anything
changed since the snapshot above, given the staleness caveat.

<!-- gstack-gbrain-search-guidance:end -->
