use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandChild;

/// Holds the sidecar child process handle so we can kill it on app exit.
pub struct SidecarState(pub Mutex<Option<CommandChild>>);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarState(Mutex::new(None)))
        .setup(|app| {
            // Resolve the user's app-data directory for persistent database storage.
            // Windows: %APPDATA%\com.kumon-siso.desktop\
            // macOS:  ~/Library/Application Support/com.kumon-siso.desktop/
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");

            // Ensure the directory exists
            std::fs::create_dir_all(&app_data_dir).ok();

            let app_data_str = app_data_dir.to_string_lossy().to_string();
            println!("[Kumon SISO] Database directory: {}", &app_data_str);

            // Resolve the resource directory so the sidecar can locate the
            // bundled Check-In PWA static files (TAURI_RESOURCE_DIR).
            let resource_dir = app
                .path()
                .resource_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap_or_default());
            let resource_dir_str = resource_dir.to_string_lossy().to_string();

            // Spawn the Fastify sidecar server, passing DATABASE_DIR (where the
            // SQLite database lives) and TAURI_RESOURCE_DIR (where the bundled
            // PWA assets live) as environment variables.
            let handle = app.handle().clone();
            let (mut rx, child) = handle
                .shell()
                .sidecar("kumon-siso-server")
                .expect("failed to create sidecar command")
                .env("DATABASE_DIR", &app_data_str)
                .env("TAURI_RESOURCE_DIR", &resource_dir_str)
                .spawn()
                .expect("failed to spawn Fastify sidecar");

            // Log sidecar stdout/stderr in a background thread
            tauri::async_runtime::spawn(async move {
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            print!("[sidecar:stdout] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Stderr(line) => {
                            eprint!("[sidecar:stderr] {}", String::from_utf8_lossy(&line));
                        }
                        CommandEvent::Terminated(payload) => {
                            println!("[sidecar] process terminated with code: {:?}", payload.code);
                        }
                        _ => {}
                    }
                }
            });

            // Store the child handle in managed state for cleanup
            let state = handle.state::<SidecarState>();
            *state.0.lock().unwrap() = Some(child);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Tauri application")
        .run(|app_handle, event| {
            // Kill the sidecar process when the app exits
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                let state = app_handle.state::<SidecarState>();
                let mut guard = state.0.lock().unwrap();
                if let Some(child) = guard.take() {
                    println!("[Kumon SISO] Shutting down Fastify sidecar...");
                    let _ = child.kill();
                }
            }
        });
}
