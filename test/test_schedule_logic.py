import random
from datetime import datetime

import pytest

from motion_control_web import schedule_logic as logic


def _config(**overrides):
    return logic.validate_config(overrides)


# 2026-11-02 is a Monday.
MON_0959 = datetime(2026, 11, 2, 9, 59)
MON_1000 = datetime(2026, 11, 2, 10, 0)
MON_2159 = datetime(2026, 11, 2, 21, 59)
MON_2200 = datetime(2026, 11, 2, 22, 0)


def test_defaults_are_valid_and_disabled():
    config = _config()
    assert config['enabled'] is False
    assert config['motions_per_rest'] == {'min': 1, 'max': 3}
    assert config['rest_sec'] == {'min': 10.0, 'max': 10.0}
    assert config['overheat'] == {'limit_c': 70.0, 'resume_c': 60.0, 'recheck_sec': 20.0}


def test_open_window_is_inclusive_open_exclusive_close():
    config = _config()
    assert not logic.is_open(config, MON_0959)
    assert logic.is_open(config, MON_1000)
    assert logic.is_open(config, MON_2159)
    assert not logic.is_open(config, MON_2200)


def test_day_off_is_closed():
    config = _config(week={'mon': {'enabled': False}})
    assert not logic.is_open(config, MON_1000)
    # Tuesday keeps the default window.
    assert logic.is_open(config, datetime(2026, 11, 3, 12, 0))


def test_rejects_close_not_after_open():
    with pytest.raises(ValueError, match='week.mon'):
        _config(week={'mon': {'open': '22:00', 'close': '10:00'}})


def test_disabled_day_may_have_any_times():
    config = _config(week={'mon': {'enabled': False, 'open': '22:00', 'close': '10:00'}})
    assert not logic.is_open(config, MON_1000)


@pytest.mark.parametrize('bad', ['9:00', '24:00', '10:60', 1000, None])
def test_rejects_bad_time(bad):
    with pytest.raises(ValueError):
        _config(week={'tue': {'open': bad}})


def test_rejects_unsafe_playlist_names():
    with pytest.raises(ValueError, match='playlist'):
        _config(playlist=['../etc/passwd.csv'])
    with pytest.raises(ValueError, match='playlist'):
        _config(playlist=['motion.yaml'])
    assert _config(playlist=['a.csv', 'b.csv'])['playlist'] == ['a.csv', 'b.csv']


def test_rejects_inverted_ranges():
    with pytest.raises(ValueError, match='rest_sec'):
        _config(rest_sec={'min': 30, 'max': 10})
    with pytest.raises(ValueError, match='motions_per_rest'):
        _config(motions_per_rest={'min': 0, 'max': 3})
    with pytest.raises(ValueError, match='motions_per_rest'):
        _config(motions_per_rest={'min': 1.5, 'max': 3})


def test_rejects_resume_not_below_limit():
    with pytest.raises(ValueError, match='overheat'):
        _config(overheat={'limit_c': 60, 'resume_c': 60, 'recheck_sec': 20})


def test_random_picks_stay_in_range():
    config = _config(motions_per_rest={'min': 1, 'max': 3}, rest_sec={'min': 30, 'max': 60})
    rng = random.Random(0)
    counts = {logic.pick_motion_count(config, rng) for _ in range(200)}
    rests = [logic.pick_rest_sec(config, rng) for _ in range(200)]
    assert counts == {1, 2, 3}
    assert all(30 <= r <= 60 for r in rests)


def test_fixed_rest_when_min_equals_max():
    config = _config()
    assert logic.pick_rest_sec(config, random.Random(1)) == 10.0


def test_overheat_hysteresis():
    config = _config()
    assert not logic.is_overheated(config, [69.0, 40.0])
    assert logic.is_overheated(config, [70.0, 40.0])
    assert not logic.is_cooled(config, [60.0, 40.0])
    assert logic.is_cooled(config, [59.0, 40.0])


def test_stop_threshold_lands_before_wrap():
    # 60 s motion: stop 0.15 s before the end.
    assert logic.stop_progress_threshold(60.0) == pytest.approx(1 - 0.0025)
    # Short motions are capped at 1 % early.
    assert logic.stop_progress_threshold(5.0) == pytest.approx(0.99)
    assert logic.stop_progress_threshold(0.0) == 0.995
