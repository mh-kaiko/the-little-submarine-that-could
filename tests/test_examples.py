from kaiko.registry import ENEMIES_DIR, discover


def test_shipped_examples_load():
    reg = discover(ENEMIES_DIR, log=lambda *a: None)
    folders = sorted({c.folder for c in reg.classes})
    assert {"fax_machine", "legacy_ehr", "paperwork_blob"} <= set(folders)
    assert reg.failures == []
    assert any(c.boss for c in reg.classes)
    assert any(c.tier == 0 for c in reg.classes)
