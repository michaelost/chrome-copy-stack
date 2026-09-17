# Claude Code Usage Notes — This Session

A summary of the prompts sent in this session (chrome-copy-past-plugin), split
into explicit skill/command invocations vs. plain-language asks, plus some
observations on how to get more out of Claude Code next time.

## Explicit skill/command invocations

| Prompt | Skill/command | Outcome |
|---|---|---|
| `/code-review-and-quality Review pull request #1 using GitHub MCP...` | `code-review-and-quality` | Never actually ran — superseded mid-flight by a follow-up message ("continue... migration to React"), so this invocation's review never happened. |
| `/incremental-implementation Implement the next vertical slice...` | `incremental-implementation` | Ran fully — produced the Vite/CRXJS tooling-swap slice. |
| `/subtask also document current functionality in separate MD file...` | `/subtask` (forked) | Ran fully — produced `FUNCTIONALITY.md`, committed. |
| `/code-review` (bare, local command) | `code-review` | Ran in background; result reported separately. |
| `/subtask preapre a summary of my prompts...` | `/subtask` (forked) | This report. |

**5 explicit invocations**, one of which (the first `/code-review-and-quality`)
never completed because a new plain-language message arrived before it ran.

## Plain-language asks (no skill invoked)

- `merge pr #1` — required investigation first (no git remote existed locally); ended in a manual `gh pr merge`.
- `Use a subagent with isolation: worktree to implement removing each individual item, clearning the whole stack` — a plain ask, but a precise one: it named the exact Claude Code mechanism (`Agent` tool, `isolation: worktree`) rather than just describing the feature.
- `continue` + a 7-step numbered instruction (git status → switch/pull → re-examine → re-read spec → compare → summarize → don't modify) — self-written mini-plan instead of invoking a planning skill.
- `good lets proceed`, `I tried, good , whats next piece ?` — short continuation/approval prompts.
- `whats on the next slice ? I don't see any change in /diff` — surfaced a real misunderstanding (everything was already committed, so `git diff` was empty by design).
- `provide me with instructions run to run that plugin` — answered directly rather than via the `run` skill (browser automation wasn't available in-session anyway).
- `push the cahnge` — ambiguous (no target named); the ambiguity forced a stop that caught a real risk (pushing would have used an unrelated local history and silently reverted upstream bug fixes already on `main`).
- `merge mr` — ambiguous (two open PRs); required a clarifying question every time.
- `I want to have a button that copies from the system clipboard and makes item in a list` — a feature request; Plan Mode was engaged for this one (Explore → Plan agent → written plan → approval), unlike everything else in the session.
- Bug report (`error could now copy from clipboard`) → `now exaclty to check popups console ?` → `may be temporarily trigger alert ?` — a debugging exchange where you proposed the fix (the `alert()` shortcut) that actually resolved the impasse fastest.

## Observations

1. **Ambiguous short commands cost a round-trip.** `push the change` and `merge mr` both needed a clarifying question because more than one target existed (which remote/branch, which of two open PRs). Naming the target explicitly ("push `feature/x` to `origin`", "merge PR #3") skips that.
2. **Mid-turn interruptions work but reset framing.** Several messages arrived while a previous tool call was still running (the worktree instruction, "push the change"). Claude Code handles this fine, but batching related asks into one message avoids the earlier task being left half-narrated.
3. **Stating a constraint up front shaped the whole design.** For the clipboard button, "only on click, no background listening" was one sentence but drove the entire implementation (no polling, no new listeners) and avoided a completely different, over-engineered approach. Worth doing this consistently for any feature with an implicit "don't do X" in your head.
4. **The best debugging move wasn't the "correct" one — it was the fastest observable one.** DevTools-on-a-popup is genuinely fiddly (it can close before attaching); your `alert()` suggestion sidestepped that entirely and found the root cause (stale build) in one click. Worth reaching for over DevTools when debugging anything in a transient UI surface (extension popups, quick modals).
5. **Skills you already know to reach for**: `/incremental-implementation` (slice-by-slice feature work with a commit per slice), `/code-review` / `/code-review-and-quality` (PR review), `/subtask` (offload side-work — e.g. documentation — to a background fork so it doesn't block the main thread). You used all three well. `planning-and-task-breakdown` and `spec-driven-development` exist but weren't invoked directly — the 7-step numbered instruction and the plan-mode session effectively did their job manually/automatically instead.
6. **Typos never caused a misunderstanding** ("cahnge", "exaclty", "preapre", "clearning") — no need to slow down for typing precision here.

---
Not committed to git — this is a personal usage note, not project documentation (unlike `FUNCTIONALITY.md`). Delete or commit it yourself if you want it kept.
