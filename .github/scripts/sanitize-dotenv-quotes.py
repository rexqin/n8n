#!/usr/bin/env python3
"""Remove both single and double quotes in dotenv files (UTF-8), in place."""

import sys
from pathlib import Path


def main():
	paths = [Path(p) for p in sys.argv[1:]]
	if not paths:
		print("usage: sanitize-dotenv-quotes.py <file>...", file=sys.stderr)
		sys.exit(2)
	for p in paths:
		text = p.read_text(encoding="utf-8")
		p.write_text(text.replace("'", "").replace('"', ""), encoding="utf-8")


if __name__ == "__main__":
	main()
