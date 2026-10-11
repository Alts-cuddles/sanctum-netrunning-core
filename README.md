# Sanctum Netrunning Core

Netarch mapper, scanner access points, and sheet jack-in for Cyberpunk RED on Foundry VTT.

Core rules only. No Elysia bonus. Scanner range is the roll total, not double.

## Install

1. Download the release zip.
2. In Foundry, go to **Add-on Modules** and choose **Install Module**.
3. Paste the manifest URL, or drop the unzipped folder into `Data/modules/sanctum-netrunning-core`.
4. Enable **Sanctum Netrunning Core**.
5. Reload.

Requires the **Cyberpunk RED - Core** system and Foundry 12.

Do not enable this and **Sanctum Netrunning** at the same time. They share architecture data and both hook the same sheets.

## Open the mapper

Make a script macro and paste this. Only a GM can open it.

```javascript
if (!game.user || !game.user.isGM) {
  ui.notifications.warn("Only the GM can open the mapper.");
} else if (game.netarch && typeof game.netarch.open === "function") {
  await game.netarch.open();
} else if (typeof game.netarchOpen === "function") {
  await game.netarchOpen();
} else {
  ui.notifications.warn("Mapper did not boot. Replace mapper.js and reload.");
}
```

## What it does

**Mapper**
- Build a blank map or generate one from the CPR tables.
- Set floors, budget, Black ICE, control nodes, passwalls, files, and demons. Blank fields still roll.
- Basic stays small. Standard is a light challenge. Uncommon is bigger. Advanced is the long one.
- Every netarch has a Root. Black ICE and demons do not spawn on Files, Control Nodes, Passwalls, or Root.
- Edit on expands the same bar on a blank or a generated map. Edit off collapses it.
- Drag a floor row to reorder it. Unlink floor drops that floor's connections. Unlink all clears every connection.
- Floor clips play on the tile. Unvisited floors stay gray until someone has been there or you reveal them.
- Players do not see floor names. Player preview shows their view.
- Players get Rules, Combat, and Runners. No All architectures button.
- Click a runner to select it. T targets, and T again clears it.
- Each jacked-in token moves on its own. A GM can move any token, select any floor, and drag ICE without jacking in.
- Two or more Ex-Disk add 1 NET Action on a physical jack in. A virtual jack in does not get that bonus. There is no Elysia bonus.
- Jack In asks Physical or Virtual, then Normal (1) or Stealth (2), and spends those NET Actions.
- A rezzed Armor program reduces incoming program damage by 4.
- Passwords block movement off that floor until the GM unlocks it. Unlock is on the Floors tab and on right-click.
- Short Distance Link and Long Distance Link floors move a runner to another architecture's entry. Both use the Control Node tile.
- New architectures are tagged with the current scene.

**Scanner**
- Right-click a token to set it as an access point, or assign and remove tokens on a Control Node.
- A Scanner roll reads the total and measures that distance with the scene ruler. It is not doubled.
- In range, the token image, name, and purple pulse show through walls.
- Only the user who rolled sees the pulse. Unassign stops it.

**Jack In**
- Jack In sits under Speed, with a line between them like Zap and Defense.
- It uses the selected access point, then the open mapper arch, then the nearest.
- Click it, pick Physical or Virtual, then Normal or Stealth, and the mapper opens already jacked into that architecture.
