console.log("CAO weapon main.js loaded");

/**
 * CAO | The Call of the Ancestors
 * scripts/weapon/main.js
 *
 * Waffen-Logik über das dnd5e Activity-System (dnd5e 5.x / Foundry v14).
 *
 * Flags (alle verschachtelt unter der echten Modul-ID):
 *   Waffen-Item:      flags["cao-the-call-of-the-ancestors"].weapon = true
 *   Use-Magazin-Item: flags["cao-the-call-of-the-ancestors"]["use-magazin"] = true
 *                      flags["cao-the-call-of-the-ancestors"].damageType = "piercing" | "cold" | "lightning" | "poison"
 *                      flags["cao-the-call-of-the-ancestors"].emptyItemId = "<Compendium-UUID der leeren Hülle>"
 *   Target (von HM/FF-Activities gesetzt, hier nur gelesen):
 *                      flags["cao-the-call-of-the-ancestors"].hm = { casterUuid, itemUuid }
 *                      flags["cao-the-call-of-the-ancestors"].ff = { casterUuid, itemUuid }
 */

const CAO_NS = "cao-the-call-of-the-ancestors";

/* -------------------------------------------- */
/* Helpers                                       */
/* -------------------------------------------- */

function caoGetFirstTargetToken() {
  const token = Array.from(game.user.targets ?? [])[0] ?? null;
  console.log("CAO: caoGetFirstTargetToken ->", token?.name ?? "kein Target");
  return token;
}

function caoIsCaoWeapon(item) {
  const result = !!item?.getFlag?.(CAO_NS, "weapon");
  console.log("CAO: caoIsCaoWeapon(", item?.name, ") ->", result);
  return result;
}

function caoIsUseMag(item) {
  return !!item?.getFlag?.(CAO_NS, "use-magazin");
}

function caoGetEquippedUseMags(actor) {
  const mags = actor.items.filter(i => caoIsUseMag(i) && !!i.system?.equipped);
  console.log("CAO: caoGetEquippedUseMags ->", mags.length, mags.map(m => m.name));
  return mags;
}

function caoGetMagDamageType(mag) {
  const type = mag?.getFlag?.(CAO_NS, "damageType") ?? "piercing";
  console.log("CAO: caoGetMagDamageType(", mag?.name, ") ->", type);
  return type;
}

async function caoChat(content, actor = null) {
  console.log("CAO: caoChat ->", content);
  return ChatMessage.create({
    content,
    speaker: actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker()
  });
}

