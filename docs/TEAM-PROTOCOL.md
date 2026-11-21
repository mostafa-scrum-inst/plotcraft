# Team protocol (mandated by the client)

Roles: **CTO**, **Product Manager (PM)**, **Tech Lead (TL)**, **Designer**, **Senior Full-Stack Dev (FS)**, **QA Tester**.
An orchestrator relays messages between roles. All state lives on disk in `/home/claude/plotcraft` so anyone can pick up from files.

## Workflow
1. **PM** writes goals + user stories with acceptance criteria -> `docs/01-product/goals-and-stories.md`. **CTO** reviews -> approve or request changes (loop until approved).
2. **TL** writes one feature plan per feature (architecture, data model, ordered tasks, each task assigned to Designer or FS) -> `docs/02-features/F<n>-plan.md` (+ `docs/02-features/architecture.md` for shared decisions). **CTO** reviews/approves.
3. Per feature, tasks are handled **in order**. For each task `F<n>-T<m>` (folder `docs/03-tasks/F<n>-T<m>/`):
   a. Assignee (Designer or FS) writes `plan.md` (implementation plan).
   b. **TL** reviews the plan -> `plan-review.md`. Loop until approved.
   c. Assignee implements.
   d. **TL** reviews implementation -> `impl-review.md`. Loop until approved.
   e. **QA** tests against the acceptance criteria -> `qa-report.md`. Bugs go back to the assignee (step c), then TL re-review of fixes, then QA re-test, until QA passes.
   f. Assignee writes `outcome.md` (what was built, files touched, how to verify, known limits/tech debt). **TL** reviews/approves it (and QA sign-off is recorded in it).
4. After a feature is complete, **PM** and **CTO** review the feature's work -> `docs/04-feature-reviews/F<n>.md`: approve, or add notes and request another round to clear tech debt early.

## Review rules
- Every review file ends with a line that is exactly `VERDICT: APPROVED` or `VERDICT: CHANGES REQUESTED`, preceded by a numbered list of required changes (if any) and optional non-blocking notes.
- Reviewers actually open and read the files/code under review; reviews are specific (file, function, line of reasoning). No rubber-stamping, but no gold-plating either: this is a prototype, block only on things that break acceptance criteria, the hard constraints in `docs/00-brief.md`, correctness, or that will cause costly rework later.
- When re-reviewing, append a new dated "Round N" section to the same file.
- Append one line per completed step to `docs/status.md` (`- [role] step — result`).

## Reply format to the orchestrator
Keep final replies short: the files you wrote/changed, the verdict (if reviewing), and anything the next role must know. Do not paste whole documents back.

## Models (client instruction, 2026-11-20)
- Every role agent (CTO, PM, Tech Lead, Designer, FS, QA) runs on **Opus 5.5**. The orchestrator alone may run on Fable 5.2.
- Agents started before this rule ran on Fable 5.2 and hit its usage limit; from 2026-11-20 06:30 each role is restarted as a fresh Opus agent. A fresh agent has no chat memory: it rebuilds context from the files on disk (brief, protocol, stories, architecture, feature plans, the task folders and `docs/status.md`), which is why everything must keep living on disk.
