from __future__ import annotations

from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
INDEX_EXCLUDES = {
    'PROJECT_INDEX.json',
    'CHECKSUMS.sha256',
    'release/VERIFICATION_REPORT.txt',
    'release/TEST_REPORT.txt',
}
CHECKSUM_EXCLUDES = {
    'CHECKSUMS.sha256',
    'release/VERIFICATION_REPORT.txt',
    'release/TEST_REPORT.txt',
}


def digest(path: Path) -> str:
    h = sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def clean_transient() -> None:
    for directory in ROOT.rglob('__pycache__'):
        if directory.is_dir():
            shutil.rmtree(directory)
    for path in ROOT.rglob('*.pyc'):
        path.unlink(missing_ok=True)


def stable_files(excludes: set[str]) -> list[Path]:
    files = []
    for path in ROOT.rglob('*'):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel in excludes:
            continue
        files.append(path)
    return sorted(files, key=lambda item: item.relative_to(ROOT).as_posix())


def main() -> int:
    clean_transient()
    indexed = []
    category_counts: Counter[str] = Counter()
    total_bytes = 0
    for path in stable_files(INDEX_EXCLUDES):
        rel = path.relative_to(ROOT).as_posix()
        size = path.stat().st_size
        indexed.append({'path': rel, 'bytes': size, 'sha256': digest(path)})
        category_counts[rel.split('/', 1)[0]] += 1
        total_bytes += size
    index = {
        'package_id': 'AXM_THEME_PARK_SIM_COMPLETE_HANDOFF_v0_3_0',
        'package_version': '0.3.0',
        'generated_date': '2026-08-12',
        'canonical_design_root_hash': '3ec57d2a387943cd0ade4a4f3e4de0ebd85c0885b84e0e0c9d74c776463ffa0f',
        'excluded_paths': sorted(INDEX_EXCLUDES),
        'file_count': len(indexed),
        'total_indexed_bytes': total_bytes,
        'category_counts': dict(sorted(category_counts.items())),
        'files': indexed,
    }
    (ROOT / 'PROJECT_INDEX.json').write_text(json.dumps(index, indent=2) + '\n', encoding='utf-8')

    lines = []
    for path in stable_files(CHECKSUM_EXCLUDES):
        rel = path.relative_to(ROOT).as_posix()
        lines.append(f'{digest(path)}  {rel}')
    (ROOT / 'CHECKSUMS.sha256').write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps({'indexed_files': len(indexed), 'checksummed_files': len(lines)}, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
