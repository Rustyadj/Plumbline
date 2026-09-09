"""Curated ICF task seed for Walls Abilene Intermediate SS demo job.
Cleaned + deduplicated from original spreadsheet.
"""

# (category, name, unit, estimated_hours, estimated_qty, courses)
# courses is list — task is replicated per course (or just ['all'])
TASK_TEMPLATES = [
    # ── PRECON ────────────────────────────────────────────────────────
    ("Precon", "PreBuck Pickup & Unload", "HRS", 4.0, None, ["all"]),
    ("Precon", "Lumber Pickup & Unload", "HRS", 3.0, None, ["all"]),
    ("Precon", "Rebar Pickup", "HRS", 2.5, None, ["all"]),
    ("Precon", "GFRP Rebar Loaded", "HRS", 1.5, None, ["all"]),
    ("Precon", "Bucks Loaded for Mobilization", "HRS", 3.0, None, ["all"]),
    ("Precon", "Bracing Loaded", "HRS", 2.0, None, ["all"]),
    ("Precon", "Crankups Loaded", "HRS", 2.5, None, ["all"]),
    ("Precon", "WB / HR Lumber Loaded", "HRS", 1.5, None, ["all"]),
    ("Precon", "Trailer / Job Box Organized & Tool Inventory", "HRS", 2.0, None, ["all"]),

    # ── STARTUP ───────────────────────────────────────────────────────
    ("Startup", "Trailers Mobilization", "HRS", 6.0, None, ["all"]),
    ("Startup", "ICF Unloaded", "HRS", 4.0, None, ["all"]),
    ("Startup", "Rebar Unloaded", "HRS", 3.0, None, ["all"]),
    ("Startup", "Bucks Unloaded", "HRS", 2.5, None, ["all"]),
    ("Startup", "Bracing Unloaded", "HRS", 2.0, None, ["all"]),
    ("Startup", "Crankups Unloaded", "HRS", 2.0, None, ["all"]),
    ("Startup", "Materials Organized on Site", "HRS", 3.0, None, ["all"]),

    # ── LAYOUT ────────────────────────────────────────────────────────
    ("Layout", "Slab Pour Verify Dowel Placement", "HRS", 2.0, None, ["all"]),
    ("Layout", "Create / Verify Control Lines — Main Area", "HRS", 2.0, None, ["all"]),
    ("Layout", "Stepped Footing / Slab Layout", "LF", None, 400, ["all"]),
    ("Layout", "Wall Layout", "LF", None, 350, ["1st", "2nd", "3rd"]),
    ("Layout", "Opening & Foam Cut Layout", "LF", None, 120, ["1st", "2nd", "3rd"]),
    ("Layout", "Elevation Course Level Check", "LF", None, 350, ["2nd", "3rd"]),
    ("Layout", "Corners & Tee Layout", "EA", None, 12, ["1st", "2nd", "3rd"]),
    ("Layout", "Pilaster Layout", "EA", None, 6, ["1st", "2nd"]),
    ("Layout", "Embed / Pocket Layout", "LF", None, 80, ["1st", "2nd"]),

    # ── INSTALL / BUCKS ───────────────────────────────────────────────
    ("Install", "DoveTail Bucks Ripped & Assembled (16' Stick)", "EA", None, 30, ["all"]),
    ("Install", "Plywood Sheets Ripped for Blockouts", "EA", None, 20, ["all"]),
    ("Install", "Insulated Offset Bucks Ripped", "EA", None, 15, ["all"]),
    ("Install", "Bucks Built 1' – 6'", "EA", None, 18, ["1st", "2nd", "3rd"]),
    ("Install", "Bucks Built 7' – 12'", "EA", None, 14, ["1st", "2nd", "3rd"]),
    ("Install", "Bucks Built 13' – 20'", "EA", None, 6, ["1st", "2nd"]),
    ("Install", "Feb (Arch) / Circle Top Bucks Built", "EA", None, 4, ["1st"]),
    ("Install", "Radius Bucks / Blockouts Built", "EA", None, 6, ["1st", "2nd"]),
    ("Install", "Insulated Buck Installed", "EA", None, 24, ["all"]),
    ("Install", "Cut & Install Dowels", "EA", None, 80, ["all"]),
    ("Install", "Waterstop Primer Application", "LF", None, 300, ["all"]),
    ("Install", "Waterstop Installed", "LF", None, 300, ["all"]),
    ("Install", "Drill & Epoxy Safe Room Dowels", "EA", None, 40, ["all"]),
    ("Install", "Layout Radius Template Cut & Install", "EA", None, 4, ["1st", "2nd"]),

    # ── REBAR ─────────────────────────────────────────────────────────
    ("Rebar", "Commercial PreCut Rebar Shakeout — Sort by Area", "HRS", 4.0, None, ["all"]),
    ("Rebar", "Cut, Drill, Blow & Epoxy Rebar", "EA", None, 30, ["1st", "2nd", "3rd"]),
    ("Rebar", "Horizontal Rebar PreCut & Staged", "LF", None, 600, ["1st", "2nd", "3rd"]),
    ("Rebar", "Radius Wall Rebar PreCut & Staged", "LF", None, 80, ["1st", "2nd"]),
    ("Rebar", "Vertical Rebar Installed", "EA", None, 120, ["1st", "2nd", "3rd"]),

    # ── STAGE / BRACING ───────────────────────────────────────────────
    ("Install", "Bucks Staged at Wall", "EA", None, 40, ["1st", "2nd", "3rd"]),
    ("Install", "Corners, T's & Window Blocking Staged", "EA", None, 18, ["all"]),
    ("Install", "Crankups UnRack & Built (27')", "EA", None, 8, ["all"]),
    ("Install", "Crankups Placed", "EA", None, 8, ["all"]),
    ("Install", "Bracing Staged (4 pieces = 1 complete)", "EA", None, 40, ["all"]),
    ("Install", "12' Bracing Up", "EA", None, 30, ["1st", "2nd", "3rd"]),
    ("Install", "16' Bracing Up", "EA", None, 20, ["1st", "2nd"]),
    ("Install", "20' Bracing Up", "EA", None, 10, ["1st"]),

    # ── POUR ──────────────────────────────────────────────────────────
    ("Pour", "Pre-Pour Final Inspection", "HRS", 2.0, None, ["1st", "2nd", "3rd"]),
    ("Pour", "Concrete Placement", "HRS", 6.0, None, ["1st", "2nd", "3rd"]),
    ("Pour", "Post-Pour Quality Check", "HRS", 1.5, None, ["1st", "2nd", "3rd"]),

    # ── STRIP ─────────────────────────────────────────────────────────
    ("Strip", "Window/Door Bucks Stripped", "EA", None, 22, ["1st", "2nd", "3rd"]),
    ("Strip", "Feb (Arch) / Circle Top Stripped", "EA", None, 4, ["1st"]),
    ("Strip", "Walkboards & Handrails Down", "LF", None, 200, ["1st", "2nd", "3rd"]),
    ("Strip", "Crankups Walkboards & Handrails Down", "LF", None, 120, ["all"]),
    ("Strip", "12' Bracing Down", "EA", None, 30, ["1st", "2nd", "3rd"]),
    ("Strip", "16' Bracing Down", "EA", None, 20, ["1st", "2nd"]),
    ("Strip", "20' Bracing Down", "EA", None, 10, ["1st"]),
    ("Strip", "Crankups Down & Outside", "EA", None, 8, ["all"]),

    # ── CLEANUP ───────────────────────────────────────────────────────
    ("Cleanup", "Post Pour Cleanup", "LF", None, 350, ["1st", "2nd", "3rd"]),
    ("Cleanup", "Top Plate Details — Clean, Foam Gaps, Shave, Power Wash", "HRS", 4.0, None, ["all"]),
    ("Cleanup", "Pilaster Patch", "EA", None, 6, ["1st", "2nd"]),
    ("Cleanup", "ICF & Rebar Load Up Leftovers", "HRS", 3.0, None, ["all"]),
    ("Cleanup", "Crankups Load Up", "HRS", 2.5, None, ["all"]),
    ("Cleanup", "Bracing & Tools Finish Load Up", "HRS", 3.0, None, ["all"]),
    ("Cleanup", "Trailers DeMobilization", "HRS", 4.0, None, ["all"]),
    ("Cleanup", "Daily Tool Accountability", "HRS", 0.5, None, ["all"]),
]


