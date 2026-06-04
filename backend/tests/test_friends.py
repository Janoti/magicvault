from tests.conftest import register_user


async def test_cannot_friend_self(auth):
    r = await auth["client"].post("/api/friends/request", json={"identifier": auth["username"]})
    assert r.status_code == 400


async def test_friend_request_flow_and_no_email_leak(client):
    a = await register_user(client)
    b = await register_user(client)

    # A sends a request to B by username
    r = await client.post("/api/friends/request", json={"identifier": b["username"]}, headers=a["headers"])
    assert r.status_code == 201

    # B sees it as incoming (and A's email is NOT exposed)
    reqs = (await client.get("/api/friends/requests", headers=b["headers"])).json()
    assert len(reqs["incoming"]) == 1
    incoming = reqs["incoming"][0]
    assert "email" not in incoming
    assert incoming["username"] == a["username"]

    # B accepts
    fid = incoming["friendship_id"]
    assert (await client.post(f"/api/friends/{fid}/accept", headers=b["headers"])).status_code == 200

    # Both now list each other as friends, still without email
    a_friends = (await client.get("/api/friends", headers=a["headers"])).json()
    b_friends = (await client.get("/api/friends", headers=b["headers"])).json()
    assert any(f["username"] == b["username"] for f in a_friends)
    assert any(f["username"] == a["username"] for f in b_friends)
    assert all("email" not in f for f in a_friends + b_friends)


async def test_friend_request_unknown_user(auth):
    r = await auth["client"].post("/api/friends/request", json={"identifier": "ghost_nobody"})
    assert r.status_code == 404
