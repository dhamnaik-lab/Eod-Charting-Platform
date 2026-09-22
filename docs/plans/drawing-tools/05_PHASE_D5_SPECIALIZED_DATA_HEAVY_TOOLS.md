# Phase D5 — Specialized / Data-Heavy Drawing Tools

**Status:** PLANNED — NOT IMPLEMENTED

## 1. Goal

Handle the small set of tools that need data copying, structured content, or behavior materially different from ordinary geometry.

## 2. Planned tools

- Bars Pattern
- Table

## 3. Bars Pattern

This tool is potentially data-heavy.

Before implementation define:

- source range selection;
- whether copied bars are normalized or absolute;
- projection anchor;
- OHLC preservation;
- scaling;
- maximum source bars;
- behavior after underlying data changes;
- persistence size.

Do not duplicate entire historical datasets into every drawing unless required.

Prefer compact parameters sufficient to reconstruct the pattern from chart data when possible.

## 4. Table

Define whether this is:

- a static annotation table;
- user-editable cells;
- data-bound content.

Initial implementation should be static/user-authored unless a separate data-binding feature is explicitly requested.

Must define:

- rows/columns limits;
- font and alignment;
- resize behavior;
- persistence;
- hit testing.

## 5. Reference tools explicitly not available for porting

The uploaded repository documentation mentions several concepts without implementation. These are **not part of D1-D5**:

- Ghost Feed
- Anchored VWAP drawing
- Fixed Range Volume Profile
- Anchored Volume Profile
- Image
- Tweet
- Idea

If desired later, each requires a separate design/audit rather than assuming the uploaded repository provides working source.

## 6. Exit gate

D5 acceptance completes the planned drawing expansion only for the tools explicitly approved in D1-D5. Unimplemented reference concepts remain deferred.
