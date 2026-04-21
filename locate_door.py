#!/usr/bin/env python3
import json

def find_door_tiles():
    # Charger la carte
    with open('hall.tmj', 'r') as f:
        map_data = json.load(f)
    
    width = map_data['width']  # 48
    height = map_data['height']  # 48
    
    # Trouver la couche door1_closed
    door1_closed_layer = None
    door1_control_layer = None
    
    def find_layer_recursive(layers, name):
        for layer in layers:
            if layer.get('name') == name:
                return layer
            elif layer.get('type') == 'group' and 'layers' in layer:
                result = find_layer_recursive(layer['layers'], name)
                if result:
                    return result
        return None
    
    door1_closed_layer = find_layer_recursive(map_data['layers'], 'door1_closed')
    door1_control_layer = find_layer_recursive(map_data['layers'], 'door1_control')
    
    if not door1_closed_layer:
        print("❌ Couche door1_closed non trouvée!")
        return
    
    if not door1_control_layer:
        print("❌ Couche door1_control non trouvée!")
        return
    
    print("✅ Couches trouvées!")
    
    # Tiles de porte à chercher
    door_tiles = [3125, 3124, 3131, 3130, 3137, 3136]
    
    # Analyser les données de la couche door1_closed
    data = door1_closed_layer['data']
    door_positions = []
    
    for i, tile in enumerate(data):
        if tile in door_tiles:
            x = i % width
            y = i // width
            door_positions.append((x, y, tile))
            print(f"🚪 Tuile {tile} trouvée à la position ({x}, {y})")
    
    if not door_positions:
        print("❌ Aucune tuile de porte trouvée!")
        return
    
    # Calculer la zone de déclenchement
    min_x = min(pos[0] for pos in door_positions)
    max_x = max(pos[0] for pos in door_positions)
    min_y = min(pos[1] for pos in door_positions)
    max_y = max(pos[1] for pos in door_positions)
    
    print(f"\n📍 Zone de porte détectée:")
    print(f"   X: {min_x} à {max_x}")
    print(f"   Y: {min_y} à {max_y}")
    
    # Créer une zone de déclenchement élargie (2 tiles autour)
    trigger_min_x = max(0, min_x - 2)
    trigger_max_x = min(width - 1, max_x + 2)
    trigger_min_y = max(0, min_y - 2)
    trigger_max_y = min(height - 1, max_y + 3)  # Plus large vers le bas
    
    print(f"\n🎯 Zone de déclenchement recommandée:")
    print(f"   X: {trigger_min_x} à {trigger_max_x}")
    print(f"   Y: {trigger_min_y} à {trigger_max_y}")
    
    # Mettre à jour les données de door1_control
    control_data = door1_control_layer['data'].copy()
    
    # Effacer toutes les zones existantes
    for i in range(len(control_data)):
        control_data[i] = 0
    
    # Ajouter les nouvelles zones de déclenchement
    zones_added = 0
    for y in range(trigger_min_y, trigger_max_y + 1):
        for x in range(trigger_min_x, trigger_max_x + 1):
            index = y * width + x
            if index < len(control_data):
                control_data[index] = 1
                zones_added += 1
    
    print(f"\n✨ {zones_added} zones de déclenchement ajoutées!")
    
    # Sauvegarder les modifications
    door1_control_layer['data'] = control_data
    
    with open('hall.tmj', 'w') as f:
        json.dump(map_data, f, separators=(',', ':'))
    
    print("💾 Carte sauvegardée avec les nouvelles zones de déclenchement!")

if __name__ == "__main__":
    find_door_tiles()