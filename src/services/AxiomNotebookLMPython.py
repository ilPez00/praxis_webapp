#!/usr/bin/env python3
"""
AxiomNotebookLMPython.py
Queries NotebookLM notebooks via the unofficial API using stored Google cookies.
Uses httpx for async HTTP calls.

Auth: Google cookies (SNlM0e = csrf, FdrFJe = session) stored in Supabase profiles.
"""

import asyncio
import base64
import json
import sys
import urllib.parse
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# RPC method IDs (discovered from browser traffic)
METHOD_LIST = "wXbhsf"
METHOD_GET = "rLM1Ne"
BATCHEXECUTE = "https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute"
QUERY_URL = "https://notebooklm.google.com/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed"
DEFAULT_BL = "boq_labs-tailwind-frontend_20260301.03_p0"


def build_batchexecute_body(method_id: str, params: list, csrf_token: str | None = None) -> str:
    """Build batchexecute request body. Request is triple-nested: [[[method_id, params_json, null, "generic"]]]"""
    inner = [method_id, json.dumps(params, separators=(",", ":")), None, "generic"]
    f_req = json.dumps([[inner]], separators=(",", ":"))
    body = f"f.req={urllib.parse.quote(f_req, safe='')}"
    if csrf_token:
        body += f"&at={urllib.parse.quote(csrf_token, safe='')}"
    body += "&"
    return body


def build_batchexecute_url(method_id: str, session_id: str | None = None) -> str:
    """Build batchexecute URL with query params."""
    params = {
        "rpcids": method_id,
        "source-path": "/",
        "hl": "en",
        "rt": "c",
    }
    if session_id:
        params["f.sid"] = session_id
    return f"{BATCHEXECUTE}?{urllib.parse.urlencode(params)}"


def build_chat_body(params: list, csrf_token: str | None = None) -> str:
    """Build chat request body. Inner params are double-encoded."""
    params_json = json.dumps(params, separators=(",", ":"))
    f_req_inner = json.dumps([None, params_json], separators=(",", ":"))
    f_req_encoded = urllib.parse.quote(f_req_inner, safe="")
    body = f"f.req={f_req_encoded}"
    if csrf_token:
        body += f"&at={urllib.parse.quote(csrf_token, safe='')}"
    body += "&"
    return body


def build_chat_url(session_id: str | None = None, reqid: int = 0) -> str:
    """Build chat URL with query params."""
    params = {
        "bl": DEFAULT_BL,
        "hl": "en",
        "_reqid": str(reqid),
        "rt": "c",
    }
    if session_id:
        params["f.sid"] = session_id
    return f"{QUERY_URL}?{urllib.parse.urlencode(params)}"


