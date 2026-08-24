---
name: plan-checker
description: 'Check a completed codebase implementation against its Markdown plan and create a concise per-step status file. Use when the user asks to check a plan or begins the prompt with `check <filename>.md`.'
---

# Plan Checker

Use this skill after a plan has been implemented and the user wants to verify the implementation against the plan. This skill complements `plan-creator`; it does not create, review, or implement plans.

Resolve the original plan from the explicit filename or the clearly referenced plan. For `check <filename>.md`, create `check_<filename>.md` in the same directory as the original plan, prefixing the basename only. For example, checking `docs/example.md` creates `docs/check_example.md`.

Read the plan's context and implementation steps. Inspect the relevant production code, configuration, migrations, and other implementation artifacts needed to compare the codebase with every original step. Base each result on concrete code evidence and account for the codebase's existing naming, architecture, layers, and structure.

Do not run tests or assess test correctness. When a step contains both test and production requirements, judge only its production requirements. Treat a test-only step as `implemented` for this report because test verification is explicitly out of scope.

Create the check file with only a numbered list and exactly one item for each implementation step in the original plan, preserving the original step order and numbering. Use one of these exact forms:

```markdown
1. implemented
2. partially implemented
   - done: <briefly describe what is implemented>
   - missing: <briefly describe what remains>
```

Use `implemented` only when the applicable production work for that step is fully and correctly present. Use `partially implemented` for incomplete, incorrect, or entirely absent production work. When nothing is implemented, use `done: Nothing identified.` and summarize the required work under `missing`.

Keep every description short, concrete, and direct. Do not add headings, summaries, evidence sections, code references, recommendations, or statuses other than the required numbered items. Do not modify the original plan or implementation.
