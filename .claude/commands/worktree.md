---
description: Create a git worktree under .trees/ for a new requirement
argument-hint: <requirement description>
---

The user wants to implement this requirement in an isolated git worktree:

"$ARGUMENTS"

Do the following:

1. Deduce a short kebab-case name (2-5 words) from the requirement text that captures its essence, suitable as a branch/directory name.
2. Run `git status` to confirm the working tree is clean enough to branch from (if there are uncommitted changes, warn the user but proceed unless it looks risky).
3. Create the worktree with a new branch matching the deduced name:
   `git worktree add .trees/<name> -b <name>`
   (If `.trees/` doesn't exist yet, `git worktree add` will create it.)
4. Write the full requirement text to `.trees/<name>/requirements.md` so the work is documented inside the worktree.
5. Report the worktree path and branch name to the user, and mention they can `cd .trees/<name>` or open a new session there to start work.

Do not start implementing the requirement itself — this command only sets up the worktree.
