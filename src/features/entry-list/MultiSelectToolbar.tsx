import React from "react";
import { useAppStore } from "@/stores/useAppStore";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/ui/Button";

const MultiSelectToolbar: React.FC = () => {
  const { t } = useI18n();
  const selectedEntryIds = useAppStore((s) => s.selectedEntryIds);
  const exitMultiSelect = useAppStore((s) => s.exitMultiSelect);
  const openSheet = useAppStore((s) => s.openSheet);

  const count = selectedEntryIds.size;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-accent-muted border-b border-accent/20">
      <span className="text-sm font-medium text-accent">
        {count} {t.entryList.selected}
      </span>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={exitMultiSelect}
      >
        {t.common.cancel}
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={() => openSheet("exportMultipleDigest")}
        disabled={count === 0}
      >
        {t.entryList.continue}
      </Button>
    </div>
  );
};

export default MultiSelectToolbar;
