/// <reference types="@workadventure/iframe-api-typings" />

import { bootstrapExtra, getVariables, initDoors } from "@workadventure/scripting-api-extra";

console.log('Script started successfully !  ');

let currentPopup: any = undefined;

// Waiting for the API to be ready
WA.onInit().then(() => {
    console.log('Scripting API ready');
    console.log('Player tags: ',WA.player.tags)

    WA.room.area.onEnter('clock').subscribe(() => {
        const today = new Date();
        const time = today.getHours() + ":" + today.getMinutes();
        currentPopup = WA.ui.openPopup("clockPopup", "It's " + time, []);
    })

    WA.room.area.onLeave('clock').subscribe(closePopup)

    // The line below bootstraps the Scripting API Extra library that adds a number of advanced properties/features to WorkAdventure
    bootstrapExtra().then(() => {
        console.log('Scripting API Extra ready');
        
        // Debug: Vérifions les couches disponibles
        console.log('🚪 DEBUG: Initialisation des portes...');
        
        // Initialiser les portes
        initDoors();
        console.log('🚪 DEBUG: initDoors() appelée');
        
        getVariables().then((variables) => {
            console.log('🚪 DEBUG: Variables trouvées:', variables);

            const door1 = variables.get('door1');
            if (door1) {
                console.log('🚪 DEBUG: Variable door1 trouvée!', door1);
            } else {
                console.log('🚪 DEBUG: Variable door1 NON trouvée!');
            }
        });
    }).catch(e => console.error(e));

}).catch(e => console.error(e));

function closePopup(){
    if (currentPopup !== undefined) {
        currentPopup.close();
        currentPopup = undefined;
    }
}

export {};
