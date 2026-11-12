// Lucide icons. In the HTML, <i data-lucide="panel-left"></i> is swapped for
// the real icon (an <svg>) when the app starts.
//
// Only the icons listed here are included in the app, to keep it small.
// To use a new icon: find its name on lucide.dev, add it here (in
// CamelCase, e.g. "panel-left" → PanelLeft), then use it in the HTML.

import {
  createIcons,
  Eraser, FilePlus, FolderOpen, ImagePlus, Minus, Paintbrush, Palette, PanelLeft,
  PanelRight, Plus, Redo2, Scan, Settings, Trash2, TriangleAlert, Undo2,
} from 'lucide';

const icons = {
  Eraser, FilePlus, FolderOpen, ImagePlus, Minus, Paintbrush, Palette, PanelLeft,
  PanelRight, Plus, Redo2, Scan, Settings, Trash2, TriangleAlert, Undo2,
};

export function showIcons() {
  createIcons({ icons });
}
