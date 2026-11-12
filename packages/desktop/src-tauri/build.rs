use std::collections::hash_map::DefaultHasher;
use std::env;
use std::fs;
use std::hash::Hasher;
use std::path::Path;

fn main() {
    // The portable build carries the server inside the executable instead of
    // next to it, so it needs the path of the sidecar built for this target.
    if env::var_os("CARGO_FEATURE_PORTABLE").is_some() {
        let target = env::var("TARGET").expect("cargo sets TARGET for build scripts");
        let suffix = if target.contains("windows") { ".exe" } else { "" };
        let server = Path::new(&env::var("CARGO_MANIFEST_DIR").expect("cargo sets CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(format!("truck-save-server-{target}{suffix}"));
        let bytes = fs::read(&server).unwrap_or_else(|_| {
            panic!("{} is missing - run scripts/build-sidecar.mjs first", server.display())
        });
        // names the unpacked copy, so a rebuilt server is never mistaken for the old one
        let mut hasher = DefaultHasher::new();
        hasher.write(&bytes);
        println!("cargo:rustc-env=PORTABLE_SERVER={}", server.display());
        println!("cargo:rustc-env=PORTABLE_SERVER_ID={:016x}", hasher.finish());
        println!("cargo:rerun-if-changed={}", server.display());
    }
    tauri_build::build()
}
