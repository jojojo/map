#!/usr/bin/env python3
import json

def fix_door_triggers():
    # Charger la carte
    with open('hall.tmj', 'r') as f:
        map_data = json.load(f)
    
    width = map_data['width']  # 48
    
    def find_layer_recursive(layers, name):
        for layer in layers:
            if layer.get('name') == name:
                return layer
            elif layer.get('type') == 'group' and 'layers' in layer:
                result = find_layer_recursive(layer['layers'], name)
                if result:
                    return result
        return None
    
    door1_control_layer = find_layer_recursive(map_data['layers'], 'door1_control')
    
    if not door1_control_layer:
        print("❌ Couche door1_control non trouvée!")
        return
    
    control_data = door1_control_layer['data'].copy()
    
    # La porte est aux positions (14,10), (15,10), (14,11), (15,11)
    # Ajoutons des zones de déclenchement autour, SURTOUT EN DESSOUS
    
    # Zone élargie : de la colonne 12 à 17, de la ligne 8 à 15
    trigger_zones = []
    
    # Autour de la porte (plus large)
    for y in range(8, 16):  # lignes 8 à 15
        for x in range(12, 18):  # colonnes 12 à 17
            if x < width and y < 48:  # Vérifier les limites
                trigger_zones.append((x, y))
    
    zones_added = 0
    for x, y in trigger_zones:
        index = y * width + x
        if index < len(control_data):
            if control_data[index] == 0:  # Seulement si pas déjà une zone
                control_data[index] = 1
                zones_added += 1
    
    print(f"✨ {zones_added} nouvelles zones de déclenchement ajoutées!")
    print(f"📍 Zone couverte: colonnes 12-17, lignes 8-15")
    print(f"🚪 Porte située: colonnes 14-15, lignes 10-11")
    
    # Sauvegarder les modifications
    door1_control_layer['data'] = control_data
    
    with open('hall.tmj', 'w') as f:
        json.dump(map_data, f, separators=(',', ':'))
    
    print("💾 Zones de déclenchement étendues sauvegardées!")
    
    # Afficher un récapitulatif
    total_zones = sum(1 for tile in control_data if tile != 0)
    print(f"🎯 Total zones de déclenchement: {total_zones}")

if __name__ == "__main__":
    fix_door_triggers()