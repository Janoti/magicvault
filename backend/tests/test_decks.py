from tests.conftest import register_user


async def test_deck_crud(auth):
    c = auth["client"]
    r = await c.post("/api/decks", json={"name": "My Deck", "format": "commander"})
    assert r.status_code == 201
    deck_id = r.json()["id"]

    # appears in the list
    lst = (await c.get("/api/decks")).json()
    assert any(d["id"] == deck_id for d in lst)

    # update name + format
    await c.patch(f"/api/decks/{deck_id}", json={"name": "Renamed", "format": "modern"})
    got = (await c.get(f"/api/decks/{deck_id}")).json()
    assert got["name"] == "Renamed" and got["format"] == "modern"

    # delete
    assert (await c.delete(f"/api/decks/{deck_id}")).status_code == 204
    assert (await c.get(f"/api/decks/{deck_id}")).status_code == 404


async def test_deck_primer_and_public_view(client):
    a = await register_user(client)
    deck_id = (await client.post("/api/decks", json={"name": "Pub"}, headers=a["headers"])).json()["id"]

    # private deck → public endpoint 404
    assert (await client.get(f"/api/decks/public/{deck_id}")).status_code == 404

    # make public + set primer
    await client.patch(f"/api/decks/{deck_id}", json={"is_public": True, "primer": "Win with combo X"}, headers=a["headers"])

    # now anyone (no auth) can view it, and the primer is included
    pub = await client.get(f"/api/decks/public/{deck_id}")
    assert pub.status_code == 200
    assert pub.json()["primer"] == "Win with combo X"


async def test_deck_add_card(auth):
    c = auth["client"]
    deck_id = (await c.post("/api/decks", json={"name": "Cards"})).json()["id"]
    r = await c.post(f"/api/decks/{deck_id}/cards", json={"scryfall_id": "fake-id-123", "quantity": 2})
    assert r.status_code == 201
    deck = (await c.get(f"/api/decks/{deck_id}")).json()
    assert any(card["quantity"] == 2 for card in deck["cards"])


async def test_deck_suggestions_without_commander(auth):
    c = auth["client"]
    deck_id = (await c.post("/api/decks", json={"name": "No commander"})).json()["id"]
    r = await c.get(f"/api/decks/{deck_id}/suggestions")
    assert r.status_code == 200
    assert r.json()["commander"] is None
