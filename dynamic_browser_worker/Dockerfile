FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers \
    HOME=/home/worker

WORKDIR /opt/worker

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium

COPY worker.py .
RUN useradd --create-home --uid 10001 worker \
    && mkdir -p /work/queue/inbox /work/queue/processing /work/queue/results /work/tmp \
    && chown -R worker:worker /work /home/worker

USER 10001:10001

ENV QUEUE_ROOT=/work/queue \
    UPLOADS_ROOT=/data/uploads \
    ANALYSIS_DURATION_SECONDS=15 \
    MAX_ANALYSIS_DURATION_SECONDS=30

CMD ["python", "worker.py"]
