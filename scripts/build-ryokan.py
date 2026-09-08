"""Build Bounro Ryokan as an editable Blender scene and a compact web asset.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python scripts/build-ryokan.py
Coordinates in helpers use the web world's Y-up convention; glTF export preserves it.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.scene.render.engine = 'CYCLES'
bpy.context.scene.cycles.samples = 32
batches = {}
materials = {}

def material(name, color, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = 0.72
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    materials[name] = m

material('Smoked cedar', (.105, .058, .035))
material('Cedar edges', (.28, .15, .07))
material('Warm plaster', (.51, .42, .29))
material('Blue charcoal tile', (.022, .057, .071))
material('Tile relief', (.065, .11, .12))
material('Aged brass', (.52, .31, .09))
material('Shoji light', (1, .51, .18), 0.7)
material('Vermilion', (.48, .075, .028))
material('Stone foundation', (.22, .25, .25))
material('Indigo noren', (.035, .11, .16))

floor = 'Foundation'
def mesh(mat, vertices, faces):
    key = (floor, mat)
    vs, fs = batches.setdefault(key, ([], []))
    offset = len(vs)
    vs.extend((x, -z, y) for x, y, z in vertices)
    fs.extend(tuple(v + offset for v in f) for f in faces)

def box(mat, x, y, z, w, h, d):
    vertices = [(x+sx*w/2, y+sy*h/2, z+sz*d/2) for sx, sy, sz in
                [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    mesh(mat, vertices, [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])

def beam(mat, a, b, radius):
    a, b = Vector(a), Vector(b)
    axis = (b-a).normalized()
    normal = axis.cross(Vector((0, 1, 0)))
    if normal.length < .01:
        normal = axis.cross(Vector((1, 0, 0)))
    normal.normalize()
    tangent = axis.cross(normal).normalized()
    vs = [tuple(p + radius*(math.cos(i*math.tau/6)*normal + math.sin(i*math.tau/6)*tangent))
          for p in [a,b] for i in range(6)]
    mesh(mat, vs, [(i,(i+1)%6,(i+1)%6+6,i+6) for i in range(6)] + [tuple(range(5,-1,-1)),tuple(range(6,12))])

def roof(y, w, d):
    rise = d*.24
    def point(t, side, edge):
        return (edge*w*(.34+.16*t), y + rise*(1-t)**1.6+.3*t**8, side*d*t/2)
    for side in [-1,1]:
        for i in range(10):
            a,b = i/10,(i+1)/10
            vs=[point(a,side,-1),point(a,side,1),point(b,side,1),point(b,side,-1)]
            mesh('Blue charcoal tile', vs, [(0,1,2,3)] if side<0 else [(3,2,1,0)])
        # Relief ribs and transverse tile courses follow the flared surface.
        for j in range(int(w/.24)+1):
            xx=-w/2+j*.24
            for i in range(8):
                t,u=i/8,(i+1)/8
                limit=w*(.34+.16*t)
                if abs(xx)>limit: continue
                h=lambda v: y+rise*(1-v)**1.6+.3*v**8+.025
                beam('Tile relief', (xx,h(t),side*d*t/2), (xx,h(u),side*d*u/2), .025)
        for i in range(1,9):
            t=i/9
            a=list(point(t,side,-1)); b=list(point(t,side,1)); a[1]+=.015; b[1]+=.015
            beam('Tile relief', a,b,.018)
        box('Cedar edges',0,y+.13,side*d/2,w,.16,.22)
    for side in [-1,1]:
        mesh('Warm plaster',[(side*w*.34,y+rise,0),(side*w/2,y+.22,-d/2),(side*w/2,y+.22,d/2)],[(0,1,2)] if side>0 else [(2,1,0)])
        beam('Aged brass',(side*w*.34,y+rise,0),(side*(w*.34+.45),y+rise+.5,0),.07)
    box('Tile relief',0,y+rise+.07,0,w*.74,.2,.27)

box('Stone foundation',0,.22,0,20.5,.44,14.5)
for level,(w,d) in enumerate([(20,14),(18.8,12.8),(16.5,11.5),(13.5,9.5),(10,7.8),(6.5,5.5)]):
    floor=f'{level+1:02d} - Guest floor'
    y=.45+level*3.5
    box('Warm plaster',0,y+1.42,0,w,2.84,d)
    for side in [-1,1]:
        z=side*(d/2+.04)
        box('Smoked cedar',0,y+.4,z,w,.8,.14)
        for yy in [.85,2.45,2.85]: box('Smoked cedar',0,y+yy,z,w+.12,.17,.18)
        for j in range(int(w/1.45)):
            x=(j-(int(w/1.45)-1)/2)*1.45
            box('Shoji light',x,y+1.65,z+side*.04,1.17,1.4,.035)
            for offset in [-.55,-.275,0,.275,.55]: box('Smoked cedar',x+offset,y+1.65,z+side*.075,.035,1.46,.045)
            for yy in [1.2,1.65,2.1]: box('Smoked cedar',x,y+yy,z+side*.08,1.2,.035,.05)
            box('Cedar edges',x-.69,y+1.4,z,.12,2.8,.2)
        for j in range(int(w/.3)):
            x=-w/2+.15+j*.3
            box('Cedar edges',x,y+.36,z+side*.07,.022,.7,.03)
        if level:
            box('Smoked cedar',0,y-.05,z+side*.52,w+1,.18,1.3)
            for yy in [.35,.95]: box('Cedar edges',0,y+yy,z+side*1,w+.9,.08,.11)
            for j in range(int(w/.48)+1):
                box('Smoked cedar',-w/2+j*.48,y+.5,z+side*1,.055,1,.065)
        for sx in [-1,1]: box('Smoked cedar',sx*(w/2-.06),y+1.4,z,.22,2.95,.25)
    for side in [-1,1]:
        x=side*(w/2+.045)
        for j in range(int(d/1.4)):
            z=(j-(int(d/1.4)-1)/2)*1.4
            box('Shoji light',x,y+1.65,z,.025,1.4,1.1)
            for zz in [-.5,-.25,0,.25,.5]: box('Smoked cedar',x+side*.03,y+1.65,z+zz,.04,1.44,.035)
            box('Smoked cedar',x+side*.03,y+1.65,z,.04,.04,1.15)
        for yy in [.5,.9,2.45,2.85]: box('Smoked cedar',x,y+yy,0,.13,.15,d)
    floor=f'{level+1:02d} - Curved tile roof'
    roof(y+2.95,w+2.3,d+2.2)

floor='Entrance - carved portico'
for x in [-2.5,2.5]: box('Smoked cedar',x,1.6,7.7,.22,3.2,.22)
box('Smoked cedar',0,.3,7.5,6,.25,2.2)
for x in [-2,-1,0,1,2]: box('Indigo noren',x,2.7,7.85,.94,.9,.045)
# Small curved entrance roof, translated to the front of the building.
start={key:len(value[0]) for key,value in batches.items()}
roof(3.6,7,4)
for key,(vs,_) in batches.items():
    if key[0]!=floor: continue
    for i in range(start.get(key,0),len(vs)):
        x,y,z=vs[i]; vs[i]=(x,y-7.2,z)
box('Aged brass',0,4.5,8.1,2.6,.95,.18)
box('Smoked cedar',0,4.5,8.21,2.35,.74,.08)
floor='Crown'
beam('Aged brass',(0,23.5,0),(0,25,0),.1)
for y in [24,24.25,24.5]: box('Aged brass',0,y,0,.45,.08,.45)

for (group,mat),(vs,fs) in batches.items():
    collection=bpy.data.collections.get(group)
    if not collection:
        collection=bpy.data.collections.new(group)
        bpy.context.scene.collection.children.link(collection)
    data=bpy.data.meshes.new(f'{group} - {mat}')
    data.from_pydata(vs,[],fs)
    data.materials.append(materials[mat])
    data.update()
    obj=bpy.data.objects.new(data.name,data)
    collection.objects.link(obj)
# Save a source scene with all floors and materials independently editable.
scene=bpy.context.scene
scene.world.color=(.25,.25,.25)
bpy.ops.object.camera_add(location=(35,-48,29))
camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,10))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=38
scene.camera=camera
for location,energy,size in [((10,-15,35),2800,18),((-15,5,20),2000,15)]:
    bpy.ops.object.light_add(type='AREA', location=location)
    light=bpy.context.object
    light.data.energy=energy
    light.data.shape='DISK'
    light.data.size=size
    light.rotation_euler=(Vector((0,0,10))-light.location).to_track_quat('-Z','Y').to_euler()
scene.render.resolution_x=1200
scene.render.resolution_y=1200
scene.render.resolution_percentage=100
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/bounro-ryokan.blend'))
# Web copy: merge by material to keep GPU draw calls bounded.
bpy.ops.object.select_all(action='DESELECT')
for mat in materials.values():
    objects=[o for o in scene.objects if o.type=='MESH' and o.data.materials[0]==mat]
    if not objects: continue
    for o in objects: o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.object.join()
    objects[0].name=mat.name
    bpy.ops.object.select_all(action='DESELECT')
for obj in scene.objects:
    if obj.type=='MESH': obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/bounro-ryokan.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False)
print('Saved editable ryokan and GLB asset.')
