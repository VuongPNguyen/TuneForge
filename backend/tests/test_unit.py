"""Unit tests for pure helper functions — no I/O, no network."""
import ipaddress
import uuid

import pytest

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import (
    _validate_youtube_url,
    _validate_file_id,
    _safe_filename,
    _safe_log_url,
    _PRIVATE_NETWORKS,
)


# ---------------------------------------------------------------------------
# _validate_youtube_url
# ---------------------------------------------------------------------------

class TestValidateYouTubeUrl:
    @pytest.mark.parametrize("url", [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com/watch?v=dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "http://www.youtube.com/watch?v=dQw4w9WgXcQ",
    ])
    def test_valid_youtube_urls(self, url):
        assert _validate_youtube_url(url) is True

    @pytest.mark.parametrize("url", [
        "https://vimeo.com/123456",
        "https://evil.youtube.com/watch?v=abc",
        "https://youtube.com.evil.com/watch?v=abc",
        "ftp://www.youtube.com/watch?v=abc",
        "file:///etc/passwd",
        "not a url at all",
        "",
    ])
    def test_invalid_or_non_youtube_urls(self, url):
        assert _validate_youtube_url(url) is False


# ---------------------------------------------------------------------------
# _validate_file_id
# ---------------------------------------------------------------------------

class TestValidateFileId:
    def test_valid_v4_uuid(self):
        assert _validate_file_id(str(uuid.uuid4())) is True

    @pytest.mark.parametrize("bad_id", [
        "",
        "abc",
        "../../../etc/passwd",
        "550E8400-E29B-41D4-A716-446655440000",  # uppercase
        "550e8400-e29b-11d4-a716-446655440000",  # v1 (not v4)
        "550e8400-e29b-41d4-0716-446655440000",  # variant bits wrong (0 not 8-b)
        "gggggggg-gggg-4ggg-8ggg-gggggggggggg",  # non-hex chars
    ])
    def test_invalid_file_ids(self, bad_id):
        assert _validate_file_id(bad_id) is False


# ---------------------------------------------------------------------------
# _safe_filename
# ---------------------------------------------------------------------------

class TestSafeFilename:
    def test_preserves_spaces(self):
        assert _safe_filename("Artist - Title") == "Artist - Title"

    def test_preserves_allowed_chars(self):
        result = _safe_filename("Track (feat. Someone) 01")
        assert "(" in result
        assert ")" in result
        assert "." in result
        assert " " in result

    def test_strips_only_disallowed_chars(self):
        assert _safe_filename("hello/world") == "helloworld"
        result = _safe_filename("title<script>")
        assert "<" not in result
        assert ">" not in result
        assert result == "titlescript"

    def test_truncates_at_100_chars(self):
        assert len(_safe_filename("a" * 200)) == 100

    def test_empty_string_returns_download(self):
        assert _safe_filename("") == "download"

    def test_whitespace_only_returns_download(self):
        assert _safe_filename("  ") == "download"

    def test_strips_backslash_colon_star_etc(self):
        result = _safe_filename('a\\b/c:d*e?f"g<h>i|j')
        assert result == "abcdefghij"


# ---------------------------------------------------------------------------
# _safe_log_url
# ---------------------------------------------------------------------------

class TestSafeLogUrl:
    def test_strips_newline(self):
        result = _safe_log_url("https://example.com\nX-Header: injected")
        assert "\n" not in result

    def test_strips_carriage_return(self):
        result = _safe_log_url("https://example.com\revil")
        assert "\r" not in result

    def test_strips_tab(self):
        result = _safe_log_url("https://example.com\tevil")
        assert "\t" not in result

    def test_truncates_to_200_chars(self):
        long_url = "https://example.com/" + "a" * 500
        assert len(_safe_log_url(long_url)) <= 200

    def test_short_url_unchanged(self):
        url = "https://example.com/img.jpg"
        assert _safe_log_url(url) == url


# ---------------------------------------------------------------------------
# _PRIVATE_NETWORKS (SSRF blocklist)
# ---------------------------------------------------------------------------

class TestPrivateNetworks:
    @pytest.mark.parametrize("ip", [
        "10.0.0.1",
        "10.255.255.255",
        "172.16.0.1",
        "172.31.255.255",
        "192.168.0.1",
        "192.168.255.255",
        "127.0.0.1",
        "127.255.255.255",
        "169.254.0.1",       # link-local
        "100.64.0.1",        # shared address space
    ])
    def test_private_ips_are_blocked(self, ip):
        addr = ipaddress.ip_address(ip)
        assert any(addr in net for net in _PRIVATE_NETWORKS), f"{ip} should be blocked"

    @pytest.mark.parametrize("ip", [
        "8.8.8.8",
        "1.1.1.1",
        "93.184.216.34",
        "104.16.0.0",
    ])
    def test_public_ips_are_not_blocked(self, ip):
        addr = ipaddress.ip_address(ip)
        assert not any(addr in net for net in _PRIVATE_NETWORKS), f"{ip} should be allowed"
