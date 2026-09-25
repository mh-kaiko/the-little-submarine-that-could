"""Command line entry point: `uv run kaiko` or `uv run python -m kaiko`."""

from __future__ import annotations

import argparse

from kaiko.registry import discover


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="kaiko", description="Kaiko solves healthcare.")
    parser.add_argument("--windowed", action="store_true", help="1280x720 window instead of full screen")
    parser.add_argument("--only", metavar="FOLDER", help="spawn only the enemies from enemies/FOLDER, fast")
    parser.add_argument("--seed", type=int, default=None, help="random seed for a reproducible run")
    parser.add_argument("--list", action="store_true", help="list discovered enemies and exit")
    args = parser.parse_args(argv)

    reg = discover()
    folders = sorted({c.folder for c in reg.classes})
    if args.list:
        for c in reg.classes:
            kind = "boss" if c.boss else f"tier {c.tier}"
            print(f"{c.folder:<20} {c.display_name():<24} {kind}")
        return 0
    classes = reg.classes
    if args.only:
        classes = [c for c in classes if c.folder == args.only]
        if not classes:
            print(f"No enemies found in enemies/{args.only}. Available: {', '.join(folders) or 'none'}")
            return 1
    print(f"[kaiko] loaded {len(classes)} enemies from {len(folders)} folders")
    from kaiko.game import Game

    Game(classes, windowed=args.windowed, seed=args.seed, only=bool(args.only)).run()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
