import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import { useFeedStore } from "@/stores/useFeedStore";
import { probeFeed } from "@/lib/ipc";

interface FeedEditorSheetProps {
  open: boolean;
  onClose: () => void;
  feedId?: number;
  initialUrl?: string;
  initialTitle?: string;
}

const FeedEditorSheet: React.FC<FeedEditorSheetProps> = ({
  open,
  onClose,
  feedId,
  initialUrl = "",
  initialTitle = "",
}) => {
  const { t } = useI18n();
  const [url, setUrl] = useState(initialUrl);
  const [title, setTitle] = useState(initialTitle);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { addFeed } = useFeedStore();
  const isEditing = Boolean(feedId);

  const handleCheck = async () => {
    if (!url.trim()) {
      setValidationError(t.feedEditor.invalidUrl);
      return;
    }
    setValidating(true);
    setValidationError(null);
    try {
      const result = await probeFeed(url.trim());
      if (result.title) {
        setTitle(result.title);
      }
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to validate feed");
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!url.trim()) {
      setValidationError(t.feedEditor.invalidUrl);
      return;
    }
    setSaving(true);
    setValidationError(null);
    try {
      await addFeed(url.trim(), title.trim() || undefined);
      setUrl("");
      setTitle("");
      onClose();
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Failed to add feed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={isEditing ? t.feedEditor.editTitle : t.feedEditor.addTitle}>
      <div className="space-y-4">
        {/* URL input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t.feedEditor.feedUrl}
          </label>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="flex-1 h-8 px-3 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCheck}
              loading={validating}
            >
              {t.feedEditor.check}
            </Button>
          </div>
        </div>

        {/* Title input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t.feedEditor.feedName}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Auto-filled after validation"
            className="w-full h-8 px-3 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
          />
        </div>

        {/* Validation error */}
        {validationError && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
            {validationError}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            loading={saving}
          >
            {isEditing ? t.feedEditor.saveChanges : t.feedEditor.addFeed}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default FeedEditorSheet;
