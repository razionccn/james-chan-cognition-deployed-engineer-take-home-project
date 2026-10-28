"""CLI: python -m feature_flags init-db [--reset] [--seed] [--db PATH] | serve [--port N]"""
import argparse
import os
import sys

from .db import DEFAULT_DB_PATH, connect, init_schema
from .seed import seed


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="feature_flags")
    parser.add_argument("--db", default=os.environ.get("FEATURE_FLAGS_DB", DEFAULT_DB_PATH))
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init-db", help="create the schema (optionally drop and reseed)")
    p_init.add_argument("--reset", action="store_true", help="drop existing tables first")
    p_init.add_argument("--seed", action="store_true", help="insert deterministic seed data")

    p_serve = sub.add_parser("serve", help="run the API with uvicorn")
    p_serve.add_argument("--host", default="127.0.0.1")
    p_serve.add_argument("--port", type=int, default=8000)
    p_serve.add_argument("--reload", action="store_true")

    args = parser.parse_args(argv)

    if args.command == "init-db":
        conn = connect(args.db)
        init_schema(conn, reset=args.reset)
        if args.seed:
            seed(conn)
        n = conn.execute("SELECT count(*) FROM feature_flags").fetchone()[0]
        conn.close()
        print(f"database {args.db}: schema ready, {n} flags")
        return 0

    if args.command == "serve":
        import uvicorn

        os.environ["FEATURE_FLAGS_DB"] = args.db
        uvicorn.run("feature_flags.app:app", host=args.host, port=args.port, reload=args.reload)
        return 0

    return 1


if __name__ == "__main__":
    sys.exit(main())
