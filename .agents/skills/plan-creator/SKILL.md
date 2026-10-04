---
name: plan-creator
description: 'Create plans with automatic sequential reviews by fresh subagents, or review existing plans. Use for any request to create, draft, write, or revise a plan, including implementation plans, planning mode, and plan filename prompts; also use for explicit plan reviews.'
---

# Plan Creator

## Scope

Apply this workflow to every plan creation request. The main agent owns the plan and review loop. Follow explicit user instructions about format, destination, review count, and whether to skip reviews. Do not implement a plan unless the user also requests implementation.

## Create a Plan

Create the requested plan as a Markdown file. If the prompt uses `plan <filename>.md: ...`, write the plan to that filename. Otherwise, use a short, descriptive Markdown filename derived from the task, unless the user specifies a destination.

For codebase work, inspect the relevant code sufficiently to identify established naming, architecture, layers, directory structure, testing approach, and nearby implementation patterns. Make the plan consistent with those conventions. For other plans, inspect the relevant available materials and constraints instead of assuming a codebase exists.

Keep the plan concise and direct. Do not overcomplicate it, add speculative work, or prescribe unnecessary abstractions. Include every important aspect needed to implement and verify the requested change.

Unless the user or repository requires a different format, use exactly these top-level sections:

## Context

Briefly contextualize the problem or task to be implemented, including relevant existing-code considerations.

## Implementation Steps

List the implementation steps in execution order with concrete references to affected components or files when known.

For changes to testable production behavior, the first step must create unit tests covering the planned behavior and relevant edge cases. State that these tests must run immediately and fail for the expected reason before production code is changed.

Follow test-driven development for those changes: implement what is needed to satisfy the tests while respecting existing codebase patterns. The final step must run relevant tests and required repository checks. For documentation, configuration, or non-code plans, specify suitable verification rather than inventing unit tests.

After writing the draft, run the automatic review loop below before presenting the plan as ready. Plan revisions also run this loop unless the user requests otherwise.

## Automatic Review Loop

Use five reviews as the maximum by default. If the user specifies a review limit, use that number instead; zero or an explicit request to skip reviews means no reviewers. Count every reviewer attempt toward the limit. A clean review stops the loop early even when the user specifies a larger maximum.

1. Spawn one new reviewer subagent for the current plan. With `collaboration.spawn_agent`, set `fork_turns: "none"`. In other environments use the equivalent fresh-context delegation tool. Never reuse a reviewer, fork the conversation, run reviewers concurrently, or let reviewers spawn their own review loops.
2. Give the reviewer only the absolute plan path, workspace path, this skill's path, the user's original task and applicable clarifications or constraints, and the reviewer instructions below. Do not provide the main agent's reasoning, prior reviewer findings, or a suggested verdict. The reviewer must read applicable repository instructions, the current plan, and relevant source materials independently.
3. Wait for that reviewer to finish before making edits or starting another reviewer. The reviewer may correct the plan in place, but must not edit implementation files. Read its report and the resulting plan.
4. Stop immediately on `NO_CHANGES_NEEDED` only when the reviewer performed the review and made no edits. Any edits require `CHANGES_MADE`, even if the reviewer believes its revised plan is now sound; start another fresh reviewer if the limit permits.
5. For `CHANGES_MADE`, retain the corrections and repeat with the current saved plan. If the report identifies necessary corrections it could not apply, the main agent applies the supported corrections before the next review. An incomplete or failed review cannot count as clean. If a reviewer reports `REVIEW_BLOCKED`, resolve the blocker when possible and continue within the remaining attempts; otherwise stop and report the limitation.
6. Stop at the limit, retaining the last review's corrections. Do not add an extra confirmation review or restart the counter. Report that the limit was reached without a clean review; do not claim the plan is error-free.

If fresh-context delegation is unavailable, keep the draft and explain that automatic independent reviews could not run. Do not describe a main-agent self-review as an independent review. If tools expose agent cleanup, release completed reviewers before spawning another so limits above five can work with bounded concurrency.

### Reviewer Instructions

Send these instructions to each reviewer along with the paths and task constraints:

> You are an independent plan reviewer. Read the supplied skill's "Review a Plan" criteria, applicable repository instructions, the current plan, and relevant source materials. Check the plan against the original user task and constraints. Correct necessary errors and omissions directly in the plan file only. Do not implement the plan, create another plan, spawn agents, or run the automatic review loop. Avoid stylistic churn and speculative additions. Return one of these statuses as the first line:
> - `NO_CHANGES_NEEDED`: you completed the review and made no edits because no necessary corrections remain. Briefly state what you verified.
> - `CHANGES_MADE`: you found necessary corrections. Summarize the edits and any remaining issues or corrections you could not apply. Use this status whenever you edited the plan, even if it now looks correct.
> - `REVIEW_BLOCKED`: you could not complete the review. State the missing information or access; do not claim a clean review.

### Final Report

Link to the saved plan and state how many reviews ran and whether the loop stopped on a clean review, reached the limit, was skipped by request, or could not complete. Keep review history in the final response rather than adding it to the plan. A clean review means no necessary changes were found, not a guarantee of perfection.

## Review a Plan

When the user asks for a plan review or begins the prompt with `review <filename>.md`, review the referenced Markdown plan in place. Resolve the target from the explicit filename or the clearly referenced plan; ask for the filename only when the target cannot be determined safely.

Read the plan's context and assess every step against it and the user's task. For codebase work, inspect relevant existing code to verify assumptions, affected components, naming, architecture, layers, structure, testing approach, dependencies, and implementation order. Check behavior, integration points, important edge cases, scope, and verification. For other plans, verify assumptions and sequencing against the relevant materials and constraints. Identify unknowns explicitly rather than inventing facts.

Correct errors, inaccurate assumptions, unnecessary complexity, and important omissions directly in the plan file. Keep corrections simple, concise, direct, and consistent with established patterns. Preserve the required format and applicable test-driven development requirements. Do not edit merely to rephrase a sound plan.

Make no edits when the plan contains no errors and omits no important considerations. In that case, report that the review found no necessary changes. Do not implement the plan as part of the review.

A standalone request to review an existing plan performs one review unless the user asks for automatic or repeated reviews; in that case, the main agent runs the same bounded loop on the existing plan. Delegated reviewers always perform one pass only.
