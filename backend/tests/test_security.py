from tests.conftest import register_user


async def test_security_headers(client):
    r = await client.get("/api/health")
    assert r.headers.get("x-content-type-options") == "nosniff"
    assert r.headers.get("x-frame-options") == "DENY"
    assert "referrer-policy" in r.headers


async def test_protected_requires_auth(client):
    for path in ["/api/collection", "/api/decks", "/api/binders", "/api/wishlist", "/api/friends"]:
        r = await client.get(path)
        assert r.status_code == 401, path


async def test_malformed_token_is_401_not_500(client):
    r = await client.get("/api/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


async def test_admin_endpoints_forbidden_for_normal_user(auth):
    r = await auth["client"].get("/api/admin/users")
    assert r.status_code == 403


async def test_deck_idor(client):
    a = await register_user(client)
    b = await register_user(client)
    # A creates a deck
    r = await client.post("/api/decks", json={"name": "A deck"}, headers=a["headers"])
    deck_id = r.json()["id"]
    # B cannot read / edit / delete it
    assert (await client.get(f"/api/decks/{deck_id}", headers=b["headers"])).status_code == 404
    assert (await client.patch(f"/api/decks/{deck_id}", json={"name": "hax"}, headers=b["headers"])).status_code == 404
    assert (await client.delete(f"/api/decks/{deck_id}", headers=b["headers"])).status_code == 404
    # A can
    assert (await client.get(f"/api/decks/{deck_id}", headers=a["headers"])).status_code == 200


async def test_binder_idor(client):
    a = await register_user(client)
    b = await register_user(client)
    r = await client.post("/api/binders", json={"name": "A binder"}, headers=a["headers"])
    binder_id = r.json()["id"]
    assert (await client.get(f"/api/binders/{binder_id}", headers=b["headers"])).status_code == 404
    assert (await client.get(f"/api/binders/{binder_id}", headers=a["headers"])).status_code == 200


async def test_update_me_sanitizes_dangerous_links(auth):
    c = auth["client"]
    r = await c.patch("/api/auth/me", json={"links": [
        {"label": "evil", "url": "javascript:alert(1)"},
        {"label": "site", "url": "example.com"},
    ]})
    assert r.status_code == 200
    links = r.json()["links"]
    # javascript: is dropped; bare domain gets https://
    assert all(not l["url"].lower().startswith("javascript:") for l in links)
    assert any(l["url"] == "https://example.com" for l in links)


async def test_invalid_username_rejected_on_update(auth):
    r = await auth["client"].patch("/api/auth/me", json={"username": "bad name!"})
    assert r.status_code == 400
