"""Build the By muscle asset from the pinned CC0 files listed beside the GLB."""

import json
import math
import struct
import sys
from pathlib import Path


def smoothstep(start, end, value):
    t = max(0, min(1, (value - start) / (end - start)))
    return t * t * (3 - 2 * t)


def patch(x, y, center_x, center_y, width, height):
    distance = math.hypot((x - center_x) / width, (y - center_y) / height)
    return 1 - smoothstep(.68, 1, distance)


def muscle_masks(x, y, z):
    x = abs(x)
    front = smoothstep(.24, .72, z)
    back = 1 - smoothstep(-.16, .32, z)
    arm = x - .83 * (5.8 - y)
    thigh = x + .09 * y
    calf = x + .13 * y
    return {
        "back": patch(x, y, .88, 4.45, 1.08, 1.94) * back,
        "biceps": patch(arm, y, 1.88, 4.76, .53, 1.07) * smoothstep(.22, .57, z),
        "calves": patch(calf, y, .98, -5.14, .53, 1.51) * (1 - smoothstep(-.09, .40, z)),
        "chest": patch(x, y - .22 * (x - .94), .94, 5.17, 1.08, .83) * front,
        "core": patch(x, y, 0, 3.02, 1.10, 1.43) * front,
        "glutes": patch(x, y, .88, 1.00, .90, 1.18) * back,
        "hamstrings": patch(thigh, y, 1.03, -1.54, .65, 1.72) * back,
        "quads": patch(thigh, y, 1.12, -1.33, .81, 1.96) * front,
        "shoulders": patch(x, y, 2.12, 5.60, .69, .78),
        "triceps": patch(arm, y, 1.84, 4.74, .61, 1.13) * (1 - smoothstep(.06, .62, z)),
    }


def sculpt(x, y, z):
    lateral = abs(x)
    front = smoothstep(.42, .85, z)
    pecs = .11 * patch(lateral, y - .20 * lateral, .95, 4.93, 1.13, .85)
    abdomen = sum(
        .10 * patch(lateral, y, .37, row, .47, .43)
        for row in (2.76, 3.43, 4.10)
    )
    return x, y, z + front * (pecs + abdomen)


def pose(x, y, z):
    # Lower the arms about the shoulders, blending through the deltoids.
    direction = 1 if x >= 0 else -1
    lateral = abs(x)
    shoulder_x, shoulder_y = 1.85, 5.78
    # The hands reach down to hip height in the source pose.
    arm = max(smoothstep(1.1, 2, y), smoothstep(2.56, 3.12, lateral))
    weight = smoothstep(1.76, 2.72, lateral) * arm
    angle = -.36 * weight
    dx, dy = lateral - shoulder_x, y - shoulder_y
    posed_x = shoulder_x + dx * math.cos(angle) - dy * math.sin(angle)
    posed_y = shoulder_y + dx * math.sin(angle) + dy * math.cos(angle)
    z -= .95 * smoothstep(3.35, 5.25, lateral) * arm
    posed_x -= .49 * (1 - smoothstep(-7.5, 0, y))
    return direction * posed_x, posed_y, z


def build(source, output):
    vertices, faces = [], []
    group = None
    for line in (source / "base.obj").read_text().splitlines():
        fields = line.split()
        if not fields:
            continue
        if fields[0] == "v":
            vertices.append([float(value) for value in fields[1:]])
        elif fields[0] == "g":
            group = fields[1]
        elif fields[0] == "f" and group in {"body", "helper-l-eye", "helper-r-eye"}:
            faces.append([int(index.split("/")[0]) - 1 for index in fields[1:]])

    for target, weight in (
        ("caucasian-male-young", 1),
        ("universal-male-young-maxmuscle-minweight", .70),
        ("universal-male-young-maxmuscle-averageweight", .30),
    ):
        for line in (source / f"{target}.target").read_text().splitlines():
            if not line.strip() or line.startswith("#"):
                continue
            index, *offset = line.split()
            for axis, value in enumerate(offset):
                vertices[int(index)][axis] += weight * float(value)

    used = sorted({index for face in faces for index in face})
    remap = {index: local for local, index in enumerate(used)}
    masks = [muscle_masks(*vertices[index]) for index in used]
    points = [pose(*sculpt(*vertices[index])) for index in used]
    bottom = min(y for _, y, _ in points)
    height = max(y for _, y, _ in points) - bottom
    points = [(x / height, (y - bottom) / height, (z - .4) / height) for x, y, z in points]
    triangles = [
        remap[index]
        for face in faces
        for corner in range(1, len(face) - 1)
        for index in (face[0], face[corner], face[corner + 1])
    ]

    binary = bytearray()
    accessors, views = [], []

    def accessor(data, component, kind, count, **metadata):
        views.append({"buffer": 0, "byteOffset": len(binary), "byteLength": len(data)})
        binary.extend(data)
        binary.extend(bytes(-len(binary) % 4))
        accessors.append({
            "bufferView": len(views) - 1, "componentType": component,
            "type": kind, "count": count, **metadata,
        })
        return len(accessors) - 1

    attributes = {
        "POSITION": accessor(
            b"".join(struct.pack("<3f", *point) for point in points),
            5126, "VEC3", len(points),
            min=[min(axis) for axis in zip(*points)],
            max=[max(axis) for axis in zip(*points)],
        ),
    }
    for label in masks[0]:
        # Align each vertex's scalar weight to four bytes for glTF vertex data.
        data = b"".join(bytes((round(weights[label] * 255), 0, 0, 0)) for weights in masks)
        attributes[f"_{label.upper()}"] = accessor(data, 5121, "SCALAR", len(points), normalized=True)
        views[-1]["byteStride"] = 4
    indices = accessor(struct.pack(f"<{len(triangles)}H", *triangles), 5123, "SCALAR", len(triangles))
    gltf = {
        "asset": {"version": "2.0", "copyright": "MakeHuman Community (CC0 1.0)"},
        "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": [{"attributes": attributes, "indices": indices}]}],
        "buffers": [{"byteLength": len(binary)}], "bufferViews": views, "accessors": accessors,
    }
    metadata = json.dumps(gltf, separators=(",", ":")).encode()
    metadata += b" " * (-len(metadata) % 4)
    output.write_bytes(
        struct.pack("<4sII", b"glTF", 2, 28 + len(metadata) + len(binary))
        + struct.pack("<I4s", len(metadata), b"JSON") + metadata
        + struct.pack("<I4s", len(binary), b"BIN\x00") + binary
    )


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]))
