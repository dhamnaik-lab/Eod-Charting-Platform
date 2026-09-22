//! ER2-A contract authority + ER2-B deterministic Identity resolver.
//!
//! ER2-A freezes contract vocabulary, A-I rule metadata, provenance and
//! fail-closed validation. ER2-B adds pure deterministic A-I evaluation only;
//! database, network, Tauri, UI and Apply authority remain outside this module.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverStatus {
    #[serde(rename = "CONFIRMED")]
    Confirmed,
    #[serde(rename = "PROBABLE_REVIEW")]
    ProbableReview,
    #[serde(rename = "CONFLICT")]
    Conflict,
    #[serde(rename = "INSUFFICIENT_EVIDENCE")]
    InsufficientEvidence,
    #[serde(rename = "SOURCE_UNAVAILABLE")]
    SourceUnavailable,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverConclusion {
    #[serde(rename = "SYMBOL_CHANGE")]
    SymbolChange,
    #[serde(rename = "NAME_CHANGE")]
    NameChange,
    #[serde(rename = "SYMBOL_AND_NAME_CHANGE")]
    SymbolAndNameChange,
    #[serde(rename = "ISIN_CONTINUITY")]
    IsinContinuity,
    #[serde(rename = "SAME_SECURITY_NO_IDENTITY_SPLIT")]
    SameSecurityNoIdentitySplit,
    #[serde(rename = "CONFLICTING_IDENTITY")]
    ConflictingIdentity,
    #[serde(rename = "NO_CONCLUSION")]
    NoConclusion,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverConfidenceClass {
    #[serde(rename = "DETERMINISTIC")]
    Deterministic,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverAuthorityClass {
    #[serde(rename = "OFFICIAL_EXCHANGE_STRUCTURED")]
    OfficialExchangeStructured,
    #[serde(rename = "OFFICIAL_REGULATOR_OR_DEPOSITORY")]
    OfficialRegulatorOrDepository,
    #[serde(rename = "OFFICIAL_ISSUER_FILING")]
    OfficialIssuerFiling,
    #[serde(rename = "EXTERNAL_DISCOVERY_CANDIDATE")]
    ExternalDiscoveryCandidate,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverEvidenceKind {
    #[serde(rename = "CURRENT_MASTER")]
    CurrentMaster,
    #[serde(rename = "SYMBOL_CHANGE")]
    SymbolChange,
    #[serde(rename = "NAME_CHANGE")]
    NameChange,
    #[serde(rename = "ISIN_CHANGE")]
    IsinChange,
    #[serde(rename = "SERIES_CHANGE")]
    SeriesChange,
    #[serde(rename = "DELISTING")]
    Delisting,
    #[serde(rename = "LISTING")]
    Listing,
    #[serde(rename = "LIFECYCLE_STATUS")]
    LifecycleStatus,
    #[serde(rename = "HISTORICAL_IDENTITY")]
    HistoricalIdentity,
    #[serde(rename = "OTHER_OFFICIAL")]
    OtherOfficial,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverSourceAvailability {
    #[serde(rename = "AVAILABLE")]
    Available,
    #[serde(rename = "UNAVAILABLE")]
    Unavailable,
    #[serde(rename = "UNTRUSTED_OR_INVALID")]
    UntrustedOrInvalid,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct IdentityResolverLocalIdentity {
    pub exchange: String,
    pub symbol: String,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub company_name: Option<String>,
    pub lifecycle_state: Option<String>,
    pub effective_from: Option<String>,
    pub effective_to: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct IdentityResolverOfficialIdentity {
    pub exchange: String,
    pub symbol: String,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub company_name: Option<String>,
    pub lifecycle_state: Option<String>,
    pub effective_date: Option<String>,
    pub source_id: String,
    pub evidence_id: String,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct IdentityResolverEvidence {
    pub evidence_id: String,
    pub exchange: String,
    pub authority_class: IdentityResolverAuthorityClass,
    pub source_id: String,
    pub source_reference: String,
    pub content_sha256: String,
    pub retrieved_at_ist: String,
    pub effective_date: Option<String>,
    pub symbol: Option<String>,
    pub old_symbol: Option<String>,
    pub new_symbol: Option<String>,
    pub series: Option<String>,
    pub isin: Option<String>,
    pub company_name: Option<String>,
    pub evidence_kind: IdentityResolverEvidenceKind,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct IdentityResolverInput {
    pub local_identity: IdentityResolverLocalIdentity,
    pub official_identity: Option<IdentityResolverOfficialIdentity>,
    pub evidence: Vec<IdentityResolverEvidence>,
    pub required_source_health: IdentityResolverSourceAvailability,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverRuleFamily {
    #[serde(rename = "A")]
    A,
    #[serde(rename = "B")]
    B,
    #[serde(rename = "C")]
    C,
    #[serde(rename = "D")]
    D,
    #[serde(rename = "E")]
    E,
    #[serde(rename = "F")]
    F,
    #[serde(rename = "G")]
    G,
    #[serde(rename = "H")]
    H,
    #[serde(rename = "I")]
    I,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub(crate) enum IdentityResolverRuleId {
    #[serde(rename = "SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY_V1")]
    SymbolChangeSameIsinOfficialHistoryV1,
    #[serde(rename = "NAME_CHANGE_SAME_IDENTITY_OFFICIAL_HISTORY_V1")]
    NameChangeSameIdentityOfficialHistoryV1,
    #[serde(rename = "SYMBOL_AND_NAME_CHANGE_OFFICIAL_CONTINUITY_V1")]
    SymbolAndNameChangeOfficialContinuityV1,
    #[serde(rename = "ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1")]
    IsinChangeRequiresExplicitContinuityV1,
    #[serde(rename = "ACTIVE_DUPLICATE_ISIN_CONFLICT_V1")]
    ActiveDuplicateIsinConflictV1,
    #[serde(rename = "DELISTED_INACTIVE_NOT_SYMBOL_CHANGE_V1")]
    DelistedInactiveNotSymbolChangeV1,
    #[serde(rename = "RECYCLED_SYMBOL_REQUIRES_IDENTITY_HISTORY_V1")]
    RecycledSymbolRequiresIdentityHistoryV1,
    #[serde(rename = "SERIES_CHANGE_NOT_NEW_SECURITY_BY_DEFAULT_V1")]
    SeriesChangeNotNewSecurityByDefaultV1,
    #[serde(rename = "INCOMPLETE_HISTORY_REQUIRES_MORE_EVIDENCE_V1")]
    IncompleteHistoryRequiresMoreEvidenceV1,
    #[serde(rename = "REQUIRED_OFFICIAL_SOURCE_UNAVAILABLE_V1")]
    RequiredOfficialSourceUnavailableV1,
    #[serde(rename = "NO_DETERMINISTIC_IDENTITY_RULE_MATCH_V1")]
    NoDeterministicIdentityRuleMatchV1,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub(crate) enum IdentityResolverPrecedenceClass {
    SourceUnavailable,
    HardConflict,
    ExplicitHighRiskContinuity,
    OrdinaryConfirmation,
    ProbableReview,
    InsufficientEvidence,
}

impl IdentityResolverPrecedenceClass {
    pub(crate) const fn rank(self) -> u8 {
        match self {
            Self::SourceUnavailable => 0,
            Self::HardConflict => 1,
            Self::ExplicitHighRiskContinuity => 2,
            Self::OrdinaryConfirmation => 3,
            Self::ProbableReview => 4,
            Self::InsufficientEvidence => 5,
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct IdentityResolverRuleMetadata {
    pub family: IdentityResolverRuleFamily,
    pub rule_id: IdentityResolverRuleId,
    pub precedence: IdentityResolverPrecedenceClass,
    pub permitted_statuses: &'static [IdentityResolverStatus],
    pub permitted_conclusions: &'static [IdentityResolverConclusion],
    pub minimum_evidence_kinds: &'static [IdentityResolverEvidenceKind],
}

pub(crate) static IDENTITY_RESOLVER_RULE_MATRIX_V1: [IdentityResolverRuleMetadata; 9] = [
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::A,
        rule_id: IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1,
        precedence: IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        permitted_statuses: &[IdentityResolverStatus::Confirmed],
        permitted_conclusions: &[IdentityResolverConclusion::SymbolChange],
        minimum_evidence_kinds: &[
            IdentityResolverEvidenceKind::CurrentMaster,
            IdentityResolverEvidenceKind::SymbolChange,
        ],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::B,
        rule_id: IdentityResolverRuleId::NameChangeSameIdentityOfficialHistoryV1,
        precedence: IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        permitted_statuses: &[IdentityResolverStatus::Confirmed],
        permitted_conclusions: &[IdentityResolverConclusion::NameChange],
        minimum_evidence_kinds: &[
            IdentityResolverEvidenceKind::CurrentMaster,
            IdentityResolverEvidenceKind::NameChange,
        ],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::C,
        rule_id: IdentityResolverRuleId::SymbolAndNameChangeOfficialContinuityV1,
        precedence: IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        permitted_statuses: &[IdentityResolverStatus::Confirmed],
        permitted_conclusions: &[IdentityResolverConclusion::SymbolAndNameChange],
        minimum_evidence_kinds: &[
            IdentityResolverEvidenceKind::CurrentMaster,
            IdentityResolverEvidenceKind::SymbolChange,
            IdentityResolverEvidenceKind::NameChange,
        ],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::D,
        rule_id: IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
        precedence: IdentityResolverPrecedenceClass::ExplicitHighRiskContinuity,
        permitted_statuses: &[
            IdentityResolverStatus::Confirmed,
            IdentityResolverStatus::Conflict,
        ],
        permitted_conclusions: &[
            IdentityResolverConclusion::IsinContinuity,
            IdentityResolverConclusion::ConflictingIdentity,
        ],
        minimum_evidence_kinds: &[IdentityResolverEvidenceKind::IsinChange],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::E,
        rule_id: IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
        precedence: IdentityResolverPrecedenceClass::HardConflict,
        permitted_statuses: &[IdentityResolverStatus::Conflict],
        permitted_conclusions: &[IdentityResolverConclusion::ConflictingIdentity],
        minimum_evidence_kinds: &[IdentityResolverEvidenceKind::CurrentMaster],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::F,
        rule_id: IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1,
        precedence: IdentityResolverPrecedenceClass::HardConflict,
        permitted_statuses: &[IdentityResolverStatus::Conflict],
        permitted_conclusions: &[IdentityResolverConclusion::ConflictingIdentity],
        minimum_evidence_kinds: &[IdentityResolverEvidenceKind::Delisting],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::G,
        rule_id: IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1,
        precedence: IdentityResolverPrecedenceClass::HardConflict,
        permitted_statuses: &[IdentityResolverStatus::Conflict],
        permitted_conclusions: &[IdentityResolverConclusion::ConflictingIdentity],
        minimum_evidence_kinds: &[IdentityResolverEvidenceKind::HistoricalIdentity],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::H,
        rule_id: IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
        precedence: IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        permitted_statuses: &[IdentityResolverStatus::Confirmed],
        permitted_conclusions: &[IdentityResolverConclusion::SameSecurityNoIdentitySplit],
        minimum_evidence_kinds: &[IdentityResolverEvidenceKind::SeriesChange],
    },
    IdentityResolverRuleMetadata {
        family: IdentityResolverRuleFamily::I,
        rule_id: IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        precedence: IdentityResolverPrecedenceClass::InsufficientEvidence,
        permitted_statuses: &[IdentityResolverStatus::InsufficientEvidence],
        permitted_conclusions: &[IdentityResolverConclusion::NoConclusion],
        minimum_evidence_kinds: &[],
    },
];

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub(crate) struct IdentityResolverResult {
    pub status: IdentityResolverStatus,
    pub conclusion: IdentityResolverConclusion,
    pub rule_id: IdentityResolverRuleId,
    pub confidence_class: IdentityResolverConfidenceClass,
    pub evidence_ids: Vec<String>,
    pub explanation: String,
}

fn is_blank(value: &str) -> bool {
    value.trim().is_empty()
}

fn is_authoritative(authority_class: IdentityResolverAuthorityClass) -> bool {
    authority_class != IdentityResolverAuthorityClass::ExternalDiscoveryCandidate
}

fn is_positive_conclusion(conclusion: IdentityResolverConclusion) -> bool {
    matches!(
        conclusion,
        IdentityResolverConclusion::SymbolChange
            | IdentityResolverConclusion::NameChange
            | IdentityResolverConclusion::SymbolAndNameChange
            | IdentityResolverConclusion::IsinContinuity
            | IdentityResolverConclusion::SameSecurityNoIdentitySplit
    )
}

fn rule_metadata(
    rule_id: IdentityResolverRuleId,
) -> Option<&'static IdentityResolverRuleMetadata> {
    IDENTITY_RESOLVER_RULE_MATRIX_V1
        .iter()
        .find(|metadata| metadata.rule_id == rule_id)
}

pub(crate) fn validate_resolver_input_contract(
    input: &IdentityResolverInput,
) -> Result<(), String> {
    if is_blank(&input.local_identity.exchange) {
        return Err("ER2A_LOCAL_EXCHANGE_REQUIRED".to_string());
    }

    if is_blank(&input.local_identity.symbol) {
        return Err("ER2A_LOCAL_SYMBOL_REQUIRED".to_string());
    }

    let mut evidence_ids = HashSet::new();

    for evidence in &input.evidence {
        if is_blank(&evidence.evidence_id) {
            return Err("ER2A_EVIDENCE_ID_REQUIRED".to_string());
        }

        if !evidence_ids.insert(evidence.evidence_id.as_str()) {
            return Err(format!(
                "ER2A_DUPLICATE_EVIDENCE_ID: {}",
                evidence.evidence_id
            ));
        }

        if is_blank(&evidence.exchange) {
            return Err(format!(
                "ER2A_EVIDENCE_EXCHANGE_REQUIRED: {}",
                evidence.evidence_id
            ));
        }

        if is_blank(&evidence.retrieved_at_ist) {
            return Err(format!(
                "ER2A_EVIDENCE_RETRIEVED_AT_REQUIRED: {}",
                evidence.evidence_id
            ));
        }

        if is_authoritative(evidence.authority_class)
            && (is_blank(&evidence.source_id)
                || is_blank(&evidence.source_reference)
                || is_blank(&evidence.content_sha256))
        {
            return Err(format!(
                "ER2A_AUTHORITATIVE_EVIDENCE_PROVENANCE_REQUIRED: {}",
                evidence.evidence_id
            ));
        }
    }

    if let Some(official) = &input.official_identity {
        if is_blank(&official.exchange)
            || is_blank(&official.symbol)
            || is_blank(&official.source_id)
            || is_blank(&official.evidence_id)
        {
            return Err("ER2A_OFFICIAL_IDENTITY_PROVENANCE_REQUIRED".to_string());
        }

        let official_evidence = input
            .evidence
            .iter()
            .find(|evidence| evidence.evidence_id == official.evidence_id)
            .ok_or_else(|| {
                format!(
                    "ER2A_OFFICIAL_IDENTITY_EVIDENCE_NOT_FOUND: {}",
                    official.evidence_id
                )
            })?;

        if !is_authoritative(official_evidence.authority_class) {
            return Err(format!(
                "ER2A_OFFICIAL_IDENTITY_REQUIRES_AUTHORITATIVE_EVIDENCE: {}",
                official.evidence_id
            ));
        }

        if official_evidence.exchange.trim() != official.exchange.trim()
            || official_evidence.source_id.trim() != official.source_id.trim()
        {
            return Err(format!(
                "ER2A_OFFICIAL_IDENTITY_EVIDENCE_PROVENANCE_MISMATCH: {}",
                official.evidence_id
            ));
        }
    }

    Ok(())
}

pub(crate) fn validate_resolver_result_contract(
    input: &IdentityResolverInput,
    result: &IdentityResolverResult,
) -> Result<(), String> {
    validate_resolver_input_contract(input)?;

    if is_blank(&result.explanation) {
        return Err("ER2A_RESULT_EXPLANATION_REQUIRED".to_string());
    }

    if result.rule_id == IdentityResolverRuleId::NoDeterministicIdentityRuleMatchV1 {
        return Err("ER2A_RESERVED_RULE_NOT_ENABLED".to_string());
    }

    if result.status == IdentityResolverStatus::Conflict
        && is_positive_conclusion(result.conclusion)
    {
        return Err("ER2A_CONFLICT_POSITIVE_CONCLUSION_INVALID".to_string());
    }

    if result.status == IdentityResolverStatus::Confirmed
        && matches!(
            result.conclusion,
            IdentityResolverConclusion::ConflictingIdentity
                | IdentityResolverConclusion::NoConclusion
        )
    {
        return Err("ER2A_CONFIRMED_CONCLUSION_INVALID".to_string());
    }

    if result.status == IdentityResolverStatus::InsufficientEvidence
        && result.conclusion != IdentityResolverConclusion::NoConclusion
    {
        return Err("ER2A_INSUFFICIENT_EVIDENCE_CONCLUSION_INVALID".to_string());
    }

    if result.status == IdentityResolverStatus::SourceUnavailable
        && result.conclusion != IdentityResolverConclusion::NoConclusion
    {
        return Err("ER2A_SOURCE_UNAVAILABLE_CONCLUSION_INVALID".to_string());
    }

    if result.rule_id == IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1 {
        if result.status != IdentityResolverStatus::SourceUnavailable
            || result.conclusion != IdentityResolverConclusion::NoConclusion
        {
            return Err("ER2A_SOURCE_UNAVAILABLE_RESULT_INVALID".to_string());
        }

        if input.required_source_health == IdentityResolverSourceAvailability::Available {
            return Err("ER2A_SOURCE_UNAVAILABLE_REQUIRES_UNAVAILABLE_SOURCE".to_string());
        }
    } else {
        let metadata = rule_metadata(result.rule_id)
            .ok_or_else(|| "ER2A_RULE_METADATA_NOT_FOUND".to_string())?;

        if !metadata.permitted_statuses.contains(&result.status) {
            return Err("ER2A_RULE_STATUS_NOT_PERMITTED".to_string());
        }

        if !metadata.permitted_conclusions.contains(&result.conclusion) {
            return Err("ER2A_RULE_CONCLUSION_NOT_PERMITTED".to_string());
        }
    }

    let mut result_evidence_ids = HashSet::new();
    let mut referenced_evidence = Vec::new();

    for evidence_id in &result.evidence_ids {
        if is_blank(evidence_id) {
            return Err("ER2A_RESULT_EVIDENCE_ID_REQUIRED".to_string());
        }

        if !result_evidence_ids.insert(evidence_id.as_str()) {
            return Err(format!(
                "ER2A_DUPLICATE_RESULT_EVIDENCE_REFERENCE: {evidence_id}"
            ));
        }

        let evidence = input
            .evidence
            .iter()
            .find(|candidate| candidate.evidence_id.as_str() == evidence_id.as_str())
            .ok_or_else(|| format!("ER2A_UNKNOWN_EVIDENCE_REFERENCE: {evidence_id}"))?;

        referenced_evidence.push(evidence);
    }

    if result.status == IdentityResolverStatus::Confirmed {
        if input.required_source_health != IdentityResolverSourceAvailability::Available {
            return Err("ER2A_CONFIRMED_REQUIRES_AVAILABLE_SOURCE".to_string());
        }

        if referenced_evidence.is_empty()
            || !referenced_evidence
                .iter()
                .any(|evidence| is_authoritative(evidence.authority_class))
        {
            return Err("ER2A_CONFIRMED_REQUIRES_AUTHORITATIVE_EVIDENCE".to_string());
        }
    }

    if result.status == IdentityResolverStatus::Confirmed {
        if let (Some(local_isin), Some(official_isin)) = (
            input
                .local_identity
                .isin
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty()),
            input
                .official_identity
                .as_ref()
                .and_then(|official| official.isin.as_deref())
                .map(str::trim)
                .filter(|value| !value.is_empty()),
        ) {
            if !local_isin.eq_ignore_ascii_case(official_isin) {
                if result.rule_id
                    != IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
                    || result.conclusion != IdentityResolverConclusion::IsinContinuity
                {
                    return Err("ER2A_ISIN_CONTINUITY_RULE_REQUIRED".to_string());
                }

                let has_authoritative_isin_change = referenced_evidence.iter().any(|evidence| {
                    is_authoritative(evidence.authority_class)
                        && evidence.evidence_kind == IdentityResolverEvidenceKind::IsinChange
                        && evidence
                            .effective_date
                            .as_deref()
                            .map(str::trim)
                            .is_some_and(|value| !value.is_empty())
                });

                if !has_authoritative_isin_change {
                    return Err("ER2A_ISIN_CONTINUITY_EVIDENCE_REQUIRED".to_string());
                }
            }
        }
    }

    Ok(())
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum IdentityResolverEvaluationError {
    InvalidInput(String),
    NoMismatchToResolve,
    AmbiguousDeterministicCandidates {
        rule_ids: Vec<IdentityResolverRuleId>,
    },
    InvalidConstructedResult(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct IdentityResolverCandidate {
    rule_id: IdentityResolverRuleId,
    status: IdentityResolverStatus,
    conclusion: IdentityResolverConclusion,
    precedence: IdentityResolverPrecedenceClass,
    evidence_ids: Vec<String>,
    explanation: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Er2bDate {
    year: i32,
    month: u8,
    day: u8,
}

fn normalize_code(value: &str) -> String {
    value.trim().to_uppercase()
}

fn normalize_optional_code(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_uppercase)
}

fn normalize_company_name(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

fn normalize_optional_company_name(value: Option<&str>) -> Option<String> {
    value
        .map(normalize_company_name)
        .filter(|value| !value.is_empty())
}

fn option_code_eq(left: Option<&str>, right: Option<&str>) -> bool {
    normalize_optional_code(left) == normalize_optional_code(right)
}

fn option_company_name_eq(left: Option<&str>, right: Option<&str>) -> bool {
    normalize_optional_company_name(left) == normalize_optional_company_name(right)
}

fn identities_equivalent(
    local: &IdentityResolverLocalIdentity,
    official: &IdentityResolverOfficialIdentity,
) -> bool {
    normalize_code(&local.exchange) == normalize_code(&official.exchange)
        && normalize_code(&local.symbol) == normalize_code(&official.symbol)
        && option_code_eq(local.series.as_deref(), official.series.as_deref())
        && option_code_eq(local.isin.as_deref(), official.isin.as_deref())
        && option_company_name_eq(
            local.company_name.as_deref(),
            official.company_name.as_deref(),
        )
        && option_code_eq(
            local.lifecycle_state.as_deref(),
            official.lifecycle_state.as_deref(),
        )
}

fn has_material_mismatch(
    local: &IdentityResolverLocalIdentity,
    official: &IdentityResolverOfficialIdentity,
) -> bool {
    normalize_code(&local.symbol) != normalize_code(&official.symbol)
        || !option_code_eq(local.series.as_deref(), official.series.as_deref())
        || !option_code_eq(local.isin.as_deref(), official.isin.as_deref())
        || !option_company_name_eq(
            local.company_name.as_deref(),
            official.company_name.as_deref(),
        )
        || !option_code_eq(
            local.lifecycle_state.as_deref(),
            official.lifecycle_state.as_deref(),
        )
}

fn parse_er2b_date(value: &str) -> Option<Er2bDate> {
    let trimmed = value.trim();
    let bytes = trimmed.as_bytes();

    if bytes.len() != 10 || bytes[4] != b'-' || bytes[7] != b'-' {
        return None;
    }

    let year = trimmed.get(0..4)?.parse::<i32>().ok()?;
    let month = trimmed.get(5..7)?.parse::<u8>().ok()?;
    let day = trimmed.get(8..10)?.parse::<u8>().ok()?;

    if !(1..=12).contains(&month) {
        return None;
    }

    let leap = (year % 4 == 0 && year % 100 != 0) || year % 400 == 0;
    let max_day = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if leap => 29,
        2 => 28,
        _ => return None,
    };

    if day == 0 || day > max_day {
        return None;
    }

    Some(Er2bDate { year, month, day })
}

fn transition_date_is_compatible(
    local: &IdentityResolverLocalIdentity,
    official: &IdentityResolverOfficialIdentity,
    evidence: &IdentityResolverEvidence,
) -> bool {
    let Some(evidence_date) = evidence
        .effective_date
        .as_deref()
        .and_then(parse_er2b_date)
    else {
        return false;
    };

    if let Some(official_date_text) = official
        .effective_date
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let Some(official_date) = parse_er2b_date(official_date_text) else {
            return false;
        };

        if official_date != evidence_date {
            return false;
        }
    }

    if let Some(local_end_text) = local
        .effective_to
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let Some(local_end) = parse_er2b_date(local_end_text) else {
            return false;
        };

        if evidence_date < local_end {
            return false;
        }
    }

    true
}

fn same_exchange(evidence: &IdentityResolverEvidence, exchange: &str) -> bool {
    normalize_code(&evidence.exchange) == normalize_code(exchange)
}

fn authoritative_for_exchange(evidence: &IdentityResolverEvidence, exchange: &str) -> bool {
    is_authoritative(evidence.authority_class) && same_exchange(evidence, exchange)
}

fn evidence_binds_symbol(evidence: &IdentityResolverEvidence, symbol: &str) -> bool {
    let target = normalize_code(symbol);

    evidence
        .symbol
        .as_deref()
        .map(normalize_code)
        .is_some_and(|value| value == target)
        || evidence
            .old_symbol
            .as_deref()
            .map(normalize_code)
            .is_some_and(|value| value == target)
        || evidence
            .new_symbol
            .as_deref()
            .map(normalize_code)
            .is_some_and(|value| value == target)
}

fn evidence_semantic_key(evidence: &IdentityResolverEvidence) -> String {
    let authority = match evidence.authority_class {
        IdentityResolverAuthorityClass::OfficialExchangeStructured => "OFFICIAL_EXCHANGE_STRUCTURED",
        IdentityResolverAuthorityClass::OfficialRegulatorOrDepository => {
            "OFFICIAL_REGULATOR_OR_DEPOSITORY"
        }
        IdentityResolverAuthorityClass::OfficialIssuerFiling => "OFFICIAL_ISSUER_FILING",
        IdentityResolverAuthorityClass::ExternalDiscoveryCandidate => "EXTERNAL_DISCOVERY_CANDIDATE",
    };

    let kind = match evidence.evidence_kind {
        IdentityResolverEvidenceKind::CurrentMaster => "CURRENT_MASTER",
        IdentityResolverEvidenceKind::SymbolChange => "SYMBOL_CHANGE",
        IdentityResolverEvidenceKind::NameChange => "NAME_CHANGE",
        IdentityResolverEvidenceKind::IsinChange => "ISIN_CHANGE",
        IdentityResolverEvidenceKind::SeriesChange => "SERIES_CHANGE",
        IdentityResolverEvidenceKind::Delisting => "DELISTING",
        IdentityResolverEvidenceKind::Listing => "LISTING",
        IdentityResolverEvidenceKind::LifecycleStatus => "LIFECYCLE_STATUS",
        IdentityResolverEvidenceKind::HistoricalIdentity => "HISTORICAL_IDENTITY",
        IdentityResolverEvidenceKind::OtherOfficial => "OTHER_OFFICIAL",
    };

    [
        normalize_code(&evidence.exchange),
        authority.to_string(),
        evidence.source_id.trim().to_string(),
        evidence.source_reference.trim().to_string(),
        evidence.content_sha256.trim().to_uppercase(),
        kind.to_string(),
        evidence
            .effective_date
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .to_string(),
        normalize_optional_code(evidence.symbol.as_deref()).unwrap_or_default(),
        normalize_optional_code(evidence.old_symbol.as_deref()).unwrap_or_default(),
        normalize_optional_code(evidence.new_symbol.as_deref()).unwrap_or_default(),
        normalize_optional_code(evidence.series.as_deref()).unwrap_or_default(),
        normalize_optional_code(evidence.isin.as_deref()).unwrap_or_default(),
        normalize_optional_company_name(evidence.company_name.as_deref()).unwrap_or_default(),
    ]
    .join("\u{1f}")
}

fn canonicalize_matching_evidence<'a>(
    input: &'a IdentityResolverInput,
    predicate: impl Fn(&IdentityResolverEvidence) -> bool,
) -> Vec<&'a IdentityResolverEvidence> {
    let mut matches = input
        .evidence
        .iter()
        .filter(|evidence| predicate(evidence))
        .collect::<Vec<_>>();

    matches.sort_by(|left, right| left.evidence_id.cmp(&right.evidence_id));

    let mut seen = HashSet::new();
    matches.retain(|evidence| seen.insert(evidence_semantic_key(evidence)));
    matches
}

fn official_identity_evidence<'a>(
    input: &'a IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<&'a IdentityResolverEvidence> {
    input
        .evidence
        .iter()
        .find(|evidence| evidence.evidence_id == official.evidence_id)
}

fn canonical_current_master_evidence<'a>(
    input: &'a IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<&'a IdentityResolverEvidence> {
    canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::CurrentMaster
            && normalize_code(&evidence.source_id) == normalize_code(&official.source_id)
            && evidence
                .symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&official.symbol))
            && match official.series.as_deref() {
                Some(series) => evidence
                    .series
                    .as_deref()
                    .map(normalize_code)
                    .is_some_and(|value| value == normalize_code(series)),
                None => true,
            }
            && match official.isin.as_deref() {
                Some(isin) => evidence
                    .isin
                    .as_deref()
                    .map(normalize_code)
                    .is_some_and(|value| value == normalize_code(isin)),
                None => true,
            }
            && match official.company_name.as_deref() {
                Some(name) => evidence
                    .company_name
                    .as_deref()
                    .map(normalize_company_name)
                    .is_some_and(|value| value == normalize_company_name(name)),
                None => true,
            }
    })
    .into_iter()
    .next()
}

fn current_evidence_id(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<String> {
    canonical_current_master_evidence(input, official)
        .or_else(|| official_identity_evidence(input, official))
        .map(|evidence| evidence.evidence_id.clone())
}

fn add_evidence_id(target: &mut Vec<String>, evidence_id: Option<String>) {
    if let Some(evidence_id) = evidence_id {
        if !target.iter().any(|existing| existing == &evidence_id) {
            target.push(evidence_id);
        }
    }
}

fn ordered_evidence_ids(
    current: Option<String>,
    primary: impl IntoIterator<Item = String>,
    supporting: impl IntoIterator<Item = String>,
) -> Vec<String> {
    let mut result = Vec::new();
    add_evidence_id(&mut result, current);

    let mut primary_ids = primary.into_iter().collect::<Vec<_>>();
    primary_ids.sort();
    primary_ids.dedup();

    for evidence_id in primary_ids {
        add_evidence_id(&mut result, Some(evidence_id));
    }

    let mut supporting_ids = supporting.into_iter().collect::<Vec<_>>();
    supporting_ids.sort();
    supporting_ids.dedup();

    for evidence_id in supporting_ids {
        add_evidence_id(&mut result, Some(evidence_id));
    }

    result
}

fn candidate(
    rule_id: IdentityResolverRuleId,
    status: IdentityResolverStatus,
    conclusion: IdentityResolverConclusion,
    precedence: IdentityResolverPrecedenceClass,
    evidence_ids: Vec<String>,
    explanation: &str,
) -> IdentityResolverCandidate {
    IdentityResolverCandidate {
        rule_id,
        status,
        conclusion,
        precedence,
        evidence_ids,
        explanation: explanation.to_string(),
    }
}

fn evaluate_rule_a(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    let local = &input.local_identity;

    if normalize_code(&local.exchange) != normalize_code(&official.exchange)
        || normalize_code(&local.symbol) == normalize_code(&official.symbol)
        || !option_code_eq(local.series.as_deref(), official.series.as_deref())
        || !option_code_eq(local.isin.as_deref(), official.isin.as_deref())
        || normalize_optional_code(local.isin.as_deref()).is_none()
        || !option_company_name_eq(
            local.company_name.as_deref(),
            official.company_name.as_deref(),
        )
        || !option_code_eq(
            local.lifecycle_state.as_deref(),
            official.lifecycle_state.as_deref(),
        )
    {
        return None;
    }

    let current = canonical_current_master_evidence(input, official)?;

    let symbol_change = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::SymbolChange
            && evidence
                .old_symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&local.symbol))
            && evidence
                .new_symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&official.symbol))
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                == normalize_optional_code(local.isin.as_deref())
            && transition_date_is_compatible(local, official, evidence)
    })
    .into_iter()
    .next()?;

    Some(candidate(
        IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1,
        IdentityResolverStatus::Confirmed,
        IdentityResolverConclusion::SymbolChange,
        IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        ordered_evidence_ids(
            Some(current.evidence_id.clone()),
            [symbol_change.evidence_id.clone()],
            Vec::<String>::new(),
        ),
        "Official symbol-change evidence preserves the same ISIN and identity across the symbol transition.",
    ))
}

fn evaluate_rule_b(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    let local = &input.local_identity;

    if normalize_code(&local.exchange) != normalize_code(&official.exchange)
        || normalize_code(&local.symbol) != normalize_code(&official.symbol)
        || !option_code_eq(local.series.as_deref(), official.series.as_deref())
        || !option_code_eq(local.isin.as_deref(), official.isin.as_deref())
        || normalize_optional_code(local.isin.as_deref()).is_none()
        || option_company_name_eq(
            local.company_name.as_deref(),
            official.company_name.as_deref(),
        )
        || !option_code_eq(
            local.lifecycle_state.as_deref(),
            official.lifecycle_state.as_deref(),
        )
    {
        return None;
    }

    let current = canonical_current_master_evidence(input, official)?;
    let official_name = normalize_optional_company_name(official.company_name.as_deref())?;

    let name_change = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::NameChange
            && evidence
                .symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&official.symbol))
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                == normalize_optional_code(local.isin.as_deref())
            && evidence
                .company_name
                .as_deref()
                .map(normalize_company_name)
                .is_some_and(|value| value == official_name)
            && transition_date_is_compatible(local, official, evidence)
    })
    .into_iter()
    .next()?;

    Some(candidate(
        IdentityResolverRuleId::NameChangeSameIdentityOfficialHistoryV1,
        IdentityResolverStatus::Confirmed,
        IdentityResolverConclusion::NameChange,
        IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        ordered_evidence_ids(
            Some(current.evidence_id.clone()),
            [name_change.evidence_id.clone()],
            Vec::<String>::new(),
        ),
        "Official name-change evidence preserves the same security identity across the company-name transition.",
    ))
}

