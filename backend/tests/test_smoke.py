async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


async def test_request_id_header(client):
    r = await client.get("/api/health")
    assert r.headers.get("x-request-id")


async def test_billing_price_public(client):
    r = await client.get("/api/billing/price")
    assert r.status_code == 200
    assert "configured" in r.json()


async def test_beta_status_public(client):
    r = await client.get("/api/billing/beta")
    assert r.status_code == 200
    body = r.json()
    assert {"limit", "taken", "left", "active"} <= set(body)
