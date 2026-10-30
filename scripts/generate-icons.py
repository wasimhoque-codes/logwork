"""Render the code-defined Gym Hawk mark to dependency-free PNG app icons."""
import struct
import zlib
from pathlib import Path

polygons = [ [(3,9),(23,9),(14,19),(24,19),(16,29),(26,29),(13,43),(18,29),(9,29),(14,19),(7,19)], [(24,9),(44,9),(36,19),(25,19),(20,25),(24,13)] ]
def inside(x,y,points):
    found = False
    j = len(points)-1
    for i in range(len(points)):
        xi,yi = points[i]; xj,yj = points[j]
        if (yi>y)!=(yj>y) and x<(xj-xi)*(y-yi)/(yj-yi)+xi: found = not found
        j=i
    return found

def chunk(name,data):
    return struct.pack('!I',len(data))+name+data+struct.pack('!I',zlib.crc32(name+data)&0xffffffff)
for size in (192,512):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            px,py=(x+.5)*48/size,(y+.5)*48/size
            color=(39,40,63) if any(inside(px,py,p) for p in polygons) else (102,199,244)
            raw.extend(color)
    png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',size,size,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(bytes(raw),9))+chunk(b'IEND',b'')
    Path(f'public/icon-{size}.png').write_bytes(png)
