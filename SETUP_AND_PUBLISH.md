# ProjectCodeWiz — Setup, Testing & Publishing Guide

---

## PART 1: INSTALL THE .vsix FILE (TEST LOCALLY)

### Method A — Via VS Code UI (Easiest)
1. Open VS Code
2. Go to the **Extensions** panel (`Ctrl+Shift+X`)
3. Click the **`···`** (three dots) menu at the top-right of the Extensions panel
4. Select **"Install from VSIX…"**
5. Navigate to and select **`projectcodewiz-1.0.0.vsix`**
6. Click **Install**
7. VS Code will prompt you to **Reload** — do it

### Method B — Via Terminal
```bash
code --install-extension projectcodewiz-1.0.0.vsix
```

---

## PART 2: USING THE EXTENSION

1. **Open a C++ workspace** (a folder containing `.cpp`, `.h`, or `.hpp` files)
2. Trigger visualization using any of these:
   - Click **`⬡ Visualize`** in the **status bar** (bottom of VS Code)
   - Press `Ctrl+Shift+V` (Windows/Linux) or `Cmd+Shift+V` (Mac)
   - Open Command Palette (`Ctrl+Shift+P`) → type `Visualize`
3. Wait for the progress notification to complete
4. The graph opens in a new tab!

### Interacting with the Graph
- **Hover** over any node → see name, type, file, line, description
- **Hover** over any edge → see relation type + auto-generated description
- **Click** a node → highlight its connections + open detail panel
- **Double-click** a node → jump to that code in the editor
- **Drag** nodes to rearrange
- **Search bar** → type to highlight matching nodes
- **Filter toggles** → show/hide Classes, Functions, Variables, Objects, Files
- **Trace button** → click to enable trace mode, then click any node to see the full dependency chain
- **File View** → switch to file-only dependency graph
- **Export** → save as PNG or JSON

---

## PART 3: BUILD FROM SOURCE (FOR DEVELOPMENT)

### Prerequisites
```bash
node --version   # Need 18+
npm --version    # Need 9+
```

### Setup
```bash
# Clone or extract the project folder
cd ProjectCodeWiz

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile on save)
npm run watch
```

### Test in VS Code
1. Open the `ProjectCodeWiz` folder in VS Code
2. Press **`F5`** → this launches an **Extension Development Host**
3. In the new VS Code window, open a C++ project and run Visualize

### Repackage .vsix
```bash
npm run compile
npx vsce package --no-dependencies
# Creates: projectcodewiz-1.0.0.vsix
```

---

## PART 4: PUBLISH TO VS CODE MARKETPLACE

### Step 1 — Create a Microsoft Account
Go to: https://aka.ms/vscodepublish

### Step 2 — Create a Publisher
1. Visit: https://marketplace.visualstudio.com/manage
2. Sign in with your Microsoft account
3. Click **"Create publisher"**
4. Set the Publisher ID to: `GaryDaVinci`
5. Fill in display name, email, etc.
6. Click **Create**

### Step 3 — Create a Personal Access Token (PAT)
1. Go to: https://dev.azure.com → sign in
2. Click your profile icon (top right) → **"Personal access tokens"**
3. Click **"New Token"**
4. Set:
   - **Name**: `vscode-publish`
   - **Organization**: Select **All accessible organizations**
   - **Expiration**: 90 days (or custom)
   - **Scopes**: Click "Show all scopes" → check **Marketplace → Manage**
5. Click **Create** → **COPY THE TOKEN NOW** (you won't see it again)

### Step 4 — Login with vsce
```bash
cd ProjectCodeWiz
npx vsce login GaryDaVinci
# It will ask: "Personal Access Token for publisher 'GaryDaVinci':"
# Paste your token and press Enter
```

### Step 5 — Final package.json updates (REQUIRED before publishing)
Open `package.json` and add:
```json
{
  "publisher": "GaryDaVinci",
  "repository": {
    "type": "git",
    "url": "https://github.com/GaryDaVinci/ProjectCodeWiz"
  },
  "license": "MIT"
}
```
Also create a `LICENSE` file:
```
MIT License

Copyright (c) 2025 GaryDaVinci

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

### Step 6 — Publish
```bash
# Recompile first
npm run compile

# Publish to marketplace
npx vsce publish

# OR publish a specific version
npx vsce publish 1.0.0

# To bump version and publish (patch/minor/major)
npx vsce publish patch
```

### Step 7 — Verify
- Go to: https://marketplace.visualstudio.com/items?itemName=GaryDaVinci.projectcodewiz
- It may take **5–10 minutes** to appear after publishing

---

## PART 5: UPDATE THE EXTENSION

To release a new version:

1. Update `"version"` in `package.json` (e.g., `"1.0.1"`)
2. Add changelog to `CHANGELOG.md`
3. Compile: `npm run compile`
4. Publish: `npx vsce publish`

---

## PART 6: CLANG SETUP (FOR ERROR DETECTION)

### Windows
```
winget install LLVM.LLVM
# OR download from: https://releases.llvm.org/
# After install, add C:\Program Files\LLVM\bin to your PATH
```

### macOS
```bash
xcode-select --install
# clang is included with Xcode Command Line Tools
```

### Ubuntu/Debian
```bash
sudo apt install clang
```

### Verify
```bash
clang --version
```

If clang is not on PATH, set it in VS Code settings:
```json
"projectcodewiz.clangPath": "/usr/bin/clang"
```

---

## TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "No C++ files found" | Make sure workspace folder contains `.cpp`/`.h`/`.hpp` files |
| Graph is empty | Check that files are not in ignored directories (`build`, `node_modules`, etc.) |
| Clang errors not showing | Install clang and ensure it's on PATH, or set `projectcodewiz.clangPath` |
| Extension not activating | Reload VS Code window (`Ctrl+Shift+P` → "Reload Window") |
| Publish fails | Ensure your PAT has "Marketplace → Manage" scope and is not expired |
| Large project is slow | Increase `maxFileSizeKB` limit; the extension batches parsing automatically |
