"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function fail(msg) { throw new Error(msg); }
function assert(cond, msg) { if (!cond) fail(msg); }
function assertEq(a, b, msg) { if (a !== b) fail((msg || "eq") + ": " + JSON.stringify(a) + " !== " + JSON.stringify(b)); }

function makeActor(id, name, type) {
  return { id, name, type: type || "blackIce", isOwner: false };
}

function makeTokenDoc(id, name, actor, scene, hidden, uid) {
  return {
    id, name, actorId: actor.id, actor, hidden: !!hidden, parent: scene,
    object: null,
    getFlag(scope, key) { return scope === "world" && key === "netarchIceUid" ? uid : undefined; }
  };
}

function makePlaceable(doc) {
  const token = {
    id: doc.id, name: doc.name, actor: doc.actor, document: doc,
    hidden: doc.hidden, visible: !doc.hidden, isTargeted: false,
    setTarget(next, opts) {
      const release = !opts || opts.releaseOthers !== false;
      if (release) game.user.targets.clear();
      if (next) { game.user.targets.add(token); token.isTargeted = true; }
      else { game.user.targets.delete(token); token.isTargeted = false; }
      return true;
    }
  };
  doc.object = token;
  return token;
}

let game, canvas, ui, foundry, app, netarchs;

function resetWorld(opts) {
  opts = opts || {};
  const iceActor = makeActor("ice1", "Liche", "blackIce");
  const runner = makeActor("runner1", "Daemon", "character");
  const playerScene = { id: "scene-player", name: "Player Scene", tokens: { contents: [], get(id) { return this.contents.find(d => d.id === id); }, has(id) { return !!this.get(id); } } };
  const gmScene = { id: "scene-gm", name: "GM Scene", tokens: { contents: [], get(id) { return this.contents.find(d => d.id === id); }, has(id) { return !!this.get(id); } } };
  const scenes = {
    contents: [playerScene, gmScene],
    get(id) { return this.contents.find(s => s.id === id); },
    [Symbol.iterator]() { return this.contents[Symbol.iterator](); }
  };

  const ice = { name: "Liche", uid: "ice-liche-0", tokenId: opts.tokenOnGmScene ? "tok-gm" : (opts.tokenOnPlayerScene ? "tok-pl" : null) };
  const node = { id: "node-1", blackIce: [ice] };
  netarchs = { arch1: { id: "arch1", nodes: [node] } };

  const placeables = [];
  if (opts.tokenOnPlayerScene) {
    const doc = makeTokenDoc("tok-pl", "Liche", iceActor, playerScene, !!opts.hidden, "ice-liche-0");
    playerScene.tokens.contents.push(doc);
    placeables.push(makePlaceable(doc));
  }
  if (opts.tokenOnGmScene) {
    const doc = makeTokenDoc("tok-gm", "Liche", iceActor, gmScene, !!opts.hidden, "ice-liche-0");
    gmScene.tokens.contents.push(doc);
    makePlaceable(doc);
  }

  const userTargets = new Set();
  game = {
    user: { id: "player1", isGM: !!opts.userIsGM, targets: userTargets, character: runner },
    actors: {
      get(id) { return [iceActor, runner].find(a => a.id === id); },
      find(fn) { return [iceActor, runner].find(fn); }
    },
    scenes
  };
  canvas = {
    scene: opts.viewScene === "gm" ? gmScene : playerScene,
    tokens: {
      placeables: opts.viewScene === "gm" ? gmScene.tokens.contents.map(d => d.object).filter(Boolean) : placeables,
      hover: null,
      get(id) {
        const list = this.placeables || [];
        return list.find(t => t.id === id) || null;
      }
    }
  };
  ui = { notifications: { warn() {}, info() {}, error() {} } };
  foundry = { utils: { randomID: () => "id", duplicate: x => JSON.parse(JSON.stringify(x)) } };

  app = {
    _netarchId: "arch1",
    _mapperTarget: null,
    _hoverHit: null,
    _hoverToken: null,
    _drawMap() {},
    _sceneTokenForIce: null,
    _iceOccurrence: null,
    _setMapperTarget: null
  };
  return { iceActor, runner, ice, node, playerScene, gmScene };
}

const extracted = fs.readFileSync("/tmp/core-105-extracted.js", "utf8");

