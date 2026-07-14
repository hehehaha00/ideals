"""使用 curl_cffi + 本地代理调用 OpenAI 兼容图片接口。"""

from __future__ import annotations

import argparse
import base64
import json
import os
import time
from pathlib import Path
from typing import Any

from curl_cffi import requests


class RelayProxyError(RuntimeError):
    """代理生图失败时抛出的错误。"""


def read_text(path: Path) -> str:
    """读取 UTF-8 文本文件。"""
    return path.read_text(encoding="utf-8")


def load_key(env_name: str) -> str:
    """从环境变量读取 API key。"""
    key = os.environ.get(env_name, "").strip()
    if not key:
        raise RelayProxyError(f"未找到环境变量 {env_name}。")
    return key


def normalize_output(path_text: str) -> Path:
    """规范输出路径并创建目录。"""
    output = Path(path_text).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)
    return output


def build_job(raw: dict[str, Any], index: int) -> dict[str, Any]:
    """从批量配置创建单个任务。"""
    prompt = raw.get("prompt")
    if raw.get("prompt_file"):
        prompt = read_text(Path(raw["prompt_file"]).expanduser())
    if not prompt:
        raise RelayProxyError(f"第 {index + 1} 个任务缺少 prompt 或 prompt_file。")
    return {
        "prompt": prompt,
        "output": normalize_output(raw["output"]),
        "size": raw.get("size", "2048x2048"),
        "quality": raw.get("quality", "high"),
    }


def request_image(args: argparse.Namespace, api_key: str, job: dict[str, Any]) -> bytes:
    """通过代理请求图片接口并返回图片字节。"""
    endpoint = args.base_url.rstrip("/") + "/v1/images/generations"
    proxy_url = f"http://{args.proxy}"
    payload = {
        "model": args.model,
        "prompt": job["prompt"],
        "n": 1,
        "size": job["size"],
        "quality": job["quality"],
        "format": "png",
    }
    response = requests.post(
        endpoint,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json; charset=utf-8",
        },
        json=payload,
        proxies={"http": proxy_url, "https": proxy_url},
        impersonate=args.impersonate,
        timeout=args.timeout,
    )
    if response.status_code >= 400:
        raise RelayProxyError(f"HTTP {response.status_code}: {response.text[:1000]}")

    data = response.json()
    if not data.get("data"):
        raise RelayProxyError(f"响应里没有 data：{json.dumps(data, ensure_ascii=False)[:1000]}")

    first = data["data"][0]
    if first.get("b64_json"):
        return base64.b64decode(first["b64_json"])
    if first.get("url"):
        image_response = requests.get(
            first["url"],
            proxies={"http": proxy_url, "https": proxy_url},
            impersonate=args.impersonate,
            timeout=args.timeout,
        )
        if image_response.status_code >= 400:
            raise RelayProxyError(f"下载图片失败 HTTP {image_response.status_code}: {image_response.text[:500]}")
        return image_response.content
    raise RelayProxyError(f"响应里没有 b64_json 或 url：{json.dumps(first, ensure_ascii=False)[:1000]}")


def parse_args() -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description="Generate images through relay with proxy and browser fingerprint.")
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--api-key-env", default="RELAY_IMAGE_API_KEY")
    parser.add_argument("--model", default="gpt-image-2")
    parser.add_argument("--batch-json", required=True)
    parser.add_argument("--proxy", default="127.0.0.1:7897")
    parser.add_argument("--impersonate", default="chrome124")
    parser.add_argument("--timeout", type=int, default=900)
    return parser.parse_args()


def main() -> int:
    """执行批量生图任务。"""
    args = parse_args()
    api_key = load_key(args.api_key_env)
    raw_jobs = json.loads(read_text(Path(args.batch_json).expanduser()))
    if not isinstance(raw_jobs, list):
        raise RelayProxyError("--batch-json 必须是 JSON 数组。")

    jobs = [build_job(raw, index) for index, raw in enumerate(raw_jobs)]
    outputs: list[str] = []
    started = time.time()
    for index, job in enumerate(jobs, start=1):
        image_bytes = request_image(args, api_key, job)
        job["output"].write_bytes(image_bytes)
        outputs.append(str(job["output"]))
        print(f"{index}/{len(jobs)} {job['output']}", flush=True)

    print(json.dumps({"count": len(outputs), "seconds": round(time.time() - started, 2), "outputs": outputs}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
