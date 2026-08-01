// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn configure_linux_webkit_env() {
    let is_wsl = std::env::var_os("WSL_INTEROP").is_some()
        || std::fs::read_to_string("/proc/sys/kernel/osrelease")
            .map(|text| text.to_ascii_lowercase().contains("microsoft"))
            .unwrap_or(false);

    if is_wsl {
        // WSLg can expose an EGL/Mesa stack that makes WebKitGTK render a blank
        // white window. Prefer software rendering only inside WSL so native
        // Linux desktops keep their default GPU path.
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
            std::env::set_var("LIBGL_ALWAYS_SOFTWARE", "1");
            std::env::set_var("GSK_RENDERER", "cairo");
        }
    }
}

#[cfg(not(target_os = "linux"))]
fn configure_linux_webkit_env() {}

fn main() {
    configure_linux_webkit_env();
    mercury_lib::run();
}
