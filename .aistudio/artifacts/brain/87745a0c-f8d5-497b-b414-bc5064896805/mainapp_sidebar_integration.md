# MainApp Sidebar Integration Reference

### 1. Header is full width:
```tsx
<div className="h-screen w-full bg-[#08090b] text-[#f1f2f4] flex flex-col select-none overflow-hidden">
  {/* Top Navigation Bar: FULL WIDTH across top of screen */}
  <header className="h-14 sm:h-16 shrink-0 z-40 bg-[#08090b]/95 backdrop-blur-md border-b border-neutral-900 px-3 sm:px-8 py-2 sm:py-2.5 flex items-center justify-between gap-2 sm:gap-4 w-full">
    {/* Header contents: Flow logo, Extension Download Button, Email, Icons, Plan Pill, Avatar */}
  </header>
```

### 2. Sidebar + Content Body underneath Header:
```tsx
  {/* Body Area Underneath Header */}
  <div className="flex-1 flex flex-row w-full min-h-0 overflow-hidden">
    {/* Desktop Left Sidebar: Completely stationary, does not scroll with page */}
    <div className="hidden md:flex h-full shrink-0 z-30">
      <AppSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={() => {
          if (onOpenSettings) onOpenSettings();
          else setSettingsOpen(true);
        }}
        onOpenPricing={() => setPricingOpen(true)}
      />
    </div>

    {/* Right Content Column: Only this side scrolls! */}
    <div className="flex-1 h-full overflow-y-auto flex flex-col min-w-0">
      {/* Mobile Sticky Quick Platform Selector Bar (Logos only so all 5 fit without cut-off) */}
      <div className="flex md:hidden items-center justify-between gap-1.5 px-2.5 py-2 bg-[#0e1017]/95 border-b border-neutral-800/80 shrink-0 sticky top-0 z-20 backdrop-blur-md w-full">
        {/* Logos for flow, chatgpt, super-grok, muse-ai, meta-ai */}
      </div>
      {/* Rest of page content */}
    </div>
  </div>
</div>
```
