console.log("CAO token-rings.js loaded");

/**
 * CAO | The Call of the Ancestors
 * scripts/effects/token-rings.js
 *
 * Zeigt einen rotierenden Ranken-Ring (Hunter's Mark) bzw. einen
 * pulsierenden Funken-Ring (Faerie Fire) um Token an, deren
 * Token-Dokument das entsprechende Flag gesetzt hat:
 *   flags["cao-the-call-of-the-ancestors"].hm
 *   flags["cao-the-call-of-the-ancestors"].ff
 */

const CAO_NS = "cao-the-call-of-the-ancestors";

const CAO_RING_ASSETS = {
  hm: "modules/cao-the-call-of-the-ancestors/assets/effect/hunters-mark-ring.png",
  ff: "modules/cao-the-call-of-the-ancestors/assets/effect/fairy-fire-ring.png"
};

// tokenId -> { hm: PIXI.Sprite|null, ff: PIXI.Sprite|null }
const CAO_TOKEN_RINGS = new Map();

function caoGetRingSet(token) {
  let set = CAO_TOKEN_RINGS.get(token.id);
  if (!set) {
    set = { hm: null, ff: null };
    CAO_TOKEN_RINGS.set(token.id, set);
  }
  return set;
}

function caoCreateRingSprite(token, kind) {
  const sprite = PIXI.Sprite.from(CAO_RING_ASSETS[kind]);
  sprite.anchor.set(0.5);
  sprite.width = token.w * 2;
  sprite.height = token.h * 2;
  sprite.position.set(token.w / 2, token.h / 2);
  sprite.zIndex = kind === "ff" ? 2 : 1;
  if (kind === "ff") {
    sprite.blendMode = PIXI.BLEND_MODES.ADD;
  }
  return sprite;
}

function caoCreateRingContainer(token, kind) {
  const container = new PIXI.Container();
  container.addChild(caoCreateRingSprite(token, kind));
  if (kind === "ff") {
    // zweiter additiver Layer fuer spuerbar mehr Helligkeit
    container.addChild(caoCreateRingSprite(token, kind));
  }
  return container;
}

function caoUpdateRingsForToken(token) {
  if (!token?.document) return;

  const flags = token.document.flags?.[CAO_NS] ?? {};
  const set = caoGetRingSet(token);

  const wantHm = !!flags.hm;
  const wantFf = !!flags.ff;

  if (wantHm && !set.hm) {
    console.log("CAO: erzeuge Hunter's-Mark-Ring auf", token.name);
    set.hm = caoCreateRingContainer(token, "hm");
    token.addChild(set.hm);
  } else if (!wantHm && set.hm) {
    console.log("CAO: entferne Hunter's-Mark-Ring von", token.name);
    token.removeChild(set.hm);
    set.hm.destroy({ children: true });
    set.hm = null;
  }

  if (wantFf && !set.ff) {
    console.log("CAO: erzeuge Faerie-Fire-Ring auf", token.name);
    set.ff = caoCreateRingContainer(token, "ff");
    token.addChild(set.ff);
  } else if (!wantFf && set.ff) {
    console.log("CAO: entferne Faerie-Fire-Ring von", token.name);
    token.removeChild(set.ff);
    set.ff.destroy({ children: true });
    set.ff = null;
  }
}

function caoPositionRings(token) {
  const set = CAO_TOKEN_RINGS.get(token.id);
  if (!set) return;

  for (const container of [set.hm, set.ff]) {
    if (!container) continue;
    for (const sprite of container.children) {
      sprite.width = token.w * 2;
      sprite.height = token.h * 2;
      sprite.position.set(token.w / 2, token.h / 2);
    }
  }
}

function caoCleanupRings(tokenId) {
  const set = CAO_TOKEN_RINGS.get(tokenId);
  if (!set) return;
  for (const sprite of [set.hm, set.ff]) {
    sprite?.destroy();
  }
  CAO_TOKEN_RINGS.delete(tokenId);
}

/* -------------------------------------------- */
/* Hooks: Ringe erzeugen/entfernen/positionieren */
/* -------------------------------------------- */

Hooks.on("drawToken", (token) => {
  caoUpdateRingsForToken(token);
});

Hooks.on("refreshToken", (token) => {
  caoPositionRings(token);
});

Hooks.on("destroyToken", (token) => {
  caoCleanupRings(token.id);
});

Hooks.on("updateToken", (tokenDoc, changes) => {
  if (!foundry.utils.hasProperty(changes, `flags.${CAO_NS}`)) return;
  const token = tokenDoc.object;
  if (token) caoUpdateRingsForToken(token);
});

/* -------------------------------------------- */
/* Animation: Rotation (HM) + Pulsieren (FF)     */
/* -------------------------------------------- */

Hooks.once("canvasReady", () => {
  console.log("CAO: starte Ring-Animation-Ticker");

  canvas.app.ticker.add((delta) => {
    const rotationStep = 0.01 * delta;

    for (const set of CAO_TOKEN_RINGS.values()) {
      if (set.hm) {
        for (const sprite of set.hm.children) sprite.rotation += rotationStep;
      }
      if (set.ff) {
        const t = performance.now() / 500;
        for (const sprite of set.ff.children) sprite.alpha = 0.8 + Math.sin(t) * 0.2;
      }
    }
  });
});