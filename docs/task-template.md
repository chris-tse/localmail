# XXX Feature Name — Tasks

Each task below is independently executable. Tasks are ordered by dependency.
Status key: `[ ]` pending, `[~]` in progress, `[x]` done, `[-]` skipped/cancelled.

---

## Task 1: [Brief task description]
- [ ] [Specific actionable step]
- [ ] [Specific actionable step]

**File:** `path/to/file.ts`
**Depends on:** Task X (if applicable)
**Verify:** `bunx tsc --noEmit` (no unresolved module errors)

---

## Task 2: [Brief task description]
- [ ] [Specific actionable step with details]
- [ ] [Specific actionable step]
  - [ ] [Sub-step if needed]
  - [ ] [Sub-step if needed]

**Files:** `path/to/file.ts`, `path/to/other.ts`
**Depends on:** Task X
**Verify:** `bunx tsc --noEmit` passes, `bun test` passes

---

## Task N: Write tests
- [ ] Create `src/server/feature-name.test.ts` (colocated with source file)
  - [ ] Test: [scenario description]
  - [ ] Test: [scenario description]
  - [ ] Test: [error case]

**Verify:** `bun test` passes

---

## Final verification
- [ ] `bunx tsc --noEmit` passes
- [ ] `bun test` passes
- [ ] All output files exist per plan.md
- [ ] Update plan.md status from `pending` to `done`

---

## Manual E2E Testing (if applicable)
- [ ] [Test scenario description]
- [ ] [Test scenario description]
- [ ] [Error case to verify]

---

## Notes

- Use `bun` for running scripts, `bunx` for CLI tools
- Keep tasks atomic and independently verifiable
- Include **Depends on:** when a task requires previous tasks
- Include **Verify:** with concrete commands to run
- Colocate tests with source files (e.g., `feature.ts` + `feature.test.ts`)
- Use descriptive variable names, no magic numbers
