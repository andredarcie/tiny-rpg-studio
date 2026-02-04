# Agent Instructions

- After completing any task that changes code or tests, always run:
  - `npm run lint`
  - `npm run test:run`
  - `npx tsc --noEmit`
- If any command fails, explicitly state that the errors must be fixed before finishing, and report the relevant error output.
