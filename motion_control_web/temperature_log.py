"""Per-day motor temperature CSV files, durable across power loss."""

from __future__ import annotations

import os
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Sequence

_DATE_FILE = re.compile(r'^(\d{4}-\d{2}-\d{2})\.csv$')


class TemperatureLog:
    def __init__(self, directory: str | os.PathLike, retention_days: int = 90):
        self.directory = Path(directory)
        self.retention_days = retention_days

    def append(
        self,
        when: datetime,
        event: str,
        motor_ids: Sequence[int],
        temperatures: Sequence[float],
    ) -> Path:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / f'{when.date().isoformat()}.csv'
        is_new = not path.exists()

        lines = []
        if is_new:
            lines.append(','.join(['timestamp', 'event', *(f'motor{i}' for i in motor_ids)]))
        lines.append(','.join([
            when.isoformat(timespec='seconds'),
            event,
            *(f'{t:g}' for t in temperatures),
        ]))

        with open(path, 'a', encoding='utf-8') as f:
            f.write('\n'.join(lines) + '\n')
            f.flush()
            os.fsync(f.fileno())
        if is_new:
            _fsync_dir(self.directory)
        return path

    def purge(self, today: date) -> list[str]:
        """Delete files older than retention_days; returns deleted dates."""
        cutoff = today - timedelta(days=self.retention_days)
        deleted = []
        for day in self.list_dates():
            if date.fromisoformat(day) < cutoff:
                (self.directory / f'{day}.csv').unlink(missing_ok=True)
                deleted.append(day)
        return deleted

    def list_dates(self) -> list[str]:
        if not self.directory.is_dir():
            return []
        days = []
        for entry in self.directory.iterdir():
            match = _DATE_FILE.match(entry.name)
            if match and entry.is_file():
                days.append(match.group(1))
        return sorted(days, reverse=True)

    def read(self, day: str) -> str:
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', day):
            raise ValueError(f'invalid date: {day!r}')
        path = self.directory / f'{day}.csv'
        if not path.is_file():
            raise FileNotFoundError(f'no temperature log for {day}')
        return path.read_text(encoding='utf-8')


def _fsync_dir(directory: Path) -> None:
    fd = os.open(directory, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_atomic(path: str | os.PathLike, text: str) -> None:
    """Write text so that a power cut leaves either the old or the new file."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(text)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, path)
    _fsync_dir(path.parent)
