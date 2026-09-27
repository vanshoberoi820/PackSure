/* ─────────────────────────────────────────────
   PackSure Security Guard — Anti-Inspection & DevTools Blocker
   Protects source code, disables context menus, blocks inspect shortcuts
   ───────────────────────────────────────────── */

export function initSecurityGuard() {
  if (typeof window === 'undefined') return;

  // 1. Disable Right Click Context Menu
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });

  // 2. Block Inspect & Source View Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // F12 (DevTools)
    if (e.key === 'F12' || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    const isCtrlOrCmd = e.ctrlKey || e.metaKey;

    if (isCtrlOrCmd) {
      // Ctrl + Shift + I (Inspect)
      // Ctrl + Shift + J (Console)
      // Ctrl + Shift + C (Element selector)
      if (e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl + U (View Source)
      if (['U', 'u', 'S', 's'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, { capture: true });

  // 3. Security Warning in Console
  try {
    const titleStyle = 'color: #dc2626; font-size: 24px; font-weight: bold; text-shadow: 1px 1px 2px black;';
    const bodyStyle = 'color: #4b5563; font-size: 13px; font-weight: 500;';
    
    setTimeout(() => {
      console.log('%c🛑 PackSure GovTech Security Guard Active', titleStyle);
      console.log('%cThis is an official Legal Metrology compliance portal. All inspection logs and tamper-evident hashes are recorded.', bodyStyle);
    }, 500);
  } catch {}
}
