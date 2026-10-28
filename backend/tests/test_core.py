def test_health_lists_installed_apps(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert isinstance(body["apps"], list)


def test_personas_are_clearly_simulated(client):
    res = client.get("/api/personas")
    assert res.status_code == 200
    body = res.json()
    assert body["simulated"] is True
    roles = {p["role"] for p in body["personas"]}
    assert roles == {"reviewer", "viewer"}