fn evaluate_rule_c(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    let local = &input.local_identity;

    if normalize_code(&local.exchange) != normalize_code(&official.exchange)
        || normalize_code(&local.symbol) == normalize_code(&official.symbol)
        || !option_code_eq(local.series.as_deref(), official.series.as_deref())
        || !option_code_eq(local.isin.as_deref(), official.isin.as_deref())
        || normalize_optional_code(local.isin.as_deref()).is_none()
        || option_company_name_eq(
            local.company_name.as_deref(),
            official.company_name.as_deref(),
        )
        || !option_code_eq(
            local.lifecycle_state.as_deref(),
            official.lifecycle_state.as_deref(),
        )
    {
        return None;
    }

    let current = canonical_current_master_evidence(input, official)?;
    let shared_isin = normalize_optional_code(local.isin.as_deref())?;
    let official_name = normalize_optional_company_name(official.company_name.as_deref())?;

    let symbol_change = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::SymbolChange
            && evidence
                .old_symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&local.symbol))
            && evidence
                .new_symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&official.symbol))
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == shared_isin)
            && transition_date_is_compatible(local, official, evidence)
    })
    .into_iter()
    .next()?;

    let name_change = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::NameChange
            && evidence
                .symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&official.symbol))
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == shared_isin)
            && evidence
                .company_name
                .as_deref()
                .map(normalize_company_name)
                .is_some_and(|value| value == official_name)
            && transition_date_is_compatible(local, official, evidence)
    })
    .into_iter()
    .next()?;

    Some(candidate(
        IdentityResolverRuleId::SymbolAndNameChangeOfficialContinuityV1,
        IdentityResolverStatus::Confirmed,
        IdentityResolverConclusion::SymbolAndNameChange,
        IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        ordered_evidence_ids(
            Some(current.evidence_id.clone()),
            [
                symbol_change.evidence_id.clone(),
                name_change.evidence_id.clone(),
            ],
            Vec::<String>::new(),
        ),
        "Official symbol-change and name-change evidence establish one continuous same-ISIN identity chain.",
    ))
}

