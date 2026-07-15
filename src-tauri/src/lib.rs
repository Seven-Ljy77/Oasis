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

use crate::agent::prompt_template::PromptTemplateStore;
use crate::agent::runtime::AgentRuntimeEngine;
use crate::db::agent_config_store::SqliteAgentConfigStore;
use crate::db::agent_task_store::SqliteAgentTaskStore;
use crate::db::entry_store::SqliteEntryStore;
use crate::db::feed_store::SqliteFeedStore;
use crate::db::llm_usage_store::SqliteLLMUsageStore;
use crate::db::manager::DatabaseManager;
use crate::db::summary_store::SqliteSummaryStore;
use crate::db::tag_store::SqliteTagStore;
use crate::db::translation_store::SqliteTranslationStore;
use crate::feed::sync_service::SyncService;
use crate::state::AppState;
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
    let agent_config_store = Arc::new(SqliteAgentConfigStore::new(db.clone()));
    let agent_task_store = Arc::new(SqliteAgentTaskStore::new(db.clone()));
    let llm_usage_store = Arc::new(SqliteLLMUsageStore::new(db.clone()));
    let summary_store = Arc::new(SqliteSummaryStore::new(db.clone()));
    let translation_store = Arc::new(SqliteTranslationStore::new(db.clone()));
    let sync_service = Arc::new(SyncService::new(
        feed_store.clone(),
        entry_store.clone(),
    ));

    let app_state = AppState {
        db,
        feed_store,
        entry_store,
        tag_store,
        agent_config_store,
        agent_task_store,
        llm_usage_store,
        summary_store,
        translation_store,
        prompt_template_store: Arc::new(std::sync::Mutex::new(PromptTemplateStore::default())),
        sync_service,
        task_queue: Arc::new(TaskQueue::new()),
        agent_runtime: Arc::new(AgentRuntimeEngine::new()),
        config: Arc::new(RwLock::new(
            crate::commands::settings_commands::load_config_from_disk(),
        )),
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
            // Agent config commands
            commands::agent_commands::get_agent_providers,
            commands::agent_commands::add_agent_provider,
            commands::agent_commands::update_agent_provider,
            commands::agent_commands::delete_agent_provider,
            commands::agent_commands::archive_agent_provider,
            commands::agent_commands::unarchive_agent_provider,
            commands::agent_commands::get_agent_models,
            commands::agent_commands::add_agent_model,
            commands::agent_commands::update_agent_model,
            commands::agent_commands::delete_agent_model,
            commands::agent_commands::test_agent_model,
            commands::agent_commands::get_agent_profile,
            commands::agent_commands::set_agent_profile,
            // Agent task dispatch
            commands::agent_commands::start_summary,
            commands::agent_commands::start_translation,
            commands::agent_commands::start_tagging_panel,
            commands::agent_commands::cancel_agent,
            commands::agent_commands::start_batch_tagging,
            commands::agent_commands::start_agent_task,
            commands::agent_commands::cancel_agent_task,
            commands::agent_commands::get_agent_state,
            commands::agent_commands::check_agent_availability,
            // Summary / Translation getters
            commands::agent_commands::get_summary,
            commands::agent_commands::generate_summary,
            commands::agent_commands::get_translation_segments,
            commands::agent_commands::build_translation_html,
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
            commands::digest_commands::get_note,
            commands::digest_commands::share_digest,
            commands::digest_commands::export_digest,
            commands::digest_commands::export_multiple_digest,
            // Usage commands
            commands::usage_commands::fetch_provider_report,
            commands::usage_commands::fetch_model_report,
            commands::usage_commands::fetch_agent_report,
            commands::usage_commands::fetch_comparison,
            commands::usage_commands::clear_usage,
            commands::usage_commands::get_usage_report,
            // Settings commands
            commands::settings_commands::load_settings,
            commands::settings_commands::save_settings,
            commands::settings_commands::test_provider_connection,
            commands::settings_commands::reveal_custom_template,
            commands::settings_commands::get_settings,
            // Window commands
            commands::window_commands::open_file_dialog,
            commands::window_commands::save_file_dialog,
            commands::window_commands::pick_export_folder,
            commands::window_commands::open_in_browser,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mercury");
}
