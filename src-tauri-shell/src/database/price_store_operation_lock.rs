use std::sync::{Mutex, MutexGuard, OnceLock, TryLockError};

pub(crate) const PRICE_STORE_OPERATION_BUSY_REASON: &str = "PRICE_STORE_OPERATION_BUSY";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum PriceStoreOperationKind {
    CorporateActionAutomatic,
    BhavcopyWrite,
    ManualImport,
    QuoteMutation,
    DatabaseDeletion,
}

pub(crate) struct PriceStoreOperationPermit {
    _kind: PriceStoreOperationKind,
    _guard: MutexGuard<'static, ()>,
}

static PRICE_STORE_OPERATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn operation_lock() -> &'static Mutex<()> {
    PRICE_STORE_OPERATION_LOCK.get_or_init(|| Mutex::new(()))
}

pub(crate) fn try_acquire_price_store_operation(
    kind: PriceStoreOperationKind,
) -> Result<PriceStoreOperationPermit, String> {
    match operation_lock().try_lock() {
        Ok(guard) => Ok(PriceStoreOperationPermit {
            _kind: kind,
            _guard: guard,
        }),
        Err(TryLockError::WouldBlock | TryLockError::Poisoned(_)) => {
            Err(PRICE_STORE_OPERATION_BUSY_REASON.to_string())
        }
    }
}

#[cfg(test)]
pub(crate) fn test_price_store_scope() -> MutexGuard<'static, ()> {
    static TEST_SCOPE: Mutex<()> = Mutex::new(());
    TEST_SCOPE
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn command_slice<'a>(source: &'a str, signature: &str) -> &'a str {
        let start = source
            .find(signature)
            .unwrap_or_else(|| panic!("missing command signature: {signature}"));
        let tail = &source[start..];
        let end = tail[signature.len()..]
            .find("\n#[tauri::command]")
            .map(|offset| signature.len() + offset)
            .unwrap_or(tail.len());
        &tail[..end]
    }

    fn assert_lock_before(source: &str, signature: &str, lock_kind: &str, mutation_marker: &str) {
        let body = command_slice(source, signature);
        let acquire = body
            .find("try_acquire_price_store_operation")
            .unwrap_or_else(|| panic!("missing shared lock acquisition in {signature}"));
        assert!(
            body.contains(lock_kind),
            "wrong operation kind in {signature}"
        );
        let mutation = body
            .find(mutation_marker)
            .unwrap_or_else(|| panic!("missing mutation marker in {signature}: {mutation_marker}"));
        assert!(
            acquire < mutation,
            "shared lock must be acquired before mutation marker in {signature}"
        );
    }

    #[test]
    fn phase5a_price_store_operation_lock_is_nonblocking_nonreentrant_and_releases() {
        let _test_scope = test_price_store_scope();
        let first = try_acquire_price_store_operation(PriceStoreOperationKind::BhavcopyWrite)
            .expect("first shared price-store acquisition");
        let nested = try_acquire_price_store_operation(PriceStoreOperationKind::QuoteMutation)
            .err()
            .expect("nested acquisition must fail closed");
        assert_eq!(nested, PRICE_STORE_OPERATION_BUSY_REASON);
        drop(first);
        let second = try_acquire_price_store_operation(PriceStoreOperationKind::ManualImport)
            .expect("permit drop must release the shared lock");
        drop(second);
    }

    #[test]
    fn phase5a_price_store_operation_lock_is_wired_to_frozen_outer_entrypoints() {
        let bhavcopy = include_str!("../bhavcopy/mod.rs");
        assert_lock_before(
            bhavcopy,
            "pub async fn download_bhavcopy(",
            "PriceStoreOperationKind::BhavcopyWrite",
            "recover_pending_bhavcopy_sessions",
        );
        assert_lock_before(
            bhavcopy,
            "pub async fn download_bhavcopy_batch(",
            "PriceStoreOperationKind::BhavcopyWrite",
            "recover_pending_bhavcopy_sessions",
        );

        let imports = include_str!("../imports.rs");
        assert_lock_before(
            imports,
            "pub async fn import_csv(",
            "PriceStoreOperationKind::ManualImport",
            "MANUAL_IMPORT_MUTATION_LOCK",
        );
        assert_lock_before(
            imports,
            "pub async fn undo_manual_import_recovery(",
            "PriceStoreOperationKind::ManualImport",
            "MANUAL_IMPORT_MUTATION_LOCK",
        );

        let database = include_str!("../database.rs");
        for signature in [
            "pub async fn upsert_quote(",
            "pub async fn delete_quote(",
            "pub async fn delete_quote_range(",
            "pub async fn delete_quote_date(",
        ] {
            assert_lock_before(
                database,
                signature,
                "PriceStoreOperationKind::QuoteMutation",
                "open_connection_for_folder",
            );
        }

        let corporate_actions = include_str!("corporate_action_imports.rs");
        assert_lock_before(
            corporate_actions,
            "pub async fn auto_approve_corporate_action_imports(",
            "PriceStoreOperationKind::CorporateActionAutomatic",
            "open_connection_for_folder",
        );
    }

    #[test]
    fn phase5a_price_store_operation_lock_preserves_manual_ca_and_internal_recovery_ownership() {
        let corporate_actions = include_str!("corporate_action_imports.rs");
        let manual_bulk = command_slice(
            corporate_actions,
            "pub async fn approve_corporate_action_imports(",
        );
        assert!(
            !manual_bulk.contains("try_acquire_price_store_operation"),
            "ordinary/manual CA approval must remain outside the Phase 5A automatic lock"
        );

        let recovery = include_str!("../bhavcopy_recovery.rs");
        assert!(
            !recovery.contains("try_acquire_price_store_operation"),
            "bhavcopy recovery helpers must remain covered by the outer bhavcopy permit"
        );

        let quotes = include_str!("quotes.rs");
        assert!(
            !quotes.contains("try_acquire_price_store_operation"),
            "quote internals must not reacquire the shared outer permit"
        );
    }
}
