#!/usr/bin/env python3
import json

def analyze_area_objects():
    # Charger la carte
    with open('hall.tmj', 'r') as f:
        map_data = json.load(f)
    
    print("🔍 Analyse des area objects:\n")
    
    # Trouver tous les objectgroups
    def find_all_objectgroups(layers):
        groups = []
        for layer in layers:
            if layer.get('type') == 'objectgroup':
                groups.append(layer)
            elif layer.get('type') == 'group' and 'layers' in layer:
                groups.extend(find_all_objectgroups(layer['layers']))
        return groups
    
    object_groups = find_all_objectgroups(map_data['layers'])
    
    all_objects = []
    
    for group in object_groups:
        group_name = group.get('name', 'unnamed')
        print(f"📋 Groupe '{group_name}':")
        
        objects = group.get('objects', [])
        for obj in objects:
            name = obj.get('name', 'unnamed')
            x = obj.get('x', 0)
            y = obj.get('y', 0) 
            width = obj.get('width', 0)
            height = obj.get('height', 0)
            obj_type = obj.get('type', '')
            
            # Calculer les bounds
            x_end = x + width
            y_end = y + height
            
            all_objects.append({
                'name': name,
                'x': x, 'y': y,
                'x_end': x_end, 'y_end': y_end,
                'width': width, 'height': height,
                'type': obj_type,
                'group': group_name
            })
            
            print(f"  🎯 '{name}' ({obj_type}):")
            print(f"     Position: ({x}, {y}) -> ({x_end}, {y_end})")
            print(f"     Taille: {width}x{height}")
            
            # Propriétés
            if 'properties' in obj:
                print(f"     Propriétés:")
                for prop in obj['properties']:
                    print(f"       {prop['name']}: {prop['value']}")
            else:
                print(f"     Aucune propriété")
            print()
    
    # Vérifier les chevauchements
    print("🔍 Vérification des chevauchements:\n")
    
    def objects_overlap(obj1, obj2):
        return not (obj1['x_end'] <= obj2['x'] or obj2['x_end'] <= obj1['x'] or
                   obj1['y_end'] <= obj2['y'] or obj2['y_end'] <= obj1['y'])
    
    overlaps_found = False
    for i, obj1 in enumerate(all_objects):
        for j, obj2 in enumerate(all_objects[i+1:], i+1):
            if objects_overlap(obj1, obj2):
                overlaps_found = True
                print(f"⚠️  CHEVAUCHEMENT détecté:")
                print(f"   '{obj1['name']}' ({obj1['group']}) [{obj1['x']},{obj1['y']} -> {obj1['x_end']},{obj1['y_end']}]")
                print(f"   '{obj2['name']}' ({obj2['group']}) [{obj2['x']},{obj2['y']} -> {obj2['x_end']},{obj2['y_end']}]")
                print()
    
    if not overlaps_found:
        print("✅ Aucun chevauchement détecté")
    
    # Grouper par proximité (objets très proches)
    print("\n🔍 Objets très proches (distance < 64px):\n")
    
    for i, obj1 in enumerate(all_objects):
        for j, obj2 in enumerate(all_objects[i+1:], i+1):
            # Calculer la distance entre les centres
            center1_x = obj1['x'] + obj1['width'] / 2
            center1_y = obj1['y'] + obj1['height'] / 2
            center2_x = obj2['x'] + obj2['width'] / 2  
            center2_y = obj2['y'] + obj2['height'] / 2
            
            distance = ((center2_x - center1_x)**2 + (center2_y - center1_y)**2)**0.5
            
            if distance < 64 and not objects_overlap(obj1, obj2):
                print(f"📍 Objets proches (distance: {distance:.1f}px):")
                print(f"   '{obj1['name']}' ({obj1['group']})")
                print(f"   '{obj2['name']}' ({obj2['group']})")
                print()

if __name__ == "__main__":
    analyze_area_objects()