fn nonempty_isin_pair(
    local: &IdentityResolverLocalIdentity,
    official: &IdentityResolverOfficialIdentity,
) -> Option<(String, String)> {
    let local_isin = normalize_optional_code(local.isin.as_deref())?;
    let official_isin = normalize_optional_code(official.isin.as_deref())?;
    Some((local_isin, official_isin))
}

fn rule_d_continuity_pair<'a>(
    input: &'a IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<(&'a IdentityResolverEvidence, &'a IdentityResolverEvidence)> {
    let (local_isin, official_isin) =
        nonempty_isin_pair(&input.local_identity, official)?;

    if local_isin == official_isin {
        return None;
    }

    let historical = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::HistoricalIdentity
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == local_isin)
            && evidence_binds_symbol(evidence, &input.local_identity.symbol)
    });

    let changes = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::IsinChange
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == official_isin)
            && evidence_binds_symbol(evidence, &official.symbol)
            && transition_date_is_compatible(&input.local_identity, official, evidence)
            && match (
                evidence.old_symbol.as_deref(),
                evidence.new_symbol.as_deref(),
            ) {
                (Some(old_symbol), Some(new_symbol))
                    if normalize_code(&input.local_identity.symbol)
                        != normalize_code(&official.symbol) =>
                {
                    normalize_code(old_symbol)
                        == normalize_code(&input.local_identity.symbol)
                        && normalize_code(new_symbol) == normalize_code(&official.symbol)
                }
                _ => true,
            }
    });

    for old_side in historical {
        for new_side in &changes {
            if normalize_code(&old_side.exchange) == normalize_code(&new_side.exchange)
                && normalize_code(&old_side.source_id) == normalize_code(&new_side.source_id)
                && old_side.source_reference.trim() == new_side.source_reference.trim()
                && old_side
                    .content_sha256
                    .trim()
                    .eq_ignore_ascii_case(new_side.content_sha256.trim())
            {
                return Some((old_side, *new_side));
            }
        }
    }

    None
}

fn evaluate_rule_d(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    let (local_isin, official_isin) =
        nonempty_isin_pair(&input.local_identity, official)?;

    if local_isin == official_isin {
        return None;
    }

    let current = current_evidence_id(input, official);

    if let Some((old_side, new_side)) = rule_d_continuity_pair(input, official) {
        return Some(candidate(
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::IsinContinuity,
            IdentityResolverPrecedenceClass::ExplicitHighRiskContinuity,
            ordered_evidence_ids(
                current,
                [new_side.evidence_id.clone()],
                [old_side.evidence_id.clone()],
            ),
            "Explicit linked authoritative evidence establishes continuity across the ISIN transition.",
        ));
    }

    let new_partial = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::IsinChange
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == official_isin)
    })
    .into_iter()
    .next()
    .map(|evidence| evidence.evidence_id.clone());

    let old_partial = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::HistoricalIdentity
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == local_isin)
    })
    .into_iter()
    .next()
    .map(|evidence| evidence.evidence_id.clone());

    Some(candidate(
        IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
        IdentityResolverStatus::Conflict,
        IdentityResolverConclusion::ConflictingIdentity,
        IdentityResolverPrecedenceClass::HardConflict,
        ordered_evidence_ids(
            current,
            new_partial.into_iter(),
            old_partial.into_iter(),
        ),
        "Local and official ISINs differ and explicit authoritative continuity evidence is absent.",
    ))
}

fn evaluate_rule_e(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    let target_isin = normalize_optional_code(official.isin.as_deref())
        .or_else(|| normalize_optional_code(input.local_identity.isin.as_deref()))?;

    let current_master = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::CurrentMaster
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == target_isin)
            && evidence
                .symbol
                .as_deref()
                .map(str::trim)
                .is_some_and(|value| !value.is_empty())
    });

    let mut symbol_evidence = Vec::<(String, String)>::new();

    for evidence in current_master {
        let Some(symbol) = evidence.symbol.as_deref() else {
            continue;
        };
        let normalized_symbol = normalize_code(symbol);

        if symbol_evidence
            .iter()
            .any(|(existing, _)| existing == &normalized_symbol)
        {
            continue;
        }

        symbol_evidence.push((normalized_symbol, evidence.evidence_id.clone()));
    }

    if symbol_evidence.len() < 2 {
        return None;
    }

    symbol_evidence.sort_by(|left, right| left.0.cmp(&right.0));

    let current_id = current_evidence_id(input, official);
    let supporting = symbol_evidence
        .into_iter()
        .map(|(_, evidence_id)| evidence_id)
        .collect::<Vec<_>>();

    Some(candidate(
        IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
        IdentityResolverStatus::Conflict,
        IdentityResolverConclusion::ConflictingIdentity,
        IdentityResolverPrecedenceClass::HardConflict,
        ordered_evidence_ids(current_id, supporting, Vec::<String>::new()),
        "The same active ISIN is authoritatively mapped to multiple distinct symbols on the same exchange.",
    ))
}

