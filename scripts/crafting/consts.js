export const MASTERCRAFTED_CONST = {
    MODULE_ID: 'cao-the-call-of-the-ancestors',
    INGREDIENT: {
        IMG: "",
    },
    COMPONENT: {
        IMG: "",
    },
    RECIPE: {
        IMG: "icons/sundries/documents/document-bound-white-tan.webp",
    },
    RECIPE_BOOK: {
        IMG: "icons/sundries/books/book-worn-brown-grey.webp",
    },
    CONFIG: {
        PERMISSION_CHOICES: {
            0: "cao-the-call-of-the-ancestors.recipeApp.configbookrecipe.permissions.default",
            1: "cao-the-call-of-the-ancestors.recipeApp.configbookrecipe.permissions.allow",
            2: "cao-the-call-of-the-ancestors.recipeApp.configbookrecipe.permissions.deny",
        }
    }
}

Object.defineProperty(MASTERCRAFTED_CONST, "QUANTITY", {
    get: function(){
        const sId = game.system.id;
        const custom = game.settings.get(MASTERCRAFTED_CONST.MODULE_ID, "customQuantityPath");
        if(custom) return custom;
        switch(sId){
            case "dsa5":
                return "quantity.value";
            default:
                return "quantity";
        }
    },
});