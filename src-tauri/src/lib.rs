pub mod agent;
pub mod commands;
pub mod db;
pub mod digest;
pub mod error;
pub mod feed;
pub mod reader;
pub mod resources;
pub mod state;
pub mod tags;
pub mod tasking;
pub mod usage;

use std::sync::Arc;
use tokio::sync::RwLock;

use crate::agent::runtime::AgentRuntimeEngine;
use crate::db::entry_store::SqliteEntryStore;
use crate::db::feed_store::SqliteFeedStore;
use crate::db::manager::DatabaseManager;
use crate::db::tag_store::{SqliteTagStore, TagStore};
use crate::feed::sync_service::SyncService;
use crate::state::{AppConfig, AppState};
use crate::tasking::task_queue::TaskQueue;

fn db_path() -> std::path::PathBuf {
    let dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."))
        .join("Mercury");
    std::fs::create_dir_all(&dir).ok();
    dir.join("mercury.db")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Arc::new(DatabaseManager::new(&db_path()).expect("Failed to initialize database"));

    let feed_store = Arc::new(SqliteFeedStore::new(db.clone()));
    let entry_store = Arc::new(SqliteEntryStore::new(db.clone()));
    let tag_store = Arc::new(SqliteTagStore::new(db.clone()));
    let sync_service = Arc::new(SyncService::new(
        feed_store.clone(),
        entry_store.clone(),
    ));

    let app_state = AppState {
        db,
        feed_store,
        entry_store,
        tag_store,
        sync_service,
        task_queue: Arc::new(TaskQueue::new()),
        agent_runtime: Arc::new(AgentRuntimeEngine::new()),
        config: Arc::new(RwLock::new(AppConfig::default())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Feed commands
            commands::feed_commands::add_feed,
            commands::feed_commands::probe_feed,
            commands::feed_commands::get_feeds,
            commands::feed_commands::update_feed,
            commands::feed_commands::delete_feed,
            commands::feed_commands::sync_feeds,
            commands::feed_commands::import_opml,
            commands::feed_commands::export_opml,
            // Entry commands
            commands::entry_commands::load_entries,
            commands::entry_commands::load_next_entries,
            commands::entry_commands::mark_read,
            commands::entry_commands::mark_starred,
            commands::entry_commands::delete_entry,
            commands::entry_commands::search_entries,
            // Reader commands
            commands::reader_commands::build_reader_html,
            commands::reader_commands::get_available_fonts,
            // Agent commands
            commands::agent_commands::start_summary,
            commands::agent_commands::start_translation,
            commands::agent_commands::start_tagging_panel,
            commands::agent_commands::cancel_agent,
            commands::agent_commands::start_batch_tagging,
            // Tag commands
            commands::tag_commands::get_tags,
            commands::tag_commands::get_tag_library,
            commands::tag_commands::create_tag,
            commands::tag_commands::rename_tag,
            commands::tag_commands::delete_tag,
            commands::tag_commands::merge_tag,
            commands::tag_commands::assign_tag,
            commands::tag_commands::remove_tag,
            commands::tag_commands::get_tags_for_entry,
            commands::tag_commands::suggest_tags,
            commands::tag_commands::add_alias,
            commands::tag_commands::delete_alias,
            commands::tag_commands::cleanup_empty_tags,
            commands::tag_commands::debug_dump_tags,
            commands::tag_commands::delete_tags_batch,
            commands::tag_commands::delete_unused_tags,
            commands::tag_commands::recalculate_tag_counts,
            // Digest commands
            commands::digest_commands::save_note,
            commands::digest_commands::load_note,
            commands::digest_commands::share_digest,
            commands::digest_commands::export_digest,
            commands::digest_commands::export_multiple_digest,
            // Usage commands
            commands::usage_commands::fetch_provider_report,
            commands::usage_commands::fetch_model_report,
            commands::usage_commands::fetch_agent_report,
            commands::usage_commands::fetch_comparison,
            commands::usage_commands::clear_usage,
            // Settings commands
            commands::settings_commands::load_settings,
            commands::settings_commands::save_settings,
            commands::settings_commands::test_provider_connection,
            commands::settings_commands::reveal_custom_template,
            // Window commands
            commands::window_commands::open_file_dialog,
            commands::window_commands::save_file_dialog,
            commands::window_commands::pick_export_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mercury");
}
