console.log("CAO recipe-import.js loaded");

/**
 * CAO | The Call of the Ancestors
 * scripts/weapon/recipe-import.js
 *
 * Importiert das mitgelieferte Rezeptbuch "Ahnen-Schmiede" automatisch,
 * sobald die Welt startet, Mastercrafted aktiv ist und das Buch noch
 * nicht existiert. Nutzt ausschließlich Foundrys eigene JournalEntry-API,
 * kein Mastercrafted-Code wird dafür benötigt.
 */

const CAO_RECIPE_BOOK_NAME = "Ahnen-Schmiede";
const CAO_RECIPE_BOOK_PATH = "modules/cao-the-call-of-the-ancestors/data/ahnen-schmiede.json";

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  console.log("CAO: prüfe ob Rezeptbuch-Import nötig ist");

  const mastercraftedActive = game.modules.get("mastercrafted")?.active;
  if (!mastercraftedActive) {
    console.log("CAO: Mastercrafted nicht aktiv, überspringe Rezeptbuch-Import");
    return;
  }

  const existing = game.journal.getName(CAO_RECIPE_BOOK_NAME);
  if (existing) {
    console.log("CAO: Rezeptbuch existiert bereits, überspringe Import");
    return;
  }

  console.log("CAO: lade Rezeptbuch-Daten von", CAO_RECIPE_BOOK_PATH);
  let data;
  try {
    const response = await fetch(CAO_RECIPE_BOOK_PATH);
    data = await response.json();
  } catch (err) {
    console.error("CAO: Rezeptbuch-Daten konnten nicht geladen werden", err);
    return;
  }

  delete data._id;
  for (const page of data.pages ?? []) {
    delete page._id;
  }

  try {
    const created = await JournalEntry.create(data);
    console.log("CAO: Rezeptbuch importiert:", created?.name);
    ui.notifications.info(`Rezeptbuch "${CAO_RECIPE_BOOK_NAME}" wurde automatisch importiert.`);
  } catch (err) {
    console.error("CAO: Rezeptbuch-Import fehlgeschlagen", err);
  }
});