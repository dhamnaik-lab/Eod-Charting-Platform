use crate::database::AppResult;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::collections::BTreeSet;

pub(super) const V114E_RESOLUTION_TYPE: &str = "NSE_VERIFIED_PRE_TRANSITION_EVENT_SYMBOL";
pub(super) const V114E_RESOLUTION_AUTHORITY: &str = "V1.14D.1_RAW_NSE_IDENTITY_EXACT_MATCH";
pub(super) const V114E_CANDIDATE_SET_FINGERPRINT: &str =
    "4ab5f8ca1625932e559f5207c1e7a4baa8a4fc84f766c5f449af7ba0cb6135ab";
pub(super) const V114E_DESIGN_AUTHORITY_FINGERPRINT: &str =
    "c1d118d3eaa6d4b75c32c3bfa5ed9e538fa2d25e0a84436957c708a8da181c6b";
pub(super) const V114E_V114C_EVENTS_SHA256: &str =
    "e5cd63e37c7de72dc99774214b4dc1cf4c1b06575d9e630cf0104d3c31a431d7";
pub(super) const V114E_V114D1_CHAIN_VERIFICATION_SHA256: &str =
    "8da7d601bf4b0bc3f92aa273ba36a64a8bcb6464d719eafde9b2b2bd28bf927c";
pub(super) const V114E_V114D1_EVIDENCE_SHA256: &str =
    "d5a072eb85d7398556641e82a1a507daf63d82e56882ae663e094293f3ece1b2";
