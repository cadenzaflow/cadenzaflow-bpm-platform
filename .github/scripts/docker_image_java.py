#!/usr/bin/env python3
"""Is the Java of our published Docker images the latest Java of its line?

Reads the Java of an image on Docker Hub from the image itself (the base image writes it into
the setting JAVA_VERSION) and compares it with the latest release of Eclipse Temurin for the same
Java line. Nothing is pulled; it reads the description of the image only.

Usage: docker_image_java.py <repository> <tag> [<tag> ...]
Exit code 1 if an image is behind.
"""
import json
import re
import sys
import urllib.parse
import urllib.request

REGISTRY = "https://registry-1.docker.io"
ACCEPT = ", ".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])


class DropAuthorizationOnRedirect(urllib.request.HTTPRedirectHandler):
    """The registry sends the reader on to its storage, which must not get the registry token."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected.remove_header("Authorization")
        return redirected


OPENER = urllib.request.build_opener(DropAuthorizationOnRedirect)


def get_json(url, headers=None):
    # some services refuse the default client name of urllib
    request = urllib.request.Request(url, headers={"User-Agent": "docker-image-java-check/1.0", **(headers or {})})
    with OPENER.open(request, timeout=60) as response:
        return json.load(response)


def image_java(repository, tag):
    """The JAVA_VERSION of the linux/amd64 image behind the tag, e.g. 'jdk-17.0.21.1+2'."""
    scope = urllib.parse.quote(f"repository:{repository}:pull")
    token = get_json(f"https://auth.docker.io/token?service=registry.docker.io&scope={scope}")["token"]
    headers = {"Authorization": f"Bearer {token}", "Accept": ACCEPT}

    manifest = get_json(f"{REGISTRY}/v2/{repository}/manifests/{tag}", headers)
    if "manifests" in manifest:  # several platforms: take linux/amd64
        digest = next(
            entry["digest"]
            for entry in manifest["manifests"]
            if entry.get("platform", {}).get("os") == "linux"
            and entry.get("platform", {}).get("architecture") == "amd64"
        )
        manifest = get_json(f"{REGISTRY}/v2/{repository}/manifests/{digest}", headers)

    config = get_json(f"{REGISTRY}/v2/{repository}/blobs/{manifest['config']['digest']}", headers)
    for setting in config.get("config", {}).get("Env", []):
        if setting.startswith("JAVA_VERSION="):
            return setting.split("=", 1)[1]
    raise SystemExit(f"{repository}:{tag} does not tell its Java (no JAVA_VERSION)")


def latest_java(line):
    """The latest release of Eclipse Temurin for a Java line, e.g. 17 -> 'jdk-17.0.21.1+2'."""
    versions = urllib.parse.quote(f"[{line},{line + 1})")
    releases = get_json(
        "https://api.adoptium.net/v3/info/release_names"
        f"?release_type=ga&version={versions}&page_size=1&sort_order=DESC"
    )["releases"]
    return releases[0]


def main(repository, tags):
    behind = False
    for tag in tags:
        java = image_java(repository, tag)
        line = int(re.match(r"jdk-?(\d+)", java).group(1))
        latest = latest_java(line)
        if java == latest:
            print(f"{repository}:{tag}: {java}, the latest Java {line}")
        else:
            behind = True
            print(
                f"::error::{repository}:{tag} has {java}; the latest Java {line} is {latest}. "
                "Update the base image in docker/Dockerfile and docker/Dockerfile.run "
                "and publish the images again with the workflow 'Docker images'."
            )
    return 1 if behind else 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2:]))
