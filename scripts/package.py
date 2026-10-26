"""Package exactly the production build and verify the archive byte for byte."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
build = root / 'dist'
files = sorted(p for p in build.rglob('*') if p.is_file())
if not files or not (build / 'sw.js').is_file() or not (build / 'index.html').is_file():
    raise SystemExit('Run npm run build before packaging.')
archive = root / 'gym-hawk-pages.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED) as output:
    for file in files:
        output.write(file, file.relative_to(build).as_posix())
with ZipFile(archive) as packaged:
    assert set(packaged.namelist()) == {p.relative_to(build).as_posix() for p in files}
    assert all(packaged.read(p.relative_to(build).as_posix()) == p.read_bytes() for p in files)
print(str(len(files)) + ' production files packaged and verified: ' + str(archive))
