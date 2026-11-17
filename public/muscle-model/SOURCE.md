# Gym Hawk anatomy mesh

The mesh is adapted from MakeHuman Community’s CC0 1.0 core assets.

- [Pinned source revision a8bc2d54ff0ac92e78ff71431b1023eda42bf482](https://github.com/makehumancommunity/makehuman/tree/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/makehuman/data)
- [Core asset license](https://github.com/makehumancommunity/makehuman/blob/a8bc2d54ff0ac92e78ff71431b1023eda42bf482/LICENSE.ASSETS.md)

Place `3dobjs/base.obj` and the following files from `targets/macrodetails` in one directory.

- `caucasian-male-young.target`
- `universal-male-young-maxmuscle-minweight.target`
- `universal-male-young-maxmuscle-averageweight.target`

Run `python3 scripts/build-muscle-model.py SOURCE_DIR public/muscle-model/anatomy.glb` from the project root. The generator applies the morphs, relaxes the arm pose, and adds the muscle-group highlight masks.
