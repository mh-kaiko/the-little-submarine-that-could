from kaiko.__main__ import main


def test_list_prints_enemies(capsys):
    assert main(["--list"]) == 0
    out = capsys.readouterr().out
    assert "paperwork_blob" in out


def test_only_unknown_folder_fails_fast(capsys):
    assert main(["--only", "does_not_exist"]) == 1
    out = capsys.readouterr().out
    assert "paperwork_blob" in out
