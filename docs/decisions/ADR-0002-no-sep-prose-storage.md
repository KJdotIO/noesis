# ADR-0002: No SEP prose storage

Date: 2026-02-16
Status: Accepted

## Context

SEP terms allow reading, linking, and crawling for indexing, but restrict broader electronic redistribution of entry content.

## Decision

Do not store or serve SEP prose in shared backend tables.

Allowed catalogue fields include title, creators, issued date, modified date, canonical URL, slug, and related-entry links.

## Why

This keeps legal and project risk low for a public side project.

## Trade-offs

- Card previews are less rich without snippets
- Discovery UX must lean on metadata and user signals

## Alternatives considered

1. Store first paragraph snippets
2. Store preamble HTML

## Rollout

Ship metadata-only catalogue first. Reconsider snippets only with explicit written permission.

## Revisit trigger

Revisit if SEP editors grant clear written permission for bounded snippets.
