use std::collections::HashMap;
use std::future::Future;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex, Weak};

use tokio::sync::Mutex;

use crate::error::AppError;

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct AgentRequestSlot {
    task_kind: &'static str,
    entry_id: i64,
    target_language: String,
    detail_level: Option<String>,
}

impl AgentRequestSlot {
    pub fn summary(entry_id: i64, target_language: &str, detail_level: &str) -> Self {
        Self {
            task_kind: "summary",
            entry_id,
            target_language: target_language.to_string(),
            detail_level: Some(detail_level.to_string()),
        }
    }

    pub fn translation(entry_id: i64, target_language: &str) -> Self {
        Self {
            task_kind: "translation",
            entry_id,
            target_language: target_language.to_string(),
            detail_level: None,
        }
    }
}

#[derive(Default)]
pub struct LatestRequestTracker {
    sequence: AtomicU64,
    latest: StdMutex<HashMap<AgentRequestSlot, Weak<RequestSlotState>>>,
}

#[derive(Default)]
struct RequestSlotState {
    latest_generation: AtomicU64,
    persistence: Mutex<()>,
}

impl LatestRequestTracker {
    pub async fn begin(self: &Arc<Self>, slot: AgentRequestSlot) -> LatestRequestContext {
        let slot_state = {
            let mut latest = self
                .latest
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            latest.retain(|_, state| state.strong_count() > 0);
            latest
                .get(&slot)
                .and_then(Weak::upgrade)
                .unwrap_or_else(|| {
                    let state = Arc::new(RequestSlotState::default());
                    latest.insert(slot.clone(), Arc::downgrade(&state));
                    state
                })
        };

        // Registration and persistence share the same slot lock. Once a
        // current write starts, a newer generation cannot supersede it until
        // the write has completed.
        let generation = {
            let _persistence = slot_state.persistence.lock().await;
            let generation = self.sequence.fetch_add(1, Ordering::Relaxed) + 1;
            slot_state
                .latest_generation
                .store(generation, Ordering::Release);
            generation
        };
        LatestRequestContext {
            slot_state,
            generation,
        }
    }
}

#[derive(Clone)]
pub struct LatestRequestContext {
    slot_state: Arc<RequestSlotState>,
    generation: u64,
}

impl LatestRequestContext {
    pub async fn ensure_current(&self) -> Result<(), AppError> {
        if self.slot_state.latest_generation.load(Ordering::Acquire) == self.generation {
            Ok(())
        } else {
            Err(superseded_error())
        }
    }

    pub async fn run_if_current<T, F, Fut>(&self, operation: F) -> Result<T, AppError>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<T, AppError>>,
    {
        // Serialize persistence only for the same request slot. Registration
        // uses this lock too, so the generation check and operation form one
        // linearized step relative to newer requests.
        let _persistence = self.slot_state.persistence.lock().await;
        if self.slot_state.latest_generation.load(Ordering::Acquire) != self.generation {
            return Err(superseded_error());
        }
        operation().await
    }
}

fn superseded_error() -> AppError {
    AppError::Agent("Request was superseded by a newer run".to_string())
}

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    use super::{AgentRequestSlot, LatestRequestTracker};
    use crate::error::AppError;

    #[tokio::test]
    async fn only_the_latest_request_for_a_slot_can_persist() {
        let tracker = Arc::new(LatestRequestTracker::default());
        let slot = AgentRequestSlot::summary(1, "en", "medium");
        let older = tracker.begin(slot.clone()).await;
        let newer = tracker.begin(slot).await;
        let wrote = Arc::new(AtomicBool::new(false));
        let stale_write = wrote.clone();

        let result = older
            .run_if_current(|| async move {
                stale_write.store(true, Ordering::SeqCst);
                Ok(())
            })
            .await;

        assert!(result.is_err());
        assert!(!wrote.load(Ordering::SeqCst));
        assert!(newer.ensure_current().await.is_ok());
    }

    #[tokio::test]
    async fn persistence_for_different_slots_does_not_block() {
        let tracker = Arc::new(LatestRequestTracker::default());
        let first = tracker
            .begin(AgentRequestSlot::summary(1, "en", "medium"))
            .await;
        let second = tracker
            .begin(AgentRequestSlot::summary(2, "en", "medium"))
            .await;
        let (entered_tx, entered_rx) = tokio::sync::oneshot::channel();
        let (release_tx, release_rx) = tokio::sync::oneshot::channel();

        let first_write = tokio::spawn(async move {
            first
                .run_if_current(|| async move {
                    let _ = entered_tx.send(());
                    let _ = release_rx.await;
                    Ok::<_, AppError>(())
                })
                .await
        });
        entered_rx.await.expect("first write should start");

        tokio::time::timeout(
            Duration::from_millis(100),
            second.run_if_current(|| async { Ok::<_, AppError>(()) }),
        )
        .await
        .expect("a different slot should not be blocked")
        .expect("second write should remain current");

        let _ = release_tx.send(());
        first_write
            .await
            .expect("first task should join")
            .expect("first write should succeed");
    }

    #[tokio::test]
    async fn a_new_request_waits_for_in_flight_persistence_in_the_same_slot() {
        let tracker = Arc::new(LatestRequestTracker::default());
        let slot = AgentRequestSlot::summary(1, "en", "medium");
        let older = tracker.begin(slot.clone()).await;
        let older_after_write = older.clone();
        let wrote = Arc::new(AtomicBool::new(false));
        let stale_write = wrote.clone();
        let (write_entered_tx, write_entered_rx) = tokio::sync::oneshot::channel();
        let (release_write_tx, release_write_rx) = tokio::sync::oneshot::channel();

        let old_write = tokio::spawn(async move {
            older
                .run_if_current(|| async move {
                    let _ = write_entered_tx.send(());
                    let _ = release_write_rx.await;
                    stale_write.store(true, Ordering::SeqCst);
                    Ok::<_, AppError>(())
                })
                .await
        });
        write_entered_rx.await.expect("old write should start");

        let (begin_entered_tx, begin_entered_rx) = tokio::sync::oneshot::channel();
        let begin_tracker = tracker.clone();
        let mut newer_begin = tokio::spawn(async move {
            let _ = begin_entered_tx.send(());
            begin_tracker.begin(slot).await
        });
        begin_entered_rx
            .await
            .expect("new request registration should start");

        assert!(
            tokio::time::timeout(Duration::from_millis(100), &mut newer_begin)
                .await
                .is_err(),
            "new request must not register while the old write is in flight"
        );

        let _ = release_write_tx.send(());
        old_write
            .await
            .expect("old write task should join")
            .expect("the already-started write should complete before supersession");
        assert!(wrote.load(Ordering::SeqCst));

        let newer = tokio::time::timeout(Duration::from_secs(1), newer_begin)
            .await
            .expect("new request should register after persistence completes")
            .expect("new request task should join");
        assert!(newer.ensure_current().await.is_ok());
        assert!(older_after_write.ensure_current().await.is_err());
    }

    #[tokio::test]
    async fn expired_slots_are_pruned_on_the_next_request() {
        let tracker = Arc::new(LatestRequestTracker::default());
        let context = tracker
            .begin(AgentRequestSlot::summary(1, "en", "medium"))
            .await;
        drop(context);

        let _active = tracker
            .begin(AgentRequestSlot::translation(2, "zh-CN"))
            .await;
        let latest = tracker
            .latest
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        assert_eq!(latest.len(), 1);
    }
}
