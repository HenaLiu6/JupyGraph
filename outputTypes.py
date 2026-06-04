import base64

def text_output(text: str) -> dict:
    return {
        "type": "text",
        "text": text
    }

def error_output(message: str) -> dict:
    return {
        "type": "error",
        "message": message
    }

def mime_output(mime_type: str, raw_bytes: bytes) -> dict:
    base64_str = base64.b64encode(raw_bytes).decode('utf-8')
    return {
        "type": "image",
        "mime_type": mime_type,
        "data": base64_str
    }