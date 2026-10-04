import pytest

from scripts.run_resource_benchmark_env import read_key


def test_dotenv_parser_handles_quotes_without_interpolation_or_execution(tmp_path):
    fixture = tmp_path / "fixture.env"
    fixture.write_text(
        'OTHER=ignored\nexport OPENAI_API_KEY="synthetic-${OTHER}-$(do-not-run)" # comment\n'
    )
    assert read_key(fixture) == "synthetic-${OTHER}-$(do-not-run)"


@pytest.mark.parametrize(
    "text", ["OTHER=ignored", "OPENAI_API_KEY=", "OPENAI_API_KEY=a\nOPENAI_API_KEY=b"]
)
def test_dotenv_missing_empty_or_duplicate_key_fails_closed(tmp_path, text):
    fixture = tmp_path / "fixture.env"
    fixture.write_text(text)
    with pytest.raises(ValueError):
        read_key(fixture)
