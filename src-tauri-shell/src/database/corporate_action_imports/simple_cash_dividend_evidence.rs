//! Pure evidence classification only; not an autonomous approval decision.
//!
//! The conservative Dividend R1 policy uses this classifier during read-only
//! preparation and freshly rechecks it in the guarded explicit-approval writer.
//! NSE/source/identity/PENDING/event-date, same-date-peer and price safeguards
//! are separate and remain mandatory before any write.

use super::{
    compound_action_primary_type, contains_inclusive_dividend_total, looks_like_unit_distribution,
    normalize_text, normalized_dividend_marker_count, normalized_token_position,
    parse_corporate_action_purpose, positive_number,
};

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) enum SimpleCashDividendEvidence {
    EligibleSimpleCash(f64),
    Ineligible(SimpleCashDividendReason),
}

/// Typed reasons, independent of the legacy parser's human-readable messages.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum SimpleCashDividendReason {
    EmptyPurpose,
    NotDividend,
    CompoundAction,
    UnitOrMixedDistribution,
    InclusiveOrSpecialDividend,
    MultipleDividendComponents,
    NotSimpleExplicitPerShareCash,
    ExistingParserDidNotConfirm,
    MissingStoredCashAmount,
    InvalidStoredCashAmount,
    StoredCashAmountMismatch,
}

impl SimpleCashDividendReason {
    /// Fixed diagnostics only. No event wording, security identity, cash amount,
    /// or user-selected override enters the proof/approval contract.
    pub(crate) fn diagnostic_label(self) -> &'static str {
        use SimpleCashDividendReason::*;
        match self {
            EmptyPurpose => "Empty or missing dividend announcement wording",
            NotDividend => "Announcement is not a recognized cash dividend",
            CompoundAction => "Dividend combined with another corporate action",
            UnitOrMixedDistribution => "Per-unit or mixed cash/noncash distribution",
            InclusiveOrSpecialDividend => "Special or inclusive multi-component dividend",
            MultipleDividendComponents => "Multiple ordinary dividend components",
            NotSimpleExplicitPerShareCash => {
                "Unrecognized or qualified single-cash per-share wording"
            }
            ExistingParserDidNotConfirm => {
                "Stored official parser did not confirm a positive single cash amount"
            }
            MissingStoredCashAmount => "Stored dividend cash amount is absent",
            InvalidStoredCashAmount => "Stored dividend cash amount is invalid",
            StoredCashAmountMismatch => "Parsed and stored cash amounts disagree",
        }
    }
}

/// Accept a deliberately small, whole-purpose grammar, then obtain the amount
/// from the existing parser. Unsupported wording stays manual-only: this does
/// not alter what the existing parser or manual approval path can accept.
///
/// Grammar: [Annual General Meeting And|/] [Interim|Final] Dividend|Div
///          [-|:] Rs[.]|Re[.]|INR|₹ unsigned-decimal [/-] per share[.]
/// The optional full "Annual General Meeting" context must be followed by
/// exactly AND, slash, or space-slash-space. Other qualifiers are NOT removed.
/// Case and whitespace are ignored; no rounding, percentage conversion, grouped
/// numerals, numeric aggregation, or interpretation of qualifiers is performed.
pub(crate) fn classify_simple_cash_dividend_evidence(
    purpose_raw: &str,
) -> SimpleCashDividendEvidence {
    use SimpleCashDividendEvidence::{EligibleSimpleCash, Ineligible};
    use SimpleCashDividendReason::*;

    let normalized = normalize_text(purpose_raw);
    if normalized.is_empty() {
        return Ineligible(EmptyPurpose);
    }
    // Reuse the parser's unit recognition, and reject mixed cash labels even
    // when they appear alongside a per-share dividend rather than a per-unit one.
    if looks_like_unit_distribution(&normalized)
        || normalized.contains("PER UNIT")
        || [
            "DISTRIBUTION",
            "DISTRITBUTION",
            "INTEREST",
            "PRINCIPAL",
            "REPAYMENT",
        ]
        .iter()
        .any(|marker| normalized_token_position(&normalized, marker).is_some())
        || normalized.contains("OTHER INCOME")
        || normalized.contains("RETURN OF CAPITAL")
        || normalized.contains("RETURN ON CAPITAL")
    {
        return Ineligible(UnitOrMixedDistribution);
    }
    if normalized_dividend_marker_count(&normalized) == 0 {
        return Ineligible(NotDividend);
    }
    if compound_action_primary_type(&normalized).is_some()
        || ["DEMERGER", "SPINOFF", "ARRANGEMENT", "MERGER", "BUYBACK"]
            .iter()
            .any(|marker| normalized_token_position(&normalized, marker).is_some())
        || normalized.contains("DE MERGER")
        || normalized.contains("SPIN OFF")
        || normalized.contains("BUY BACK")
    {
        return Ineligible(CompoundAction);
    }
    if contains_inclusive_dividend_total(&normalized)
        || normalized_token_position(&normalized, "SPECIAL").is_some()
    {
        return Ineligible(InclusiveOrSpecialDividend);
    }
    if normalized_dividend_marker_count(&normalized) != 1 {
        return Ineligible(MultipleDividendComponents);
    }
    if !has_simple_per_share_cash_form(purpose_raw) {
        return Ineligible(NotSimpleExplicitPerShareCash);
    }

    let parsed = parse_corporate_action_purpose(purpose_raw);
    if parsed.action_type != "DIVIDEND"
        || parsed.parse_status != "PARSED"
        || parsed.factor.is_some()
        || parsed.price_factor.is_some()
    {
        return Ineligible(ExistingParserDidNotConfirm);
    }
    match parsed.cash_amount.and_then(positive_number) {
        Some(amount) => EligibleSimpleCash(amount),
        None => Ineligible(ExistingParserDidNotConfirm),
    }
}

