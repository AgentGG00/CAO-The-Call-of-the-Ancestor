import { MastercraftedRecipeSheet } from "./RecipeSheet.js";

export class SheetEmbed extends HTMLElement {

    static get observedAttributes() {
        return ['uuid'];
    }

    static updateEmbeds(page) {
        const embeds = document.querySelectorAll(`mastercrafted-sheet-embed[uuid="${page.uuid}"]`);
        embeds.forEach(embed => {
            embed.sheet?.render();
        });
    }

    static setupHooks() {
        Hooks.on("updateJournalEntryPage", (page) => {
            SheetEmbed.updateEmbeds(page);
        });
        function updatePages(table) {
            foundry.applications.instances.forEach(app => {
                if (!(app instanceof MastercraftedRecipeSheet)) return;
                if (app.table !== table) return;
                app.render();
                SheetEmbed.updateEmbeds(app.document);
            });
        }
        Hooks.on("updateRollTable", table => {
            updatePages(table);
        });
        Hooks.on("updateTableResult", result => {
            updatePages(result.parent);
        });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'uuid' && oldValue !== newValue) this.render();
    }

    async render() {
        const uuid = this.getAttribute('uuid');
        if (!uuid) return;

        const page = await fromUuid(uuid);
        const sheet = page.sheet;

        this.sheet = sheet;
        sheet.startAsView = true;
        
        await sheet._configureRenderOptions({ forceView: true });
        const rendered = await sheet._renderHTML(
            await sheet._prepareContext({}), 
            { parts: Object.keys(sheet.constructor.VIEW_PARTS), forceView: true }
        );

        this.innerHTML = '';
        Object.values(rendered).forEach(part => {
            this.appendChild(part);
        });

        const html = this;
        // this.sheet.render = () => this.render();
        this.sheet._setupEventListeners(html, true, () => this.render());
    }
}