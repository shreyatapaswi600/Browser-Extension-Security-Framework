FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY dynamic_analyzer_service/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir -r requirements.txt

COPY analyzer ./analyzer
COPY dynamic_analyzer_service/core_analyzer ./core_analyzer
COPY dynamic_analyzer_service/main.py ./dynamic_analyzer_service/main.py
COPY dynamic_analyzer_service/database ./database

RUN mkdir -p /app/dynamic_analyzer_service/uploads

WORKDIR /app/dynamic_analyzer_service

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
