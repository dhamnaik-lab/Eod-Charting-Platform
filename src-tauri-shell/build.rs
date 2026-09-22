fn main() {
    println!("cargo:rerun-if-changed=../dist");
    println!("cargo:rerun-if-changed=gen/build-info.json");
    tauri_build::build()
}
