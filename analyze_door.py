#!/usr/bin/env python3
import json

def analyze_door_layers():
    # Charger la carte
    with open('hall.tmj', 'r') as f:
        map_data = json.load(f)
    
    width = map_data['width']  # 48
    height = map_data['height']  # 48
    
    def find_layer_recursive(layers, name):
        for layer in layers:
            if layer.get('name') == name:
                return layer
            elif layer.get('type') == 'group' and 'layers' in layer:
                result = find_layer_recursive(layer['layers'], name)
                if result:
                    return result
        return None
    
    # Trouver toutes les couches de porte
    door_layers = ['door1_closed', 'door1_opened', 'door1_control']
    
    for layer_name in door_layers:
        layer = find_layer_recursive(map_data['layers'], layer_name)
        if layer:
            print(f"\n🚪 Couche '{layer_name}':")
            data = layer['data']
            non_zero_tiles = {}
            
            for i, tile in enumerate(data):
                if tile != 0:
                    x = i % width
                    y = i // width
                    if tile not in non_zero_tiles:
                        non_zero_tiles[tile] = []
                    non_zero_tiles[tile].append((x, y))
            
            if non_zero_tiles:
                for tile_id, positions in non_zero_tiles.items():
                    print(f"  Tuile {tile_id}: {len(positions)} positions")
                    for pos in positions[:5]:  # Afficher max 5 positions
                        print(f"    Position ({pos[0]}, {pos[1]})")
                    if len(positions) > 5:
                        print(f"    ... et {len(positions) - 5} autres")
            else:
                print("  (Aucune tuile)")
        else:
            print(f"❌ Couche '{layer_name}' non trouvée!")

if __name__ == "__main__":
    analyze_door_layers()