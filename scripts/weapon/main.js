/**
 * CAO | The Call of the Ancestors
 * scripts/weapon/main.js
 *
 * Waffen-Logik über das dnd5e Activity-System (dnd5e 5.x / Foundry v14).
 *
 * Flags (alle verschachtelt unter "cao"):
 *   Waffen-Item:      flags.cao.weapon = true
 *   Use-Magazin-Item: flags.cao["use-magazin"] = true
 *                      flags.cao.damageType = "piercing" | "cold" | "lightning" | "poison"
 *                      flags.cao.emptyItemId = "<Compendium-UUID der leeren Hülle>"
 *   Target (von HM/FF-Activities gesetzt, hier nur gelesen):
 *                      flags.cao.hm = { casterUuid, itemUuid }
 *                      flags.cao.ff = { casterUuid, itemUuid }
 */

const CAO_NS = "cao";

/* -------------------------------------------- */
/* Helpers                                       */
/* -------------------------------------------- */

function caoGetFirstTargetToken() {
  return Array.from(game.user.targets ?? [])[0] ?? null;
}

function caoIsCaoWeapon(item) {
  return !!item?.getFlag?.(CAO_NS, "weapon");
}

function caoIsUseMag(item) {
  return !!item?.getFlag?.(CAO_NS, "use-magazin");
}

function caoGetEquippedUseMags(actor) {
  return actor.items.filter(i => caoIsUseMag(i) && !!i.system?.equipped);
}

function caoGetMagDamageType(mag) {
  return mag?.getFlag?.(CAO_NS, "damageType") ?? "piercing";
}

async function caoChat(content, actor = null) {
  return ChatMessage.create({
    content,
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker()
  });
}

async function caoApplyCondition(targetActor, statusId, originUuid) {
  if (!targetActor) return;

  const already = targetActor.effects?.some(e => e.statuses?.has?.(statusId));
  if (already) return;

  await targetActor.createEmbeddedDocuments("ActiveEffect", [{
    name: statusId === "poisoned" ? "Poisoned" : "Restrained",
    img: "icons/svg/aura.svg",
    origin: originUuid,
    statuses: [statusId],
    disabled: false,
    changes: [],
    duration: { rounds: 1 }
  }]);
}

/* -------------------------------------------- */
/* Magazinverbrauch + Leer-Austausch             */
/* -------------------------------------------- */

async function caoConsumeShot(mag, actor) {
  const uses = mag.system?.uses ?? {};
  const max = Number(uses.max ?? 0);
  const spent = Number(uses.spent ?? 0);

  if (!max) return;

  const newSpent = spent + 1;

  if (newSpent >= max) {
    const emptyItemId = mag.getFlag(CAO_NS, "emptyItemId");
    await mag.delete();

    if (emptyItemId) {
      const existingEmpty = actor.items.find(i => i.getFlag(CAO_NS, "emptyOf") === emptyItemId);
      if (existingEmpty) {
        await existingEmpty.update({ "system.quantity": (existingEmpty.system.quantity ?? 1) + 1 });
      } else {
        const emptySource = await fromUuid(emptyItemId).catch(() => null);
        if (emptySource) {
          const data = emptySource.toObject();
          delete data._id;
          foundry.utils.setProperty(data, `flags.${CAO_NS}.emptyOf`, emptyItemId);
          await actor.createEmbeddedDocuments("Item", [data]);
        }
      }
    }

    await caoChat("Du hast den letzten Schuss verbraucht du solltest nachladen!", actor);
  } else {
    await mag.update({ "system.uses.spent": newSpent });
  }
}

/* -------------------------------------------- */
/* Vorbereitung / Checks vor der Aktivierung     */
/* -------------------------------------------- */

const CAO_WEAPON_PENDING = new Map(); // userId -> { magId, magType, targetTokenUuid }

