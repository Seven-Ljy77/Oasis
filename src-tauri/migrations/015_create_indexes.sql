-- Migration 015: Create secondary indexes
CREATE INDEX idx_entry_published_at ON entry(published_at);
CREATE INDEX idx_entry_created_at ON entry(created_at);
CREATE INDEX idx_entry_is_deleted ON entry(is_deleted);
CREATE INDEX idx_entry_is_read ON entry(is_read);
CREATE INDEX idx_entry_feed_read ON entry(feed_id, is_read);
CREATE INDEX idx_agent_task_run_entry_type ON agent_task_run(entry_id, task_type);
CREATE INDEX idx_agent_task_run_status ON agent_task_run(status);
CREATE INDEX idx_llm_usage_event_created_at ON llm_usage_event(created_at);
CREATE INDEX idx_tag_batch_run_status ON tag_batch_run(status);
CREATE INDEX idx_tag_batch_entry_run_id ON tag_batch_entry(run_id);