fn same_proven_isin(
    local: &IdentityResolverLocalIdentity,
    official: &IdentityResolverOfficialIdentity,
) -> bool {
    nonempty_isin_pair(local, official)
        .is_some_and(|(local_isin, official_isin)| local_isin == official_isin)
}

fn evaluate_rule_f(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    if same_proven_isin(&input.local_identity, official)
        || rule_d_continuity_pair(input, official).is_some()
    {
        return None;
    }

    let local_isin = normalize_optional_code(input.local_identity.isin.as_deref());

    let delisting = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &input.local_identity.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::Delisting
            && evidence_binds_symbol(evidence, &input.local_identity.symbol)
            && match (local_isin.as_deref(), evidence.isin.as_deref()) {
                (Some(expected), Some(actual)) => normalize_code(actual) == expected,
                (_, None) => true,
                (None, Some(_)) => true,
            }
    })
    .into_iter()
    .next()?;

    Some(candidate(
        IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1,
        IdentityResolverStatus::Conflict,
        IdentityResolverConclusion::ConflictingIdentity,
        IdentityResolverPrecedenceClass::HardConflict,
        ordered_evidence_ids(
            current_evidence_id(input, official),
            [delisting.evidence_id.clone()],
            Vec::<String>::new(),
        ),
        "Authoritative delisting evidence identifies the local security as an ended lifecycle rather than an automatic symbol change.",
    ))
}

fn evidence_date(evidence: &IdentityResolverEvidence) -> Option<Er2bDate> {
    evidence
        .effective_date
        .as_deref()
        .and_then(parse_er2b_date)
}

fn evaluate_rule_g(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    if normalize_code(&input.local_identity.exchange) != normalize_code(&official.exchange)
        || normalize_code(&input.local_identity.symbol) != normalize_code(&official.symbol)
    {
        return None;
    }

    let (local_isin, official_isin) =
        nonempty_isin_pair(&input.local_identity, official)?;

    if local_isin == official_isin {
        return None;
    }

    let old_side = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && matches!(
                evidence.evidence_kind,
                IdentityResolverEvidenceKind::Delisting
                    | IdentityResolverEvidenceKind::HistoricalIdentity
            )
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == local_isin)
            && evidence_binds_symbol(evidence, &input.local_identity.symbol)
            && evidence_date(evidence).is_some()
    });

    let new_side = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && matches!(
                evidence.evidence_kind,
                IdentityResolverEvidenceKind::Listing
                    | IdentityResolverEvidenceKind::CurrentMaster
            )
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == official_isin)
            && evidence_binds_symbol(evidence, &official.symbol)
            && evidence_date(evidence).is_some()
    });

    for old_evidence in old_side {
        let Some(old_date) = evidence_date(old_evidence) else {
            continue;
        };

        for new_evidence in &new_side {
            let Some(new_date) = evidence_date(new_evidence) else {
                continue;
            };

            if old_date < new_date {
                return Some(candidate(
                    IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1,
                    IdentityResolverStatus::Conflict,
                    IdentityResolverConclusion::ConflictingIdentity,
                    IdentityResolverPrecedenceClass::HardConflict,
                    ordered_evidence_ids(
                        current_evidence_id(input, official),
                        [old_evidence.evidence_id.clone(), new_evidence.evidence_id.clone()],
                        Vec::<String>::new(),
                    ),
                    "Authoritative lifecycle chronology proves the same symbol was reused for a different ISIN/security.",
                ));
            }
        }
    }

    None
}

fn evaluate_rule_h(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> Option<IdentityResolverCandidate> {
    let local = &input.local_identity;

    if normalize_code(&local.exchange) != normalize_code(&official.exchange)
        || normalize_code(&local.symbol) != normalize_code(&official.symbol)
        || option_code_eq(local.series.as_deref(), official.series.as_deref())
        || normalize_optional_code(local.series.as_deref()).is_none()
        || normalize_optional_code(official.series.as_deref()).is_none()
        || !option_code_eq(local.isin.as_deref(), official.isin.as_deref())
        || normalize_optional_code(local.isin.as_deref()).is_none()
        || !option_company_name_eq(
            local.company_name.as_deref(),
            official.company_name.as_deref(),
        )
        || !option_code_eq(
            local.lifecycle_state.as_deref(),
            official.lifecycle_state.as_deref(),
        )
    {
        return None;
    }

    let current = canonical_current_master_evidence(input, official)?;
    let shared_isin = normalize_optional_code(local.isin.as_deref())?;
    let official_series = normalize_optional_code(official.series.as_deref())?;

    let series_change = canonicalize_matching_evidence(input, |evidence| {
        authoritative_for_exchange(evidence, &official.exchange)
            && evidence.evidence_kind == IdentityResolverEvidenceKind::SeriesChange
            && evidence
                .symbol
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == normalize_code(&official.symbol))
            && evidence
                .isin
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == shared_isin)
            && evidence
                .series
                .as_deref()
                .map(normalize_code)
                .is_some_and(|value| value == official_series)
            && transition_date_is_compatible(local, official, evidence)
    })
    .into_iter()
    .next()?;

    Some(candidate(
        IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
        IdentityResolverStatus::Confirmed,
        IdentityResolverConclusion::SameSecurityNoIdentitySplit,
        IdentityResolverPrecedenceClass::OrdinaryConfirmation,
        ordered_evidence_ids(
            Some(current.evidence_id.clone()),
            [series_change.evidence_id.clone()],
            Vec::<String>::new(),
        ),
        "Official series-change evidence preserves the same exchange, symbol, ISIN, and company identity across the series transition.",
    ))
}

fn rule_id_sort_key(rule_id: IdentityResolverRuleId) -> u8 {
    match rule_id {
        IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1 => 0,
        IdentityResolverRuleId::NameChangeSameIdentityOfficialHistoryV1 => 1,
        IdentityResolverRuleId::SymbolAndNameChangeOfficialContinuityV1 => 2,
        IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1 => 3,
        IdentityResolverRuleId::ActiveDuplicateIsinConflictV1 => 4,
        IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1 => 5,
        IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1 => 6,
        IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1 => 7,
        IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1 => 8,
        IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1 => 9,
        IdentityResolverRuleId::NoDeterministicIdentityRuleMatchV1 => 10,
    }
}

fn hard_conflict_specificity(rule_id: IdentityResolverRuleId) -> Option<u8> {
    match rule_id {
        IdentityResolverRuleId::ActiveDuplicateIsinConflictV1 => Some(0),
        IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1 => Some(1),
        IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1 => Some(2),
        IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1 => Some(3),
        _ => None,
    }
}

fn merge_compatible_candidates(
    candidates: &[IdentityResolverCandidate],
) -> Option<IdentityResolverCandidate> {
    let first = candidates.first()?.clone();

    if candidates.iter().any(|candidate| {
        candidate.rule_id != first.rule_id
            || candidate.status != first.status
            || candidate.conclusion != first.conclusion
            || candidate.precedence != first.precedence
    }) {
        return None;
    }

    let mut merged = first;
    let mut ids = candidates
        .iter()
        .flat_map(|candidate| candidate.evidence_ids.iter().cloned())
        .collect::<Vec<_>>();
    ids.sort();
    ids.dedup();

    let current = merged.evidence_ids.first().cloned();
    let supporting = ids
        .into_iter()
        .filter(|evidence_id| current.as_deref() != Some(evidence_id.as_str()))
        .collect::<Vec<_>>();
    merged.evidence_ids = ordered_evidence_ids(current, supporting, Vec::<String>::new());
    Some(merged)
}

fn arbitrate_candidates(
    candidates: Vec<IdentityResolverCandidate>,
) -> Result<Option<IdentityResolverCandidate>, IdentityResolverEvaluationError> {
    if candidates.is_empty() {
        return Ok(None);
    }

    let Some(best_rank) = candidates
        .iter()
        .map(|candidate| candidate.precedence.rank())
        .min()
    else {
        return Ok(None);
    };

    let mut finalists = candidates
        .into_iter()
        .filter(|candidate| candidate.precedence.rank() == best_rank)
        .collect::<Vec<_>>();

    if finalists.len() == 1 {
        return Ok(finalists.pop());
    }

    if let Some(merged) = merge_compatible_candidates(&finalists) {
        return Ok(Some(merged));
    }

    if finalists
        .iter()
        .all(|candidate| candidate.precedence == IdentityResolverPrecedenceClass::HardConflict)
    {
        let Some(best_specificity) = finalists
            .iter()
            .filter_map(|candidate| hard_conflict_specificity(candidate.rule_id))
            .min()
        else {
            return Err(IdentityResolverEvaluationError::AmbiguousDeterministicCandidates {
                rule_ids: finalists.iter().map(|candidate| candidate.rule_id).collect(),
            });
        };

        let most_specific = finalists
            .into_iter()
            .filter(|candidate| hard_conflict_specificity(candidate.rule_id) == Some(best_specificity))
            .collect::<Vec<_>>();

        if most_specific.len() == 1 {
            return Ok(most_specific.into_iter().next());
        }

        if let Some(merged) = merge_compatible_candidates(&most_specific) {
            return Ok(Some(merged));
        }

        let mut rule_ids = most_specific
            .into_iter()
            .map(|candidate| candidate.rule_id)
            .collect::<Vec<_>>();
        rule_ids.sort_by_key(|rule_id| rule_id_sort_key(*rule_id));
        rule_ids.dedup();

        return Err(IdentityResolverEvaluationError::AmbiguousDeterministicCandidates {
            rule_ids,
        });
    }

    let mut rule_ids = finalists
        .into_iter()
        .map(|candidate| candidate.rule_id)
        .collect::<Vec<_>>();
    rule_ids.sort_by_key(|rule_id| rule_id_sort_key(*rule_id));
    rule_ids.dedup();

    Err(IdentityResolverEvaluationError::AmbiguousDeterministicCandidates {
        rule_ids,
    })
}

fn rule_i_candidate(
    input: &IdentityResolverInput,
    official: &IdentityResolverOfficialIdentity,
) -> IdentityResolverCandidate {
    candidate(
        IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
        IdentityResolverStatus::InsufficientEvidence,
        IdentityResolverConclusion::NoConclusion,
        IdentityResolverPrecedenceClass::InsufficientEvidence,
        ordered_evidence_ids(
            current_evidence_id(input, official),
            Vec::<String>::new(),
            Vec::<String>::new(),
        ),
        "A material Identity mismatch remains but the required authoritative historical evidence is incomplete.",
    )
}

fn finalize_candidate(
    input: &IdentityResolverInput,
    candidate: IdentityResolverCandidate,
) -> Result<IdentityResolverResult, IdentityResolverEvaluationError> {
    let result = IdentityResolverResult {
        status: candidate.status,
        conclusion: candidate.conclusion,
        rule_id: candidate.rule_id,
        confidence_class: IdentityResolverConfidenceClass::Deterministic,
        evidence_ids: candidate.evidence_ids,
        explanation: candidate.explanation,
    };

    validate_resolver_result_contract(input, &result)
        .map_err(IdentityResolverEvaluationError::InvalidConstructedResult)?;

    Ok(result)
}

fn source_unavailable_result(
    input: &IdentityResolverInput,
) -> Result<IdentityResolverResult, IdentityResolverEvaluationError> {
    let result = IdentityResolverResult {
        status: IdentityResolverStatus::SourceUnavailable,
        conclusion: IdentityResolverConclusion::NoConclusion,
        rule_id: IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1,
        confidence_class: IdentityResolverConfidenceClass::Deterministic,
        evidence_ids: Vec::new(),
        explanation: "Required official source is unavailable or untrusted.".to_string(),
    };

    validate_resolver_result_contract(input, &result)
        .map_err(IdentityResolverEvaluationError::InvalidConstructedResult)?;

    Ok(result)
}

pub(crate) fn resolve_identity(
    input: &IdentityResolverInput,
) -> Result<IdentityResolverResult, IdentityResolverEvaluationError> {
    validate_resolver_input_contract(input)
        .map_err(IdentityResolverEvaluationError::InvalidInput)?;

    if input.required_source_health != IdentityResolverSourceAvailability::Available {
        return source_unavailable_result(input);
    }

    let official = input.official_identity.as_ref().ok_or_else(|| {
        IdentityResolverEvaluationError::InvalidInput(
            "ER2B_AVAILABLE_SOURCE_REQUIRES_OFFICIAL_IDENTITY".to_string(),
        )
    })?;

    if normalize_code(&input.local_identity.exchange) != normalize_code(&official.exchange) {
        return Err(IdentityResolverEvaluationError::InvalidInput(
            "ER2B_CROSS_EXCHANGE_IDENTITY_COMPARISON_UNSUPPORTED".to_string(),
        ));
    }

    if identities_equivalent(&input.local_identity, official) {
        return Err(IdentityResolverEvaluationError::NoMismatchToResolve);
    }

    let mut candidates = Vec::new();

    if let Some(candidate) = evaluate_rule_a(input, official) {
        candidates.push(candidate);
    }
    if let Some(candidate) = evaluate_rule_b(input, official) {
        candidates.push(candidate);
    }
    if let Some(candidate) = evaluate_rule_c(input, official) {
        candidates.push(candidate);
    }
    if let Some(candidate) = evaluate_rule_d(input, official) {
        candidates.push(candidate);
    }
    if let Some(candidate) = evaluate_rule_e(input, official) {
        candidates.push(candidate);
    }
    if let Some(candidate) = evaluate_rule_f(input, official) {
        candidates.push(candidate);
    }
    if let Some(candidate) = evaluate_rule_g(input, official) {
        candidates.push(candidate);
    }
    if let Some(candidate) = evaluate_rule_h(input, official) {
        candidates.push(candidate);
    }

    if let Some(winner) = arbitrate_candidates(candidates)? {
        return finalize_candidate(input, winner);
    }

    if has_material_mismatch(&input.local_identity, official) {
        return finalize_candidate(input, rule_i_candidate(input, official));
    }

    Err(IdentityResolverEvaluationError::NoMismatchToResolve)
}