Hooks.on("dnd5e.preUseActivity", (activity, usageConfig, dialogConfig, messageConfig) => {
  const item = activity?.item;
  if (!caoIsCaoWeapon(item)) return;

  const actor = item.actor;
  if (!actor) return;

  const equipped = caoGetEquippedUseMags(actor);

  if (equipped.length > 1) {
    ui.notifications.error("Die Waffe kann doch nur ein Magazin laden? Bei weiteren Fragen wenden sie sich an den Master.");
    return false;
  }

  if (equipped.length < 1) {
    ui.notifications.error("Waffe sollte schon geladen werden?");
    return false;
  }

  const targetToken = caoGetFirstTargetToken();

  if (!targetToken) {
    ui.notifications.error("Zielen sollte man vor dem schießen!!!");
    return false;
  }

  if (targetToken.document?.disposition === 1) {
    caoChat("Seit wann zielen wir auf die eigenen Leute?", actor);
    return false;
  }

  const mag = equipped[0];
  CAO_WEAPON_PENDING.set(game.user.id, {
    magId: mag.id,
    magType: caoGetMagDamageType(mag),
    targetTokenUuid: targetToken.document.uuid
  });

  return true;
});

/* -------------------------------------------- */
/* Angriffswurf: Vorteil bei aktivem Faerie Fire */
/* -------------------------------------------- */

Hooks.on("dnd5e.preRollAttack", (config) => {
  const activity = config?.subject;
  const item = activity?.item;
  if (!caoIsCaoWeapon(item)) return;

  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  if (!pending) return;

  const targetToken = fromUuidSync?.(pending.targetTokenUuid) ?? null;
  const ff = targetToken?.getFlag?.(CAO_NS, "ff");
  if (ff && config.rolls?.[0]) {
    config.rolls[0].options = { ...(config.rolls[0].options ?? {}), advantage: true };
  }
});

/* -------------------------------------------- */
/* Nach dem Angriffswurf: Magazin verbrauchen    */
/* -------------------------------------------- */

Hooks.on("dnd5e.rollAttack", async (rolls, data) => {
  const activity = data?.subject;
  const item = activity?.item;
  if (!caoIsCaoWeapon(item)) return;

  const actor = item.actor;
  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  if (!pending) return;

  const mag = actor.items.get(pending.magId);
  if (mag) await caoConsumeShot(mag, actor);
});

/* -------------------------------------------- */
/* Schaden: Elementar-Bonus + Hunter's Mark      */
/* -------------------------------------------- */

Hooks.on("dnd5e.preRollDamage", (config) => {
  const activity = config?.subject;
  const item = activity?.item;
  if (!caoIsCaoWeapon(item)) return;

  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  if (!pending) return;

  const targetToken = fromUuidSync?.(pending.targetTokenUuid) ?? null;
  const hm = targetToken?.getFlag?.(CAO_NS, "hm");

  for (const roll of config.rolls ?? []) {
    if (pending.magType !== "piercing") {
      roll.parts = [...(roll.parts ?? []), `1d8[${pending.magType}]`];
    }
    if (hm) {
      roll.parts = [...(roll.parts ?? []), "1d6[piercing]"];
    }
  }
});

/* -------------------------------------------- */
/* Nach dem Schaden: Elementar-Effekte anwenden  */
/* -------------------------------------------- */

Hooks.on("dnd5e.rollDamage", async (rolls, data) => {
  const activity = data?.subject;
  const item = activity?.item;
  if (!caoIsCaoWeapon(item)) return;

  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  if (!pending) return;

  const targetToken = await fromUuid(pending.targetTokenUuid).catch(() => null);
  const targetActor = targetToken?.actor;

  if (pending.magType === "cold") await caoApplyCondition(targetActor, "restrained", item.uuid);
  if (pending.magType === "poison") await caoApplyCondition(targetActor, "poisoned", item.uuid);

  CAO_WEAPON_PENDING.delete(game.user.id);
});