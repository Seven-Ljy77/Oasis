import React from "react";
import { useAppStore } from "@/stores/useAppStore";
import Button from "@/components/ui/Button";

const MultiSelectToolbar: React.FC = () => {
  const selectedEntryIds = useAppStore((s) => s.selectedEntryIds);
  const exitMultiSelect = useAppStore((s) => s.exitMultiSelect);
  const openSheet = useAppStore((s) => s.openSheet);

  const count = selectedEntryIds.size;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-accent-muted border-b border-accent/20">
      <span className="text-sm font-medium text-accent">
        {count} {count === 1 ? "entry" : "entries"} selected
      </span>

      <div className="flex-1" />

      <Button
        variant="ghost"
        size="sm"
        onClick={exitMultiSelect}
      >
        Cancel
      </Button>

      <Button
        variant="primary"
        size="sm"
        onClick={() => openSheet("exportMultipleDigest")}
        disabled={count === 0}
      >
        Continue
      </Button>
    </div>
  );
};

export default MultiSelectToolbar;