# Pre-defined validation step templates (the "Validation Layer" baked in).
# Generic per category — AI generates more specific ones on demand.
DEFAULT_VALIDATION_STEPS = {
    "Layout": [
        ("Confirm lines are squared (3-4-5 triangle check at corners)", True),
        ("Verify dimensions match the approved plan set", True),
        ("All lines snapped, marked, and visible to crew", False),
        ("Foreman walked the layout before install begins", False),
    ],
    "Install": [
        ("All ICF blocks interlocked with no gaps", True),
        ("Web ties aligned vertically for rebar placement", True),
        ("Bracing points marked on every course", False),
        ("Bucks plumb and level — verified with 4ft level", True),
    ],
    "Rebar": [
        ("Bar size matches engineer spec (#4, #5, etc.)", True),
        ("Lap splice meets minimum length per code", True),
        ("Spacing matches plan (vertical and horizontal)", True),
        ("Rebar tied at every intersection / no shifted bars", False),
    ],
    "Pour": [
        ("All bracing checked tight before pour", False),
        ("Concrete slump test on first truck (4–6 inch range)", True),
        ("Pour height limited to 4ft per lift", False),
        ("Vibrator used in all corners and around bucks", False),
        ("Final walls plumb after pour (within 1/4\" tolerance)", True),
    ],
    "Strip": [
        ("Concrete cured minimum 24 hours before stripping", False),
        ("All hardware accounted for and palletized", False),
        ("No damage to ICF foam during removal", True),
    ],
    "Cleanup": [
        ("All debris removed from work area", True),
        ("Tools accounted for and stowed", False),
        ("Punch list signed off by foreman", False),
    ],
    "Precon": [
        ("All material loads tagged and labeled by area", False),
        ("Quantity verified against material list", False),
        ("Tool inventory completed", False),
    ],
    "Startup": [
        ("Material staged by build sequence", False),
        ("Safety walk-through completed with crew", True),
        ("Job-specific plans posted at trailer", False),
    ],
}


COMMON_MISTAKES = {
    "Install": [
        ("Buck not plumb", "Verify with 4ft level before bracing; shim base if foundation is uneven."),
        ("Webs not aligned vertically", "Use a string line on first course — every web must stack for vertical rebar drop."),
    ],
    "Rebar": [
        ("Lap too short", "Minimum lap = 48 × bar diameter for #5 (30in). Re-tie if short."),
        ("Vertical bars walking off-center", "Tie at every horizontal intersection; do not skip courses."),
    ],
    "Pour": [
        ("Blowout from over-fast pour", "Limit to 4 ft lifts. Pause 15 min between lifts on tall walls."),
        ("Honeycombing at corners", "Vibrate corners 6–8 seconds; do not over-vibrate or segregation occurs."),
    ],
    "Layout": [
        ("Square not checked", "Always 3-4-5 triangle at each corner — even small jobs."),
    ],
}
