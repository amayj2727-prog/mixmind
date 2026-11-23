#!/bin/bash
# MIXMIND Production Launcher
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." >/dev/null 2>&1 && pwd )"
cd "$DIR"

PYTHON_BIN="python3"
if [ -f "$DIR/.venv/bin/python3" ]; then
    PYTHON_BIN="$DIR/.venv/bin/python3"
fi

export PYTHONPATH="$DIR"

echo "======================================================"
echo "  🎧 Starting MIXMIND AI DJ Engine..."
echo "======================================================"

"$PYTHON_BIN" -m backend.src.main "$@"
