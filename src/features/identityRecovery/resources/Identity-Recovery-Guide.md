# Identity Recovery & AI Handoff Guide

This guide explains the built-in export documents available from **Identity Import Info → Recovery & AI Handoff**.

## What this feature does

It gives you portable Markdown documents that can be saved from the application and handed to any external AI or human researcher.

**AI is optional.** The same documents can be used by a human analyst.

## What this feature does not do

- It does not browse the web.
- It does not call an AI provider.
- It does not read or modify the database for the export.
- It does not change NSE/BSE source URLs.
- It does not Apply Identity changes.
- It does not bypass the existing reviewed Preview or existing reviewed Apply authority.

## Which document to export

### Export Source Recovery Brief

Use this when an official NSE/BSE URL stops working, redirects unexpectedly, changes schema, or returns the wrong content.

Fill the placeholders with the old URL, purpose, failure, expected format/schema, and any known official-domain constraints. Give the file to an AI or researcher and ask for the current **official** replacement candidate.

### Export Identity Investigation Brief

Use this when a symbol, ISIN, or company-name mismatch cannot be resolved safely from the application's current deterministic evidence.

Fill the known local/current Identity facts and ask the researcher for official symbol-change, name-change, ISIN-continuity, delisting, or corporate-event evidence.

### Export Recovery Guide

Use this when you want a portable explanation of the recovery workflow itself.

## Authority boundary

The central rule is:

```text
AI may help find evidence.
AI never becomes Identity authority.
```

An AI result is only a candidate. The application/user must validate official provenance, source contract, schema, effective dates, and Identity continuity independently.

Final writes remain behind the existing reviewed workflow:

```text
official evidence
→ deterministic/local validation
→ existing reviewed Preview
→ human review
→ existing reviewed Apply
```

## Current source priority

At the time this guide was created:

```text
Primary routine Identity source: NSE Official
Fallback/recovery: NSE Manual historical archive
BSE historical/data-parity acceptance: deferred
```

Future ER work may auto-fill these briefs from source contracts and failure diagnostics, but this first built-in version is deliberately offline and export-only.
