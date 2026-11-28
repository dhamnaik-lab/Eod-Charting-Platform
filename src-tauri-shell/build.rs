fn main() {
    println!("cargo:rerun-if-changed=../dist");
    println!("cargo:rerun-if-changed=gen/build-info.json");
    println!("cargo:rerun-if-env-changed=EOD_CANDIDATE_BUILD_INFO");
    println!("cargo:rustc-check-cfg=cfg(eod_candidate_build_info)");
    if let Some(candidate) = std::env::var_os("EOD_CANDIDATE_BUILD_INFO") {
        let root = std::path::PathBuf::from(std::env::var_os("CARGO_MANIFEST_DIR").unwrap());
        let candidate = std::fs::canonicalize(candidate).expect("candidate build metadata");
        let tmp = root.parent().expect("workspace root").join("tmp");
        let tmp = std::fs::canonicalize(tmp).expect("workspace tmp");
        assert!(
            candidate.starts_with(tmp) && candidate.is_file(),
            "candidate metadata must be under workspace tmp"
        );
        println!("cargo:rerun-if-changed={}", candidate.display());
        println!(
            "cargo:rustc-env=EOD_BUILD_INFO_FILE={}",
            candidate.display()
        );
        println!("cargo:rustc-cfg=eod_candidate_build_info");
    }
    tauri_build::build()
}
