# CreatorPilot Repository Guide

This repository contains CreatorPilot, an AI multi-agent YouTube production studio.

## Read before working

- Read `docs/PROJECT_SPEC.md` before product work.
- Read `docs/FRONTEND_DESIGNER.md` before frontend work.
- Review `docs/DESIGN_REFERENCES.md` before major design implementation.
- Inspect existing files and conventions before editing.

## Authority

- Direct user instructions take priority for the current task.
- This file defines repository-wide boundaries. `docs/PROJECT_SPEC.md` defines
  product scope, and `docs/FRONTEND_DESIGNER.md` defines frontend workflow.
- Task plans and design references may add detail but must not override those
  boundaries. Stop and report a conflict that cannot be resolved by this order.

## Plans

- Write major frontend plans under `docs/plans/active/`.
- Move completed plans to `docs/plans/completed/`.

## Boundaries

- Do not modify backend calculations, cost data, database schemas, authentication,
  secrets, or deployment settings without explicit approval.
- Do not merge, deploy, push, delete, rewrite history, force-push, run `git clean`,
  or run destructive reset operations without explicit approval.
- Follow the approval boundaries in `docs/FRONTEND_DESIGNER.md` for frontend work.

## Validation and reporting

- Run relevant tests and inspect the application in a browser before claiming
  completion.
- Report honestly when browser testing, network research, or another validation
  step was not available.