/// Check a caller-supplied stored value; no database lookup occurs here.
/// Both values use the existing positive finite f64 representation. Exact
/// numeric equality is intentional: do not introduce an epsilon or cash rounding.
pub(crate) fn revalidate_simple_cash_dividend_evidence(
    purpose_raw: &str,
    stored_cash_amount: Option<f64>,
) -> SimpleCashDividendEvidence {
    use SimpleCashDividendEvidence::{EligibleSimpleCash, Ineligible};
    use SimpleCashDividendReason::*;

    let amount = match classify_simple_cash_dividend_evidence(purpose_raw) {
        EligibleSimpleCash(amount) => amount,
        ineligible => return ineligible,
    };
    let Some(stored) = stored_cash_amount else {
        return Ineligible(MissingStoredCashAmount);
    };
    if positive_number(stored).is_none() {
        return Ineligible(InvalidStoredCashAmount);
    }
    if stored != amount {
        return Ineligible(StoredCashAmountMismatch);
    }
    EligibleSimpleCash(amount)
}

/// Lexical restriction, not another amount parser. In particular this blocks
/// negative/cancelled/conditional or partially parsed amounts that a broader
/// manual parser might otherwise accept. Only the existing parser converts f64.
fn has_simple_per_share_cash_form(purpose_raw: &str) -> bool {
    let mut compact = purpose_raw
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase();
    for rev_suffix in [
        " (PURPOSE REVISED)",
        "(PURPOSE REVISED)",
        " (BC DATES REVISED)",
        "(BC DATES REVISED)",
        " (BOOK CLOSURE DATES REVISED)",
    ] {
        if let Some(stripped) = compact.strip_suffix(rev_suffix) {
            compact = stripped.trim_end().to_string();
            break;
        }
    }
    let cash_description = [
        "ANNUAL GENERAL MEETING AND ",
        "ANNUAL GENERAL MEETING / ",
        "ANNUAL GENERAL MEETING/",
        "AGM AND ",
        "AGM / ",
        "AGM/",
    ]
    .iter()
    .find_map(|prefix| compact.strip_prefix(*prefix))
    .map(str::trim_start)
    .unwrap_or(compact.as_str());
    let Some(without_suffix) = [
        " PER EQUITY SHARE.",
        " PER EQUITY SHARE",
        "/-PER EQUITY SHARE.",
        "/-PER EQUITY SHARE",
        " PER SHARE.",
        " PER SHARE",
        "/-PER SHARE.",
        "/-PER SHARE",
        " PR SHARE.",
        " PR SHARE",
        " PER SH.",
        " PER SH",
    ]
    .iter()
    .find_map(|suffix| cash_description.strip_suffix(*suffix)) else {
        return false;
    };
    let without_ordinal = [
        "1ST ", "2ND ", "3RD ", "4TH ", "5TH ", "FIRST ", "SECOND ", "THIRD ", "FOURTH ",
    ]
    .iter()
    .find_map(|ord| without_suffix.strip_prefix(*ord))
    .map(str::trim_start)
    .unwrap_or(without_suffix);
    let Some(remainder) = [
        "INTERIM DIVIDEND",
        "INTERIM DIV",
        "INT DIVIDEND",
        "INT DIV",
        "INTDIVIDEND",
        "FINAL DIVIDEND",
        "FINAL DIV",
        "DIVIDEND",
        "DIV",
    ]
    .iter()
    .find_map(|prefix| {
        without_ordinal.strip_prefix(*prefix).filter(|remaining| {
            remaining.starts_with(' ') || remaining.starts_with('-') || remaining.starts_with(':')
        })
    }) else {
        return false;
    };
    let remainder = remainder.trim_start();
    let remainder = remainder
        .strip_prefix('-')
        .or_else(|| remainder.strip_prefix(':'))
        .unwrap_or(remainder)
        .trim_start();
    let remainder = remainder
        .strip_prefix("OF ")
        .map(str::trim_start)
        .unwrap_or(remainder);
    let Some(number) = ["RS.", "RS", "RE.", "RE", "INR", "₹"]
        .iter()
        .find_map(|marker| remainder.strip_prefix(*marker))
    else {
        return false;
    };
    let number = number.trim();
    let number = number.strip_suffix("/-").unwrap_or(number).trim_end();
    let mut parts = number.split('.');
    let integral = parts.next().unwrap_or_default();
    if integral.is_empty() || !integral.bytes().all(|ch| ch.is_ascii_digit()) {
        return false;
    }
    if let Some(fractional) = parts.next() {
        if fractional.is_empty() || !fractional.bytes().all(|ch| ch.is_ascii_digit()) {
            return false;
        }
    }
    parts.next().is_none()
}
