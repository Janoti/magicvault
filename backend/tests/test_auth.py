import uuid


def _creds():
    s = uuid.uuid4().hex[:10]
    return {"email": f"u{s}@test.dev", "username": f"u{s}", "password": "secret123"}


async def test_register_and_login(client):
    c = _creds()
    r = await client.post("/api/auth/register", json=c)
    assert r.status_code == 201
    assert r.json()["access_token"]

    form = {"username": c["email"], "password": c["password"]}
    r2 = await client.post("/api/auth/login", data=form)
    assert r2.status_code == 200
    assert r2.json()["user"]["username"] == c["username"]


async def test_register_short_password(client):
    c = _creds(); c["password"] = "123"
    r = await client.post("/api/auth/register", json=c)
    assert r.status_code == 400


async def test_register_bad_username(client):
    c = _creds(); c["username"] = "a b!"  # space + invalid char
    r = await client.post("/api/auth/register", json=c)
    assert r.status_code == 400


async def test_register_duplicate_email(client):
    c = _creds()
    assert (await client.post("/api/auth/register", json=c)).status_code == 201
    c2 = _creds(); c2["email"] = c["email"]  # same email, new username
    r = await client.post("/api/auth/register", json=c2)
    assert r.status_code == 400


async def test_login_wrong_password(client):
    c = _creds()
    await client.post("/api/auth/register", json=c)
    r = await client.post("/api/auth/login", data={"username": c["email"], "password": "wrong"})
    assert r.status_code == 401


async def test_me_requires_auth(client):
    assert (await client.get("/api/auth/me")).status_code == 401


async def test_me_with_token(auth):
    r = await auth["client"].get("/api/auth/me")
    assert r.status_code == 200
    assert r.json()["email"] == auth["email"]


async def test_forgot_password_no_enumeration(client):
    # Always 200 regardless of whether the identifier exists.
    r = await client.post("/api/auth/forgot-password", json={"identifier": "nobody@nowhere.dev"})
    assert r.status_code == 200
