#!/usr/bin/env python3
import json

def analyze_door_group():
    # Charger la carte
    with open('hall.tmj', 'r') as f:
        map_data = json.load(f)
    
    def find_group_by_name(layers, name):
        for layer in layers:
            if layer.get('name') == name and layer.get('type') == 'group':
                return layer
            elif layer.get('type') == 'group' and 'layers' in layer:
                result = find_group_by_name(layer['layers'], name)
                if result:
                    return result
        return None
    
    # Trouver le groupe doors
    doors_group = find_group_by_name(map_data['layers'], 'doors')
    
    if not doors_group:
        print("❌ Groupe 'doors' non trouvé!")
        return
    
    print("🚪 Analyse du groupe 'doors':")
    print(f"   ID: {doors_group.get('id')}")
    print(f"   Visible: {doors_group.get('visible', True)}")
    print(f"   Nombre de couches: {len(doors_group.get('layers', []))}")
    
    # Propriétés du groupe
    if 'properties' in doors_group:
        print("   Propriétés du groupe:")
        for prop in doors_group['properties']:
            print(f"     {prop['name']}: {prop['value']}")
    else:
        print("   ❌ Aucune propriété sur le groupe 'doors'!")
    
    print()
    
    # Analyser chaque couche dans le groupe doors
    for layer in doors_group.get('layers', []):
        name = layer.get('name')
        print(f"📋 Couche '{name}':")
        print(f"   ID: {layer.get('id')}")
        print(f"   Type: {layer.get('type')}")
        print(f"   Visible: {layer.get('visible', True)}")
        
        # Propriétés de la couche
        if 'properties' in layer:
            print("   Propriétés:")
            for prop in layer['properties']:
                print(f"     {prop['name']}: {prop['value']}")
        else:
            print("   Aucune propriété")
        
        # Tuiles
        if 'data' in layer:
            data = layer['data']
            non_zero_tiles = {}
            width = map_data['width']
            
            for i, tile in enumerate(data):
                if tile != 0:
                    x = i % width
                    y = i // width
                    if tile not in non_zero_tiles:
                        non_zero_tiles[tile] = []
                    non_zero_tiles[tile].append((x, y))
            
            if non_zero_tiles:
                print("   Tuiles:")
                for tile_id, positions in non_zero_tiles.items():
                    print(f"     Tuile {tile_id}: {len(positions)} positions")
                    for pos in positions[:3]:
                        print(f"       ({pos[0]}, {pos[1]})")
                    if len(positions) > 3:
                        print(f"       ... et {len(positions) - 3} autres")
            else:
                print("   ❌ Aucune tuile non-nulle!")
        
        print()

if __name__ == "__main__":
    analyze_door_group()