#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::collections::HashSet;

    const CURRENT_MASTER_ID: &str = "ev-current-master";
    const SYMBOL_CHANGE_ID: &str = "ev-symbol-change";

    fn content_sha(seed: char) -> String {
        std::iter::repeat(seed).take(64).collect()
    }

    fn official_evidence(
        evidence_id: &str,
        evidence_kind: IdentityResolverEvidenceKind,
    ) -> IdentityResolverEvidence {
        IdentityResolverEvidence {
            evidence_id: evidence_id.to_string(),
            exchange: "NSE".to_string(),
            authority_class: IdentityResolverAuthorityClass::OfficialExchangeStructured,
            source_id: "NSE_IDENTITY_AUTHORITY".to_string(),
            source_reference: format!("official-row:{evidence_id}"),
            content_sha256: content_sha('A'),
            retrieved_at_ist: "2026-09-11T18:30:00+05:30".to_string(),
            effective_date: Some("2026-01-15".to_string()),
            symbol: Some("NEWABC".to_string()),
            old_symbol: None,
            new_symbol: None,
            series: Some("EQ".to_string()),
            isin: Some("INE000A01001".to_string()),
            company_name: Some("ABC Limited".to_string()),
            evidence_kind,
        }
    }

    fn valid_input() -> IdentityResolverInput {
        let mut symbol_change =
            official_evidence(SYMBOL_CHANGE_ID, IdentityResolverEvidenceKind::SymbolChange);
        symbol_change.old_symbol = Some("OLDABC".to_string());
        symbol_change.new_symbol = Some("NEWABC".to_string());
        symbol_change.content_sha256 = content_sha('B');

        IdentityResolverInput {
            local_identity: IdentityResolverLocalIdentity {
                exchange: "NSE".to_string(),
                symbol: "OLDABC".to_string(),
                series: Some("EQ".to_string()),
                isin: Some("INE000A01001".to_string()),
                company_name: Some("ABC Limited".to_string()),
                lifecycle_state: Some("ACTIVE".to_string()),
                effective_from: Some("2024-01-01".to_string()),
                effective_to: None,
            },
            official_identity: Some(IdentityResolverOfficialIdentity {
                exchange: "NSE".to_string(),
                symbol: "NEWABC".to_string(),
                series: Some("EQ".to_string()),
                isin: Some("INE000A01001".to_string()),
                company_name: Some("ABC Limited".to_string()),
                lifecycle_state: Some("ACTIVE".to_string()),
                effective_date: Some("2026-01-15".to_string()),
                source_id: "NSE_IDENTITY_AUTHORITY".to_string(),
                evidence_id: CURRENT_MASTER_ID.to_string(),
            }),
            evidence: vec![
                official_evidence(
                    CURRENT_MASTER_ID,
                    IdentityResolverEvidenceKind::CurrentMaster,
                ),
                symbol_change,
            ],
            required_source_health: IdentityResolverSourceAvailability::Available,
        }
    }

    fn confirmed_symbol_change(evidence_ids: Vec<String>) -> IdentityResolverResult {
        IdentityResolverResult {
            status: IdentityResolverStatus::Confirmed,
            conclusion: IdentityResolverConclusion::SymbolChange,
            rule_id: IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1,
            confidence_class: IdentityResolverConfidenceClass::Deterministic,
            evidence_ids,
            explanation: "Same ISIN is continuous across official symbol-change evidence."
                .to_string(),
        }
    }

    #[test]
    fn er2a_status_and_conclusion_wire_values_are_frozen() {
        let statuses = [
            (IdentityResolverStatus::Confirmed, r#""CONFIRMED""#),
            (
                IdentityResolverStatus::ProbableReview,
                r#""PROBABLE_REVIEW""#,
            ),
            (IdentityResolverStatus::Conflict, r#""CONFLICT""#),
            (
                IdentityResolverStatus::InsufficientEvidence,
                r#""INSUFFICIENT_EVIDENCE""#,
            ),
            (
                IdentityResolverStatus::SourceUnavailable,
                r#""SOURCE_UNAVAILABLE""#,
            ),
        ];

        for (value, expected) in statuses {
            assert_eq!(serde_json::to_string(&value).unwrap(), expected);
        }

        let conclusions = [
            (
                IdentityResolverConclusion::SymbolChange,
                r#""SYMBOL_CHANGE""#,
            ),
            (
                IdentityResolverConclusion::NameChange,
                r#""NAME_CHANGE""#,
            ),
            (
                IdentityResolverConclusion::SymbolAndNameChange,
                r#""SYMBOL_AND_NAME_CHANGE""#,
            ),
            (
                IdentityResolverConclusion::IsinContinuity,
                r#""ISIN_CONTINUITY""#,
            ),
            (
                IdentityResolverConclusion::SameSecurityNoIdentitySplit,
                r#""SAME_SECURITY_NO_IDENTITY_SPLIT""#,
            ),
            (
                IdentityResolverConclusion::ConflictingIdentity,
                r#""CONFLICTING_IDENTITY""#,
            ),
            (
                IdentityResolverConclusion::NoConclusion,
                r#""NO_CONCLUSION""#,
            ),
        ];

        for (value, expected) in conclusions {
            assert_eq!(serde_json::to_string(&value).unwrap(), expected);
        }
    }

    #[test]
    fn er2a_auxiliary_wire_values_are_frozen() {
        assert_eq!(
            serde_json::to_string(&IdentityResolverConfidenceClass::Deterministic).unwrap(),
            r#""DETERMINISTIC""#
        );

        let authority_classes = [
            (
                IdentityResolverAuthorityClass::OfficialExchangeStructured,
                "OFFICIAL_EXCHANGE_STRUCTURED",
            ),
            (
                IdentityResolverAuthorityClass::OfficialRegulatorOrDepository,
                "OFFICIAL_REGULATOR_OR_DEPOSITORY",
            ),
            (
                IdentityResolverAuthorityClass::OfficialIssuerFiling,
                "OFFICIAL_ISSUER_FILING",
            ),
            (
                IdentityResolverAuthorityClass::ExternalDiscoveryCandidate,
                "EXTERNAL_DISCOVERY_CANDIDATE",
            ),
        ];
        for (value, expected) in authority_classes {
            assert_eq!(
                serde_json::to_string(&value).unwrap(),
                format!(r#""{expected}""#)
            );
        }

        let evidence_kinds = [
            (IdentityResolverEvidenceKind::CurrentMaster, "CURRENT_MASTER"),
            (IdentityResolverEvidenceKind::SymbolChange, "SYMBOL_CHANGE"),
            (IdentityResolverEvidenceKind::NameChange, "NAME_CHANGE"),
            (IdentityResolverEvidenceKind::IsinChange, "ISIN_CHANGE"),
            (IdentityResolverEvidenceKind::SeriesChange, "SERIES_CHANGE"),
            (IdentityResolverEvidenceKind::Delisting, "DELISTING"),
            (IdentityResolverEvidenceKind::Listing, "LISTING"),
            (
                IdentityResolverEvidenceKind::LifecycleStatus,
                "LIFECYCLE_STATUS",
            ),
            (
                IdentityResolverEvidenceKind::HistoricalIdentity,
                "HISTORICAL_IDENTITY",
            ),
            (IdentityResolverEvidenceKind::OtherOfficial, "OTHER_OFFICIAL"),
        ];
        for (value, expected) in evidence_kinds {
            assert_eq!(
                serde_json::to_string(&value).unwrap(),
                format!(r#""{expected}""#)
            );
        }

        let source_states = [
            (IdentityResolverSourceAvailability::Available, "AVAILABLE"),
            (IdentityResolverSourceAvailability::Unavailable, "UNAVAILABLE"),
            (
                IdentityResolverSourceAvailability::UntrustedOrInvalid,
                "UNTRUSTED_OR_INVALID",
            ),
        ];
        for (value, expected) in source_states {
            assert_eq!(
                serde_json::to_string(&value).unwrap(),
                format!(r#""{expected}""#)
            );
        }
    }

    #[test]
    fn er2a_contract_round_trip_preserves_frozen_wire_values() {
        let value = valid_input().local_identity;
        let json = serde_json::to_string(&value).unwrap();
        let decoded: IdentityResolverLocalIdentity = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded, value);
    }

    #[test]
    fn er2a_rule_matrix_freezes_exactly_nine_unique_a_to_i_rules() {
        assert_eq!(IDENTITY_RESOLVER_RULE_MATRIX_V1.len(), 9);

        let families: Vec<_> = IDENTITY_RESOLVER_RULE_MATRIX_V1
            .iter()
            .map(|rule| rule.family)
            .collect();

        assert_eq!(
            families,
            vec![
                IdentityResolverRuleFamily::A,
                IdentityResolverRuleFamily::B,
                IdentityResolverRuleFamily::C,
                IdentityResolverRuleFamily::D,
                IdentityResolverRuleFamily::E,
                IdentityResolverRuleFamily::F,
                IdentityResolverRuleFamily::G,
                IdentityResolverRuleFamily::H,
                IdentityResolverRuleFamily::I,
            ]
        );

        let mut ids = HashSet::new();
        for rule in &IDENTITY_RESOLVER_RULE_MATRIX_V1 {
            assert!(ids.insert(rule.rule_id));
            let serialized = serde_json::to_string(&rule.rule_id).unwrap();
            assert!(serialized.contains("_V1"));
        }
    }

    #[test]
    fn er2a_rule_matrix_metadata_is_exact() {
        let rule_a = &IDENTITY_RESOLVER_RULE_MATRIX_V1[0];
        assert_eq!(rule_a.family, IdentityResolverRuleFamily::A);
        assert_eq!(
            rule_a.rule_id,
            IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1
        );
        assert_eq!(
            rule_a.precedence,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation
        );
        assert_eq!(rule_a.permitted_statuses, &[IdentityResolverStatus::Confirmed]);
        assert_eq!(
            rule_a.permitted_conclusions,
            &[IdentityResolverConclusion::SymbolChange]
        );
        assert_eq!(
            rule_a.minimum_evidence_kinds,
            &[
                IdentityResolverEvidenceKind::CurrentMaster,
                IdentityResolverEvidenceKind::SymbolChange,
            ]
        );

        let rule_b = &IDENTITY_RESOLVER_RULE_MATRIX_V1[1];
        assert_eq!(rule_b.family, IdentityResolverRuleFamily::B);
        assert_eq!(
            rule_b.rule_id,
            IdentityResolverRuleId::NameChangeSameIdentityOfficialHistoryV1
        );
        assert_eq!(
            rule_b.precedence,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation
        );
        assert_eq!(rule_b.permitted_statuses, &[IdentityResolverStatus::Confirmed]);
        assert_eq!(
            rule_b.permitted_conclusions,
            &[IdentityResolverConclusion::NameChange]
        );
        assert_eq!(
            rule_b.minimum_evidence_kinds,
            &[
                IdentityResolverEvidenceKind::CurrentMaster,
                IdentityResolverEvidenceKind::NameChange,
            ]
        );

        let rule_c = &IDENTITY_RESOLVER_RULE_MATRIX_V1[2];
        assert_eq!(rule_c.family, IdentityResolverRuleFamily::C);
        assert_eq!(
            rule_c.rule_id,
            IdentityResolverRuleId::SymbolAndNameChangeOfficialContinuityV1
        );
        assert_eq!(
            rule_c.precedence,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation
        );
        assert_eq!(rule_c.permitted_statuses, &[IdentityResolverStatus::Confirmed]);
        assert_eq!(
            rule_c.permitted_conclusions,
            &[IdentityResolverConclusion::SymbolAndNameChange]
        );
        assert_eq!(
            rule_c.minimum_evidence_kinds,
            &[
                IdentityResolverEvidenceKind::CurrentMaster,
                IdentityResolverEvidenceKind::SymbolChange,
                IdentityResolverEvidenceKind::NameChange,
            ]
        );

        let rule_d = &IDENTITY_RESOLVER_RULE_MATRIX_V1[3];
        assert_eq!(rule_d.family, IdentityResolverRuleFamily::D);
        assert_eq!(
            rule_d.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
        assert_eq!(
            rule_d.precedence,
            IdentityResolverPrecedenceClass::ExplicitHighRiskContinuity
        );
        assert_eq!(
            rule_d.permitted_statuses,
            &[
                IdentityResolverStatus::Confirmed,
                IdentityResolverStatus::Conflict,
            ]
        );
        assert_eq!(
            rule_d.permitted_conclusions,
            &[
                IdentityResolverConclusion::IsinContinuity,
                IdentityResolverConclusion::ConflictingIdentity,
            ]
        );
        assert_eq!(
            rule_d.minimum_evidence_kinds,
            &[IdentityResolverEvidenceKind::IsinChange]
        );

        let expected_conflict_rules = [
            (
                IdentityResolverRuleFamily::E,
                IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
                IdentityResolverEvidenceKind::CurrentMaster,
            ),
            (
                IdentityResolverRuleFamily::F,
                IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1,
                IdentityResolverEvidenceKind::Delisting,
            ),
            (
                IdentityResolverRuleFamily::G,
                IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1,
                IdentityResolverEvidenceKind::HistoricalIdentity,
            ),
        ];

        for (offset, (family, rule_id, evidence_kind)) in
            expected_conflict_rules.into_iter().enumerate()
        {
            let rule = &IDENTITY_RESOLVER_RULE_MATRIX_V1[4 + offset];
            assert_eq!(rule.family, family);
            assert_eq!(rule.rule_id, rule_id);
            assert_eq!(rule.precedence, IdentityResolverPrecedenceClass::HardConflict);
            assert_eq!(rule.permitted_statuses, &[IdentityResolverStatus::Conflict]);
            assert_eq!(
                rule.permitted_conclusions,
                &[IdentityResolverConclusion::ConflictingIdentity]
            );
            assert_eq!(rule.minimum_evidence_kinds, &[evidence_kind]);
        }

        let rule_h = &IDENTITY_RESOLVER_RULE_MATRIX_V1[7];
        assert_eq!(rule_h.family, IdentityResolverRuleFamily::H);
        assert_eq!(
            rule_h.rule_id,
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1
        );
        assert_eq!(
            rule_h.precedence,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation
        );
        assert_eq!(rule_h.permitted_statuses, &[IdentityResolverStatus::Confirmed]);
        assert_eq!(
            rule_h.permitted_conclusions,
            &[IdentityResolverConclusion::SameSecurityNoIdentitySplit]
        );
        assert_eq!(
            rule_h.minimum_evidence_kinds,
            &[IdentityResolverEvidenceKind::SeriesChange]
        );

        let rule_i = &IDENTITY_RESOLVER_RULE_MATRIX_V1[8];
        assert_eq!(rule_i.family, IdentityResolverRuleFamily::I);
        assert_eq!(
            rule_i.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1
        );
        assert_eq!(
            rule_i.precedence,
            IdentityResolverPrecedenceClass::InsufficientEvidence
        );
        assert_eq!(
            rule_i.permitted_statuses,
            &[IdentityResolverStatus::InsufficientEvidence]
        );
        assert_eq!(
            rule_i.permitted_conclusions,
            &[IdentityResolverConclusion::NoConclusion]
        );
        assert!(rule_i.minimum_evidence_kinds.is_empty());
    }

    #[test]
    fn er2a_rule_ids_serialize_to_exact_versioned_contract_strings() {
        let cases = [
            (
                IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1,
                "SYMBOL_CHANGE_SAME_ISIN_OFFICIAL_HISTORY_V1",
            ),
            (
                IdentityResolverRuleId::NameChangeSameIdentityOfficialHistoryV1,
                "NAME_CHANGE_SAME_IDENTITY_OFFICIAL_HISTORY_V1",
            ),
            (
                IdentityResolverRuleId::SymbolAndNameChangeOfficialContinuityV1,
                "SYMBOL_AND_NAME_CHANGE_OFFICIAL_CONTINUITY_V1",
            ),
            (
                IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
                "ISIN_CHANGE_REQUIRES_EXPLICIT_CONTINUITY_V1",
            ),
            (
                IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
                "ACTIVE_DUPLICATE_ISIN_CONFLICT_V1",
            ),
            (
                IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1,
                "DELISTED_INACTIVE_NOT_SYMBOL_CHANGE_V1",
            ),
            (
                IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1,
                "RECYCLED_SYMBOL_REQUIRES_IDENTITY_HISTORY_V1",
            ),
            (
                IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
                "SERIES_CHANGE_NOT_NEW_SECURITY_BY_DEFAULT_V1",
            ),
            (
                IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
                "INCOMPLETE_HISTORY_REQUIRES_MORE_EVIDENCE_V1",
            ),
            (
                IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1,
                "REQUIRED_OFFICIAL_SOURCE_UNAVAILABLE_V1",
            ),
            (
                IdentityResolverRuleId::NoDeterministicIdentityRuleMatchV1,
                "NO_DETERMINISTIC_IDENTITY_RULE_MATCH_V1",
            ),
        ];

        for (value, expected) in cases {
            assert_eq!(
                serde_json::to_string(&value).unwrap(),
                format!(r#""{expected}""#)
            );
            assert!(!expected.contains("NSE"));
            assert!(!expected.contains("BSE"));
        }
    }

    #[test]
    fn er2a_precedence_is_fail_closed_and_probable_review_is_not_enabled() {
        assert!(
            IdentityResolverPrecedenceClass::SourceUnavailable.rank()
                < IdentityResolverPrecedenceClass::HardConflict.rank()
        );
        assert!(
            IdentityResolverPrecedenceClass::HardConflict.rank()
                < IdentityResolverPrecedenceClass::ExplicitHighRiskContinuity.rank()
        );
        assert!(
            IdentityResolverPrecedenceClass::ExplicitHighRiskContinuity.rank()
                < IdentityResolverPrecedenceClass::OrdinaryConfirmation.rank()
        );

        assert!(IDENTITY_RESOLVER_RULE_MATRIX_V1.iter().all(|rule| {
            !rule
                .permitted_statuses
                .contains(&IdentityResolverStatus::ProbableReview)
        }));
    }

    #[test]
    fn er2a_rule_d_is_explicit_high_risk_and_never_ordinary_continuity() {
        let rule_d = rule_metadata(
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
        )
        .unwrap();

        assert_eq!(rule_d.family, IdentityResolverRuleFamily::D);
        assert_eq!(
            rule_d.precedence,
            IdentityResolverPrecedenceClass::ExplicitHighRiskContinuity
        );
        assert!(!matches!(
            rule_d.precedence,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation
        ));
    }

    #[test]
    fn er2a_valid_input_and_confirmed_symbol_change_contract_pass() {
        let input = valid_input();
        validate_resolver_input_contract(&input).unwrap();

        let result = confirmed_symbol_change(vec![
            CURRENT_MASTER_ID.to_string(),
            SYMBOL_CHANGE_ID.to_string(),
        ]);
        validate_resolver_result_contract(&input, &result).unwrap();
    }

    #[test]
    fn er2a_rejects_duplicate_evidence_ids() {
        let mut input = valid_input();
        input.evidence.push(input.evidence[0].clone());

        let error = validate_resolver_input_contract(&input)
            .expect_err("duplicate evidence IDs must fail closed");
        assert!(error.contains("ER2A_DUPLICATE_EVIDENCE_ID"));
    }

    #[test]
    fn er2a_rejects_authoritative_evidence_without_provenance() {
        let mut input = valid_input();
        input.evidence[0].content_sha256.clear();

        let error = validate_resolver_input_contract(&input)
            .expect_err("authoritative evidence without content hash must fail closed");
        assert!(error.contains("ER2A_AUTHORITATIVE_EVIDENCE_PROVENANCE_REQUIRED"));
    }

    #[test]
    fn er2a_rejects_missing_exchange_and_symbol_contract_fields() {
        let mut input = valid_input();
        input.local_identity.exchange.clear();
        assert_eq!(
            validate_resolver_input_contract(&input).unwrap_err(),
            "ER2A_LOCAL_EXCHANGE_REQUIRED"
        );

        let mut input = valid_input();
        input.local_identity.symbol.clear();
        assert_eq!(
            validate_resolver_input_contract(&input).unwrap_err(),
            "ER2A_LOCAL_SYMBOL_REQUIRED"
        );
    }

    #[test]
    fn er2a_official_identity_requires_matching_authoritative_evidence() {
        let mut input = valid_input();
        input.official_identity.as_mut().unwrap().evidence_id = "missing".to_string();
        let error = validate_resolver_input_contract(&input).unwrap_err();
        assert!(error.contains("ER2A_OFFICIAL_IDENTITY_EVIDENCE_NOT_FOUND"));

        let mut input = valid_input();
        input.evidence[0].authority_class =
            IdentityResolverAuthorityClass::ExternalDiscoveryCandidate;
        let error = validate_resolver_input_contract(&input).unwrap_err();
        assert!(error.contains("ER2A_OFFICIAL_IDENTITY_REQUIRES_AUTHORITATIVE_EVIDENCE"));
    }

    #[test]
    fn er2a_confirmed_requires_authoritative_evidence() {
        let mut input = valid_input();
        input.official_identity = None;
        for evidence in &mut input.evidence {
            evidence.authority_class =
                IdentityResolverAuthorityClass::ExternalDiscoveryCandidate;
            evidence.source_id.clear();
            evidence.source_reference.clear();
            evidence.content_sha256.clear();
        }

        let result = confirmed_symbol_change(vec![SYMBOL_CHANGE_ID.to_string()]);
        let error = validate_resolver_result_contract(&input, &result)
            .expect_err("external-discovery-only evidence cannot confirm Identity");
        assert!(error.contains("ER2A_CONFIRMED_REQUIRES_AUTHORITATIVE_EVIDENCE"));
    }

    #[test]
    fn er2a_conflict_cannot_carry_positive_continuity_conclusion() {
        let input = valid_input();
        let mut result = confirmed_symbol_change(vec![SYMBOL_CHANGE_ID.to_string()]);
        result.status = IdentityResolverStatus::Conflict;
        result.rule_id = IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1;
        result.conclusion = IdentityResolverConclusion::SymbolChange;

        let error = validate_resolver_result_contract(&input, &result)
            .expect_err("conflict with a positive conclusion must fail closed");
        assert!(error.contains("ER2A_CONFLICT_POSITIVE_CONCLUSION_INVALID"));
    }

    #[test]
    fn er2a_unknown_and_duplicate_result_evidence_references_are_rejected() {
        let input = valid_input();
        let result = confirmed_symbol_change(vec!["ev-not-in-input".to_string()]);
        let error = validate_resolver_result_contract(&input, &result).unwrap_err();
        assert!(error.contains("ER2A_UNKNOWN_EVIDENCE_REFERENCE"));

        let result = confirmed_symbol_change(vec![
            SYMBOL_CHANGE_ID.to_string(),
            SYMBOL_CHANGE_ID.to_string(),
        ]);
        let error = validate_resolver_result_contract(&input, &result).unwrap_err();
        assert!(error.contains("ER2A_DUPLICATE_RESULT_EVIDENCE_REFERENCE"));
    }

    #[test]
    fn er2a_different_isin_confirmation_requires_official_isin_change_evidence() {
        let mut input = valid_input();
        input.official_identity.as_mut().unwrap().isin = Some("INE000A01002".to_string());

        let result = IdentityResolverResult {
            status: IdentityResolverStatus::Confirmed,
            conclusion: IdentityResolverConclusion::IsinContinuity,
            rule_id: IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
            confidence_class: IdentityResolverConfidenceClass::Deterministic,
            evidence_ids: vec![CURRENT_MASTER_ID.to_string()],
            explanation: "Explicit ISIN continuity.".to_string(),
        };

        let error = validate_resolver_result_contract(&input, &result)
            .expect_err("ISIN change confirmation requires authoritative ISIN_CHANGE evidence");
        assert!(error.contains("ER2A_ISIN_CONTINUITY_EVIDENCE_REQUIRED"));
    }

    #[test]
    fn er2a_different_isin_confirmation_passes_with_explicit_official_evidence() {
        let mut input = valid_input();
        input.official_identity.as_mut().unwrap().isin = Some("INE000A01002".to_string());

        let mut isin_change =
            official_evidence("ev-isin-change", IdentityResolverEvidenceKind::IsinChange);
        isin_change.isin = Some("INE000A01002".to_string());
        input.evidence.push(isin_change);

        let result = IdentityResolverResult {
            status: IdentityResolverStatus::Confirmed,
            conclusion: IdentityResolverConclusion::IsinContinuity,
            rule_id: IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
            confidence_class: IdentityResolverConfidenceClass::Deterministic,
            evidence_ids: vec!["ev-isin-change".to_string()],
            explanation: "Official evidence establishes the ISIN transition.".to_string(),
        };

        validate_resolver_result_contract(&input, &result).unwrap();
    }

    #[test]
    fn er2a_source_unavailable_is_distinct_and_can_have_no_evidence() {
        let input = IdentityResolverInput {
            local_identity: valid_input().local_identity,
            official_identity: None,
            evidence: Vec::new(),
            required_source_health: IdentityResolverSourceAvailability::Unavailable,
        };
        let result = IdentityResolverResult {
            status: IdentityResolverStatus::SourceUnavailable,
            conclusion: IdentityResolverConclusion::NoConclusion,
            rule_id: IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1,
            confidence_class: IdentityResolverConfidenceClass::Deterministic,
            evidence_ids: Vec::new(),
            explanation: "Required official source is unavailable.".to_string(),
        };

        validate_resolver_result_contract(&input, &result).unwrap();
    }

    #[test]
    fn er2a_insufficient_evidence_uses_rule_i_without_claiming_continuity() {
        let input = valid_input();
        let result = IdentityResolverResult {
            status: IdentityResolverStatus::InsufficientEvidence,
            conclusion: IdentityResolverConclusion::NoConclusion,
            rule_id: IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1,
            confidence_class: IdentityResolverConfidenceClass::Deterministic,
            evidence_ids: vec![CURRENT_MASTER_ID.to_string()],
            explanation: "The historical link is incomplete.".to_string(),
        };

        validate_resolver_result_contract(&input, &result).unwrap();
    }

    #[test]
    fn er2a_reserved_probable_review_rule_is_not_enabled() {
        let input = valid_input();
        let result = IdentityResolverResult {
            status: IdentityResolverStatus::ProbableReview,
            conclusion: IdentityResolverConclusion::NoConclusion,
            rule_id: IdentityResolverRuleId::NoDeterministicIdentityRuleMatchV1,
            confidence_class: IdentityResolverConfidenceClass::Deterministic,
            evidence_ids: vec![CURRENT_MASTER_ID.to_string()],
            explanation: "Reserved for a future tested rule pattern.".to_string(),
        };

        assert_eq!(
            validate_resolver_result_contract(&input, &result).unwrap_err(),
            "ER2A_RESERVED_RULE_NOT_ENABLED"
        );
    }

    #[test]
    fn er2a_result_schema_contains_no_mutation_authority() {
        let result = confirmed_symbol_change(vec![SYMBOL_CHANGE_ID.to_string()]);
        let json: Value = serde_json::to_value(result).unwrap();

        for forbidden in [
            "approved",
            "apply",
            "execute",
            "sql",
            "databaseMutation",
            "sourceReplacement",
        ] {
            assert!(json.get(forbidden).is_none(), "forbidden field: {forbidden}");
        }
    }

fn er2b_equivalent_input() -> IdentityResolverInput {
        let mut input = valid_input();
        let official = input.official_identity.as_ref().unwrap().clone();
        input.local_identity.symbol = official.symbol.clone();
        input.local_identity.series = official.series.clone();
        input.local_identity.isin = official.isin.clone();
        input.local_identity.company_name = official.company_name.clone();
        input.local_identity.lifecycle_state = official.lifecycle_state.clone();
        input
    }

    fn er2b_name_change_input() -> IdentityResolverInput {
        let mut input = valid_input();
        input.local_identity.symbol = "NEWABC".to_string();
        input.local_identity.company_name = Some("ABC OLD LIMITED".to_string());

        let mut name_change =
            official_evidence("ev-name-change", IdentityResolverEvidenceKind::NameChange);
        name_change.symbol = Some("NEWABC".to_string());
        name_change.company_name = Some("ABC Limited".to_string());
        name_change.content_sha256 = content_sha('C');

        input.evidence = vec![
            official_evidence(
                CURRENT_MASTER_ID,
                IdentityResolverEvidenceKind::CurrentMaster,
            ),
            name_change,
        ];
        input
    }

    fn er2b_symbol_and_name_change_input() -> IdentityResolverInput {
        let mut input = valid_input();
        input.local_identity.company_name = Some("ABC OLD LIMITED".to_string());

        let mut name_change =
            official_evidence("ev-name-change", IdentityResolverEvidenceKind::NameChange);
        name_change.symbol = Some("NEWABC".to_string());
        name_change.company_name = Some("ABC Limited".to_string());
        name_change.content_sha256 = content_sha('C');
        input.evidence.push(name_change);
        input
    }

    fn er2b_rule_d_input(with_bridge: bool) -> IdentityResolverInput {
        let mut input = valid_input();
        input.local_identity.isin = Some("INEOLD000001".to_string());

        if let Some(official) = input.official_identity.as_mut() {
            official.isin = Some("INENEW000002".to_string());
        }

        if let Some(current) = input
            .evidence
            .iter_mut()
            .find(|evidence| evidence.evidence_id == CURRENT_MASTER_ID)
        {
            current.isin = Some("INENEW000002".to_string());
        }

        input
            .evidence
            .retain(|evidence| evidence.evidence_kind != IdentityResolverEvidenceKind::SymbolChange);

        if with_bridge {
            let mut old_side =
                official_evidence("ev-old-isin", IdentityResolverEvidenceKind::HistoricalIdentity);
            old_side.source_id = "NSE_ISIN_CHANGE_NOTICE".to_string();
            old_side.source_reference = "notice:isin-transition-1".to_string();
            old_side.content_sha256 = content_sha('D');
            old_side.symbol = Some("OLDABC".to_string());
            old_side.old_symbol = Some("OLDABC".to_string());
            old_side.new_symbol = None;
            old_side.isin = Some("INEOLD000001".to_string());
            old_side.effective_date = Some("2024-01-01".to_string());

            let mut new_side =
                official_evidence("ev-new-isin", IdentityResolverEvidenceKind::IsinChange);
            new_side.source_id = "NSE_ISIN_CHANGE_NOTICE".to_string();
            new_side.source_reference = "notice:isin-transition-1".to_string();
            new_side.content_sha256 = content_sha('D');
            new_side.symbol = Some("NEWABC".to_string());
            new_side.old_symbol = Some("OLDABC".to_string());
            new_side.new_symbol = Some("NEWABC".to_string());
            new_side.isin = Some("INENEW000002".to_string());
            new_side.effective_date = Some("2026-01-15".to_string());

            input.evidence.push(old_side);
            input.evidence.push(new_side);
        }

        input
    }

    fn er2b_rule_h_input(local_series: &str, official_series: &str) -> IdentityResolverInput {
        let mut current =
            official_evidence(CURRENT_MASTER_ID, IdentityResolverEvidenceKind::CurrentMaster);
        current.symbol = Some("ABC".to_string());
        current.series = Some(official_series.to_string());
        current.isin = Some("INE000A01001".to_string());
        current.company_name = Some("ABC Limited".to_string());

        let mut series_change =
            official_evidence("ev-series-change", IdentityResolverEvidenceKind::SeriesChange);
        series_change.symbol = Some("ABC".to_string());
        series_change.series = Some(official_series.to_string());
        series_change.isin = Some("INE000A01001".to_string());
        series_change.company_name = Some("ABC Limited".to_string());
        series_change.content_sha256 = content_sha('H');

        IdentityResolverInput {
            local_identity: IdentityResolverLocalIdentity {
                exchange: "NSE".to_string(),
                symbol: "ABC".to_string(),
                series: Some(local_series.to_string()),
                isin: Some("INE000A01001".to_string()),
                company_name: Some("ABC Limited".to_string()),
                lifecycle_state: Some("ACTIVE".to_string()),
                effective_from: Some("2024-01-01".to_string()),
                effective_to: None,
            },
            official_identity: Some(IdentityResolverOfficialIdentity {
                exchange: "NSE".to_string(),
                symbol: "ABC".to_string(),
                series: Some(official_series.to_string()),
                isin: Some("INE000A01001".to_string()),
                company_name: Some("ABC Limited".to_string()),
                lifecycle_state: Some("ACTIVE".to_string()),
                effective_date: Some("2026-01-15".to_string()),
                source_id: "NSE_IDENTITY_AUTHORITY".to_string(),
                evidence_id: CURRENT_MASTER_ID.to_string(),
            }),
            evidence: vec![current, series_change],
            required_source_health: IdentityResolverSourceAvailability::Available,
        }
    }

    fn er2b_conflict_candidate(
        rule_id: IdentityResolverRuleId,
    ) -> IdentityResolverCandidate {
        candidate(
            rule_id,
            IdentityResolverStatus::Conflict,
            IdentityResolverConclusion::ConflictingIdentity,
            IdentityResolverPrecedenceClass::HardConflict,
            Vec::new(),
            "Synthetic hard conflict.",
        )
    }

    #[test]
    fn er2b_invalid_input_returns_internal_error() {
        let mut input = valid_input();
        input.local_identity.exchange.clear();

        assert!(matches!(
            resolve_identity(&input),
            Err(IdentityResolverEvaluationError::InvalidInput(_))
        ));
    }

    #[test]
    fn er2b_no_mismatch_returns_internal_error() {
        let input = er2b_equivalent_input();

        assert_eq!(
            resolve_identity(&input),
            Err(IdentityResolverEvaluationError::NoMismatchToResolve)
        );
    }

    #[test]
    fn er2b_available_source_without_official_identity_is_invalid_input() {
        let mut input = valid_input();
        input.official_identity = None;

        assert!(matches!(
            resolve_identity(&input),
            Err(IdentityResolverEvaluationError::InvalidInput(_))
        ));
    }

    #[test]
    fn er2b_cross_exchange_comparison_is_invalid_input() {
        let mut input = valid_input();
        input.official_identity.as_mut().unwrap().exchange = "BSE".to_string();
        input.evidence[0].exchange = "BSE".to_string();

        assert!(matches!(
            resolve_identity(&input),
            Err(IdentityResolverEvaluationError::InvalidInput(message))
                if message == "ER2B_CROSS_EXCHANGE_IDENTITY_COMPARISON_UNSUPPORTED"
        ));
    }

    #[test]
    fn er2b_unavailable_source_returns_source_unavailable() {
        let input = IdentityResolverInput {
            local_identity: valid_input().local_identity,
            official_identity: None,
            evidence: Vec::new(),
            required_source_health: IdentityResolverSourceAvailability::Unavailable,
        };

        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::SourceUnavailable);
        assert_eq!(result.conclusion, IdentityResolverConclusion::NoConclusion);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1
        );
        assert!(result.evidence_ids.is_empty());
    }

    #[test]
    fn er2b_untrusted_source_outranks_stale_matching_evidence() {
        let mut input = valid_input();
        input.required_source_health = IdentityResolverSourceAvailability::UntrustedOrInvalid;

        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::SourceUnavailable);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::RequiredOfficialSourceUnavailableV1
        );
    }

    #[test]
    fn er2b_rule_a_confirms_official_symbol_change_same_isin() {
        let input = valid_input();
        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Confirmed);
        assert_eq!(result.conclusion, IdentityResolverConclusion::SymbolChange);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1
        );
        assert_eq!(
            result.evidence_ids,
            vec![CURRENT_MASTER_ID.to_string(), SYMBOL_CHANGE_ID.to_string()]
        );
    }

    #[test]
    fn er2b_rule_a_rejects_wrong_symbol_history() {
        let mut input = valid_input();
        input
            .evidence
            .iter_mut()
            .find(|evidence| evidence.evidence_id == SYMBOL_CHANGE_ID)
            .unwrap()
            .old_symbol = Some("OTHER".to_string());

        assert!(evaluate_rule_a(
            &input,
            input.official_identity.as_ref().unwrap()
        )
        .is_none());
    }

    #[test]
    fn er2b_rule_b_confirms_official_name_change() {
        let input = er2b_name_change_input();
        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Confirmed);
        assert_eq!(result.conclusion, IdentityResolverConclusion::NameChange);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::NameChangeSameIdentityOfficialHistoryV1
        );
    }

    #[test]
    fn er2b_rule_b_never_uses_fuzzy_name_similarity_without_evidence() {
        let mut input = er2b_name_change_input();
        input
            .evidence
            .retain(|evidence| evidence.evidence_kind != IdentityResolverEvidenceKind::NameChange);

        assert!(evaluate_rule_b(
            &input,
            input.official_identity.as_ref().unwrap()
        )
        .is_none());

        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1
        );
    }

    #[test]
    fn er2b_rule_c_confirms_symbol_and_name_change_only_with_both_histories() {
        let input = er2b_symbol_and_name_change_input();
        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Confirmed);
        assert_eq!(
            result.conclusion,
            IdentityResolverConclusion::SymbolAndNameChange
        );
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::SymbolAndNameChangeOfficialContinuityV1
        );
    }

    #[test]
    fn er2b_rule_c_requires_both_history_types() {
        let mut input = er2b_symbol_and_name_change_input();
        input
            .evidence
            .retain(|evidence| evidence.evidence_kind != IdentityResolverEvidenceKind::NameChange);

        assert!(evaluate_rule_c(
            &input,
            input.official_identity.as_ref().unwrap()
        )
        .is_none());
        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
    }

    #[test]
    fn er2b_rule_d_confirms_only_with_linked_authoritative_isin_bridge() {
        let input = er2b_rule_d_input(true);
        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Confirmed);
        assert_eq!(result.conclusion, IdentityResolverConclusion::IsinContinuity);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
        assert_eq!(
            result.evidence_ids,
            vec![
                CURRENT_MASTER_ID.to_string(),
                "ev-new-isin".to_string(),
                "ev-old-isin".to_string()
            ]
        );
    }

    #[test]
    fn er2b_rule_d_conflicts_when_explicit_bridge_is_absent() {
        let input = er2b_rule_d_input(false);
        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.conclusion,
            IdentityResolverConclusion::ConflictingIdentity
        );
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_rule_d_rejects_bridge_from_different_content() {
        let mut input = er2b_rule_d_input(true);
        input
            .evidence
            .iter_mut()
            .find(|evidence| evidence.evidence_id == "ev-old-isin")
            .unwrap()
            .content_sha256 = content_sha('E');

        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_rule_e_detects_same_isin_on_two_distinct_current_symbols() {
        let mut input = valid_input();
        let mut duplicate =
            official_evidence("ev-current-xyz", IdentityResolverEvidenceKind::CurrentMaster);
        duplicate.symbol = Some("XYZ".to_string());
        duplicate.content_sha256 = content_sha('E');
        input.evidence.push(duplicate);

        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::ActiveDuplicateIsinConflictV1
        );
    }

    #[test]
    fn er2b_rule_e_does_not_treat_distinct_series_as_distinct_symbols() {
        let mut input = er2b_rule_h_input("BE", "EQ");
        let mut another_series =
            official_evidence("ev-current-be", IdentityResolverEvidenceKind::CurrentMaster);
        another_series.symbol = Some("ABC".to_string());
        another_series.series = Some("BE".to_string());
        another_series.content_sha256 = content_sha('J');
        input.evidence.push(another_series);

        assert!(evaluate_rule_e(
            &input,
            input.official_identity.as_ref().unwrap()
        )
        .is_none());
    }

    #[test]
    fn er2b_rule_f_delisting_conflict_outranks_generic_isin_conflict() {
        let mut input = er2b_rule_d_input(false);
        let mut delisting =
            official_evidence("ev-delisting", IdentityResolverEvidenceKind::Delisting);
        delisting.symbol = Some("OLDABC".to_string());
        delisting.isin = Some("INEOLD000001".to_string());
        delisting.effective_date = Some("2025-12-31".to_string());
        input.evidence.push(delisting);

        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::DelistedInactiveNotSymbolChangeV1
        );
    }

    #[test]
    fn er2b_rule_g_proven_recycled_symbol_outranks_f_and_d() {
        let mut input = er2b_rule_h_input("EQ", "EQ");
        input.local_identity.isin = Some("INEOLD000001".to_string());
        input.official_identity.as_mut().unwrap().isin =
            Some("INENEW000002".to_string());
        input.evidence[0].isin = Some("INENEW000002".to_string());
        input.evidence.retain(|evidence| {
            evidence.evidence_kind == IdentityResolverEvidenceKind::CurrentMaster
        });
        input.evidence[0].effective_date = Some("2025-01-01".to_string());

        let mut delisting =
            official_evidence("ev-old-delisting", IdentityResolverEvidenceKind::Delisting);
        delisting.symbol = Some("ABC".to_string());
        delisting.isin = Some("INEOLD000001".to_string());
        delisting.effective_date = Some("2020-01-01".to_string());
        input.evidence.push(delisting);

        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1
        );
    }

    #[test]
    fn er2b_rule_g_requires_strict_old_end_before_new_start() {
        let mut input = er2b_rule_h_input("EQ", "EQ");
        input.local_identity.isin = Some("INEOLD000001".to_string());
        input.official_identity.as_mut().unwrap().isin =
            Some("INENEW000002".to_string());
        input.evidence[0].isin = Some("INENEW000002".to_string());
        input.evidence.retain(|evidence| {
            evidence.evidence_kind == IdentityResolverEvidenceKind::CurrentMaster
        });
        input.evidence[0].effective_date = Some("2025-01-01".to_string());

        let mut old_side =
            official_evidence("ev-old-history", IdentityResolverEvidenceKind::HistoricalIdentity);
        old_side.symbol = Some("ABC".to_string());
        old_side.isin = Some("INEOLD000001".to_string());
        old_side.effective_date = Some("2025-01-01".to_string());
        input.evidence.push(old_side);

        assert!(evaluate_rule_g(
            &input,
            input.official_identity.as_ref().unwrap()
        )
        .is_none());

        let result = resolve_identity(&input).unwrap();
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_rule_h_confirms_be_to_eq_same_security() {
        let input = er2b_rule_h_input("BE", "EQ");
        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Confirmed);
        assert_eq!(
            result.conclusion,
            IdentityResolverConclusion::SameSecurityNoIdentitySplit
        );
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1
        );
    }

    #[test]
    fn er2b_rule_h_confirms_eq_to_be_same_security() {
        let input = er2b_rule_h_input("EQ", "BE");
        let result = resolve_identity(&input).unwrap();

        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1
        );
    }

    #[test]
    fn er2b_rule_h_does_not_whitelist_known_series_codes() {
        let input = er2b_rule_h_input("FUTURE_A", "FUTURE_B");
        let result = resolve_identity(&input).unwrap();

        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1
        );
    }

    #[test]
    fn er2b_rule_h_missing_series_history_falls_to_rule_i() {
        let mut input = er2b_rule_h_input("BE", "EQ");
        input.evidence.retain(|evidence| {
            evidence.evidence_kind != IdentityResolverEvidenceKind::SeriesChange
        });

        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1
        );
    }

    #[test]
    fn er2b_rule_h_can_never_hide_different_isin_conflict() {
        let mut input = er2b_rule_h_input("BE", "EQ");
        input.local_identity.isin = Some("INEOLD000001".to_string());

        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_rule_i_is_only_used_for_real_unresolved_mismatch() {
        let mut input = valid_input();
        input
            .evidence
            .retain(|evidence| evidence.evidence_kind != IdentityResolverEvidenceKind::SymbolChange);

        let result = resolve_identity(&input).unwrap();

        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(result.conclusion, IdentityResolverConclusion::NoConclusion);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1
        );
    }

    #[test]
    fn er2b_arbitration_prefers_g_over_generic_d_conflict() {
        let result = arbitrate_candidates(vec![
            er2b_conflict_candidate(
                IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
            ),
            er2b_conflict_candidate(
                IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1,
            ),
        ])
        .unwrap()
        .unwrap();

        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1
        );
    }

    #[test]
    fn er2b_arbitration_prefers_e_over_g() {
        let result = arbitrate_candidates(vec![
            er2b_conflict_candidate(
                IdentityResolverRuleId::RecycledSymbolRequiresIdentityHistoryV1,
            ),
            er2b_conflict_candidate(
                IdentityResolverRuleId::ActiveDuplicateIsinConflictV1,
            ),
        ])
        .unwrap()
        .unwrap();

        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::ActiveDuplicateIsinConflictV1
        );
    }

    #[test]
    fn er2b_arbitration_rejects_incompatible_same_precedence_confirmations() {
        let a = candidate(
            IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::SymbolChange,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation,
            Vec::new(),
            "A",
        );
        let h = candidate(
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::SameSecurityNoIdentitySplit,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation,
            Vec::new(),
            "H",
        );

        assert!(matches!(
            arbitrate_candidates(vec![h, a]),
            Err(IdentityResolverEvaluationError::AmbiguousDeterministicCandidates {
                ..
            })
        ));
    }

    #[test]
    fn er2b_arbitration_collapses_semantically_compatible_duplicates() {
        let first = candidate(
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::SameSecurityNoIdentitySplit,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation,
            vec!["ev-z".to_string()],
            "same",
        );
        let second = candidate(
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::SameSecurityNoIdentitySplit,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation,
            vec!["ev-a".to_string()],
            "same",
        );

        let result = arbitrate_candidates(vec![first, second])
            .unwrap()
            .unwrap();

        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1
        );
        assert_eq!(result.evidence_ids, vec!["ev-z".to_string(), "ev-a".to_string()]);
    }

    #[test]
    fn er2b_evidence_shuffle_does_not_change_rule_h_result() {
        let input = er2b_rule_h_input("BE", "EQ");
        let expected = resolve_identity(&input).unwrap();

        let mut shuffled = input.clone();
        shuffled.evidence.reverse();
        let actual = resolve_identity(&shuffled).unwrap();

        assert_eq!(actual.status, expected.status);
        assert_eq!(actual.conclusion, expected.conclusion);
        assert_eq!(actual.rule_id, expected.rule_id);
        assert_eq!(actual.evidence_ids, expected.evidence_ids);
    }

    #[test]
    fn er2b_case_and_whitespace_normalization_is_mechanical_and_deterministic() {
        let input = er2b_rule_h_input("BE", "EQ");
        let expected = resolve_identity(&input).unwrap();

        let mut varied = input.clone();
        varied.local_identity.exchange = " nse ".to_string();
        varied.local_identity.symbol = " abc ".to_string();
        varied.local_identity.company_name = Some(" abc   limited ".to_string());

        let actual = resolve_identity(&varied).unwrap();

        assert_eq!(actual.status, expected.status);
        assert_eq!(actual.conclusion, expected.conclusion);
        assert_eq!(actual.rule_id, expected.rule_id);
        assert_eq!(actual.evidence_ids, expected.evidence_ids);
    }

    #[test]
    fn er2b_irrelevant_evidence_does_not_change_rule_h_result() {
        let input = er2b_rule_h_input("BE", "EQ");
        let expected = resolve_identity(&input).unwrap();

        let mut with_irrelevant = input.clone();
        let mut irrelevant =
            official_evidence("ev-irrelevant", IdentityResolverEvidenceKind::NameChange);
        irrelevant.symbol = Some("XYZ".to_string());
        irrelevant.isin = Some("INE999999999".to_string());
        with_irrelevant.evidence.push(irrelevant);

        let actual = resolve_identity(&with_irrelevant).unwrap();
        assert_eq!(actual.rule_id, expected.rule_id);
        assert_eq!(actual.evidence_ids, expected.evidence_ids);
    }

    #[test]
    fn er2b_equivalent_duplicate_series_fact_uses_lexically_smallest_id() {
        let mut input = er2b_rule_h_input("BE", "EQ");
        let original = input
            .evidence
            .iter()
            .find(|evidence| evidence.evidence_kind == IdentityResolverEvidenceKind::SeriesChange)
            .unwrap()
            .clone();

        let mut duplicate = original.clone();
        duplicate.evidence_id = "ev-series-a".to_string();

        input
            .evidence
            .iter_mut()
            .find(|evidence| evidence.evidence_kind == IdentityResolverEvidenceKind::SeriesChange)
            .unwrap()
            .evidence_id = "ev-series-z".to_string();
        input.evidence.push(duplicate);

        let result = resolve_identity(&input).unwrap();

        assert_eq!(
            result.evidence_ids,
            vec![CURRENT_MASTER_ID.to_string(), "ev-series-a".to_string()]
        );
    }

    #[test]
    fn er2b_strict_date_parser_handles_gregorian_calendar() {
        assert_eq!(
            parse_er2b_date("2026-01-31"),
            Some(Er2bDate {
                year: 2026,
                month: 1,
                day: 31
            })
        );
        assert!(parse_er2b_date("2024-02-29").is_some());
        assert!(parse_er2b_date("2026-13-01").is_none());
        assert!(parse_er2b_date("2026-02-30").is_none());
        assert!(parse_er2b_date("2025-02-29").is_none());
        assert!(parse_er2b_date("04/09/2026").is_none());
        assert!(parse_er2b_date("").is_none());
    }

    #[test]
    fn er2b_malformed_transition_date_fails_closed_without_panicking() {
        let mut input = er2b_rule_h_input("BE", "EQ");
        input
            .evidence
            .iter_mut()
            .find(|evidence| evidence.evidence_kind == IdentityResolverEvidenceKind::SeriesChange)
            .unwrap()
            .effective_date = Some("2026-02-30".to_string());

        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1
        );
    }

    #[test]
    fn er2b_final_validator_rejects_invalid_constructed_result() {
        let input = valid_input();
        let invalid = candidate(
            IdentityResolverRuleId::SymbolChangeSameIsinOfficialHistoryV1,
            IdentityResolverStatus::Conflict,
            IdentityResolverConclusion::SymbolChange,
            IdentityResolverPrecedenceClass::HardConflict,
            vec![CURRENT_MASTER_ID.to_string()],
            "invalid",
        );

        assert!(matches!(
            finalize_candidate(&input, invalid),
            Err(IdentityResolverEvaluationError::InvalidConstructedResult(_))
        ));
    }


