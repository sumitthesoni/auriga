from __future__ import annotations

from app.models.user import User


def test_login_returns_access_token_and_protected_routes_require_it(client, db_session):
    from app.core.security import hash_password

    user = User(
        name="Auth User",
        email="auth.user@example.com",
        password_hash=hash_password("Project"),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    login_response = client.post(
        "/api/auth/login", json={"email": user.email, "password": "Project"}
    )
    assert login_response.status_code == 200, login_response.text
    payload = login_response.json()
    assert payload["token_type"] == "bearer"
    assert "access_token" in payload
    assert payload["access_token"]

    protected_response = client.get(
        "/api/users",
        headers={"Authorization": f"Bearer {payload['access_token']}"},
    )
    assert protected_response.status_code == 200, protected_response.text

    unauthenticated = client.get("/api/users")
    assert unauthenticated.status_code == 401, unauthenticated.text
