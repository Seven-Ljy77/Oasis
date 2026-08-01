import React, { useState } from "react";
import { useTagStore } from "@/stores/useTagStore";
import { useI18n } from "@/lib/i18n";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";

interface TagRenameSheetProps {
  open: boolean;
  onClose: () => void;
  tagId: number;
  currentName: string;
}

const TagRenameSheet: React.FC<TagRenameSheetProps> = ({
  open,
  onClose,
  tagId,
  currentName,
}) => {
  const { t } = useI18n();
  const [newName, setNewName] = useState(currentName);
  const renameTag = useTagStore((s) => s.renameTag);

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === currentName) return;
    await renameTag(tagId, newName.trim());
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.tagLibrary.rename} width="400px">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t.tagLibrary.name}
          </label>
          <input
            type="text"
            readOnly
            value={currentName}
            className="w-full h-8 px-3 text-sm rounded-md border border-border bg-surface-secondary text-slate-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            {t.common.rename}
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.tagLibrary.rename}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
            }}
            className="w-full h-8 px-3 text-sm rounded-md border border-border bg-surface focus:border-accent focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" size="md" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleRename}
            disabled={!newName.trim() || newName.trim() === currentName}
          >
            {t.common.rename}
          </Button>
        </div>
      </div>
    </Sheet>
  );
};

export default TagRenameSheet;
