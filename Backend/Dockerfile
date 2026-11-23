FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:////app/data/pocketman.db

EXPOSE 8000

# strip CRLF in case the repo was checked out on Windows
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# backs up the database before a pending migration, then migrates and serves
CMD ["./docker-entrypoint.sh"]
