console.log("CAO spell-marks.js loaded");

/**
 * CAO | The Call of the Ancestors
 * scripts/spells/spell-marks.js
 *
 * Setzt/entfernt die Token-Flags für Hunter's Mark und Faerie Fire.
 * Nutzt dnd5e's natives Konzentrations-System (Activity duration.concentration
 * = true), hookt sich nur in "Aktivität benutzt" / "Save gewürfelt" /
 * "Konzentrations-Effekt gelöscht" ein.
 *
 * Token-Flags:
 *   flags["cao-the-call-of-the-ancestors"].hm = { casterUuid, itemUuid }
 *   flags["cao-the-call-of-the-ancestors"].ff = { casterUuid, itemUuid }
 */

const CAO_NS = "cao-the-call-of-the-ancestors";

const CAO_SPELL_PENDING = new Map(); // userId -> { action, targetTokenUuid, itemUuid, actorUuid }
const CAO_FF_PENDING = new Map(); // targetActorUuid -> { targetTokenUuid, itemUuid, actorUuid }

function caoGetFirstTargetToken() {
  const token = Array.from(game.user.targets ?? [])[0] ?? null;
  console.log("CAO(spell): erstes Target ->", token?.name ?? "kein Target");
  return token;
}

async function caoSetTokenMarkFlag(targetTokenUuid, key, value) {
  const targetToken = await fromUuid(targetTokenUuid).catch(() => null);
  if (!targetToken) {
    console.log("CAO(spell): Ziel-Token nicht gefunden für Flag-Set:", targetTokenUuid);
    return;
  }
  console.log("CAO(spell): setze Flag", key, "auf", targetToken.name, value);
  await targetToken.setFlag(CAO_NS, key, value);
}

async function caoClearTokenMarkFlag(targetTokenUuid, key) {
  const targetToken = await fromUuid(targetTokenUuid).catch(() => null);
  if (!targetToken) return;
  console.log("CAO(spell): entferne Flag", key, "von", targetToken.name);
  await targetToken.unsetFlag(CAO_NS, key);
}

/* -------------------------------------------- */
/* Vor der Aktivierung: Ziel-Validierung         */
/* -------------------------------------------- */

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  console.log("CAO(spell): RAW activity.flags =", JSON.stringify(activity?.flags));

  const action = activity?.flags?.[CAO_NS]?.action;
  if (!["hm-cast", "hm-move", "ff-cast"].includes(action)) return;

  console.log("CAO(spell): === preUseActivity ===", action);

  const item = activity.item;
  const actor = item?.actor;
  if (!actor) return;

  const targetToken = caoGetFirstTargetToken();
  if (!targetToken) {
    console.log("CAO(spell): kein Target -> Fehler + return false");
    ui.notifications.error("Zielen sollte man vor dem Wirken nicht vergessen!");
    return false;
  }

  if (action === "hm-move") {
    const stillConcentrating = actor.effects?.some(
      e => e.statuses?.has?.("concentrating") && e.origin?.includes(item.uuid)
    );
    if (!stillConcentrating) {
      console.log("CAO(spell): keine aktive Konzentration auf Hunter's Mark -> Fehler + return false");
      ui.notifications.error("Du konzentrierst dich gerade nicht auf Hunter's Mark.");
      return false;
    }
  }

  CAO_SPELL_PENDING.set(game.user.id, {
    action,
    targetTokenUuid: targetToken.document.uuid,
    itemUuid: item.uuid,
    actorUuid: actor.uuid
  });
  if (action === "ff-cast") {
    CAO_FF_PENDING.set(targetToken.actor?.uuid, {
      targetTokenUuid: targetToken.document.uuid,
      itemUuid: item.uuid,
      actorUuid: actor.uuid
    });
    console.log("CAO(spell): FF-Pending gespeichert nach Ziel-Actor-UUID", targetToken.actor?.uuid);
  }
  console.log("CAO(spell): pending gespeichert", CAO_SPELL_PENDING.get(game.user.id));
});

/* -------------------------------------------- */
/* Nach der Aktivierung: HM-Cast / HM-Move       */
/* -------------------------------------------- */

Hooks.on("dnd5e.postUseActivity", async (activity) => {
  const action = activity?.flags?.[CAO_NS]?.action;
  if (!["hm-cast", "hm-move"].includes(action)) return;

  console.log("CAO(spell): === postUseActivity ===", action);

  const pending = CAO_SPELL_PENDING.get(game.user.id);
  if (!pending) {
    console.log("CAO(spell): kein pending state, breche ab");
    return;
  }

  if (action === "hm-cast") {
    await caoSetTokenMarkFlag(pending.targetTokenUuid, "hm", {
      casterUuid: pending.actorUuid,
      itemUuid: pending.itemUuid
    });
  }

  if (action === "hm-move") {
    const actor = await fromUuid(pending.actorUuid).catch(() => null);
    if (actor) {
      const markedTokens = canvas.tokens?.placeables.filter(
        t => t.document.getFlag(CAO_NS, "hm")?.casterUuid === pending.actorUuid
      ) ?? [];
      for (const t of markedTokens) {
        await caoClearTokenMarkFlag(t.document.uuid, "hm");
      }
    }
    await caoSetTokenMarkFlag(pending.targetTokenUuid, "hm", {
      casterUuid: pending.actorUuid,
      itemUuid: pending.itemUuid
    });
  }

  CAO_SPELL_PENDING.delete(game.user.id);
});

/* -------------------------------------------- */
/* Faerie Fire: Flag nur bei fehlgeschlagenem    */
/* Save setzen                                   */
/* -------------------------------------------- */

Hooks.on("dnd5e.rollSavingThrow", async (rolls, data) => {
  const actorUuid = data?.subject?.uuid;
  console.log("CAO(spell): === dnd5e.rollSavingThrow ===", "actorUuid =", actorUuid, "rolls =", rolls);

  const pending = CAO_FF_PENDING.get(actorUuid);
  if (!pending) {
    console.log("CAO(spell): kein FF-Pending fuer diesen Actor, breche ab");
    return;
  }

  const failed = rolls?.some(r => r.isSuccess === false);
  console.log("CAO(spell): Save fehlgeschlagen? ->", failed);

  if (failed) {
    await caoSetTokenMarkFlag(pending.targetTokenUuid, "ff", {
      casterUuid: pending.actorUuid,
      itemUuid: pending.itemUuid
    });
  }

  CAO_FF_PENDING.delete(actorUuid);
});

/* -------------------------------------------- */
/* Konzentration endet -> Flag entfernen         */
/* -------------------------------------------- */

Hooks.on("deleteActiveEffect", async (effect) => {
  if (!effect.statuses?.has?.("concentrating")) return;

  console.log("CAO(spell): Konzentrations-Effekt gelöscht", effect.name, "origin:", effect.origin);

  const actor = effect.parent;
  if (!actor) return;

  for (const key of ["hm", "ff"]) {
    const markedTokens = canvas.tokens?.placeables.filter(
      t => t.document.getFlag(CAO_NS, key)?.casterUuid === actor.uuid
    ) ?? [];
    for (const t of markedTokens) {
      console.log("CAO(spell): entferne", key, "-Flag wegen Konzentrationsende von", t.name);
      await caoClearTokenMarkFlag(t.document.uuid, key);
    }
  }
});
Hooks.on("dnd5e.rollSavingThrow", (rolls, data) => {
  console.log("CAO(spell): === dnd5e.rollSavingThrow ===", "rolls =", rolls, "data =", data);
});
