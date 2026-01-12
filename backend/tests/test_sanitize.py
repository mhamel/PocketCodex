from app.pty.sanitize import strip_terminal_identity_responses


def test_strip_terminal_identity_responses_removes_da_response_with_esc_prefix() -> None:
    assert strip_terminal_identity_responses("\x1b[?1;2c") == ""
    assert strip_terminal_identity_responses("hi\x1b[?1;2c\r\n") == "hi\r\n"


def test_strip_terminal_identity_responses_removes_da_response_without_esc_prefix() -> None:
    assert strip_terminal_identity_responses("[?1;2c") == ""
    assert strip_terminal_identity_responses("hi[?1;2c\r\n") == "hi\r\n"
