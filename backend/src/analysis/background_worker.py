"""
MIXMIND - Background Audio Analysis Worker & Queue
Executes non-blocking background analysis of audio tracks with concurrency and progress reporting.
"""

import time
import threading
import queue
import logging
from typing import List, Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor

from .audio_analyzer import AudioAnalyzer
from .models import AudioAnalysisReport
from ..database.db import DatabaseManager

logger = logging.getLogger("AnalysisWorker")


class AnalysisTask:
    def __init__(self, track_id: int, filepath: str, file_hash: str = ""):
        self.track_id = track_id
        self.filepath = filepath
        self.file_hash = file_hash
        self.status = "pending"  # pending, analyzing, completed, failed
        self.report: Optional[AudioAnalysisReport] = None
        self.error: Optional[str] = None
        self.created_at = time.time()
        self.completed_at: Optional[float] = None


class AnalysisQueue:
    def __init__(
        self,
        db: DatabaseManager,
        analyzer: Optional[AudioAnalyzer] = None,
        max_workers: int = 2
    ):
        self.db = db
        self.analyzer = analyzer or AudioAnalyzer()
        self.max_workers = max_workers
        self.task_queue: queue.Queue = queue.Queue()
        self.tasks: Dict[str, AnalysisTask] = {}  # filepath -> AnalysisTask
        self.running = False
        self.workers: List[threading.Thread] = []
        self._progress_callbacks: List[Callable[[int, int, Optional[AudioAnalysisReport]], None]] = []
        self.lock = threading.Lock()

    def add_progress_callback(self, callback: Callable[[int, int, Optional[AudioAnalysisReport]], None]):
        self._progress_callbacks.append(callback)

    def enqueue(self, track_id: int, filepath: str, file_hash: str = "") -> AnalysisTask:
        task = AnalysisTask(track_id=track_id, filepath=filepath, file_hash=file_hash)
        with self.lock:
            self.tasks[filepath] = task
        self.task_queue.put(task)
        return task

    def start(self):
        """Starts worker threads."""
        if self.running:
            return
        self.running = True
        for i in range(self.max_workers):
            t = threading.Thread(target=self._worker_loop, name=f"AnalysisWorker-{i+1}", daemon=True)
            self.workers.append(t)
            t.start()
        logger.info(f"Started AnalysisQueue with {self.max_workers} background workers.")

    def stop(self):
        """Signals workers to stop."""
        self.running = False
        for _ in range(self.max_workers):
            self.task_queue.put(None)
        for t in self.workers:
            t.join(timeout=2.0)
        self.workers.clear()

    def get_progress(self) -> Dict[str, Any]:
        with self.lock:
            total = len(self.tasks)
            completed = sum(1 for t in self.tasks.values() if t.status == "completed")
            failed = sum(1 for t in self.tasks.values() if t.status == "failed")
            analyzing = sum(1 for t in self.tasks.values() if t.status == "analyzing")
            pending = total - completed - failed - analyzing
        return {
            "total": total,
            "completed": completed,
            "failed": failed,
            "analyzing": analyzing,
            "pending": pending
        }

    def _worker_loop(self):
        while self.running:
            try:
                task: Optional[AnalysisTask] = self.task_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            if task is None:
                break

            task.status = "analyzing"
            try:
                report = self.analyzer.analyze_file(task.filepath, file_hash=task.file_hash)
                task.report = report
                task.status = "completed"
                task.completed_at = time.time()

                # Sync analysis results back to database
                self._update_db_record(task.track_id, report)

            except Exception as e:
                task.status = "failed"
                task.error = str(e)
                logger.error(f"Analysis worker failed on {task.filepath}: {e}")
                self._update_db_error(task.track_id, str(e))

            finally:
                self.task_queue.task_done()
                self._notify_progress(task.report)

    def _update_db_record(self, track_id: int, report: AudioAnalysisReport):
        """Updates track in database with analyzed musical labels and structural cues."""
        track = self.db.get_track_by_id(track_id)
        if not track:
            return

        track.bpm = report.get_effective_bpm()
        track.initial_key = report.estimated.key + ("m" if report.estimated.mode == "minor" else "")
        track.camelot_key = report.get_effective_camelot()
        track.energy = report.estimated.energy_rating
        track.danceability = report.estimated.danceability
        track.vocal_presence = report.estimated.vocal_presence
        track.cue_in = report.get_effective_cue_in()
        track.cue_out = report.get_effective_cue_out()
        track.scan_status = "analyzed"
        track.scan_error = ""

        self.db.upsert_track(track)

    def _update_db_error(self, track_id: int, error_msg: str):
        """Updates track in database with error status."""
        track = self.db.get_track_by_id(track_id)
        if not track:
            return

        track.scan_status = "error"
        track.scan_error = error_msg
        self.db.upsert_track(track)

    def _notify_progress(self, report: Optional[AudioAnalysisReport]):
        stats = self.get_progress()
        for cb in self._progress_callbacks:
            try:
                cb(stats["completed"] + stats["failed"], stats["total"], report)
            except Exception:
                pass