function loadApi() {
  const sandbox = {
    game, canvas, ui, foundry, console,
    findMapperApp: () => app,
    loadNetarchs: () => netarchs,
    Event: class { constructor() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(extracted, sandbox);
  // bind methods
  sandbox._iceOccurrence = sandbox._iceOccurrence;
  app._iceOccurrence = function(node, index) { return sandbox._iceOccurrence.call(this, node, index); };
  app._sceneTokenForIce = function(node, index) { return sandbox._sceneTokenForIce.call(this, node, index); };
  app._setMapperTarget = function(hit) { return sandbox._setMapperTarget.call(this, hit); };
  sandbox.SystemUtils = {
    getUserTargetedOrSelected(kind) {
      const targets = new Set(game.user.targets);
      return kind === "selected" ? [] : Array.from(targets);
    }
  };
  const orig = sandbox.SystemUtils.getUserTargetedOrSelected.bind(sandbox.SystemUtils);
  sandbox.SystemUtils.getUserTargetedOrSelected = function(kind) {
    const tokens = orig(kind) || [];
    if (kind !== "targeted") return tokens;
    return sandbox.mergeCardTargets(tokens);
  };
  return sandbox;
}

function pressT(api, ice, node) {
  const hit = { kind: "ice", ice, node, index: 0, key: "ice:node-1:0" };
  app._hoverHit = hit;
  app._setMapperTarget(hit);
}

function cardFromCprAndMapper(api, runner) {
  const item = { id: "prog1", name: "Sword" };
  const fromCpr = api.SystemUtils.getUserTargetedOrSelected("targeted");
  const fromMapper = api.damageCardEntityData(runner, item);
  return { fromCpr, fromMapper };
}

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (err) { results.push({ name, ok: false, error: String(err && err.stack || err) }); }
}

test("GM absent, no ICE token on any scene: T still puts ICE actor on the damage card", () => {
  const { iceActor, runner, ice, node } = resetWorld({ userIsGM: false });
  const api = loadApi();
  pressT(api, ice, node);
  assertEq(app._mapperTarget.actorId, iceActor.id, "mapper actorId");
  const { fromCpr, fromMapper } = cardFromCprAndMapper(api, runner);
  assert(fromCpr.length === 1, "CPR targeted list length " + fromCpr.length);
  assertEq(fromCpr[0].actor.id, iceActor.id, "CPR stand-in actor");
  assertEq(fromCpr[0].name, "Liche", "CPR stand-in name");
  assert(fromMapper.tokens.length === 1, "entityData.tokens length");
  assertEq(fromMapper.tokens[0].actor.id, iceActor.id, "entityData actor");
  assertEq(fromMapper.tokens[0].id, iceActor.id, "stand-in id is actor id");
});

test("GM on another scene with the only ICE token: card still lists the ICE actor", () => {
  const { iceActor, runner, ice, node } = resetWorld({ userIsGM: false, tokenOnGmScene: true, viewScene: "player" });
  const api = loadApi();
  // Player cannot see the GM-scene placeable on their canvas
  assertEq(canvas.tokens.placeables.length, 0, "no placeables on player scene");
  pressT(api, ice, node);
  const { fromCpr, fromMapper } = cardFromCprAndMapper(api, runner);
  assertEq(fromCpr[0].actor.id, iceActor.id, "actor from other-scene token");
  assertEq(fromCpr[0].id, "tok-gm", "uses other-scene token id");
  assertEq(fromMapper.tokens[0].actor.id, iceActor.id);
});

test("Player scene has no ICE token: same stand-in, no GM required", () => {
  const { iceActor, runner, ice, node } = resetWorld({ userIsGM: false, tokenOnGmScene: false, tokenOnPlayerScene: false });
  const api = loadApi();
  pressT(api, ice, node);
  const { fromCpr } = cardFromCprAndMapper(api, runner);
  assertEq(fromCpr[0].actor.id, iceActor.id);
});

test("Hidden ICE token on the player's scene is found and lands on the card", () => {
  const { iceActor, runner, ice, node } = resetWorld({ userIsGM: false, tokenOnPlayerScene: true, hidden: true });
  const api = loadApi();
  const tok = canvas.tokens.get("tok-pl");
  assert(tok, "hidden token is in placeables");
  assert(tok.hidden, "token hidden");
  pressT(api, ice, node);
  const { fromCpr, fromMapper } = cardFromCprAndMapper(api, runner);
  assertEq(fromCpr[0].id, "tok-pl", "uses hidden placeable id");
  assertEq(fromCpr[0].actor.id, iceActor.id);
  assertEq(fromMapper.tokens[0].id, "tok-pl");
  // Visible reticle is optional; card is what CPR apply uses
  const htmlActor = fromMapper.tokens[0].actor.id;
  const htmlToken = fromMapper.tokens[0].id;
  assertEq(htmlActor, iceActor.id, "data-actor-id");
  assertEq(htmlToken, "tok-pl", "data-token-id");
});

test("Target lands on the damage card fields CPR's per-target button reads", () => {
  const { iceActor, runner, ice, node } = resetWorld({ userIsGM: false });
  const api = loadApi();
  pressT(api, ice, node);
  const data = api.damageCardEntityData(runner, { id: "prog1" });
  const token = data.tokens[0];
  assert(token, "tokens[0]");
  // template: token.name, token.actor.id, token.id
  assertEq(token.name, "Liche");
  assertEq(token.actor.id, iceActor.id);
  assert(token.id, "token.id present");
  // CPR local apply fallback: game.actors.find(a => a.id === actorId)
  const applied = game.actors.find(a => a.id === token.actor.id);
  assertEq(applied.name, "Liche");
  assertEq(applied.type, "blackIce");
});

test("Second T on the same ICE clears the mapper target and the card list", () => {
  const { ice, node, runner } = resetWorld({ userIsGM: false });
  const api = loadApi();
  pressT(api, ice, node);
  pressT(api, ice, node);
  assertEq(app._mapperTarget, null, "cleared");
  const { fromCpr, fromMapper } = cardFromCprAndMapper(api, runner);
  assertEq(fromCpr.length, 0, "no stand-in after clear");
  assertEq(fromMapper.tokens.length, 0);
});

test("Visible token on the player's scene is used when Foundry setTarget succeeds", () => {
  const { iceActor, runner, ice, node } = resetWorld({ userIsGM: false, tokenOnPlayerScene: true, hidden: false });
  const api = loadApi();
  const tok = canvas.tokens.get("tok-pl");
  canvas.tokens.hover = tok;
  api.foundryTargetHovered(false);
  assert(game.user.targets.has(tok), "real Foundry target");
  const { fromCpr } = cardFromCprAndMapper(api, runner);
  // no mapper target yet; real target still on the card
  assert(fromCpr.some(t => t.id === "tok-pl" && t.actor.id === iceActor.id), "real token on card");
});

const failed = results.filter(r => !r.ok);
for (const r of results) console.log((r.ok ? "PASS" : "FAIL") + " " + r.name + (r.ok ? "" : "\n  " + r.error));
console.log(results.filter(r => r.ok).length + "/" + results.length + " passed");
if (failed.length) process.exit(1);
