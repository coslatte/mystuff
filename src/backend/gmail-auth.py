"""Authorize the portfolio owner locally with Gmail's send-only OAuth scope."""

import argparse
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import tempfile
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen
import webbrowser

SCOPE = "https://www.googleapis.com/auth/gmail.send"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"


def challenge(verifier):
    return base64.urlsafe_b64encode(hashlib.sha256(verifier.encode("ascii")).digest()).decode("ascii").rstrip("=")


def save_settings(path, settings):
    text = path.read_text(encoding="utf-8") if path.exists() else ""
    lines = text.splitlines()
    for key, value in settings.items():
        if "\n" in value or "\r" in value:
            raise ValueError("Invalid credential format.")
        lines = [line for line in lines if line.split("=", 1)[0].strip() != key]
        lines.append(f"{key}={value}")
    fd, temporary = tempfile.mkstemp(prefix=".gmail-auth-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as output:
            output.write("\n".join(lines) + "\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def authorize(client):
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(64)
    result = {}

    class Callback(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            query = parse_qs(urlsplit(self.path).query)
            returned_state = query.get("state", [""])[0]
            valid = returned_state.isascii() and hmac.compare_digest(returned_state, state)
            self.send_response(200 if valid else 400)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(b"Return to the terminal. You may close this tab." if valid else b"Invalid authorization state.")
            if valid:
                result.update(query)

    with HTTPServer(("127.0.0.1", 0), Callback) as server:
        server.timeout = 1
        redirect = f"http://127.0.0.1:{server.server_port}/"
        url = AUTH_URL + "?" + urlencode({
            "client_id": client["client_id"], "redirect_uri": redirect,
            "response_type": "code", "scope": SCOPE, "access_type": "offline",
            "prompt": "consent", "state": state, "code_challenge": challenge(verifier),
            "code_challenge_method": "S256",
        })
        print("Authorize only the Gmail account that will send portfolio notifications.")
        print("If the browser does not open, open this URL locally:\n" + url)
        webbrowser.open(url)
        deadline = time.monotonic() + 180
        while not result and time.monotonic() < deadline:
            server.handle_request()
    if "code" not in result:
        raise ValueError("Authorization was denied or timed out. No credentials were saved.")
    body = urlencode({
        "client_id": client["client_id"], "client_secret": client["client_secret"],
        "code": result["code"][0], "code_verifier": verifier,
        "redirect_uri": redirect, "grant_type": "authorization_code",
    }).encode("ascii")
    request = Request(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    with urlopen(request, timeout=30) as response:
        tokens = json.load(response)
    refresh = tokens.get("refresh_token")
    if not isinstance(refresh, str) or not refresh:
        raise ValueError("Google did not return a refresh token. Repeat consent with offline access.")
    if SCOPE not in tokens.get("scope", "").split():
        raise ValueError("Google did not grant the Gmail send permission.")
    return refresh


def check():
    assert challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk") == "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    with tempfile.TemporaryDirectory() as directory:
        output = Path(directory) / ".env.local"
        output.write_text("DB_HOST=localhost\nGMAIL_CLIENT_ID=old\n", encoding="utf-8")
        save_settings(output, {"GMAIL_CLIENT_ID": "new", "GMAIL_REFRESH_TOKEN": "test"})
        save_settings(output, {"GMAIL_CLIENT_ID": "new"})
        assert output.read_text().count("GMAIL_CLIENT_ID=") == 1
        assert "DB_HOST=localhost" in output.read_text()
    print("PASS: OAuth PKCE and atomic credential updates preserve existing settings.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--client", type=Path, help="Downloaded Google Desktop OAuth client JSON, kept outside git.")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[2] / ".env.local")
    parser.add_argument("--email", default="gabrielpazruiz02@gmail.com", help="Authorized sender and recipient.")
    parser.add_argument("--check", action="store_true", help="Run local checks without opening a browser or calling Google.")
    args = parser.parse_args()
    if args.check:
        check()
        return
    if args.client is None:
        parser.error("--client is required for authorization.")
    if args.output.name not in {".env", ".env.local"}:
        parser.error("Use an ignored .env or .env.local output file.")
    if any(char in args.email for char in "\r\n<> ") or args.email.count("@") != 1:
        parser.error("--email must be the Gmail account you authorize.")
    try:
        client = json.loads(args.client.read_text(encoding="utf-8")).get("installed")
        if not isinstance(client, dict) or not all(isinstance(client.get(key), str) and client[key]
                                                    for key in ("client_id", "client_secret")):
            raise ValueError("Download an OAuth client of type Desktop app.")
        refresh = authorize(client)
        existing = {}
        if args.output.exists():
            existing = dict(line.split("=", 1) for line in args.output.read_text(encoding="utf-8").splitlines()
                            if "=" in line and not line.lstrip().startswith("#"))
        settings = {
            "GMAIL_CLIENT_ID": client["client_id"], "GMAIL_CLIENT_SECRET": client["client_secret"],
            "GMAIL_REFRESH_TOKEN": refresh, "CONTACT_FROM_EMAIL": args.email, "CONTACT_TO_EMAIL": args.email,
            "CONTACT_RUNNER_TOKEN": existing.get("CONTACT_RUNNER_TOKEN") or secrets.token_urlsafe(48),
            "CONTACT_IP_HASH_KEY": existing.get("CONTACT_IP_HASH_KEY") or secrets.token_urlsafe(48),
            "CONTACT_EMAIL_ENABLED": "true", "CONTACT_IMMEDIATE_ENABLED": "true",
        }
        save_settings(args.output, settings)
        print(f"Saved Gmail configuration to {args.output}. Credential values were not printed.")
        print("Configure database access and a recovery scheduler before deploying. Testing-mode Google grants expire after seven days.")
    except (ValueError, KeyError, OSError, HTTPError, URLError) as error:
        if isinstance(error, HTTPError):
            raise SystemExit(f"Google authorization failed with HTTP {error.code}. No token was printed.")
        if isinstance(error, (OSError, URLError)):
            raise SystemExit("Could not read credentials, reach Google, or save configuration. No token was printed.")
        raise SystemExit(str(error))


if __name__ == "__main__":
    main()
