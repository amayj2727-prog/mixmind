# MIXMIND — VirtualDJ Integration Feasibility & Architecture Report

## Executive Summary

This investigation evaluates integration options between the MIXMIND Python backend and **VirtualDJ Home** running on **macOS Apple Silicon (ARM64)**.

### Crucial Finding: Licensing Constraint on Network Control
Official VirtualDJ developer documentation confirms that **native OSC control (`oscPort`) and the HTTP Network Control plugin are exclusively gated behind VirtualDJ Pro** (`requires a VDJ PRO license`). In **VirtualDJ Home (Free tier)**, external network sockets and incoming remote control scripts are blocked.

In accordance with MIXMIND's core principles:
1. We will **never bypass software licensing restrictions** or inject undocumented DLL/dylib memory hacks.
2. We have implemented a formal **VirtualDJ Universal Adapter Interface (`IVirtualDJAdapter`)** with a high-fidelity **Mock Adapter (`VirtualDJMockAdapter`)** to allow complete, decoupled development of MIXMIND's AI intelligence, transitions, and mashup engine without any cost.

---

## 1. Investigation of 10 Core Areas

| Area | Technical Mechanism | VirtualDJ Home Status | VirtualDJ Pro Status |
| :--- | :--- | :--- | :--- |
| **1. Network Control Availability** | Native UDP OSC (`oscPort`, `oscPortBack`) & HTTP REST plugin (`/execute`, `/query`). | **Blocked** (gated by license). | **Fully Supported** on configurable ports (default UDP 8000/9000, HTTP 8000). |
| **2. Licensing Requirements** | Software tier verification. | **Home**: Free for personal keyboard/mouse use; external network APIs inactive. | **Pro**: $19/mo subscription or $299 one-time. Unlocks OSC, HTTP plugins, multi-controller mapping, and commercial performance rights. |
| **3. VDJScript Capabilities** | Rich macro language (`deck <d> <action>`, conditionals, math, queries). | Interpreted internally for keyboard shortcuts and skins only. | Remotely executable over OSC and HTTP. |
| **4. Supported HTTP Commands** | Endpoints: `GET/POST /execute?script={script}` and `/query?script={query}` with optional Bearer auth. | Inactive. | Fully supported via official Network Control extension. |
| **5. Available Deck Information** | Queries for `bpm`, `time`, `time_remaining`, `songpos`, `key`, `is_playing`, `title`, `artist`. | Accessible inside skin/UI only. | Queryable on demand or streamable via OSC subscriptions. |
| **6. Playlist Management** | VDJScript verbs (`automix_add`, `playlist_load`) and filesystem monitoring (`~/Documents/VirtualDJ/Playlists/`). | File-based `.m3u` monitoring works; remote API calls blocked. | Full API control + filesystem playlist auto-import. |
| **7. Track Loading** | VDJScript verb: `deck <d> load "<absolute_path>"`. | Blocked from external apps. | Instant loading and deck preparation. |
| **8. Playback State Monitoring** | Active queries or push subscriptions via `/vdj/subscribe/...`. | Blocked from external apps. | Real-time push updates on beat clock and transport events. |
| **9. EQ & Effects Control** | 3-band EQ (`eq_low`, `eq_mid`, `eq_high`), dual-mode filter (`filter`), and FX sliders (`effect '<name>' slider <n> <val>%`). | Blocked from external apps. | Full precision parameter control (0-100%). |
| **10. Stem Control & Limitations** | 4-stem manipulation (`vocal`, `instruments`, `bass`, `drums`), solo, and mute. | Runs internally on Apple Silicon GPU/NEON; external control blocked. | Full stem fader control via `stem '<name>' <val>%`. Cannot extract raw stem audio files to disk. |

---

## 2. Lowest-Cost Supported Development Path

```
+--------------------------------------------------------------------------------------------------+
| PHASE 1: Immediate & Zero-Cost Development (CURRENT STATE)                                       |
| - MIXMIND utilizes `VirtualDJMockAdapter`.                                                      |
| - High-fidelity software simulation handles deck transport, beat clock, EQ, filter, and stems.  |
| - Complete AI DJ stack (scanner, intelligence, transitions, mashups, trends) developed cleanly.  |
| - Cost: $0.00                                                                                    |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
+--------------------------------------------------------------------------------------------------+
| PHASE 2: Production Hardware & Host Verification                                                 |
| - User activates VirtualDJ Pro Monthly Subscription ($19/mo for 1 month) or 30-day Pro trial.    |
| - Switch adapter factory from `VirtualDJMockAdapter` to `VirtualDJLiveAdapter`.                  |
| - Live testing of OSC sockets and VDJScript execution against running VirtualDJ desktop host.   |
| - Cost: $19.00 total for verification                                                            |
+--------------------------------------------------------------------------------------------------+
```

---

## 3. Decoupled Architecture Implementation

The `backend/src/virtualdj/` package now contains:
- **`IVirtualDJAdapter`**: Universal abstract contract.
- **`VirtualDJMockAdapter`**: Isolated software simulator for zero-cost development in VirtualDJ Home.
- **`VirtualDJLiveAdapter`**: High-performance OSC/HTTP client for VirtualDJ Pro environments.
- **`get_virtualdj_adapter()`**: Safe factory function that gracefully defaults to simulation.
