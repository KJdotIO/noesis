# ADR-0001: Extension-first UX split

Date: 2026-02-16
Status: Accepted

## Context

The main user value is in-page reading actions (highlight, note, resume) on SEP pages. A web app alone cannot reliably provide this experience on third-party pages.

## Decision

Use an extension-first UX model.

- Extension handles capture, highlights, notes, and reading position
- Web app handles account, saved library, recommendations, and export

## Why

This gives low-friction daily usage while keeping long-form management in one place.

## Trade-offs

- Desktop-first at launch
- Added extension review and release process

## Alternatives considered

1. Web-only product
2. Web app as primary, extension optional

## Rollout

Start with extension guest mode and local storage, then add account sync.

## Revisit trigger

Revisit when mobile support becomes a v2 priority.
