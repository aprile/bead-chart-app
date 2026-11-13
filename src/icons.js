// Lucide icons. In the HTML, <i data-lucide="panel-left"></i> is swapped for
// the real icon (an <svg>) when the app starts.
//
// Only the icons listed here are included in the app, to keep it small.
// To use a new icon: find its name on lucide.dev, add it here (in
// CamelCase, e.g. "panel-left" → PanelLeft), then use it in the HTML.

import {
  createIcons,
  Check, ChevronDown, ClipboardPaste, Copy, Eraser, FilePlus, FolderOpen, ImagePlus, Minus,
  PaintBucket, Paintbrush, Palette, PanelLeft, PanelRight, Pencil, Pipette, Plus, Redo2, Scan,
  Settings, SquareDashed, Trash2, TriangleAlert, Undo2, X,
} from 'lucide';

const icons = {
  Check, ChevronDown, ClipboardPaste, Copy, Eraser, FilePlus, FolderOpen, ImagePlus, Minus,
  PaintBucket, Paintbrush, Palette, PanelLeft, PanelRight, Pencil, Pipette, Plus, Redo2, Scan,
  Settings, SquareDashed, Trash2, TriangleAlert, Undo2, X,
};

export function showIcons() {
  createIcons({ icons });
}
