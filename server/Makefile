.PHONY: format lint test check

format:
	uv run ruff format app tests && uv run ruff check --fix app tests

lint:
	uv run ruff format --check app tests && uv run ruff check app tests

test:
	uv run pytest

check: lint test
