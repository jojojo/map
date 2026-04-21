#!/usr/bin/env python3
import json

def check_door_visual_config():
    # Charger la carte
    with open('hall.tmj', 'r') as f:
        map_data = json.load(f)
    
    def find_layer_recursive(layers, name, path=""):
        for layer in layers:
            current_path = f"{path}/{layer.get('name', 'unnamed')}" if path else layer.get('name', 'unnamed')
            if layer.get('name') == name:
                return layer, current_path
            elif layer.get('type') == 'group' and 'layers' in layer:
                result = find_layer_recursive(layer['layers'], name, current_path)
                if result:
                    return result
        return None, None
    
    # Vérifier les couches de porte
    layers_to_check = ['door1_closed', 'door1_opened', 'door1_control']
    
    print("🔍 Configuration des couches de porte:\n")
    
    for layer_name in layers_to_check:
        layer, path = find_layer_recursive(map_data['layers'], layer_name)
        if layer:
            print(f"✅ {layer_name}:")
            print(f"   Chemin: {path}")
            print(f"   ID: {layer.get('id')}")
            print(f"   Type: {layer.get('type')}")
            print(f"   Visible: {layer.get('visible', True)}")
            
            # Propriétés spéciales
            if 'properties' in layer:
                print(f"   Propriétés:")
                for prop in layer['properties']:
                    print(f"     {prop['name']}: {prop['value']}")
            
            # Compter les tuiles non-null
            if 'data' in layer:
                non_zero = sum(1 for tile in layer['data'] if tile != 0)
                print(f"   Tuiles non-nulles: {non_zero}")
            
            print()
        else:
            print(f"❌ {layer_name}: NON TROUVÉE\n")
    
    # Vérifier la structure des groupes
    print("📁 Structure des groupes:")
    
    def print_structure(layers, indent=0):
        for layer in layers:
            name = layer.get('name', 'unnamed')
            layer_type = layer.get('type', 'unknown')
            visible = layer.get('visible', True)
            vis_str = "👁" if visible else "🙈"
            
            print("  " * indent + f"{vis_str} {name} ({layer_type})")
            
            if layer_type == 'group' and 'layers' in layer:
                print_structure(layer['layers'], indent + 1)
    
    print_structure(map_data['layers'])

if __name__ == "__main__":
    check_door_visual_config()