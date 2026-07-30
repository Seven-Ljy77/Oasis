use crate::error::AppError;

/// Represents the transient save state of a note draft.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NoteSaveState {
    Idle,
    Saving,
    Saved,
    Failed(String),
}

/// Controller for the lifecycle of an entry note.
pub struct NoteController {
    _entry_id: i64,
    save_state: NoteSaveState,
}

impl NoteController {
    pub fn new(entry_id: i64) -> Self {
        Self {
            _entry_id: entry_id,
            save_state: NoteSaveState::Idle,
        }
    }

    /// Load the existing note for this entry.
    pub async fn load(&self) -> Result<Option<String>, AppError> {
        todo!()
    }

    /// Save a draft of the note without committing to persistent storage immediately.
    pub async fn save_draft(&mut self, _markdown_text: &str) -> Result<NoteSaveState, AppError> {
        todo!()
    }

    /// Commit the current draft to persistent storage.
    pub async fn commit(&mut self, _markdown_text: &str) -> Result<(), AppError> {
        todo!()
    }

    /// Discard the current draft, reverting to the last committed version.
    pub async fn discard_draft(&mut self) -> Result<(), AppError> {
        todo!()
    }

    /// Get the current save state.
    pub fn save_state(&self) -> &NoteSaveState {
        &self.save_state
    }
}
