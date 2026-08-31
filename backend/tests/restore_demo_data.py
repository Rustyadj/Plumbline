"""One-off restoration of demo task data mutated during UI bulk-edit testing."""
import os
import requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/") + "/api"

PRECON = [
    "Rebar Pickup", "GFRP Rebar Loaded", "Bucks Loaded for Mobilization",
    "Bracing Loaded", "Crankups Loaded", "WB / HR Lumber Loaded",
    "Trailer / Job Box Organized & Tool Inventory",
]

jobs = requests.get(f"{BASE}/jobs").json()
job = next(j for j in jobs if "Intermediate SS" in j["name"])
tasks = requests.get(f"{BASE}/jobs/{job['id']}/tasks").json()

fixed = 0
for t in tasks:
    patch = {}
    if t["name"] in PRECON:
        patch["category"] = "Precon"
        patch["course"] = "all"
    elif t.get("category") == "Pour":
        n = t["name"].lower()
        if n.startswith("2nd course"):
            patch["course"] = "2nd"
        elif n.startswith("3rd course"):
            patch["course"] = "3rd"
        elif n.startswith("1st course"):
            patch["course"] = "1st"
    if patch:
        r = requests.patch(f"{BASE}/tasks/{t['id']}", json=patch)
        assert r.status_code == 200, (r.status_code, r.text[:200])
        fixed += 1
print("restored", fixed)
