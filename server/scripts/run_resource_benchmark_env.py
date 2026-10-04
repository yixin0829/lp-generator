"""User-invoked dotenv handoff; never source executable shell text or log keys."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from dotenv.parser import parse_stream


def read_key(path):
    values = []
    with path.open(encoding="utf-8-sig") as stream:
        for binding in parse_stream(stream):
            if binding.key == "OPENAI_API_KEY":
                if binding.error:
                    raise ValueError("Invalid credential binding")
                values.append(binding.value)
    if len(values) != 1 or not values[0] or not values[0].strip():
        raise ValueError("Exactly one nonempty credential binding is required")
    # Parsing only: no variable interpolation, shell expansion, or execution.
    return values[0].strip()


def run(args):
    try:
        key = read_key(args.env_file)
    except Exception:
        print(
            "Credential file unavailable or missing one valid OPENAI_API_KEY. No API call started."
        )
        return 1
    server = Path(__file__).resolve().parents[1]
    child_env = os.environ.copy()
    child_env["OPENAI_API_KEY"] = key
    child_env["PYTHONPATH"] = str(server)
    key = None
    args.result_root.mkdir(parents=True, exist_ok=True)
    ledger = args.result_root / "resource-benchmark-budget.json"
    smoke_path = args.result_root / "resource-benchmark-smoke.json"
    live_path = args.result_root / "resource-benchmark-live.json"
    command = [
        sys.executable,
        str(server / "scripts" / "benchmark_resources.py"),
        "--live",
        "--cap",
        "5",
        "--ledger",
        str(ledger),
    ]
    try:
        print("Starting user-invoked smoke with the existing shared $5 total budget.", flush=True)
        smoke = subprocess.run(
            command + ["--smoke", "--output", str(smoke_path)],
            cwd=server,
            env=child_env,
            check=False,
        )
        if smoke.returncode:
            print("Smoke stopped; preserve the shared budget ledger.")
            return 1
        report = json.loads(smoke_path.read_text(encoding="utf-8"))
        has_resources = any(
            r.get("temperature") == "cold"
            and r.get("status") == "measured"
            and r.get("resource_count", 0) > 0
            for r in report["observations"]
        )
        has_search = any(
            c.get("status") == "success" and c.get("search_calls", 0) > 0 for c in report["calls"]
        )
        if not has_resources or not has_search:
            for call in report["calls"]:
                if call.get("status") != "success":
                    print(
                        json.dumps(
                            {
                                k: call[k]
                                for k in (
                                    "error_type",
                                    "http_status",
                                    "api_code",
                                    "api_param",
                                    "api_message",
                                )
                                if k in call
                            }
                        )
                    )
            print(
                "No sourced smoke result; full run stopped. Review the sanitized smoke report. Preserve the ledger."
            )
            return 1
        full = subprocess.run(
            command + ["--output", str(live_path)], cwd=server, env=child_env, check=False
        )
        print(f"Nonsecret reports: {smoke_path} and {live_path}")
        return full.returncode
    except Exception:
        print(
            "Benchmark launcher stopped. Preserve the ledger and review nonsecret reports; no automatic retry."
        )
        return 1
    finally:
        child_env.pop("OPENAI_API_KEY", None)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--result-root", type=Path, required=True)
    raise SystemExit(run(parser.parse_args()))
