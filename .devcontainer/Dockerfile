FROM mcr.microsoft.com/devcontainers/python:3.12-bullseye

# Install ffmpeg and other system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a directory for downloaded files
RUN mkdir -p /workspace/downloads && chown -R vscode:vscode /workspace/downloads

WORKDIR /workspace
