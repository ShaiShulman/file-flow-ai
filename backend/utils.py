from typing import Optional

MAX_WORDS = 500
MAX_CHARS = 10000


def truncate_text(
    text: str,
    max_words: Optional[int] = MAX_WORDS,
    max_chars: Optional[int] = MAX_CHARS,
) -> str:
    """
    Truncate text based on maximum number of words or characters, whichever yields the longer result.

    Args:
        text (str): The input text to slice
        max_words (int, optional): Maximum number of words to include
        max_chars (int, optional): Maximum number of characters to include

    Returns:
        str: The sliced text, with "..." appended if text was truncated
    """
    if not text or (not max_words and not max_chars):
        return text

    words = text.split()
    word_slice = " ".join(words[:max_words]) if max_words else text

    char_slice = text[:max_chars] if max_chars else text

    result = word_slice if len(word_slice) > len(char_slice) else char_slice

    return result
