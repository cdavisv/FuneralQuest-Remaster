// Funeral Quest desktop shell. The game is the @fq/client bundle; this program owns the window,
// the menu, the native file dialog for save files, and opening links in the system browser.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{AboutMetadataBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use tauri_plugin_window_state::{StateFlags, WindowExt};

/// The default server address baked in at build time (`FQ_DEFAULT_SERVER=https://... pnpm
/// desktop:build`). Empty means Solo only until the player sets one (the person's own setting
/// always wins; it lives in the webview's storage, see shim/fq-wrapper.js).
const DEFAULT_SERVER: &str = match option_env!("FQ_DEFAULT_SERVER") {
    Some(s) => s,
    None => "",
};

const SHIM: &str = include_str!("../../shim/fq-wrapper.js");

/// Only http(s) and mailto links leave the app; nothing else is ever handed to the system.
fn external_ok(url: &str) -> bool {
    match Url::parse(url) {
        Ok(u) => matches!(u.scheme(), "https" | "http" | "mailto") && u.host_str() != Some("tauri.localhost"),
        Err(_) => false,
    }
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if !external_ok(&url) {
        return Err("refused".into());
    }
    app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
}

/// Shows the native "save as" dialog and writes the text the page hands over. The page never
/// learns or chooses the path; only what the person picks in the dialog is written.
#[tauri::command]
async fn save_file(app: AppHandle, name: String, text: String) -> Result<bool, String> {
    if text.len() > 64 * 1024 * 1024 {
        return Err("file too large".into());
    }
    let safe: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_') { c } else { '-' })
        .collect();
    let picked = app
        .dialog()
        .file()
        .set_file_name(&safe)
        .add_filter("Funeral Quest save", &["json"])
        .blocking_save_file();
    match picked {
        Some(path) => {
            let path = path.into_path().map_err(|e| e.to_string())?;
            std::fs::write(path, text).map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

fn set_fullscreen(window: &WebviewWindow, on: bool) {
    let _ = window.set_fullscreen(on);
    // The menu bar is hidden while fullscreen on Windows and Linux (macOS has one global bar).
    #[cfg(not(target_os = "macos"))]
    {
        if on {
            let _ = window.hide_menu();
        } else {
            let _ = window.show_menu();
        }
    }
}

#[tauri::command]
fn toggle_fullscreen(window: WebviewWindow) {
    let on = window.is_fullscreen().unwrap_or(false);
    set_fullscreen(&window, !on);
}

/// Test builds only (`--features selftest`): prints a line from the page's self-test script.
#[cfg(feature = "selftest")]
#[tauri::command]
fn selftest_log(line: String) {
    println!("SELFTEST {line}");
}

fn host_script() -> String {
    let default_server = serde_json::to_string(DEFAULT_SERVER).unwrap_or_else(|_| "\"\"".into());
    format!(
        r#"(() => {{
  const inv = (c, a) => window.__TAURI_INTERNALS__.invoke(c, a);
  window.__fqHost = {{
    platform: "desktop",
    defaultServer: {default_server},
    openExternal: (url) => inv("open_external", {{ url }}).catch(() => {{}}),
    saveFile: (name, text) => inv("save_file", {{ name, text }}).then((ok) => {{
      if (ok && window.fqWrapper) window.fqWrapper.toast("Saved.");
    }}),
    toggleFullscreen: () => inv("toggle_fullscreen"),
  }};
}})();
{SHIM}"#
    )
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler({
            #[cfg(feature = "selftest")]
            {
                tauri::generate_handler![open_external, save_file, toggle_fullscreen, selftest_log]
            }
            #[cfg(not(feature = "selftest"))]
            {
                tauri::generate_handler![open_external, save_file, toggle_fullscreen]
            }
        })
        .setup(|app| {
            let about = AboutMetadataBuilder::new()
                .name(Some("Funeral Quest"))
                .version(Some(env!("CARGO_PKG_VERSION")))
                .copyright(Some("Copyright 2001 Robinson Technologies. Remaster by its contributors."))
                .comments(Some(
                    "This product includes software written by Seth A. Robinson (www.rtsoft.com). \
                     Not affiliated with or endorsed by Robinson Technologies.",
                ))
                .license(Some("Proton SDK License (see LICENSE-Proton-SDK.txt)"))
                .build();
            let server = MenuItemBuilder::with_id("server", "Server address...  (F2)").build(app)?;
            let fullscreen = MenuItemBuilder::with_id("fullscreen", "Toggle fullscreen  (F11)").build(app)?;
            let reload = MenuItemBuilder::with_id("reload", "Reload").build(app)?;
            let game = SubmenuBuilder::new(app, "Game")
                .item(&server)
                .separator()
                .quit()
                .build()?;
            let edit = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let view = SubmenuBuilder::new(app, "View").item(&fullscreen).item(&reload).build()?;
            let help = SubmenuBuilder::new(app, "Help").about(Some(about)).build()?;
            let menu = MenuBuilder::new(app).items(&[&game, &edit, &view, &help]).build()?;
            app.set_menu(menu)?;

            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("Funeral Quest")
                .inner_size(1024.0, 768.0)
                .min_inner_size(480.0, 360.0)
                .center()
                .resizable(true)
                .visible(false)
                .initialization_script(host_script())
                .on_navigation(|url| {
                    // The game never leaves its own pages. Anything else is refused here (links
                    // to other sites are opened in the browser by the shim before they get this far).
                    matches!(url.scheme(), "tauri" | "about" | "blob" | "data")
                        || matches!(url.host_str(), Some("tauri.localhost") | Some("localhost"))
                })
                .build()?;
            let _ = window.restore_state(StateFlags::all() - StateFlags::VISIBLE);
            window.show()?;
            #[cfg(feature = "selftest")]
            if let Ok(path) = std::env::var("FQ_SELFTEST_SCRIPT") {
                let w = window.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    if let Ok(js) = std::fs::read_to_string(path) {
                        let _ = w.eval(js);
                    }
                });
            }
            Ok(())
        })
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window("main") else { return };
            match event.id().as_ref() {
                "server" => {
                    let _ = window.eval("window.fqWrapper && window.fqWrapper.openSettings()");
                }
                "fullscreen" => toggle_fullscreen(window),
                "reload" => {
                    let _ = window.eval("location.reload()");
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Funeral Quest");
}
