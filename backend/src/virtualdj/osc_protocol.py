"""
MIXMIND - Open Sound Control (OSC 1.0) Binary Protocol Engine
"""

import struct
from typing import Tuple, List, Any


def build_osc_message(address: str, *args) -> bytes:
    """Encodes an address and arguments into a standard binary OSC packet."""
    def pad(s: bytes) -> bytes:
        remainder = len(s) % 4
        pad_len = 4 - remainder if remainder != 0 else 4
        return s + (b"\x00" * pad_len)

    msg = pad(address.encode("utf-8"))
    if not args:
        return msg + pad(b",")

    tags = ","
    payload = b""
    for arg in args:
        if isinstance(arg, float):
            tags += "f"
            payload += struct.pack(">f", arg)
        elif isinstance(arg, int):
            tags += "i"
            payload += struct.pack(">i", arg)
        elif isinstance(arg, str):
            tags += "s"
            payload += pad(arg.encode("utf-8"))
        elif isinstance(arg, bytes):
            tags += "b"
            payload += struct.pack(">i", len(arg)) + pad(arg)

    return msg + pad(tags.encode("utf-8")) + payload


def parse_osc_message(data: bytes) -> Tuple[str, List[Any]]:
    """Decodes a binary OSC packet into address and argument list."""
    try:
        idx = data.find(b"\x00")
        if idx == -1:
            return "", []
        address = data[:idx].decode("utf-8", errors="ignore")
        idx = (idx // 4 + 1) * 4
        if idx >= len(data) or data[idx : idx + 1] != b",":
            return address, []

        tag_end = data.find(b"\x00", idx)
        if tag_end == -1:
            return address, []
        tags = data[idx + 1 : tag_end].decode("ascii", errors="ignore")
        idx = (tag_end // 4 + 1) * 4

        args = []
        for tag in tags:
            if idx >= len(data):
                break
            if tag == "f":
                val = struct.unpack(">f", data[idx : idx + 4])[0]
                args.append(val)
                idx += 4
            elif tag == "i":
                val = struct.unpack(">i", data[idx : idx + 4])[0]
                args.append(val)
                idx += 4
            elif tag == "s":
                str_end = data.find(b"\x00", idx)
                val = data[idx:str_end].decode("utf-8", errors="ignore")
                idx = (str_end // 4 + 1) * 4
                args.append(val)
        return address, args
    except Exception:
        return "", []
