from datetime import date, datetime

import pytest

from motion_control_web.temperature_log import TemperatureLog, write_atomic


def test_append_writes_header_once_per_day(tmp_path):
    log = TemperatureLog(tmp_path)
    log.append(datetime(2026, 11, 5, 10, 0, 0), 'rest', [0, 1], [34.0, 41.5])
    log.append(datetime(2026, 11, 5, 10, 1, 0), 'overheat_recheck', [0, 1], [33.0, 40.0])
    log.append(datetime(2026, 11, 6, 9, 0, 0), 'rest', [0, 1], [30.0, 31.0])

    assert log.read('2026-11-05').splitlines() == [
        'timestamp,event,motor0,motor1',
        '2026-11-05T10:00:00,rest,34,41.5',
        '2026-11-05T10:01:00,overheat_recheck,33,40',
    ]
    assert log.list_dates() == ['2026-11-06', '2026-11-05']


def test_purge_keeps_retention_window(tmp_path):
    log = TemperatureLog(tmp_path, retention_days=90)
    for day in ('2026-08-06', '2026-08-07', '2026-11-05'):
        (tmp_path / f'{day}.csv').write_text('timestamp,event\n')
    (tmp_path / 'notes.txt').write_text('keep me')

    deleted = log.purge(date(2026, 11, 5))

    assert deleted == ['2026-08-06']
    assert log.list_dates() == ['2026-11-05', '2026-08-07']
    assert (tmp_path / 'notes.txt').exists()


@pytest.mark.parametrize('bad', ['../x', '2026-11-5', '2026-11-05.csv', ''])
def test_read_rejects_non_dates(tmp_path, bad):
    with pytest.raises(ValueError):
        TemperatureLog(tmp_path).read(bad)


def test_read_missing_day(tmp_path):
    with pytest.raises(FileNotFoundError):
        TemperatureLog(tmp_path).read('2026-01-01')


def test_write_atomic_replaces_and_leaves_no_tmp(tmp_path):
    target = tmp_path / 'sub' / 'schedule.yaml'
    write_atomic(target, 'a: 1\n')
    write_atomic(target, 'a: 2\n')
    assert target.read_text() == 'a: 2\n'
    assert [p.name for p in target.parent.iterdir()] == ['schedule.yaml']