async function caoApplyCondition(targetActor, statusId, originUuid) {
  console.log("CAO: caoApplyCondition ->", statusId, "auf", targetActor?.name);
  if (!targetActor) return;

  const already = targetActor.effects?.some(e => e.statuses?.has?.(statusId));
  if (already) {
    console.log("CAO: Effekt", statusId, "bereits vorhanden, überspringe");
    return;
  }

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
  console.log("CAO: caoConsumeShot(", mag?.name, ")");
  const uses = mag.system?.uses ?? {};
  const max = Number(uses.max ?? 0);
  const spent = Number(uses.spent ?? 0);

  if (!max) {
    console.log("CAO: Magazin hat kein 'max', überspringe Verbrauch");
    return;
  }

  const newSpent = spent + 1;
  console.log("CAO: spent", spent, "-> ", newSpent, "von", max);

  if (newSpent >= max) {
    const emptyItemId = mag.getFlag(CAO_NS, "emptyItemId");
    console.log("CAO: Magazin leer, tausche gegen emptyItemId =", emptyItemId);
    await mag.delete();

    if (emptyItemId) {
      const existingEmpty = actor.items.find(i => i.getFlag(CAO_NS, "emptyOf") === emptyItemId);
      if (existingEmpty) {
        console.log("CAO: leere Hülle existiert bereits, erhöhe Menge");
        await existingEmpty.update({ "system.quantity": (existingEmpty.system.quantity ?? 1) + 1 });
      } else {
        const emptySource = await fromUuid(emptyItemId).catch(() => null);
        console.log("CAO: emptySource geladen ->", emptySource?.name ?? "NICHT GEFUNDEN");
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
  console.log("CAO: === dnd5e.preUseActivity gefeuert ===", "item =", item?.name, "activity.type =", activity?.type);

  if (!caoIsCaoWeapon(item)) {
    console.log("CAO: kein CAO-Waffen-Item, breche Prüfung ab (kein return false)");
    return;
  }

  const actor = item.actor;
  if (!actor) {
    console.log("CAO: kein Actor gefunden, breche ab");
    return;
  }

  const equipped = caoGetEquippedUseMags(actor);

  if (equipped.length > 1) {
    console.log("CAO: mehr als 1 Magazin equipt -> Fehler + return false");
    ui.notifications.error("Die Waffe kann doch nur ein Magazin laden? Bei weiteren Fragen wenden sie sich an den Master.");
    return false;
  }

  if (equipped.length < 1) {
    console.log("CAO: kein Magazin equipt -> Fehler + return false");
    ui.notifications.error("Waffe sollte schon geladen werden?");
    return false;
  }

  const targetToken = caoGetFirstTargetToken();

  if (!targetToken) {
    console.log("CAO: kein Target -> Fehler + return false");
    ui.notifications.error("Zielen sollte man vor dem schießen!!!");
    return false;
  }

  if (targetToken.document?.disposition === 1) {
    console.log("CAO: Target ist friendly (disposition=1) -> Chat + Error + return false");
    ChatMessage.create({
      content: "Seit wann zielen wir auf die eigenen Leute?",
      speaker: { alias: "Spielleiter" }
    });
    ui.notifications.error("Das Ziel ist ein Verbündeter – Angriff abgebrochen.");
    return false;
  }

  const mag = equipped[0];
  const pendingData = {
    magId: mag.id,
    magType: caoGetMagDamageType(mag),
    targetTokenUuid: targetToken.document.uuid
  };
  console.log("CAO: alle Checks bestanden, speichere pending state:", pendingData);
  CAO_WEAPON_PENDING.set(game.user.id, pendingData);

  return true;
});

/* -------------------------------------------- */
/* Angriffswurf: Vorteil bei aktivem Faerie Fire */
/* -------------------------------------------- */

Hooks.on("dnd5e.preRollAttack", (config) => {
  const activity = config?.subject;
  const item = activity?.item;
  console.log("CAO: === dnd5e.preRollAttack gefeuert ===", "item =", item?.name);

  if (!caoIsCaoWeapon(item)) return;

  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  console.log("CAO: pending state in preRollAttack =", pending);
  if (!pending) return;

  const targetToken = fromUuidSync?.(pending.targetTokenUuid) ?? null;
  const ff = targetToken?.getFlag?.(CAO_NS, "ff");
  console.log("CAO: Faerie-Fire-Flag auf Target =", ff);
  if (ff && config.rolls?.[0]) {
    console.log("CAO: setze Vorteil auf Angriffswurf");
    config.rolls[0].options = { ...(config.rolls[0].options ?? {}), advantage: true };
  }
});

/* -------------------------------------------- */
/* Nach dem Angriffswurf: Magazin verbrauchen    */
/* -------------------------------------------- */

Hooks.on("dnd5e.rollAttack", async (rolls, data) => {
  const activity = data?.subject;
  const item = activity?.item;
  console.log("CAO: === dnd5e.rollAttack gefeuert ===", "item =", item?.name);

  if (!caoIsCaoWeapon(item)) return;

  const actor = item.actor;
  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  console.log("CAO: pending state in rollAttack =", pending);
  if (!pending) return;

  const mag = actor.items.get(pending.magId);
  console.log("CAO: verbrauche Magazin", mag?.name);
  if (mag) await caoConsumeShot(mag, actor);
});

/* -------------------------------------------- */
/* Schaden: Elementar-Bonus + Hunter's Mark      */
/* -------------------------------------------- */

Hooks.on("dnd5e.preRollDamage", (config) => {
  const activity = config?.subject;
  const item = activity?.item;
  console.log("CAO: === dnd5e.preRollDamage gefeuert ===", "item =", item?.name);

  if (!caoIsCaoWeapon(item)) return;

  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  console.log("CAO: pending state in preRollDamage =", pending);
  if (!pending) return;

  const targetToken = fromUuidSync?.(pending.targetTokenUuid) ?? null;
  const hm = targetToken?.getFlag?.(CAO_NS, "hm");
  console.log("CAO: Hunter's-Mark-Flag auf Target =", hm);

  for (const roll of config.rolls ?? []) {
    if (pending.magType !== "piercing") {
      console.log("CAO: füge Elementar-Bonus hinzu:", pending.magType);
      roll.parts = [...(roll.parts ?? []), `1d8[${pending.magType}]`];
    }
    if (hm) {
      console.log("CAO: füge Hunter's-Mark-Bonus hinzu: 1d6");
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
  console.log("CAO: === dnd5e.rollDamage gefeuert ===", "item =", item?.name);

  if (!caoIsCaoWeapon(item)) return;

  const pending = CAO_WEAPON_PENDING.get(game.user.id);
  console.log("CAO: pending state in rollDamage =", pending);
  if (!pending) return;

  const targetToken = await fromUuid(pending.targetTokenUuid).catch(() => null);
  const targetActor = targetToken?.actor;
  console.log("CAO: wende Elementar-Effekt an auf", targetActor?.name, "Typ:", pending.magType);

  if (pending.magType === "cold") await caoApplyCondition(targetActor, "restrained", item.uuid);
  if (pending.magType === "poison") await caoApplyCondition(targetActor, "poisoned", item.uuid);

  CAO_WEAPON_PENDING.delete(game.user.id);
});