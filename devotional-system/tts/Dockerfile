FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy server
COPY server.py .

# Create output directory
RUN mkdir -p output

# Render uses $PORT env var
ENV PORT=8123
EXPOSE 8123

CMD ["python", "server.py"]
