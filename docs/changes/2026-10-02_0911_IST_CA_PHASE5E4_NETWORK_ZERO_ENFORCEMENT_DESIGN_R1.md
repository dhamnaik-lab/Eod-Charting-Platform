# CA Phase5E4 — Network Zero Enforcement Design R1

IST timestamp: 2026-10-02T09:11:30.304690+05:30

## Objective
Freeze a fail-closed enforcement design for the next separately authorized Phase5E4 network validation.

## Authority
Parent Network Acceptance Boundary Decision evidence SHA256: `7282600AAC35BDFFD6E64FC362470D8B87A146BB07069037B0D9C5F5D7A58A5A`.
Frozen decision: `RETAIN_STRICT_NETWORK_ZERO__NO_RETROACTIVE_WAIVER`.

## Final design
Selected architecture: **TEMPORARY_MACHINE_WIDE_EXPLICIT_OUTBOUND_BLOCK_ALL_NON_LOOPBACK_R1**.

Two temporary run-owned outbound Block rules will cover all non-loopback IPv4/IPv6 destinations for all programs/services, all profiles and all interface types. IPv4 loopback `127.0.0.0/8` and IPv6 loopback `::1` remain available for local IPC. Effective-policy proof in `ActiveStore`, absence of enabled outbound `OverrideBlockRules` rules, firewall service/profile health, live process-tree monitoring, WFP blocked-event evidence, exact cleanup and PRE/POST restoration are mandatory.

The design deliberately uses machine-wide isolation instead of per-program child enumeration. It deliberately rejects `DefaultOutboundAction=Block` as the sole mechanism because ordinary explicit allow rules can override a default block, while explicit Block rules take precedence over ordinary conflicting allow rules. Outbound allow-bypass rules remain a hard preflight blocker.

## Files changed
Product/source/build/dist/portable/database/firewall/audit policy: none. This design record is the only intended project write.

## Behaviour preserved
No retroactive waiver. Existing RESUME5 functional/database evidence remains preserved. Strict network=0 remains pending until a new separately authorized enforced validation passes.

## Validation
Package/authority/design selftests passed before delivery. Independent address-coverage model:
```json
{
  "ipv4Loopback127_0_0_1Excluded": true,
  "ipv4Loopback127_255_255_255Excluded": true,
  "ipv4Private10Blocked": true,
  "ipv4Private192Blocked": true,
  "ipv4PublicBlocked": true,
  "ipv4LinkLocalBlocked": true,
  "ipv6LoopbackExcluded": true,
  "ipv6LinkLocalBlocked": true,
  "ipv6GlobalBlocked": true,
  "ipv4MappedBlocked": true
}
```

## Risks / limitations
The chosen `PersistentStore` rules have documented immediate ActiveStore activation but may survive abnormal termination/reboot. Therefore a SHA-bound recovery script, exact rule names, `finally` cleanup, residue guard, and verified restoration are mandatory in the implementation/rehearsal. This design does not authorize those mutations.

## Rollback
Design-only. No firewall/database/product rollback required.

## Next
`CA_PHASE5E4_NETWORK_ZERO_ENFORCEMENT_REHEARSAL_R1` — firewall-only rehearsal with no EOD launch, no Load & Prepare and no database action. Separate explicit approval required.