pub(super) const V114E_RESOLUTION_FINGERPRINT_VERSION: &str = "ca-v114e-resolution-v1";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct V114EAuthority {
    pub version: String,
    pub design_authority_fingerprint: String,
    pub candidate_set_fingerprint: String,
    pub v114c_events_sha256: String,
    pub v114d1_chain_verification_sha256: String,
    pub v114d1_evidence_sha256: String,
    pub candidates: Vec<V114ECandidate>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct V114ECandidate {
    pub import_id: i64,
    pub exchange: String,
    pub raw_symbol: String,
    pub raw_isin: Option<String>,
    pub event_date: String,
    pub action_type: String,
    pub event_symbol: String,
    pub event_isin: Option<String>,
    pub chain_id: String,
    pub transition_date: String,
    pub transition_history_row_id: i64,
    pub raw_identity_source_line_number: i64,
    pub raw_identity_security_name: String,
    pub raw_identity_source_ref: String,
    pub raw_identity_source_sha256: String,
}

fn canonical_sha256(value: &Value) -> AppResult<String> {
    let bytes = serde_json::to_vec(value).map_err(|error| error.to_string())?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

fn canonical_candidate_value(row: &V114ECandidate) -> Value {
    json!({
        "actionType": row.action_type,
        "chainId": row.chain_id,
        "eventDate": row.event_date,
        "eventIsin": row.event_isin,
        "eventSymbol": row.event_symbol,
        "exchange": row.exchange,
        "importId": row.import_id,
        "rawIdentitySecurityName": row.raw_identity_security_name,
        "rawIdentitySourceLineNumber": row.raw_identity_source_line_number,
        "rawIdentitySourceRef": row.raw_identity_source_ref,
        "rawIdentitySourceSha256": row.raw_identity_source_sha256,
        "rawIsin": row.raw_isin,
        "rawSymbol": row.raw_symbol,
        "transitionDate": row.transition_date,
        "transitionHistoryRowId": row.transition_history_row_id
    })
}

pub(super) fn compute_v114e_resolution_fingerprint(
    candidate: &V114ECandidate,
) -> AppResult<String> {
    canonical_sha256(&json!({
        "actionType": candidate.action_type,
        "chainId": candidate.chain_id,
        "eventDate": candidate.event_date,
        "eventIsin": candidate.event_isin,
        "eventSymbol": candidate.event_symbol,
        "exchange": candidate.exchange,
        "importId": candidate.import_id,
        "rawIdentitySourceLineNumber": candidate.raw_identity_source_line_number,
        "rawIdentitySourceRef": candidate.raw_identity_source_ref,
        "rawIdentitySourceSha256": candidate.raw_identity_source_sha256,
        "rawIsin": candidate.raw_isin,
        "rawSymbol": candidate.raw_symbol,
        "resolutionAuthority": V114E_RESOLUTION_AUTHORITY,
        "resolutionFingerprintVersion": V114E_RESOLUTION_FINGERPRINT_VERSION,
        "resolutionType": V114E_RESOLUTION_TYPE,
        "transitionEffectiveDate": candidate.transition_date,
        "transitionHistoryRowId": candidate.transition_history_row_id,
        "transitionNewSymbol": candidate.raw_symbol,
        "transitionOldSymbol": candidate.event_symbol,
        "v114d1EvidenceSha256": V114E_V114D1_EVIDENCE_SHA256
    }))
}

pub(super) fn compute_v114e_candidate_set_fingerprint(
    authority: &V114EAuthority,
) -> AppResult<String> {
    let mut candidates = authority.candidates.iter().collect::<Vec<_>>();
    candidates.sort_by_key(|row| row.import_id);
    let values = candidates
        .into_iter()
        .map(canonical_candidate_value)
        .collect::<Vec<_>>();
    canonical_sha256(&Value::Array(values))
}

pub(super) fn load_v114e_event_identity_authority() -> AppResult<V114EAuthority> {
    let authority: V114EAuthority =
        serde_json::from_str(include_str!("v114e_event_identity_authority.json"))
            .map_err(|error| format!("Could not parse embedded V1.14E authority: {error}"))?;

    if authority.version != "V1.14E"
        || authority.design_authority_fingerprint != V114E_DESIGN_AUTHORITY_FINGERPRINT
        || authority.candidate_set_fingerprint != V114E_CANDIDATE_SET_FINGERPRINT
        || authority.v114c_events_sha256 != V114E_V114C_EVENTS_SHA256
        || authority.v114d1_chain_verification_sha256 != V114E_V114D1_CHAIN_VERIFICATION_SHA256
        || authority.v114d1_evidence_sha256 != V114E_V114D1_EVIDENCE_SHA256
    {
        return Err("Embedded V1.14E authority metadata drift.".to_string());
    }

    if authority.candidates.len() != 184 {
        return Err(format!(
            "Embedded V1.14E authority must contain exactly 184 candidates; found {}.",
            authority.candidates.len()
        ));
    }

    let mut import_ids = BTreeSet::new();
    let mut canonical_rows = BTreeSet::new();
    for row in &authority.candidates {
        if row.import_id <= 0
            || row.exchange != "NSE"
            || row.raw_symbol.trim().is_empty()
            || row.event_symbol.trim().is_empty()
            || row.chain_id.trim().is_empty()
            || row.transition_history_row_id <= 0
            || row.raw_identity_source_line_number <= 0
            || row.raw_identity_security_name.trim().is_empty()
            || row.raw_identity_source_ref.trim().is_empty()
            || row.raw_identity_source_sha256.len() != 64
        {
            return Err(format!(
                "Embedded V1.14E authority has invalid candidate shape for import {}.",
                row.import_id
            ));
        }
        if row.event_isin.is_some() {
            return Err(format!(
                "V1.14E first tranche must not embed event ISIN for import {}.",
                row.import_id
            ));
        }
        if row.event_date.as_str() >= row.transition_date.as_str() {
            return Err(format!(
                "V1.14E event date must precede transition date for import {}.",
                row.import_id
            ));
        }
        if !matches!(row.action_type.as_str(), "DIVIDEND" | "BONUS") {
            return Err(format!(
                "Unexpected V1.14E action type {} for import {}.",
                row.action_type, row.import_id
            ));
        }
        if !import_ids.insert(row.import_id) {
            return Err(format!(
                "Duplicate V1.14E import ID in authority: {}.",
                row.import_id
            ));
        }
        let canonical = serde_json::to_string(&canonical_candidate_value(row))
            .map_err(|error| error.to_string())?;
        if !canonical_rows.insert(canonical) {
            return Err(format!(
                "Duplicate V1.14E candidate row in authority: {}.",
                row.import_id
            ));
        }
    }

    let chains = authority
        .candidates
        .iter()
        .map(|row| row.chain_id.as_str())
        .collect::<BTreeSet<_>>();
    if chains.len() != 44 {
        return Err(format!(
            "Embedded V1.14E authority must contain exactly 44 chains; found {}.",
            chains.len()
        ));
    }

    let computed = compute_v114e_candidate_set_fingerprint(&authority)?;
    if computed != V114E_CANDIDATE_SET_FINGERPRINT {
        return Err(format!(
            "Embedded V1.14E candidate-set fingerprint drift: {computed}."
        ));
    }

    Ok(authority)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v114e_authority_is_exact_184_event_44_chain_tranche() {
        let authority = load_v114e_event_identity_authority().unwrap();

        assert_eq!(authority.version, "V1.14E");
        assert_eq!(authority.candidates.len(), 184);

        let chains = authority
            .candidates
            .iter()
            .map(|row| row.chain_id.as_str())
            .collect::<BTreeSet<_>>();
        assert_eq!(chains.len(), 44);

        assert_eq!(
            compute_v114e_candidate_set_fingerprint(&authority).unwrap(),
            V114E_CANDIDATE_SET_FINGERPRINT
        );

        assert!(authority
            .candidates
            .iter()
            .all(|row| row.event_isin.is_none()));
        assert!(authority
            .candidates
            .iter()
            .all(|row| row.event_date.as_str() < row.transition_date.as_str()));
    }
}
