# Web Prototype Status

This policy defines how the legacy web prototype is handled after Godot cutover.

## Current State

- Status: maintenance mode
- Role:
  - behavioral reference for parity checks
  - backup runnable prototype
  - source lookup during migration tuning

## Allowed Changes

- Bug fixes that block validation or create misleading parity behavior.
- Tooling/runtime fixes needed to keep the prototype runnable.
- Documentation updates that clarify controls, expected behavior, or test flows.

## Disallowed Changes (Without Explicit Approval)

- New gameplay features not also planned for Godot.
- Major refactors unrelated to parity validation.
- Visual/content expansions that increase migration scope.

## Decision Rule

If a change request affects gameplay behavior, implement in Godot first.  
Only mirror to web when needed for parity comparison or regression verification.

## Exit Path

When the team confirms Godot-only development, this document can be replaced with a full deprecation notice and archive instructions.
