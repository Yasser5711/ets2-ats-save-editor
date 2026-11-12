#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Embedded here and not in the library: that one is also built as a static
    // and a dynamic library, and each of them would carry its own copy.
    #[cfg(feature = "portable")]
    truck_save_editor_lib::launch(Some(truck_save_editor_lib::EmbeddedServer {
        id: env!("PORTABLE_SERVER_ID"),
        bytes: include_bytes!(env!("PORTABLE_SERVER")),
    }));
    #[cfg(not(feature = "portable"))]
    truck_save_editor_lib::run();
}
