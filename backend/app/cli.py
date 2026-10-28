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
    args = parser.parse_args(argv)

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
