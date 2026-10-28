"""Database management commands.

    python -m app.cli init-db            # create tables (idempotent)
    python -m app.cli init-db --seed     # create tables and insert synthetic data
    python -m app.cli init-db --reset --seed   # drop, recreate and reseed (demo reset)
"""

import argparse

from app.core.db import connect, database_path, init_db


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init-db", help="create tables; optionally reset and seed")
    init.add_argument("--seed", action="store_true", help="insert synthetic records")
    init.add_argument("--reset", action="store_true", help="drop existing tables first")
    val = sub.add_parser("validate-spec", help="validate one or more specs/<app>.yaml files against the spec schema")
    val.add_argument("paths", nargs="+", help="YAML files to validate")
    args = parser.parse_args(argv)

    if args.command == "validate-spec":
        from pathlib import Path

        from app.core.spec import validate_spec_file

        failed = 0
        for raw in args.paths:
            result = validate_spec_file(Path(raw))
            if result.valid:
                print(f"OK    {raw}" + (f"  ({len(result.warnings)} warning(s))" if result.warnings else ""))
                for w in result.warnings:
                    print(f"      warning: {w}")
            else:
                failed += 1
                print(f"FAIL  {raw}")
                for e in result.errors:
                    print(f"      {e.path}: {e.message}")
        return 1 if failed else 0
    if args.command == "init-db":
        conn = connect()
        try:
            for line in init_db(conn, seed=args.seed, reset=args.reset):
                print(line)
        finally:
            conn.close()
        print(f"database: {database_path()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