#[test]
    fn er2b_rule_d_rejects_bridge_from_different_source_reference() {
        let mut input = er2b_rule_d_input(true);
        input
            .evidence
            .iter_mut()
            .find(|evidence| evidence.evidence_id == "ev-old-isin")
            .unwrap()
            .source_reference = "notice:other-document".to_string();

        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_rule_e_ignores_cross_exchange_current_master_rows() {
        let mut input = er2b_rule_h_input("BE", "EQ");
        let mut bse =
            official_evidence("ev-bse-current", IdentityResolverEvidenceKind::CurrentMaster);
        bse.exchange = "BSE".to_string();
        bse.symbol = Some("XYZ".to_string());
        bse.isin = Some("INE000A01001".to_string());
        input.evidence.push(bse);

        assert!(evaluate_rule_e(
            &input,
            input.official_identity.as_ref().unwrap()
        )
        .is_none());
    }

    #[test]
    fn er2b_rule_f_ignores_unrelated_delisting_evidence() {
        let mut input = er2b_rule_d_input(false);
        let mut delisting =
            official_evidence("ev-unrelated-delisting", IdentityResolverEvidenceKind::Delisting);
        delisting.symbol = Some("UNRELATED".to_string());
        delisting.isin = Some("INEUNRELATED1".to_string());
        input.evidence.push(delisting);

        assert!(evaluate_rule_f(
            &input,
            input.official_identity.as_ref().unwrap()
        )
        .is_none());

        let result = resolve_identity(&input).unwrap();
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_rule_h_confirms_bz_to_eq_same_security() {
        let input = er2b_rule_h_input("BZ", "EQ");
        let result = resolve_identity(&input).unwrap();

        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1
        );
    }

    #[test]
    fn er2b_hard_conflict_outranks_rule_h_confirmation_candidate() {
        let d = er2b_conflict_candidate(
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
        );
        let h = candidate(
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::SameSecurityNoIdentitySplit,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation,
            Vec::new(),
            "H",
        );

        let result = arbitrate_candidates(vec![h, d]).unwrap().unwrap();
        assert_eq!(result.status, IdentityResolverStatus::Conflict);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_explicit_rule_d_continuity_outranks_ordinary_confirmation() {
        let d = candidate(
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::IsinContinuity,
            IdentityResolverPrecedenceClass::ExplicitHighRiskContinuity,
            Vec::new(),
            "D",
        );
        let h = candidate(
            IdentityResolverRuleId::SeriesChangeNotNewSecurityByDefaultV1,
            IdentityResolverStatus::Confirmed,
            IdentityResolverConclusion::SameSecurityNoIdentitySplit,
            IdentityResolverPrecedenceClass::OrdinaryConfirmation,
            Vec::new(),
            "H",
        );

        let result = arbitrate_candidates(vec![h, d]).unwrap().unwrap();
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IsinChangeRequiresExplicitContinuityV1
        );
    }

    #[test]
    fn er2b_transition_before_local_effective_end_cannot_confirm() {
        let mut input = er2b_rule_h_input("BE", "EQ");
        input.local_identity.effective_to = Some("2026-02-01".to_string());

        let result = resolve_identity(&input).unwrap();
        assert_eq!(result.status, IdentityResolverStatus::InsufficientEvidence);
        assert_eq!(
            result.rule_id,
            IdentityResolverRuleId::IncompleteHistoryRequiresMoreEvidenceV1
        );
    }

    #[test]
    fn er2b_v1_never_emits_probable_review_implicitly() {
        for input in [
            valid_input(),
            er2b_name_change_input(),
            er2b_rule_h_input("BE", "EQ"),
        ] {
            let result = resolve_identity(&input).unwrap();
            assert_ne!(result.status, IdentityResolverStatus::ProbableReview);
        }
    }
}
