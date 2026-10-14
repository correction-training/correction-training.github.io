"""Assemble the published website from pinned public sources."""

import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--personal-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("dist"))
    args = parser.parse_args()
    base = Path(__file__).resolve().parent
    expected = json.loads((base / "expected-files.json").read_text())
    if args.output.exists() and any(args.output.iterdir()):
        raise RuntimeError(f"Output must be empty: {args.output}")

    for relative, digest in expected.items():
        override = base / "overrides" / relative
        if override.is_file():
            source = override
        elif relative.startswith("donghoon/"):
            source = args.personal_dir / relative.removeprefix("donghoon/")
        else:
            source = args.project_dir / relative
        data = source.read_bytes()
        if hashlib.sha256(data).hexdigest() != digest:
            raise RuntimeError(f"Source differs from the reviewed version: {relative}")
        target = args.output / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)

    print(f"Verified and assembled {len(expected)} website files.")


if __name__ == "__main__":
    main()
