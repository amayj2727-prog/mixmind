# MIXMIND Trend Intelligence Architecture & Commercial Licensing Analysis

## 1. Overview & System Purpose

The **Trend Intelligence System** gives MIXMIND market awareness of contemporary musical movements without sacrificing local processing, user privacy, or audio copyright rules.

Rather than dictating song choices or forcing unowned tracks into performance queues, the trend engine:
1. Maintains structured snapshots of active genres, popular BPM ranges, emerging tracks, and remix styles.
2. Cross-references this intelligence against the user's **locally owned music library**.
3. Rewards local tracks that align with current festival and dance floor trends while preserving timeless set selections.

---

## 2. Architectural Invariants

| Principle | Implementation in MIXMIND |
| :--- | :--- |
| **Data Isolation** | Trend snapshots are persisted in `data/trends/*.json` (completely isolated from the local user `mixmind.db` SQLite database). User tracks are never contaminated with external unowned metadata. |
| **Zero Availability Assumption** | Trending tracks in external snapshots are treated strictly as external market references. MIXMIND never assumes a trending track is available or playable unless an exact match is discovered in the local library. |
| **Source Provenance & Freshness** | Every snapshot records `source_name`, `source_type` (`manual_import`, `curated_snapshot`, `community_list`), import timestamp, and freshness lifecycle (`fresh` $\le 14\text{d}$, `aging` $14-30\text{d}$, `stale` $> 30\text{d}$). |
| **Zero Audio Scraping/Downloading** | The trend intelligence engine deals purely with musical metadata tags, BPM ranges, and trend scores. It has zero capability to stream or download audio files. |
| **Terms of Service Compliance** | Scrapers against commercial website terms are avoided. Input is driven by structured, manually importable JSON/CSV snapshots and verified open metadata feeds. |

---

## 3. Commercial Data Providers & Licensing Analysis

To guide future roadmap decisions without premature API expenses, the table below reviews potential external data providers and their commercial licensing requirements:

| Data Provider | Data Provided | Commercial Licensing & Terms Analysis | Suitability for MIXMIND |
| :--- | :--- | :--- | :--- |
| **Beatport API** | Top 100 charts, genre rankings, BPM, key, stems metadata. | **Requires Commercial Developer Agreement**. Beatport requires explicit B2B licensing for software integration. Commercial streaming requires Beatport Streaming API integration with subscription revenue share. Scraping is strictly prohibited in ToS. | **High** for future commercial tiers; requires formal partnership agreement. |
| **1001Tracklists** | Festival tracklists, DJ support counts, trending mashup combinations. | **Enterprise Data Syndication Required**. 1001Tracklists does not have a public free REST API; commercial applications must negotiate custom B2B data licensing agreements. Scraping violates their Terms of Service (§4.2). | **Ideal for festival trends**, but requires commercial syndication licensing. |
| **Spotify Web API** | Viral 50, Top 50, algorithmic audio features. | **Restricted / Non-Commercial Commercial License**. Spotify Developer Terms of Service §IV explicitly forbid using the API to develop DJ software, caching audio, or syncing audio with external mixing algorithms. Not permitted for autonomous DJ playback. | **Unsuitable** for core DJ engine due to restrictive developer terms. |
| **Chartmetric / Soundcharts** | Cross-platform trend analytics, streaming velocity, TikTok audio virality. | **B2B Enterprise Subscriptions ($500 - $2,500/mo)**. Designed for record labels and music supervisors. High data fidelity, but expensive for early-stage desktop software. | **Deferred** until commercial scale warrants enterprise analytics spend. |
| **MusicBrainz & AcousticBrainz** | Open-source crowd-sourced track metadata, acoustic feature models. | **Open Data / Creative Commons (CC0 / CC BY-NC-SA)**. Free to integrate and host locally without licensing fees. Does not provide real-time sales/festival chart ranks, but excellent for static acoustic attributes. | **Recommended** for baseline open metadata enrichment. |

---

## 4. Current Manual Import Formats

MIXMIND currently supports two zero-cost, terms-compliant import interfaces:

1. **JSON Snapshot (`TrendSnapshot`)**:
   Full multi-dimensional market reports specifying trending genres, tracks, remix styles, and BPM boundaries.
2. **CSV Chart Export (`import_trend_tracks_csv`)**:
   Direct import of standard DJ export charts (`title`, `artist`, `genre`, `bpm`, `key`).
