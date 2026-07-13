// =============================================================================
// Mercury — Context Menu component
// =============================================================================

import React, { useEffect, useRef, useState } from "react";

export interface ContextMenuItem {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  separator?: boolean;
  danger?: boolean;
}

export interface ContextMenuProps {
  /** Menu items */
  items: ContextMenuItem[];
  /** The element that triggers the context menu on right-click */
  children: React.ReactNode;
  /** Additional CSS classes for the wrapper */
  className?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  items,
  children,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPosition({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  // Close on any click or right-click outside
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener("click", close);
    document.addEventListener("contextmenu", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("contextmenu", close);
    };
  }, [open]);

  return (
    <>
      <div className={className} onContextMenu={handleContextMenu}>
        {children}
      </div>

      {open && (
        <div
          ref={menuRef}
          className="fixed z-[100] min-w-[160px] rounded-lg border border-border bg-white py-1 shadow-lg"
          style={{ left: position.x, top: position.y }}
          role="menu"
        >
          {items.map((item, idx) => {
            if (item.separator) {
              return (
                <div
                  key={`sep-${idx}`}
                  className="my-1 border-t border-border"
                  role="separator"
                />
              );
            }

            return (
              <button
                key={`${item.label}-${idx}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  item.onClick();
                  setOpen(false);
                }}
                className={[
                  "w-full text-left px-3 py-1.5 text-sm transition-colors",
                  item.danger
                    ? "text-red-600 hover:bg-red-50"
                    : "text-slate-700 hover:bg-surface-tertiary",
                  item.disabled
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
};

export default ContextMenu;