def make_request(url: str, body: str | None = None) -> tuple[int, str]:
    """Make HTTP request, return (status_code, response_body)."""
    headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://notebooklm.google.com/",
        "Origin": "https://notebooklm.google.com",
    }
    method = "POST" if body else "GET"
    req = Request(url, data=body.encode() if body else None, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            return (resp.status, resp.read().decode("utf-8", errors="replace"))
    except HTTPError as e:
        return (e.code, e.read().decode("utf-8", errors="replace")[:500])


def strip_xssi(raw: str) -> str:
    """Remove anti-XSSI prefix from response."""
    if raw.startswith(")]}'"):
        return raw[4:]
    return raw


def parse_batchexecute(raw: str) -> any:
    """Parse batchexecute response. Returns the inner result array."""
    stripped = strip_xssi(raw)
    try:
        parsed = json.loads(stripped)
        if isinstance(parsed, list) and len(parsed) >= 2:
            inner = parsed[1]
            if isinstance(inner, str):
                inner = json.loads(inner)
            return inner
        return parsed
    except json.JSONDecodeError:
        return stripped


# ---------------------------------------------------------------------------
# API Functions
# ---------------------------------------------------------------------------

def list_notebooks(cookies: dict) -> list[dict]:
    """List all notebooks."""
    csrf = cookies.get("SNlM0e", "")
    session = cookies.get("FdrFJe", "")

    body = build_batchexecute_body(METHOD_LIST, [None, 1, None, [2]], csrf)
    url = build_batchexecute_url(METHOD_LIST, session or None)
    status, raw = make_request(url, body)

    if status == 401 or status == 403:
        return [{"error": "AUTH_FAILED", "status": status}]
    if status != 200:
        return [{"error": f"HTTP {status}", "body": raw[:200]}]

    result = parse_batchexecute(raw)
    if isinstance(result, list) and len(result) > 0:
        raw_nbs = result[0] if isinstance(result[0], list) else result
        notebooks = []
        for nb in raw_nbs:
            if isinstance(nb, list) and len(nb) >= 2:
                # Notebook format: [id, [title, description, ...], ...]
                nb_data = nb[1] if isinstance(nb[1], list) else nb
                title = nb_data[0] if nb_data else "Untitled"
                notebooks.append({"notebookId": nb[0] if nb else "", "title": title})
        return notebooks
    return []


def get_notebook(cookies: dict, notebook_id: str) -> dict | None:
    """Get notebook details."""
    csrf = cookies.get("SNlM0e", "")
    session = cookies.get("FdrFJe", "")

    body = build_batchexecute_body(METHOD_GET, [notebook_id, None, [2], None, 0], csrf)
    url = build_batchexecute_url(METHOD_GET, session or None)
    _, raw = make_request(url, body)

    result = parse_batchexecute(raw)
    if isinstance(result, list) and len(result) > 0:
        return result[0]
    return result


def ask_notebook(cookies: dict, notebook_id: str, question: str, reqid: int = 100000) -> dict:
    """Ask a question to a notebook."""
    import uuid
    csrf = cookies.get("SNlM0e", "")
    session = cookies.get("FdrFJe", "")

    conversation_id = str(uuid.uuid4())

    params = [
        [],  # sources_array - empty = all sources
        question,
        None,  # conversation_history
        [2, None, [1], [1]],
        conversation_id,
        None,
        None,
        notebook_id,
        1,
    ]

    body = build_chat_body(params, csrf)
    url = build_chat_url(session or None, reqid)
    status, raw = make_request(url, body)

    if status == 401 or status == 403:
        return {"notebookId": notebook_id, "error": "AUTH_FAILED", "status": status}
    if status != 200:
        return {"notebookId": notebook_id, "error": f"HTTP {status}", "body": raw[:200]}

    return parse_chat_response(raw, notebook_id)


def parse_chat_response(raw: str, notebook_id: str) -> dict:
    """Parse streaming chat response into structured answer."""
    stripped = strip_xssi(raw)
    try:
        parsed = json.loads(stripped)
        # The response is a streaming format - extract text chunks
        answer = extract_chat_text(parsed)
        return {"notebookId": notebook_id, "answer": answer, "raw": stripped[:1000]}
    except json.JSONDecodeError:
        return {"notebookId": notebook_id, "answer": stripped[:2000]}


def extract_chat_text(parsed: any) -> str:
    """Extract answer text from parsed chat response."""
    if isinstance(parsed, str):
        return parsed[:5000]
    if isinstance(parsed, list):
        parts = []
        for item in parsed:
            text = extract_chat_text(item)
            if text:
                parts.append(text)
        return "\n".join(parts)
    if isinstance(parsed, dict):
        # Try to find text in common fields
        for key in ["text", "content", "answer", "result"]:
            if key in parsed:
                val = extract_chat_text(parsed[key])
                if val:
                    return val
        # Also check nested
        for val in parsed.values():
            text = extract_chat_text(val)
            if text:
                parts.append(text)
        return "\n".join(parts) if parts else ""
    return str(parsed) if parsed else ""


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No command provided"}))
        return

    cmd = sys.argv[1]

    if cmd == "list":
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Usage: list <cookies_json>"}))
            return
        cookies = json.loads(sys.argv[2])
        notebooks = list_notebooks(cookies)
        print(json.dumps(notebooks))

    elif cmd == "ask":
        if len(sys.argv) < 5:
            print(json.dumps({"error": "Usage: ask <cookies_json> <notebook_id> <question>"}))
            return
        cookies = json.loads(sys.argv[2])
        notebook_id = sys.argv[3]
        question = sys.argv[4]
        result = ask_notebook(cookies, notebook_id, question)
        print(json.dumps(result))

    elif cmd == "query-all":
        if len(sys.argv) < 5:
            print(json.dumps({"error": "Usage: query-all <cookies_json> <notebook_ids_json> <question>"}))
            return
        cookies = json.loads(sys.argv[2])
        notebook_ids = json.loads(sys.argv[3])
        question = sys.argv[4]
        results = []
        for i, nb_id in enumerate(notebook_ids[:5]):
            result = ask_notebook(cookies, nb_id, question, 100000 + i)
            results.append(result)
        print(json.dumps(results))

    else:
        print(json.dumps({"error": f"Unknown command: {cmd}"}))


if __name__ == "__main__":
    main()
