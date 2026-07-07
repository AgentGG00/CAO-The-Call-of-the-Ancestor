# CAO – The Call of the Ancestors

[![Review](https://img.shields.io/github/actions/workflow/status/AgentGG00/CAO-The-Call-of-the-Ancestor/review.yml?branch=main&label=review)](https://github.com/AgentGG00/CAO-The-Call-of-the-Ancestor/actions/workflows/review.yml)
[![Version](https://img.shields.io/github/v/release/AgentGG00/CAO-The-Call-of-the-Ancestor)](https://github.com/AgentGG00/CAO-The-Call-of-the-Ancestor/releases)
[![License](https://img.shields.io/github/license/AgentGG00/CAO-The-Call-of-the-Ancestor)](https://github.com/AgentGG00/CAO-The-Call-of-the-Ancestor/blob/main/LICENSE)
[![Foundry Version](https://img.shields.io/badge/Foundry-v13%2B-informational)](https://foundryvtt.com)
[![System](https://img.shields.io/badge/D%26D%205e-5.2.5%2B-red)](https://foundryvtt.com/packages/dnd5e)

Foundry-VTT-Modul für die homebrew Ancestor-Armbrust "The Call of the Ancestors" – Magazin-Ladesystem, elementare Munition, automatisierte Schadens-/Statuslogik sowie die Zauber Hunter's Mark und Faerie Fire mit eigenen visuellen Effekten.

## Features

**Waffe**
- Eigenständige Attack- und Damage-Activity (dnd5e Activity-System)
- Elementarer Schadensbonus je nach geladenem Munitionstyp (Kälte, Blitz, Gift)
- Statuseffekte bei Treffer: Restrained (Kälte), Poisoned (Gift)

**Magazine**
- Basis-Magazine (STD/CLD/LGT/PSN) in 5er/10er/20er-Größe
- "Laden"-Aktion rüstet ein Use-Magazin aus, tauscht automatisch ein bereits geladenes ab
- Automatischer Verbrauch beim Schuss, leere Hülle wird bei 0 Ladungen automatisch nachgelegt
- Herstellung, Elementarisierung und Größen-Upgrades über das mitgelieferte Rezeptbuch "Ahnen-Schmiede" (siehe Abhängigkeiten)

**Hunter's Mark & Faerie Fire**
- Volle Umsetzung nach D&D 5e (2024) Regeltext, inkl. nativer dnd5e-Konzentration
- Hunter's Mark: Ziel markieren, Bonus-Action zum Verschieben des Marks
- Faerie Fire: DEX-Save gegen Spell-Save-DC, bei Fehlschlag Vorteil auf Angriffe gegen das Ziel
- Eigene animierte Token-Ring-Effekte (rotierender Ranken-Ring / pulsierender Funken-Ring)

## Abhängigkeiten

Dieses Modul benötigt zwingend das Premium-Modul **[Mastercrafted](https://www.patreon.com/theripper93)** von TheRipper93 für das Crafting-System (Rezeptbücher, Herstellung). Ohne aktives Mastercrafted-Modul lädt CAO nicht.

## Installation

Über das Foundry-Modul-Manifest:

https://raw.githubusercontent.com/AgentGG00/CAO-The-Call-of-the-Ancestor/main/module.json


## Kompatibilität

- Foundry VTT: v13+ (verifiziert bis v14)
- System: dnd5e 5.2.5+

## License
MIT – siehe [LICENSE](./LICENSE)

## Kommende Features

- **Dreadful Strike (Ranger)** – vollständige Implementierung geplant