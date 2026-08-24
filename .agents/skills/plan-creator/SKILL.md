---
name: plan-creator
description: 'Create or review concise, codebase-aware implementation plans in Markdown files. Use whenever the user asks to create a plan or asks for a review, including prompts beginning with `plan <filename>.md: ...` or `review <filename>.md`.'
---

# Plan Creator

## Create a Plan

Create the requested plan as a Markdown file. If the prompt uses `plan <filename>.md: ...`, write the plan to that filename. Otherwise, use a short, descriptive Markdown filename derived from the task, unless the user specifies a destination.

Before writing the plan, inspect the relevant codebase sufficiently to identify its established naming, architecture, layers, directory structure, testing approach, and nearby implementation patterns. Make the plan consistent with those conventions.

Keep the plan concise and direct. Do not overcomplicate it, add speculative work, or prescribe unnecessary abstractions. Include every important aspect needed to implement and verify the requested change.

The plan must contain exactly these top-level sections:

## Context

Briefly contextualize the problem or task to be implemented, including relevant existing-code considerations.

## Implementation Steps

List the implementation steps in execution order with concrete references to affected components or files when known.

The first step must always create unit tests that fully cover the planned implementation. State that these tests must be run immediately and must fail for the expected reason before production code is changed.

Follow test-driven development throughout the steps: implement only what is needed to satisfy the tests while respecting existing codebase patterns. The final step must run all relevant tests again and confirm that they pass.

Do not implement the plan unless the user also requests implementation.

## Review a Plan

When the user asks for a plan review or begins the prompt with `review <filename>.md`, review the referenced Markdown plan in place. Resolve the target from the explicit filename or the clearly referenced plan; ask for the filename only when the target cannot be determined safely.

Read the plan's context and assess every implementation step against it. Inspect the relevant existing code to verify the plan's assumptions, affected components, naming, architecture, layers, structure, testing approach, dependencies, and implementation order.

Correct errors, inaccurate assumptions, unnecessary complexity, and important omissions directly in the plan file. Keep corrections simple, concise, direct, and consistent with established codebase patterns. Preserve the required `Context` and `Implementation Steps` structure and the test-driven development requirements.

Make no edits when the plan contains no errors and omits no important considerations. In that case, report that the review found no necessary changes. Do not implement the plan as part of the review.
